# 🔧 NFT Recovery Guide - Get Your Stuck NFTs Back!

## Quick Start (What You Need to Do RIGHT NOW)

### Step 1: Deploy the Recovery Functions

```bash
./deploy-recovery-functions.sh
```

This deploys two edge functions:
- `fx-cancel-listing` - For future cancellations (returns NFT automatically)
- `fx-recover-nft` - For recovering NFTs already stuck

### Step 2: Go to the Recovery Page

Open in your browser:
```
http://localhost:8080/recover
```

Or if deployed:
```
https://yoursite.com/recover
```

### Step 3: Connect Your Wallet

Make sure you're connected with the wallet that owns the stuck NFT.

### Step 4: Recover Your NFT

You have 3 options:

#### Option A: Check Your Cancelled Listings (EASIEST)
1. Look at "Your Cancelled Listings" section
2. You should see your cancelled listing(s)
3. Click **"RECOVER THIS NFT"** button
4. Wait for transaction to complete
5. ✅ NFT is back in your wallet!

#### Option B: Scan Escrow Wallet
1. Click **"SCAN ESCROW WALLET"**
2. This shows ALL stuck NFTs in escrow (not just yours)
3. Find your NFT in the list
4. Note the token address
5. Use Manual Recovery (Option C) to get it back

#### Option C: Manual Recovery
1. Get your NFT's token address (starts with `keeta_an...`)
2. Paste it into "NFT Token Address" field
3. Click **"RECOVER NFT"**
4. ✅ Done!

## What Happens When You Recover?

```
1. You click "RECOVER THIS NFT"
   ↓
2. Function checks:
   - NFT is in escrow? ✓
   - You have a cancelled listing for it? ✓
   - Token address matches? ✓
   ↓
3. Transaction built:
   - From: Escrow Wallet
   - To: Your Wallet
   - Amount: 1 NFT
   ↓
4. Transaction signed by escrow and published
   ↓
5. NFT appears in your wallet!
```

## Troubleshooting

### "NFT not found in escrow wallet"

**Possible causes:**
- NFT was already recovered
- NFT was never sent to escrow
- Wrong token address

**Solution:**
1. Check escrow wallet balance manually
2. Verify the token address is correct
3. Make sure you're on the right network (testnet/mainnet)

### "No listing found for this NFT and address"

**Cause:** The NFT wasn't part of a cancelled listing, or listing was deleted

**Solution:**
- Contact support if you believe this is an error
- The NFT might belong to a different address

### "Please connect your wallet"

**Cause:** Wallet not connected

**Solution:** Click "Connect Wallet" in the navigation

### Functions not deployed

**Error:** `Function not found: fx-recover-nft`

**Solution:**
```bash
./deploy-recovery-functions.sh
```

## For Multiple Stuck NFTs

If you have multiple NFTs stuck:

1. Go to `/recover` page
2. Check "Your Cancelled Listings" section
3. You'll see all your cancelled listings
4. Click "RECOVER THIS NFT" on each one
5. Wait for each transaction to complete

## Technical Details

### What the Recovery Function Does

```typescript
// fx-recover-nft does this:
1. Validates inputs (token address, recipient, network)
2. Loads anchor (escrow) wallet with private key
3. Checks if NFT is actually in escrow
4. Verifies you have a cancelled listing for it
5. Builds transaction: escrow → you
6. Signs with escrow's private key
7. Publishes to blockchain
8. Updates database
9. Returns transaction hash
```

### Security

- ✅ Only the original seller can recover
- ✅ NFT must have a cancelled listing record
- ✅ NFT must actually be in escrow
- ✅ Transaction is atomic (all-or-nothing)

### Networks

The recovery works on both:
- ✅ Testnet (`ANCHOR_WALLET_SEED_TESTNET`)
- ✅ Mainnet (`ANCHOR_WALLET_SEED`)

Make sure you're on the correct network!

## Example Recovery Flow

```bash
# 1. Deploy functions
./deploy-recovery-functions.sh

# 2. Open recovery page
# Go to: http://localhost:8080/recover

# 3. Connect wallet
# Click "Connect Wallet" if not already connected

# 4. See your cancelled listings
# "Your Cancelled Listings" section shows:
#
#   Token: keeta_an2x4y6...
#   Price: 100 KTA
#   Cancelled: Dec 16, 2024
#   [RECOVER THIS NFT] <- Click this!

# 5. Transaction processes
# "Recovering NFT from escrow..."
# "NFT recovered! Tx: keeta_tx1234..."

# 6. Refresh your profile/collection
# NFT should appear in your wallet again!
```

## Files Created

- ✅ `supabase/functions/fx-cancel-listing/index.ts` - Auto-return on cancel
- ✅ `supabase/functions/fx-recover-nft/index.ts` - Manual recovery
- ✅ `src/pages/RecoverNFT.tsx` - Recovery UI page
- ✅ `deploy-recovery-functions.sh` - Deploy script
- ✅ `NFT_RECOVERY_GUIDE.md` - This guide

## Next Steps After Recovery

Once you've recovered your NFT:

1. ✅ NFT is back in your wallet
2. You can:
   - View it in your profile
   - List it again (it will work properly now!)
   - Transfer it
   - Keep it

3. Future cancellations will work automatically:
   - The new `fx-cancel-listing` function handles it
   - No more stuck NFTs!

## Get Help

If you're still having issues:

1. Check the browser console for errors
2. Check the Supabase function logs
3. Verify your environment variables are set
4. Make sure you deployed both functions

### Check Function Logs

```bash
# View logs for recovery function
supabase functions logs fx-recover-nft

# View logs for cancel function
supabase functions logs fx-cancel-listing
```

## Summary

✅ **What's Fixed:**
- New recovery page at `/recover`
- View all your cancelled listings
- One-click recovery for stuck NFTs
- Works with both Yoda and seed phrase wallets

🚀 **Action Items:**
1. Run `./deploy-recovery-functions.sh`
2. Go to `/recover` page
3. Click "RECOVER THIS NFT" on your stuck listing
4. Done!

**Your NFT will be back in a few seconds!** 🎉

