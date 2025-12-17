# Network Detection Debug Guide

## 🔍 How to Debug Network Detection

### Step 1: Open Browser Console
Press F12 (or Cmd+Option+I on Mac)

### Step 2: Connect Your Wallet
When you connect, you'll see detailed logs:

```
=== NETWORK DETECTION DEBUG ===
[WalletDialog] Raw Yoda chainId: keeta-test
[WalletDialog] Type: string
[WalletDialog] Site network: main
[WalletDialog] Detected as TESTNET (contains "test")
[WalletDialog] Final detection: {
  yodaChainId: "keeta-test",
  yodaIsMainnet: false,
  siteNetwork: "main", 
  siteIsMainnet: true,
  mismatch: true    ← SHOULD BE TRUE!
}
================================
```

## 🧪 Test Cases

### Test 1: Yoda on Testnet, Site on Mainnet
**Setup:**
- Yoda wallet: Switch to testnet
- Site: Switch to mainnet  
- Disconnect and reconnect

**Expected Result:**
```
[WalletDialog] Detected as TESTNET (contains "test")
[WalletDialog] Final detection: { mismatch: true }
```

**Visual:**
- 🔴 Red warning box: "Network Mismatch!"
- Shows: "Yoda wallet is on TESTNET but site is set to MAINNET"

### Test 2: Yoda on Mainnet, Site on Testnet
**Setup:**
- Yoda wallet: Switch to mainnet
- Site: Switch to testnet
- Disconnect and reconnect

**Expected Result:**
```
[WalletDialog] Detected as MAINNET (contains "main", no "test")
[WalletDialog] Final detection: { mismatch: true }
```

**Visual:**
- 🔴 Red warning box: "Network Mismatch!"
- Shows: "Yoda wallet is on MAINNET but site is set to TESTNET"

### Test 3: Both on Testnet
**Setup:**
- Yoda wallet: testnet
- Site: testnet
- Connect

**Expected Result:**
```
[WalletDialog] Detected as TESTNET
[WalletDialog] Final detection: { mismatch: false }
[WalletContext] ✓ Networks match!
```

**Visual:**
- ✅ Green box: "✓ Networks Match"

### Test 4: Both on Mainnet
**Setup:**
- Yoda wallet: mainnet
- Site: mainnet
- Connect

**Expected Result:**
```
[WalletDialog] Detected as MAINNET
[WalletDialog] Final detection: { mismatch: false }
[WalletContext] ✓ Networks match!
```

**Visual:**
- ✅ Green box: "✓ Networks Match"

## 📋 What to Check

### In Console:
Look for these key indicators:

**1. Raw chainId:**
```
[WalletDialog] Raw Yoda chainId: keeta-test
```
↑ This tells you what Yoda is actually reporting

**2. Detection Result:**
```
[WalletDialog] Detected as TESTNET (contains "test")
```
↑ This tells you how we interpreted it

**3. Mismatch Status:**
```
[WalletDialog] Final detection: { mismatch: true }
```
↑ This tells you if there's a mismatch

**4. WalletContext Confirmation:**
```
[WalletContext] ⚠️ NETWORK MISMATCH! App: main, Yoda: testnet
```
↑ This confirms the mismatch and shows a toast

### In Wallet Dialog:
**Network Status section shows:**

**When they match:**
```
🟡 Site: TESTNET
🟣 Yoda: TESTNET
✓ Networks Match (green box)
```

**When they DON'T match:**
```
🟢 Site: MAINNET
🟣 Yoda: TESTNET
⚠️ Network Mismatch! (red box)
Your Yoda wallet is on TESTNET but site is set to MAINNET.
→ Switch networks in your Yoda wallet extension to match the site!
```

## 🎯 Detection Logic

```typescript
function detectYodaNetwork(chainId: string): 'mainnet' | 'testnet' {
  const chainIdLower = String(chainId).toLowerCase();
  
  // Priority 1: Check for 'test' (highest priority)
  if (chainIdLower.includes('test')) {
    return 'testnet';
  }
  
  // Priority 2: Check for mainnet indicators
  if (chainIdLower === 'keeta-main' || 
      chainIdLower === 'mainnet' || 
      chainIdLower.includes('main')) {
    return 'mainnet';
  }
  
  // Default: testnet
  return 'testnet';
}
```

### Examples:
- `"keeta-test"` → testnet ✓
- `"keeta-main-test"` → testnet ✓ (test takes priority)
- `"testnet"` → testnet ✓
- `"keeta-main"` → mainnet ✓
- `"mainnet"` → mainnet ✓
- `"keeta-mainnet"` → mainnet ✓
- `""` (empty) → testnet ✓ (default)
- `"unknown"` → testnet ✓ (default)

## 🐛 If Detection Still Wrong

### Share These Console Logs:
```
=== NETWORK DETECTION DEBUG ===
[WalletDialog] Raw Yoda chainId: ???
[WalletDialog] Type: ???
[WalletDialog] Site network: ???
[WalletDialog] Detected as ???
[WalletDialog] Final detection: { ... }
```

Copy all the debug output and share it!

## 🔧 Quick Fix Steps

**If mismatch warning doesn't show when it should:**

1. Open console
2. Look at the debug logs
3. Find this line: `[WalletDialog] Raw Yoda chainId:`
4. Note what value it shows
5. Check if detection logic matches that value

**Common Issues:**
- chainId is `undefined` → Default to testnet
- chainId is unexpected format → Check logs
- Detection logic needs adjustment → Update based on actual chainId format

## ✅ Success Checklist

After connecting, verify:
- [ ] Console shows `=== NETWORK DETECTION DEBUG ===`
- [ ] See the raw chainId value
- [ ] Detection logic output is shown
- [ ] Final detection shows correct mismatch status
- [ ] Wallet dialog shows correct warning (or green checkmark)
- [ ] Toast notification appears if mismatch
- [ ] Networks are labeled correctly (MAINNET/TESTNET)

## 📝 Test Scenario

**Current Setup:**
- Yoda wallet: TESTNET
- Site: MAINNET
- Expected: MISMATCH WARNING

**What You Should See:**

**Console:**
```
=== NETWORK DETECTION DEBUG ===
[WalletDialog] Raw Yoda chainId: keeta-test
[WalletDialog] Type: string
[WalletDialog] Site network: main
[WalletDialog] Detected as TESTNET (contains "test")
[WalletDialog] Final detection: {
  yodaChainId: "keeta-test",
  yodaIsMainnet: false,
  siteNetwork: "main",
  siteIsMainnet: true,
  mismatch: true  ← THIS SHOULD BE TRUE!
}
================================
```

**Wallet Dialog:**
```
⚠️ NETWORK MISMATCH!
Your Yoda wallet is on TESTNET but the site is set to MAINNET.
→ Switch networks in your Yoda wallet extension to match the site!
```

**Toast:**
```
⚠️ Yoda wallet is on testnet but app is set to mainnet. Please switch networks in Yoda wallet.
```

---

**Try connecting now and share the console output!** 🔍
