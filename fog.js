// fog.js
import { mapHeight, mapWidth, visibility, exploredMap, map } from './map.js';
import { units } from './units.js';
import { buildings } from './buildings.js';

let fog = Array.from({ length: mapHeight }, () => Array(mapWidth).fill(true)); // true — скрыто, false — видно

function updateFog(initial = false) {
    // Сбрасываем текущую видимость и туман только при начальной инициализации
    if (initial) {
        for (let y = 0; y < mapHeight; y++) {
            for (let x = 0; x < mapWidth; x++) {
                visibility[y][x] = false;
                fog[y][x] = true;
            }
        }
    }

    // Обновляем видимость вокруг юнитов игрока 1
    units.forEach(unit => {
        if (unit.player === 1) {
            const range = unit.visionRange;
            const centerX = unit.x;
            const centerY = unit.y;
            for (let y = centerY - range; y <= centerY + range; y++) {
                for (let x = centerX - range; x <= centerX + range; x++) {
                    if (y >= 0 && y < mapHeight && x >= 0 && x < mapWidth) {
                        const dx = x - centerX;
                        const dy = y - centerY;
                        const distance = Math.sqrt(dx * dx + dy * dy);
                        if (distance <= range) {
                            let hasLineOfSight = true;
                            const steps = Math.max(Math.abs(dx), Math.abs(dy));
                            if (steps > 0) {
                                for (let i = 1; i <= steps; i++) {
                                    const checkX = Math.round(centerX + (dx * i) / steps);
                                    const checkY = Math.round(centerY + (dy * i) / steps);
                                    if (checkX >= 0 && checkX < mapWidth && checkY >= 0 && checkY < mapHeight) {
                                        if (map[checkY][checkX] === 'water') {
                                            hasLineOfSight = false;
                                            break;
                                        }
                                    }
                                }
                            }
                            if (hasLineOfSight) {
                                visibility[y][x] = true;
                                exploredMap[y][x] = true;
                            }
                        }
                    }
                }
            }
        }
    });

    // Обновляем видимость вокруг зданий игрока 1
    buildings.forEach(building => {
        if (building.player === 1) {
            const range = building.type === 'base1' ? 3 : 5; // Разные радиусы для базы и других зданий
            const centerX = building.x;
            const centerY = building.y;
            for (let y = centerY - range; y <= centerY + range; y++) {
                for (let x = centerX - range; x <= centerX + range; x++) {
                    if (y >= 0 && y < mapHeight && x >= 0 && x < mapWidth) {
                        const dx = x - centerX;
                        const dy = y - centerY;
                        const distance = Math.sqrt(dx * dx + dy * dy);
                        if (distance <= range) {
                            visibility[y][x] = true;
                            exploredMap[y][x] = true;
                        }
                    }
                }
            }
        }
    });

    // Синхронизируем массив fog с visibility
    for (let y = 0; y < mapHeight; y++) {
        for (let x = 0; x < mapWidth; x++) {
            fog[y][x] = !visibility[y][x]; // true если не видно, false если видно
        }
    }
}

function drawFog(camera) {
    const visibleWidth = Math.floor(camera.width);
    const visibleHeight = Math.floor(camera.height);
    const startX = Math.floor(camera.x);
    const endX = Math.min(startX + visibleWidth + 1, mapWidth);
    const startY = Math.floor(camera.y);
    const endY = Math.min(startY + visibleHeight + 1, mapHeight);

    const ctx = document.getElementById('gameCanvas').getContext('2d');
    ctx.save();
    ctx.scale(camera.zoom, camera.zoom);

    for (let y = startY; y < endY; y++) {
        for (let x = startX; x < endX; x++) {
            if (fog[y][x]) {
                // Если клетка в тумане, но разведана
                if (exploredMap[y][x]) {
                    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
                } else {
                    // Если клетка не разведана - полный туман
                    ctx.fillStyle = '#666666';
                }
                ctx.fillRect((x - camera.x) * 32, (y - camera.y) * 32, 32, 32);
            }
        }
    }

    ctx.restore();
}

export { fog, updateFog, drawFog };