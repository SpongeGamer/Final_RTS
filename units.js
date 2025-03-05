// units.js
import { mapWidth, mapHeight, map, visibility, exploredMap } from './map.js';
import { camera } from './camera.js';
import { resources, resourceTypes } from './map.js';
import { updateFog } from './fog.js';

let units = [
    { 
        x: 2, y: 2, 
        player: 1, 
        visionRange: 3, 
        type: 'infantry', 
        selected: false, 
        inventory: { resource: null, amount: 0 }, 
        maxInventory: 100,
        lastVisibilityUpdateX: 2,
        lastVisibilityUpdateY: 2
    },
    { 
        x: mapWidth - 3, y: mapHeight - 3, 
        player: 2, 
        visionRange: 3, 
        type: 'infantry', 
        selected: false, 
        inventory: { resource: null, amount: 0 }, 
        maxInventory: 100,
        lastVisibilityUpdateX: mapWidth - 3,
        lastVisibilityUpdateY: mapHeight - 3
    }
];
let unitCount = 0;
let playerResources = {
    1: { gold: 25, wood: 25 }, // Увеличиваем начальные ресурсы
    2: { gold: 25, wood: 25 }  // Увеличиваем начальные ресурсы
};

let selectedUnits = [];

// Изменяем константы движения
const UNIT_SPEED = 2; // Скорость в тайлах в секунду
const MOVEMENT_THRESHOLD = 0.01;

let isAnimating = true; // Изменяем на true по умолчанию

function startUnitAnimation() {
    if (!isAnimating) return;

    units.forEach((unit, unitIndex) => {
        // Проверяем достижение базы для рабочих с ресурсами
        if (unit.type === 'worker' && unit.isReturningToBase && 
            unit.inventory.amount > 0 && unit.inventory.resource) {
            
            // Проверяем, находится ли юнит рядом с базой (расстояние <= 1.5 клетки)
            const distanceToBase = Math.sqrt(Math.pow(unit.x - 2, 2) + Math.pow(unit.y - 2, 2));
            if (distanceToBase <= 1.5) {
                console.log('Рабочий достиг базы и готов разгрузиться:', unit);
                deliverResources(unit);
                return;
            }
        }

        if (unit.targetX !== undefined && unit.targetY !== undefined) {
            // Если нет текущего пути или он пуст, пробуем найти новый путь
            if (!unit.path || unit.path.length === 0) {
                unit.path = findPath(Math.round(unit.x), Math.round(unit.y), unit.targetX, unit.targetY);
                
                if (!unit.path) {
                    unit.targetX = undefined;
                    unit.targetY = undefined;
                    return;
                }
            }
            
            if (unit.path && unit.path.length > 0) {
                const nextStep = unit.path[0];
                
                if (unit.currentX === undefined) {
                    unit.currentX = unit.x;
                    unit.currentY = unit.y;
                }
                
                const dx = nextStep.x - unit.currentX;
                const dy = nextStep.y - unit.currentY;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                if (distance > MOVEMENT_THRESHOLD) {
                    const moveDistance = UNIT_SPEED / 60; // 60 FPS
                    const moveRatio = Math.min(moveDistance / distance, 1);
                    
                    unit.currentX += dx * moveRatio;
                    unit.currentY += dy * moveRatio;
                    
                    unit.x = Math.round(unit.currentX);
                    unit.y = Math.round(unit.currentY);
                    
                    // Обновляем видимость при значительном перемещении
                    if (Math.abs(unit.x - unit.lastVisibilityUpdateX) > 0.5 || 
                        Math.abs(unit.y - unit.lastVisibilityUpdateY) > 0.5) {
                        updateVisibility();
                        unit.lastVisibilityUpdateX = unit.x;
                        unit.lastVisibilityUpdateY = unit.y;
                    }
                } else {
                    unit.currentX = nextStep.x;
                    unit.currentY = nextStep.y;
                    unit.x = nextStep.x;
                    unit.y = nextStep.y;
                    unit.path.shift();
                    
                    if (unit.path.length === 0) {
                        // Достигли конечной точки
                        if (unit.x === unit.targetX && unit.y === unit.targetY) {
                            // Если это точка с ресурсом, начинаем сбор
                            if (unit.targetResource && 
                                unit.x === unit.targetResource.x && 
                                unit.y === unit.targetResource.y) {
                                const resourceIndex = resources.indexOf(unit.targetResource);
                                if (resourceIndex !== -1) {
                                    collectResource(unitIndex, resourceIndex);
                                }
                            }
                            unit.targetX = undefined;
                            unit.targetY = undefined;
                            unit.currentX = undefined;
                            unit.currentY = undefined;
                        } else {
                            unit.path = findPath(unit.x, unit.y, unit.targetX, unit.targetY);
                        }
                    }
                }
            }
        }
    });
}

// Функция для поиска пути (A*)
function findPath(startX, startY, targetX, targetY) {
    const openSet = [];
    const closedSet = new Set();
    const cameFrom = new Map();
    const gScore = new Map();
    const fScore = new Map();
    
    const start = `${startX},${startY}`;
    const goal = `${targetX},${targetY}`;
    
    openSet.push(start);
    gScore.set(start, 0);
    fScore.set(start, heuristic(startX, startY, targetX, targetY));
    
    while (openSet.length > 0) {
        let current = openSet[0];
        let lowestF = fScore.get(current);
        let currentIndex = 0;
        
        // Находим узел с наименьшей оценкой f
        for (let i = 1; i < openSet.length; i++) {
            const f = fScore.get(openSet[i]);
            if (f < lowestF) {
                current = openSet[i];
                lowestF = f;
                currentIndex = i;
            }
        }
        
        if (current === goal) {
            // Восстанавливаем путь
            const path = [];
            let currentNode = current;
            while (cameFrom.has(currentNode)) {
                const [x, y] = currentNode.split(',').map(Number);
                path.unshift({x, y});
                currentNode = cameFrom.get(currentNode);
            }
            return path;
        }
        
        openSet.splice(currentIndex, 1);
        closedSet.add(current);
        
        const [currentX, currentY] = current.split(',').map(Number);
        
        // Проверяем соседние клетки
        const neighbors = [
            {x: currentX - 1, y: currentY},
            {x: currentX + 1, y: currentY},
            {x: currentX, y: currentY - 1},
            {x: currentX, y: currentY + 1}
        ];
        
        for (const neighbor of neighbors) {
            if (neighbor.x < 0 || neighbor.x >= mapWidth || 
                neighbor.y < 0 || neighbor.y >= mapHeight ||
                map[neighbor.y][neighbor.x] === 'water') {
                continue;
            }
            
            const neighborKey = `${neighbor.x},${neighbor.y}`;
            if (closedSet.has(neighborKey)) continue;
            
            const tentativeGScore = gScore.get(current) + 1;
            
            if (!openSet.includes(neighborKey)) {
                openSet.push(neighborKey);
            } else if (tentativeGScore >= gScore.get(neighborKey)) {
                continue;
            }
            
            cameFrom.set(neighborKey, current);
            gScore.set(neighborKey, tentativeGScore);
            fScore.set(neighborKey, tentativeGScore + heuristic(neighbor.x, neighbor.y, targetX, targetY));
        }
    }
    
    return null; // Путь не найден
}

// Эвристическая функция (манхэттенское расстояние)
function heuristic(x1, y1, x2, y2) {
    return Math.abs(x1 - x2) + Math.abs(y1 - y2);
}

function updateVisibility() {
    // Сбрасываем только текущую видимость
    for (let y = 0; y < mapHeight; y++) {
        for (let x = 0; x < mapWidth; x++) {
            visibility[y][x] = false;
        }
    }

    units.forEach(unit => {
        if (unit.player === 1) { // Только для юнитов первого игрока
            const range = unit.visionRange;
            const centerX = unit.x;
            const centerY = unit.y;
            
            // Используем алгоритм для круговой области видимости
            for (let y = centerY - range; y <= centerY + range; y++) {
                for (let x = centerX - range; x <= centerX + range; x++) {
                    if (y >= 0 && y < mapHeight && x >= 0 && x < mapWidth) {
                        // Вычисляем расстояние от центра до текущей точки
                        const dx = x - centerX;
                        const dy = y - centerY;
                        const distance = Math.sqrt(dx * dx + dy * dy);
                        
                        if (distance <= range) {
                            // Проверяем линию видимости
                            let hasLineOfSight = true;
                            const steps = Math.max(Math.abs(dx), Math.abs(dy));
                            if (steps > 0) {
                                for (let i = 1; i <= steps; i++) {
                                    const checkX = Math.round(centerX + (dx * i) / steps);
                                    const checkY = Math.round(centerY + (dy * i) / steps);
                                    if (map[checkY][checkX] === 'water') {
                                        hasLineOfSight = false;
                                        break;
                                    }
                                }
                            }
                            
                            if (hasLineOfSight) {
                                visibility[y][x] = true;
                                exploredMap[y][x] = true;
                            }
                        }
                    }
                }
            }
        }
    });
    
    updateFog();
}

function updateUnitPositions() {
    units.forEach((unit, unitIndex) => {
        // Если у юнита есть целевая точка
        if (unit.targetX !== undefined && unit.targetY !== undefined) {
            // Если нет текущего пути или он пуст, пробуем найти новый путь
            if (!unit.path || unit.path.length === 0) {
                // Пытаемся найти путь к конечной цели
                unit.path = findPath(Math.round(unit.x), Math.round(unit.y), unit.targetX, unit.targetY);
                
                // Если путь не найден, ищем ближайшую достижимую точку
                if (!unit.path) {
                    let bestDistance = Infinity;
                    let bestX = unit.targetX;
                    let bestY = unit.targetY;
                    
                    const searchRange = 5;
                    for (let dy = -searchRange; dy <= searchRange; dy++) {
                        for (let dx = -searchRange; dx <= searchRange; dx++) {
                            const newX = unit.targetX + dx;
                            const newY = unit.targetY + dy;
                            
                            if (newX >= 0 && newX < mapWidth && newY >= 0 && newY < mapHeight && 
                                map[newY][newX] !== 'water') {
                                const path = findPath(Math.round(unit.x), Math.round(unit.y), newX, newY);
                                if (path) {
                                    const distance = Math.abs(dx) + Math.abs(dy);
                                    if (distance < bestDistance) {
                                        bestDistance = distance;
                                        bestX = newX;
                                        bestY = newY;
                                        unit.path = path;
                                    }
                                }
                            }
                        }
                    }
                    
                    if (!unit.path) {
                        // Если путь не найден совсем, отменяем движение
                        unit.targetX = undefined;
                        unit.targetY = undefined;
                        return;
                    }
                }
            }
            
            // Если есть путь, двигаемся по нему
            if (unit.path && unit.path.length > 0) {
                const nextStep = unit.path[0];
                
                // Инициализация промежуточных координат
                if (unit.currentX === undefined) {
                    unit.currentX = unit.x;
                    unit.currentY = unit.y;
                }
                
                // Вычисляем направление движения
                const dx = nextStep.x - unit.currentX;
                const dy = nextStep.y - unit.currentY;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                if (distance > MOVEMENT_THRESHOLD) {
                    // Плавное движение к следующей точке
                    unit.currentX += (dx / distance) * UNIT_SPEED;
                    unit.currentY += (dy / distance) * UNIT_SPEED;
                    
                    // Обновляем целочисленные координаты
                    unit.x = Math.round(unit.currentX);
                    unit.y = Math.round(unit.currentY);
                    
                    // Обновляем видимость при изменении позиции
                    if (unit.x !== unit.lastVisibilityUpdateX || unit.y !== unit.lastVisibilityUpdateY) {
                        updateVisibility();
                        unit.lastVisibilityUpdateX = unit.x;
                        unit.lastVisibilityUpdateY = unit.y;
                    }
                } else {
                    // Достигли следующей точки пути
                    unit.currentX = nextStep.x;
                    unit.currentY = nextStep.y;
                    unit.x = nextStep.x;
                    unit.y = nextStep.y;
                    unit.path.shift();
                    
                    // Обновляем видимость
                    updateVisibility();
                    unit.lastVisibilityUpdateX = unit.x;
                    unit.lastVisibilityUpdateY = unit.y;
                    
                    // Проверяем, достигли ли конечной цели
                    if (unit.path.length === 0) {
                        if (unit.x === unit.targetX && unit.y === unit.targetY) {
                            // Достигли конечной цели
                            unit.targetX = undefined;
                            unit.targetY = undefined;
                            unit.currentX = undefined;
                            unit.currentY = undefined;
                        } else {
                            // Если не достигли цели, пробуем найти новый путь
                            unit.path = findPath(unit.x, unit.y, unit.targetX, unit.targetY);
                        }
                    }
                }
            }
        }
        
        // Проверяем сбор ресурсов
        if (visibility[unit.y][unit.x]) {
            const resource = resources.find(r => r.x === unit.x && r.y === unit.y);
            if (resource && unit.player) {
                collectResource(unitIndex, resources.indexOf(resource));
            }
        }
    });
}

// Обновляем функцию collectResource
function collectResource(unitIndex, resourceIndex) {
    const unit = units[unitIndex];
    const resource = resources[resourceIndex];
    
    console.log('Начинаем сбор ресурса:', resource);
    
    // Собираем ресурс только если юнит специально отправлен на сбор
    if (unit.type === 'worker' && resource && resource.amount > 0 && !unit.isReturningToBase) {
        console.log('Собираем ресурс, количество до:', resource.amount);
        
        // Собираем ресурс
        const amountToCollect = Math.min(10, resource.amount);
        resource.amount -= amountToCollect;
        unit.inventory.resource = resource.type;
        unit.inventory.amount = amountToCollect;
        console.log('Собрано ресурсов:', amountToCollect, 'осталось:', resource.amount);

        // Если ресурс истощен, удаляем его
        if (resource.amount <= 0) {
            console.log('Ресурс истощен, удаляем');
            resources.splice(resourceIndex, 1);
            unit.lastResourceTarget = null;
        }

        // Отправляем к базе
        unit.targetResource = null;
        unit.isReturningToBase = true;
        console.log('Рабочий возвращается на базу с ресурсами');
        moveUnit(unitIndex, 2, 2);
    }
}

// Обновляем функцию deliverResources
function deliverResources(unit) {
    if (unit.inventory.amount > 0 && unit.inventory.resource) {
        console.log('Доставляем ресурсы на базу:', unit.inventory);
        
        // Добавляем ресурсы игроку
        if (unit.inventory.resource === 'gold') {
            playerResources[unit.player].gold += unit.inventory.amount;
            console.log('Добавлено золота:', unit.inventory.amount);
        } else if (unit.inventory.resource === 'wood') {
            playerResources[unit.player].wood += unit.inventory.amount;
            console.log('Добавлено дерева:', unit.inventory.amount);
        }

        // Очищаем инвентарь
        unit.inventory.amount = 0;
        unit.inventory.resource = null;
        unit.isReturningToBase = false;

        // Проверяем, существует ли ресурс в клетке и есть ли в нём что собирать
        const resourceAtLastLocation = resources.find(r => 
            r.x === unit.lastResourceTarget?.x && 
            r.y === unit.lastResourceTarget?.y && 
            r.amount > 0
        );

        if (resourceAtLastLocation) {
            console.log('Возвращаемся к ресурсу:', resourceAtLastLocation);
            unit.targetResource = resourceAtLastLocation;
            const unitIndex = units.indexOf(unit);
            if (unitIndex !== -1) {
                moveUnit(unitIndex, resourceAtLastLocation.x, resourceAtLastLocation.y);
            }
        } else {
            // Если ресурс истощен, остаемся на базе
            console.log('Ресурс истощен или отсутствует, ожидаем на базе');
            unit.lastResourceTarget = null;
            unit.targetResource = null;
            // Находим свободную клетку рядом с базой
            const unitIndex = units.indexOf(unit);
            if (unitIndex !== -1) {
                moveUnitNearBase(unitIndex);
            }
        }
    }
}

// Добавляем новую функцию для поиска свободного места рядом с базой
function moveUnitNearBase(unitIndex) {
    const baseX = 2;
    const baseY = 2;
    const positions = [
        {x: baseX-1, y: baseY-1}, {x: baseX, y: baseY-1}, {x: baseX+1, y: baseY-1},
        {x: baseX-1, y: baseY}, {x: baseX+1, y: baseY},
        {x: baseX-1, y: baseY+1}, {x: baseX, y: baseY+1}, {x: baseX+1, y: baseY+1}
    ];

    // Фильтруем позиции, исключая занятые и непроходимые
    const availablePositions = positions.filter(pos => {
        // Проверяем границы карты и тип местности
        if (pos.x < 0 || pos.x >= mapWidth || pos.y < 0 || pos.y >= mapHeight || 
            map[pos.y][pos.x] === 'water') {
            return false;
        }
        
        // Проверяем, не занята ли клетка другим юнитом
        return !units.some(u => u.x === pos.x && u.y === pos.y);
    });

    if (availablePositions.length > 0) {
        // Выбираем случайную свободную позицию
        const pos = availablePositions[Math.floor(Math.random() * availablePositions.length)];
        moveUnit(unitIndex, pos.x, pos.y);
    }
}

function createWorker(player, x, y) {
    units.push({
        x,
        y,
        player,
        visionRange: 3,
        type: 'worker',
        selected: false,
        inventory: { resource: null, amount: 0 },
        maxInventory: 100,
        lastVisibilityUpdateX: x,
        lastVisibilityUpdateY: y,
        targetResource: null,
        lastResourceTarget: null,
        isReturningToBase: false,
        currentX: undefined,
        currentY: undefined
    });
}

// Обновляем функцию moveUnit
function moveUnit(unitIndex, newX, newY) {
    if (newX >= 0 && newX < mapWidth && newY >= 0 && newY < mapHeight && 
        map[newY][newX] !== 'water') {
        
        // Проверяем, не занята ли целевая клетка другим юнитом
        const isOccupied = units.some((u, i) => 
            i !== unitIndex && // Исключаем самого себя
            u.x === newX && 
            u.y === newY
        );

        if (!isOccupied) {
            const unit = units[unitIndex];
            unit.targetX = newX;
            unit.targetY = newY;
            startUnitAnimation();
        } else {
            console.log('Клетка занята, ищем другой путь');
            // Если клетка занята и это рабочий возвращающийся на базу
            const unit = units[unitIndex];
            if (unit.type === 'worker' && unit.isReturningToBase) {
                moveUnitNearBase(unitIndex);
            }
        }
    }
}

// Обновите функцию drawUnits для отрисовки сборщика с SVG
function drawUnits() {
    const visibleWidth = Math.floor(camera.width * camera.zoom);
    const visibleHeight = Math.floor(camera.height * camera.zoom);
    const startX = Math.floor(camera.x);
    const endX = Math.min(startX + visibleWidth + 1, mapWidth);
    const startY = Math.floor(camera.y);
    const endY = Math.min(startY + visibleHeight + 1, mapHeight);

    const ctx = document.getElementById('gameCanvas').getContext('2d');
    ctx.save();
    ctx.scale(camera.zoom, camera.zoom);

    units.forEach(unit => {
        if (unit.x >= startX && unit.x < endX && unit.y >= startY && unit.y < endY) {
            const color = unit.player === 1 ? '#0000FF' : '#FF0000';
            const x = (unit.x - camera.x) * 32;
            const y = (unit.y - camera.y) * 32;

            // Рисуем выделение если юнит выбран
            if (unit.selected) {
                ctx.strokeStyle = '#FFFFFF';
                ctx.lineWidth = 2;
                ctx.strokeRect(x + 2, y + 2, 28, 28);
            }

            switch(unit.type) {
                case 'worker':
                    // Рисуем рабочего как маленький квадрат с инструментом
                    ctx.fillStyle = color;
                    ctx.fillRect(x + 8, y + 8, 16, 16);
                    // Инструмент (кирка)
                    ctx.beginPath();
                    ctx.moveTo(x + 16, y + 16);
                    ctx.lineTo(x + 20, y + 20);
                    ctx.strokeStyle = '#FFD700';
                    ctx.lineWidth = 2;
                    ctx.stroke();
                    break;
                case 'infantry':
                    // Рисуем пехотинца как треугольник
                    ctx.beginPath();
                    ctx.moveTo(x + 16, y + 8);
                    ctx.lineTo(x + 24, y + 24);
                    ctx.lineTo(x + 8, y + 24);
                    ctx.closePath();
                    ctx.fillStyle = color;
                    ctx.fill();
                    break;
                default:
                    // Для остальных юнитов используем квадрат
                    ctx.fillStyle = color;
                    ctx.fillRect(x + 8, y + 8, 16, 16);
            }
        }
    });

    // Отрисовка предварительного размещения юнита
    if (window.previewUnit) {
        const x = (Math.floor(window.previewUnit.x / 32) * 32 - camera.x * 32);
        const y = (Math.floor(window.previewUnit.y / 32) * 32 - camera.y * 32);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.fillRect(x, y, 32, 32);
    }

    ctx.restore();
}

function drawPlayerResources() {
    const goldAmount = document.getElementById('goldAmount');
    const woodAmount = document.getElementById('woodAmount');
    
    if (goldAmount && woodAmount) {
        goldAmount.textContent = playerResources[1].gold;
        woodAmount.textContent = playerResources[1].wood;
    }
}

// Функция для выделения юнита
function selectUnit(x, y) {
    units.forEach(unit => {
        if (unit.x === x && unit.y === y && unit.player === 1) { // Только наши юниты (игрок 1)
            unit.selected = true;
            selectedUnits.push(unit);
        }
    });
}

// Функция для снятия выделения со всех юнитов
function deselectAllUnits() {
    units.forEach(unit => unit.selected = false);
    selectedUnits = [];
}

// Обновляем функцию sendWorkerToResource
function sendWorkerToResource(unit, resource) {
    if (unit.type === 'worker') {
        unit.targetResource = resource;
        unit.targetX = resource.x;
        unit.targetY = resource.y;
        unit.lastResourceTarget = resource; // Сохраняем цель для возврата после доставки
    }
}

// Экспортируем все необходимые функции и данные
export { 
    units, unitCount, moveUnit, drawUnits, updateVisibility, 
    startUnitAnimation, drawPlayerResources, playerResources, 
    createWorker, selectUnit, deselectAllUnits, selectedUnits,
    sendWorkerToResource 
};