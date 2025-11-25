# Keeta API Endpoint Fix 🔧

## Problem Discovered
The codebase was using incorrect API endpoints that returned 404 errors.

## Root Cause
- **Wrong Base URL**: `rep3.*.network.api.keeta.com` (doesn't exist)
- **Correct Base URL**: `rep2.*.network.api.keeta.com` (working!)
- **Wrong Path**: `/node/ledger/account/{address}/info` or `/balance`
- **Correct Path**: `/node/ledger/accounts/{address}` (plural "accounts", single endpoint for all data)

## API Response Format Change

### Old (Expected)
```json
{
  "name": "...",
  "metadata": "...",
  "supply": "..."
}
```

### New (Actual)
```json
[
  {
    "account": "keeta_...",
    "currentHeadBlock": "...",
    "info": {
      "name": "...",
      "metadata": "...",
      "supply": "0x1"
    },
    "balances": [...]
  }
]
```

**Key differences:**
1. Returns an **array** (use first element)
2. Data is nested in `info` property
3. `balances` included in same response
4. Supply values are **hex strings** (e.g., `"0x1"` not `"1"`)

## Files Updated

### Frontend (Direct Blockchain Access)
- ✅ `src/utils/keetaBlockchain.ts`
  - Changed base URL from `rep3` to `rep2`
  - Changed path from `/account/` to `/accounts/`
  - Updated response parsing for array format
  - Added hex-to-decimal conversion for supply

### Backend Edge Functions
All edge functions updated to use correct endpoints:

1. ✅ `fx-token-info/index.ts`
2. ✅ `fx-keeta-proxy/index.ts`
3. ✅ `fx-anchor-info/index.ts`
4. ✅ `fx-rates/index.ts`
5. ✅ `fx-record-price/index.ts`
6. ✅ `fx-build-swap/index.ts`
7. ✅ `fx-swap/index.ts` (4 instances updated)

## Testing

### Verify the fix works:

**Test Token (Yoda NFT on testnet):**
```bash
curl https://rep2.test.network.api.keeta.com/api/node/ledger/accounts/keeta_aofmy3lu7blvqlnd7wjwe7otbhkwvv7sfcbwwznd73bjsyx7au4e277p33u5k
```

**Expected Result:** 200 OK with token data

**Test XRGE Token (testnet):**
```bash
curl https://rep2.test.network.api.keeta.com/api/node/ledger/accounts/keeta_annmywuiz2pourjmkyuaznxyg6cmv356dda3hpuiqfpwry5m2tlybothdb33s
```

## Response Parsing Updates

All functions now properly parse the array response:

```typescript
// OLD (broken)
const tokenInfo = await response.json();
const name = tokenInfo.name;

// NEW (working)
const rawData = await response.json();
const accountData = Array.isArray(rawData) ? rawData[0] : rawData;
const tokenInfo = accountData?.info || {};
const name = tokenInfo.name;
```

## Hex Supply Conversion

Supply values are now hex strings and need conversion:

```typescript
// Convert hex supply to decimal
const supplyHex = tokenInfo.supply || '0x0';
const supply = BigInt(supplyHex).toString();
```

## Next Steps

1. **Deploy Edge Functions** (to apply backend fixes):
   ```bash
   supabase functions deploy
   ```

2. **Test the application**:
   - Load NFT detail pages
   - Check swap rates
   - View account balances
   - Test anchor status

3. **Verify CORS fixes** still work after deployment

## Verification Checklist

- [ ] NFT Detail page loads correctly
- [ ] Token info displays (name, description, metadata)
- [ ] Account balances show up
- [ ] Swap rates calculate properly
- [ ] Anchor status displays pool info
- [ ] No 404 errors in console
- [ ] No CORS errors

## Rollback

If issues occur, the old edge functions are still in place. The frontend `keetaBlockchain.ts` file can be temporarily disabled by reverting imports in components to use the edge functions instead.

---

**Status**: ✅ All endpoints updated and ready for testing!

