import { spawn, ChildProcess } from 'node:child_process';
import { createServer as createViteServer, ViteDevServer } from 'vite';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = resolve(__dirname, '../..');
const frontendDir = resolve(repoRoot, 'frontend');
const backendDir = resolve(repoRoot, 'backend');

let backendServer: ChildProcess | null = null;
let frontendServer: ViteDevServer | null = null;

/**
 * Wait for a server to be ready by checking if it responds to HTTP requests
 */
async function waitForServer(
  url: string,
  timeout = 30000,
  interval = 500
): Promise<void> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    try {
      const response = await fetch(url);
      if (response.ok || response.status === 200) {
        return;
      }
    } catch {
      // Server not ready yet, wait and retry
      await new Promise((resolve) => setTimeout(resolve, interval));
    }
  }

  throw new Error(`Server at ${url} did not become ready within ${timeout}ms`);
}

/**
 * Start the backend server on a specific port
 */
export async function startBackendServer(port: number): Promise<number> {
  if (backendServer) {
    throw new Error('Backend server is already running');
  }

  // Store backend port in environment for frontend server to use
  process.env.BACKEND_PORT = port.toString();

  return new Promise((resolve, reject) => {
    // Set environment variables for E2E test mode
    // E2E_TEST env var allows server to start even when NODE_ENV=test
    const env = {
      ...process.env,
      NODE_ENV: 'test',
      E2E_TEST: 'true',
      PORT: port.toString(),
      HOST: '127.0.0.1',
      WS_USE_TLS: 'false',
    };

    // Start backend server as a child process
    // Use npm start or node directly - check if we need to build first
    backendServer = spawn('node', ['index.js'], {
      cwd: backendDir,
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: false,
    });

    let serverReady = false;
    let outputBuffer = '';

    const checkReady = () => {
      if (serverReady) return;
      // Check if server is ready (listening message)
      if (
        outputBuffer.includes('listening on') ||
        outputBuffer.includes('backend listening') ||
        outputBuffer.includes(`ws://127.0.0.1:${port}`)
      ) {
        serverReady = true;
        // Wait a bit more to ensure server is fully ready
        setTimeout(() => {
          waitForServer(`http://127.0.0.1:${port}`)
            .then(() => resolve(port))
            .catch(reject);
        }, 1000);
      }
    };

    backendServer.stdout?.on('data', (data: Buffer) => {
      const output = data.toString();
      outputBuffer += output;
      checkReady();
    });

    backendServer.stderr?.on('data', (data: Buffer) => {
      const output = data.toString();
      outputBuffer += output;
      // Log errors but don't fail unless it's a critical error
      if (output.includes('Error') && !serverReady && !output.includes('Warning')) {
        console.error(`Backend server error: ${output}`);
      }
      checkReady();
    });

    backendServer.on('error', (error) => {
      reject(new Error(`Failed to start backend server: ${error.message}`));
    });

    backendServer.on('exit', (code, signal) => {
      if (code !== null && code !== 0 && !serverReady) {
        reject(
          new Error(
            `Backend server exited with code ${code}${signal ? ` and signal ${signal}` : ''}`
          )
        );
      }
    });

    // Timeout if server doesn't start within 30 seconds
    setTimeout(() => {
      if (!serverReady) {
        reject(new Error('Backend server failed to start within timeout'));
      }
    }, 30000);
  });
}

/**
 * Start the frontend Vite dev server on a specific port
 */
export async function startFrontendServer(port: number): Promise<number> {
  if (frontendServer) {
    throw new Error('Frontend server is already running');
  }

  try {
    // Set environment variable for WebSocket URL to point to test backend
    // Get backend port from environment (set by startBackendServer)
    const backendPort = process.env.BACKEND_PORT || '8081';
    // Set VITE_WS_URL before creating server - Vite's loadEnv will pick it up
    process.env.VITE_WS_URL = `ws://127.0.0.1:${backendPort}`;

    // Create Vite server with custom port
    // The vite config uses loadEnv which will pick up VITE_WS_URL from process.env
    frontendServer = await createViteServer({
      configFile: resolve(frontendDir, 'vite.config.ts'),
      server: {
        host: '127.0.0.1',
        port,
        fs: {
          allow: [repoRoot],
        },
      },
      mode: 'test', // Use test mode (loadEnv will load .env.test if it exists)
    });

    // Start the server
    await frontendServer.listen(port);

    // Wait for server to be ready
    await waitForServer(`http://127.0.0.1:${port}`);

    return port;
  } catch (error) {
    throw new Error(
      `Failed to start frontend server: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Stop all servers
 */
export async function stopServers(): Promise<void> {
  const promises: Promise<void>[] = [];

  // Stop frontend server
  if (frontendServer) {
    promises.push(
      frontendServer.close().then(() => {
        frontendServer = null;
      })
    );
  }

  // Stop backend server
  if (backendServer) {
    promises.push(
      new Promise<void>((resolve) => {
        if (backendServer) {
          const server = backendServer;
          server.on('exit', () => {
            backendServer = null;
            resolve();
          });
          server.kill('SIGTERM');
          // Force kill after 5 seconds if it doesn't exit gracefully
          setTimeout(() => {
            if (backendServer === server) {
              server.kill('SIGKILL');
              backendServer = null;
              resolve();
            }
          }, 5000);
        } else {
          resolve();
        }
      })
    );
  }

  await Promise.all(promises);
}

