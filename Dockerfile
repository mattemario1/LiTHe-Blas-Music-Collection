# Base image
FROM node:20

# Set working directory
WORKDIR /app

# Install backend dependencies
COPY server/package*.json ./server/
COPY server/service-account.json ./server/
RUN cd server && npm install

# Copy full frontend source before building
COPY client ./client/
RUN cd client && npm install && npm run build

# Copy backend source
COPY server ./server/

# Install serve for frontend
RUN npm install -g serve concurrently

# Create uploads directory in container (will be overridden by mount)
RUN mkdir -p /app/server/uploads

# Expose ports
EXPOSE 3000 5000

CMD ["concurrently", "\"node server/server.js\"", "\"serve -s client/dist -l 3000\""]