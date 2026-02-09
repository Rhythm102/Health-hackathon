#!/usr/bin/env node

/**
 * RescueLink WebSocket Server
 * Real-time messaging between hospital and ambulance
 * Run: node websocket_server.js
 */

const WebSocket = require('ws');
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 8080;

// Message database file
const MESSAGE_DB_FILE = path.join(__dirname, 'messages_db.json');
const MESSAGE_HISTORY_MAX = 500;

// In-memory message cache + file persistence
const messageDatabase = {
  messages: [],
  
  load() {
    try {
      if (fs.existsSync(MESSAGE_DB_FILE)) {
        const data = fs.readFileSync(MESSAGE_DB_FILE, 'utf-8');
        const parsed = JSON.parse(data);
        this.messages = Array.isArray(parsed) ? parsed : [];
        console.log(`✅ Loaded ${this.messages.length} messages from database file`);
      } else {
        console.log('📝 Message database file not found, starting fresh');
        this.messages = [];
      }
    } catch (err) {
      console.error('❌ Error loading messages from database:', err);
      this.messages = [];
    }
  },
  
  save() {
    try {
      fs.writeFileSync(MESSAGE_DB_FILE, JSON.stringify(this.messages, null, 2), 'utf-8');
      console.log(`💾 Saved ${this.messages.length} messages to database`);
    } catch (err) {
      console.error('❌ Error saving messages to database:', err);
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
    
    // Trim to max size
    if (this.messages.length > MESSAGE_HISTORY_MAX) {
      this.messages = this.messages.slice(-MESSAGE_HISTORY_MAX);
    }
    
    this.save();
    return message;
  },
  
  getRecent(limit = 100) {
    return this.messages.slice(-limit);
  },
  
  clear() {
    this.messages = [];
    this.save();
    console.log('🗑️ Message database cleared');
  }
};

// Load messages on startup
messageDatabase.load();

// Create HTTP server
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('RescueLink WebSocket Server Running\n');
});

// Create WebSocket server
const wss = new WebSocket.Server({ server });

// Store connected clients
const clients = new Map();

console.log('🚀 RescueLink WebSocket Server Starting...');

wss.on('connection', (ws, req) => {
  const clientId = Math.random().toString(36).substr(2, 9);
  console.log(`✅ New client connected: ${clientId}`);
  
  // Store client
  clients.set(clientId, { ws, type: null });

  // Handle incoming messages
  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString());
      
      // Handle client identification
      if (message.type === 'identify') {
        clients.get(clientId).type = message.clientType; // 'doctor' or 'ambulance'
        console.log(`👤 Client ${clientId} identified as: ${message.clientType}`);
        
        // Send confirmation
        ws.send(JSON.stringify({
          type: 'identified',
          clientId: clientId,
          clientType: message.clientType
        }));
        
        // Send recent message history so client can catch up
        try {
          const recentMessages = messageDatabase.getRecent(100);
          if (recentMessages.length) {
            ws.send(JSON.stringify({ type: 'history', messages: recentMessages }));
            console.log(`📚 Sent ${recentMessages.length} historical messages to ${clientId}`);
          }
        } catch (err) {
          console.error('❌ Failed to send history to client', err);
        }
        return;
      }
      
      // Handle chat messages
      if (message.type === 'chat') {
        console.log(`💬 Message from ${message.sender}: ${message.text.substring(0, 50)}...`);
        
        // Store message in database
        try {
          messageDatabase.add(message.sender, message.text, message.timestamp);
        } catch (err) {
          console.error('❌ Error saving message to database', err);
        }
        
        // Broadcast to all OTHER clients
        clients.forEach((client, id) => {
          if (id !== clientId && client.ws.readyState === WebSocket.OPEN) {
            client.ws.send(JSON.stringify({
              type: 'chat',
              sender: message.sender,
              text: message.text,
              timestamp: message.timestamp || Date.now()
            }));
          }
        });
      }
      
      // Handle ECG waveform data
      if (message.type === 'ecg') {
        console.log(`💓 ECG from ${message.sender}: ${message.samples.length} samples`);
        
        // Broadcast ECG to all OTHER clients
        clients.forEach((client, id) => {
          if (id !== clientId && client.ws.readyState === WebSocket.OPEN) {
            client.ws.send(JSON.stringify({
              type: 'ecg',
              sender: message.sender,
              samples: message.samples,
              timestamp: message.timestamp || Date.now()
            }));
          }
        });
      }
      
      // Handle typing indicators
      if (message.type === 'typing') {
        clients.forEach((client, id) => {
          if (id !== clientId && client.ws.readyState === WebSocket.OPEN) {
            client.ws.send(JSON.stringify({
              type: 'typing',
              sender: message.sender,
              isTyping: message.isTyping
            }));
          }
        });
      }
      
    } catch (error) {
      console.error('❌ Error processing message:', error);
    }
  });

  // Handle client disconnect
  ws.on('close', () => {
    const client = clients.get(clientId);
    console.log(`👋 Client disconnected: ${clientId} (${client?.type || 'unknown'})`);
    clients.delete(clientId);
    
    // Notify other clients
    clients.forEach((client) => {
      if (client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(JSON.stringify({
          type: 'status',
          message: 'A user disconnected',
          activeClients: clients.size
        }));
      }
    });
  });

  // Handle errors
  ws.on('error', (error) => {
    console.error(`❌ WebSocket error for client ${clientId}:`, error);
  });

  // Send welcome message
  ws.send(JSON.stringify({
    type: 'connected',
    message: 'Connected to RescueLink WebSocket Server',
    clientId: clientId,
    activeClients: clients.size
  }));
});

// Start server
server.listen(PORT, () => {
  console.log(`✅ WebSocket Server running on ws://localhost:${PORT}`);
  console.log(`📡 HTTP Server running on http://localhost:${PORT}`);
  console.log(`\n🏥 Hospital: Connect from messages.html`);
  console.log(`🚑 Ambulance: Connect from ambulance_messages.html`);
  console.log(`\nPress Ctrl+C to stop server\n`);
});

// Handle server shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down server...');
  
  // Save messages before shutdown
  messageDatabase.save();
  console.log('💾 Messages saved');
  
  // Close all client connections
  clients.forEach((client, id) => {
    client.ws.close();
  });
  
  wss.close(() => {
    server.close(() => {
      console.log('✅ Server shut down successfully');
      process.exit(0);
    });
  });
});

// Log active connections every 30 seconds
setInterval(() => {
  console.log(`📊 Active connections: ${clients.size}`);
  clients.forEach((client, id) => {
    console.log(`  - ${id}: ${client.type || 'unknown'}`);
  });
}, 30000);