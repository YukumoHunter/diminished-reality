const express = require('express');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();
const port = 8035;
const target_ip = 'http://0.0.0.0:8094';

// Path to your build folder
const buildPath = path.join(__dirname, 'dist');

// Serve static files
app.use(express.static(buildPath));

// Set up WebSocket proxy for Socket.IO
app.use('/socket.io', createProxyMiddleware({
  target: target_ip,
  changeOrigin: true,
  ws: true
}));

// For SPA routing - serve index.html for any unmatched routes
app.get(/(.*)/, (req, res) => {
  res.sendFile(path.join(buildPath, 'index.html'));
});

// Create HTTPS server
const server = http.createServer(app);

server.listen(port, () => {
  console.log(`Server running at https://chimay.science.uva.nl:${port}`);
  console.log(`Serving content from: ${buildPath}`);
  console.log('WebSocket proxy enabled for /socket.io');
});

// Handle server errors
server.on('error', (error) => {
  console.error('Server error:', error);
});
