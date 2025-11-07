#!/bin/bash
# Script to test if Spotify environment variables are accessible in the container

set -e

echo "========================================="
echo "Testing Spotify Environment Variables"
echo "========================================="
echo ""

# Check if container is running
if ! docker compose -f docker-compose.yml -f docker-compose.tls.yml ps | grep -q "guessthesong-backend.*Up"; then
    echo "❌ Container is not running. Please start it first:"
    echo "   docker compose -f docker-compose.yml -f docker-compose.tls.yml up -d"
    exit 1
fi

echo "1. Checking if variables are set (without exposing values)..."
docker compose -f docker-compose.yml -f docker-compose.tls.yml exec -T backend sh -c '
    if [ -n "$SPOTIFY_CLIENT_ID" ]; then
        echo "   ✓ SPOTIFY_CLIENT_ID is SET (length: ${#SPOTIFY_CLIENT_ID} chars)"
    else
        echo "   ✗ SPOTIFY_CLIENT_ID is NOT SET"
    fi
    
    if [ -n "$SPOTIFY_CLIENT_SECRET" ]; then
        echo "   ✓ SPOTIFY_CLIENT_SECRET is SET (length: ${#SPOTIFY_CLIENT_SECRET} chars)"
    else
        echo "   ✗ SPOTIFY_CLIENT_SECRET is NOT SET"
    fi
'

echo ""
echo "2. Testing from Node.js (how the backend accesses them)..."
docker compose -f docker-compose.yml -f docker-compose.tls.yml exec -T backend node -e "
const clientId = process.env.SPOTIFY_CLIENT_ID || '';
const clientSecret = process.env.SPOTIFY_CLIENT_SECRET || '';

console.log('   SPOTIFY_CLIENT_ID:', clientId ? \`SET (\${clientId.length} chars)\` : 'NOT SET');
console.log('   SPOTIFY_CLIENT_SECRET:', clientSecret ? \`SET (\${clientSecret.length} chars)\` : 'NOT SET');

if (clientId && clientSecret) {
    console.log('   ✓ Both variables are accessible - backend should work correctly');
} else {
    console.log('   ✗ Missing variables - backend will not be able to exchange Spotify tokens');
    process.exit(1);
}
"

echo ""
echo "3. Checking backend logs for Spotify credential messages..."
echo "   (Looking for 'Spotify credentials loaded' or warnings)..."
docker compose -f docker-compose.yml -f docker-compose.tls.yml logs backend 2>&1 | grep -i spotify | tail -5 || echo "   No Spotify-related log messages found"

echo ""
echo "========================================="
echo "Test complete!"
echo "========================================="

