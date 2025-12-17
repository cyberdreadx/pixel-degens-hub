#!/bin/bash

# Deploy the cancel listing edge function to Supabase
# This script deploys the fx-cancel-listing function that handles NFT returns from escrow

echo "🚀 Deploying fx-cancel-listing edge function..."
echo ""

# Check if supabase CLI is available
if ! command -v supabase &> /dev/null; then
    echo "❌ Supabase CLI not found!"
    echo "Please install it with: npm install -g supabase"
    exit 1
fi

# Check if logged in
if ! supabase projects list &> /dev/null; then
    echo "❌ Not logged in to Supabase!"
    echo "Please run: supabase login"
    exit 1
fi

echo "✅ Supabase CLI ready"
echo ""

# Deploy the function
echo "📦 Deploying fx-cancel-listing..."
supabase functions deploy fx-cancel-listing

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Successfully deployed fx-cancel-listing!"
    echo ""
    echo "🔐 Important: Verify these secrets are set:"
    echo "   - ANCHOR_WALLET_SEED (for mainnet)"
    echo "   - ANCHOR_WALLET_SEED_TESTNET (for testnet)"
    echo ""
    echo "To check secrets:"
    echo "   supabase secrets list"
    echo ""
    echo "To set a secret:"
    echo "   supabase secrets set ANCHOR_WALLET_SEED=your_seed_here"
    echo ""
    echo "🧪 Test the function:"
    echo "   1. List an NFT on testnet"
    echo "   2. Cancel the listing"
    echo "   3. Verify NFT returns to your wallet"
    echo ""
else
    echo ""
    echo "❌ Deployment failed!"
    echo "Check the error message above for details."
    exit 1
fi
