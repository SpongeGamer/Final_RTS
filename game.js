// game.js
import { tileSize, mapWidth, mapHeight, tileTypes, map, visibility, chunks, generateMap, drawMap, resources, resourceTypes } from './map.js';
import { drawMiniMap, miniMapSize, miniTileSize } from './minimap.js';
import { camera, handleCameraMovement } from './camera.js';
import { units, unitCount, moveUnit, drawUnits, updateVisibility, startUnitAnimation, drawPlayerResources, playerResources, createWorker, selectUnit, deselectAllUnits, selectedUnits, sendWorkerToResource, selectUnitsInRect } from './units.js';
import { buildings, buildingCount, placeBuilding, drawBuildings } from './buildings.js';
import { fog, updateFog, drawFog } from './fog.js';

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const selectionPanel = document.getElementById('selectionPanel');
const selectionOptions = document.querySelector('.selection-options');

let selectedButton = null;
let isPlacingUnit = false;
window.previewUnit = null;

let lastTime = performance.now();
let lastVisibilityUpdate = 0;
const VISIBILITY_UPDATE_INTERVAL = 100; // Обновлять видимость каждые 100мс

async function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawMap(camera);
    await drawUnits();
    await drawBuildings();
    drawFog(camera);
    drawMiniMap();
    drawPlayerResources();
}

async function init() {
    await generateMap();
    units[0].x = 2;
    units[0].y = 2;
    units.splice(1, 1);
    await updateVisibility();
    await updateFog();
    handleCameraMovement(draw);
    setupCommandButtons();
    functions.startGameLoop();
}

function setupCommandButtons() {
    const commandButtons = document.querySelectorAll('.command-button');
    let buildingDelay = 3000; // 3 секунды на строительство
    let unitDelay = 2000; // 2 секунды на создание юнита

    function updateResourceDisplay() {
        document.getElementById('goldAmount').textContent = playerResources[1].gold;
        document.getElementById('woodAmount').textContent = playerResources[1].wood;
    }

    // Обработка кликов по кнопкам панели команд
    commandButtons.forEach(button => {
        button.addEventListener('click', (e) => {
            const type = e.target.className.split(' ')[1];

            if (selectedButton === button) {
                selectedButton = null;
                isPlacingUnit = false;
                window.previewUnit = null;
                selectionPanel.classList.remove('active');
            } else {
                selectedButton = button;
                isPlacingUnit = true;
                selectionPanel.classList.add('active');
                selectionOptions.innerHTML = '';

                const options = {
                    'building-normal': [
                        { type: 'building-normal', name: 'Казарма', cost: { gold: 30, wood: 20 }, 
                          icon: `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2'><path d='M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z'/><polyline points='9 22 9 12 15 12 15 22'/></svg>` },
                        { type: 'building-normal', name: 'Склад', cost: { gold: 40, wood: 30 },
                          icon: `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2'><path d='M3 3h18v18H3zM12 8v8M8 12h8'/></svg>` }
                    ],
                    'building-defense': [
                        { type: 'building-defense', name: 'Башня', cost: { gold: 25, wood: 15 },
                          icon: `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2'><path d='M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16M3 21h18M9 3v18M15 3v18'/></svg>` },
                        { type: 'building-defense', name: 'Стена', cost: { gold: 15, wood: 15 },
                          icon: `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2'><rect x='3' y='3' width='18' height='18' rx='2' ry='2'/></svg>` }
                    ],
                    'unit-infantry': [
                        { type: 'infantry', name: 'Пехотинец', cost: { gold: 20, wood: 0 },
                          icon: `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2'><circle cx='12' cy='7' r='4'/><path d='M8 21v-8h8v8'/><path d='M12 13v8'/></svg>` },
                        { type: 'worker', name: 'Рабочий', cost: { gold: 10, wood: 0 },
                          icon: `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2'><circle cx='12' cy='7' r='4'/><path d='M3 21h18'/><path d='M8 21v-4l4-4 4 4v4'/></svg>` }
                    ]
                }[type] || [];

                options.forEach(option => {
                    const optionElement = document.createElement('div');
                    optionElement.className = 'selection-option';
                    optionElement.setAttribute('data-tooltip', `${option.name} (${option.cost.gold}з ${option.cost.wood}д)`);
                    optionElement.setAttribute('data-unit-type', option.type);
                    optionElement.innerHTML = option.icon;
                    optionElement.querySelector('svg').style.stroke = '#fff';
                    
                    optionElement.addEventListener('click', () => {
                        if (playerResources[1].gold >= option.cost.gold && playerResources[1].wood >= option.cost.wood) {
                            if (option.type.includes('building')) {
                                // Логика размещения зданий
                            } else {
                                isPlacingUnit = true;
                                selectedButton = button;
                                window.selectedUnitType = option.type; // Сохраняем выбранный тип юнита
                                window.selectedUnitCost = option.cost; // Сохраняем стоимость
                            }
                        }
                    });

                    selectionOptions.appendChild(optionElement);
                });
            }

            draw();
        });
    });

    // Добавляем обработку кликов мыши для выделения юнитов
    let isMouseDown = false;
    let selectionStart = null;

    canvas.addEventListener('mousedown', async (e) => {
        if (e.button === 0) { // ЛКМ
            if (isPlacingUnit && window.selectedUnitType && window.selectedUnitCost) {
                const rect = canvas.getBoundingClientRect();
                const mouseX = e.clientX - rect.left;
                const mouseY = e.clientY - rect.top;
                const { tileX, tileY } = functions.screenToTileCoords(mouseX, mouseY);
                
                if (tileX < 0 || tileX >= mapWidth || tileY < 0 || tileY >= mapHeight) {
                    return;
                }

                if (playerResources[1] && playerResources[1].gold >= window.selectedUnitCost.gold && 
                    playerResources[1].wood >= window.selectedUnitCost.wood) {
                    isPlacingUnit = false;
                    const currentType = window.selectedUnitType;
                    const currentCost = window.selectedUnitCost;
                    
                    if (currentType === 'worker') {
                        const unit = await createWorker(1, tileX, tileY);
                        if (unit) {
                            playerResources[1].gold -= currentCost.gold;
                            playerResources[1].wood -= currentCost.wood;
                            updateResourceDisplay();
                        }
                    } else if (currentType === 'infantry') {
                        const unit = await createInfantry(1, tileX, tileY);
                        if (unit) {
                            playerResources[1].gold -= currentCost.gold;
                            playerResources[1].wood -= currentCost.wood;
                            updateResourceDisplay();
                        }
                    }

                    selectedButton = null;
                    window.previewUnit = null;
                    window.selectedUnitType = null;
                    window.selectedUnitCost = null;
                    selectionPanel.classList.remove('active');
                }
            } else {
                const rect = canvas.getBoundingClientRect();
                const mouseX = e.clientX - rect.left;
                const mouseY = e.clientY - rect.top;
                const { tileX, tileY } = functions.screenToTileCoords(mouseX, mouseY);
    
                isMouseDown = true;
                selectionStart = { tileX, tileY };
    
                deselectAllUnits();
                if (selectUnit(tileX, tileY)) {
                    console.log(`Unit selected at (${tileX}, ${tileY})`);
                } else {
                    console.log(`No unit found at (${tileX}, ${tileY})`);
                }
                draw();
            }
        }
    });
        
    canvas.addEventListener('mousemove', (e) => {
        if (isPlacingUnit) {
            const rect = canvas.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;
            
            const { tileX, tileY } = functions.screenToTileCoords(mouseX, mouseY);
            
            window.previewUnit = {
                x: tileX,
                y: tileY
            };
            
            draw();
        } else if (isMouseDown) {
            const rect = canvas.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;
            const { tileX, tileY } = functions.screenToTileCoords(mouseX, mouseY);
            draw();
        }
    });

    canvas.addEventListener('mouseup', (e) => {
        if (e.button === 0 && isMouseDown) {
            const rect = canvas.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;
            const { tileX, tileY } = functions.screenToTileCoords(mouseX, mouseY);

            const dx = Math.abs(selectionStart.tileX - tileX);
            const dy = Math.abs(selectionStart.tileY - tileY);
            if (dx <= 1 && dy <= 1) {
                deselectAllUnits();
                if (!selectUnit(tileX, tileY)) {
                    console.log(`No unit selected at final click (${tileX}, ${tileY})`);
                }
            } else {
                deselectAllUnits();
                selectUnitsInRect(selectionStart.tileX, selectionStart.tileY, tileX, tileY);
                console.log(`Selected units in rect (${selectionStart.tileX}, ${selectionStart.tileY}) to (${tileX}, ${tileY})`);
            }

            isMouseDown = false;
            selectionStart = null;
            draw();
        } else if (e.button === 2) {
            handleRightClick(e);
        }
    });

    // Добавляем функцию обработки правого клика
    function handleRightClick(event) {
        const rect = canvas.getBoundingClientRect();
        const mouseX = event.clientX - rect.left;
        const mouseY = event.clientY - rect.top;
        const { tileX: clickX, tileY: clickY } = functions.screenToTileCoords(mouseX, mouseY);

        // Проверяем границы карты
        if (clickX < 0 || clickX >= mapWidth || clickY < 0 || clickY >= mapHeight) {
            return; // Игнорируем клик за пределами карты
        }

        const resource = resources.find(r => r.x === clickX && r.y === clickY);
        if (resource && selectedUnits.length > 0) {
            selectedUnits.forEach(unit => {
                if (unit.type === 'worker') {
                    sendWorkerToResource(unit, resource);
                }
            });
        } else if (map[clickY][clickX] !== 'water' && selectedUnits.length > 0) {
            selectedUnits.forEach(unit => {
                moveUnit(units.indexOf(unit), clickX, clickY);
                unit.targetResource = null;
                unit.lastResourceTarget = null;
                unit.isReturningToBase = false;
            });
        }
    }

    // Отключаем контекстное меню браузера
    canvas.addEventListener('contextmenu', (e) => {
        e.preventDefault();
    });

    updateResourceDisplay();
}

const functions = {
    gameLoop(currentTime) {
        const deltaTime = (currentTime - lastTime) / 1000;
        lastTime = currentTime;
        startUnitAnimation();
        if (currentTime - lastVisibilityUpdate > VISIBILITY_UPDATE_INTERVAL) {
            updateVisibility();
            updateFog();
            lastVisibilityUpdate = currentTime;
        }
        draw();
        requestAnimationFrame(functions.gameLoop);
    },

    startGameLoop() {
        lastTime = performance.now();
        requestAnimationFrame(functions.gameLoop);
    },

    screenToTileCoords(mouseX, mouseY) {
        // Учитываем размер canvas и текущее положение камеры
        const canvas = document.getElementById('gameCanvas');
        const rect = canvas.getBoundingClientRect();
        
        // Преобразуем координаты мыши относительно реального размера canvas
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        
        const adjustedX = mouseX * scaleX;
        const adjustedY = mouseY * scaleY;
        
        // Преобразуем в мировые координаты с учетом масштаба камеры
        const worldX = (adjustedX / camera.zoom) + (camera.x * tileSize);
        const worldY = (adjustedY / camera.zoom) + (camera.y * tileSize);
        
        // Преобразуем в координаты тайлов
        const tileX = Math.floor(worldX / tileSize);
        const tileY = Math.floor(worldY / tileSize);
        
        console.log(`Screen coords: (${mouseX}, ${mouseY})`);
        console.log(`Adjusted coords: (${adjustedX}, ${adjustedY})`);
        console.log(`World coords: (${worldX}, ${worldY})`);
        console.log(`Tile coords: (${tileX}, ${tileY})`);
        
        return {
            tileX: Math.max(0, Math.min(mapWidth - 1, tileX)),
            tileY: Math.max(0, Math.min(mapHeight - 1, tileY))
        };
    }
};

init();