#!/bin/bash

echo "🚀 Deploying NFT Recovery Functions..."
echo ""

# Check if supabase CLI is available
if ! command -v supabase &> /dev/null; then
    echo "❌ Supabase CLI not found!"
    echo "Please install it with: npm install -g supabase"
    exit 1
fi

echo "✅ Supabase CLI ready"
echo ""

# Deploy fx-cancel-listing
echo "📦 Deploying fx-cancel-listing..."
supabase functions deploy fx-cancel-listing

if [ $? -ne 0 ]; then
    echo "❌ Failed to deploy fx-cancel-listing"
    exit 1
fi

echo "✅ fx-cancel-listing deployed"
echo ""

# Deploy fx-recover-nft
echo "📦 Deploying fx-recover-nft..."
supabase functions deploy fx-recover-nft

if [ $? -ne 0 ]; then
    echo "❌ Failed to deploy fx-recover-nft"
    exit 1
fi

echo "✅ fx-recover-nft deployed"
echo ""

echo "🎉 All functions deployed successfully!"
echo ""
echo "🔐 Make sure these secrets are set:"
echo "   - ANCHOR_WALLET_SEED (for mainnet)"
echo "   - ANCHOR_WALLET_SEED_TESTNET (for testnet)"
echo ""
echo "🧪 To recover your stuck NFT:"
echo "   1. Go to: http://localhost:8080/recover"
echo "   2. Click 'SCAN ESCROW WALLET' to see stuck NFTs"
echo "   3. Or check 'Your Cancelled Listings' section"
echo "   4. Click 'RECOVER THIS NFT' on your stuck NFT"
echo ""

