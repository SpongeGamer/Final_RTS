// map.js
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const tileSize = 32;
const mapWidth = 75; // Более щадящий размер карты
const mapHeight = 75; // Более щадящий размер карты
canvas.width = tileSize * mapWidth;
canvas.height = tileSize * mapHeight;

const tileTypes = {
    grass: '#4CAF50', // Более яркий зеленый
    water: '#03A9F4', // Более яркий синий
    forest: '#2E7D32', // Более яркий темно-зеленый
    fog: '#9E9E9E', // Более светлый серый
    'fogExplored': '#616161', // Более светлый темно-серый
    'base1': '#2196F3', // Более яркий синий для базы
    'base2': '#F44336', // Более яркий красный для базы
    'base3': '#9C27B0', // Добавляем цвет для базы 3-го игрока
    'base4': '#FF9800', // Добавляем цвет для базы 4-го игрока
    'building-normal': '#FF9800',  // Более яркий оранжевый
    'building-defense': '#8BC34A'  // Более яркий светло-зеленый
};

let resources = []; // Массив для хранения ресурсов

const resourceTypes = {
    gold: '#FFC107',  // Более яркий золотой
    wood: '#795548'   // Более светлый коричневый
};

let map = Array.from({ length: mapHeight }, () => Array(mapWidth).fill(null));
let visibility = Array.from({ length: mapHeight }, () => Array(mapWidth).fill(false)); // Инициализируем видимость
let exploredMap = Array.from({ length: mapHeight }, () => Array(mapWidth).fill(false)); // Добавляем массив для разведанных клеток
let chunks = [];
const chunkSize = 10;

function generatePerlinNoise(width, height, variation = 1) {
    let noise = [];
    const frequency = 0.05;
    const amplitude = 0.3;
    for (let y = 0; y < height; y++) {
        noise[y] = [];
        for (let x = 0; x < width; x++) {
            let baseNoise = variation === 1 ? Math.sin(x * frequency) * Math.cos(y * frequency) : Math.sin(x * frequency * 2) + Math.cos(y * frequency * 1.5);
            const randomOffset = Math.random() * amplitude;
            noise[y][x] = (baseNoise + randomOffset + 1) / 2;
        }
    }
    return noise;
}

async function generateMap() {
    const variation = Math.floor(Math.random() * 2) + 1;
    const noise = generatePerlinNoise(mapWidth, mapHeight, variation);

    // Генерируем карту за один проход
    for (let y = 0; y < mapHeight; y++) {
        for (let x = 0; x < mapWidth; x++) {
            const noiseValue = noise[y][x];
            if (noiseValue < 0.2) map[y][x] = 'water';
            else if (noiseValue < 0.5) map[y][x] = 'forest';
            else map[y][x] = 'grass';
        }
    }

    // Размещаем базы
    map[0][0] = 'base1';
    map[mapHeight - 1][mapWidth - 1] = 'base2';

    // Очищаем территорию вокруг баз
    for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
            if (dy + 0 >= 0 && dy + 0 < mapHeight && dx + 0 >= 0 && dx + 0 < mapWidth) {
                map[dy + 0][dx + 0] = 'grass';
            }
            if (dy + mapHeight - 1 >= 0 && dy + mapHeight - 1 < mapHeight && 
                dx + mapWidth - 1 >= 0 && dx + mapWidth - 1 < mapWidth) {
                map[dy + mapHeight - 1][dx + mapWidth - 1] = 'grass';
            }
        }
    }

    // Генерация ресурсов
    const numberOfGoldPiles = 10;
    const numberOfWoodPiles = 12;

    // Генерация золота
    for (let i = 0; i < numberOfGoldPiles; i++) {
        let pileX, pileY;
        do {
            pileX = Math.floor(Math.random() * mapWidth);
            pileY = Math.floor(Math.random() * mapHeight);
        } while (
            map[pileY][pileX] === 'water' || 
            (Math.abs(pileX) < 4 && Math.abs(pileY) < 4) || 
            (Math.abs(pileX - (mapWidth - 1)) < 4 && Math.abs(pileY - (mapHeight - 1)) < 4) ||
            resources.some(r => Math.abs(r.x - pileX) < 4 && Math.abs(r.y - pileY) < 4)
        );

        const pileSize = Math.floor(Math.random() * 2) + 3; // 3-4 золота в куче
        for (let j = 0; j < pileSize; j++) {
            let resourceX = pileX + (Math.floor(Math.random() * 3) - 1);
            let resourceY = pileY + (Math.floor(Math.random() * 3) - 1);
            
            if (resourceX >= 0 && resourceX < mapWidth && 
                resourceY >= 0 && resourceY < mapHeight && 
                map[resourceY][resourceX] !== 'water' &&
                !resources.some(r => r.x === resourceX && r.y === resourceY)) {
                resources.push({ x: resourceX, y: resourceY, type: 'gold', amount: 400 });
            }
        }
    }

    // Генерация дерева
    for (let i = 0; i < numberOfWoodPiles; i++) {
        let pileX, pileY;
        do {
            pileX = Math.floor(Math.random() * mapWidth);
            pileY = Math.floor(Math.random() * mapHeight);
        } while (
            map[pileY][pileX] === 'water' || 
            (Math.abs(pileX) < 4 && Math.abs(pileY) < 4) || 
            (Math.abs(pileX - (mapWidth - 1)) < 4 && Math.abs(pileY - (mapHeight - 1)) < 4) ||
            resources.some(r => Math.abs(r.x - pileX) < 4 && Math.abs(r.y - pileY) < 4)
        );

        const pileSize = Math.floor(Math.random() * 2) + 4; // 4-5 деревьев в куче
        for (let j = 0; j < pileSize; j++) {
            let resourceX = pileX + (Math.floor(Math.random() * 3) - 1);
            let resourceY = pileY + (Math.floor(Math.random() * 3) - 1);
            
            if (resourceX >= 0 && resourceX < mapWidth && 
                resourceY >= 0 && resourceY < mapHeight && 
                map[resourceY][resourceX] !== 'water' &&
                !resources.some(r => r.x === resourceX && r.y === resourceY)) {
                resources.push({ x: resourceX, y: resourceY, type: 'wood', amount: 450 });
            }
        }
    }
}

function drawMap(camera) {
    const visibleWidth = Math.floor(camera.width * camera.zoom);
    const visibleHeight = Math.floor(camera.height * camera.zoom);
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
                // Неразведанная территория - полный туман
                ctx.fillStyle = tileTypes.fog;
                ctx.fillRect((x - camera.x) * tileSize, (y - camera.y) * tileSize, tileSize, tileSize);
            } else {
                // Сначала рисуем базовую клетку
                ctx.fillStyle = tileTypes[tile];
                ctx.fillRect((x - camera.x) * tileSize, (y - camera.y) * tileSize, tileSize, tileSize);

                // Если клетка разведана, но не видна в данный момент - накладываем затемнение
                if (!visibility[y][x]) {
                    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)'; // Увеличиваем непрозрачность для более заметного затемнения
                    ctx.fillRect((x - camera.x) * tileSize, (y - camera.y) * tileSize, tileSize, tileSize);
                }
            }

            // Отрисовка ресурсов
            const resource = resources.find(r => r.x === x && r.y === y);
            if (resource) {
                if (visibility[y][x] || exploredMap[y][x]) {
                    const resourceSize = tileSize * 0.8;
                    const offset = (tileSize - resourceSize) / 2;
                    
                    if (visibility[y][x]) {
                        // Ресурс в зоне видимости - полный цвет
                        ctx.fillStyle = resourceTypes[resource.type];
                    } else {
                        // Ресурс в разведанной, но не видимой зоне - серый цвет
                        ctx.fillStyle = 'rgba(128, 128, 128, 0.5)';
                    }
                    
                    ctx.fillRect(
                        (x - camera.x) * tileSize + offset,
                        (y - camera.y) * tileSize + offset,
                        resourceSize,
                        resourceSize
                    );
                }
            }
        }
    }

    ctx.restore();
}

export { tileSize, mapWidth, mapHeight, tileTypes, map, visibility, exploredMap, chunks, generateMap, drawMap, resources, resourceTypes };