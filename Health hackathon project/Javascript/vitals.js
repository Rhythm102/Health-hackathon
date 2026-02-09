import { mqttClient } from "./mqtt_connection.js";
import { drawECG } from "./ecg.js";

export function updateVitals(data) {
  // Update GPS mode elements
  const hrGps = document.getElementById('heartRate-gps');
  const spo2Gps = document.getElementById('spo2-gps');
  const bpGps = document.getElementById('bp-gps');
  const tempGps = document.getElementById('temp-gps');
  
  if (hrGps) hrGps.textContent = data.hr || '--';
  if (spo2Gps) spo2Gps.textContent = data.spo2 || '--';
  if (bpGps) bpGps.textContent = data.sys && data.dia ? `${data.sys}/${data.dia}` : '--/--';
  if (tempGps) tempGps.textContent = data.temp || '--';
  
  // Update Satellite mode elements
  const hrSat = document.getElementById('heartRate-sat');
  const spo2Sat = document.getElementById('spo2-sat');
  const gpsSat = document.getElementById('gps-sat');
  const headingSat = document.getElementById('heading-sat');
  const updatedSat = document.getElementById('updated-sat');
  
  if (hrSat) hrSat.textContent = data.hr || '--';
  if (spo2Sat) spo2Sat.textContent = data.spo2 || '--';
  
  if (gpsSat && data.gps) {
    gpsSat.textContent = data.gps;
  }
  
  if (headingSat && data.heading) {
    headingSat.textContent = data.heading;
  }
  
  if (updatedSat) {
    const now = new Date();
    updatedSat.textContent = now.toLocaleTimeString();
  }
}

export function updateLocation(data) {
  // Update GPS mode elements
  const etaGps = document.getElementById('eta-gps');
  const distanceGps = document.getElementById('distance-gps');
  
  if (etaGps) etaGps.textContent = data.eta || '--';
  if (distanceGps) distanceGps.textContent = data.distance || '--';
  
  // Update Satellite mode elements
  const etaSat = document.getElementById('eta-sat');
  
  if (etaSat) etaSat.textContent = data.eta || '--';
}

// Set up MQTT message handler
mqttClient.on('message', (topic, message) => {
  try {
    const data = JSON.parse(message.toString());

    if (topic.includes('vitals')) {
      updateVitals(data);
    }

    if (topic.includes('location')) {
      updateLocation(data);
    }

    if (topic.includes('ecg')) {
      drawECG(data.samples);
    }
  } catch (error) {
    console.error('❌ Error in vitals handler:', error);
  }
});
