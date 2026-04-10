# --- Stage 1: Build ---
FROM node:22-alpine AS builder
WORKDIR /app

# Copy dependency files
COPY package*.json ./
COPY tsconfig.json ./
COPY prisma ./prisma/

# Install ALL dependencies (including devDeps like typescript and prisma)
RUN npm install

# Copy source code
COPY . .

# 1. Generate Prisma Client (Crucial for TS compilation)
# 2. Compile TypeScript to JavaScript
RUN npx prisma generate
RUN npm run build

# --- Stage 2: Runner ---
FROM node:22-alpine AS runner
WORKDIR /app

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000

# Install only production dependencies
COPY package*.json ./
RUN npm install --only=production

# Copy compiled code from builder
COPY --from=builder /app/dist ./dist
# Copy the generated Prisma client (the engine needs this to talk to the DB)
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

EXPOSE 3000

# Run as non-root user for security
USER node

# Start the application
CMD ["node", "dist/server.js"]