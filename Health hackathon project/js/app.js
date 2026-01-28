import { mqttClient } from "./mqtt_connection.js";
import { detectConnection, setMode, getCurrentMode } from "./connection_state.js";
import { updateVitals, updateLocation } from "./vitals.js";
import { drawECG } from "./ecg.js";

// Determine which page we're currently on
const currentPage = window.location.pathname.includes('index2') ? 'satellite' : 'gps';

function switchUI(mode) {
  // If the detected mode doesn't match current page, redirect
  if (mode === "gps" && currentPage === "satellite") {
    console.log("Switching to GPS mode - redirecting to index.html");
    window.location.href = "index.html";
  } else if (mode === "satellite" && currentPage === "gps") {
    console.log("Switching to Satellite mode - redirecting to index2.html");
    window.location.href = "index2.html";
  }
}

function evaluateConnection() {
  const mode = detectConnection();
  setMode(mode);
  console.log(`Connection evaluated: ${mode} mode`);
  switchUI(mode);
}

/* Initial check on page load */
evaluateConnection();

/* Re-check when network changes */
window.addEventListener("online", () => {
  console.log("Network status: online");
  evaluateConnection();
});

window.addEventListener("offline", () => {
  console.log("Network status: offline");
  evaluateConnection();
});

/* Monitor connection quality changes */
if (navigator.connection) {
  navigator.connection.addEventListener('change', () => {
    console.log("Connection type changed");
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
    console.error("Error processing MQTT message:", error);
  }
});

/* Periodic connection check every 30 seconds */
setInterval(evaluateConnection, 30000);

console.log(`RescueLink Dashboard initialized in ${currentPage} mode`);