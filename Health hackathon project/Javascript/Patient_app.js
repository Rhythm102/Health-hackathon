import { client } from "./patient_mqtt_connection.js";

// Track current mode
let currentMode = 'gps';

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

    if (topic === "rescue/patient/profile") {
      // Update GPS mode elements
      if (document.getElementById("name")) {
        document.getElementById("name").textContent = data.name;
      }
      if (document.getElementById("age")) {
        document.getElementById("age").textContent = data.age;
      }
      if (document.getElementById("sex")) {
        document.getElementById("sex").textContent = data.sex;
      }
      if (document.getElementById("blood")) {
        document.getElementById("blood").textContent = data.blood;
      }
      if (document.getElementById("conditions")) {
        document.getElementById("conditions").textContent = data.conditions.join(", ");
      }
      if (document.getElementById("medications")) {
        document.getElementById("medications").textContent = data.medications.join(", ");
      }
      if (document.getElementById("notes")) {
        document.getElementById("notes").textContent = data.notes;
      }
      if (document.getElementById("allergy")) {
        document.getElementById("allergy").textContent = data.allergy;
      }
      if (document.getElementById("emg-name")) {
        document.getElementById("emg-name").textContent = data.emergency.name;
      }
      if (document.getElementById("emg-phone")) {
        document.getElementById("emg-phone").textContent = data.emergency.phone;
      }
      if (document.getElementById("emg-rel")) {
        document.getElementById("emg-rel").textContent = data.emergency.relationship;
      }

      // Update Satellite mode elements
      if (document.getElementById("name-sat")) {
        document.getElementById("name-sat").textContent = data.name;
      }
      if (document.getElementById("age-sat")) {
        document.getElementById("age-sat").textContent = data.age;
      }
      if (document.getElementById("sex-sat")) {
        document.getElementById("sex-sat").textContent = data.sex;
      }
      if (document.getElementById("blood-sat")) {
        document.getElementById("blood-sat").textContent = data.blood;
      }
      if (document.getElementById("conditions-sat")) {
        document.getElementById("conditions-sat").textContent = data.conditions.join(", ");
      }
      if (document.getElementById("medications-sat")) {
        document.getElementById("medications-sat").textContent = data.medications.join(", ");
      }
      if (document.getElementById("allergy-sat")) {
        document.getElementById("allergy-sat").textContent = data.allergy;
      }
      if (document.getElementById("emg-name-sat")) {
        document.getElementById("emg-name-sat").textContent = data.emergency.name;
      }
      if (document.getElementById("emg-phone-sat")) {
        document.getElementById("emg-phone-sat").textContent = data.emergency.phone;
      }
      if (document.getElementById("emg-rel-sat")) {
        document.getElementById("emg-rel-sat").textContent = data.emergency.relationship;
      }
    }

    if (topic === "rescue/patient/vitals") {
      // Update GPS mode vitals
      if (document.getElementById("hr")) {
        document.getElementById("hr").textContent = data.hr + " bpm";
      }
      if (document.getElementById("spo2")) {
        document.getElementById("spo2").textContent = data.spo2 + " %";
      }
      if (document.getElementById("bp")) {
        document.getElementById("bp").textContent = data.bp;
      }
      if (document.getElementById("temp")) {
        document.getElementById("temp").textContent = data.temp + "°C";
      }

      // Update Satellite mode vitals
      if (document.getElementById("hr-sat")) {
        document.getElementById("hr-sat").textContent = data.hr + " bpm";
      }
      if (document.getElementById("spo2-sat")) {
        document.getElementById("spo2-sat").textContent = data.spo2 + "%";
      }
      if (document.getElementById("bp-sat")) {
        document.getElementById("bp-sat").textContent = data.bp;
      }
      if (document.getElementById("temp-sat")) {
        document.getElementById("temp-sat").textContent = data.temp + "°C";
      }
    }
  } catch (error) {
    console.error("❌ Error processing MQTT message:", error);
  }
});

console.log(`👤 Patient Profile page initialized in ${currentMode} mode`);
