// 🚗 СЕРВИС ПОСТРОЕНИЯ МАРШРУТОВ

// ✅ ФУНКЦИЯ ГЕНЕРАЦИИ МАРШРУТОВ
function generateRoutes() {
    if (window.roadLoadingStatus !== 'success') {
        alert('⚠️ Невозможно сгенерировать маршруты: данные о дорогах не загружены.\n\nДождитесь загрузки дорожной сети.');
        return;
    }
    
    window.routeLayers.clearLayers();
    
    const stepPesh = parseFloat(document.getElementById('stepPesh').value) || 10;
    const stepBla = parseFloat(document.getElementById('stepBla').value) || 50;
    const blaSpeed = 10;
    const blaTimeMax = 25 * 60;

    window.groups.forEach(g => {
        if (g.cells.length === 0) return;

        let merged = g.cells[0].geojson;
        for (let j = 1; j < g.cells.length; j++) {
            try {
                merged = safeTurfUnion(merged, g.cells[j].geojson);
            } catch (e) {
                console.error('Failed to merge cell:', e);
            }
        }

        // Для групп с автомобилями строим маршруты по дорогам
        if (g.cars > 0) {
            generateRouteByRoads(g, merged);
        } 
        // Для пеших групп и БЛА используем спиральный алгоритм
        else {
            generateSpiralRoute(g, merged, g.bla ? stepBla : stepPesh, g.bla);
        }
    });
    
    const forceResize = () => setTimeout(() => window.map.invalidateSize({ pan: true, animate: true }), 50);
    forceResize();
}

// ✅ ГЕНЕРАЦИЯ МАРШРУТА ПО ДОРОГАМ
function generateRouteByRoads(group, zoneGeoJSON) {
    const intersectingLines = [];
    
    // Проверяем, является ли зона валидным полигоном
    let validZoneGeoJSON = zoneGeoJSON;
    try {
        if (validZoneGeoJSON.geometry.type !== 'Polygon' && validZoneGeoJSON.geometry.type !== 'MultiPolygon') {
            // Пытаемся исправить геометрию
            validZoneGeoJSON = safeTurfBuffer(validZoneGeoJSON, 0.0001, {units: 'kilometers'});
        }
    } catch (e) {
        console.error('Failed to validate zone geometry:', e);
        return;
    }

    window.roadLayer.eachLayer(layer => {
        if (!(layer instanceof L.Polyline)) return;
        
        const roadLine = layer.toGeoJSON();
        try {
            // Преобразуем линию в формат, подходящий для Turf
            if (roadLine.geometry.type === 'LineString') {
                // Проверяем и исправляем порядок координат
                const validCoordinates = roadLine.geometry.coordinates.map(coord => {
                    // Если координаты [lat, lng], меняем на [lng, lat]
                    if (coord.length === 2 && Math.abs(coord[0]) > 90 && Math.abs(coord[1]) <= 90) {
                        return [coord[1], coord[0]];
                    }
                    return coord;
                });
                
                const validLine = {
                    type: 'Feature',
                    properties: roadLine.properties,
                    geometry: {
                        type: 'LineString',
                        coordinates: validCoordinates
                    }
                };
                
                // Проверяем валидность геометрии
                let validIntersection = null;
                try {
                    validIntersection = safeTurfIntersect(validLine, validZoneGeoJSON);
                } catch (e) {
                    try {
                        // Пытаемся исправить геометрию зоны
                        const fixedZone = safeTurfBuffer(validZoneGeoJSON, 0.0001, {units: 'kilometers'});
                        validIntersection = safeTurfIntersect(validLine, fixedZone);
                    } catch (e2) {
                        console.error('Failed to fix zone geometry:', e2);
                    }
                }
                
                if (validIntersection) {
                    // Возвращаем координаты в исходный порядок [lat, lng] для отображения
                    if (validIntersection.geometry.type === 'LineString') {
                        validIntersection.geometry.coordinates = validIntersection.geometry.coordinates.map(coord => [coord[1], coord[0]]);
                    }
                    intersectingLines.push(validIntersection);
                }
            }
        } catch (e) {
            console.error('Error in route generation:', e);
        }
    });

    if (intersectingLines.length === 0) return;

    let combined = intersectingLines[0];
    for (let i = 1; i < intersectingLines.length; i++) {
        try {
            combined = safeTurfUnion(combined, intersectingLines[i]);
        } catch (e) {
            console.error('Failed to combine routes:', e);
        }
    }

    if (combined?.geometry?.type === 'LineString') {
        L.polyline(combined.geometry.coordinates.map(c => [c[1], c[0]]), {
            color: group.color,
            weight: 3,
            dashArray: '5, 5'
        }).addTo(window.routeLayers);
    }
}

// ✅ ГЕНЕРАЦИЯ СПИРАЛЬНОГО МАРШРУТА (ДЛЯ ПЕШИХ ГРУПП И БЛА)
function generateSpiralRoute(group, zoneGeoJSON, step, isBla) {
    try {
        const bbox = turf.bbox(zoneGeoJSON);
        const center = turf.center(zoneGeoJSON);
        
        // Вычисляем радиус зоны
        const radius = Math.sqrt(turf.area(zoneGeoJSON) / Math.PI) / 1000; // в км
        
        // Генерируем спиральный маршрут
        const points = [];
        const steps = Math.ceil(radius / step);
        
        for (let i = 0; i <= steps; i++) {
            const r = i * step / 1000; // радиус в км
            const angle = i * 0.5 * Math.PI;
            const lat = center.geometry.coordinates[1] + (r * Math.cos(angle)) / 111;
            const lng = center.geometry.coordinates[0] + (r * Math.sin(angle)) / (111 * Math.cos(center.geometry.coordinates[1] * Math.PI / 180));
            
            points.push([lng, lat]);
        }
        
        // Ограничиваем маршрут зоной
        const routeLine = turf.lineString(points);
        const clippedRoute = turf.lineIntersect(routeLine, zoneGeoJSON);
        
        // Отображаем маршрут
        if (clippedRoute.features.length > 0) {
            const coords = clippedRoute.features[0].geometry.coordinates;
            L.polyline(coords.map(c => [c[1], c[0]]), {
                color: group.color,
                weight: 3,
                dashArray: '5, 5'
            }).addTo(window.routeLayers);
        }
    } catch (e) {
        console.error('Error generating spiral route:', e);
    }
}

// ✅ ИСПРАВЛЕНИЕ ОШИБКИ В ПОСТРОЕНИИ МАРШРУТОВ
function fixRouteGeneration() {
    if (window.roadLoadingStatus === 'success') {
        generateRoutes();
    } else {
        console.log('Cannot generate routes: road data is not loaded');
    }
}

// Экспортируем функции
document.addEventListener('DOMContentLoaded', () => {
    window.generateRoutes = generateRoutes;
    window.generateRouteByRoads = generateRouteByRoads;
    window.generateSpiralRoute = generateSpiralRoute;
    window.fixRouteGeneration = fixRouteGeneration;
    
    console.log('Сервис построения маршрутов инициализирован');
});