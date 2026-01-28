// MQTT broker (WebSocket)
const client = mqtt.connect('wss://broker.hivemq.com:8884/mqtt');

client.on('connect', () => {
  console.log("MQTT Connected");

  client.subscribe([
    'patient/P-8492/vitals',
    'patient/P-8492/ecg',
    'ambulance/amb-42/location'
  ]);
});

// Export the client for use in other modules
export { client as mqttClient };
