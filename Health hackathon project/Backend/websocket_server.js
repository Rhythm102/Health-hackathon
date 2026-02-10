#!/usr/bin/env node

/**
 * RescueLink WebSocket Server (Node.js)
 * This runs on the SERVER, not in the browser
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
        console.log(`✅ Loaded ${this.messages.length} messages from database`);
      } else {
        console.log('📁 No message database found, starting fresh');
        this.messages = [];
      }
    } catch (err) {
      console.error('❌ Error loading messages:', err.message);
      this.messages = [];
    }
  },
  
  save() {
    try {
      fs.writeFileSync(MESSAGE_DB_FILE, JSON.stringify(this.messages, null, 2), 'utf-8');
    } catch (err) {
      console.error('❌ Error saving messages:', err.message);
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
    
    if (this.messages.length > MESSAGE_HISTORY_MAX) {
      this.messages = this.messages.slice(-MESSAGE_HISTORY_MAX);
    }
    
    this.save();
    return message;
  },
  
  getRecent(limit = 100) {
    return this.messages.slice(-limit);
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
        clients.get(clientId).type = message.clientType;
        console.log(`👤 Client ${clientId} identified as: ${message.clientType}`);
        
        // Send confirmation
        ws.send(JSON.stringify({
          type: 'identified',
          clientId: clientId,
          clientType: message.clientType
        }));
        
        // Send message history
        try {
          const recentMessages = messageDatabase.getRecent(100);
          if (recentMessages.length) {
            ws.send(JSON.stringify({ type: 'history', messages: recentMessages }));
            console.log(`📚 Sent ${recentMessages.length} messages to ${clientId}`);
          }
        } catch (err) {
          console.error('❌ Failed to send history', err);
        }
        return;
      }
      
      // Handle chat messages
      if (message.type === 'chat') {
        console.log(`💬 ${message.sender}: ${message.text.substring(0, 50)}...`);
        
        // Store message
        messageDatabase.add(message.sender, message.text, message.timestamp);
        
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
      
    } catch (error) {
      console.error('❌ Error processing message:', error);
    }
  });

  // Handle disconnect
  ws.on('close', () => {
    const client = clients.get(clientId);
    console.log(`👋 Client disconnected: ${clientId} (${client?.type || 'unknown'})`);
    clients.delete(clientId);
  });

  // Handle errors
  ws.on('error', (error) => {
    console.error(`❌ WebSocket error for ${clientId}:`, error);
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

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down server...');
  
  messageDatabase.save();
  console.log('💾 Messages saved');
  
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
}, 30000);