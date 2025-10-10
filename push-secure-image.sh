#!/bin/bash

# Push Secure Docker Image to Docker Hub
# This script helps you push the built secure image to your Docker Hub account

set -e

echo "╔═══════════════════════════════════════════════════════════╗"
echo "║     Push Secure Image to Docker Hub                      ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo ""

# The image that was just built
BUILT_IMAGE="logistics/secure-3f44f873-1f9a-48e5-a725-2f9f905be5ca:test-client-1760075117663"

echo "Built image found: $BUILT_IMAGE"
echo ""

# Ask for Docker Hub username
read -p "Enter your Docker Hub username: " DOCKER_USERNAME

if [ -z "$DOCKER_USERNAME" ]; then
  echo "❌ Username cannot be empty!"
  exit 1
fi

# Create the target image name
TARGET_IMAGE="$DOCKER_USERNAME/logistics-secure-client:test-client-1760075117663"

echo ""
echo "📋 Push Details:"
echo "  Source: $BUILT_IMAGE"
echo "  Target: $TARGET_IMAGE"
echo ""

# Confirm
read -p "Continue with push? (yes/no): " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
  echo "❌ Push cancelled"
  exit 0
fi

echo ""
echo "🏷️  Tagging image..."
docker tag "$BUILT_IMAGE" "$TARGET_IMAGE"

echo "✓ Tagged successfully!"
echo ""

echo "📤 Pushing to Docker Hub..."
docker push "$TARGET_IMAGE"

echo ""
echo "╔═══════════════════════════════════════════════════════════╗"
echo "║  ✅ SUCCESS! Image pushed to Docker Hub                  ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo ""
echo "📦 Your image is now available at:"
echo "   docker.io/$TARGET_IMAGE"
echo ""
echo "🚀 Client can pull and run with:"
echo "   docker pull $TARGET_IMAGE"
echo ""
echo "   docker run -it \\"
echo "     --name logistics-platform \\"
echo "     -v /var/run/docker.sock:/var/run/docker.sock \\"
echo "     -v logistics-data:/opt/logistics \\"
echo "     -p 3000-3011:3000-3011 \\"
echo "     --privileged \\"
echo "     $TARGET_IMAGE"
echo ""
echo "✓ Done!"
