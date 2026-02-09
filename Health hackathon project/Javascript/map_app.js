import { client } from "./map_mqtt_connection.js";

// Track current mode
let currentMode = 'gps';

// Map variables
let map = null;
let ambulanceMarker = null;
let hospitalMarker = null;
let routeLine = null;

// Hospital coordinates (destination)
const HOSPITAL_LAT = 23.2156;
const HOSPITAL_LON = 77.4304;

// Ambulance current position & ETA
let ambulanceCurrentLat = 23.183;  // Rani Kamlapati pickup
let ambulanceCurrentLon = 77.416;
let currentETA = 0;
let remainingDistance = 5.28;

// Initialize Leaflet Map
function initializeMap() {
  if (map) return;
  
  try {
    // Create map centered between ambulance and hospital
    const centerLat = (ambulanceCurrentLat + HOSPITAL_LAT) / 2;
    const centerLon = (ambulanceCurrentLon + HOSPITAL_LON) / 2;
    map = L.map('map').setView([centerLat, centerLon], 13);
    
    // Add OpenStreetMap tiles (free!)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19
    }).addTo(map);
    
    // Add hospital marker (red)
    hospitalMarker = L.marker([HOSPITAL_LAT, HOSPITAL_LON], {
      icon: L.icon({
        iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowSize: [41, 41]
      })
    }).addTo(map);
    
    hospitalMarker.bindPopup('<b>🏥 Hospital</b><br>Destination').openPopup();
    
    // Add ambulance marker (will update with real data)
    ambulanceMarker = L.marker([23.2599, 77.4126], {
      icon: L.icon({
        iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowSize: [41, 41]
      })
    }).addTo(map);
    
    ambulanceMarker.bindPopup('<b>🚑 Ambulance</b><br>Patient: P-8492');
    
    // Draw initial route line
    updateRoute([23.2599, 77.4126], [HOSPITAL_LAT, HOSPITAL_LON]);
    
    console.log("✅ Map initialized successfully");
  } catch (error) {
    console.error("❌ Error initializing map:", error);
  }
}

// Update route line between ambulance and hospital
function updateRoute(ambulanceLat, ambulanceLon) {
  if (!map) return;
  
  // Remove old route
  if (routeLine) {
    map.removeLayer(routeLine);
  }
  
  // Draw new route
  routeLine = L.polyline([
    [ambulanceLat, ambulanceLon],
    [HOSPITAL_LAT, HOSPITAL_LON]
  ], {
    color: '#2563eb',
    weight: 4,
    opacity: 0.7,
    dashArray: '10, 10'
  }).addTo(map);
  
  // Fit map to show both markers
  const bounds = L.latLngBounds([
    [ambulanceLat, ambulanceLon],
    [HOSPITAL_LAT, HOSPITAL_LON]
  ]);
  map.fitBounds(bounds, { padding: [50, 50] });
}

// Update ambulance position on map
function updateAmbulancePosition(lat, lon) {
  if (!map || !ambulanceMarker) return;
  
  ambulanceCurrentLat = lat;
  ambulanceCurrentLon = lon;
  
  const newPos = [lat, lon];
  ambulanceMarker.setLatLng(newPos);
  ambulanceMarker.bindPopup('<b>🚑 Ambulance</b><br>Patient: P-8492<br>En Route...').openPopup();
  
  updateRoute(lat, lon);
}

// Update ETA display
function updateETA(data) {
  const etaElement = document.getElementById('eta-display');
  if (etaElement) {
    const minutes = data.eta_minutes || 0;
    const seconds = (data.eta_seconds % 60) || 0;
    const km = (data.remaining_km?.toFixed(2)) || '0';
    const status = data.status || 'en_route';
    
    if (status === 'arrived') {
      etaElement.innerHTML = `<strong>✅ Arrived at Hospital!</strong>`;
      etaElement.style.color = '#059669';
    } else {
      etaElement.innerHTML = `<strong>ETA: ${minutes}m ${seconds}s</strong><br><small>${km} km remaining</small>`;
      etaElement.style.color = '#2563eb';
    }
  }
}

// Initialize map when page loads
setTimeout(() => {
  if (currentMode === 'gps') {
    initializeMap();
  }
}, 500);

// Connection detection
function detectConnection() {
  if (!navigator.onLine) {
    return "satellite";
  }
  
  if (navigator.connection || navigator.mozConnection || navigator.webkitConnection) {
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    
    if (connection.effectiveType === 'slow-2g' || connection.effectiveType === '2g' || connection.saveData) {
      return "satellite";
    }
    
    if (connection.downlink && connection.downlink < 1) {
      return "satellite";
    }
  }
  
  return "gps";
}

// Switch UI between GPS and Satellite modes
function switchUI(mode) {
  const body = document.body;
  
  if (mode === "gps") {
    body.classList.remove('satellite-active');
    body.classList.add('gps-active');
    console.log("✅ Switched to GPS mode UI");
    
    // Initialize map when switching to GPS mode
    setTimeout(() => {
      initializeMap();
    }, 100);
  } else {
    body.classList.remove('gps-active');
    body.classList.add('satellite-active');
    console.log("✅ Switched to Satellite mode UI");
  }
  
  currentMode = mode;
}

// Evaluate connection and switch mode if needed
function evaluateConnection() {
  const mode = detectConnection();
  console.log(`🔍 Connection evaluated: ${mode} mode`);
  
  if (mode !== currentMode) {
    switchUI(mode);
  }
}

// Initial check on page load
evaluateConnection();

// Monitor network changes
window.addEventListener("online", () => {
  console.log("📶 Network status: online");
  evaluateConnection();
});

window.addEventListener("offline", () => {
  console.log("📴 Network status: offline");
  evaluateConnection();
});

if (navigator.connection) {
  navigator.connection.addEventListener('change', () => {
    console.log("🔄 Connection type changed");
    evaluateConnection();
  });
}

// Periodic connection check every 30 seconds
setInterval(evaluateConnection, 30000);

// MQTT Message Handler
client.on("message", (topic, payload) => {
  try {
    const data = JSON.parse(payload.toString());

    if (topic === "ambulance/amb-42/location") {
      // Update map with ambulance position
      if (data.lat && data.lon) {
        updateAmbulancePosition(data.lat, data.lon);
      }
    }

    if (topic === "rescue/eta") {
      // Update GPS mode elements
      const etaEl = document.getElementById("eta");
      const distanceEl = document.getElementById("distance");
      const etaSummaryEl = document.getElementById("eta-summary");
      const summaryDistanceEl = document.getElementById("summary-distance");
      const speedEl = document.getElementById("speed");
      const arrivalEl = document.getElementById("arrival");

      if (etaEl) etaEl.textContent = data.eta + " min";
      if (distanceEl) distanceEl.textContent = data.distance + " km";
      if (etaSummaryEl) etaSummaryEl.textContent = data.eta + " min";
      if (summaryDistanceEl) summaryDistanceEl.textContent = data.distance + " km";
      if (speedEl) speedEl.textContent = data.speed + " km/h";
      if (arrivalEl) arrivalEl.textContent = data.arrival;

      // Update Satellite mode elements
      const etaSatEl = document.getElementById("eta-sat");
      const distanceSatEl = document.getElementById("distance-sat");
      const speedSatEl = document.getElementById("speed-sat");
      const arrivalSatEl = document.getElementById("arrival-sat");

      if (etaSatEl) etaSatEl.textContent = data.eta + " min";
      if (distanceSatEl) distanceSatEl.textContent = data.distance + " km";
      if (speedSatEl) speedSatEl.textContent = data.speed + " km/h";
      if (arrivalSatEl) arrivalSatEl.textContent = data.arrival;
    }

    if (topic === "rescue/traffic") {
      // Update GPS mode elements
      const trafficEl = document.getElementById("traffic");
      const weatherEl = document.getElementById("weather");
      const routeEl = document.getElementById("route");

      if (trafficEl) trafficEl.textContent = data.density;
      if (weatherEl) weatherEl.textContent = data.weather;
      if (routeEl) routeEl.textContent = data.route;

      // Update Satellite mode elements
      const trafficSatEl = document.getElementById("traffic-sat");
      const weatherSatEl = document.getElementById("weather-sat");
      const routeSatEl = document.getElementById("route-sat");

      if (trafficSatEl) trafficSatEl.textContent = data.density;
      if (weatherSatEl) weatherSatEl.textContent = data.weather;
      if (routeSatEl) routeSatEl.textContent = data.route;
    }
  } catch (error) {
    console.error("❌ Error processing MQTT message:", error);
  }
});

console.log(`🗺️ Map & ETA page initialized in ${currentMode} mode`);

// Expose functions globally for MQTT callbacks
window.updateAmbulancePosition = updateAmbulancePosition;
window.updateETA = updateETA;
console.log("✅ Real-time ambulance tracking enabled");