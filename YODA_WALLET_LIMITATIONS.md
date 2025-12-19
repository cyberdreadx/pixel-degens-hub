# Yoda Wallet Known Limitations

## Issue: NFT/Token Transfers

**Status:** ⚠️ Partially Supported

### Problem
The Yoda wallet browser extension's `sendTransaction` API does not currently support custom token/NFT transfers. When attempting to transfer an NFT (non-KTA token), the following error occurs:

```
Error: Cannot read properties of undefined (reading 'account')
at handleResponse (inject.js:39:20)
```

### Technical Details

**What Works:** ✅
- KTA transfers (native token)
- Balance checking
- Account connection
- Network switching

**What Doesn't Work:** ❌
- NFT transfers
- Custom token transfers
- Listing NFTs for sale (requires NFT transfer to escrow)

### Current Implementation

#### Attempted Fix in `sendTokens()`:
```typescript
const txParams: any = {
  to: recipientAddress,
  amount: '1',
  token: nftTokenAddress // Added token parameter
};

const txHash = await yoda.sendTransaction(txParams);
```

**Result:** Still fails with same error - the Yoda wallet extension doesn't recognize or handle the `token` parameter.

### Workarounds

#### For Users:

1. **Use Seed Phrase Wallet for NFT Operations**
   - Connect with seed phrase instead of Yoda
   - Perform listing/transfer
   - Switch back to Yoda for viewing

2. **Manual Transfer + Database Listing** (Not Implemented)
   - Manually transfer NFT to escrow wallet using Keeta explorer
   - Create listing entry manually in database
   - Requires backend support

#### For Developers:

**Option 1: Disable NFT Listing for Yoda Users**
```typescript
if (walletType === 'yoda') {
  return (
    <Alert>
      NFT listing is not yet supported with Yoda wallet.
      Please use seed phrase wallet for this operation.
    </Alert>
  );
}
```

**Option 2: Implement Two-Step Flow**
1. User transfers NFT manually via Keeta explorer
2. User returns to app and creates listing
3. App verifies NFT is in escrow before creating DB entry

**Option 3: Use Keeta Client Library**
If Yoda wallet exposed the private key or allowed signing arbitrary transactions, we could use `keetanet-client` directly. However, this defeats the purpose of a browser extension wallet.

### What Needs to be Fixed in Yoda Wallet

The Yoda wallet extension needs to:

1. **Support token parameter in sendTransaction:**
   ```typescript
   interface SendTransactionParams {
     to: string;
     amount: string;
     token?: string; // Token address for non-KTA transfers
   }
   ```

2. **Handle token transfers in inject.js:**
   - Check if `token` parameter is provided
   - If yes, perform token transfer instead of KTA transfer
   - Use Keeta client to build token transfer transaction
   - Sign and broadcast transaction

3. **Return proper error messages:**
   - Instead of undefined errors
   - Clear messages like "Token transfers not yet supported"

### Recommendation

**For Yoda Wallet Developer:**

Add token transfer support to the extension's API:

```javascript
// In inject.js or background script
async function sendTransaction({ to, amount, token }) {
  if (token) {
    // Build token transfer transaction
    const builder = client.initBuilder();
    const recipientAccount = Account.fromPublicKeyString(to);
    const tokenAccount = Account.fromPublicKeyString(token);
    
    builder.send(recipientAccount, BigInt(amount), tokenAccount);
    await builder.computeBlocks();
    const result = await builder.publish();
    
    return result.hash;
  } else {
    // Existing KTA transfer logic
    // ...
  }
}
```

### Current Status in Degen Swap

**Implemented:**
- ✅ Error detection and graceful failure
- ✅ Clear error message to user
- ✅ Logs for debugging
- ✅ Attempt to use token parameter (even though it fails)

**User Experience:**
When Yoda wallet users try to list an NFT, they see:
> "Yoda wallet does not yet support NFT transfers via this interface. Please use a seed phrase wallet to list NFTs, or transfer manually and then create the listing."

**Files Modified:**
- `src/contexts/WalletContext.tsx` - Added token parameter to Yoda sendTransaction
- `src/components/ListNFTDialog.tsx` - Added error handling and user message

### Future Solutions

1. **Wait for Yoda Wallet Update**
   - Contact Yoda wallet developer
   - Share this documentation
   - Wait for token transfer support

2. **Implement Manual Listing Flow**
   - User transfers NFT via Keeta explorer
   - User provides transaction hash
   - App verifies transfer and creates listing

3. **Use Alternative Wallet**
   - Recommend seed phrase wallet for sellers
   - Keep Yoda wallet for buyers only

4. **Backend Proxy Transfer**
   - User approves transaction
   - Backend performs transfer using stored keys
   - ⚠️ Less secure, not recommended

### Testing

To test if/when Yoda wallet adds support:

1. Try transferring an NFT:
   ```typescript
   const txHash = await window.yoda.sendTransaction({
     to: 'keeta_...',
     amount: '1',
     token: 'keeta_...' // NFT token address
   });
   ```

2. Check console for errors
3. Verify transaction on Keeta explorer
4. If successful, remove limitation warnings

### Contact

If you're the Yoda wallet developer and see this:
- GitHub issue: [Link if you create one]
- Add token transfer support similar to how MetaMask handles ERC-20 transfers
- Reference: https://github.com/cyberdreadx/keeta-galaxy-bank

---

**Last Updated:** December 17, 2025
**Reported By:** Degen Swap Team
**Yoda Wallet Version:** Unknown (check extension manifest)
