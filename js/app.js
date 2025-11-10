const map = L.map('map', { doubleClickZoom: false }).setView([53.90, 27.55], 12);
map.pm.setGlobalOptions({ pinchZoom: false, snappable: true, snapDistance: 30, allowSelfIntersection: false });

const osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {attribution: '&copy; OpenStreetMap'}).addTo(map);
const esri = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {attribution: 'Esri'});
const googleSat = L.tileLayer('https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', {attribution: 'Google'});
L.control.layers({'OSM': osm, 'ESRI Satellite': esri, 'Google Satellite': googleSat}, {}, {position: 'topright'}).addTo(map);

const drawnItems = new L.FeatureGroup().addTo(map);
let searchPolygon = null;
let searchFeature = null;
let gridLayer = L.layerGroup().addTo(map);
let zoneLayers = L.layerGroup().addTo(map);
let gridCells = [];
let groups = [];
const colors = ['#e41a1c','#377eb8','#4daf4a','#984ea3','#ff7f00','#ffff33','#a65628','#f781bf','#999999','#66c2a5'];

function startDrawing() {
    clearAll();
    map.pm.enableDraw('Polygon', {
        finishOn: 'dblclick',
        pathOptions: { color: '#3388ff', weight: 4 }
    });
}

map.on('pm:create', e => {
    if (e.shape === 'Polygon') {
        map.pm.disableDraw();
        drawnItems.clearLayers();
        searchPolygon = e.layer;
        searchFeature = searchPolygon.toGeoJSON();
        drawnItems.addLayer(searchPolygon);
        document.getElementById('gridControls').style.display = 'block';
        searchPolygon.pm.disable();
        loadFromStorage(); // если был сохранённый проект
    }
});

function getColumnLabel(n) {
    let s = '';
    while (n >= 0) { s = String.fromCharCode(65 + (n % 26)) + s; n = Math.floor(n / 26) - 1; }
    return s || 'A';
}

function generateGrid() {
    if (!searchFeature) return alert('Нарисуй полигон!');
    gridLayer.clearLayers();
    gridCells = [];

    let size = parseFloat(document.getElementById('gridCustom').value) || parseFloat(document.getElementById('gridPreset').value);
    if (!size || size <= 0) return alert('Размер грида!');

    const bbox = turf.bbox(searchFeature);
    const avgLat = (bbox[1] + bbox[3]) / 2;
    const metersPerDegLat = 111132.92 - 559.82 * Math.cos(2 * avgLat * Math.PI/180) + 1.175 * Math.cos(4 * avgLat * Math.PI/180);
    const metersPerDegLon = 111412.84 * Math.cos(avgLat * Math.PI/180) - 93.5 * Math.cos(3 * avgLat * Math.PI/180);
    const degLat = size / metersPerDegLat;
    const degLon = size / metersPerDegLon;

    let startLon = Math.floor(bbox[0] / degLon) * degLon - degLon;
    let startLat = Math.floor(bbox[1] / degLat) * degLat - degLat;

    let col = 0;
    for (let lon = startLon; lon <= bbox[2] + degLon; lon += degLon) {
        let row = 1;
        for (let lat = startLat; lat <= bbox[3] + degLat; lat += degLat) {
            const cellPoly = turf.polygon([[[lon, lat], [lon + degLon, lat], [lon + degLon, lat + degLat], [lon, lat + degLat], [lon, lat]]]);
            let clipped = turf.intersect(turf.featureCollection([cellPoly, searchFeature]));
            if (clipped && clipped.features && clipped.features[0] && turf.area(clipped.features[0]) > 100) {
                clipped = clipped.features[0];
                const area = turf.area(clipped);
                const center = turf.center(clipped);
                const label = getColumnLabel(col) + row;

                clipped.properties = {label, area};
                const layer = L.geoJSON(clipped, {style: {color: '#3388ff', weight: 1, fillOpacity: 0.05}}).addTo(gridLayer);
                const icon = L.divIcon({className: 'grid-label', html: label, iconSize: [30,30], iconAnchor: [15,15]});
                L.marker(center.geometry.coordinates.slice().reverse(), {icon}).addTo(gridLayer);

                gridCells.push({geojson: clipped, layer, center: turf.point(center.geometry.coordinates), area});
            }
            row++;
        }
        col++;
    }
}

function addGroup() {
    const base = document.getElementById('baseCall').value.trim() || 'Group';
    let maxNum = 0;
    groups.forEach(g => {
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
    const bla = document.getElementById('hasBla').checked;

    groups.push({callsign, people, cars, bla, color: colors[groups.length % colors.length], cells: [], area: 0});
    updateGroupsTable();
    document.getElementById('startNum').value = '';
}

function updateGroupsTable() {
    const table = document.getElementById('groupsTable');
    table.innerHTML = '<tr><th>Позывной</th><th>Люди</th><th>Авто</th><th>БЛА</th><th>Площадь м²</th><th>Квадратов</th></tr>';
    groups.forEach((g, i) => {
        const row = table.insertRow();
        row.style.backgroundColor = g.color + '33';
        row.onclick = () => { if (g.cells.length) map.fitBounds(getGroupBounds(g)); };
        row.insertCell().innerText = g.callsign;
        row.insertCell().innerText = g.people;
        row.insertCell().innerText = g.cars;
        row.insertCell().innerText = g.bla ? 'Да' : 'Нет';
        row.insertCell().innerText = Math.round(g.area);
        row.insertCell().innerText = g.cells.length;
    });
}

function getGroupBounds(g) {
    if (g.cells.length === 0) return map.getBounds();
    let merged = g.cells[0].geojson;
    for (let j = 1; j < g.cells.length; j++) merged = turf.union(merged, g.cells[j].geojson);
    return L.geoJSON(merged).getBounds();
}

function assignZones() {
    if (gridCells.length === 0) return alert('Грид сначала!');
    if (groups.length === 0) return alert('Группы добавь!');
    zoneLayers.clearLayers();
    groups.forEach(g => { g.cells = []; g.area = 0; });

    const points = turf.featureCollection(gridCells.map(c => c.center));
    const clustered = turf.clustersKmeans(points, {numberOfClusters: groups.length});
    const clusters = Array.from({length: groups.length}, () => ({cells: [], area: 0}));
    gridCells.forEach((cell, i) => {
        const cl = clustered.features[i].properties.cluster;
        clusters[cl].cells.push(cell);
        clusters[cl].area += cell.area;
    });

    groups.sort((a,b) => (b.bla ? 1e6 : 0) + b.people * 100 + b.cars - ((a.bla ? 1e6 : 0) + a.people * 100 + a.cars));
    clusters.sort((a,b) => b.area - a.area);

    clusters.forEach((cl, i) => {
        const g = groups[i];
        g.cells = cl.cells;
        g.area = cl.area;
    });

    gridCells.forEach(cell => {
        groups.forEach(g => {
            if (g.cells.includes(cell)) {
                cell.layer.setStyle({fillColor: g.color, fillOpacity: 0.45, color: g.color, weight: 2, opacity: 0.8});
            }
        });
    });

    groups.forEach(g => {
        if (g.cells.length === 0) return;
        let merged = g.cells[0].geojson;
        for (let j = 1; j < g.cells.length; j++) merged = turf.union(merged, g.cells[j].geojson);
        const center = turf.center(merged);
        L.geoJSON(merged, {style: {color: g.color, weight: 6, fillOpacity: 0, dashArray: '10,15', opacity: 0.9}}).addTo(zoneLayers);
        L.marker(center.geometry.coordinates.slice().reverse(), {
            icon: L.divIcon({className: 'group-label', html: g.callsign, iconSize: [120,44], iconAnchor: [60,22]})
        }).addTo(zoneLayers);
    });

    updateGroupsTable();
}

function exportGeoJSON() {
    const data = {type: "FeatureCollection", features: [
        searchFeature,
        ...gridCells.map(c => c.geojson),
        ...groups.map(g => {
            if (g.cells.length === 0) return null;
            let merged = g.cells[0].geojson;
            for (let j=1; j<g.cells.length; j++) merged = turf.union(merged, g.cells[j].geojson);
            merged.properties = {group: g.callsign, people: g.people, cars: g.cars, bla: g.bla};
            return merged;
        }).filter(Boolean)
    ]};
    const blob = new Blob([JSON.stringify(data)], {type: 'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'pso_plan.geojson'; a.click();
}

function exportKML() {
    const kml = new L.KML();
    drawnItems.eachLayer(l => kml.addLayer(l));
    gridLayer.eachLayer(l => kml.addLayer(l));
    zoneLayers.eachLayer(l => kml.addLayer(l));
    const blob = new Blob([kml.getKML()], {type: 'application/vnd.google-earth.kml+xml'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'pso_plan.kml'; a.click();
}

function clearAll() {
    if (confirm('Очистить всё?')) {
        drawnItems.clearLayers();
        gridLayer.clearLayers();
        zoneLayers.clearLayers();
        gridCells = []; groups = [];
        searchPolygon = null; searchFeature = null;
        document.getElementById('gridControls').style.display = 'none';
        updateGroupsTable();
        map.pm.disableDraw();
        localStorage.removeItem('psoProject');
    }
}

function saveProject() {
    const data = {
        searchFeature,
        gridCells: gridCells.map(c => c.geojson),
        groups
    };
    localStorage.setItem('psoProject', JSON.stringify(data));
    alert('Проект сохранён в браузере!');
}

function loadFromStorage() {
    const saved = localStorage.getItem('psoProject');
    if (saved && searchFeature) {
        if (confirm('Загрузить сохранённый проект?')) {
            const data = JSON.parse(saved);
            // Здесь можно восстановить грид/группы — в следующей итерации добавлю полный load
            alert('Загрузка в разработке — пока только сохранение');
        }
    }
}

if (window.Telegram?.WebApp) {
    window.Telegram.WebApp.ready();
    window.Telegram.WebApp.expand();
}
