# Yoda Wallet Bug Report - chainId Not Updating

## 🐛 Bug Description

The `window.yoda.chainId` property does **not update** when the user switches networks in the Yoda wallet extension UI.

## 📋 Steps to Reproduce

1. Install Yoda wallet extension
2. Open the extension and switch to **Testnet** in settings
3. Visit a dApp that checks `window.yoda.chainId`
4. Log the value: `console.log(window.yoda.chainId)`

## ❌ Current (Incorrect) Behavior

```javascript
// User switches to TESTNET in Yoda UI
// But chainId still reports mainnet:
console.log(window.yoda.chainId);
// Output: "keeta-main"  ❌ WRONG!
```

The extension UI shows "TESTNET" but the `chainId` property remains stuck on `"keeta-main"`.

## ✅ Expected Behavior

```javascript
// When user switches to TESTNET:
console.log(window.yoda.chainId);
// Should output: "keeta-test" ✅

// When user switches to MAINNET:
console.log(window.yoda.chainId);
// Should output: "keeta-main" ✅
```

The `chainId` property should **immediately update** to reflect the network selected in the extension UI.

## 🔍 Impact

**Critical:** This breaks network detection for all dApps using Yoda wallet.

### Problems Caused:
- ❌ dApps can't detect which network the wallet is on
- ❌ Users see incorrect balance/data from wrong network
- ❌ Network mismatch warnings don't work
- ❌ Transactions might go to wrong network
- ❌ NFTs load from wrong network

### Affected dApps:
- DegenSwap (pixel-degens-hub)
- Any dApp checking `window.yoda.chainId`
- Any dApp relying on network detection

## 💡 Suggested Fix

### Option 1: Update chainId on Network Switch (Recommended)

```javascript
// In your extension's network switch handler:
function switchNetwork(newNetwork) {
  // Update internal state
  this.currentNetwork = newNetwork;
  
  // ✅ ADD THIS: Update the exposed chainId property
  if (newNetwork === 'testnet') {
    window.yoda.chainId = 'keeta-test';
  } else if (newNetwork === 'mainnet') {
    window.yoda.chainId = 'keeta-main';
  }
  
  // Emit network change event
  window.yoda.emit('chainChanged', window.yoda.chainId);
}
```

### Option 2: Make chainId a Getter (Better)

```javascript
// Instead of static property, use a getter:
Object.defineProperty(window.yoda, 'chainId', {
  get() {
    // Return current network from extension state
    return extensionState.currentNetwork === 'testnet' 
      ? 'keeta-test' 
      : 'keeta-main';
  }
});
```

This ensures `chainId` always reflects the current network state.

### Option 3: Emit chainChanged Event

Even better, emit the standard Web3 event when network changes:

```javascript
function switchNetwork(newNetwork) {
  const oldChainId = window.yoda.chainId;
  
  // Update chainId
  window.yoda.chainId = newNetwork === 'testnet' ? 'keeta-test' : 'keeta-main';
  
  // Emit event so dApps can listen
  if (oldChainId !== window.yoda.chainId) {
    window.yoda.emit('chainChanged', window.yoda.chainId);
    // Also emit custom event for backwards compatibility
    window.dispatchEvent(new CustomEvent('yoda#networkChanged', {
      detail: { chainId: window.yoda.chainId }
    }));
  }
}
```

## 🧪 How to Test the Fix

### Test Case 1: Switch to Testnet
```javascript
// 1. User switches to testnet in Yoda UI
// 2. In console:
console.log(window.yoda.chainId);
// Expected: "keeta-test" or "testnet"
```

### Test Case 2: Switch to Mainnet
```javascript
// 1. User switches to mainnet in Yoda UI
// 2. In console:
console.log(window.yoda.chainId);
// Expected: "keeta-main" or "mainnet"
```

### Test Case 3: Event Emission
```javascript
// Listen for network change
window.yoda.on('chainChanged', (newChainId) => {
  console.log('Network changed to:', newChainId);
});

// User switches network
// Should see log with new chainId
```

## 📦 Workaround (Temporary)

Until this is fixed, dApps can work around it by:

```javascript
// Don't trust chainId - detect network via API
async function detectYodaNetwork(address) {
  const [testnetData, mainnetData] = await Promise.all([
    fetch(`https://rep2.test.network.api.keeta.com/api/node/ledger/accounts/${address}`),
    fetch(`https://rep2.main.network.api.keeta.com/api/node/ledger/accounts/${address}`)
  ]);
  
  const testnetHasData = (await testnetData.json())?.balances?.length > 0;
  const mainnetHasData = (await mainnetData.json())?.balances?.length > 0;
  
  if (mainnetHasData && !testnetHasData) return 'mainnet';
  if (testnetHasData && !mainnetHasData) return 'testnet';
  return 'unknown';
}
```

But this is **slow** and **inefficient**. Please fix the chainId property!

## 🔗 Related Standards

Most wallet extensions follow this pattern:

**MetaMask:**
```javascript
ethereum.chainId // Updates when network changes
ethereum.on('chainChanged', (chainId) => { ... })
```

**Trust Wallet:**
```javascript
window.trustwallet.chainId // Updates on network switch
```

**Coinbase Wallet:**
```javascript
window.coinbaseWallet.chainId // Updates immediately
```

Yoda wallet should follow the same pattern for consistency.

## 📊 Priority

**High Priority** - This breaks core functionality for all dApps.

### User Impact:
- 🔴 Cannot reliably detect network
- 🔴 Wrong balance/data displayed
- 🔴 Confusing UX (UI says testnet, data shows mainnet)
- 🔴 Risk of wrong network transactions

## 🎯 Acceptance Criteria

✅ `window.yoda.chainId` updates immediately when user switches networks  
✅ Value matches selected network: `"keeta-test"` or `"keeta-main"`  
✅ `chainChanged` event emitted on network switch  
✅ Works across page reloads  
✅ Works when reconnecting to dApp  

## 📝 Additional Notes

### Current Values Observed:
- Testnet should be: `"keeta-test"` or `"testnet"`
- Mainnet should be: `"keeta-main"` or `"mainnet"`

### Alternative Property Names (if chainId can't be updated):
If you can't change `chainId`, consider adding:
- `window.yoda.network` → `"testnet"` or `"mainnet"`
- `window.yoda.activeNetwork` → current network string
- `window.yoda.currentChainId` → updated chain ID

But ideally, fix `chainId` itself for compatibility.

## 🆘 Contact

If you need more details or want to discuss the fix:
- GitHub: https://github.com/cyberdreadx/keeta-galaxy-bank
- Issue: Please create an issue for this bug

---

**Thank you for building Yoda wallet! This fix will make it much more reliable for dApp developers.** 🙏

## 📸 Screenshot Evidence

```
[WalletDialog] Raw Yoda chainId: keeta-main
(User's Yoda UI shows: TESTNET)
```

The chainId property does not match the extension UI.
