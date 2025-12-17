# Yoda Wallet Integration Guide

This document explains how the Yoda wallet browser extension is integrated into your NFT marketplace.

## Overview

The Yoda wallet is a browser extension for the Keeta blockchain network. This integration allows users to connect their Yoda wallet to your NFT marketplace, providing a secure way to manage their Keeta accounts without storing seed phrases in the browser.

## Features

✅ **Automatic Detection** - The app automatically detects if Yoda wallet extension is installed
✅ **Easy Connection** - One-click connection to Yoda wallet
✅ **Secure Signing** - All transactions are signed through the Yoda wallet extension
✅ **Account Switching** - Automatic reconnection when users switch accounts in Yoda
✅ **Dual Support** - Users can choose between Yoda wallet or traditional seed phrase methods

## How It Works

### 1. Detection

The app checks for Yoda wallet on page load:

```typescript
// Check for window.yoda or window.keetaWallet
const yoda = window.yoda || window.keetaWallet;
```

### 2. Connection

When users click "Connect Yoda Wallet":

1. Request connection from Yoda extension
2. Get the user's public key
3. Create a Keeta account instance
4. Override transaction signing to use Yoda wallet

### 3. Transaction Signing

All transactions are routed through Yoda wallet for signing:

```typescript
// User initiates transaction
await sendTokens(recipientAddress, amount);

// Behind the scenes:
// 1. Transaction is built
// 2. Sent to Yoda wallet for signing
// 3. User approves in Yoda extension popup
// 4. Signed transaction is published to blockchain
```

## User Experience

### First-Time Setup

1. User clicks "Connect Wallet"
2. Sees Yoda wallet button at the top
3. If not installed, button shows "Install Yoda Wallet" and opens Chrome Web Store
4. If installed, button shows "Connect Yoda Wallet" with green indicator

### Connected State

- Purple wallet icon indicates Yoda wallet is connected
- Balance and tokens are displayed normally
- Send tokens functionality works through Yoda signing
- Export options are hidden (keys managed by Yoda)

### Account Management

- Users manage their accounts in the Yoda extension
- App automatically reconnects when user switches accounts
- Disconnecting removes all local wallet state

## Technical Details

### File Changes

1. **WalletContext.tsx**
   - Added `walletType` state to track connection method
   - Added `isYodaInstalled` state for detection
   - Added `connectYodaWallet()` function
   - Updated `disconnectWallet()` to handle Yoda
   - Auto-connection logic for saved preferences

2. **WalletDialog.tsx**
   - Added Yoda wallet connection button
   - Purple theme for Yoda wallet UI elements
   - Conditional export options (hidden for Yoda)
   - Visual indicators for wallet type

3. **types/yoda-wallet.d.ts**
   - TypeScript definitions for Yoda wallet API
   - Window interface extensions
   - Event types and handlers

### State Management

```typescript
interface WalletContextType {
  walletType: "seed" | "yoda" | null;  // Current wallet type
  isYodaInstalled: boolean;             // Extension detection
  connectYodaWallet: () => Promise<void>; // Connection function
  // ... other wallet functions
}
```

### Local Storage

- `keetaWalletType`: Stores user's wallet preference ('seed' or 'yoda')
- `keetaWalletSeed`: Only used for seed phrase wallets (cleared for Yoda)

## Security Considerations

### Yoda Wallet Advantages

✅ **No Seed Storage** - Seeds never stored in browser localStorage
✅ **User Approval** - Every transaction requires explicit approval
✅ **Key Management** - Professional key management by extension
✅ **Isolation** - Keys isolated from website context

### Implementation Security

- All signing operations go through Yoda extension
- No direct access to private keys from website code
- Account data only includes public information
- Disconnection clears all wallet state

## Browser Compatibility

The integration works on any browser that supports extensions:

- ✅ Chrome
- ✅ Edge
- ✅ Brave
- ✅ Opera
- ⚠️ Firefox (if Yoda wallet releases Firefox version)

## Fallback Behavior

If Yoda wallet is not installed or connection fails:

1. Button shows "Install Yoda Wallet"
2. Clicking opens extension marketplace
3. Users can still use seed phrase method
4. No functionality is lost

## Testing the Integration

### Manual Testing Steps

1. **Without Yoda Wallet:**
   - Open app
   - Click "Connect Wallet"
   - Should see "Install Yoda Wallet" button (grayed out)
   - Clicking should open Chrome Web Store

2. **With Yoda Wallet Installed:**
   - Install Yoda wallet extension
   - Refresh app
   - Click "Connect Wallet"
   - Should see "Connect Yoda Wallet" with green indicator
   - Click to connect
   - Yoda popup should appear asking for approval
   - After approval, wallet should be connected
   - Purple wallet icon should show in header

3. **Transaction Testing:**
   - With Yoda connected, try sending tokens
   - Yoda popup should appear for transaction approval
   - After approval, transaction should complete
   - Balance should update

4. **Account Switching:**
   - Switch accounts in Yoda extension
   - App should reconnect automatically
   - New account address should display

5. **Disconnection:**
   - Click "Disconnect Wallet"
   - Wallet state should clear
   - Yoda should disconnect

## Troubleshooting

### Yoda Wallet Not Detected

**Problem:** App shows "Install Yoda Wallet" even though it's installed

**Solutions:**
- Refresh the page
- Check if extension is enabled
- Check browser console for errors
- Try disabling/enabling the extension

### Connection Fails

**Problem:** Connection attempt fails or times out

**Solutions:**
- Check if Yoda wallet is unlocked
- Try disconnecting and reconnecting
- Clear browser cache and try again
- Check browser console for error details

### Transactions Not Signing

**Problem:** Transaction signing fails or hangs

**Solutions:**
- Ensure Yoda wallet popup is not blocked
- Check if popup appeared but was closed
- Try the transaction again
- Check network connection

### Account Not Updating

**Problem:** Balance or address doesn't update after account switch

**Solutions:**
- Manually disconnect and reconnect
- Refresh the page
- Check Yoda wallet extension is on correct network

## Developer Notes

### Extending the Integration

To add new Yoda wallet features:

1. Check Yoda wallet documentation for available methods
2. Update `types/yoda-wallet.d.ts` with new types
3. Add methods to `WalletContext.tsx`
4. Update UI in `WalletDialog.tsx` if needed

### Custom Transaction Types

For NFT minting, listing, or other custom operations:

```typescript
// Example: Custom NFT operation with Yoda
const mintNFT = async (metadata: NFTMetadata) => {
  if (walletType === 'yoda') {
    const yoda = window.yoda;
    const txData = buildNFTMintTransaction(metadata);
    const signed = await yoda.signTransaction(txData);
    return signed;
  }
  // ... regular flow
};
```

## Resources

- **Keeta Network:** https://keeta.com
- **Keeta GitHub:** https://github.com/keetanetwork
- **Reference Implementation:** https://github.com/cyberdreadx/keeta-galaxy-bank

## Support

For issues or questions:

1. Check browser console for error messages
2. Test with seed phrase method to isolate Yoda-specific issues
3. Check Yoda wallet extension logs
4. Verify Keeta network status

## Future Enhancements

Potential improvements for consideration:

- [ ] Multi-account support (connect multiple accounts)
- [ ] Hardware wallet support through Yoda
- [ ] Transaction history from Yoda wallet
- [ ] Custom transaction templates
- [ ] Batch transaction signing
- [ ] Mobile wallet integration
- [ ] WalletConnect support

## Changelog

### Version 1.0.0 (Current)
- Initial Yoda wallet integration
- Connection and disconnection
- Transaction signing
- Account switching detection
- TypeScript definitions
- UI indicators for wallet type

---

**Note:** This integration follows the patterns established in the Keeta Galaxy Bank reference implementation while being adapted for the NFT marketplace use case.

