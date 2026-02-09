// MQTT Connection for Real-Time Map & ETA Updates
export const client = mqtt.connect("wss://broker.hivemq.com:8884/mqtt");

client.on("connect", () => {
  console.log("✅ MQTT connected for map updates");

  // Subscribe to location and ETA for real-time ambulance tracking
  client.subscribe("ambulance/amb-42/location");
  client.subscribe("rescue/eta");
  client.subscribe("rescue/traffic");
  
  console.log("📍 Subscribed to location updates");
  console.log("🏥 Subscribed to ETA updates");
});

client.on("message", (topic, message) => {
  try {
    const data = JSON.parse(message.toString());
    
    // Handle location updates - update map markers
    if (topic === "ambulance/amb-42/location") {
      if (window.updateAmbulancePosition) {
        window.updateAmbulancePosition(data.lat, data.lon);
        console.log(`📍 Location: ${data.lat.toFixed(4)}, ${data.lon.toFixed(4)}`);
      }
    }
    
    // Handle ETA updates - display countdown
    if (topic === "rescue/eta") {
      if (window.updateETA) {
        window.updateETA(data);
        const mins = data.eta_minutes || 0;
        const km = data.remaining_km?.toFixed(2) || 0;
        console.log(`🏥 ETA: ${mins}m | ${km} km remaining`);
      }
    }
    
  } catch (error) {
    console.error("❌ Error parsing MQTT message:", error);
  }
});
