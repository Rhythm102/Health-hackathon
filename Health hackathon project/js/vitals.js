import { mqttClient } from "./mqtt_connection.js";
import { drawECG } from "./ecg.js";

export function updateVitals(data) {
  // Update vitals display
  if (document.getElementById('heartRate')) {
    document.getElementById('heartRate').textContent = data.hr || '--';
  }
  if (document.getElementById('spo2')) {
    document.getElementById('spo2').textContent = data.spo2 || '--';
  }
  if (document.getElementById('bp')) {
    document.getElementById('bp').textContent = data.sys && data.dia ? `${data.sys}/${data.dia}` : '--/--';
  }
  if (document.getElementById('temp')) {
    document.getElementById('temp').textContent = data.temp || '--';
  }
  
  // Update GPS and heading for satellite mode
  if (document.getElementById('gps') && data.gps) {
    document.getElementById('gps').textContent = data.gps;
  }
  if (document.getElementById('heading') && data.heading) {
    document.getElementById('heading').textContent = data.heading;
  }
  
  // Update timestamp
  if (document.getElementById('updated')) {
    const now = new Date();
    document.getElementById('updated').textContent = now.toLocaleTimeString();
  }
}

export function updateLocation(data) {
  if (document.getElementById('eta')) {
    document.getElementById('eta').textContent = data.eta || '--';
  }
  if (document.getElementById('distance')) {
    document.getElementById('distance').textContent = data.distance || '--';
  }
}

// Set up MQTT message handler
mqttClient.on('message', (topic, message) => {
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
});