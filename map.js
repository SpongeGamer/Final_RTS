// map.js
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const tileSize = 32;
const mapWidth = 75;
const mapHeight = 75;
canvas.width = tileSize * mapWidth;
canvas.height = tileSize * mapHeight;

const tileTypes = {
    grass: '#4CAF50',
    water: '#03A9F4',
    forest: '#2E7D32',
    fog: '#9E9E9E',
    'fogExplored': '#616161',
    'base1': '#2196F3',
    'base2': '#F44336',
    'building-normal': '#FF9800',
    'building-defense': '#8BC34A'
};

let resources = [];

const resourceTypes = {
    gold: '#FFC107',
    wood: '#795548'
};

let map = Array.from({ length: mapHeight }, () => Array(mapWidth).fill(null));
let visibility = Array.from({ length: mapHeight }, () => Array(mapWidth).fill(false));
let exploredMap = Array.from({ length: mapHeight }, () => Array(mapWidth).fill(false));
let chunks = [];
const chunkSize = 10;

let base1X, base1Y, base2X, base2Y;

async function generateMap() {
    // Базовая карта - сплошная трава
    for (let y = 0; y < mapHeight; y++) {
        for (let x = 0; x < mapWidth; x++) {
            map[y][x] = 'grass';
        }
    }

    // Центральный рисунок: озеро с островами
    const centerX = mapWidth / 2;
    const centerY = mapHeight / 2;
    const lakeRadius = Math.min(mapWidth, mapHeight) / 4;

    // Генерация озера
    for (let y = 0; y < mapHeight; y++) {
        for (let x = 0; x < mapWidth; x++) {
            const dx = x - centerX;
            const dy = y - centerY;
            const distance = Math.sqrt(dx * dx + dy * dy);
            const noise = Math.sin(dx * 0.2) * Math.cos(dy * 0.2) + (Math.random() - 0.5) * 0.5;

            if (distance < lakeRadius * 0.8 + noise * 2) {
                map[y][x] = 'water';
            }
        }
    }

    // Генерация островов внутри озера
    for (let i = 0; i < 3; i++) {
        const islandX = centerX + (Math.random() - 0.5) * lakeRadius * 0.5;
        const islandY = centerY + (Math.random() - 0.5) * lakeRadius * 0.5;
        const islandRadius = Math.random() * 3 + 2;

        for (let y = Math.max(0, Math.floor(islandY - islandRadius)); y <= Math.min(mapHeight - 1, Math.ceil(islandY + islandRadius)); y++) {
            for (let x = Math.max(0, Math.floor(islandX - islandRadius)); x <= Math.min(mapWidth - 1, Math.ceil(islandX + islandRadius)); x++) {
                const dx = x - islandX;
                const dy = y - islandY;
                const distance = Math.sqrt(dx * dx + dy * dy);
                if (distance < islandRadius && Math.random() < 0.8) {
                    map[y][x] = 'grass';
                }
            }
        }
    }

    // Генерация леса вокруг озера
    for (let y = 0; y < mapHeight; y++) {
        for (let x = 0; x < mapWidth; x++) {
            const dx = x - centerX;
            const dy = y - centerY;
            const distance = Math.sqrt(dx * dx + dy * dy);
            const noise = Math.sin(dx * 0.1) * Math.cos(dy * 0.1);

            if (distance > lakeRadius * 0.8 && distance < lakeRadius * 1.2 + noise * 3 && map[y][x] !== 'water' && Math.random() < 0.6) {
                map[y][x] = 'forest';
            }
        }
    }

    // Очистка территории вокруг баз
    clearAreaAroundBase(2, 2);
    clearAreaAroundBase(73, 73);

    // Размещение баз
    base1X = 2;
    base1Y = 2;
    base2X = 73;
    base2Y = 73;
    map[base1Y][base1X] = 'base1';
    map[base2Y][base2X] = 'base2';

    // Удаление воды вокруг баз
    for (let y = Math.max(0, base1Y - 10); y <= Math.min(mapHeight - 1, base1Y + 10); y++) {
        for (let x = Math.max(0, base1X - 10); x <= Math.min(mapWidth - 1, base1X + 10); x++) {
            if (map[y][x] === 'water') map[y][x] = 'grass';
        }
    }
    for (let y = Math.max(0, base2Y - 10); y <= Math.min(mapHeight - 1, base2Y + 10); y++) {
        for (let x = Math.max(0, base2X - 10); x <= Math.min(mapWidth - 1, base2X + 10); x++) {
            if (map[y][x] === 'water') map[y][x] = 'grass';
        }
    }

    // Инициализация видимости для баз
    for (let y = Math.max(0, base1Y - 3); y <= Math.min(mapHeight - 1, base1Y + 3); y++) {
        for (let x = Math.max(0, base1X - 3); x <= Math.min(mapWidth - 1, base1X + 3); x++) {
            const dx = x - base1X;
            const dy = y - base1Y;
            if (Math.sqrt(dx * dx + dy * dy) <= 3) {
                visibility[y][x] = true;
                exploredMap[y][x] = true;
            }
        }
    }

    for (let y = Math.max(0, base2Y - 3); y <= Math.min(mapHeight - 1, base2Y + 3); y++) {
        for (let x = Math.max(0, base2X - 3); x <= Math.min(mapWidth - 1, base2X + 3); x++) {
            const dx = x - base2X;
            const dy = y - base2Y;
            if (Math.sqrt(dx * dx + dy * dy) <= 3) {
                visibility[y][x] = true;
                exploredMap[y][x] = true;
            }
        }
    }

    // Генерация ресурсов
    const numberOfGoldPiles = 15;
    const numberOfWoodPiles = 20;
    const minDistanceFromBase = 12;
    const minDistanceBetweenResources = 8;

    for (let i = 0; i < numberOfGoldPiles; i++) {
        let pileX, pileY;
        let attempts = 0;
        do {
            pileX = Math.floor(Math.random() * mapWidth);
            pileY = Math.floor(Math.random() * mapHeight);
            attempts++;
        } while ((map[pileY][pileX] === 'water' || 
                 Math.sqrt(Math.pow(pileX - base1X, 2) + Math.pow(pileY - base1Y, 2)) < minDistanceFromBase || 
                 Math.sqrt(Math.pow(pileX - base2X, 2) + Math.pow(pileY - base2Y, 2)) < minDistanceFromBase || 
                 resources.some(r => Math.sqrt(Math.pow(r.x - pileX, 2) + Math.pow(r.y - pileY, 2)) < minDistanceBetweenResources)) && 
                 attempts < 100);

        if (attempts >= 100) continue;

        const pileSize = Math.floor(Math.random() * 2) + 3;
        for (let j = 0; j < pileSize; j++) {
            let resourceX = pileX + (Math.floor(Math.random() * 3) - 1);
            let resourceY = pileY + (Math.floor(Math.random() * 3) - 1);
            if (resourceX >= 0 && resourceX < mapWidth && resourceY >= 0 && resourceY < mapHeight && 
                map[resourceY][resourceX] !== 'water' && !resources.some(r => r.x === resourceX && r.y === resourceY)) {
                resources.push({ x: resourceX, y: resourceY, type: 'gold', amount: 400 });
            }
        }
    }

    for (let i = 0; i < numberOfWoodPiles; i++) {
        let pileX, pileY;
        let attempts = 0;
        do {
            pileX = Math.floor(Math.random() * mapWidth);
            pileY = Math.floor(Math.random() * mapHeight);
            attempts++;
        } while ((map[pileY][pileX] === 'water' || 
                 Math.sqrt(Math.pow(pileX - base1X, 2) + Math.pow(pileY - base1Y, 2)) < minDistanceFromBase || 
                 Math.sqrt(Math.pow(pileX - base2X, 2) + Math.pow(pileY - base2Y, 2)) < minDistanceFromBase || 
                 resources.some(r => Math.sqrt(Math.pow(r.x - pileX, 2) + Math.pow(r.y - pileY, 2)) < minDistanceBetweenResources)) && 
                 attempts < 100);

        if (attempts >= 100) continue;

        const pileSize = Math.floor(Math.random() * 2) + 4;
        for (let j = 0; j < pileSize; j++) {
            let resourceX = pileX + (Math.floor(Math.random() * 3) - 1);
            let resourceY = pileY + (Math.floor(Math.random() * 3) - 1);
            if (resourceX >= 0 && resourceX < mapWidth && resourceY >= 0 && resourceY < mapHeight && 
                map[resourceY][resourceX] !== 'water' && !resources.some(r => r.x === resourceX && r.y === resourceY)) {
                resources.push({ x: resourceX, y: resourceY, type: 'wood', amount: 450 });
            }
        }
    }
}

function clearAreaAroundBase(x, y) {
    for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
            if (isInBounds(y + dy, x + dx)) {
                map[y + dy][x + dx] = 'grass';
            }
        }
    }
}

function isInBounds(y, x) {
    return y >= 0 && y < mapHeight && x >= 0 && x < mapWidth;
}

function drawMap(camera) {
    const visibleWidth = Math.floor(camera.width);
    const visibleHeight = Math.floor(camera.height);
    const startX = Math.floor(camera.x);
    const endX = Math.min(startX + visibleWidth + 1, mapWidth);
    const startY = Math.floor(camera.y);
    const endY = Math.min(startY + visibleHeight + 1, mapHeight);

    ctx.save();
    ctx.scale(camera.zoom, camera.zoom);

    for (let y = startY; y < endY; y++) {
        for (let x = startX; x < endX; x++) {
            const tile = map[y][x] || 'grass';
            if (!exploredMap[y][x]) {
                ctx.fillStyle = tileTypes.fog;
                ctx.fillRect((x - camera.x) * tileSize, (y - camera.y) * tileSize, tileSize, tileSize);
            } else {
                ctx.fillStyle = tileTypes[tile];
                ctx.fillRect((x - camera.x) * tileSize, (y - camera.y) * tileSize, tileSize, tileSize);

                if (!visibility[y][x]) {
                    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
                    ctx.fillRect((x - camera.x) * tileSize, (y - camera.y) * tileSize, tileSize, tileSize);
                }
            }

            const resource = resources.find(r => r.x === x && r.y === y);
            if (resource) {
                if (visibility[y][x] || exploredMap[y][x]) {
                    const resourceSize = tileSize * 0.8;
                    const offset = (tileSize - resourceSize) / 2;
                    ctx.fillStyle = visibility[y][x] ? resourceTypes[resource.type] : 'rgba(128, 128, 128, 0.5)';
                    ctx.fillRect((x - camera.x) * tileSize + offset, (y - camera.y) * tileSize + offset, resourceSize, resourceSize);
                }
            }
        }
    }

    ctx.restore();
}

export { tileSize, mapWidth, mapHeight, tileTypes, map, visibility, exploredMap, chunks, generateMap, drawMap, resources, resourceTypes, base1X, base1Y, base2X, base2Y };