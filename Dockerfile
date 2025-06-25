# Base image
FROM node:20

# Set working directory
WORKDIR /app

# Copy files
COPY package*.json ./
RUN npm install

COPY . .

# Build the React app
RUN npm run build

# Serve with static server
RUN npm install -g serve
CMD ["serve", "-s", "dist", "-l", "3000"]