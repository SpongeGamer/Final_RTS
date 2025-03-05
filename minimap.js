// minimap.js
import { mapWidth, mapHeight, tileTypes, visibility, map, exploredMap } from './map.js';
import { units } from './units.js';
import { camera } from './camera.js';

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const miniMapSize = 150;
const miniTileSize = 2;

function drawMiniMap() {
    const miniMapX = canvas.width - miniMapSize - 10;
    const miniMapY = 10;

    ctx.fillStyle = '#000000';
    ctx.fillRect(miniMapX, miniMapY, miniMapSize, miniMapSize);

    for (let y = 0; y < mapHeight; y++) {
        for (let x = 0; x < mapWidth; x++) {
            const tile = map[y][x] || 'grass';
            
            if (visibility[y][x]) {
                // Видимая территория
                ctx.fillStyle = tileTypes[tile];
            } else if (exploredMap[y][x]) {
                // Разведанная территория
                const color = tileTypes[tile];
                // Преобразуем цвет в более тёмный
                ctx.fillStyle = `rgba(128, 128, 128, 0.5)`;
            }
            
            if (visibility[y][x] || exploredMap[y][x]) {
                ctx.fillRect(miniMapX + x * miniTileSize, miniMapY + y * miniTileSize, miniTileSize, miniTileSize);
            }
        }
    }

    // Отрисовка юнитов
    units.forEach(unit => {
        if (visibility[unit.y][unit.x]) {
            ctx.fillStyle = unit.player === 1 ? '#0000FF' : '#FF0000';
            ctx.beginPath();
            ctx.arc(
                miniMapX + unit.x * miniTileSize + miniTileSize / 2,
                miniMapY + unit.y * miniTileSize + miniTileSize / 2,
                miniTileSize / 2,
                0,
                Math.PI * 2
            );
            ctx.fill();
        }
    });

    // Отрисовка рамки видимой области
    ctx.strokeStyle = '#FFFFFF';
    ctx.strokeRect(
        miniMapX + camera.x * miniTileSize,
        miniMapY + camera.y * miniTileSize,
        camera.width * camera.zoom * miniTileSize,
        camera.height * camera.zoom * miniTileSize
    );
}

export { drawMiniMap, miniMapSize, miniTileSize };