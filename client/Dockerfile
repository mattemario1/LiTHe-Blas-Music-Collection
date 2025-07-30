# Build stage
FROM node:18-alpine as builder
WORKDIR /app
COPY client/package*.json ./
RUN npm install
COPY client .
RUN npm run build

# Production stage
FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY client/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 8080