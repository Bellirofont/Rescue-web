// Глобальные переменные (объявляем один раз)
window.map = null;
window.drawnItems = null;
window.searchPolygon = null;
window.searchFeature = null;
window.gridLayer = null;
window.zoneLayers = null;
window.routeLayers = null;
window.roadLayer = null;
window.importedKmlLayer = null;
window.gridCells = [];
window.groups = [];
window.roadGeoJSON = null;
window.roadDataLoaded = false;
window.roadLoadingStatus = 'not-started';
window.drawHandler = null;
window.retryCount = 0;
window.maxRetries = 3;
window.roadCells = []; // Ячейки с дорогами
window.noRoadCells = []; // Ячейки без дорог
window.highDifficultyCells = []; // Ячейки с высокой сложностью
window.mediumDifficultyCells = []; // Ячейки со средней сложностью
window.lowDifficultyCells = []; // Ячейки с низкой сложностью
window.currentGroup = null;
window.russianLetters = 'АБВГДЕЖЗИКЛМНОПРСТУФХЦЧШЩЮ'.split('');
window.colors = ['#e41a1c','#377eb8','#4daf4a','#984ea3','#ff7f00','#ffff33','#a65628','#f781bf','#999999','#66c2a5'];

// 🌄 ДАННЫЕ РЕЛЬЕФА С topographic-map.com
if (typeof window.RELIEF === 'undefined') {
    window.RELIEF = {
        min: 163,   // м
        max: 202,
        avg: 187
    };
}

// Инициализация карты и основных слоев
document.addEventListener('DOMContentLoaded', () => {
    window.map = L.map('map', {
        doubleClickZoom: false,
        attributionControl: false,
        zoomControl: true
    }).setView([53.90, 27.55], 12);

    if (map.attributionControl) map.attributionControl.remove();
    map.getContainer().style.background = '#dddddd';

    const tileOptions = { attribution: '', maxZoom: 22, maxNativeZoom: 19 };
    const osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', tileOptions).addTo(map);
    const esri = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', tileOptions);
    const googleSat = L.tileLayer('https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', tileOptions);

    L.control.layers({ 'OSM': osm, 'ESRI Satellite': esri, 'Google Satellite': googleSat }, {}, {
        position: 'topright',
        collapsed: true
    }).addTo(map);

    L.control.scale({ position: 'bottomleft', maxWidth: 200 }).addTo(map);

    const forceResize = () => setTimeout(() => map.invalidateSize({ pan: true, animate: true }), 50);
    window.addEventListener('resize', forceResize);
    window.addEventListener('orientationchange', forceResize);
    map.whenReady(forceResize);

    // Инициализация слоев
    window.drawnItems = new L.FeatureGroup().addTo(map);
    window.gridLayer = L.layerGroup().addTo(map);
    window.zoneLayers = L.layerGroup().addTo(map);
    window.routeLayers = L.layerGroup().addTo(map);
    window.roadLayer = L.layerGroup().addTo(map);
    window.importedKmlLayer = L.layerGroup().addTo(map);
    
    console.log('Базовая инициализация завершена');
    
    // Настройка обработчиков
    setupEventListeners();
    
    // Добавляем легенду типов дорог
    addRoadLegend();
});

// Настройка обработчиков событий
function setupEventListeners() {
    const kmlInput = document.getElementById('kmlFileInput');
    if (kmlInput) {
        kmlInput.addEventListener('change', function(e) {
            const file = e.target.files[0];
            if (file) {
                window.importKML(file);
                this.value = '';
            }
        });
    }
    
    // Проверка на Telegram WebApp
    if (window.Telegram?.WebApp) {
        window.Telegram.WebApp.ready();
        window.Telegram.WebApp.expand();
        setTimeout(() => {
            if (map) map.invalidateSize({ pan: true, animate: true });
        }, 800);
    }
}

// Добавление легенды типов дорог
function addRoadLegend() {
    const legend = L.control({position: 'bottomright'});
    
    legend.onAdd = function(map) {
        const div = L.DomUtil.create('div', 'info legend');
        
        // Заголовок легенды
        div.innerHTML = '<h4>Типы дорог</h4>';
        
        // Перечисляем типы дорог
        Object.keys(window.ROAD_TYPES).forEach(function(type) {
            const typeData = window.ROAD_TYPES[type];
            div.innerHTML += 
                '<i style="background:' + typeData.color + '"></i> ' + 
                typeData.name + '<br/>';
        });
        
        return div;
    };
    
    legend.addTo(window.map);
}

function getCsrfToken() {
    const metaTag = document.querySelector('meta[name="csrf-token"]');
    return metaTag ? metaTag.getAttribute('content') : null;
}