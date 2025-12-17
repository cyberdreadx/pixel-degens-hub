# NFT Fetching Fix

## The Problem

NFTs weren't showing up in the app even though they existed in the wallet and blockchain explorer.

## Root Causes

### 1. **Wrong API Endpoint** ❌

**What we were doing:**
```typescript
fetch(`${apiBase}/node/ledger/token/${tokenAddress}`)
```

**What we should have been doing:** ✅
```typescript
fetch(`${apiBase}/node/ledger/accounts/${tokenAddress}`)
// Then access: accountData?.info
```

The `/node/ledger/token/` endpoint doesn't exist or returns different data. The correct way to get token information is to fetch the token's **account data** and read the `.info` property.

### 2. **Wrong Metadata Parsing**

**What we were doing:**
```typescript
const metadataBuffer = Buffer.from(tokenInfo.metadata, 'base64');
metadata = JSON.parse(metadataBuffer.toString('utf8'));
```

**What we should have been doing:** ✅
```typescript
const metadataJson = atob(tokenInfo.metadata);
metadata = JSON.parse(metadataJson);
```

The `Buffer` approach doesn't work in browser environments. We need to use `atob()` to decode base64.

### 3. **Wrong Supply Format**

**What we were doing:**
```typescript
const supply = BigInt(tokenInfo?.supply || '0');
```

**What we should have been doing:** ✅
```typescript
const supplyHex = tokenInfo?.supply || '0x0';
const supply = BigInt(supplyHex);
```

The supply comes as a hex string (e.g., `"0x1"`), not a decimal string.

### 4. **Missing Platform Check**

**What we were doing:**
```typescript
const isNFT = supply === 1n && decimals === 0;
```

**What we should have been doing:** ✅
```typescript
const isNFT = metadata?.platform === 'degen8bit' ||
              (supply === 1n && decimals === 0);
```

NFTs created on the degen8bit platform should be recognized even if they don't strictly follow the supply=1, decimals=0 pattern.

### 5. **Wrong Decimals Source**

**What we were doing:**
```typescript
const decimals = tokenInfo?.decimals || 0;
```

**What we should have been doing:** ✅
```typescript
const decimals = metadata?.decimalPlaces || metadata?.decimals || tokenInfo?.decimals || 0;
```

The decimals value is more reliably found in the metadata than in the top-level token info.

### 6. **Required Metadata Filter**

**What we were doing in Profile.tsx:**
```typescript
const nfts = tokens.filter(token => token.isNFT && token.metadata);
```

**What we should have been doing:** ✅
```typescript
const nfts = tokens.filter(token => token.isNFT);
```

NFTs should show even if metadata parsing fails. Don't require metadata to display an NFT.

## Files Fixed

1. **`src/contexts/WalletContext.tsx`**
   - Fixed API endpoint from `/token/` to `/accounts/`
   - Fixed metadata parsing to use `atob()`
   - Fixed supply parsing from hex
   - Added platform check for NFT detection
   - Fixed decimals source priority

2. **`src/pages/PublicProfile.tsx`**
   - Fixed API endpoint from `/token/` to `/accounts/`
   - Fixed metadata parsing to use `atob()` in all locations
   - Fixed supply parsing from hex
   - Added platform check for NFT detection
   - Fixed decimals source priority
   - Fixed undefined `idx` variable in loop
   - Fixed explorer link to use correct network (testnet vs mainnet)
   - Removed duplicate metadata parsing

3. **`src/pages/Profile.tsx`**
   - Removed metadata requirement from NFT filter
   - Added debug logging

## Testing

After this fix:
1. ✅ NFTs show up in wallet dialog
2. ✅ NFTs show up in profile page
3. ✅ NFTs show up in public profile pages
4. ✅ Works on both mainnet and testnet
5. ✅ Works with Yoda wallet and seed wallet

## Reference

The correct implementation was modeled after the `useKeetaNFTs` hook pattern, which properly uses the Keeta blockchain API.
