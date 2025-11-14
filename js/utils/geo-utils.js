// 🌄 ФУНКЦИИ РЕЛЬЕФА И ГЕОГРАФИЧЕСКИЕ УТИЛИТЫ

// Убедимся, что RELIEF определен только один раз
if (typeof window.RELIEF === 'undefined') {
    window.RELIEF = {
        min: 163,   // м
        max: 202,
        avg: 187
    };
}

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

        const elev = estimateElevation(lat, lng);
        totalElev += elev;
        minElev = Math.min(minElev, elev);
        maxElev = Math.max(maxElev, elev);
    }

    alert(`📊 Высоты в зоне:\nСредняя: ${Math.round(totalElev / points)} м\nМин: ${Math.round(minElev)} м\nМакс: ${Math.round(maxElev)} м`);
}

// 🌐 ГЕОГРАФИЧЕСКИЕ УТИЛИТЫ
function convertLatLngToMeters(lat, lng) {
    // Приблизительный расчет расстояния в метрах
    const metersPerDegLat = 111132.92 - 559.82 * Math.cos(2 * lat * Math.PI/180) + 1.175 * Math.cos(4 * lat * Math.PI/180);
    const metersPerDegLon = 111412.84 * Math.cos(lat * Math.PI/180) - 93.5 * Math.cos(3 * lat * Math.PI/180);
    
    return {
        metersPerDegLat: metersPerDegLat,
        metersPerDegLon: metersPerDegLon
    };
}

function calculateDistance(point1, point2) {
    // Расчет расстояния между двумя точками в метрах
    const [lng1, lat1] = point1;
    const [lng2, lat2] = point2;
    
    const R = 6371e3; // Радиус Земли в метрах
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lng2 - lng1) * Math.PI / 180;
    
    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    
    return R * c; // Расстояние в метрах
}

function getBearing(start, end) {
    // Вычисление азимута между двумя точками
    const [startLng, startLat] = start;
    const [endLng, endLat] = end;
    
    const φ1 = startLat * Math.PI / 180;
    const φ2 = endLat * Math.PI / 180;
    const Δλ = (endLng - startLng) * Math.PI / 180;
    
    const y = Math.sin(Δλ) * Math.cos(φ2);
    const x = Math.cos(φ1) * Math.sin(φ2) -
              Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
    const θ = Math.atan2(y, x);
    
    return (θ * 180 / Math.PI + 360) % 360; // Возвращаем азимут в градусах
}

function pointInZone(point, zone) {
    // Проверка, находится ли точка внутри зоны
    const pointFeature = turf.point(point);
    return turf.booleanPointInPolygon(pointFeature, zone);
}

// 🌐 ПОМОЩНИКИ ДЛЯ РАБОТЫ С КООРДИНАТАМИ
function isValidLatLng(lat, lng) {
    // Проверка валидности координат
    return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

function normalizeLatLng(lat, lng) {
    // Нормализация координат
    let normalizedLat = ((lat + 90) % 180 + 180) % 180 - 90;
    let normalizedLng = ((lng + 180) % 360 + 360) % 360 - 180;
    
    return [normalizedLat, normalizedLng];
}

function getCenterOfPolygon(polygon) {
    // Получение центра полигона
    if (!polygon || !polygon.geometry || !polygon.geometry.coordinates) {
        return null;
    }
    
    try {
        return turf.center(polygon).geometry.coordinates;
    } catch (e) {
        // Если не получается определить центр, используем среднее значение координат
        let sumLat = 0;
        let sumLng = 0;
        let count = 0;
        
        function traverse(coords) {
            if (coords.length > 0 && typeof coords[0] === 'number') {
                sumLng += coords[0];
                sumLat += coords[1];
                count++;
            } else if (Array.isArray(coords)) {
                coords.forEach(traverse);
            }
        }
        
        traverse(polygon.geometry.coordinates);
        
        return count > 0 ? [sumLng / count, sumLat / count] : null;
    }
}

function getPolygonArea(polygon) {
    // Получение площади полигона в квадратных метрах
    if (!polygon) return 0;
    
    try {
        return turf.area(polygon);
    } catch (e) {
        console.error('Error calculating polygon area:', e);
        return 0;
    }
}

// Экспортируем функции
document.addEventListener('DOMContentLoaded', () => {
    window.estimateElevation = estimateElevation;
    window.getRoadDensity = getRoadDensity;
    window.getCellDifficulty = getCellDifficulty;
    window.addReliefLayer = addReliefLayer;
    window.showReliefStats = showReliefStats;
    window.convertLatLngToMeters = convertLatLngToMeters;
    window.calculateDistance = calculateDistance;
    window.getBearing = getBearing;
    window.pointInZone = pointInZone;
    window.isValidLatLng = isValidLatLng;
    window.normalizeLatLng = normalizeLatLng;
    window.getCenterOfPolygon = getCenterOfPolygon;
    window.getPolygonArea = getPolygonArea;
    
    console.log('Географические утилиты инициализированы');
});
