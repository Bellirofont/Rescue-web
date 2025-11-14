// 🌄 ФУНКЦИИ РЕЛЬЕФА
function estimateElevation(lat, lng) {
    const base = window.RELIEF.avg;
    const variation = (window.RELIEF.max - window.RELIEF.min) * 0.4;
    const noise = Math.sin(lat * 1.5) * 0.5 + Math.cos(lng * 1.2) * 0.5;
    const elevation = base + noise * variation;
    return Math.max(window.RELIEF.min, Math.min(window.RELIEF.max, elevation));
}

function getRoadDensity(cell) {
    if (!window.roadGeoJSON || !window.roadGeoJSON.features) return 0;
    
    let totalLength = 0;
    const cellArea = turf.area(cell.geojson) / 1000000; // в км²
    
    for (const feature of window.roadGeoJSON.features) {
        try {
            const intersection = turf.lineIntersect(feature, cell.geojson);
            if (intersection.features.length > 0) {
                totalLength += turf.length(intersection, {units: 'kilometers'});
            }
        } catch (e) {
            // Пропускаем ошибки пересечения
        }
    }
    
    // Плотность дорог в км/км²
    return cellArea > 0 ? totalLength / cellArea : 0;
}

function getCellDifficulty(cell) {
    const [lng, lat] = cell.center.geometry.coordinates;
    const elev = estimateElevation(lat, lng);
    
    // Вычисляем уклон
    const slope = (elev - window.RELIEF.min) / (window.RELIEF.max - window.RELIEF.min) * 90;
    
    // Вычисляем плотность дорог
    const roadDensity = getRoadDensity(cell);
    
    // Определяем сложность с учетом обоих факторов
    if (slope > 30 || roadDensity < 0.5) {
        return 'high';
    } else if (slope > 15 || roadDensity < 1.5) {
        return 'medium';
    } else {
        return 'low';
    }
}

// Добавление рельефа на карту
function addReliefLayer(map) {
    if (window.reliefLayer) {
        map.removeLayer(window.reliefLayer);
        window.reliefLayer = null;
    }

    const bounds = map.getBounds();
    const south = bounds.getSouth();
    const north = bounds.getNorth();
    const west = bounds.getWest();
    const east = bounds.getEast();

    const canvas = document.createElement('canvas');
    const size = 256;
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            const lat = south + (north - south) * (y / size);
            const lng = west + (east - west) * (x / size);
            const elev = estimateElevation(lat, lng);
            const h = ((elev - window.RELIEF.min) / (window.RELIEF.max - window.RELIEF.min)) * 360;
            ctx.fillStyle = `hsl(${h}, 70%, 70%)`;
            ctx.fillRect(x, y, 1, 1);
        }
    }

    const imageUrl = canvas.toDataURL();
    window.reliefLayer = L.imageOverlay(imageUrl, bounds, { opacity: 0.0 }).addTo(map);
}

// Экспортируем функции
document.addEventListener('DOMContentLoaded', () => {
    window.estimateElevation = estimateElevation;
    window.getRoadDensity = getRoadDensity;
    window.getCellDifficulty = getCellDifficulty;
    window.addReliefLayer = addReliefLayer;
    
    console.log('Модель рельефа инициализирована');
});