// Модель группы
class Group {
    constructor(callsign, people, cars, bla) {
        this.callsign = callsign;
        this.people = people;
        this.cars = cars;
        this.bla = bla;
        this.cells = [];
        this.area = 0;
        this.zoneType = '';
        this.difficulty = '';
        this.efficiency = 0;
        this.color = this.generateColor();
    }
    
    generateColor() {
        return window.colors[window.groups.length % window.colors.length];
    }
    
    calculateWeight() {
        return this.people * 0.5 + (this.cars > 0 ? 1 : 0);
    }
    
    calculateEfficiency(cellType, hasRoad, roadType) {
        return window.calculateGroupEfficiency(this, cellType, hasRoad, roadType);
    }
}

// Экспортируем конструктор для использования в других модулях
window.Group = Group;
