// WebSocket Connection for Ambulance Messages with Persistence
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

// ============================================================
// MESSAGE PERSISTENCE STORE - THIS WAS MISSING!
// ============================================================
const messageStore = {
  messages: [],
  maxMessages: 100,
  
  load() {
    try {
      const stored = localStorage.getItem('rescuelink_ambulance_messages');
      if (stored) {
        this.messages = JSON.parse(stored);
        console.log(`✅ Loaded ${this.messages.length} messages from localStorage`);
        return this.messages;
      }
      this.messages = [];
      return [];
    } catch (error) {
      console.error('❌ Error loading messages:', error);
      this.messages = [];
      return [];
    }
  },
  
  add(sender, text, timestamp) {
    const message = {
      sender,
      text,
      timestamp: timestamp || Date.now(),
      id: Date.now() + Math.random()
    };
    
    this.messages.push(message);
    
    // Keep only last 100 messages
    if (this.messages.length > this.maxMessages) {
      this.messages = this.messages.slice(-this.maxMessages);
    }
    
    this.save();
    console.log(`💾 Message saved to localStorage (total: ${this.messages.length})`);
    return message;
  },
  
  save() {
    try {
      localStorage.setItem('rescuelink_ambulance_messages', JSON.stringify(this.messages));
      console.log(`✅ Saved ${this.messages.length} messages to localStorage`);
    } catch (error) {
      console.error('❌ Error saving to localStorage:', error);
    }
  },
  
  getAll() {
    return this.messages;
  },
  
  clear() {
    this.messages = [];
    localStorage.removeItem('rescuelink_ambulance_messages');
    console.log('🗑️ All messages cleared from storage');
  }
};

// Load messages immediately on page load
messageStore.load();

// ============================================================
// NOTIFICATION SYSTEM
// ============================================================
const notificationSystem = {
  show(title, options = {}) {
    // Browser notification
    if ('Notification' in window && Notification.permission === 'granted') {
      // Remove emoji from icon/badge as browsers try to fetch them
      const notifOptions = Object.assign({}, options);
      delete notifOptions.icon;
      delete notifOptions.badge;
      new Notification(title, notifOptions);
    }
    
    // Toast notification
    this.showToast(title);
  },
  
  showToast(message) {
    const toast = document.createElement('div');
    toast.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      background: #2563eb;
      color: white;
      padding: 14px 20px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      z-index: 10000;
      font-size: 14px;
      font-weight: 600;
      animation: slideIn 0.3s ease-out;
    `;
    toast.textContent = message;
    document.body.appendChild(toast);
    
    setTimeout(() => {
      toast.style.animation = 'slideOut 0.3s ease-in';
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  },
  
  requestPermission() {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }
};

// Add CSS animations for toast
const style = document.createElement('style');
style.textContent = `
  @keyframes slideIn {
    from { transform: translateX(400px); opacity: 0; }
    to { transform: translateX(0); opacity: 1; }
  }
  @keyframes slideOut {
    from { transform: translateX(0); opacity: 1; }
    to { transform: translateX(400px); opacity: 0; }
  }
`;
document.head.appendChild(style);

// ============================================================
// CONNECTION DETECTION
// ============================================================
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
  connectWebSocket();
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

// ============================================================
// WEBSOCKET CONNECTION
// ============================================================
function connectWebSocket() {
  // Close existing connection if any
  if (ws) {
    ws.close();
  }

  console.log("🔌 Connecting to WebSocket server...");
  
  try {
    ws = new WebSocket('ws://172.25.245.98:8080');

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
        
        if (data.type === 'history') {
          // Receive message history from server
          console.log(`📚 Received ${data.messages.length} historical messages from server`);
          
          // Clear current display
          if (chatBodyGps) chatBodyGps.innerHTML = '';
          if (chatBodySat) chatBodySat.innerHTML = '';
          
          // Display all historical messages WITHOUT re-persisting
          data.messages.forEach(msg => {
            displayMessageOnly(msg.sender, msg.text, msg.timestamp);
          });
        }
        
        if (data.type === 'chat') {
          // Receive NEW message from doctor
          console.log(`💬 Received message from ${data.sender}: ${data.text}`);
          
          // Add to storage AND display
          addMessage(data.sender, data.text, data.timestamp);
          
          // Show notification for incoming messages
          if (data.sender === 'doctor') {
            notificationSystem.show(`🏥 Doctor: ${data.text.substring(0, 50)}${data.text.length > 50 ? '...' : ''}`, {
              body: new Date(data.timestamp).toLocaleTimeString()
            });
          }
        }
        
        if (data.type === 'typing') {
          console.log(`${data.sender} is ${data.isTyping ? 'typing' : 'stopped typing'}...`);
        }
        
      } catch (error) {
        console.error("❌ Error parsing WebSocket message:", error);
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

// ============================================================
// SEND MESSAGE FUNCTION
// ============================================================
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
  
  // Add to local chat AND storage
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

// ============================================================
// MESSAGE DISPLAY FUNCTIONS
// ============================================================

// Display message only (used for history) - NO persistence
function displayMessageOnly(sender, text, timestamp) {
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

// Add message to chat AND storage (used for new messages)
function addMessage(sender, text, timestamp) {
  // Store in localStorage
  messageStore.add(sender, text, timestamp);
  
  // Display on screen
  displayMessageOnly(sender, text, timestamp);
}

// ============================================================
// LOAD MESSAGE HISTORY ON PAGE LOAD
// ============================================================
function loadMessageHistory() {
  const messages = messageStore.getAll();
  
  // Clear chat bodies
  if (chatBodyGps) chatBodyGps.innerHTML = '';
  if (chatBodySat) chatBodySat.innerHTML = '';
  
  // Display all messages
  messages.forEach(msg => {
    displayMessageOnly(msg.sender, msg.text, msg.timestamp);
  });
  
  console.log(`✅ Loaded ${messages.length} messages from history`);
}

// ============================================================
// CLEAR CHAT HISTORY
// ============================================================
window.clearChatHistory = function() {
  if (confirm('⚠️ This will permanently delete all messages. Continue?')) {
    messageStore.clear();
    
    if (chatBodyGps) chatBodyGps.innerHTML = '';
    if (chatBodySat) chatBodySat.innerHTML = '';
    
    notificationSystem.showToast('✅ Chat history cleared');
    console.log('🗑️ Chat history cleared');
  }
};

// ============================================================
// EVENT LISTENERS
// ============================================================

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

// Listen for storage changes from other tabs/windows
window.addEventListener('storage', (event) => {
  if (event.key === 'rescuelink_ambulance_messages' && event.newValue) {
    try {
      const newMessages = JSON.parse(event.newValue);
      messageStore.messages = newMessages;
      
      console.log('📱 Messages synced from other tab/window');
      loadMessageHistory();
    } catch (error) {
      console.error('❌ Error syncing messages:', error);
    }
  }
});

// Listen for page visibility changes
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    console.log('🔴 Page is now hidden - notifications will be shown');
  } else {
    console.log('📱 Page is now visible');
  }
});

// ============================================================
// INITIALIZATION
// ============================================================

// Initialize WebSocket connection
connectWebSocket();

// Load message history when page fully loads
window.addEventListener('load', () => {
  console.log('📋 Loading message history...');
  loadMessageHistory();
  notificationSystem.requestPermission();
});

// Also load if page is already loaded
if (document.readyState === 'complete') {
  loadMessageHistory();
  notificationSystem.requestPermission();
}

console.log(`🚑 Ambulance Messages initialized in ${currentMode} mode with WebSocket + localStorage persistence`);