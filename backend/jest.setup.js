// Start the server before running tests
const http = require('node:http');

// Set environment variables for testing
process.env.NODE_ENV = 'test';
process.env.PORT = '8080';
process.env.HOST = 'localhost';
process.env.WS_USE_TLS = 'false';

// Import server modules (they won't auto-start because NODE_ENV=test)
const { httpServer, ws: wsServer, cleanupForTests } = require('./index.js');

// Wait for server to be ready
const waitForServer = () => {
  return new Promise((resolve) => {
    const checkServer = () => {
      const req = http.get('http://localhost:8080', (res) => {
        if (res.statusCode === 200) {
          resolve();
        } else {
          setTimeout(checkServer, 100);
        }
      });
      req.on('error', () => {
        setTimeout(checkServer, 100);
      });
      req.setTimeout(1000, () => {
        req.destroy();
        setTimeout(checkServer, 100);
      });
    };
    checkServer();
  });
};

// Start server and wait for it to be ready
beforeAll(async () => {
  // Start the server manually
  httpServer.listen(8080, 'localhost', () => {
    console.log('Test server started on ws://localhost:8080');
  });

  // Wait up to 10 seconds for server to be ready
  await Promise.race([
    waitForServer(),
    new Promise((_, reject) => setTimeout(() => reject(new Error('Server startup timeout')), 10000)),
  ]);
}, 15000);

// Cleanup: close all connections and servers after all tests
afterAll(async () => {
  // Close all WebSocket connections
  wsServer.clients.forEach((client) => {
    if (client.readyState === 1) { // WebSocket.OPEN
      client.terminate();
    }
  });

  // Clear all timers and sessions
  cleanupForTests();

  // Close WebSocket server
  return new Promise((resolve) => {
    wsServer.close(() => {
      // Close HTTP server
      httpServer.close(() => {
        console.log('Test server closed');
        // Give a moment for any final cleanup operations
        setTimeout(resolve, 100);
      });
    });
  });
});

