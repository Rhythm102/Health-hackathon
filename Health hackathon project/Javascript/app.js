import { mqttClient } from "./mqtt_connection.js";
import { detectConnection, setMode } from "./connection_state.js";
import { updateVitals, updateLocation } from "./vitals.js";
import { drawECG } from "./ecg.js";

// Track current mode
let currentMode = 'gps';

function switchUI(mode) {
  const body = document.body;
  
  if (mode === "gps") {
    body.classList.remove('satellite-active');
    body.classList.add('gps-active');
    console.log("✅ Switched to GPS mode UI");
  } else {
    body.classList.remove('gps-active');
    body.classList.add('satellite-active');
    console.log("✅ Switched to Satellite mode UI");
  }
  
  currentMode = mode;
}

function evaluateConnection() {
  const mode = detectConnection();
  setMode(mode);
  console.log(`🔍 Connection evaluated: ${mode} mode`);
  
  // Only switch if mode changed
  if (mode !== currentMode) {
    switchUI(mode);
  }
}

/* Initial check on page load */
evaluateConnection();

/* Re-check when network changes */
window.addEventListener("online", () => {
  console.log("📶 Network status: online");
  evaluateConnection();
});

window.addEventListener("offline", () => {
  console.log("📴 Network status: offline");
  evaluateConnection();
});

/* Monitor connection quality changes */
if (navigator.connection) {
  navigator.connection.addEventListener('change', () => {
    console.log("🔄 Connection type changed");
    evaluateConnection();
  });
}

/* MQTT Data Routing */
mqttClient.on("message", (topic, msg) => {
  try {
    const data = JSON.parse(msg.toString());
    
    if (topic.includes("vitals")) {
      updateVitals(data);
    }
    
    if (topic.includes("location")) {
      updateLocation(data);
    }
    
    if (topic.includes("ecg")) {
      drawECG(data.samples);
    }
  } catch (error) {
    console.error("❌ Error processing MQTT message:", error);
  }
});

/* Periodic connection check every 30 seconds */
setInterval(evaluateConnection, 30000);

console.log(`🚑 RescueLink Dashboard initialized in ${currentMode} mode`);