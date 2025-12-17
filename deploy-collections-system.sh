#!/bin/bash

# Collections System Deployment Script
# Deploys database migrations and edge functions for the collections system

set -e

echo "🚀 Deploying Collections System..."
echo ""

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo -e "${YELLOW}⚠️  Supabase CLI not found. Please install it first.${NC}"
    echo "npm install -g supabase"
    exit 1
fi

# Step 1: Run Database Migrations
echo -e "${BLUE}📊 Step 1: Running database migrations...${NC}"
supabase db push

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Database migrations completed${NC}"
else
    echo -e "${YELLOW}⚠️  Database migration failed. Please check the error above.${NC}"
    exit 1
fi

echo ""

# Step 2: Deploy Edge Functions
echo -e "${BLUE}🔧 Step 2: Deploying edge functions...${NC}"

# Deploy fx-upload-collection
echo "Deploying fx-upload-collection..."
supabase functions deploy fx-upload-collection --no-verify-jwt

# Deploy fx-get-collection
echo "Deploying fx-get-collection..."
supabase functions deploy fx-get-collection --no-verify-jwt

# Deploy fx-update-collection
echo "Deploying fx-update-collection..."
supabase functions deploy fx-update-collection --no-verify-jwt

# Deploy fx-batch-upload (if not already deployed)
echo "Deploying fx-batch-upload..."
supabase functions deploy fx-batch-upload --no-verify-jwt

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Edge functions deployed${NC}"
else
    echo -e "${YELLOW}⚠️  Edge function deployment failed. Please check the error above.${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}🎉 Collections System Deployed Successfully!${NC}"
echo ""
echo "📝 Next Steps:"
echo "  1. Test collection creation at /collection/create"
echo "  2. Browse collections at /collections"
echo "  3. Try batch minting with a test collection"
echo "  4. Verify database tables in Supabase dashboard"
echo ""
echo "📚 Documentation: COLLECTIONS_GUIDE.md"
echo ""
