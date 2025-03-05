// map.js
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const tileSize = 32;
const mapWidth = 40; // Уменьшаем для тестов, можно вернуть 60
const mapHeight = 30; // Уменьшаем для тестов, можно вернуть 45
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

    for (let y = 0; y < mapHeight; y += chunkSize) {
        for (let x = 0; x < mapWidth; x += chunkSize) {
            await new Promise(resolve => setTimeout(resolve, 10));
            const chunk = [];
            for (let cy = 0; cy < chunkSize && y + cy < mapHeight; cy++) {
                chunk[cy] = [];
                for (let cx = 0; cx < chunkSize && x + cx < mapWidth; cx++) {
                    const noiseValue = noise[y + cy][x + cx];
                    if (noiseValue < 0.2) chunk[cy][cx] = 'water';
                    else if (noiseValue < 0.5) chunk[cy][cx] = 'forest';
                    else chunk[cy][cx] = 'grass';
                }
            }
            chunks.push({ x, y, data: chunk });
            for (let cy = 0; cy < chunk.length; cy++)
                for (let cx = 0; cx < chunk[cy].length; cx++)
                    map[y + cy][x + cx] = chunk[cy][cx];
        }
    }

    // Размещение баз в противоположных углах
    // База синих в левом верхнем углу
    const base1X = 0;
    const base1Y = 0;
    
    // Гарантируем, что место для синей базы будет пригодным
    map[base1Y][base1X] = 'grass';
    map[base1Y][base1X] = 'base1';

    // База красных в правом нижнем углу
    const base2X = mapWidth - 1;
    const base2Y = mapHeight - 1;
    
    // Гарантируем, что место для красной базы будет пригодным
    map[base2Y][base2X] = 'grass';
    map[base2Y][base2X] = 'base2';

    // Очищаем территорию вокруг баз от воды
    for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
            // Для синей базы
            if (base1Y + dy >= 0 && base1Y + dy < mapHeight && base1X + dx >= 0 && base1X + dx < mapWidth) {
                if (map[base1Y + dy][base1X + dx] === 'water') {
                    map[base1Y + dy][base1X + dx] = 'grass';
                }
            }
            // Для красной базы
            if (base2Y + dy >= 0 && base2Y + dy < mapHeight && base2X + dx >= 0 && base2X + dx < mapWidth) {
                if (map[base2Y + dy][base2X + dx] === 'water') {
                    map[base2Y + dy][base2X + dx] = 'grass';
                }
            }
        }
    }

    // Генерация ресурсов
    const numberOfResourcePiles = 8; // Увеличиваем количество куч ресурсов
    for (let i = 0; i < numberOfResourcePiles; i++) {
        let pileX, pileY;
        do {
            pileX = Math.floor(Math.random() * mapWidth);
            pileY = Math.floor(Math.random() * mapHeight);
        } while (map[pileY][pileX] === 'water' || 
                (Math.abs(pileX - base1X) < 3 && Math.abs(pileY - base1Y) < 3) || 
                (Math.abs(pileX - base2X) < 3 && Math.abs(pileY - base2Y) < 3));

        const pileSize = Math.floor(Math.random() * 2) + 4;
        for (let j = 0; j < pileSize; j++) {
            let resourceX, resourceY;
            do {
                resourceX = pileX + (Math.floor(Math.random() * 3) - 1);
                resourceY = pileY + (Math.floor(Math.random() * 3) - 1);
            } while (resourceX < 0 || resourceX >= mapWidth || resourceY < 0 || resourceY >= mapHeight || 
                    map[resourceY][resourceX] === 'water');

            const resourceType = Math.random() < 0.5 ? 'gold' : 'wood';
            resources.push({ x: resourceX, y: resourceY, type: resourceType, amount: 200 }); // Увеличиваем количество ресурсов
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