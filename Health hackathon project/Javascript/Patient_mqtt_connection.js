// MQTT connection for Patient Profile page
export const client = mqtt.connect("wss://broker.hivemq.com:8884/mqtt");

client.on("connect", () => {
  console.log("✅ MQTT connected (Patient Profile)");

  client.subscribe("rescue/patient/profile", (err) => {
    if (!err) {
      console.log("📡 Subscribed to rescue/patient/profile");
    }
  });

  client.subscribe("rescue/patient/vitals", (err) => {
    if (!err) {
      console.log("📡 Subscribed to rescue/patient/vitals");
    }
  });
});

client.on("error", (error) => {
  console.error("❌ MQTT Connection Error:", error);
});

client.on("reconnect", () => {
  console.log("🔄 Reconnecting to MQTT broker...");
});

client.on("offline", () => {
  console.log("📴 MQTT client offline");
});

client.on("close", () => {
  console.log("🔌 MQTT connection closed");
});