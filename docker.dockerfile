# Use the official Node.js runtime as a parent image
FROM node:14

# Set the working directory to /app
WORKDIR /app

# Copy the package.json and package-lock.json files to the container
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application code to the container
COPY . .

# Expose port 3000 for the Node.js application
EXPOSE 3000

# Set the NODE_ENV environment variable to production
ENV NODE_ENV=production

# Start the Node.js application
CMD ["npm", "start"]
