import { mapWidth, mapHeight, tileTypes, visibility, map, exploredMap } from './map.js';
import { units } from './units.js';
import { camera } from './camera.js';

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const miniMapSize = 300;  // Moved up
const miniTileSize = 4;   // Moved up

const miniMapContainer = document.getElementById('miniMapContainer');
const miniMapCanvas = document.createElement('canvas');
miniMapCanvas.width = miniMapSize;
miniMapCanvas.height = miniMapSize;
miniMapContainer.appendChild(miniMapCanvas);
const miniCtx = miniMapCanvas.getContext('2d');

function drawMiniMap() {
    const miniMapX = 0;
    const miniMapY = 0;

    miniCtx.fillStyle = '#000000';
    miniCtx.fillRect(miniMapX, miniMapY, miniMapSize, miniMapSize);

    for (let y = 0; y < mapHeight; y++) {
        for (let x = 0; x < mapWidth; x++) {
            const tile = map[y][x] || 'grass';
            
            if (visibility[y][x]) {
                miniCtx.fillStyle = tileTypes[tile];
            } else if (exploredMap[y][x]) {
                miniCtx.fillStyle = `rgba(128, 128, 128, 0.5)`;
            }
            
            if (visibility[y][x] || exploredMap[y][x]) {
                miniCtx.fillRect(miniMapX + x * miniTileSize, miniMapY + y * miniTileSize, miniTileSize, miniTileSize);
            }
        }
    }

    units.forEach(unit => {
        if (visibility[unit.y][unit.x]) {
            miniCtx.fillStyle = unit.player === 1 ? '#0000FF' : '#FF0000';
            miniCtx.beginPath();
            miniCtx.arc(
                miniMapX + unit.x * miniTileSize + miniTileSize / 2,
                miniMapY + unit.y * miniTileSize + miniTileSize / 2,
                miniTileSize / 2,
                0,
                Math.PI * 2
            );
            miniCtx.fill();
        }
    });

    miniCtx.strokeStyle = '#FFFFFF';
    miniCtx.strokeRect(
        miniMapX + camera.x * miniTileSize,
        miniMapY + camera.y * miniTileSize,
        camera.width * camera.zoom * miniTileSize,
        camera.height * camera.zoom * miniTileSize
    );

    // Remove this duplicate drawing on the main canvas
    // ctx.strokeStyle = '#FFFFFF';
    // ctx.strokeRect(
    //     miniMapX + camera.x * miniTileSize,
    //     miniMapY + camera.y * miniTileSize,
    //     camera.width * camera.zoom * miniTileSize,
    //     camera.height * camera.zoom * miniTileSize
    // );
}

export { drawMiniMap, miniMapSize, miniTileSize };