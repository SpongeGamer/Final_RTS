// buildings.js
import { mapWidth, mapHeight, map, visibility } from './map.js';
import { units } from './units.js';

// Асинхронно импортируем camera из camera.js
let cameraPromise = import('./camera.js').then(module => module.camera);

// Здания
let buildings = [
    { x: 0, y: 0, player: 1, type: 'base1' },
    { x: 0, y: 0, player: 2, type: 'base2' }
];
let buildingCount = 0;

function placeBuilding(x, y, player, type) {
    if (x >= 0 && x < mapWidth && y >= 0 && y < mapHeight && map[y][x] !== 'water') {
        buildings.push({ x, y, player, type });
        map[y][x] = type;
        buildingCount++;
        updateVisibility(); // Вызываем синхронно, если updateVisibility синхронна
    }
}

async function drawBuildings() { // Помечаем функцию как async
    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');
    const camera = await cameraPromise; // Ждём разрешения промиса для получения camera

    const visibleWidth = Math.floor(camera.width * camera.zoom);
    const visibleHeight = Math.floor(camera.height * camera.zoom);
    const startX = Math.floor(camera.x);
    const endX = Math.min(startX + visibleWidth + 1, mapWidth);
    const startY = Math.floor(camera.y);
    const endY = Math.min(startY + visibleHeight + 1, mapHeight);

    ctx.save();
    ctx.scale(camera.zoom, camera.zoom);

    buildings.forEach(building => {
        if (building.x >= startX && building.x < endX && building.y >= startY && building.y < endY && visibility[building.y][building.x]) {
            ctx.fillStyle = building.player === 1 ? '#FF0000' : '#0000FF';
            if (building.type === 'base1' || building.type === 'base2') {
                ctx.fillRect((building.x - camera.x) * 32, (building.y - camera.y) * 32, 32, 32);
            } else if (building.type === 'building-normal') {
                ctx.fillStyle = '#FFA500'; // Оранжевый для обычных зданий
                ctx.fillRect((building.x - camera.x) * 32, (building.y - camera.y) * 32, 32, 32);
            } else if (building.type === 'building-defense') {
                ctx.fillStyle = '#00FF00'; // Зелёный для оборонительных зданий
                ctx.fillRect((building.x - camera.x) * 32, (building.y - camera.y) * 32, 32, 32);
            }
        }
    });

    ctx.restore();
}

async function updateVisibility() { // Помечаем функцию как async
    // Асинхронно импортируем updateVisibility из units.js
    const { updateVisibility: updateUnitsVisibility } = await import('./units.js');
    updateUnitsVisibility(); // Вызываем функцию из units.js
}

export { buildings, buildingCount, placeBuilding, drawBuildings, updateVisibility };