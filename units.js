import { mapWidth, mapHeight, map, visibility, exploredMap, resources, base1X, base1Y, base2X, base2Y } from './map.js';
import { camera } from './camera.js';
import { updateFog } from './fog.js';
import { buildings } from './buildings.js';

let units = [];
let playerResources = {
    1: { gold: 25, wood: 25 },
    2: { gold: 25, wood: 25 }
};
let selectedUnits = [];

const UNIT_SPEED = 2;
const MOVEMENT_THRESHOLD = 0.01;
let isAnimating = true;
const RESOURCE_COLLECTION_INTERVAL = 1000;

function initializeUnits() {
    units = [
        { 
            x: Math.round(base1X+1), 
            y: Math.round(base1Y+1),
            player: 1, 
            visionRange: 3, 
            type: 'infantry', 
            selected: false, 
            inventory: { resource: null, amount: 0 }, 
            maxInventory: 100,
            lastVisibilityUpdateX: Math.round(base1X),
            lastVisibilityUpdateY: Math.round(base1Y),
            isProcessing: false // Добавляем флаг
        },
        { 
            x: Math.round(base2X-1), 
            y: Math.round(base2Y-1), 
            player: 2, 
            visionRange: 3, 
            type: 'infantry', 
            selected: false, 
            inventory: { resource: null, amount: 0 }, 
            maxInventory: 100,
            lastVisibilityUpdateX: Math.round(base2X),
            lastVisibilityUpdateY: Math.round(base2Y),
            isProcessing: false // Добавляем флаг
        }
    ];
}


function startUnitAnimation() {
    if (!isAnimating) return;

    units.forEach((unit, unitIndex) => {
        // Пропускаем юнит, если он уже обрабатывается в этом кадре
        if (unit.isProcessing) return;
        unit.isProcessing = true;

        let shouldContinue = true;

        if (unit.type === 'worker' && unit.isReturningToBase && unit.inventory.amount > 0) {
            // Проверяем, достаточно ли юнит близко к базе для сдачи ресурсов
            if (isNearBase(unit.x, unit.y)) {
                deliverResources(unit);
                shouldContinue = false;
            } else {
                // Если юнит еще не близко, направляем его к ближайшей свободной клетке вокруг базы
                moveUnitNearBase(units.indexOf(unit));
                shouldContinue = false; // Предотвращаем дальнейшее движение в этом кадре
            }
        }

        if (shouldContinue && unit.type === 'worker' && !unit.isReturningToBase && unit.targetResource) {
            const distanceToResource = Math.sqrt(
                Math.pow(unit.x - unit.targetResource.x, 2) + 
                Math.pow(unit.y - unit.targetResource.y, 2)
            );
            
            if (distanceToResource <= 1.0 && Math.abs(unit.x - unit.targetResource.x) <= 1 && Math.abs(unit.y - unit.targetResource.y) <= 1) {
                const resourceIndex = resources.indexOf(unit.targetResource);
                if (resourceIndex !== -1) {
                    collectResource(unitIndex, resourceIndex);
                    unit.targetX = unit.x;
                    unit.targetY = unit.y;
                    shouldContinue = false;
                }
            }
        }

        if (shouldContinue && unit.targetX !== undefined && unit.targetY !== undefined) {
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

                if (checkCollision(nextStep.x, nextStep.y, unitIndex)) {
                    // Перестраиваем путь, избегая текущей позиции юнита
                    const currentX = Math.round(unit.currentX || unit.x);
                    const currentY = Math.round(unit.currentY || unit.y);
                    unit.path = findPath(currentX, currentY, unit.targetX, unit.targetY);
                    if (!unit.path || unit.path.length === 0) {
                        unit.targetX = undefined;
                        unit.targetY = undefined;
                        unit.currentX = undefined;
                        unit.currentY = undefined;
                    }
                    return;
                }

                if (unit.currentX === undefined) {
                    unit.currentX = unit.x;
                    unit.currentY = unit.y;
                }

                const dx = nextStep.x - unit.currentX;
                const dy = nextStep.y - unit.currentY;
                const distance = Math.sqrt(dx * dx + dy * dy);

                if (distance > MOVEMENT_THRESHOLD) {
                    const moveDistance = UNIT_SPEED / 60;
                    const moveRatio = Math.min(moveDistance / distance, 1);
                    unit.currentX += dx * moveRatio;
                    unit.currentY += dy * moveRatio;
                    unit.x = Math.round(unit.currentX);
                    unit.y = Math.round(unit.currentY);

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
                        unit.targetX = undefined;
                        unit.targetY = undefined;
                        unit.currentX = undefined;
                        unit.currentY = undefined;
                    }
                }
            }
        }

        unit.isProcessing = false; // Сбрасываем флаг после обработки
    });
}

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
        
        for (let i = 1; i < openSet.length; i++) {
            const f = fScore.get(openSet[i]);
            if (f < lowestF) {
                current = openSet[i];
                lowestF = f;
                currentIndex = i;
            }
        }
        
        if (current === goal) {
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
        
        const neighbors = [
            {x: currentX - 1, y: currentY},
            {x: currentX + 1, y: currentY},
            {x: currentX, y: currentY - 1},
            {x: currentX, y: currentY + 1}
        ];
        
        for (const neighbor of neighbors) {
            if (neighbor.x < 0 || neighbor.x >= mapWidth || 
                neighbor.y < 0 || neighbor.y >= mapHeight ||
                map[neighbor.y][neighbor.x] === 'water' ||
                checkCollision(neighbor.x, neighbor.y, -1)) { // -1 как индикатор проверки без исключения юнита
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
    
    return null;
}

function heuristic(x1, y1, x2, y2) {
    return Math.abs(x1 - x2) + Math.abs(y1 - y2);
}

function updateVisibility() {
    for (let y = 0; y < mapHeight; y++) {
        for (let x = 0; x < mapWidth; x++) {
            visibility[y][x] = false;
        }
    }

    units.forEach(unit => {
        if (unit.player === 1) {
            const range = unit.visionRange;
            const centerX = unit.x;
            const centerY = unit.y;
            
            for (let y = centerY - range; y <= centerY + range; y++) {
                for (let x = centerX - range; x <= centerX + range; x++) {
                    if (y >= 0 && y < mapHeight && x >= 0 && x < mapWidth) {
                        const dx = x - centerX;
                        const dy = y - centerY;
                        const distance = Math.sqrt(dx * dx + dy * dy);
                        
                        if (distance <= range) {
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

function collectResource(unitIndex, resourceIndex) {
    const unit = units[unitIndex];
    const resource = resources[resourceIndex];

    if (unit.type === 'worker' && resource && resource.amount > 0 && !unit.isReturningToBase) {
        const currentTime = Date.now();
        if (!unit.lastCollectionTime || currentTime - unit.lastCollectionTime >= RESOURCE_COLLECTION_INTERVAL) {
            const amountToCollect = Math.min(1, resource.amount);
            resource.amount -= amountToCollect;
            unit.inventory.resource = resource.type;
            unit.inventory.amount += amountToCollect;
            unit.lastCollectionTime = currentTime;

            if (resource.amount <= 0) {
                resources.splice(resourceIndex, 1);
                unit.targetResource = null;
                unit.lastResourceTarget = null;
            }

            if (unit.inventory.amount >= 10) {
                unit.isReturningToBase = true;
                unit.targetResource = null;
                moveUnitNearBase(unitIndex); // Направляем юнита к ближайшей свободной клетке вокруг базы
            }
        }
    }
}

function checkCollision(x, y, excludeUnitIndex) {
    // Проверка столкновения с другими юнитами
    for (let i = 0; i < units.length; i++) {
        if (i !== excludeUnitIndex && Math.round(units[i].x) === x && Math.round(units[i].y) === y) {
            return true;
        }
    }
    // Проверка столкновения с базой
    const basePositions = [
        { x: base1X, y: base1Y }, // База игрока 1
        { x: base2X, y: base2Y }  // База игрока 2
    ];
    for (const base of basePositions) {
        if (Math.round(base.x) === x && Math.round(base.y) === y) {
            return true;
        }
    }
    return false;
}

function isNearBase(x, y) {
    // Проверяем расстояние до любой соседней клетки базы
    const basePositions = [
        { x: base1X, y: base1Y },
        { x: base1X + 1, y: base1Y },
        { x: base1X, y: base1Y + 1 },
        { x: base1X + 1, y: base1Y + 1 },
        { x: base1X - 1, y: base1Y },
        { x: base1X, y: base1Y - 1 },
        { x: base1X - 1, y: base1Y - 1 },
        { x: base1X + 1, y: base1Y - 1 },
        { x: base1X - 1, y: base1Y + 1 }
    ];

    return basePositions.some(pos => 
        Math.round(x) === pos.x && Math.round(y) === pos.y
    );
}

function deliverResources(unit) {
    const unitIndex = units.indexOf(unit);

    // Проверяем, близко ли юнит к базе
    if (!isNearBase(unit.x, unit.y)) {
        moveUnitNearBase(unitIndex); // Двигаем к базе, если далеко
        return false;
    }

    // Сдача ресурсов, если они есть
    if (unit.inventory.resource && unit.inventory.amount > 0) {
        playerResources[unit.player][unit.inventory.resource] += unit.inventory.amount;
        unit.inventory.amount = 0;
        unit.inventory.resource = null;
        unit.isReturningToBase = false;

        // Возвращаемся к последнему ресурсу или ищем новый
        if (unit.lastResourceTarget) {
            const resource = resources.find(r => 
                r.x === unit.lastResourceTarget.x && 
                r.y === unit.lastResourceTarget.y &&
                r.amount > 0
            );
            if (resource) {
                sendWorkerToResource(unit, resource);
            } else {
                unit.lastResourceTarget = null;
                const nearestResource = findNearestResource(unit.x, unit.y);
                if (nearestResource) {
                    sendWorkerToResource(unit, nearestResource);
                }
            }
        } else {
            const nearestResource = findNearestResource(unit.x, unit.y);
            if (nearestResource) {
                sendWorkerToResource(unit, nearestResource);
            }
        }
        return true;
    }
    return false;
}

function findNearestResource(x, y) {
    let nearest = null;
    let minDistance = Infinity;
    resources.forEach(resource => {
        const distance = Math.sqrt(Math.pow(resource.x - x, 2) + Math.pow(resource.y - y, 2));
        if (distance < minDistance && resource.amount > 0) {
            minDistance = distance;
            nearest = resource;
        }
    });
    return nearest;
}

function moveUnitNearBase(unitIndex) {
    const unit = units[unitIndex];
    const basePositions = [
        { x: base1X + 1, y: base1Y },
        { x: base1X, y: base1Y + 1 },
        { x: base1X + 1, y: base1Y + 1 },
        { x: base1X - 1, y: base1Y },
        { x: base1X, y: base1Y - 1 },
        { x: base1X + 1, y: base1Y - 1 },
        { x: base1X - 1, y: base1Y + 1 },
        { x: base1X - 1, y: base1Y - 1 }
    ];

    // Находим ближайшую свободную клетку
    let nearestPos = null;
    let minDistance = Infinity;

    for (const pos of basePositions) {
        if (pos.x >= 0 && pos.x < mapWidth && pos.y >= 0 && pos.y < mapHeight && 
            !checkCollision(pos.x, pos.y, unitIndex)) {
            const distance = Math.sqrt(Math.pow(unit.x - pos.x, 2) + Math.pow(unit.y - pos.y, 2));
            if (distance < minDistance) {
                minDistance = distance;
                nearestPos = pos;
            }
        }
    }

    if (nearestPos) {
        moveUnit(unitIndex, nearestPos.x, nearestPos.y);
        return true;
    }
    return false; // Если нет свободных клеток, юнит остается на месте
}

let spawnEffects = [];

function showSpawnAnimation(x, y) {
    const spawnEffect = {
        x,
        y,
        progress: 0,
        maxProgress: 60,
        particles: Array.from({length: 8}, (_, i) => ({
            angle: (i * Math.PI * 2) / 8,
            radius: 0
        }))
    };
    spawnEffects.push(spawnEffect);
}

function isNearBaseForSpawn(x, y) {
    const base = buildings.find(b => b.player === 1 && b.type === 'base1');
    if (!base) return false;
    const maxDistance = 2;
    const dx = Math.abs(x - base.x);
    const dy = Math.abs(y - base.y);
    return dx <= maxDistance && dy <= maxDistance && visibility[y][x]; // Проверка видимости
}
function hasBarracks(player) {
    return buildings.some(building => 
        building.player === player && 
        building.type === 'barracks'
    );
}

function createWorker(player, x, y) {
    if (!isNearBaseForSpawn(x, y) || !visibility[y][x]) return null;

    if (!playerResources[player] || playerResources[player].gold < 10 || playerResources[player].wood < 0) {
        return null;
    }

    showSpawnAnimation(x, y);

    return new Promise((resolve) => {
        setTimeout(() => {
            if (!visibility[y][x] || !isNearBaseForSpawn(x, y)) {
                resolve(null);
                return;
            }

            if (playerResources[player].gold >= 10) {
                const unit = {
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
                    currentX: x,
                    currentY: y,
                    lastCollectionTime: null,
                    isProcessing: false // Добавляем флаг
                };
                units.push(unit);
                playerResources[player].gold -= 10;
                updateVisibility();
                resolve(unit);
            } else {
                resolve(null);
            }
        }, 3000);
    });
}

function createInfantry(player, x, y) {
    if (!isNearBaseForSpawn(x, y) || !visibility[y][x]) return null;

    if (units.some(u => u.type === 'infantry' && u.player === player) && !hasBarracks(player)) return null;

    if (playerResources[player] && playerResources[player].gold >= 20 && playerResources[player].wood >= 0) {
        showSpawnAnimation(x, y);

        return new Promise((resolve) => {
            setTimeout(() => {
                if (!visibility[y][x] || !isNearBaseForSpawn(x, y)) {
                    resolve(null);
                    return;
                }

                const unit = {
                    x,
                    y,
                    player,
                    visionRange: 4,
                    type: 'infantry',
                    selected: false,
                    inventory: { resource: null, amount: 0 },
                    maxInventory: 0,
                    lastVisibilityUpdateX: x,
                    lastVisibilityUpdateY: y,
                    currentX: x,
                    currentY: y,
                    isProcessing: false // Добавляем флаг
                };
                units.push(unit);
                playerResources[player].gold -= 20;
                updateVisibility();
                resolve(unit);
            }, 3000);
        });
    }
    return null;
}


function drawUnits() {
    const visibleWidth = Math.floor(camera.width);
    const visibleHeight = Math.floor(camera.height);
    const startX = Math.floor(camera.x);
    const endX = Math.min(startX + visibleWidth + 1, mapWidth);
    const startY = Math.floor(camera.y);
    const endY = Math.min(startY + visibleHeight + 1, mapHeight);

    const ctx = document.getElementById('gameCanvas').getContext('2d');
    ctx.save();
    ctx.scale(camera.zoom, camera.zoom);

    spawnEffects.forEach((effect, index) => {
        if (visibility[Math.round(effect.y)][Math.round(effect.x)]) {
            const x = (effect.x - camera.x) * 32;
            const y = (effect.y - camera.y) * 32;
            
            effect.particles.forEach(particle => {
                particle.radius = (effect.progress / effect.maxProgress) * 20;
                const particleX = x + 16 + Math.cos(particle.angle) * particle.radius;
                const particleY = y + 16 + Math.sin(particle.angle) * particle.radius;
                
                ctx.beginPath();
                ctx.arc(particleX, particleY, 2, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(255, 255, 255, ${1 - effect.progress / effect.maxProgress})`;
                ctx.fill();
            });
            
            ctx.beginPath();
            ctx.arc(x + 16, y + 16, (1 - effect.progress / effect.maxProgress) * 16, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(0, 255, 255, ${0.5 - effect.progress / effect.maxProgress / 2})`;
            ctx.fill();
            
            effect.progress++;
            if (effect.progress >= effect.maxProgress) {
                spawnEffects.splice(index, 1);
            }
        }
    });

    units.forEach(unit => {
        if (unit.x >= startX && unit.x < endX && unit.y >= startY && unit.y < endY) {
            const color = unit.player === 1 ? '#0000FF' : '#FF0000';
            const currentX = unit.currentX !== undefined ? unit.currentX : unit.x;
            const currentY = unit.currentY !== undefined ? unit.currentY : unit.y;
            const x = (currentX - camera.x) * 32;
            const y = (currentY - camera.y) * 32;

            if (unit.selected) {
                ctx.strokeStyle = '#FFFFFF';
                ctx.lineWidth = 2;
                ctx.strokeRect(x + 2, y + 2, 28, 28);
            }

            switch(unit.type) {
                case 'worker':
                    ctx.fillStyle = color;
                    ctx.fillRect(x + 8, y + 8, 16, 16);
                    ctx.beginPath();
                    ctx.moveTo(x + 16, y + 16);
                    ctx.lineTo(x + 20, y + 20);
                    ctx.strokeStyle = '#FFD700';
                    ctx.lineWidth = 2;
                    ctx.stroke();
                    break;
                case 'infantry':
                    ctx.beginPath();
                    ctx.moveTo(x + 16, y + 8);
                    ctx.lineTo(x + 24, y + 24);
                    ctx.lineTo(x + 8, y + 24);
                    ctx.closePath();
                    ctx.fillStyle = color;
                    ctx.fill();
                    break;
                default:
                    ctx.fillStyle = color;
                    ctx.fillRect(x + 8, y + 8, 16, 16);
            }
        }
    });

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

function selectUnit(x, y) {
    let found = false;
    units.forEach(unit => {
        if (unit.player === 1) {
            const currentX = unit.currentX !== undefined ? unit.currentX : unit.x;
            const currentY = unit.currentY !== undefined ? unit.currentY : unit.y;
            
            const distance = Math.sqrt(
                Math.pow(currentX - x, 2) + 
                Math.pow(currentY - y, 2)
            );
            
            if (distance < 0.5) {
                unit.selected = true;
                if (!selectedUnits.includes(unit)) {
                    selectedUnits.push(unit);
                }
                found = true;
            }
        }
    });
    return found;
}

function selectUnitsInRect(startX, startY, endX, endY) {
    const minX = Math.min(startX, endX);
    const maxX = Math.max(startX, endX);
    const minY = Math.min(startY, endY);
    const maxY = Math.max(startY, endY);

    units.forEach(unit => {
        if (unit.player === 1) {
            const currentX = unit.currentX !== undefined ? unit.currentX : unit.x;
            const currentY = unit.currentY !== undefined ? unit.currentY : unit.y;
            const tileX = Math.round(currentX);
            const tileY = Math.round(currentY);
            const dx = currentX - tileX;
            const dy = currentY - tileY;
            const distanceFromTile = Math.sqrt(dx * dx + dy * dy);

            if (tileX >= minX && tileX <= maxX && tileY >= minY && tileY <= maxY && distanceFromTile <= 0.5) {
                unit.selected = true;
                if (!selectedUnits.includes(unit)) {
                    selectedUnits.push(unit);
                }
            }
        }
    });
}

function deselectAllUnits() {
    units.forEach(unit => unit.selected = false);
    selectedUnits = [];
}

function sendWorkerToResource(unit, resource) {
    if (unit.type === 'worker' && unit.player === 1) {
        unit.targetResource = resource;
        unit.lastResourceTarget = resource;
        unit.isReturningToBase = false;
        moveUnit(units.indexOf(unit), resource.x, resource.y);
    }
}

function moveUnit(unitIndex, newX, newY) {
    if (newX < 0 || newX >= mapWidth || newY < 0 || newY >= mapHeight || 
        map[newY][newX] === 'water') {
        return;
    }

    const unit = units[unitIndex];
    unit.path = null;
    unit.currentX = unit.x;
    unit.currentY = unit.y;

    if (unit.isReturningToBase) {
        unit.targetX = newX;
        unit.targetY = newY;
        return; // Убираем вызов startUnitAnimation
    }

    if (!checkCollision(newX, newY, unitIndex)) {
        unit.targetX = newX;
        unit.targetY = newY;
    } else {
        const path = findPath(Math.round(unit.x), Math.round(unit.y), newX, newY);
        if (path && path.length > 0) {
            const lastStep = path[path.length - 1];
            unit.targetX = lastStep.x;
            unit.targetY = lastStep.y;
        } else {
            unit.targetX = unit.x;
            unit.targetY = unit.y;
        }
    }
    // Убираем вызов startUnitAnimation
}

export { 
    units, moveUnit, drawUnits, updateVisibility, 
    startUnitAnimation, drawPlayerResources, playerResources, 
    createWorker, createInfantry, selectUnit, deselectAllUnits, selectedUnits,
    sendWorkerToResource, selectUnitsInRect, initializeUnits
};