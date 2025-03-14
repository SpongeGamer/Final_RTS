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
let unitCount = 2; // Start with 2 units
let playerResources = {
    1: { gold: 25, wood: 25 },
    2: { gold: 25, wood: 25 }
};

let selectedUnits = [];

const UNIT_SPEED = 2;
const MOVEMENT_THRESHOLD = 0.01;
let isAnimating = true;
const RESOURCE_COLLECTION_INTERVAL = 1000;

let unitLimit = 10; // Базовый лимит юнитов
let barracksCount = 0; // Количество построенных бараков

function updateUnitLimit() {
    unitLimit = 10 + (barracksCount * 5); // Базовый лимит 10 + 5 за каждый барак
    console.log(`Unit limit updated to: ${unitLimit}`);
}

function updateUnitCount() {
    const currentUnits = units.filter(unit => unit.player === 1).length; // Считаем юниты игрока 1
    const unitCountElement = document.getElementById('unitCount'); // Элемент для отображения
    if (unitCountElement) {
        unitCountElement.textContent = `${currentUnits}/${unitLimit}`;
    }
    console.log(`Current units: ${currentUnits}/${unitLimit}`);
    return { current: currentUnits, limit: unitLimit };
}

function updateBarracksCount(count) {
    barracksCount = count;
    updateUnitLimit();
    updateUnitCount(); // Обновляем отображение после изменения лимита
}

function addResources(player, resourceType, amount) {
    if (playerResources[player] && resourceTypes[resourceType]) {
        playerResources[player][resourceType] = Math.max(0, (playerResources[player][resourceType] || 0) + amount);
        console.log(`Added ${amount} ${resourceType} to player ${player}. New total: ${playerResources[player][resourceType]}`);
        drawPlayerResources(); // Обновляем отображение ресурсов
        return true;
    }
    console.log(`Invalid player or resource type`);
    return false;
}

function startUnitAnimation() {
    if (!isAnimating) return;

    units.forEach((unit, unitIndex) => {
        let shouldContinue = true;

        // Worker returning to base with resources
        if (unit.type === 'worker' && unit.isReturningToBase && unit.inventory.amount > 0) {
            const distanceToBase = Math.sqrt(Math.pow(unit.x - 2, 2) + Math.pow(unit.y - 2, 2));
            if (distanceToBase <= 1.0) {
                if (deliverResources(unit)) {
                    unit.isReturningToBase = false;
                    // Return to the last resource if it still exists
                    if (unit.lastResourceTarget) {
                        const resource = resources.find(r => 
                            r.x === unit.lastResourceTarget.x && 
                            r.y === unit.lastResourceTarget.y && 
                            r.amount > 0
                        );
                        if (resource) sendWorkerToResource(unit, resource);
                    }
                }
                unit.targetX = undefined;
                unit.targetY = undefined;
                unit.path = null;
                shouldContinue = false;
            } else {
                moveUnit(unitIndex, 2, 2); // Move toward base
            }
        }

        // Worker collecting resources
        if (shouldContinue && unit.type === 'worker' && !unit.isReturningToBase && unit.targetResource) {
            const distanceToResource = Math.sqrt(
                Math.pow(unit.x - unit.targetResource.x, 2) + 
                Math.pow(unit.y - unit.targetResource.y, 2)
            );
            if (distanceToResource <= 1.5) {
                const resourceIndex = resources.indexOf(unit.targetResource);
                if (resourceIndex !== -1) {
                    collectResource(unitIndex, resourceIndex);
                    unit.targetX = unit.x;
                    unit.targetY = unit.y;
                    shouldContinue = false;
                }
            }
        }

        // Movement to target
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
                        updateFog();
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
                path.unshift({ x, y });
                currentNode = cameFrom.get(currentNode);
            }
            return path;
        }
        
        openSet.splice(currentIndex, 1);
        closedSet.add(current);
        
        const [currentX, currentY] = current.split(',').map(Number);
        
        const neighbors = [
            { x: currentX - 1, y: currentY },
            { x: currentX + 1, y: currentY },
            { x: currentX, y: currentY - 1 },
            { x: currentX, y: currentY + 1 }
        ];
        
        for (const neighbor of neighbors) {
            if (neighbor.x < 0 || neighbor.x >= mapWidth || neighbor.y < 0 || neighbor.y >= mapHeight || map[neighbor.y][neighbor.x] === 'water') {
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

function collectResource(unitIndex, resourceIndex) {
    const unit = units[unitIndex];
    const resource = resources[resourceIndex];

    if (unit.type === 'worker' && resource && resource.amount > 0 && !unit.isReturningToBase) {
        const currentTime = Date.now();
        if (!unit.lastCollectionTime || currentTime - unit.lastCollectionTime >= RESOURCE_COLLECTION_INTERVAL) {
            const amountToCollect = Math.min(1, resource.amount, unit.maxInventory - unit.inventory.amount);
            resource.amount -= amountToCollect;
            unit.inventory.resource = resource.type;
            unit.inventory.amount += amountToCollect;
            unit.lastCollectionTime = currentTime;

            console.log(`Collected ${amountToCollect} ${resource.type}, total: ${unit.inventory.amount}`);

            if (resource.amount <= 0) {
                resources.splice(resourceIndex, 1);
                unit.targetResource = null;
                unit.lastResourceTarget = null;
            }

            if (unit.inventory.amount >= 10) {
                unit.isReturningToBase = true;
                unit.targetResource = null;
                moveUnit(unitIndex, 2, 2); // Return to base at (2, 2)
                console.log('Inventory full (10), returning to base');
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
    const basePositions = [
        { x: 2, y: 2 },
        { x: 3, y: 2 },
        { x: 2, y: 3 },
        { x: 3, y: 3 }
    ];

    return basePositions.some(pos => Math.abs(x - pos.x) <= 1 && Math.abs(y - pos.y) <= 1);
}

function deliverResources(unit) {
    if (!isNearBase(unit.x, unit.y)) {
        moveUnitNearBase(units.indexOf(unit));
        return false;
    }

    if (unit.inventory.resource && unit.inventory.amount > 0) {
        const amountDelivered = unit.inventory.amount;
        const resourceType = unit.inventory.resource;
        addResources(unit.player, resourceType, amountDelivered);
        unit.inventory.amount = 0;
        unit.inventory.resource = null;
        console.log(`Delivered ${amountDelivered} ${resourceType} to base`);
        return true;
    }
    return false;
}

function moveUnitNearBase(unitIndex) {
    const unit = units[unitIndex];
    const basePositions = [
        { x: 3, y: 2 },
        { x: 2, y: 3 },
        { x: 3, y: 3 }
    ];

    for (const pos of basePositions) {
        if (!checkCollision(pos.x, pos.y, unitIndex)) {
            moveUnit(unitIndex, pos.x, pos.y);
            return true;
        }
    }
    return false;
}

let spawnEffects = [];

function showSpawnAnimation(x, y) {
    const spawnEffect = {
        x,
        y,
        progress: 0,
        maxProgress: 60,
        particles: Array.from({ length: 8 }, (_, i) => ({
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
    return dx <= maxDistance && dy <= maxDistance;
}

function hasBarracks(player) {
    return buildings.some(building => building.player === player && building.type === 'barracks');
}

async function createWorker(player, x, y) {
    const { current, limit } = updateUnitCount();
    if (current >= limit) {
        console.log('Unit limit reached! Cannot create worker.');
        return null;
    }
    console.log(`Attempting to create worker at (${x}, ${y}) for player ${player}`);

    if (playerResources[player] && playerResources[player].gold >= 10 && playerResources[player].wood >= 0) {
        showSpawnAnimation(x, y);
        console.log('Starting worker spawn animation');

        return new Promise((resolve) => {
            setTimeout(() => {
                if (!visibility[y][x] || !isNearBaseForSpawn(x, y)) {
                    console.log('Spawn conditions failed during animation');
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
                unitCount++;
                console.log('Worker created successfully');
                updateFog();
                resolve(unit);
            }, 3000);
        });
    } else {
        console.log('Insufficient resources for worker');
        return null;
    }
}

async function createInfantry(player, x, y) {
    const { current, limit } = updateUnitCount();
    if (current >= limit) {
        console.log('Unit limit reached! Cannot create infantry.');
        return null;
    }
    console.log(`Attempting to create infantry at (${x}, ${y}) for player ${player}`);

    if (units.some(u => u.type === 'infantry' && u.player === player) && !hasBarracks(player)) {
        console.log('Barracks required to spawn infantry');
        return null;
    }

    if (playerResources[player] && playerResources[player].gold >= 20 && playerResources[player].wood >= 0) {
        showSpawnAnimation(x, y);
        console.log('Starting infantry spawn animation');

        return new Promise((resolve) => {
            setTimeout(() => {
                if (!visibility[y][x] || !isNearBaseForSpawn(x, y)) {
                    console.log('Spawn conditions failed during animation');
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
                unitCount++;
                console.log('Infantry created successfully');
                updateFog();
                resolve(unit);
            }, 3000);
        });
    } else {
        console.log('Insufficient resources for infantry');
        return null;
    }
}

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

    // Draw spawn effects
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

    // Draw units
    units.forEach(unit => {
        if (unit.x >= startX && unit.x < endX && unit.y >= startY && unit.y < endY && visibility[unit.y][unit.x]) {
            const color = unit.player === 1 ? '#0000FF' : (visibility[unit.y][unit.x] ? '#FF0000' : '#666666');
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
    
    if (goldAmount && woodAmount && playerResources[1]) {
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
            
            const distance = Math.sqrt(Math.pow(currentX - x, 2) + Math.pow(currentY - y, 2));
            
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
        unit.lastResourceTarget = { x: resource.x, y: resource.y }; // Store coordinates
        unit.isReturningToBase = false;
        moveUnit(units.indexOf(unit), resource.x, resource.y);
        console.log(`Worker sent to resource at (${resource.x}, ${resource.y})`);
    }
}

function moveUnit(unitIndex, newX, newY) {
    if (newX < 0 || newX >= mapWidth || newY < 0 || newY >= mapHeight || map[newY][newX] === 'water') {
        console.log(`Invalid move target: out of bounds or water at (${newX}, ${newY})`);
        return;
    }

    const unit = units[unitIndex];
    unit.path = null;
    unit.currentX = unit.x;
    unit.currentY = unit.y;

    if (unit.isReturningToBase) {
        unit.targetX = newX;
        unit.targetY = newY;
    } else if (!checkCollision(newX, newY, unitIndex)) {
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
    
    startUnitAnimation();
}

function revealFog() {
    for (let y = 0; y < mapHeight; y++) {
        for (let x = 0; x < mapWidth; x++) {
            visibility[y][x] = true;
            exploredMap[y][x] = true;
        }
    }
    updateFog(); // Обновляем туман после снятия
    console.log('Fog revealed for the entire map');
}

export { 
    units, unitCount, moveUnit, drawUnits,  
    startUnitAnimation, drawPlayerResources, playerResources, 
    createWorker, createInfantry, selectUnit, deselectAllUnits, selectedUnits,
    sendWorkerToResource, selectUnitsInRect, updateUnitCount, updateBarracksCount,
    addResources, revealFog
};