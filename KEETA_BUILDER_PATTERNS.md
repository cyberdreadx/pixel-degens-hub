# Keeta Builder API Patterns 🔧

## Common Builder Methods

### 1. **Simple Builder Pattern** (Publish Directly)
Use when you want to build and publish a transaction immediately.

```typescript
const builder = client.initBuilder();

// Add operations
builder.send(recipient, amount, token);

// Compute and publish
await builder.computeBlocks();
const result = await builder.publish();
```

**Use cases:**
- Minting NFTs
- Simple token transfers
- Operations that don't need to extract block bytes

**Examples:**
- `src/pages/MintNFT.tsx` - NFT minting
- `supabase/functions/fx-list-nft/index.ts` - After adding foreign block
- `supabase/functions/fx-buy-nft/index.ts` - After adding foreign block

---

### 2. **Extract Block Bytes Pattern** (For Edge Functions)
Use when you need to get unsigned block bytes to send to an edge function or another party.

```typescript
const builder = client.initBuilder();

// Add operations
builder.send(recipient, amount, token);

// Compute blocks using client (NOT builder)
const computed = await client.computeBuilderBlocks(builder);

if (!computed.blocks || computed.blocks.length === 0) {
  throw new Error('Failed to compute blocks');
}

// Extract block bytes
const block = computed.blocks[0];
const blockBytes = block.toBytes();
const blockBase64 = btoa(String.fromCharCode(...new Uint8Array(blockBytes)));

// Send to edge function or store for atomic swap
```

**Use cases:**
- Atomic swaps
- NFT listings (seller's block)
- NFT purchases (buyer's block)
- Any operation requiring block bytes

**Examples:**
- `src/components/ListNFTDialog.tsx` - Creating seller's swap block
- `supabase/functions/fx-build-swap/index.ts` - Building atomic swap
- `supabase/functions/fx-swap/index.ts` - Processing atomic swaps

---

## ❌ Common Mistakes

### Mistake 1: Using `builder.getBlocks()`
```typescript
// ❌ WRONG - This method doesn't exist
await builder.computeBlocks();
const blocks = builder.getBlocks(); // TypeError: builder.getBlocks is not a function
```

**Fix:**
```typescript
// ✅ CORRECT - Use client.computeBuilderBlocks()
const computed = await client.computeBuilderBlocks(builder);
const blocks = computed.blocks;
```

---

### Mistake 2: Wrong byte conversion
```typescript
// ❌ WRONG - Verbose and error-prone
const bytes = block.toBytes();
const base64 = btoa(
  Array.from(bytes as Uint8Array)
    .map(b => String.fromCharCode(b))
    .join('')
);
```

**Fix:**
```typescript
// ✅ CORRECT - Simpler and more reliable
const bytes = block.toBytes();
const base64 = btoa(String.fromCharCode(...new Uint8Array(bytes)));
```

---

### Mistake 3: Using wrong compute method
```typescript
// ❌ WRONG for extracting bytes
await builder.computeBlocks(); // Returns void, updates internal state
const blocks = ??? // Can't access blocks
```

**Fix:**
```typescript
// ✅ CORRECT
const computed = await client.computeBuilderBlocks(builder);
const blocks = computed.blocks; // Access blocks from returned object
```

---

## Method Reference

### `builder.computeBlocks()`
- **Returns:** `Promise<void>`
- **Purpose:** Computes blocks internally, updates builder state
- **Use when:** Continuing to add more operations to the builder
- **Example:** Generating token identifiers, intermediate state

### `client.computeBuilderBlocks(builder)`
- **Returns:** `Promise<{ blocks: Block[] }>`
- **Purpose:** Computes blocks and returns them for external use
- **Use when:** Need to extract block bytes or inspect blocks
- **Example:** Creating atomic swaps, listing NFTs

### `builder.publish()`
- **Returns:** `Promise<PublishResult>`
- **Purpose:** Publishes all operations in the builder
- **Use when:** Ready to submit transaction to blockchain
- **Example:** After all operations are added

### `client.publishBuilder(builder)`
- **Returns:** `Promise<PublishResult>`
- **Purpose:** Alternative way to publish builder operations
- **Use when:** Prefer explicit client method
- **Example:** Edge functions prefer this pattern

---

## Atomic Swap Pattern

### Seller (Creates Swap Block)
```typescript
// 1. Seller creates their side
const builder = client.initBuilder();
builder.send(buyerAccount, nftAmount, nftToken);
builder.receive(buyerAccount, paymentAmount, paymentToken, true);

// 2. Get unsigned block bytes
const computed = await client.computeBuilderBlocks(builder);
const sellerBlock = computed.blocks[0];
const sellerBlockBytes = sellerBlock.toBytes();

// 3. Send to marketplace/edge function
await supabase.functions.invoke('fx-list-nft', {
  body: { swapBlockBytes: btoa(String.fromCharCode(...new Uint8Array(sellerBlockBytes))) }
});
```

### Buyer (Completes Swap)
```typescript
// 1. Buyer creates payment side
const builder = client.initBuilder();
builder.send(sellerAccount, paymentAmount, paymentToken);

// 2. Add seller's block (creates atomic swap)
builder.addForeignBlock(sellerBlockBytes);

// 3. Publish complete atomic swap
await builder.computeBlocks();
const result = await builder.publish();
```

---

## Quick Decision Tree

```
Need to work with blocks?
│
├─ YES: Need block bytes for atomic swap/edge function?
│   └─ Use: client.computeBuilderBlocks(builder)
│      Then: Extract bytes from computed.blocks
│
└─ NO: Just publishing transaction?
    └─ Use: builder.computeBlocks()
       Then: builder.publish()
```

---

## Summary

✅ **DO:**
- Use `client.computeBuilderBlocks(builder)` to get block bytes
- Use `builder.computeBlocks()` for intermediate state updates
- Use `computed.blocks[0].toBytes()` to extract bytes
- Convert to base64 with `btoa(String.fromCharCode(...new Uint8Array(bytes)))`

❌ **DON'T:**
- Call `builder.getBlocks()` - doesn't exist
- Mix up `builder.computeBlocks()` and `client.computeBuilderBlocks()`
- Try to access blocks after `builder.computeBlocks()` - returns void
- Over-complicate byte array conversions

---

**Last Updated:** After fixing ListNFTDialog.tsx
**Status:** ✅ All builder patterns validated

