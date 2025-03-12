// camera.js
import { tileSize, mapWidth, mapHeight } from './map.js';

const canvas = document.getElementById('gameCanvas');

let camera = {
    x: 0,
    y: 0,
    width: 20,
    height: 15,
    zoom: 1.5
};

// Центрируем камеру на начальной базе
camera.x = 0;
camera.y = 0;

function handleCameraMovement(drawCallback) {
    const speed = 5;
    document.addEventListener('keydown', (e) => {
        switch (e.key.toLowerCase()) {
            case 'arrowup':
            case 'w':
                camera.y = Math.max(0, camera.y - speed / camera.zoom);
                break;
            case 'arrowdown':
            case 's':
                camera.y = Math.min(mapHeight - camera.height * camera.zoom, camera.y + speed / camera.zoom);
                break;
            case 'arrowleft':
            case 'a':
                camera.x = Math.max(0, camera.x - speed / camera.zoom);
                break;
            case 'arrowright':
            case 'd':
                camera.x = Math.min(mapWidth - camera.width * camera.zoom, camera.x + speed / camera.zoom);
                break;
        }
        drawCallback(); // Вызываем переданную функцию для перерисовки
    });

    canvas.addEventListener('wheel', (e) => {
        e.preventDefault();
        const zoomSpeed = 0.1;
        const oldZoom = camera.zoom;
        const mouseX = (e.clientX - canvas.offsetLeft) / (tileSize * oldZoom);
        const mouseY = (e.clientY - canvas.offsetTop) / (tileSize * oldZoom);

        camera.zoom = Math.max(0.5, Math.min(2.0, camera.zoom - e.deltaY * zoomSpeed * 0.001));
        const dx = mouseX - camera.width / 2;
        const dy = mouseY - camera.height / 2;
        camera.x = Math.max(0, Math.min(mapWidth - camera.width * camera.zoom, camera.x + dx * (1 - camera.zoom / oldZoom)));
        camera.y = Math.max(0, Math.min(mapHeight - camera.height * camera.zoom, camera.y + dy * (1 - camera.zoom / oldZoom)));
        drawCallback(); // Вызываем переданную функцию для перерисовки
    });
}

export { camera, handleCameraMovement };