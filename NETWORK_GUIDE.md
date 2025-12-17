# 🌐 Network Guide - Understanding Mainnet vs Testnet

## The Two Network Settings

### ⚠️ Important: There are TWO separate network settings!

#### 1. **Site Network** (in the navigation bar)
- **Location:** Top navigation bar - look for the switch with "MAINNET" or "TESTNET"
- **What it controls:**
  - Which listings you see in the marketplace
  - Which network's data is displayed
  - Which anchor (escrow) wallet is used
  - App routing and database queries

#### 2. **Yoda Wallet Network** (in the extension)
- **Location:** Your Yoda wallet browser extension settings
- **What it controls:**
  - Which blockchain your transactions go to
  - Where your balance comes from
  - Which network receives your NFTs
  - Transaction signing and broadcasting

## 🎯 They MUST Match!

**Critical:** For everything to work correctly, both networks must be set to the same value!

### ✅ Correct Setup

**For Testnet:**
- Site network: **TESTNET** (yellow indicator)
- Yoda wallet: **testnet** 
- Both indicators show **TESTNET**

**For Mainnet:**
- Site network: **MAINNET** (green indicator)
- Yoda wallet: **mainnet**
- Both indicators show **MAINNET**

### ❌ Incorrect Setup (Network Mismatch)

**Example of a problem:**
- Site: **TESTNET** (yellow)
- Yoda: **mainnet** (green)
- **Result:** You'll see:
  - ⚠️ "Network Mismatch" warning
  - Testnet listings but mainnet balance
  - Transactions fail or go to wrong network

## Visual Indicators

### In the Navigation Bar

**Mainnet:**
```
🟢 MAINNET [switch]
Green background, pulsing green dot
```

**Testnet:**
```🟡 TESTNET [switch]
Yellow background, pulsing yellow dot
```

### In the Wallet Dialog

When you open your wallet, you'll see a **Network Status** section at the top:

**When networks match:**
```
Network Status
🟢 Site: MAINNET
🟣 Yoda: MAINNET
✓ Networks Match
```

**When networks DON'T match:**
```
⚠️ Network Mismatch!
Your Yoda wallet is on MAINNET but the site is set to TESTNET.
→ Switch networks in your Yoda wallet extension to match the site!
```

## How to Switch Networks

### Switching Site Network

1. Look at the top navigation bar
2. Find the network switch (right side, before wallet button)
3. Click the switch to toggle between MAINNET/TESTNET
4. **Note:** You can only switch if wallet is disconnected!

### Switching Yoda Wallet Network

1. Click the Yoda wallet extension icon in your browser
2. Click the settings/menu icon (usually three dots or gear)
3. Find "Network" or "Chain" settings
4. Select the network you want (mainnet or testnet)
5. Confirm the change
6. Reconnect to the site if already connected

## Common Scenarios

### Scenario 1: "My balance shows 0 but I have tokens"

**Problem:** You're probably on the wrong network

**Solution:**
1. Check the network indicator in navigation (green = mainnet, yellow = testnet)
2. Open wallet dialog to see both network indicators
3. If they don't match, switch Yoda wallet to match the site
4. Refresh balance

### Scenario 2: "I can't see my testnet NFTs"

**Problem:** Site might be set to mainnet

**Solution:**
1. Check navigation bar network indicator
2. If it shows **MAINNET** (green), switch it to **TESTNET** (yellow)
3. Make sure Yoda wallet is also on testnet
4. Reload the page

### Scenario 3: "Transaction failed"

**Problem:** Network mismatch

**Solution:**
1. Open wallet dialog
2. Check the "Network Status" section
3. If you see a mismatch warning, fix it by:
   - Switching Yoda wallet network to match site
   - Then try transaction again

### Scenario 4: "I want to test on testnet"

**Steps:**
1. Disconnect wallet (if connected)
2. Switch site to **TESTNET** (navigation bar)
3. Open Yoda wallet extension
4. Switch Yoda to **testnet** network
5. Reconnect wallet on the site
6. Verify both show TESTNET

### Scenario 5: "I want to use real money on mainnet"

**Steps:**
1. Disconnect wallet (if connected)
2. Switch site to **MAINNET** (navigation bar)
3. Open Yoda wallet extension
4. Switch Yoda to **mainnet** network
5. Reconnect wallet on the site
6. Verify both show MAINNET
7. **⚠️ Warning:** Transactions on mainnet use real KTA!

## Why Two Separate Settings?

**By design:**
- The site network controls what data you see (listings, collections, etc.)
- Yoda wallet network controls where your actual blockchain transactions go
- They're separate for flexibility, but must match for correct operation

**Think of it like:**
- Site network = "Which database am I looking at?"
- Yoda network = "Which blockchain am I connected to?"

## Quick Checklist

Before doing any transaction:

- [ ] Check navigation bar network indicator
- [ ] Open wallet dialog
- [ ] Check "Network Status" section
- [ ] Verify no mismatch warning
- [ ] If mismatch exists, switch Yoda wallet
- [ ] Wait for "✓ Networks Match" confirmation
- [ ] Proceed with transaction

## Testnet vs Mainnet - Which Should I Use?

### Use **TESTNET** for:
- Testing the platform
- Learning how things work
- Minting test NFTs
- Practicing transactions
- No real money involved
- KTA has no real value

### Use **MAINNET** for:
- Real NFT trading
- Actual marketplace transactions
- Selling/buying with real KTA
- Production use
- **Real money involved!**
- KTA has real value

## Troubleshooting

### "I keep forgetting which network I'm on"

**Solution:** Always check these visual indicators:
- Navigation bar color: Green = mainnet, Yellow = testnet
- Pulsing dot next to network name
- Network Status section in wallet dialog

### "The network switch is disabled"

**Cause:** You're currently connected with a wallet

**Solution:**
1. Open wallet dialog
2. Click "DISCONNECT"
3. Now you can switch networks
4. Reconnect after switching

### "I switched networks but still see old data"

**Solution:**
1. Refresh the page (F5 or Cmd+R)
2. Clear browser cache if needed
3. Reconnect wallet

### "Warning won't go away"

**Solution:**
1. The warning means Yoda wallet network doesn't match site
2. You MUST change Yoda wallet network (not just the site)
3. Steps:
   - Open Yoda extension
   - Go to settings
   - Switch network
   - Warning should disappear

## Summary

✅ **Remember:**
1. **Two networks:** Site network + Yoda network
2. **Must match:** Both must be on same network
3. **Visual indicators:** Green (mainnet) or Yellow (testnet)
4. **Check before transactions:** Open wallet dialog to verify
5. **Switch in Yoda:** Change network in the extension, not just the site

🎯 **Golden Rule:**
> "Always check the Network Status section in your wallet dialog before making transactions!"

---

**Still confused?** Open your wallet dialog and look at the "Network Status" section at the top. It will tell you exactly what's wrong and how to fix it! 🚀
