#!/bin/bash

# ============================================================================
# Production Environment Setup Script
# ============================================================================
# Updates .env file to use production server IP instead of localhost
# ============================================================================

PRODUCTION_IP="103.17.193.231"
ENV_FILE="/var/www/sub-solution/.env"

echo "Setting up production environment variables..."

# Check if .env exists
if [ ! -f "$ENV_FILE" ]; then
    echo "Creating .env from .env.example..."
    cp /var/www/sub-solution/.env.example "$ENV_FILE"
fi

# Replace localhost with production IP in the LOCAL URLs
echo "Updating service URLs for production..."

# Update all LOCAL URLs to use production IP
sed -i "s|http://localhost:3000|http://$PRODUCTION_IP:3000|g" "$ENV_FILE"
sed -i "s|http://localhost:3001|http://$PRODUCTION_IP:3001|g" "$ENV_FILE"
sed -i "s|http://localhost:3002|http://$PRODUCTION_IP:3002|g" "$ENV_FILE"
sed -i "s|http://localhost:3003|http://$PRODUCTION_IP:3003|g" "$ENV_FILE"
sed -i "s|http://localhost:3004|http://$PRODUCTION_IP:3004|g" "$ENV_FILE"
sed -i "s|http://localhost:3005|http://$PRODUCTION_IP:3005|g" "$ENV_FILE"
sed -i "s|http://localhost:3006|http://$PRODUCTION_IP:3006|g" "$ENV_FILE"
sed -i "s|http://localhost:3007|http://$PRODUCTION_IP:3007|g" "$ENV_FILE"
sed -i "s|http://localhost:3008|http://$PRODUCTION_IP:3008|g" "$ENV_FILE"

# Also update database URLs
sed -i "s|localhost:3009|$PRODUCTION_IP:3009|g" "$ENV_FILE"
sed -i "s|localhost:3010|$PRODUCTION_IP:3010|g" "$ENV_FILE"

# Update frontend API URL
sed -i "s|NEXT_PUBLIC_API_URL=.*|NEXT_PUBLIC_API_URL=http://$PRODUCTION_IP:3001|g" "$ENV_FILE"

echo "Production environment setup complete!"
echo "Services will be accessible at:"
echo "  Frontend: http://$PRODUCTION_IP:3000"
echo "  API Gateway: http://$PRODUCTION_IP:3001"
echo "  API Docs: http://$PRODUCTION_IP:3001/api-docs"