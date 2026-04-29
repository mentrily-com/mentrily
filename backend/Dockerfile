FROM node:20-alpine AS builder

# Create app directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install app dependencies
RUN npm ci --legacy-peer-deps

# Copy app source
COPY . .

# Build the app
RUN npm run build

# --- Production Image ---
FROM node:20-alpine

WORKDIR /app

# Ensure consistent server timezone for all locale-based formatting
RUN apk add --no-cache tzdata
ENV TZ=Asia/Kathmandu

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/dist ./dist

# Copy and prepare the entrypoint script
COPY docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh

# Expose the API port
EXPOSE 3000

# Start command with migration handling
ENTRYPOINT ["./docker-entrypoint.sh"]
