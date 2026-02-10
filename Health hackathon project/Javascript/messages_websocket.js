// WebSocket Connection (replaces MQTT for instant messaging)
let ws = null;
let reconnectInterval = null;

// Track current mode
let currentMode = 'gps';

// Message persistence store - MUST be defined FIRST
const messageStore = {
  messages: [],
  maxMessages: 100,
  
  load() {
    try {
      // Migrate legacy key if present
      const legacyKey = 'rescuelink_messages';
      const newKey = 'rescuelink_hospital_messages';
      const legacy = localStorage.getItem(legacyKey);
      const stored = localStorage.getItem(newKey);

      if (stored) {
        this.messages = JSON.parse(stored);
        console.log(`✅ Loaded ${this.messages.length} messages from ${newKey}`);
        return this.messages;
      }

      if (legacy && !stored) {
        try {
          const legacyMsgs = JSON.parse(legacy) || [];
          this.messages = legacyMsgs;
          this.save();
          localStorage.removeItem(legacyKey);
          console.log(`🔁 Migrated ${legacyMsgs.length} messages from legacy key to ${newKey}`);
          return this.messages;
        } catch (err) {
          console.warn('⚠️ Failed to migrate legacy messages', err);
        }
      }

      // nothing found
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
    console.log(`💾 Message saved (total: ${this.messages.length})`);
    return message;
  },
  
  save() {
    try {
      localStorage.setItem('rescuelink_hospital_messages', JSON.stringify(this.messages));
      console.log(`✅ Saved to localStorage: ${this.messages.length} messages`);
    } catch (error) {
      console.error('❌ Error saving to localStorage:', error);
    }
  },
  
  getAll() {
    return this.messages;
  },
  
  clear() {
    this.messages = [];
    localStorage.removeItem('rescuelink_hospital_messages');
    console.log(`🗑️ All messages cleared from storage`);
  }
};

// Load messages immediately
messageStore.load();

// Notification system
const notificationSystem = {
  show(title, options = {}) {
    // Browser notification
    if ('Notification' in window && Notification.permission === 'granted') {
      // Do not pass emoji as icon/badge (browsers attempt to fetch them as URLs)
      const notifOptions = Object.assign({}, options);
      delete notifOptions.icon;
      delete notifOptions.badge;
      new Notification(title, notifOptions);
    }
    
    // Toast notification (visual feedback)
    this.showToast(title);
  },
  
  showToast(message) {
    const toast = document.createElement('div');
    toast.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      background: #059669;
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
    from {
      transform: translateX(400px);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }
  
  @keyframes slideOut {
    from {
      transform: translateX(0);
      opacity: 1;
    }
    to {
      transform: translateX(400px);
      opacity: 0;
    }
  }
`;
document.head.appendChild(style);

// Load messages from storage on page load
messageStore.load();

// Helper function to safely get DOM elements
function getElements() {
  return {
    chatBodyGps: document.getElementById("chatBody"),
    chatBodySat: document.getElementById("chatBodySat"),
    inputGps: document.getElementById("messageInput"),
    inputSat: document.getElementById("messageInputSat"),
    sendBtnGps: document.getElementById("sendBtn"),
    sendBtnSat: document.getElementById("sendBtnSat")
  };
}

let elements = {};

// Import ECG display function
let drawECG = null;

// Try to import ECG module
import('./ecg.js').then(module => {
  drawECG = module.drawECG;
  console.log("✅ ECG module loaded");
}).catch(err => {
  console.warn("⚠️ ECG module not available in messages context");
});

// Display ECG from ambulance
function displayECG(samples) {
  if (drawECG && typeof drawECG === 'function') {
    drawECG(samples);
    console.log("✅ ECG displayed from ambulance data");
  }
}

// ECG waveform generator for ambulance
const ecgGenerator = {
  phase: Math.random() * Math.PI * 2,
  heartRate: 80,
  beatVariation: 0,
  
  generateSamples(numSamples = 15) {
    const samples = [];
    
    // Add slight heart rate variations (±5 bpm)
    this.heartRate += (Math.random() - 0.5) * 2;
    this.heartRate = Math.max(65, Math.min(100, this.heartRate));
    
    // Slowly varying baseline drift
    this.beatVariation = Math.sin(Date.now() * 0.0001) * 0.3;
    
    for (let i = 0; i < numSamples; i++) {
      const t = this.phase / (Math.PI * 2);
      const normalized_t = t % 1.0;
      
      // Add some asymmetry to QRS
      const qrsShift = Math.sin(this.phase * 0.1) * 0.02;
      
      // QRS complex (main spike) - sharp and prominent with variation
      let qrs = 0;
      const qrsStart = 0.35 + qrsShift;
      const qrsEnd = 0.45 + qrsShift;
      if (normalized_t > qrsStart && normalized_t < qrsEnd) {
        const width = qrsEnd - qrsStart;
        const peak = Math.sin((normalized_t - qrsStart) / width * Math.PI);
        qrs = peak * (5.5 + Math.random() * 1);
      }
      
      // P wave (before QRS) - smaller with natural variation
      let p_wave = 0;
      if (normalized_t > 0.12 && normalized_t < 0.28) {
        const width = 0.16;
        const start = 0.15;
        p_wave = Math.sin((normalized_t - start) / width * Math.PI) * (0.6 + Math.random() * 0.3);
      }
      
      // T wave (after QRS) - rounded
      let t_wave = 0;
      if (normalized_t > 0.50 && normalized_t < 0.75) {
        const width = 0.25;
        const start = 0.55;
        t_wave = Math.sin((normalized_t - start) / width * Math.PI) * (1.2 + Math.random() * 0.4);
      }
      
      // ST segment elevation (pathological variation)
      let st_segment = 0;
      if (normalized_t > 0.48 && normalized_t < 0.55) {
        st_segment = 0.1 * Math.sin((normalized_t - 0.48) / 0.07 * Math.PI);
      }
      
      // Multiple noise sources for realism
      const highFreqNoise = (Math.random() - 0.5) * 0.25; // High frequency muscle noise
      const lowFreqNoise = Math.sin(this.phase * 0.05) * 0.2; // Low frequency baseline wander
      const drift = this.beatVariation;
      
      const sample = qrs + p_wave + t_wave + st_segment + highFreqNoise + lowFreqNoise + drift;
      samples.push(parseFloat(Math.max(-8, Math.min(8, sample)).toFixed(2)));
      
      // Advance phase for next sample
      this.phase += (this.heartRate / 60) * (Math.PI * 2) / 100;
      if (this.phase > Math.PI * 2) {
        this.phase -= Math.PI * 2;
      }
    }
    
    return samples;
  }
};

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
    ws = new WebSocket('ws://172.25.245.98:8080');

    ws.onopen = () => {
      console.log("✅ WebSocket connected!");
      
      // Identify as doctor
      ws.send(JSON.stringify({
        type: 'identify',
        clientType: 'doctor'
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
        
        // Receive message history from server and persist locally
        if (data.type === 'history') {
          try {
            const msgs = Array.isArray(data.messages) ? data.messages : [];

            // Normalize incoming messages (ensure id) and merge with local store without duplicates
            const normalized = msgs.map(m => ({
              sender: m.sender,
              text: m.text,
              timestamp: m.timestamp || Date.now(),
              id: m.id || (Date.now() + Math.random())
            }));

            // Build map for dedup (key by sender+timestamp+text)
            const map = new Map();
            // Add local messages first
            messageStore.getAll().forEach(m => {
              const key = `${m.sender}|${m.timestamp}|${m.text}`;
              map.set(key, m);
            });
            // Merge server history
            normalized.forEach(m => {
              const key = `${m.sender}|${m.timestamp}|${m.text}`;
              if (!map.has(key)) map.set(key, m);
            });

            const merged = Array.from(map.values()).sort((a,b) => a.timestamp - b.timestamp);
            messageStore.messages = merged;
            messageStore.save();
            displayStoredMessages(messageStore.getAll());
            console.log(`📚 Merged and stored ${merged.length} messages from server history`);
          } catch (err) {
            console.error('❌ Error processing history message', err);
          }
        }
        
        if (data.type === 'chat') {
          // Receive message from ambulance
          addMessage(data.sender, data.text, data.timestamp);
        }
        
        if (data.type === 'ecg') {
          // Receive ECG waveform from ambulance
          console.log("💓 Received ECG from ambulance:", data.samples.length, "samples");
          displayECG(data.samples);
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
  const e = getElements();
  const input = currentMode === 'gps' ? e.inputGps : e.inputSat;
  
  if (!input || !input.value.trim()) {
    console.warn("⚠️ No input or empty message");
    return;
  }
  
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    console.error("❌ WebSocket not connected");
    alert("Connection lost. Trying to reconnect...");
    connectWebSocket();
    return;
  }

  const message = {
    type: 'chat',
    sender: 'doctor',
    text: input.value.trim(),
    timestamp: Date.now()
  };

  // Send via WebSocket
  ws.send(JSON.stringify(message));
  console.log("📤 Sent via WebSocket:", message.text);
  
  // Add to local chat immediately
  addMessage('doctor', message.text, message.timestamp);
  
  // Clear input
  input.value = "";
  
  console.log("✅ Message added to chat");
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
    sender: 'doctor',
    text: text,
    timestamp: Date.now()
  };

  ws.send(JSON.stringify(message));
  addMessage('doctor', text, message.timestamp);
  
  console.log("⚡ Quick message sent:", text);
};

// Add message to chat and persist
function addMessage(sender, text, timestamp) {
  // Persist message FIRST
  const msg = messageStore.add(sender, text, timestamp);
  const time = new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
  
  console.log(`📨 Adding message from ${sender}: ${text.substring(0, 40)}...`);
  
  // Show notification for incoming messages from ambulance
  if (sender === 'ambulance') {
    notificationSystem.show(`🚑 Ambulance: ${text.substring(0, 50)}${text.length > 50 ? '...' : ''}`, {
      body: time
    });
    
    // Trigger notification even if page not focused
    if (document.hidden) {
      console.log("📱 Page hidden - notification triggered");
    }
  }
  
  // Get fresh element references
  const e = getElements();
  
  // Add to GPS mode chat
  if (e.chatBodyGps) {
    const divGps = document.createElement("div");
    divGps.className = `message ${sender}`;
    divGps.innerHTML = `
      <div>${text}</div>
      <div class="message-time">${time}</div>
    `;
    e.chatBodyGps.appendChild(divGps);
    e.chatBodyGps.scrollTop = e.chatBodyGps.scrollHeight;
  }
  
  // Add to Satellite mode chat
  if (e.chatBodySat) {
    const divSat = document.createElement("div");
    divSat.className = `message ${sender}`;
    divSat.innerHTML = `
      <div>${text}</div>
      <div class="message-time">${time}</div>
    `;
    e.chatBodySat.appendChild(divSat);
    e.chatBodySat.scrollTop = e.chatBodySat.scrollHeight;
  }
}

// Display stored messages WITHOUT re-persisting
function displayStoredMessages(messages) {
  const e = getElements();
  
  // Clear chat bodies first
  if (e.chatBodyGps) e.chatBodyGps.innerHTML = '';
  if (e.chatBodySat) e.chatBodySat.innerHTML = '';
  
  console.log(`📋 Displaying ${messages.length} messages from history`);
  
  // Display all stored messages
  messages.forEach(msg => {
    const time = new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    
    if (e.chatBodyGps) {
      const divGps = document.createElement("div");
      divGps.className = `message ${msg.sender}`;
      divGps.innerHTML = `
        <div>${msg.text}</div>
        <div class="message-time">${time}</div>
      `;
      e.chatBodyGps.appendChild(divGps);
    }
    
    if (e.chatBodySat) {
      const divSat = document.createElement("div");
      divSat.className = `message ${msg.sender}`;
      divSat.innerHTML = `
        <div>${msg.text}</div>
        <div class="message-time">${time}</div>
      `;
      e.chatBodySat.appendChild(divSat);
    }
  });
  
  // Auto-scroll to bottom
  if (e.chatBodyGps) e.chatBodyGps.scrollTop = e.chatBodyGps.scrollHeight;
  if (e.chatBodySat) e.chatBodySat.scrollTop = e.chatBodySat.scrollHeight;
}

// Load and display all persisted messages
function loadMessageHistory() {
  const messages = messageStore.getAll();
  displayStoredMessages(messages);
  console.log(`✅ Loaded ${messages.length} messages from history`);
}

// Clear all messages
window.clearChatHistory = function() {
  if (confirm('⚠️ This will permanently delete all messages. Continue?')) {
    messageStore.clear();
    
    const e = getElements();
    if (e.chatBodyGps) e.chatBodyGps.innerHTML = '';
    if (e.chatBodySat) e.chatBodySat.innerHTML = '';
    
    notificationSystem.showToast('✅ Chat history cleared');
    console.log('🗑️ Chat history cleared');
  }
};

// Setup event listeners - MUST be called after DOM is ready
function setupEventListeners() {
  const e = getElements();
  
  // Event listeners for GPS mode
  if (e.sendBtnGps) {
    e.sendBtnGps.onclick = sendMessage;
    console.log("✅ Setup GPS send button listener");
  }
  
  if (e.inputGps) {
    e.inputGps.addEventListener("keypress", evt => {
      if (evt.key === "Enter") sendMessage();
    });
    console.log("✅ Setup GPS input listener");
  }
  
  // Event listeners for Satellite mode
  if (e.sendBtnSat) {
    e.sendBtnSat.onclick = sendMessage;
    console.log("✅ Setup Satellite send button listener");
  }
  
  if (e.inputSat) {
    e.inputSat.addEventListener("keypress", evt => {
      if (evt.key === "Enter") sendMessage();
    });
    console.log("✅ Setup Satellite input listener");
  }
}

// Listen for storage changes from other tabs/windows
window.addEventListener('storage', (event) => {
  if (event.key === 'rescuelink_hospital_messages' && event.newValue) {
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

// Listen for page visibility changes to show notifications
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    console.log('📴 Page is now hidden - notifications will be shown');
  } else {
    console.log('📱 Page is now visible');
  }
});

// Initialize when DOM is ready
function initializeChat() {
  console.log('🚀 Initializing hospital chat system...');
  
  // Get fresh element references
  elements = getElements();
  
  // Setup event listeners for all buttons
  setupEventListeners();
  
  // Load message history from localStorage
  console.log('📋 Loading message history from storage...');
  loadMessageHistory();
  
  // Request notification permission
  notificationSystem.requestPermission();
  
  // Connect WebSocket
  console.log('🔌 Connecting WebSocket...');
  connectWebSocket();
  
  console.log('✅ Hospital chat system initialized');
}

// Run initialization when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeChat);
} else {
  // DOM is already loaded
  initializeChat();
}

// Also try to initialize on window load
window.addEventListener('load', () => {
  console.log('📍 Page fully loaded');
  loadMessageHistory();
});

console.log('💬 Messages_websocket.js script loaded successfully');