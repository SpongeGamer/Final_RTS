import { revealFog, addResources, spawnWorker, spawnInfantry } from './units.js';

// Привязываем функции к кнопкам после загрузки DOM
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('revealFogBtn').addEventListener('click', revealFog);
    document.getElementById('addResourcesBtn').addEventListener('click', addResources);
    document.getElementById('spawnWorkerBtn').addEventListener('click', spawnWorker);
    document.getElementById('spawnInfantryBtn').addEventListener('click', spawnInfantry);
});