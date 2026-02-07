# Backend Dockerfile
FROM node:18-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev

FROM node:18-alpine

WORKDIR /app

# Copy deps and app
COPY --from=builder /app/node_modules ./node_modules
COPY . .

# Fix ownership for non-root user
RUN chown -R node:node /app

EXPOSE 3000

USER node

CMD ["npm", "start"]