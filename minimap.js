import { mapWidth, mapHeight, tileTypes, visibility, map, exploredMap, resources, resourceTypes } from './map.js';
import { units } from './units.js';
import { camera } from './camera.js';
import { buildings } from './buildings.js';

const miniMapSize = 300;
const miniTileSize = 4;

const miniMapContainer = document.getElementById('miniMapContainer');
const miniMapCanvas = document.createElement('canvas');
miniMapCanvas.width = miniMapSize;
miniMapCanvas.height = miniMapSize;
miniMapContainer.appendChild(miniMapCanvas);
const miniCtx = miniMapCanvas.getContext('2d');

function drawMiniMap() {
    const miniMapX = 0;
    const miniMapY = 0;

    miniCtx.clearRect(miniMapX, miniMapY, miniMapSize, miniMapSize);

    for (let y = 0; y < mapHeight; y++) {
        for (let x = 0; x < mapWidth; x++) {
            const tile = map[y][x] || 'grass';
            if (exploredMap[y][x]) {
                miniCtx.fillStyle = tileTypes[tile];
                miniCtx.fillRect(miniMapX + x * miniTileSize, miniMapY + y * miniTileSize, miniTileSize, miniTileSize);
            }
        }
    }

    buildings.forEach(building => {
        if (building && typeof building.x === 'number' && typeof building.y === 'number') {
            const tileY = Math.round(building.y);
            const tileX = Math.round(building.x);
            if (tileX >= 0 && tileX < mapWidth && tileY >= 0 && tileY < mapHeight && exploredMap[tileY][tileX]) {
                miniCtx.fillStyle = building.player === 1 ? '#0000FF' : '#FF0000';
                miniCtx.fillRect(
                    miniMapX + tileX * miniTileSize,
                    miniMapY + tileY * miniTileSize,
                    miniTileSize,
                    miniTileSize
                );
            }
        }
    });

    resources.forEach(resource => {
        if (resource && typeof resource.x === 'number' && typeof resource.y === 'number') {
            const tileY = Math.round(resource.y);
            const tileX = Math.round(resource.x);
            if (tileX >= 0 && tileX < mapWidth && tileY >= 0 && tileY < mapHeight && exploredMap[tileY][tileX]) {
                miniCtx.fillStyle = resourceTypes[resource.type];
                miniCtx.fillRect(
                    miniMapX + tileX * miniTileSize,
                    miniMapY + tileY * miniTileSize,
                    miniTileSize,
                    miniTileSize
                );
            }
        }
    });

    units.forEach(unit => {
        if (unit && typeof unit.x === 'number' && typeof unit.y === 'number') {
            const tileX = Math.round(unit.x);
            const tileY = Math.round(unit.y);
            if (tileX >= 0 && tileX < mapWidth && tileY >= 0 && tileY < mapHeight && exploredMap[tileY][tileX]) {
                miniCtx.fillStyle = unit.player === 1 ? '#0000FF' : '#FF0000';
                miniCtx.beginPath();
                miniCtx.arc(
                    miniMapX + tileX * miniTileSize + miniTileSize / 2,
                    miniMapY + tileY * miniTileSize + miniTileSize / 2,
                    miniTileSize / 2,
                    0,
                    Math.PI * 2
                );
                miniCtx.fill();
            }
        }
    });

    const rectWidth = camera.width * miniTileSize;
    const rectHeight = camera.height * miniTileSize;

    miniCtx.strokeStyle = '#FFFFFF';
    miniCtx.lineWidth = 2;
    miniCtx.strokeRect(
        miniMapX + camera.x * miniTileSize,
        miniMapY + camera.y * miniTileSize,
        rectWidth,
        rectHeight
    );
}

export { drawMiniMap, miniMapSize, miniTileSize };