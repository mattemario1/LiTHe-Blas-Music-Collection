FROM node:18-alpine
WORKDIR /app

# Install dependencies
COPY server/package*.json ./
RUN npm install --production

# Copy app source
COPY server .

# Create uploads directory (will be overridden by volume mount)
RUN mkdir -p ./uploads

EXPOSE 5000
CMD ["node", "server.js"]