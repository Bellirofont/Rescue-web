// ✅ УТИЛИТЫ ДЛЯ БЕЗОПАСНОЙ РАБОТЫ С TURF

// Проверка валидности геометрии
function safeTurfBooleanValid(geometry) {
    try {
        return turf.booleanValid(geometry);
    } catch (e) {
        console.warn('Geometry validation error:', e);
        return false;
    }
}

// Безопасное пересечение
function safeTurfIntersect(feature1, feature2) {
    try {
        return turf.intersect(feature1, feature2);
    } catch (e) {
        console.warn('Turf intersect error:', e);
        
        try {
            // Попробуем с буфером
            const buffered1 = safeTurfBuffer(feature1, 0.0001, {units: 'kilometers'});
            return turf.intersect(buffered1, feature2);
        } catch (e2) {
            try {
                // Еще попытка с другим буфером
                const buffered2 = safeTurfBuffer(feature2, 0.0001, {units: 'kilometers'});
                return turf.intersect(feature1, buffered2);
            } catch (e3) {
                // Если все попытки не удались, возвращаем null
                return null;
            }
        }
    }
}

// Безопасное объединение
function safeTurfUnion(feature1, feature2) {
    try {
        return turf.union(feature1, feature2);
    } catch (e) {
        console.warn('Turf union error:', e);
        
        try {
            // Попробуем с буфером
            const buffered1 = safeTurfBuffer(feature1, 0.0001, {units: 'kilometers'});
            return turf.union(buffered1, feature2);
        } catch (e2) {
            try {
                // Еще попытка с другим буфером
                const buffered2 = safeTurfBuffer(feature2, 0.0001, {units: 'kilometers'});
                return turf.union(feature1, buffered2);
            } catch (e3) {
                // Если все попытки не удались, возвращаем null
                return null;
            }
        }
    }
}

// Безопасная проверка пересечения
function safeTurfBooleanIntersects(feature1, feature2) {
    try {
        return turf.booleanIntersects(feature1, feature2);
    } catch (e) {
        console.warn('Turf booleanIntersects error:', e);
        
        try {
            // Попробуем с буфером
            const buffered1 = safeTurfBuffer(feature1, 0.0001, {units: 'kilometers'});
            return turf.booleanIntersects(buffered1, feature2);
        } catch (e2) {
            try {
                // Еще попытка с другим буфером
                const buffered2 = safeTurfBuffer(feature2, 0.0001, {units: 'kilometers'});
                return turf.booleanIntersects(feature1, buffered2);
            } catch (e3) {
                // Если все попытки не удались, возвращаем false
                return false;
            }
        }
    }
}

// Безопасный буфер
function safeTurfBuffer(feature, distance, options) {
    try {
        return turf.buffer(feature, distance, options);
    } catch (e) {
        console.warn('Turf buffer error:', e);
        return feature;
    }
}

// Экспортируем функции для использования в других модулях
document.addEventListener('DOMContentLoaded', () => {
    window.safeTurfBooleanValid = safeTurfBooleanValid;
    window.safeTurfIntersect = safeTurfIntersect;
    window.safeTurfUnion = safeTurfUnion;
    window.safeTurfBooleanIntersects = safeTurfBooleanIntersects;
    window.safeTurfBuffer = safeTurfBuffer;
    
    console.log('Turf утилиты инициализированы');
});