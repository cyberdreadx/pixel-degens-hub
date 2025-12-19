# Yoda Wallet - NFT Listing Workaround

## Issue
Yoda wallet browser extension does not currently support NFT/token transfers, only KTA transfers.

**Error:**
```
Error: Cannot read properties of undefined (reading 'account')
at handleResponse (inject.js:39:20)
```

## Solution Implemented

We've added **proactive warnings** and **disabled the listing functionality** for Yoda wallet users:

### 1. Visual Warning in List Dialog
When a Yoda wallet user opens the NFT listing dialog, they see:

> ⚠️ **Yoda Wallet Limitation**
> 
> The Yoda wallet extension does not currently support NFT transfers. To list NFTs, please use a seed phrase wallet instead.

### 2. Warning on NFT Detail Page
Before they even click "List for Sale", they see:

> ⚠️ Yoda wallet cannot list NFTs. Please use seed phrase wallet.

### 3. Button Disabled
The "LIST FOR SALE" button is:
- Disabled for Yoda wallet users
- Shows "NOT SUPPORTED" text
- Has a tooltip explaining why

## For Users

### How to List NFTs with Yoda Wallet Installed

**Option 1: Switch to Seed Phrase Wallet** (Recommended)
1. Disconnect Yoda wallet
2. Click "Connect Wallet"
3. Choose "Create/Import Seed Phrase"
4. Import your seed phrase
5. List your NFT
6. Disconnect and reconnect Yoda wallet when done

**Option 2: Use Different Browser**
1. Open Degen Swap in a browser without Yoda wallet extension
2. Connect with seed phrase
3. List your NFT

**Option 3: Wait for Yoda Wallet Update**
- The Yoda wallet team needs to add token transfer support
- Check for updates to the Yoda wallet extension

## For Developers

### What We Did

**Files Modified:**

1. **`src/components/ListNFTDialog.tsx`**
   - Added yellow warning banner for Yoda users
   - Disabled "List for Sale" button for Yoda
   - Changed button text to "NOT SUPPORTED (YODA)"

2. **`src/pages/NFTDetail.tsx`**
   - Added `walletType` to useWallet hook
   - Added warning message before "List for Sale" button
   - Disabled button for Yoda users

3. **`src/contexts/WalletContext.tsx`**
   - Added token parameter to Yoda sendTransaction
   - Added comprehensive error handling
   - Added detailed logging for debugging

### Code Examples

**ListNFTDialog Warning:**
```tsx
{walletType === 'yoda' && (
  <div className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded">
    <span className="text-yellow-500">⚠️</span>
    <p>Yoda wallet doesn't support NFT transfers.</p>
    <p>Please use seed phrase wallet instead.</p>
  </div>
)}
```

**NFTDetail Warning:**
```tsx
{owner.isYou && !owner.isAnchor && (
  <>
    {walletType === 'yoda' && (
      <div className="text-yellow-300">
        ⚠️ Yoda wallet cannot list NFTs. Please use seed phrase wallet.
      </div>
    )}
    <Button 
      disabled={walletType === 'yoda'}
      onClick={() => setShowListDialog(true)}
    >
      {walletType === 'yoda' ? 'NOT SUPPORTED' : 'LIST FOR SALE'}
    </Button>
  </>
)}
```

### Why This Approach

1. **Prevents Errors** - Users can't trigger the error anymore
2. **Clear Communication** - Users know why it's not working
3. **Provides Solution** - Users know how to work around it
4. **Non-Breaking** - Yoda wallet still works for everything else

## What Yoda Wallet Needs to Fix

The Yoda wallet team needs to update their `sendTransaction` API to support token transfers:

```javascript
// Current (KTA only):
yoda.sendTransaction({ to, amount })

// Needed (tokens/NFTs):
yoda.sendTransaction({ to, amount, token })
```

See `YODA_WALLET_LIMITATIONS.md` for full technical details.

## Testing

**To verify the fix is working:**

1. Connect with Yoda wallet
2. Navigate to an NFT you own
3. You should see:
   - ⚠️ Warning message in yellow
   - "NOT SUPPORTED" button (disabled)
4. Click "LIST FOR SALE" - dialog opens with warning
5. Button says "NOT SUPPORTED (YODA)" and is disabled

**To test with seed phrase:**
1. Disconnect Yoda wallet
2. Connect with seed phrase
3. "LIST FOR SALE" button should be enabled
4. Listing should work normally

## Status

✅ **Issue Prevented** - Users can't trigger the error
✅ **Users Informed** - Clear warnings shown
✅ **Workaround Provided** - Switch to seed phrase wallet
⏳ **Waiting** - For Yoda wallet to add token transfer support

---

**Updated:** December 17, 2025
**Status:** Workaround Active
