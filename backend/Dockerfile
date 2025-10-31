# Multi-stage build for smaller image size
FROM node:22-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --omit=dev

# Production stage
FROM node:22-alpine

WORKDIR /app

# Copy dependencies from builder
COPY --from=builder /app/node_modules ./node_modules

# Copy application code
COPY . .

# Expose WebSocket port
EXPOSE 8080

# Set environment variable
ENV NODE_ENV=production

# Run as non-root user for security
USER node

# Start the application
CMD ["node", "index.js"]
