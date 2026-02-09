// MQTT Connection
const client = mqtt.connect("wss://broker.hivemq.com:8884/mqtt");

const TOPIC = "rescue/messages/P-8492";

// Track current mode
let currentMode = 'gps';

// Get elements for both modes
const chatBodyGps = document.getElementById("chatBody");
const chatBodySat = document.getElementById("chatBodySat");
const inputGps = document.getElementById("messageInput");
const inputSat = document.getElementById("messageInputSat");
const sendBtnGps = document.getElementById("sendBtn");
const sendBtnSat = document.getElementById("sendBtnSat");

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

// Periodic connection check
setInterval(evaluateConnection, 30000);

// MQTT Connection
client.on("connect", () => {
  console.log("✅ MQTT connected (Messages)");
  client.subscribe(TOPIC, (err) => {
    if (!err) {
      console.log("📡 Subscribed to", TOPIC);
    }
  });
});

client.on("error", (error) => {
  console.error("❌ MQTT Connection Error:", error);
});

// Receive messages
client.on("message", (topic, payload) => {
  try {
    const msg = JSON.parse(payload.toString());
    
    // Don't show our own messages twice (already added locally)
    if (msg.sender === "doctor" && msg.isLocal) {
      return;
    }
    
    addMessage(msg.sender, msg.text, msg.timestamp);
  } catch (error) {
    console.error("Error parsing message:", error);
  }
});

// Send message function
function sendMessage() {
  const input = currentMode === 'gps' ? inputGps : inputSat;
  
  if (!input || !input.value.trim()) return;

  const msg = {
    sender: "doctor",
    text: input.value.trim(),
    timestamp: Date.now(),
    isLocal: true
  };

  // Publish to MQTT
  client.publish(TOPIC, JSON.stringify(msg));
  
  // Add to local chat immediately
  addMessage("doctor", msg.text, msg.timestamp);
  
  // Clear input
  input.value = "";
  
  console.log("📤 Message sent:", msg.text);
}

// Send quick message
window.sendQuickMessage = function(text) {
  const msg = {
    sender: "doctor",
    text: text,
    timestamp: Date.now(),
    isLocal: true
  };

  client.publish(TOPIC, JSON.stringify(msg));
  addMessage("doctor", text, msg.timestamp);
  
  console.log("⚡ Quick message sent:", text);
};

// Add message to chat
function addMessage(sender, text, timestamp) {
  const time = timestamp ? new Date(timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '';
  
  // Add to GPS mode chat
  if (chatBodyGps) {
    const divGps = document.createElement("div");
    divGps.className = `message ${sender}`;
    divGps.innerHTML = `
      <p>${text}</p>
      <span class="timestamp">${time}</span>
    `;
    chatBodyGps.appendChild(divGps);
    chatBodyGps.scrollTop = chatBodyGps.scrollHeight;
  }
  
  // Add to Satellite mode chat
  if (chatBodySat) {
    const divSat = document.createElement("div");
    divSat.className = `message ${sender}`;
    divSat.innerHTML = `
      <p>${text}</p>
      <span class="timestamp">${time}</span>
    `;
    chatBodySat.appendChild(divSat);
    chatBodySat.scrollTop = chatBodySat.scrollHeight;
  }
}

// Event listeners for GPS mode
if (sendBtnGps) {
  sendBtnGps.onclick = sendMessage;
}

if (inputGps) {
  inputGps.addEventListener("keypress", e => {
    if (e.key === "Enter") sendMessage();
  });
}

// Event listeners for Satellite mode
if (sendBtnSat) {
  sendBtnSat.onclick = sendMessage;
}

if (inputSat) {
  inputSat.addEventListener("keypress", e => {
    if (e.key === "Enter") sendMessage();
  });
}

console.log(`💬 Messages page initialized in ${currentMode} mode`);