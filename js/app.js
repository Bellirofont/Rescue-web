// ✅ ИСПРАВЛЕННАЯ ФУНКЦИЯ ДЛЯ ДОБАВЛЕНИЯ ГРУППЫ
function addGroup() {
    const base = document.getElementById('baseCall').value.trim() || 'Group';
    let maxNum = 0;
    window.groups.forEach(g => {
        if (g.callsign.startsWith(base + '-')) {
            const n = parseInt(g.callsign.split('-')[1]);
            if (n > maxNum) maxNum = n;
        }
    });
    let num = document.getElementById('startNum').value ? parseInt(document.getElementById('startNum').value) : maxNum + 1;
    if (isNaN(num) || num < 1) num = maxNum + 1;
    const callsign = `${base}-${num.toString().padStart(2,'0')}`;
    const people = parseInt(document.getElementById('people').value) || 0;
    const cars = parseInt(document.getElementById('cars').value) || 0;
    const bla = parseInt(document.getElementById('blaNum').value) || 0;

    // Проверка на дублирование позывного
    if (window.groups.some(g => g.callsign === callsign)) {
        alert('Группа с таким позывным уже существует!');
        return;
    }

    window.groups.push({
        callsign: callsign,
        people: people,
        cars: cars,
        bla: bla,
        color: window.colors[window.groups.length % window.colors.length],
        cells: [],
        area: 0,
        zoneType: '',
        difficulty: '',
        efficiency: 0
    });
    window.updateGroupsTable();
    
    // Автоматическое перераспределение зон при добавлении группы
    if (window.gridCells.length > 0) {
        setTimeout(window.assignZones, 100);
    }
}

// ✅ ИСПРАВЛЕННАЯ ФУНКЦИЯ РЕДАКТИРОВАНИЯ ГРУППЫ
function updateGroup() {
    if (!window.currentGroup) return;

    const base = document.getElementById('baseCall').value.trim() || 'Group';
    const num = document.getElementById('startNum').value ? parseInt(document.getElementById('startNum').value) : window.currentGroup.callsign.split('-')[1];
    const callsign = `${base}-${num.toString().padStart(2,'0')}`;
    const people = parseInt(document.getElementById('people').value) || 0;
    const cars = parseInt(document.getElementById('cars').value) || 0;
    const bla = parseInt(document.getElementById('blaNum').value) || 0;

    // Проверка на дублирование позывного
    if (window.groups.some(g => g.callsign === callsign && g !== window.currentGroup)) {
        alert('Группа с таким позывным уже существует!');
        return;
    }

    window.currentGroup.callsign = callsign;
    window.currentGroup.people = people;
    window.currentGroup.cars = cars;
    window.currentGroup.bla = bla;
    
    // Сбрасываем редактирование
    window.currentGroup = null;
    document.getElementById('addGroupButton').style.display = 'block';
    document.getElementById('updateGroupButton').style.display = 'none';
    document.getElementById('cancelGroupButton').style.display = 'none';
    
    window.updateGroupsTable();
    if (window.gridCells.length > 0) {
        setTimeout(window.assignZones, 100);
    }
}

function cancelGroupEdit() {
    window.currentGroup = null;
    document.getElementById('addGroupButton').style.display = 'block';
    document.getElementById('updateGroupButton').style.display = 'none';
    document.getElementById('cancelGroupButton').style.display = 'none';
}

function editGroup(callsign) {
    const group = window.groups.find(g => g.callsign === callsign);
    if (!group) return;

    window.currentGroup = group;
    
    document.getElementById('baseCall').value = group.callsign.split('-')[0];
    document.getElementById('startNum').value = group.callsign.split('-')[1];
    document.getElementById('people').value = group.people;
    document.getElementById('cars').value = group.cars;
    document.getElementById('blaNum').value = group.bla;
    
    document.getElementById('addGroupButton').style.display = 'none';
    document.getElementById('updateGroupButton').style.display = 'block';
    document.getElementById('cancelGroupButton').style.display = 'block';
}

function deleteGroup(callsign) {
    if (!confirm(`Удалить группу "${callsign}"?`)) return;
    
    window.groups = window.groups.filter(g => g.callsign !== callsign);
    window.updateGroupsTable();
    if (window.gridCells.length > 0) {
        setTimeout(window.assignZones, 100);
    }
}

// ✅ ИСПРАВЛЕННАЯ ФУНКЦИЯ ДЛЯ РИСОВАНИЯ ПОЛИГОНА
function startDrawing() {
    if (window.drawHandler) {
        window.drawHandler.disable();
        window.drawHandler = null;
        window.map.getContainer().style.cursor = '';
        alert('❌ Рисование отменено.');
        return;
    }

    window.map.off(L.Draw.Event.CREATED, onDrawCreated);

    window.drawHandler = new L.Draw.Polygon(window.map, {
        allowIntersection: false,
        shapeOptions: {
            color: '#3388ff',
            weight: 4,
            opacity: 1,
            fillOpacity: 0.2
        }
    });

    window.drawHandler.enable();
    window.map.getContainer().style.cursor = 'crosshair';
    alert('👉 Кликайте точки. Двойной клик — завершить полигон.');

    window.map.on(L.Draw.Event.CREATED, onDrawCreated);
}

function onDrawCreated(e) {
    if (e.layerType !== 'polygon') return;

    if (window.searchPolygon) {
        window.drawnItems.removeLayer(window.searchPolygon);
    }

    window.searchPolygon = e.layer;
    window.drawnItems.addLayer(window.searchPolygon);

    try {
        window.searchFeature = window.searchPolygon.toGeoJSON();
    } catch (err) {
        console.error('Failed to convert to GeoJSON:', err);
        alert('Ошибка при создании полигона.');
        return;
    }

    document.getElementById('gridControls').style.display = 'block';
    window.addReliefLayer(window.map);
    window.showReliefStats();
    
    const forceResize = () => setTimeout(() => window.map.invalidateSize({ pan: true, animate: true }), 50);
    forceResize();

    if (window.drawHandler) {
        window.drawHandler.disable();
        window.drawHandler = null;
    }

    window.map.getContainer().style.cursor = '';
    alert('✅ Полигон создан. Нажмите "Нанести сетку".');
}

function clearMap() {
    if (!confirm('Очистить карту?')) return;
    window.drawnItems.clearLayers();
    window.gridLayer.clearLayers();
    window.zoneLayers.clearLayers();
    window.routeLayers.clearLayers();
    window.roadLayer.clearLayers();
    window.importedKmlLayer.clearLayers();
    if (window.reliefLayer) window.map.removeLayer(window.reliefLayer);
    window.gridCells = [];
    window.roadCells = [];
    window.noRoadCells = [];
    window.highDifficultyCells = [];
    window.mediumDifficultyCells = [];
    window.lowDifficultyCells = [];
    window.groups = [];
    window.searchPolygon = null;
    window.searchFeature = null;
    window.roadDataLoaded = false;
    window.roadGeoJSON = null;
    window.roadLoadingStatus = 'not-started';
    document.getElementById('gridControls').style.display = 'none';
    document.getElementById('roadStatus').innerHTML = '';
    window.retryCount = 0;
    window.updateGroupsTable();
    
    const forceResize = () => setTimeout(() => window.map.invalidateSize({ pan: true, animate: true }), 50);
    forceResize();
}

// ✅ ИСПРАВЛЕНАЯ ФУНКЦИЯ ГЕНЕРАЦИИ МАРШРУТОВ
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

        if (g.cars > 0) {
            generateRouteByRoads(g, merged);
            return;
        }

        const bbox = turf.bbox(merged);
        const avgLat = (bbox[1] + bbox[3]) / 2;
        const metersPerDegLat = 111132.92 - 559.82 * Math.cos(2 * avgLat * Math.PI/180) + 1.175 * Math.cos(4 * avgLat * Math.PI/180);
        const stepDeg = (g.bla ? stepBla : stepPesh) / metersPerDegLat;

        let paths = [];
        let direction = 1;
        for (let lat = bbox[1]; lat <= bbox[3]; lat += stepDeg) {
            const line = turf.lineString([[bbox[0], lat], [bbox[2], lat]]);
            const clipped = turf.lineIntersect(line, merged);
            if (clipped.features.length > 0) {
                let coords = clipped.features[0].geometry.coordinates;
                if (direction === -1) coords = coords.reverse();
                paths.push(coords);
                direction = -direction;
            }
        }

        if (paths.length === 0) return;

        let fullPath = paths[0];
        for (let i = 1; i < paths.length; i++) {
            try {
                fullPath = fullPath.concat(paths[i]);
            } catch (e) {
                console.error('Failed to concatenate path:', e);
            }
        }

        const length = turf.length(turf.lineString(fullPath), {units: 'meters'});
        if (g.bla && length / blaSpeed > blaTimeMax) return;

        L.polyline(fullPath.map(c => [c[1], c[0]]), {
            color: g.color,
            weight: 3,
            dashArray: '5, 5'
        }).addTo(window.routeLayers);
    });
    
    const forceResize = () => setTimeout(() => window.map.invalidateSize({ pan: true, animate: true }), 50);
    forceResize();
}

// ✅ ИСПРАВЛЕНАЯ ФУНКЦИЯ ДЛЯ МАРШРУТОВ ПО ДОРОГАМ
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

// ✅ ИСПРАВЛЕННЫЙ ЭКСПОРТ В KML
function exportKML() {
    try {
        // Создаем временный слой KML
        const kml = new L.KML();
        
        // Добавляем все слои в KML
        [window.drawnItems, window.gridLayer, window.zoneLayers, window.routeLayers, window.roadLayer].forEach(layerGroup => {
            layerGroup.eachLayer(layer => {
                try {
                    // Проверяем, является ли слой полигоном или линией
                    if (layer instanceof L.Polygon || layer instanceof L.Polyline || layer instanceof L.Marker) {
                        kml.addLayer(layer);
                    }
                } catch (e) {
                    console.warn('Failed to add layer to KML:', e);
                }
            });
        });
        
        // Получаем KML
        let kmlContent;
        try {
            kmlContent = kml.getKML();
        } catch (e) {
            // Если getKML() не работает, используем прямой метод
            kmlContent = kml._kml;
        }
        
        // Проверяем, что содержимое KML не пустое
        if (!kmlContent || kmlContent.trim() === '') {
            console.error('Generated KML is empty');
            alert('Ошибка: Сгенерированный KML пустой. Проверьте, что на карте есть данные для экспорта.');
            return;
        }
        
        // Создаем и скачиваем файл
        const blob = new Blob([kmlContent], { type: 'application/vnd.google-earth.kml+xml' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'pso_plan.kml';
        a.click();
        
        console.log('KML успешно экспортирован');
    } catch (e) {
        console.error('Error exporting KML:', e);
        alert('Ошибка при экспорте KML: ' + e.message);
    }
}

// ✅ ИМПОРТ KML/KMZ ФАЙЛОВ
function importKML(file) {
    if (!file) return;
    
    const fileName = file.name.toLowerCase();
    const fileType = fileName.endsWith('.kmz') ? 'kmz' : 'kml';
    
    const reader = new FileReader();
    
    reader.onload = function(e) {
        try {
            let kmlData;
            
            if (fileType === 'kmz') {
                // Обработка KMZ (ZIP-архив с KML внутри)
                JSZip.loadAsync(e.target.result).then(function(zip) {
                    // Ищем файл KML внутри архива
                    const kmlFile = Object.keys(zip.files).find(f => f.toLowerCase().endsWith('.kml'));
                    
                    if (!kmlFile) {
                        alert('В KMZ файле не найден KML файл');
                        return;
                    }
                    
                    zip.files[kmlFile].async('string').then(function(kmlContent) {
                        processKMLData(kmlContent);
                    }).catch(function(err) {
                        console.error('Error reading KML from KMZ:', err);
                        alert('Ошибка при чтении KML из KMZ: ' + err.message);
                    });
                }).catch(function(err) {
                    console.error('Error processing KMZ:', err);
                    alert('Ошибка при обработке KMZ файла: ' + err.message);
                });
            } else {
                // Прямая обработка KML
                processKMLData(e.target.result);
            }
        } catch (err) {
            console.error('Error importing KML:', err);
            alert('Ошибка при импорте KML: ' + err.message);
        }
    };
    
    reader.onerror = function(e) {
        console.error('FileReader error:', e);
        alert('Ошибка при чтении файла: ' + e.target.error);
    };
    
    reader.readAsArrayBuffer(file);
}

// ✅ ОБРАБОТКА KML ДАННЫХ
function processKMLData(kmlContent) {
    try {
        // Очищаем предыдущие импортированные данные
        window.importedKmlLayer.clearLayers();
        
        // Создаем и добавляем KML слой
        const kmlLayer = new L.KML(kmlContent, {
            async: true
        });
        
        kmlLayer.on('loaded', function(e) {
            // Добавляем слой на карту
            kmlLayer.addTo(window.importedKmlLayer);
            
            // Устанавливаем вид карты на импортированные данные
            if (kmlLayer.getBounds) {
                window.map.fitBounds(kmlLayer.getBounds());
            }
            
            console.log(`Импортировано ${e.target.featureCount} объектов из KML`);
            alert(`✅ Успешно импортировано ${e.target.featureCount} объектов из KML`);
        });
        
        kmlLayer.on('error', function(e) {
            console.error('KML parsing error:', e);
            alert('Ошибка при парсинге KML: ' + e.message);
        });
    } catch (err) {
        console.error('Error processing KML ', err);
        alert('Ошибка при обработке KML данных: ' + err.message);
    }
}

function exportGeoJSON() {
    const features = [window.searchFeature, ...window.gridCells.map(c => c.geojson)];
    
    // Добавляем данные о дорогах
    if (window.roadGeoJSON) {
        features.push(...window.roadGeoJSON.features);
    }
    
    window.groups.forEach(g => {
        if (g.cells.length > 0) {
            let merged = g.cells[0].geojson;
            for (let j = 1; j < g.cells.length; j++) {
                try {
                    merged = safeTurfUnion(merged, g.cells[j].geojson);
                } catch (e) {
                    console.error('Failed to merge cell for export:', e);
                }
            }
            merged.properties = { group: g.callsign, people: g.people, cars: g.cars, bla: g.bla, efficiency: g.efficiency };
            features.push(merged);
        }
    });
    const blob = new Blob([JSON.stringify({ type: "FeatureCollection", features })], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'pso_plan.geojson';
    a.click();
}

function saveProject() {
    const data = { 
        searchFeature: window.searchFeature, 
        gridCells: window.gridCells.map(c => c.geojson), 
        roadCells: window.roadCells.map(c => c.geojson),
        noRoadCells: window.noRoadCells.map(c => c.geojson),
        highDifficultyCells: window.highDifficultyCells.map(c => c.geojson),
        mediumDifficultyCells: window.mediumDifficultyCells.map(c => c.geojson),
        lowDifficultyCells: window.lowDifficultyCells.map(c => c.geojson),
        roadGeoJSON: window.roadGeoJSON, // Сохраняем данные о дорогах
        groups: window.groups 
    };
    localStorage.setItem('psoProject', JSON.stringify(data));
    alert('Проект сохранён!');
}

function loadProject() {
    const saved = localStorage.getItem('psoProject');
    if (!saved) return alert('Нет сохранённых данных.');
    if (confirm('Загрузить проект?')) {
        const data = JSON.parse(saved);
        window.clearMap();
        window.searchFeature = data.searchFeature;
        if (data.searchFeature) {
            window.searchPolygon = L.geoJSON(data.searchFeature).addTo(window.drawnItems);
            document.getElementById('gridControls').style.display = 'block';
            
            // Восстанавливаем ячейки с дорогами и без
            window.roadCells = data.roadCells ? data.roadCells.map(c => ({geojson: c})) : [];
            window.noRoadCells = data.noRoadCells ? data.noRoadCells.map(c => ({geojson: c})) : [];
            window.highDifficultyCells = data.highDifficultyCells ? data.highDifficultyCells.map(c => ({geojson: c})) : [];
            window.mediumDifficultyCells = data.mediumDifficultyCells ? data.mediumDifficultyCells.map(c => ({geojson: c})) : [];
            window.lowDifficultyCells = data.lowDifficultyCells ? data.lowDifficultyCells.map(c => ({geojson: c})) : [];
            window.roadGeoJSON = data.roadGeoJSON; // Восстанавливаем данные о дорогах
            
            // Устанавливаем флаг загрузки данных о дорогах
            window.roadDataLoaded = window.roadGeoJSON && window.roadGeoJSON.features && window.roadGeoJSON.features.length > 0;
            window.roadLoadingStatus = window.roadDataLoaded ? 'success' : 'not-started';
            
            if (window.roadDataLoaded) {
                window.updateRoadStatus(`Дороги загружены (сессия). Ячейки с дорогами: ${window.roadCells.length}`, 'success');
            } else {
                window.updateRoadStatus('Дороги не загружены', 'not-started');
            }
        }
        alert('Проект загружен. Перестройте грид.');
        
        const forceResize = () => setTimeout(() => window.map.invalidateSize({ pan: true, animate: true }), 50);
        forceResize();
    }
}

// Вспомогательная функция для изменения размера карты
function forceResize() {
    setTimeout(() => {
        if (window.map) window.map.invalidateSize({ pan: true, animate: true });
    }, 50);
}

// Экспортируем функции в глобальную область видимости
document.addEventListener('DOMContentLoaded', () => {
    window.startDrawing = startDrawing;
    window.clearMap = clearMap;
    window.saveProject = saveProject;
    window.loadProject = loadProject;
    window.addGroup = addGroup;
    window.updateGroup = updateGroup;
    window.cancelGroupEdit = cancelGroupEdit;
    window.editGroup = editGroup;
    window.deleteGroup = deleteGroup;
    window.assignZones = assignZones;
    window.generateRoutes = generateRoutes;
    window.exportGeoJSON = exportGeoJSON;
    window.exportKML = exportKML;
    window.importKML = importKML;
    window.processKMLData = processKMLData;
    
    console.log('Основные функции приложения инициализированы');
});