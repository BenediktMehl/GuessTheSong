#!/usr/bin/env node

/**
 * Setup script to create .env.local from .env.example
 * 
 * Usage:
 *   node setup-env.js <client-id> <client-secret>
 *   or
 *   node setup-env.js --client-id <id> --client-secret <secret>
 */

const fs = require('node:fs');
const path = require('node:path');

const rootDir = __dirname;
const envExamplePath = path.join(rootDir, '.env.example');
const envLocalPath = path.join(rootDir, '.env.local');

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  let clientId = null;
  let clientSecret = null;

  // Handle --client-id and --client-secret flags
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--client-id' && i + 1 < args.length) {
      clientId = args[i + 1];
      i++;
    } else if (args[i] === '--client-secret' && i + 1 < args.length) {
      clientSecret = args[i + 1];
      i++;
    } else if (args[i] === '--help' || args[i] === '-h') {
      console.log(`
Usage:
  node setup-env.js <client-id> <client-secret>
  node setup-env.js --client-id <id> --client-secret <secret>

Options:
  --client-id <id>       Spotify Client ID
  --client-secret <secret>  Spotify Client Secret
  --help, -h             Show this help message

Examples:
  node setup-env.js abc123 def456
  node setup-env.js --client-id abc123 --client-secret def456
`);
      process.exit(0);
    }
  }

  // Handle positional arguments if flags not used
  if (!clientId && !clientSecret && args.length >= 2) {
    clientId = args[0];
    clientSecret = args[1];
  }

  return { clientId, clientSecret };
}

function main() {
  // Check if .env.example exists
  if (!fs.existsSync(envExamplePath)) {
    console.error(`Error: .env.example not found at ${envExamplePath}`);
    process.exit(1);
  }

  // Check if .env.local already exists
  if (fs.existsSync(envLocalPath)) {
    console.error(`Error: .env.local already exists at ${envLocalPath}`);
    console.error('Please remove it first if you want to recreate it.');
    process.exit(1);
  }

  // Parse arguments
  const { clientId, clientSecret } = parseArgs();

  if (!clientId || !clientSecret) {
    console.error('Error: Both client ID and client secret are required.');
    console.error('\nUsage:');
    console.error('  node setup-env.js <client-id> <client-secret>');
    console.error('  node setup-env.js --client-id <id> --client-secret <secret>');
    console.error('\nUse --help for more information.');
    process.exit(1);
  }

  // Read .env.example
  let envContent = fs.readFileSync(envExamplePath, 'utf-8');

  // Replace placeholder values
  envContent = envContent.replace(
    /SPOTIFY_CLIENT_ID=your_spotify_client_id_here/g,
    `SPOTIFY_CLIENT_ID=${clientId}`
  );
  envContent = envContent.replace(
    /SPOTIFY_CLIENT_SECRET=your_spotify_client_secret_here/g,
    `SPOTIFY_CLIENT_SECRET=${clientSecret}`
  );

  // Write .env.local
  fs.writeFileSync(envLocalPath, envContent, 'utf-8');

  console.log('✓ Created .env.local with your Spotify credentials');
  console.log(`  Client ID: ${clientId.substring(0, 8)}...`);
  console.log(`  Client Secret: ${'*'.repeat(Math.min(clientSecret.length, 8))}...`);
  console.log(`\nFile location: ${envLocalPath}`);
}

main();

