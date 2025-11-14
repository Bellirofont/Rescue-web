// ✅ ИСПРАВЛЕННАЯ ФУНКЦИЯ ДЛЯ РАСЧЕТА ВЫСОТЫ (250+ точек)
function showReliefStats() {
    if (!window.searchFeature) return;

    const points = 250;
    const bbox = turf.bbox(window.searchFeature);
    let totalElev = 0;
    let minElev = Infinity;
    let maxElev = -Infinity;

    for (let i = 0; i < points; i++) {
        const lat = bbox[1] + Math.random() * (bbox[3] - bbox[1]);
        const lng = bbox[0] + Math.random() * (bbox[2] - bbox[0]);
        const inside = turf.booleanPointInPolygon(turf.point([lng, lat]), window.searchFeature);
        if (!inside) continue;

        const elev = window.estimateElevation(lat, lng);
        totalElev += elev;
        minElev = Math.min(minElev, elev);
        maxElev = Math.max(maxElev, elev);
    }

    alert(`📊 Высоты в зоне:\nСредняя: ${Math.round(totalElev / points)} м\nМин: ${Math.round(minElev)} м\nМакс: ${Math.round(maxElev)} м`);
}

// ✅ ИСПРАВЛЕННАЯ ФУНКЦИЯ ГЕНЕРАЦИИ СЕТКИ
function generateGrid() {
    if (!window.searchFeature) return alert('Нарисуйте полигон!');
    window.gridLayer.clearLayers();
    window.gridCells = [];
    window.roadCells = [];
    window.noRoadCells = [];
    window.highDifficultyCells = [];
    window.mediumDifficultyCells = [];
    window.lowDifficultyCells = [];
    window.roadDataLoaded = false;
    window.roadLoadingStatus = 'not-started';

    const size = parseFloat(document.getElementById('gridCustom').value) || parseFloat(document.getElementById('gridPreset').value);
    if (!size || size <= 0) return alert('Укажите размер сетки!');

    const buffered = turf.buffer(window.searchFeature, 1, { units: 'kilometers' });
    const bbox = turf.bbox(buffered);
    const avgLat = (bbox[1] + bbox[3]) / 2;
    const metersPerDegLat = 111132.92 - 559.82 * Math.cos(2 * avgLat * Math.PI/180) + 1.175 * Math.cos(4 * avgLat * Math.PI/180);
    const metersPerDegLon = 111412.84 * Math.cos(avgLat * Math.PI/180) - 93.5 * Math.cos(3 * avgLat * Math.PI/180);
    const degLat = size / metersPerDegLat;
    const degLon = size / metersPerDegLon;

    let startLon = Math.floor(bbox[0] / degLon) * degLon - degLon;
    let startLat = Math.floor(bbox[1] / degLat) * degLat - degLat;

    let col = 0;
    for (let lon = startLon; lon <= bbox[2] + degLon; lon += degLon) {
        let row = 1;
        for (let lat = startLat; lat <= bbox[3] + degLat; lat += degLat) {
            L.polyline([[lat, lon], [lat, lon + degLon]], {color: '#3388ff', weight: 1}).addTo(window.gridLayer);
            L.polyline([[lat, lon], [lat + degLat, lon]], {color: '#3388ff', weight: 1}).addTo(window.gridLayer);

            const label = window.getColumnLabel(col) + row;
            const icon = L.divIcon({className: 'grid-label', html: label, iconSize: [30,30], iconAnchor: [15,15]});
            L.marker([lat, lon], {icon}).addTo(window.gridLayer);

            const cellPoly = turf.polygon([[[lon, lat], [lon + degLon, lat], [lon + degLon, lat + degLat], [lon, lat + degLat], [lon, lat]]]);
            const clipped = turf.intersect(cellPoly, window.searchFeature);
            if (clipped && turf.area(clipped) > 100) {
                const area = turf.area(clipped);
                const center = turf.center(clipped);
                clipped.properties = {label, area};
                const layer = L.geoJSON(clipped, {style: {color: '#3388ff', weight: 1, fillOpacity: 0.05}}).addTo(window.gridLayer);
                window.gridCells.push({geojson: clipped, layer, center, area});
            }
            row++;
        }
        col++;
    }

    // Загружаем дороги с обработкой ошибок
    window.updateRoadStatus('', 'loading');
    window.loadRoadsInGrid().catch(e => {
        console.error('Error loading roads:', e);
        window.roadCells = [...window.gridCells];
        window.noRoadCells = [];
        window.roadDataLoaded = false;
        window.updateRoadStatus(`Ошибка загрузки дорог: ${e.message}`, 'error');
    });
    
    const forceResize = () => setTimeout(() => window.map.invalidateSize({ pan: true, animate: true }), 50);
    forceResize();
}

// Русские буквы для меток грида
window.russianLetters = 'АБВГДЕЖЗИКЛМНОПРСТУФХЦЧШЩЮ'.split('');

window.getColumnLabel = function(n) {
    let s = '';
    while (n >= 0) {
        s = window.russianLetters[n % window.russianLetters.length] + s;
        n = Math.floor(n / window.russianLetters.length) - 1;
    }
    return s || 'А';
};

// Экспортируем функции
document.addEventListener('DOMContentLoaded', () => {
    window.showReliefStats = showReliefStats;
    window.generateGrid = generateGrid;
    
    console.log('Сервис генерации сетки инициализирован');
});