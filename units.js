// units.js
import { mapWidth, mapHeight, map, visibility, exploredMap } from './map.js';
import { camera } from './camera.js';
import { resources, resourceTypes } from './map.js';
import { updateFog } from './fog.js';
import { buildings } from './buildings.js';

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

// Добавляем переменную для отслеживания времени последнего сбора ресурсов
const RESOURCE_COLLECTION_INTERVAL = 1000; // 1 секунда между сбором ресурсов

function startUnitAnimation() {
    if (!isAnimating) return;

    units.forEach((unit, unitIndex) => {
        let shouldContinue = true;

        // Рабочий достиг базы с ресурсами
        if (unit.type === 'worker' && unit.isReturningToBase && unit.inventory.amount > 0) {
            const distanceToBase = Math.sqrt(Math.pow(unit.x - 2, 2) + Math.pow(unit.y - 2, 2));
            if (distanceToBase <= 0.5) {
                console.log('Рабочий достиг базы:', unit);
                deliverResources(unit);
                shouldContinue = false;
            }
        }

        // Рабочий около ресурса
        if (shouldContinue && unit.type === 'worker' && !unit.isReturningToBase && unit.targetResource) {
            const distanceToResource = Math.sqrt(
                Math.pow(unit.x - unit.targetResource.x, 2) + 
                Math.pow(unit.y - unit.targetResource.y, 2)
            );
            
            // Если рабочий достаточно близко к ресурсу
            if (distanceToResource <= 1.5) {
                const resourceIndex = resources.indexOf(unit.targetResource);
                if (resourceIndex !== -1) {
                    collectResource(unitIndex, resourceIndex);
                    // Останавливаем движение, пока собираем ресурсы
                    unit.targetX = unit.x;
                    unit.targetY = unit.y;
                    shouldContinue = false;
                }
            }
        }

        // Движение к цели
        if (shouldContinue && unit.targetX !== undefined && unit.targetY !== undefined) {
            if (!unit.path || unit.path.length === 0) {
                unit.path = findPath(Math.round(unit.x), Math.round(unit.y), unit.targetX, unit.targetY);
                if (!unit.path) {
                    console.log('Путь не найден, сбрасываем цель');
                    unit.targetX = undefined;
                    unit.targetY = undefined;
                    return;
                }
            }

            if (unit.path && unit.path.length > 0) {
                const nextStep = unit.path[0];

                if (checkCollision(nextStep.x, nextStep.y, unitIndex)) {
                    console.log('Путь заблокирован, пересчитываем');
                    unit.path = null;
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

    if (unit.type === 'worker' && resource && resource.amount > 0 && !unit.isReturningToBase) {
        // Проверяем, прошло ли достаточно времени с последнего сбора
        const currentTime = Date.now();
        if (!unit.lastCollectionTime || currentTime - unit.lastCollectionTime >= RESOURCE_COLLECTION_INTERVAL) {
            // Добавляем 1 единицу ресурса в инвентарь
            const amountToCollect = Math.min(1, resource.amount);
            resource.amount -= amountToCollect;
            unit.inventory.resource = resource.type;
            unit.inventory.amount += amountToCollect;
            unit.lastCollectionTime = currentTime;

            console.log('Собрано:', amountToCollect, 'всего в инвентаре:', unit.inventory.amount);

            // Если ресурс исчерпан
            if (resource.amount <= 0) {
                console.log('Ресурс исчерпан');
                resources.splice(resourceIndex, 1);
                unit.targetResource = null;
                unit.lastResourceTarget = null;
            }

            // Если инвентарь заполнен (достиг 10), возвращаемся на базу
            if (unit.inventory.amount >= 10) {
                unit.isReturningToBase = true;
                unit.targetResource = null;
                moveUnit(unitIndex, 2, 2); // База на координатах (2, 2)
                console.log('Инвентарь полон (10), возвращаемся на базу');
            }
        }
    }
}

function checkCollision(x, y, excludeUnitIndex) {
    for (let i = 0; i < units.length; i++) {
        if (i !== excludeUnitIndex && units[i].x === x && units[i].y === y) {
            return true;
        }
    }
    return false;
}

function isNearBase(x, y) {
    // Проверяем все соседние клетки вокруг базы (включая диагональные)
    const basePositions = [
        {x: 0, y: 0},  // Позиция базы
        {x: 1, y: 0},  // Справа
        {x: 0, y: 1},  // Снизу
        {x: 1, y: 1}   // Диагональ
    ];

    return basePositions.some(pos => 
        Math.abs(x - pos.x) <= 1 && Math.abs(y - pos.y) <= 1
    );
}

function deliverResources(unit) {
    if (!isNearBase(unit.x, unit.y)) {
        moveUnitNearBase(units.indexOf(unit));
        return false;
    }

    // Если юнит рядом с базой, разгружаем ресурсы
    if (unit.inventory.resource && unit.inventory.amount > 0) {
        playerResources[unit.player][unit.inventory.resource] += unit.inventory.amount;
        unit.inventory.amount = 0;
        unit.inventory.resource = null;
        unit.isReturningToBase = false;

        // Если есть последний ресурс, к которому юнит шёл - возвращаемся к нему
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
            }
        }
        return true;
    }
    return false;
}

function moveUnitNearBase(unitIndex) {
    const unit = units[unitIndex];
    // Пытаемся найти свободную клетку рядом с базой
    const basePositions = [
        {x: 1, y: 0},  // Справа
        {x: 0, y: 1},  // Снизу
        {x: 1, y: 1}   // Диагональ
    ];

    for (const pos of basePositions) {
        if (!checkCollision(pos.x, pos.y, unitIndex)) {
            moveUnit(unitIndex, pos.x, pos.y);
            return true;
        }
    }
    return false;
}

// Массив для хранения эффектов спавна
let spawnEffects = [];

// Улучшенная анимация спавна
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

// Проверка близости к базе
function isNearBaseForSpawn(x, y) {
    // Ищем базу игрока 1
    const base = buildings.find(b => b.player === 1 && b.type === 'base1');
    if (!base) {
        console.log('База не найдена');
        return false;
    }

    const maxDistance = 2; // Радиус в тайлах
    const dx = Math.abs(x - base.x);
    const dy = Math.abs(y - base.y);
    const isNear = dx <= maxDistance && dy <= maxDistance;
    
    console.log(`Checking spawn position (${x}, ${y}), base at (${base.x}, ${base.y}), distance: dx=${dx}, dy=${dy}, isNear=${isNear}`);
    
    return isNear;
}

// Проверка наличия казармы
function hasBarracks(player) {
    return buildings.some(building => 
        building.player === player && 
        building.type === 'barracks'
    );
}

function createWorker(player, x, y) {
    console.log(`Attempting to create worker at (${x}, ${y}) for player ${player}`);

    if (!isNearBaseForSpawn(x, y)) {
        console.log('Рабочих можно создавать только рядом с базы');
        return null;
    }

    if (!visibility[y][x]) {
        console.log('Нельзя создавать юнитов в тумане войны');
        return null;
    }

    // Проверяем ресурсы перед запуском анимации
    if (playerResources[player] && playerResources[player].gold >= 10 && playerResources[player].wood >= 0) {
        showSpawnAnimation(x, y);
        console.log('Starting worker spawn animation');

        return new Promise((resolve) => {
            setTimeout(() => {
                // Проверяем условия ещё раз перед фактическим созданием
                if (!visibility[y][x] || !isNearBaseForSpawn(x, y)) {
                    console.log('Условия создания нарушены во время анимации');
                    resolve(null);
                    return;
                }

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
                    lastCollectionTime: null
                };
                units.push(unit);
                playerResources[player].gold -= 10;
                console.log('Worker created successfully');
                updateVisibility();
                resolve(unit);
            }, 3000);
        });
    } else {
        console.log('Недостаточно ресурсов для создания рабочего');
        return null;
    }
}

function createInfantry(player, x, y) {
    console.log(`Attempting to create infantry at (${x}, ${y}) for player ${player}`);

    if (!isNearBaseForSpawn(x, y)) {
        console.log('Пехотинцев можно создавать только рядом с базой');
        return null;
    }

    if (!visibility[y][x]) {
        console.log('Нельзя создавать юнитов в тумане войны');
        return null;
    }

    if (units.some(u => u.type === 'infantry' && u.player === player) && !hasBarracks(player)) {
        console.log('Для создания пехотинца необходима казарма');
        return null;
    }

    if (playerResources[player] && playerResources[player].gold >= 20 && playerResources[player].wood >= 0) {
        showSpawnAnimation(x, y);
        console.log('Starting infantry spawn animation');

        return new Promise((resolve) => {
            setTimeout(() => {
                // Проверяем условия ещё раз перед фактическим созданием
                if (!visibility[y][x] || !isNearBaseForSpawn(x, y)) {
                    console.log('Условия создания нарушены во время анимации');
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
                    currentY: y
                };
                units.push(unit);
                playerResources[player].gold -= 20;
                console.log('Infantry created successfully');
                updateVisibility();
                resolve(unit);
            }, 3000);
        });
    } else {
        console.log('Недостаточно ресурсов для создания пехотинца');
        return null;
    }
}

// Обновляем функцию drawUnits для отображения улучшенной анимации спавна
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

    // Отрисовка эффектов спавна
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

    // Отрисовка юнитов
    units.forEach(unit => {
        if (unit.x >= startX && unit.x < endX && unit.y >= startY && unit.y < endY) {
            const color = unit.player === 1 ? '#0000FF' : '#FF0000';
            // Используем текущие координаты для отрисовки
            const currentX = unit.currentX !== undefined ? unit.currentX : unit.x;
            const currentY = unit.currentY !== undefined ? unit.currentY : unit.y;
            const x = (currentX - camera.x) * 32;
            const y = (currentY - camera.y) * 32;

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
    let found = false;
    units.forEach(unit => {
        if (unit.player === 1) {
            const currentX = unit.currentX !== undefined ? unit.currentX : unit.x;
            const currentY = unit.currentY !== undefined ? unit.currentY : unit.y;
            
            // Увеличиваем область клика до размера тайла
            const distance = Math.sqrt(
                Math.pow(currentX - x, 2) + 
                Math.pow(currentY - y, 2)
            );
            
            if (distance < 0.5) {  // Радиус в половину тайла
                unit.selected = true;
                if (!selectedUnits.includes(unit)) {
                    selectedUnits.push(unit);
                    console.log(`Selected unit at (${currentX}, ${currentY})`);
                }
                found = true;
            }
        }
    });
    return found;
}

// Новая функция для выделения юнитов в прямоугольной области
function selectUnitsInRect(startX, startY, endX, endY) {
    const minX = Math.min(startX, endX);
    const maxX = Math.max(startX, endX);
    const minY = Math.min(startY, endY);
    const maxY = Math.max(startY, endY);

    console.log(`Selecting units in rect from (${minX}, ${minY}) to (${maxX}, ${maxY})`);

    units.forEach(unit => {
        if (unit.player === 1) {
            const currentX = unit.currentX !== undefined ? unit.currentX : unit.x;
            const currentY = unit.currentY !== undefined ? unit.currentY : unit.y;
            const tileX = Math.round(currentX);
            const tileY = Math.round(currentY);
            const dx = currentX - tileX;
            const dy = currentY - tileY;
            const distanceFromTile = Math.sqrt(dx * dx + dy * dy);

            // Проверяем, находится ли юнит в радиусе 0.5 от ближайшего тайла внутри прямоугольника
            if (tileX >= minX && tileX <= maxX && tileY >= minY && tileY <= maxY && distanceFromTile <= 0.5) {
                unit.selected = true;
                if (!selectedUnits.includes(unit)) {
                    selectedUnits.push(unit);
                    console.log(`Selected unit at (${currentX}, ${currentY}) in rect selection`);
                }
            }
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
    if (unit.type === 'worker' && unit.player === 1) { // Только для игрока 1
        unit.targetResource = resource;
        unit.lastResourceTarget = resource; // Сохраняем для возвращения
        unit.isReturningToBase = false;
        moveUnit(units.indexOf(unit), resource.x, resource.y);
        console.log('Рабочий отправлен к ресурсу:', resource);
    }
}

// Функция перемещения юнита
function moveUnit(unitIndex, newX, newY) {
    console.log(`moveUnit called for unit ${unitIndex} to (${newX}, ${newY})`);

    if (newX < 0 || newX >= mapWidth || newY < 0 || newY >= mapHeight || 
        map[newY][newX] === 'water') {
        console.log(`Invalid move target: out of bounds or water at (${newX}, ${newY})`);
        return;
    }

    const unit = units[unitIndex];
    console.log(`Unit current position: (${unit.x}, ${unit.y})`);
    
    unit.path = null;
    unit.currentX = unit.x;
    unit.currentY = unit.y;

    if (unit.isReturningToBase) {
        unit.targetX = newX;
        unit.targetY = newY;
        console.log(`Unit returning to base, target set to: (${unit.targetX}, ${unit.targetY})`);
        startUnitAnimation();
        return;
    }

    // Проверяем, свободна ли целевая позиция
    if (!checkCollision(newX, newY, unitIndex)) {
        unit.targetX = newX;
        unit.targetY = newY;
        console.log(`Target position is free, moving directly to: (${unit.targetX}, ${unit.targetY})`);
    } else {
        console.log('Target position is occupied, searching for nearest free position using A*');
        // Используем A* для поиска ближайшей свободной клетки
        const path = findPath(Math.round(unit.x), Math.round(unit.y), newX, newY);
        if (path && path.length > 0) {
            // Берем последнюю точку пути, до которой юнит может дойти
            const lastStep = path[path.length - 1];
            unit.targetX = lastStep.x;
            unit.targetY = lastStep.y;
            console.log(`Found reachable position via A*: (${unit.targetX}, ${unit.targetY})`);
        } else {
            console.log('No reachable position found, staying in place');
            unit.targetX = unit.x;
            unit.targetY = unit.y;
        }
    }
    
    startUnitAnimation();
}

// Экспортируем все необходимые функции и данные
export { 
    units, unitCount, moveUnit, drawUnits, updateVisibility, 
    startUnitAnimation, drawPlayerResources, playerResources, 
    createWorker, createInfantry, selectUnit, deselectAllUnits, selectedUnits,
    sendWorkerToResource, selectUnitsInRect
};