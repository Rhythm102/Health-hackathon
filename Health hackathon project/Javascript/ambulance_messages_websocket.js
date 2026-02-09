// WebSocket Connection (replaces MQTT for instant messaging)
// WebSocket Connection (replaces MQTT for instant messaging)
let ws = null;
let reconnectInterval = null;

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
  connectWebSocket(); // Reconnect WebSocket
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

// WebSocket Connection
function connectWebSocket() {
  // Close existing connection if any
  if (ws) {
    ws.close();
  }

  console.log("🔌 Connecting to WebSocket server...");
  
  try {
    ws = new WebSocket('ws://localhost:8080');

    ws.onopen = () => {
      console.log("✅ WebSocket connected!");
      
      // Identify as ambulance
      ws.send(JSON.stringify({
        type: 'identify',
        clientType: 'ambulance'
      }));
      
      // Clear reconnect interval
      if (reconnectInterval) {
        clearInterval(reconnectInterval);
        reconnectInterval = null;
      }
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.type === 'connected') {
          console.log("📡", data.message);
        }
        
        if (data.type === 'identified') {
          console.log("👤 Identified as:", data.clientType);
        }
        
        if (data.type === 'chat') {
          // Receive message from doctor
          addMessage(data.sender, data.text, data.timestamp);
        }
        
        if (data.type === 'typing') {
          // Show typing indicator (optional)
          console.log(`${data.sender} is ${data.isTyping ? 'typing' : 'stopped typing'}...`);
        }
        
      } catch (error) {
        console.error("Error parsing WebSocket message:", error);
      }
    };

    ws.onerror = (error) => {
      console.error("❌ WebSocket error:", error);
    };

    ws.onclose = () => {
      console.log("🔌 WebSocket disconnected");
      
      // Attempt to reconnect every 5 seconds
      if (!reconnectInterval) {
        reconnectInterval = setInterval(() => {
          console.log("🔄 Attempting to reconnect...");
          connectWebSocket();
        }, 5000);
      }
    };
    
  } catch (error) {
    console.error("❌ Failed to create WebSocket connection:", error);
  }
}

// Send message function
function sendMessage() {
  const input = currentMode === 'gps' ? inputGps : inputSat;
  
  if (!input || !input.value.trim()) return;
  
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    console.error("❌ WebSocket not connected");
    alert("Connection lost. Trying to reconnect...");
    connectWebSocket();
    return;
  }

  const message = {
    type: 'chat',
    sender: 'ambulance',
    text: input.value.trim(),
    timestamp: Date.now()
  };

  // Send via WebSocket
  ws.send(JSON.stringify(message));
  
  // Add to local chat immediately
  addMessage('ambulance', message.text, message.timestamp);
  
  // Clear input
  input.value = "";
  
  console.log("📤 Message sent:", message.text);
}

// Send quick message
window.sendQuickMessage = function(text) {
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    console.error("❌ WebSocket not connected");
    alert("Connection lost. Trying to reconnect...");
    connectWebSocket();
    return;
  }

  const message = {
    type: 'chat',
    sender: 'ambulance',
    text: text,
    timestamp: Date.now()
  };

  ws.send(JSON.stringify(message));
  addMessage('ambulance', text, message.timestamp);
  
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

// Initialize WebSocket connection
connectWebSocket();

console.log(`🚑 Ambulance Messages page initialized in ${currentMode} mode with WebSocket`);