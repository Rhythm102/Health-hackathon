#!/usr/bin/env node

/**
 * RescueLink WebSocket Server
 * Real-time messaging between hospital and ambulance
 * Run: node websocket_server.js
 */

const WebSocket = require('ws');
const http = require('http');

const PORT = 8080;

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
        return;
      }
      
      // Handle chat messages
      if (message.type === 'chat') {
        console.log(`💬 Message from ${message.sender}: ${message.text.substring(0, 50)}...`);
        
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