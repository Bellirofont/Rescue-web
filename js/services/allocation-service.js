// ✅ ПЕРЕРАБОТАННАЯ СИСТЕМА РАСЧЕТА МОЩНОСТИ ГРУПП
function calculateGroupPower(group, cellType, hasRoad, roadType) {
    let basePower = 0;
    const maxDailyArea = 100; // Максимальная площадь, которую может обработать группа за день
    
    // Пешие группы
    if (group.cars === 0 && group.bla === 0) {
        // 5 км²/час на человека в легкой местности
        basePower = group.people * 5;
        
        // Учет сложности местности
        if (cellType === 'high') basePower *= 0.3;
        else if (cellType === 'medium') basePower *= 0.7;
        
        // Пешие группы эффективнее в местности без дорог
        if (!hasRoad) basePower *= 1.2;
        
        // Учет типа дороги для пеших групп
        if (hasRoad) {
            const roadWeight = window.ROAD_TYPES[roadType]?.weight || 0.5;
            basePower *= roadWeight;
        }
        
        // КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ: Пешие группы должны работать везде
        basePower = Math.max(basePower, group.people * 0.5);
    }
    // Группы с авто
    else if (group.cars > 0) {
        // Оптимальное соотношение: 4-5 человек на авто
        const peoplePerCar = group.people / Math.max(1, group.cars);
        const carEfficiency = Math.min(1, peoplePerCar / 5);
        
        // 20 км²/час на авто в легкой местности с дорогами
        basePower = group.cars * 20 * carEfficiency;
        
        // Учет сложности местности и наличия дорог
        if (cellType === 'high') {
            basePower *= 0.2; // В сложной местности эффективность авто сильно падает
        } else if (cellType === 'medium') {
            basePower *= 0.6;
        } else {
            basePower *= 1.0;
        }
        
        // Авто НЕ могут работать без дорог
        if (!hasRoad) {
            basePower *= 0.1; // Сильно снижаем эффективность
        }
        
        // Учет качества дороги для авто
        if (hasRoad) {
            const roadWeight = window.ROAD_TYPES[roadType]?.weight || 0.5;
            basePower *= roadWeight;
        }
    }
    // Группы с БЛА
    else if (group.bla > 0) {
        // 50 км²/час на БЛА в легкой местности
        basePower = group.bla * 50;
        
        // Учет сложности местности
        if (cellType === 'high') basePower *= 0.8; // БЛА эффективны даже в сложной местности
        else if (cellType === 'medium') basePower *= 0.9;
        else basePower *= 1.0;
    }
    
    // Ограничение максимальной производительности
    return Math.min(basePower, maxDailyArea);
}

// ✅ КОРРЕКТНЫЙ РАСЧЕТ ЭФФЕКТИВНОСТИ ГРУППЫ
function calculateGroupEfficiency(group, cellType, hasRoad, roadType) {
    const dailyPower = calculateGroupPower(group, cellType, hasRoad, roadType);
    const dailyHours = 8; // Рабочий день 8 часов
    
    // Эффективность = км², которые группа может обработать за день
    return dailyPower * dailyHours;
}

// ✅ ОКОНЧАТЕЛЬНЫЙ АЛГОРИТМ РАСПРЕДЕЛЕНИЯ ЗОН (ГАРАНТИРУЕТ 100% РАСПРЕДЕЛЕНИЕ)
function assignZones() {
    console.log('=== НАЧАЛО ПРОЦЕССА РАСПРЕДЕЛЕНИЯ ЗОН ===');
    console.log(`Количество ячеек: ${window.gridCells.length}`);
    console.log(`Количество групп: ${window.groups.length}`);
    
    if (window.roadLoadingStatus === 'loading') {
        alert('Дождитесь завершения загрузки дорог.');
        return;
    }
    
    if (window.gridCells.length === 0) {
        console.log('Ошибка: Сетка не создана');
        return alert('Создайте грид!');
    }
    
    if (window.groups.length === 0) {
        console.log('Ошибка: Группы не добавлены');
        return alert('Добавьте группы!');
    }
    
    // Очистка предыдущих зон
    window.zoneLayers.clearLayers();
    
    // Сброс состояния всех групп
    window.groups.forEach(g => { 
        g.cells = []; 
        g.area = 0; 
        g.zoneType = ''; 
        g.difficulty = '';
        g.efficiency = 0;
        console.log(`Группа ${g.callsign} сброшена`);
    });

    // Шаг 0: Проверка наличия данных о дорогах и установка флагов
    const hasValidRoadData = window.roadDataLoaded && window.roadGeoJSON && window.roadGeoJSON.features && window.roadGeoJSON.features.length > 0;
    console.log(`Данные о дорогах загружены: ${hasValidRoadData ? 'ДА' : 'НЕТ'}`);
    
    // Шаг 1: Определяем сложность для каждой ячейки
    const cellDetails = window.gridCells.map(cell => {
        const difficulty = window.getCellDifficulty(cell);
        const hasRoad = hasValidRoadData ? window.roadCells.some(rc => rc === cell) : false;
        
        // Определяем тип дороги в ячейке
        let roadType = null;
        if (hasRoad && hasValidRoadData && window.roadGeoJSON) {
            for (const feature of window.roadGeoJSON.features) {
                try {
                    if (safeTurfBooleanIntersects(feature, cell.geojson)) {
                        roadType = feature.properties?.roadType || 'other';
                        break;
                    }
                } catch (e) {
                    // Пробуем исправить геометрию
                    try {
                        const fixedFeature = safeTurfBuffer(feature, 0.0001, {units: 'kilometers'});
                        if (safeTurfBooleanIntersects(fixedFeature, cell.geojson)) {
                            roadType = feature.properties?.roadType || 'other';
                            break;
                        }
                    } catch (e2) {
                        // Пропускаем ошибки пересечения
                    }
                }
            }
        }
        
        return {
            cell: cell,
            difficulty: difficulty,
            hasRoad: hasRoad,
            roadType: roadType,
            area: cell.area,
            assigned: false
        };
    });

    // Шаг 2: Рассчитываем общую трудоемкость всех ячеек
    let totalDifficulty = 0;
    const cellDifficulties = [];
    
    for (const cd of cellDetails) {
        // Коэффициент сложности в зависимости от типа местности
        const difficultyFactor = cd.difficulty === 'high' ? 3.0 : cd.difficulty === 'medium' ? 1.5 : 1.0;
        
        // Коэффициент для ячеек с дорогами (для пеших групп)
        const roadFactor = cd.hasRoad ? 0.7 : 1.0;
        
        // Общая трудоемкость ячейки
        const cellDifficulty = cd.area * difficultyFactor * roadFactor;
        
        cellDifficulties.push({
            cell: cd.cell,
            difficulty: cellDifficulty,
            difficultyType: cd.difficulty,
            hasRoad: cd.hasRoad,
            roadType: cd.roadType,
            assigned: false
        });
        
        totalDifficulty += cellDifficulty;
    }
    
    console.log(`Общая трудоемкость: ${totalDifficulty}`);
    
    // Сортируем ячейки по трудоемкости (от самых сложных к простым)
    cellDifficulties.sort((a, b) => b.difficulty - a.difficulty);
    
    // Шаг 3: Рассчитываем мощность каждой группы
    const groupPowers = window.groups.map(group => {
        // Рассчитываем эффективность группы для разных типов местности
        const efficiencyWithRoad = calculateGroupEfficiency(group, 'low', true, 'paved');
        const efficiencyWithoutRoad = calculateGroupEfficiency(group, 'low', false, null);
        
        return {
            group: group,
            efficiencyWithRoad: efficiencyWithRoad,
            efficiencyWithoutRoad: efficiencyWithoutRoad,
            assignedCells: [],
            assignedDifficulty: 0,
            cellsCount: 0 // Количество ячеек
        };
    });
    
    // Шаг 4: РАСПРЕДЕЛЯЕМ ВСЕ ЯЧЕЙКИ С ГАРАНТИЕЙ 100% РАСПРЕДЕЛЕНИЯ
    // Используем циклическое распределение, чтобы гарантировать равномерное распределение
    let groupIndex = 0;
    
    for (const cd of cellDifficulties) {
        // Выбираем группу по циклу
        const gp = groupPowers[groupIndex];
        
        // Добавляем ячейку к группе
        gp.assignedCells.push(cd);
        gp.assignedDifficulty += cd.difficulty;
        gp.cellsCount++;
        
        // Переходим к следующей группе (циклически)
        groupIndex = (groupIndex + 1) % groupPowers.length;
        
        console.log(`Ячейка добавлена группе ${gp.group.callsign}. Текущая трудоемкость: ${gp.assignedDifficulty}`);
    }
    
    // Шаг 5: Назначаем ячейки группам
    for (const gp of groupPowers) {
        gp.group.cells = gp.assignedCells.map(cd => cd.cell);
        gp.group.area = gp.assignedCells.reduce((sum, cd) => sum + cd.cell.area, 0);
        
        // Определяем, какая местность преобладает в зоне
        const roadCount = gp.group.cells.filter(cell => window.roadCells.some(rc => rc === cell)).length;
        const highDifficultyCount = gp.group.cells.filter(cell => window.getCellDifficulty(cell) === 'high').length;
        const mediumDifficultyCount = gp.group.cells.filter(cell => window.getCellDifficulty(cell) === 'medium').length;
        
        const hasRoad = roadCount > gp.group.cells.length / 2;
        const hasHighDifficulty = highDifficultyCount > gp.group.cells.length / 2;
        const hasMediumDifficulty = mediumDifficultyCount > gp.group.cells.length / 2;
        
        // Определяем тип зоны
        if (hasRoad && hasHighDifficulty) {
            gp.group.zoneType = 'road-high';
        } else if (hasRoad && hasMediumDifficulty) {
            gp.group.zoneType = 'road-medium';
        } else if (hasRoad) {
            gp.group.zoneType = 'road';
        } else if (hasHighDifficulty) {
            gp.group.zoneType = 'no-road-high';
        } else if (hasMediumDifficulty) {
            gp.group.zoneType = 'no-road-medium';
        } else {
            gp.group.zoneType = 'no-road';
        }
        
        // Определяем сложность
        if (hasHighDifficulty) {
            gp.group.difficulty = 'высокая';
        } else if (hasMediumDifficulty) {
            gp.group.difficulty = 'средняя';
        } else {
            gp.group.difficulty = 'низкая';
        }
        
        // Рассчитываем окончательную эффективность
        const hasRoadInZone = gp.group.cells.some(cell => window.roadCells.some(rc => rc === cell));
        const roadTypeInZone = hasRoadInZone ? 
            gp.group.cells.find(cell => window.roadCells.some(rc => rc === cell)).roadType : 
            null;
        gp.group.efficiency = calculateGroupEfficiency(
            gp.group, 
            gp.group.difficulty === 'высокая' ? 'high' : 
            gp.group.difficulty === 'средняя' ? 'medium' : 'low',
            hasRoadInZone,
            roadTypeInZone
        );
    }
    
    // Шаг 6: Отрисовка
    window.gridCells.forEach(cell => {
        window.groups.forEach(g => {
            if (g.cells.includes(cell)) {
                cell.layer.setStyle({fillColor: g.color, fillOpacity: 0.45, color: g.color, weight: 2, opacity: 0.9});
            }
        });
    });

    window.groups.forEach(g => {
        if (g.cells.length === 0) return;
        
        // Объединяем ячейки с обработкой ошибок
        let merged = null;
        for (const cell of g.cells) {
            try {
                if (merged === null) {
                    merged = cell.geojson;
                } else {
                    // Проверяем валидность геометрии перед объединением
                    if (safeTurfBooleanValid(merged) && safeTurfBooleanValid(cell.geojson)) {
                        merged = safeTurfUnion(merged, cell.geojson);
                    }
                }
            } catch (e) {
                console.warn('Failed to merge cell:', e);
            }
        }
        
        if (merged && safeTurfBooleanValid(merged)) {
            const center = turf.center(merged);
            L.geoJSON(merged, {style: {color: g.color, weight: 6, fillOpacity: 0, dashArray: '10,15', opacity: 0.9}}).addTo(window.zoneLayers);
            L.marker(center.geometry.coordinates.slice().reverse(), {
                icon: L.divIcon({className: 'group-label', html: g.callsign, iconSize: [120,44], iconAnchor: [60,22]})
            }).addTo(window.zoneLayers);
        }
    });

    window.updateGroupsTable();
    window.updateDistributionStats();
    
    const forceResize = () => setTimeout(() => window.map.invalidateSize({ pan: true, animate: true }), 50);
    forceResize();
    
    console.log('=== ПРОЦЕСС РАСПРЕДЕЛЕНИЯ ЗОН ЗАВЕРШЕН ===');
    console.log(`Распределено ячеек: ${window.groups.reduce((sum, g) => sum + g.cells.length, 0)}`);
    console.log(`Нераспределенных ячеек: ${window.gridCells.length - window.groups.reduce((sum, g) => sum + g.cells.length, 0)}`);
}

// ✅ НОВАЯ ФУНКЦИЯ ДЛЯ ОТРАЖЕНИЯ СТАТИСТИКИ РАСПРЕДЕЛЕНИЯ
function updateDistributionStats() {
    const statsDiv = document.getElementById('distributionStats');
    if (!statsDiv) return;
    
    let totalArea = 0;
    let totalCells = 0;
    let assignedCells = 0;
    
    window.groups.forEach(g => {
        totalArea += g.area;
        totalCells += g.cells.length;
        assignedCells += g.cells.length;
    });
    
    const remainingCells = window.gridCells.length - assignedCells;
    
    let statsHTML = `
        <div>Всего ячеек: ${window.gridCells.length}</div>
        <div>Распределено ячеек: ${assignedCells} (${Math.round(assignedCells / window.gridCells.length * 100)}%)</div>
    `;
    
    if (remainingCells > 0) {
        statsHTML += `<div class="warning">Осталось нераспределенных ячеек: ${remainingCells}</div>`;
    }
    
    statsHTML += `<div>Общая площадь: ${(totalArea / 1000000).toFixed(2)} км²</div>`;
    
    statsDiv.innerHTML = statsHTML;
}

// ✅ ФУНКЦИЯ ДЛЯ ОБНОВЛЕНИЯ ТАБЛИЦЫ ГРУПП
function updateGroupsTable() {
    const table = document.getElementById('groupsTable');
    table.innerHTML = '<tr><th>Позывной</th><th>Люди</th><th>Авто</th><th>БЛА</th><th>Площадь км²</th><th>Квадратов</th><th>Вес</th><th>Эффективность</th><th>Сложность</th><th>Тип зоны</th><th>Действия</th></tr>';
    
    window.groups.forEach(g => {
        const weight = g.people * 0.5 + (g.cars > 0 ? 1 : 0);
        const efficiency = calculateGroupEfficiency(
            g, 
            g.difficulty === 'высокая' ? 'high' : 
            g.difficulty === 'средняя' ? 'medium' : 'low',
            g.zoneType.includes('road'),
            null
        );
        
        const row = table.insertRow();
        row.className = 'group-row';
        row.style.backgroundColor = g.color + '33';
        
        row.insertCell().innerText = g.callsign;
        row.insertCell().innerText = g.people;
        row.insertCell().innerText = g.cars;
        row.insertCell().innerText = g.bla;
        
        const areaCell = row.insertCell();
        areaCell.innerText = (g.area / 1000000).toFixed(2);
        
        const squareCell = row.insertCell();
        squareCell.innerText = g.cells.length;
        
        const weightCell = row.insertCell();
        weightCell.innerHTML = `<span class="weight-badge">${weight.toFixed(1)}</span>`;
        
        const efficiencyCell = row.insertCell();
        efficiencyCell.innerHTML = `<span class="efficiency-badge">${efficiency > 0 ? efficiency.toFixed(0) : '0'} км²/день</span>`;
        
        const difficultyCell = row.insertCell();
        difficultyCell.innerHTML = g.difficulty ? 
            `<span class="road-type ${g.difficulty === 'высокая' ? 'high-difficulty' : g.difficulty === 'средняя' ? 'medium-difficulty' : 'low-difficulty'}">${g.difficulty}</span>` : 
            '-';
        
        const zoneTypeCell = row.insertCell();
        if (g.zoneType === 'road-high') {
            zoneTypeCell.innerHTML = '<span class="road-type road">Дороги / Высокая</span>';
        } else if (g.zoneType === 'road-medium') {
            zoneTypeCell.innerHTML = '<span class="road-type road">Дороги / Средняя</span>';
        } else if (g.zoneType === 'road') {
            zoneTypeCell.innerHTML = '<span class="road-type road">Дороги</span>';
        } else if (g.zoneType === 'no-road-high') {
            zoneTypeCell.innerHTML = '<span class="road-type no-road">Без дорог / Высокая</span>';
        } else if (g.zoneType === 'no-road-medium') {
            zoneTypeCell.innerHTML = '<span class="road-type no-road">Без дорог / Средняя</span>';
        } else if (g.zoneType === 'no-road') {
            zoneTypeCell.innerHTML = '<span class="road-type no-road">Без дорог</span>';
        } else {
            zoneTypeCell.innerHTML = '-';
        }
        
        const actionsCell = row.insertCell();
        actionsCell.innerHTML = `
            <div class="group-actions">
                <button class="accent" onclick="editGroup('${g.callsign}')" style="padding: 3px 5px; margin: 0 2px;">Изменить</button>
                <button class="danger" onclick="deleteGroup('${g.callsign}')" style="padding: 3px 5px; margin: 0 2px;">Удалить</button>
            </div>
        `;
    });
    
    // Добавляем информацию о нераспределенных ячейках
    if (window.gridCells.length > 0) {
        const remainingCells = window.gridCells.length - window.groups.reduce((sum, g) => sum + g.cells.length, 0);
        if (remainingCells > 0) {
            const remainingRow = table.insertRow();
            remainingRow.style.backgroundColor = '#ffebee';
            remainingRow.style.fontWeight = 'bold';
            
            const remainingCell = remainingRow.insertCell();
            remainingCell.colSpan = 11;
            remainingCell.innerHTML = `<span class="warning">⚠️ Осталось нераспределенных ячеек: ${remainingCells}</span>`;
        }
    }
}

// Экспортируем функции для использования в других модулях
document.addEventListener('DOMContentLoaded', () => {
    window.calculateGroupPower = calculateGroupPower;
    window.calculateGroupEfficiency = calculateGroupEfficiency;
    window.assignZones = assignZones;
    window.updateDistributionStats = updateDistributionStats;
    window.updateGroupsTable = updateGroupsTable;
    
    console.log('Сервис распределения зон инициализирован');
});
