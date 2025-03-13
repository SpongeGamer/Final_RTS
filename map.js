// map.js
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const tileSize = 32;
const mapWidth = 75;
const mapHeight = 75;
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

function generatePerlinNoise(width, height) {
    let noise = Array.from({ length: height }, () => Array(width).fill(0));
    const layers = [
        { frequency: 0.03, amplitude: 0.5 }, // Большие биомы
        { frequency: 0.1, amplitude: 0.3 },  // Средние детали
        { frequency: 0.2, amplitude: 0.2 },   // Мелкие детали
        { frequency: 0.4, amplitude: 0.1 }   // Дополнительный слой для воды
    ];

    for (let layer of layers) {
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const noiseValue = Math.sin(x * layer.frequency) * Math.cos(y * layer.frequency);
                noise[y][x] += noiseValue * layer.amplitude;
            }
        }
    }

    // Нормализация значений в диапазон [0, 1]
    const minNoise = Math.min(...noise.flat());
    const maxNoise = Math.max(...noise.flat());
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            noise[y][x] = (noise[y][x] - minNoise) / (maxNoise - minNoise);
        }
    }
    return noise;
}

let base1X, base1Y, base2X, base2Y;
async function generateMap() {
    const noise = generatePerlinNoise(mapWidth, mapHeight);

    // Генерируем карту
    for (let y = 0; y < mapHeight; y++) {
        for (let x = 0; x < mapWidth; x++) {
            const noiseValue = noise[y][x];
            if (noiseValue < 0.2) map[y][x] = 'water';
            else if (noiseValue < 0.4) map[y][x] = 'forest';
            else map[y][x] = 'grass';
        }
    }

    // Сглаживание воды
for (let y = 0; y < mapHeight; y++) {
    for (let x = 0; x < mapWidth; x++) {
        let waterCount = 0;
        for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
                if (dy === 0 && dx === 0) continue;
                if (isInBounds(y + dy, x + dx) && map[y + dy][x + dx] === 'water') waterCount++;
            }
        }
        if (waterCount > 4 && map[y][x] !== 'water') map[y][x] = 'water';
        if (waterCount < 3 && map[y][x] === 'water') map[y][x] = 'grass';
    }
}

    // Случайные "острова" воды
    for (let i = 0; i < 5; i++) {
        const islandX = Math.floor(Math.random() * mapWidth);
        const islandY = Math.floor(Math.random() * mapHeight);
        for (let dy = -2; dy <= 2; dy++) {
            for (let dx = -2; dx <= 2; dx++) {
                if (Math.random() > 0.3 && isInBounds(islandY + dy, islandX + dx)) {
                    map[islandY + dy][islandX + dx] = 'water';
                }
            }
        }
    }

// Генерация ресурсов
const numberOfGoldPiles = 15;
const numberOfWoodPiles = 20;

// Генерация золота
for (let i = 0; i < numberOfGoldPiles; i++) {
    let pileX, pileY;
    do {
        pileX = Math.floor(Math.random() * mapWidth);
        pileY = Math.floor(Math.random() * mapHeight);
    } while (
        map[pileY][pileX] === 'water' || 
        (Math.abs(pileX - base1X) < 4 && Math.abs(pileY - base1Y) < 4) || 
        (Math.abs(pileX - base2X) < 4 && Math.abs(pileY - base2Y) < 4) ||
        resources.some(r => Math.abs(r.x - pileX) < 4 && Math.abs(r.y - pileY) < 4)
    );

    const pileSize = Math.floor(Math.random() * 2) + 3;
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
        (Math.abs(pileX - base1X) < 4 && Math.abs(pileY - base1Y) < 4) || 
        (Math.abs(pileX - base2X) < 4 && Math.abs(pileY - base2Y) < 4) ||
        resources.some(r => Math.abs(r.x - pileX) < 4 && Math.abs(r.y - pileY) < 4)
    );

    const pileSize = Math.floor(Math.random() * 2) + 4;
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

// Очищаем территорию вокруг баз перед их размещением
function clearAreaAroundBase(x, y) {
    for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
            if (isInBounds(y + dy, x + dx)) {
                map[y + dy][x + dx] = 'grass';
            }
        }
    }
}

// База игрока 1
clearAreaAroundBase(2, 2);
base1X = 2;
base1Y = 2;
map[base1Y][base1X] = 'base1';

// База игрока 2
clearAreaAroundBase(73, 73);
base2X = 73;
base2Y = 73;
map[base2Y][base2X] = 'base2';

// Убедитесь, что вокруг баз нет воды
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

// После генерации карты добавьте в конец generateMap():
console.log("Base1:", base1X, base1Y);
console.log("Base2:", base2X, base2Y);

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
if (tile === 'base1' || tile === 'base2') {
    console.log(`Drawing base at (${x}, ${y}) with tile ${tile}`);
}
            
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

export { tileSize, mapWidth, mapHeight, tileTypes, map, visibility, exploredMap, chunks, generateMap, drawMap, resources, resourceTypes, base1X, base1Y, base2X, base2Y };