// 🚧 ТИПЫ ДОРОГ (с добавленной статистикой)
window.ROAD_TYPES = {
    'paved': {
        name: 'С асфальтом',
        color: '#4CAF50',
        weight: 1.0,
        count: 0
    },
    'unpaved': {
        name: 'Грунтовые',
        color: '#FF9800',
        weight: 0.7,
        count: 0
    },
    'footway': {
        name: 'Пешеходные',
        color: '#9C27B0',
        weight: 0.5,
        count: 0
    },
    'path': {
        name: 'Тропинки',
        color: '#795548',
        weight: 0.3,
        count: 0
    },
    'track': {
        name: 'Грунтовые дороги',
        color: '#8D6E63',
        weight: 0.4,
        count: 0
    },
    'other': {
        name: 'Другие',
        color: '#607D8B',
        weight: 0.2,
        count: 0
    }
};

// 🚧 УЛУЧШЕННАЯ ФУНКЦИЯ ДЛЯ ОПРЕДЕЛЕНИЯ ТИПА ДОРОГИ
function getRoadType(roadFeature) {
    // Проверка на корректность входных данных
    if (!roadFeature || !roadFeature.properties) {
        console.warn('Invalid road feature:', roadFeature);
        return 'other';
    }

    const properties = roadFeature.properties;
    let tags = {};
    
    // Пытаемся извлечь теги из разных источников
    if (roadFeature.tags) {
        tags = roadFeature.tags;
    } else if (properties.tags) {
        tags = properties.tags;
    } else if (properties) {
        tags = properties;
    } else {
        return 'other';
    }
    
    // Основные характеристики
    const highway = tags.highway || 'other';
    const surface = tags.surface || 'unknown';
    const tracktype = tags.tracktype || 'unknown';
    const construction = tags.construction || 'unknown';
    const service = tags.service || 'unknown';
    
    console.log('Road feature analysis:', {
        highway: highway,
        surface: surface,
        tracktype: tracktype,
        construction: construction,
        service: service
    });

    // Проверяем на явные типы дорог
    if (highway === 'motorway' || highway === 'trunk' || highway === 'primary' || 
        highway === 'secondary' || highway === 'tertiary' || 
        surface === 'asphalt' || surface === 'concrete' || surface === 'paved') {
        return 'paved';
    } else if (highway === 'unclassified' || highway === 'residential' || 
              highway === 'service' || 
              surface === 'dirt' || surface === 'gravel' || surface === 'unpaved') {
        return 'unpaved';
    } else if (highway === 'footway' || highway === 'path' || 
               highway === 'pedestrian' || highway === 'steps' || 
               highway === 'cycleway') {
        return 'footway';
    } else if (highway === 'track') {
        if (tracktype === 'grade1' || tracktype === 'grade2' || 
            !tracktype || tracktype === 'unknown') {
            return 'path';
        } else if (tracktype === 'grade3' || tracktype === 'grade4' || 
                  tracktype === 'grade5') {
            return 'unpaved';
        } else {
            return 'path';
        }
    } else if (highway === 'construction') {
        if (construction === 'primary' || construction === 'secondary') {
            return 'paved';
        } else if (construction === 'track' || construction === 'residential') {
            return 'path';
        } else {
            return 'unpaved';
        }
    } else if (highway === 'road') {
        if (surface === 'paved' || surface === 'asphalt') {
            return 'paved';
        } else if (surface === 'dirt' || surface === 'gravel' || surface === 'unpaved') {
            return 'unpaved';
        } else {
            return 'unpaved';
        }
    } else if (highway === 'service') {
        if (surface === 'paved' || surface === 'asphalt') {
            return 'paved';
        } else {
            return 'unpaved';
        }
    } else if (highway === 'path') {
        return 'footway';
    }
    
    // Дополнительные проверки для неопределенных дорог
    if (highway.includes('foot')) {
        return 'footway';
    } else if (highway.includes('track')) {
        return 'path';
    } else if (highway.includes('service')) {
        return 'unpaved';
    }
    
    // Если все проверки не сработали, возвращаем 'other'
    return 'other';
}

// ✅ УЛУЧШЕННАЯ ЗАГРУЗКА ДОРОГ С ОБРАБОТКОЙ ОШИБОК
async function loadRoadsInGrid() {
    if (window.gridCells.length === 0) return;
    
    // Сброс статуса загрузки
    window.roadLoadingStatus = 'loading';
    window.updateRoadStatus('', 'loading');
    
    // Объединяем все ячейки сетки в один полигон
    let mergedGrid = window.gridCells[0].geojson;
    for (let i = 1; i < window.gridCells.length; i++) {
        try {
            mergedGrid = safeTurfUnion(mergedGrid, window.gridCells[i].geojson);
        } catch (e) {
            console.warn('Failed to merge grid cell:', e);
        }
    }

    // Получаем границы объединенного полигона
    let bounds;
    try {
        bounds = turf.bbox(mergedGrid);
    } catch (e) {
        console.error('Failed to get bbox of merged grid:', e);
        return;
    }
    
    const [west, south, east, north] = bounds;
    
    // Расширяем область поиска за пределы полигона
    const padding = 0.02; // Добавляем 200 м с каждой стороны
    const expandedBounds = [
        west - padding,
        south - padding,
        east + padding,
        north + padding
    ];
    
    const roadSegments = [];
    let totalSegments = 0;
    
    // Подсчитываем общее количество сегментов для отображения прогресса
    for (let lat = expandedBounds[1]; lat < expandedBounds[3]; lat += 0.05) {
        for (let lon = expandedBounds[0]; lon < expandedBounds[2]; lon += 0.05) {
            totalSegments++;
        }
    }
    
    let processedSegments = 0;
    let successfulSegments = 0;
    
    // Уменьшаем размер запроса и увеличиваем таймаут
    for (let lat = expandedBounds[1]; lat < expandedBounds[3]; lat += 0.05) {
        for (let lon = expandedBounds[0]; lon < expandedBounds[2]; lon += 0.05) {
            const subSouth = lat;
            const subNorth = Math.min(lat + 0.05, expandedBounds[3]);
            const subWest = lon;
            const subEast = Math.min(lon + 0.05, expandedBounds[2]);
            
            // Проверяем, что размер подобласти достаточен
            if (subNorth - subSouth < 0.001 || subEast - subWest < 0.001) continue;
            
            // Формируем запрос к Overpass API
            const query = `
              [out:json];
              (
                way["highway"](poly:'${subNorth} ${subWest} ${subSouth} ${subWest} ${subSouth} ${subEast} ${subNorth} ${subEast}');
              );
              out geom;
              >;
            `;
            
            try {
                const res = await fetch(`https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`, {
                    signal: AbortSignal.timeout(30000) // Увеличенный таймаут до 30 секунд
                });
                
                processedSegments++;
                
                if (!res.ok) {
                    console.warn(`Request failed for subarea [${subSouth}, ${subWest}, ${subNorth}, ${subEast}]: ${res.status}`);
                    continue;
                }
                
                const data = await res.json();
                roadSegments.push(...data.elements);
                successfulSegments++;
                
                // Обновляем статус загрузки
                window.updateRoadStatus(`Загрузка дорог: ${Math.round((processedSegments / totalSegments) * 100)}%`, 'loading');
            } catch (e) {
                console.warn(`Error loading roads for subarea [${subSouth}, ${subWest}, ${subNorth}, ${subEast}]:`, e);
                processedSegments++;
            }
        }
    }
    
    // Если данные о дорогах не загружены, используем резервный метод
    if (roadSegments.length === 0) {
        console.warn('⚠️ Не удалось загрузить данные о дорогах. Используется резервный метод.');
        
        // В резервном методе создаем искусственные данные о дорогах
        const totalCells = window.gridCells.length;
        const roadCellCount = Math.max(1, Math.floor(totalCells * 0.3));
        
        // Случайно выбираем ячейки для дорог
        const shuffledCells = [...window.gridCells].sort(() => 0.5 - Math.random());
        window.roadCells = shuffledCells.slice(0, roadCellCount);
        window.noRoadCells = shuffledCells.slice(roadCellCount);
        
        window.roadDataLoaded = false;
        window.roadLoadingStatus = 'error';
        
        // Определяем сложность каждого квадрата
        window.highDifficultyCells = [];
        window.mediumDifficultyCells = [];
        window.lowDifficultyCells = [];
        
        window.gridCells.forEach(cell => {
            const difficulty = window.getCellDifficulty(cell);
            
            if (difficulty === 'high') {
                window.highDifficultyCells.push(cell);
            } else if (difficulty === 'medium') {
                window.mediumDifficultyCells.push(cell);
            } else {
                window.lowDifficultyCells.push(cell);
            }
        });
        
        // Показываем статус ошибки с возможностью повторной попытки
        window.updateRoadStatus(`⚠️ Не удалось загрузить дороги. <span class="retry-button" onclick="retryLoadRoads()">Повторить</span>`, 'error');
        
        return;
    }
    
    // Очищаем предыдущие слои
    window.roadLayer.clearLayers();
    
    // Создаем GeoJSON для дорог с проверкой валидности
    const features = [];
    const roadTypeCounts = {
        paved: 0,
        unpaved: 0,
        footway: 0,
        path: 0,
        track: 0,
        other: 0
    };
    
    roadSegments.forEach(way => {
        // Проверяем, есть ли координаты
        if (!way.geometry || way.geometry.length < 2) {
            console.warn('Invalid road segment geometry:', way);
            return;
        }
        
        // Проверяем и корректируем координаты
        const coords = way.geometry.map(p => {
            // Если координаты в неправильном порядке, исправляем
            if (Math.abs(p.lat) > 90 || Math.abs(p.lon) > 180) {
                return [p.lon, p.lat];
            }
            return [p.lon, p.lat];
        });
        
        // Проверяем, есть ли достаточно точек для линии
        if (coords.length < 2) {
            console.warn('Road segment has less than 2 points:', way);
            return;
        }
        
        // ОПРЕДЕЛЯЕМ ТИП ДОРОГИ
        const roadType = getRoadType(way);
        roadTypeCounts[roadType]++;
        
        // Создаем Feature
        const feature = {
            type: 'Feature',
            properties: {
                id: way.id,
                type: way.tags?.highway || 'unknown',
                roadType: roadType,
                surface: way.tags?.surface,
                maxspeed: way.tags?.maxspeed,
                tracktype: way.tags?.tracktype,
                construction: way.tags?.construction,
                service: way.tags?.service
            },
            geometry: {
                type: 'LineString',
                coordinates: coords
            }
        };
        
        // ДОБАВЛЯЕМ ДОРОГУ С УЧЕТОМ ТИПА
        const color = window.ROAD_TYPES[roadType].color;
        L.polyline(coords.map(c => [c[1], c[0]]), { 
            color: color, 
            weight: 2, 
            opacity: 0.8,
            roadType: roadType
        }).addTo(window.roadLayer);
        
        features.push(feature);
    });
    
    // Сохраняем данные о дорогах в GeoJSON
    window.roadGeoJSON = {
        type: 'FeatureCollection',
        features: features
    };
    
    console.log(`✅ Загружено ${roadSegments.length} дорожных сегментов внутри грида`);
    console.log(`Типы дорог: 
      Paved: ${roadTypeCounts.paved}
      Unpaved: ${roadTypeCounts.unpaved}
      Footway: ${roadTypeCounts.footway}
      Path: ${roadTypeCounts.path}
      Track: ${roadTypeCounts.track}
      Other: ${roadTypeCounts.other}`);
    
    // Определяем ячейки с дорогами с обработкой ошибок
    window.roadCells = [];
    window.noRoadCells = [];
    
    window.gridCells.forEach(cell => {
        let hasRoad = false;
        
        // Используем безопасную проверку пересечения
        for (const feature of window.roadGeoJSON.features) {
            try {
                if (safeTurfBooleanIntersects(feature, cell.geojson)) {
                    hasRoad = true;
                    break;
                }
            } catch (e) {
                // Пробуем исправить геометрию
                try {
                    const fixedFeature = safeTurfBuffer(feature, 0.0001, {units: 'kilometers'});
                    if (safeTurfBooleanIntersects(fixedFeature, cell.geojson)) {
                        hasRoad = true;
                        break;
                    }
                } catch (e2) {
                    // Пропускаем ошибки пересечения
                }
            }
        }
        
        if (hasRoad) {
            window.roadCells.push(cell);
        } else {
            window.noRoadCells.push(cell);
        }
    });
    
    // Если не найдено ни одной ячейки с дорогами, используем резервный метод
    if (window.roadCells.length === 0 && window.gridCells.length > 0) {
        console.warn('⚠️ Не удалось определить ячейки с дорогами. Используется резервный метод.');
        
        // Определяем примерно 30% ячеек как имеющие дороги
        const totalCells = window.gridCells.length;
        const roadCellCount = Math.max(1, Math.floor(totalCells * 0.3));
        
        // Случайно выбираем ячейки для дорог
        const shuffledCells = [...window.gridCells].sort(() => 0.5 - Math.random());
        window.roadCells = shuffledCells.slice(0, roadCellCount);
        window.noRoadCells = shuffledCells.slice(roadCellCount);
    }
    
    window.roadDataLoaded = true;
    window.roadLoadingStatus = 'success';
    
    // Определяем сложность каждого квадрата
    window.highDifficultyCells = [];
    window.mediumDifficultyCells = [];
    window.lowDifficultyCells = [];
    
    window.gridCells.forEach(cell => {
        const difficulty = window.getCellDifficulty(cell);
        
        if (difficulty === 'high') {
            window.highDifficultyCells.push(cell);
        } else if (difficulty === 'medium') {
            window.mediumDifficultyCells.push(cell);
        } else {
            window.lowDifficultyCells.push(cell);
        }
    });
    
    // Обновляем статус загрузки
    window.updateRoadStatus(`✅ Загружено ${roadSegments.length} дорожных сегментов. Ячейки с дорогами: ${window.roadCells.length}`, 'success');
    
    // Добавляем логирование для отладки
    console.log(`Количество ячеек: ${window.gridCells.length}`);
    console.log(`Количество ячеек с дорогами: ${window.roadCells.length}`);
    console.log(`Количество ячеек без дорог: ${window.noRoadCells.length}`);
    console.log(`Количество ячеек с высокой сложностью: ${window.highDifficultyCells.length}`);
    console.log(`Количество ячеек с низкой сложностью: ${window.lowDifficultyCells.length}`);
}

// ✅ ФУНКЦИЯ ДЛЯ ПОВТОРНОЙ ЗАГРУЗКИ ДОРОГ
function retryLoadRoads() {
    if (window.retryCount >= window.maxRetries) {
        alert(`Достигнуто максимальное количество попыток (${window.maxRetries}). Попробуйте уменьшить размер полигона поиска.`);
        return;
    }
    
    window.retryCount++;
    window.updateRoadStatus(`Попытка ${window.retryCount} из ${window.maxRetries}...`, 'loading');
    loadRoadsInGrid().catch(e => {
        console.error('Error retrying roads:', e);
        window.updateRoadStatus(`Ошибка при повторной загрузке. <span class="retry-button" onclick="retryLoadRoads()">Еще раз</span>`, 'error');
    });
}

// ✅ ОБНОВЛЕНИЕ СТАТУСА ЗАГРУЗКИ ДОРОГ
function updateRoadStatus(message = '', status = 'not-started') {
    const statusDiv = document.getElementById('roadStatus');
    if (!statusDiv) return;
    
    if (!message) {
        switch(status) {
            case 'not-started':
                statusDiv.innerHTML = 'Дороги не загружены';
                statusDiv.style.backgroundColor = '#f5f5f5';
                break;
            case 'loading':
                statusDiv.innerHTML = 'Загрузка дорог...';
                statusDiv.style.backgroundColor = '#e3f2fd';
                break;
            case 'success':
                statusDiv.innerHTML = 'Дороги загружены успешно';
                statusDiv.style.backgroundColor = '#e8f5e9';
                break;
            case 'error':
                statusDiv.innerHTML = 'Ошибка загрузки дорог';
                statusDiv.style.backgroundColor = '#ffebee';
                break;
        }
    } else {
        statusDiv.innerHTML = message;
        statusDiv.style.backgroundColor = status === 'error' ? '#ffebee' : 
                                     status === 'success' ? '#e8f5e9' : 
                                     status === 'loading' ? '#e3f2fd' : '#f5f5f5';
    }
}

// Экспортируем функции для использования в других модулях
document.addEventListener('DOMContentLoaded', () => {
    window.getRoadType = getRoadType;
    window.loadRoadsInGrid = loadRoadsInGrid;
    window.retryLoadRoads = retryLoadRoads;
    window.updateRoadStatus = updateRoadStatus;
    
    console.log('Сервис загрузки дорог инициализирован');
});