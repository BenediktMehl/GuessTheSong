import { type ChildProcess, spawn } from 'child_process';
import { resolve as pathResolve } from 'path';

// Use process.cwd() to get the repo root when running from the repo root
// This works because Playwright runs from the repo root
const repoRoot = process.cwd();
const frontendDir = pathResolve(repoRoot, 'frontend');
const backendDir = pathResolve(repoRoot, 'backend');

let backendServer: ChildProcess | null = null;
let frontendServer: ChildProcess | null = null;

/**
 * Wait for a server to be ready by checking if it responds to HTTP requests
 */
async function waitForServer(url: string, timeout = 30000, interval = 500): Promise<void> {
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

    // Start backend server using node directly from the backend directory
    // Node.js will automatically look for node_modules in the cwd and parent directories
    // Using absolute path to node to ensure it works in CI
    const nodeExecutable = process.execPath; // Use the same node that's running the tests

    backendServer = spawn(nodeExecutable, ['index.js'], {
      cwd: backendDir, // This ensures node looks for node_modules in backend/
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
 * Uses a child process (like backend) to ensure proper dependency resolution
 */
export async function startFrontendServer(port: number): Promise<number> {
  if (frontendServer) {
    throw new Error('Frontend server is already running');
  }

  // Store frontend port in environment
  process.env.FRONTEND_PORT = port.toString();

  return new Promise((resolve, reject) => {
    // Set environment variables for E2E test mode
    const backendPort = process.env.BACKEND_PORT || '8081';
    const env = {
      ...process.env,
      NODE_ENV: 'test',
      VITE_WS_URL: `ws://127.0.0.1:${backendPort}`,
      PORT: port.toString(),
      HOST: '127.0.0.1',
    };

    // Use npx from the frontend directory - this will use frontend's node_modules
    // npx resolves executables from local node_modules first
    const devEnv = {
      ...env,
      VITE_PORT: port.toString(),
    };

    // Use npx vite which will find vite in frontend/node_modules/.bin
    // The --yes flag prevents npx from prompting if the package isn't installed
    frontendServer = spawn(
      'npx',
      ['--yes', '--prefix', frontendDir, 'vite', '--port', port.toString(), '--host', '127.0.0.1'],
      {
        cwd: frontendDir, // Run from frontend directory
        env: devEnv,
        stdio: ['ignore', 'pipe', 'pipe'],
        shell: false,
      }
    );

    let serverReady = false;
    let outputBuffer = '';

    const checkReady = () => {
      if (serverReady) return;
      // Check if server is ready (Vite dev server messages)
      if (
        outputBuffer.includes('Local:') ||
        outputBuffer.includes(`http://127.0.0.1:${port}`) ||
        outputBuffer.includes('ready in')
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

    frontendServer.stdout?.on('data', (data: Buffer) => {
      const output = data.toString();
      outputBuffer += output;
      checkReady();
    });

    frontendServer.stderr?.on('data', (data: Buffer) => {
      const output = data.toString();
      outputBuffer += output;
      // Always log stderr to help debug issues
      if (!serverReady) {
        console.error(`Frontend server stderr: ${output}`);
      }
      checkReady();
    });

    frontendServer.on('error', (error) => {
      reject(new Error(`Failed to start frontend server: ${error.message}`));
    });

    frontendServer.on('exit', (code, signal) => {
      if (code !== null && code !== 0 && !serverReady) {
        reject(
          new Error(
            `Frontend server exited with code ${code}${signal ? ` and signal ${signal}` : ''}`
          )
        );
      }
    });

    // Timeout if server doesn't start within 60 seconds (frontend can take longer)
    setTimeout(() => {
      if (!serverReady) {
        reject(new Error('Frontend server failed to start within timeout'));
      }
    }, 60000);
  });
}

/**
 * Stop all servers
 */
export async function stopServers(): Promise<void> {
  const promises: Promise<void>[] = [];

  // Stop frontend server
  if (frontendServer) {
    promises.push(
      new Promise<void>((resolve) => {
        if (frontendServer) {
          const server = frontendServer;
          server.on('exit', () => {
            frontendServer = null;
            resolve();
          });
          server.kill('SIGTERM');
          // Force kill after 5 seconds if it doesn't exit gracefully
          setTimeout(() => {
            if (frontendServer === server) {
              server.kill('SIGKILL');
              frontendServer = null;
              resolve();
            }
          }, 5000);
        } else {
          resolve();
        }
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
