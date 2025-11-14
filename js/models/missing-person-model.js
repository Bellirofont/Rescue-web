// Модель пропавшего человека
class MissingPerson {
    constructor(data = {}) {
        this.lastKnownPosition = data.lastKnownPosition || null;
        this.disappearanceTime = data.disappearanceTime || new Date();
        this.age = data.age || null;
        this.gender = data.gender || null;
        this.physicalCondition = data.physicalCondition || 'average'; // 'good', 'average', 'poor'
        this.psychologicalState = data.psychologicalState || 'stable'; // 'stable', 'confused', 'depressed'
        this.specialNeeds = data.specialNeeds || []; // ['visual_impairment', 'hearing_impairment', 'mobility_issues']
        this.skills = data.skills || []; // ['orienteering', 'survival', 'none']
    }
    
    calculateBehaviorPattern(terrain, timeMissing) {
        // Алгоритм прогнозирования поведения на основе модели Райнемана
        return this.reinemanModel(terrain, timeMissing);
    }
    
    reinemanModel(terrain, hoursMissing) {
        const baseDistance = this.calculateBaseDistance(hoursMissing);
        const behaviorModifiers = this.getBehaviorModifiers();
        
        // Модификация базового расстояния в зависимости от психологического состояния
        let probableDistance = baseDistance;
        
        if (this.psychologicalState === 'confused') {
            probableDistance *= 0.7; // Склонность к блужданию по кругу
        } else if (this.psychologicalState === 'depressed') {
            probableDistance *= 0.5; // Меньшая подвижность
        }
        
        // Учет физических возможностей
        if (this.physicalCondition === 'poor') {
            probableDistance *= 0.6;
        } else if (this.physicalCondition === 'good') {
            probableDistance *= 1.2;
        }
        
        return {
            maxDistance: probableDistance,
            preferredTerrain: this.getPreferredTerrain(),
            avoidanceZones: this.getAvoidanceZones(),
            attractionZones: this.getAttractionZones()
        };
    }
    
    calculateBaseDistance(hoursMissing) {
        // Базовое расстояние в зависимости от возраста
        let baseSpeed;
        
        if (this.age < 18) {
            baseSpeed = 3; // км/час для детей
        } else if (this.age < 65) {
            baseSpeed = 4; // км/час для взрослых
        } else {
            baseSpeed = 2.5; // км/час для пожилых
        }
        
        // Учет времени
        return baseSpeed * hoursMissing;
    }
    
    getBehaviorModifiers() {
        const modifiers = {};
        
        // Модификаторы в зависимости от условий
        if (this.specialNeeds.includes('mobility_issues')) {
            modifiers.mobility = 0.6;
        }
        
        if (this.skills.includes('orienteering')) {
            modifiers.navigation = 1.3;
        }
        
        return modifiers;
    }
    
    getPreferredTerrain() {
        const preferred = [];
        
        if (this.skills.includes('survival')) {
            preferred.push('forest');
        }
        
        if (!this.specialNeeds.includes('mobility_issues')) {
            preferred.push('field', 'forest');
        }
        
        preferred.push('road');
        
        return preferred;
    }
    
    getAvoidanceZones() {
        const avoidance = [];
        
        if (this.specialNeeds.includes('mobility_issues')) {
            avoidance.push('swamp', 'water');
        }
        
        if (this.psychologicalState === 'confused') {
            avoidance.push('dense_forest');
        }
        
        return avoidance;
    }
    
    getAttractionZones() {
        const attraction = [];
        
        if (this.skills.includes('survival')) {
            attraction.push('water', 'field');
        }
        
        return attraction;
    }
}

// Экспортируем конструктор
window.MissingPerson = MissingPerson;