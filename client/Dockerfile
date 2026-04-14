# Build stage
FROM node:18 AS builder
WORKDIR /app
COPY client/package*.json ./
COPY client/.npmrc ./

# 1. Install everything (including Rollup binaries) 
# 2. But tell npm to ignore the specific 'canvas' scripts that cause the hang
RUN npm install --ignore-scripts

COPY client .

# Now the native Rollup binary exists, so Vite can run
RUN npm run build

# Production stage
FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY client/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 8080