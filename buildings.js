import { mapWidth, mapHeight, map, visibility, base1X, base1Y, base2X, base2Y, exploredMap } from './map.js';
import { camera } from './camera.js';
import { updateFog } from './fog.js'; // Импортируем updateFog вместо updateUnitsVisibility
import { updateBarracksCount } from './units.js';

let buildings = [
    { x: base1X, y: base1Y, player: 1, type: 'base1' },
    { x: base2X, y: base2Y, player: 2, type: 'base2' }
];
let buildingCount = 0;

function placeBuilding(x, y, player, type) {
    if (x >= 0 && x < mapWidth && y >= 0 && y < mapHeight && map[y][x] !== 'water') {
        buildings.push({ x, y, player, type });
        map[y][x] = type;
        buildingCount++;
        if (type === 'building-normal' && player === 1) { // Предполагаем, что "Казарма" — это building-normal
            const barracksCount = buildings.filter(b => b.type === 'building-normal' && b.player === 1).length;
            updateBarracksCount(barracksCount);
        }
        updateFog();
    }
}

async function drawBuildings() {
    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');
    
    const visibleWidth = Math.floor(camera.width);
    const visibleHeight = Math.floor(camera.height);
    const startX = Math.floor(camera.x);
    const endX = Math.min(startX + visibleWidth + 1, mapWidth);
    const startY = Math.floor(camera.y);
    const endY = Math.min(startY + visibleHeight + 1, mapHeight);

    ctx.save();
    ctx.scale(camera.zoom, camera.zoom);

    buildings.forEach(building => {
        if (building.x >= startX && building.x < endX && building.y >= startY && building.y < endY && (visibility[building.y][building.x] || exploredMap[building.y][building.x])) {
            ctx.fillStyle = building.player === 1 ? '#0000FF' : '#FF0000';
            if (building.type === 'base1' || building.type === 'base2') {
                ctx.fillRect((building.x - camera.x) * 32, (building.y - camera.y) * 32, 32, 32);
            } else if (building.type === 'building-normal') {
                ctx.fillStyle = '#FFA500';
                ctx.fillRect((building.x - camera.x) * 32, (building.y - camera.y) * 32, 32, 32);
            } else if (building.type === 'building-defense') {
                ctx.fillStyle = '#00FF00';
                ctx.fillRect((building.x - camera.x) * 32, (building.y - camera.y) * 32, 32, 32);
            }
        }
    });

    ctx.restore();
}

export { buildings, buildingCount, placeBuilding, drawBuildings };