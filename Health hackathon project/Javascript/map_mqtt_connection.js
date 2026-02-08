export const client = mqtt.connect("wss://broker.hivemq.com:8884/mqtt");

client.on("connect", () => {
  console.log("MQTT connected");

  client.subscribe("rescue/eta");
  client.subscribe("rescue/traffic");
});
