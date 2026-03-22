FROM node:22-alpine

# Install build dependencies for Postgres tools
RUN apk add --no-cache curl

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install ALL dependencies (including dev dependencies like tsx)
RUN npm install

# Copy the rest of the code
COPY . .

# Expose the API port
EXPOSE 3000

# We will let docker-compose decide which script to run
CMD ["npm", "run", "start:api"]