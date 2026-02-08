// MQTT broker (WebSocket)
// Real MQTT connection for production use
const client = mqtt.connect('wss://broker.hivemq.com:8884/mqtt');

client.on('connect', () => {
  console.log("✅ MQTT Connected to broker");

  // Subscribe to all topics
  client.subscribe([
    'patient/P-8492/vitals',
    'patient/P-8492/ecg',
    'ambulance/amb-42/location'
  ], (err) => {
    if (!err) {
      console.log("📡 Subscribed to all topics successfully");
    } else {
      console.error("❌ Subscription error:", err);
    }
  });
});

client.on('error', (error) => {
  console.error("❌ MQTT Connection Error:", error);
});

client.on('reconnect', () => {
  console.log("🔄 Reconnecting to MQTT broker...");
});

client.on('offline', () => {
  console.log("📴 MQTT client offline");
});

client.on('close', () => {
  console.log("🔌 MQTT connection closed");
});

// Export the client for use in other modules
export { client as mqttClient };