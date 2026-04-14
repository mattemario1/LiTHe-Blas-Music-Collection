FROM node:18
WORKDIR /app

# node:18 (Debian) already has Python, make, and g++ available
# and node-gyp can find the Node headers without downloading them
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

# Copy package files and install
COPY server/package*.json ./
RUN npm install --production

# Copy server source
COPY server .

RUN mkdir -p ./uploads

EXPOSE 5000
CMD ["node", "index.js"]
