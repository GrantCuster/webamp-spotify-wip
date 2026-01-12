#!/bin/bash

# Load environment variables from .env file
if [ ! -f .env ]; then
  echo "Error: .env file not found"
  exit 1
fi

# Source the .env file
export $(grep -v '^#' .env | xargs)

# Check if DEPLOY_TARGET is set
if [ -z "$DEPLOY_TARGET" ]; then
  echo "Error: DEPLOY_TARGET not set in .env file"
  exit 1
fi

# Check if .output directory exists
if [ ! -d .output ]; then
  echo "Error: .output directory not found. Run build first."
  exit 1
fi

echo "Deploying to $DEPLOY_TARGET..."
echo "Copying .output directory..."

# Deploy using scp
scp .env "$DEPLOY_TARGET:~/webamp-spotify/.env"
scp -r .output "$DEPLOY_TARGET:~/webamp-spotify/.output"

if [ $? -eq 0 ]; then
  echo "Deployment successful!"
else
  echo "Deployment failed!"
  exit 1
fi
