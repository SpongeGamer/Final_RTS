import { tileSize, mapWidth, mapHeight, base1X, base1Y } from './map.js';

const canvas = document.getElementById('gameCanvas');

let camera = {
    x: Math.max(0, Math.min(mapWidth - (canvas.width / tileSize) / 1.5, 2 - 5)),
    y: Math.max(0, Math.min(mapHeight - (canvas.height / tileSize) / 1.5, 2 - 5)),
    width: canvas.width / tileSize,
    height: canvas.height / tileSize,
    zoom: 1.5
};

function updateCameraBounds() {
    camera.width = canvas.width / (tileSize * camera.zoom);
    camera.height = canvas.height / (tileSize * camera.zoom);
}

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
                camera.y = Math.min(mapHeight - camera.height, camera.y + speed / camera.zoom);
                break;
            case 'arrowleft':
            case 'a':
                camera.x = Math.max(0, camera.x - speed / camera.zoom);
                break;
            case 'arrowright':
            case 'd':
                camera.x = Math.min(mapWidth - camera.width, camera.x + speed / camera.zoom);
                break;
        }
        drawCallback();
    });

    canvas.addEventListener('wheel', (e) => {
        e.preventDefault();
        const zoomSpeed = 0.1;
        const oldZoom = camera.zoom;
        const mouseX = (e.clientX - canvas.offsetLeft) / (tileSize * oldZoom);
        const mouseY = (e.clientY - canvas.offsetTop) / (tileSize * oldZoom);

        camera.zoom = Math.max(0.5, Math.min(2.0, camera.zoom - e.deltaY * zoomSpeed * 0.001));
        updateCameraBounds();
        const dx = mouseX - camera.width / 2;
        const dy = mouseY - camera.height / 2;
        camera.x = Math.max(0, Math.min(mapWidth - camera.width, camera.x + dx * (1 - camera.zoom / oldZoom)));
        camera.y = Math.max(0, Math.min(mapHeight - camera.height, camera.y + dy * (1 - camera.zoom / oldZoom)));
        drawCallback();
    });

    window.addEventListener('resize', () => {
        canvas.width = Math.min(1280, window.innerWidth - 400);
        canvas.height = Math.min(960, window.innerHeight - 100);
        updateCameraBounds();
        drawCallback();
    });

    canvas.width = Math.min(1280, window.innerWidth - 400);
    canvas.height = Math.min(960, window.innerHeight - 100);
    updateCameraBounds();
}

export { camera, handleCameraMovement, updateCameraBounds };