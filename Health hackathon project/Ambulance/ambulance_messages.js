// WebSocket Connection for Ambulance Messages
let ws = null;
let reconnectInterval = null;
let ecgSendInterval = null;

// Get elements
const chatBody = document.getElementById("chatBody");
const input = document.getElementById("messageInput");
const sendBtn = document.getElementById("sendBtn");

// Message persistence store
const messageStore = {
  messages: [],
  maxMessages: 100,
  
  load() {
    try {
      const stored = localStorage.getItem('rescuelink_ambulance_messages');
      if (stored) {
        this.messages = JSON.parse(stored);
        console.log(`✅ Loaded ${this.messages.length} messages from storage`);
      }
    } catch (error) {
      console.error('❌ Error loading messages:', error);
      this.messages = [];
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
    return message;
  },
  
  save() {
    try {
      localStorage.setItem('rescuelink_ambulance_messages', JSON.stringify(this.messages));
    } catch (error) {
      console.error('❌ Error saving messages:', error);
    }
  },
  
  getAll() {
    return this.messages;
  },
  
  clear() {
    this.messages = [];
    localStorage.removeItem('rescuelink_ambulance_messages');
  }
};

// Notification system
const notificationSystem = {
  show(title, options = {}) {
    // Browser notification
    if ('Notification' in window && Notification.permission === 'granted') {
      // Avoid using emoji as icon/badge (browser may try to fetch them)
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
      background: #1e40af;
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

// ECG waveform generator for ambulance
const ecgGenerator = {
  phase: Math.random() * Math.PI * 2,
  heartRate: 75,
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
      
      // Start sending ECG data every 200ms
      if (ecgSendInterval) clearInterval(ecgSendInterval);
      ecgSendInterval = setInterval(() => {
        if (ws && ws.readyState === WebSocket.OPEN) {
          const ecgData = ecgGenerator.generateSamples(12);
          ws.send(JSON.stringify({
            type: 'ecg',
            sender: 'ambulance',
            samples: ecgData,
            timestamp: Date.now()
          }));
        }
      }, 200);
      
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

// Add message to chat and persist
function addMessage(sender, text, timestamp) {
  // Persist message
  const msg = messageStore.add(sender, text, timestamp);
  const time = new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
  
  // Show notification for incoming messages from hospital
  if (sender === 'doctor') {
    notificationSystem.show(`🏥 Doctor: ${text.substring(0, 50)}${text.length > 50 ? '...' : ''}`, {
      body: time
    });
    
    // Trigger notification even if page not focused
    if (document.hidden) {
      console.log("📱 Page hidden - notification triggered");
    }
  }
  
  if (chatBody) {
    const div = document.createElement("div");
    div.className = `message ${sender}`;
    div.innerHTML = `
      <div>${text}</div>
      <div class="message-time">${time}</div>
      ${sender === 'ambulance' ? '<div class="message-sender">AMB-12</div>' : ''}
    `;
    chatBody.appendChild(div);
    chatBody.scrollTop = chatBody.scrollHeight;
  }
}

// Display stored messages WITHOUT re-persisting
function displayStoredMessages(messages) {
  // Clear chat body first
  if (chatBody) chatBody.innerHTML = '';
  
  // Display all stored messages
  messages.forEach(msg => {
    const time = new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    
    if (chatBody) {
      const div = document.createElement("div");
      div.className = `message ${msg.sender}`;
      div.innerHTML = `
        <div>${msg.text}</div>
        <div class="message-time">${time}</div>
        ${msg.sender === 'ambulance' ? '<div class="message-sender">AMB-12</div>' : ''}
      `;
      chatBody.appendChild(div);
    }
  });
  
  // Auto-scroll to bottom
  if (chatBody) chatBody.scrollTop = chatBody.scrollHeight;
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
    
    if (chatBody) chatBody.innerHTML = '';
    
    notificationSystem.showToast('✅ Chat history cleared');
    console.log('🗑️ Chat history cleared');
  }
};

// Event listeners
if (sendBtn) {
  sendBtn.onclick = sendMessage;
}

if (input) {
  input.addEventListener("keypress", e => {
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
      
      // Only reload if on messages page
      if (document.body.contains(chatBody)) {
        loadMessageHistory();
      }
    } catch (error) {
      console.error('❌ Error syncing messages:', error);
    }
  }
});

// Listen for page visibility changes
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    console.log('📴 Page is now hidden - notifications will be shown');
  } else {
    console.log('📱 Page is now visible');
  }
});

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

console.log('🚑 Ambulance Messages page initialized with WebSocket');