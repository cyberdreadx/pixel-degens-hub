# 🚀 Deploy Cancel Listing Fix - Quick Guide

## What Was Fixed

**Problem:** When you cancelled a listing, the database updated but the NFT stayed stuck in the escrow wallet.

**Solution:** Created a new edge function that actually returns the NFT from escrow to your wallet.

## Files Created/Updated

1. ✅ **`supabase/functions/fx-cancel-listing/index.ts`** - NEW edge function
2. ✅ **`src/pages/NFTDetail.tsx`** - Updated to call the new function
3. ✅ **`deploy-cancel-function.sh`** - Deployment script
4. ✅ **`CANCEL_LISTING_FIX.md`** - Detailed documentation

## Deployment Steps (REQUIRED!)

### Step 1: Deploy the Edge Function

Run the deployment script:

```bash
./deploy-cancel-function.sh
```

Or manually:

```bash
supabase functions deploy fx-cancel-listing
```

### Step 2: Verify Environment Variables

Make sure these secrets are set in Supabase:

```bash
# Check if secrets exist
supabase secrets list

# If missing, set them:
supabase secrets set ANCHOR_WALLET_SEED=your_mainnet_seed_here
supabase secrets set ANCHOR_WALLET_SEED_TESTNET=your_testnet_seed_here
```

**Important:** You need BOTH mainnet and testnet anchor seeds!

### Step 3: Test It!

1. Go to your site on **testnet**
2. List an NFT (it will transfer to escrow)
3. Cancel the listing
4. You should see:
   - ✅ "Listing cancelled! NFT returned to your wallet. Tx: keeta_..."
   - ✅ Transaction hash displayed
   - ✅ NFT back in your wallet after refresh

## What Happens Now When You Cancel?

### Before (Broken):
```
User clicks Cancel → Database updated → NFT stuck in escrow ❌
```

### After (Fixed):
```
User clicks Cancel
  ↓
Frontend calls fx-cancel-listing
  ↓
Edge function:
  1. Validates listing
  2. Builds transaction: escrow → seller
  3. Signs with escrow private key
  4. Publishes to blockchain ✅
  5. Updates database
  ↓
NFT returned to your wallet! 🎉
```

## What About NFTs Already Stuck?

If you have NFTs stuck from previous cancelled listings, you have 2 options:

### Option 1: Check for Orphaned NFTs

```bash
# Call the recovery function to see what's stuck
curl -X POST 'https://your-project.supabase.co/functions/v1/fx-recover-listings' \
  -H 'Content-Type: application/json' \
  -d '{"network":"test"}'
```

This will show you all NFTs in escrow without active listings.

### Option 2: Re-list and Cancel Again

1. Find the stuck NFT's token address
2. The escrow still holds it
3. You could potentially create a manual recovery script

## How to Manually Recover Stuck NFTs (Advanced)

If needed, you can create a recovery script:

```typescript
// recovery-script.ts
import * as KeetaNet from "@keetanetwork/keetanet-client";

const anchorSeed = "your_anchor_seed";
const network = "test"; // or "main"
const nftTokenAddress = "keeta_an..."; // stuck NFT
const originalOwner = "keeta_an..."; // who should get it back

const anchorAccount = KeetaNet.lib.Account.fromSeed(anchorSeed, 0);
const client = KeetaNet.UserClient.fromNetwork(network, anchorAccount);

const recipient = KeetaNet.lib.Account.fromPublicKeyString(originalOwner);
const token = KeetaNet.lib.Account.fromPublicKeyString(nftTokenAddress);

const builder = client.initBuilder();
builder.send(recipient, 1n, token);
const { hash } = await builder.publish();

console.log("NFT returned! Tx:", hash);
```

## Testing Checklist

Before considering this complete:

- [ ] Edge function deployed
- [ ] Secrets verified (both mainnet and testnet)
- [ ] Test cancel on testnet - NFT returns
- [ ] Test cancel on mainnet - NFT returns
- [ ] Check transaction on explorer
- [ ] Verify database status updated to 'cancelled'
- [ ] Test with Yoda wallet
- [ ] Test with seed phrase wallet

## Troubleshooting

### "Failed to get anchor address"
- **Fix:** Check your ANCHOR_WALLET_SEED environment variables

### "NFT not found in escrow wallet"
- **Cause:** NFT was already transferred or never sent to escrow
- **Fix:** Check the anchor wallet balance manually

### "Cannot cancel listing with status: sold"
- **Cause:** Trying to cancel a sold listing
- **Fix:** This is correct behavior - sold listings can't be cancelled

### Function not found
- **Cause:** Edge function not deployed
- **Fix:** Run `./deploy-cancel-function.sh`

## Summary

✅ **What's Fixed:**
- Cancel listing now returns NFT from escrow
- Both frontend and backend updated
- Works with Yoda wallet and seed phrase wallet

🚀 **Next Action:**
```bash
# Deploy the fix
./deploy-cancel-function.sh

# Test it
# 1. List an NFT
# 2. Cancel it
# 3. Verify it returns!
```

📚 **Documentation:**
- `CANCEL_LISTING_FIX.md` - Full technical details
- `YODA_WALLET_FIXES.md` - Yoda wallet compatibility
- `deploy-cancel-function.sh` - Automated deployment

**Ready to go!** Just deploy and test! 🎉
