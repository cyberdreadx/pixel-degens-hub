# Collections System Guide

## Overview

The collections system allows creators to organize and monetize their NFT projects on Keeta Chain with automated IPFS hosting and tiered pricing.

## Features

### 1. **Collection Creation**
- Create branded collections with banner, logo, and metadata
- Set royalty percentages (up to 25%)
- Add social links (website, Twitter, Discord)
- Define total supply (max 10,000 items)

### 2. **Tiered Pricing**

Collections are priced based on size to cover hosting costs:

| Tier | Items | Price/Item | Best For |
|------|-------|------------|----------|
| **Starter** | 1-100 | 0.01 KTA | Small collections |
| **Standard** | 101-500 | 0.008 KTA | Medium collections |
| **Pro** | 501-1,000 | 0.006 KTA | Large collections |
| **Premium** | 1,001-5,000 | 0.005 KTA | Major collections |
| **Enterprise** | 5,001-10,000 | 0.004 KTA | Massive collections |

**Additional Costs:**
- Storage: 0.001 KTA per MB
- Minting: ~0.01 KTA per NFT

**Example Pricing:**
- 100 items = 1 KTA hosting + 0.05 KTA storage + 1 KTA minting = **2.05 KTA total**
- 1,000 items = 6 KTA hosting + 0.5 KTA storage + 10 KTA minting = **16.5 KTA total**
- 10,000 items = 40 KTA hosting + 5 KTA storage + 100 KTA minting = **145 KTA total**

### 3. **Batch Minting**

Two methods for providing images:

#### Method 1: Upload ZIP (Recommended)
1. Create a ZIP file containing all NFT images
2. Create metadata (CSV or JSON) referencing image filenames
3. Upload both to the batch mint page
4. System uploads images to IPFS via Pinata
5. Mints all NFTs with IPFS links

**CSV Format Example:**
```csv
name,image,description,symbol,attributes
Pixel Punk #1,punk1.png,A cool punk,PUNK,"[{""trait_type"":""Background"",""value"":""Blue""}]"
Pixel Punk #2,punk2.png,Another punk,PUNK,"[{""trait_type"":""Background"",""value"":""Red""}]"
```

**JSON Format Example:**
```json
[
  {
    "name": "Pixel Punk #1",
    "image": "punk1.png",
    "description": "A cool punk",
    "symbol": "PUNK",
    "attributes": [
      {"trait_type": "Background", "value": "Blue"}
    ]
  },
  {
    "name": "Pixel Punk #2",
    "image": "punk2.png",
    "description": "Another punk",
    "symbol": "PUNK",
    "attributes": [
      {"trait_type": "Background", "value": "Red"}
    ]
  }
]
```

#### Method 2: Existing IPFS Links (No Upload Fee)
1. Host images on IPFS yourself
2. Create metadata with IPFS hashes
3. Upload only metadata
4. Mint NFTs referencing existing IPFS links
5. **No upload fee** - only transaction costs

**Supported IPFS Formats:**
- `ipfs://QmXxx...`
- `QmXxx...` or `bafyxxx...`
- `https://ipfs.io/ipfs/QmXxx...`
- `https://gateway.pinata.cloud/ipfs/QmXxx...`

### 4. **Collection Discovery**

Browse all collections at `/collections`:
- **Search** by name, symbol, or description
- **Filter** by verified, featured, or all
- **Sort** by newest, volume, floor price, or item count
- View collection stats (items, floor, volume)

### 5. **Collection Analytics**

Each collection tracks:
- **Floor Price**: Lowest listing price
- **Volume Traded**: Total KTA traded
- **Items Minted**: Total NFTs created
- **Listed Count**: Currently available NFTs
- **Owners**: Unique wallet holders

### 6. **Verification & Features**

**Verified Badge** 🎖️
- Manually verified by platform
- Authentic/official collections
- Displayed prominently

**Featured Badge** 👑
- Highlighted collections
- Premium placement
- Increased visibility

## Database Schema

### Collections Table
```sql
- id (TEXT, PRIMARY KEY)
- name (TEXT)
- symbol (TEXT)
- description (TEXT)
- creator_address (TEXT)
- network (TEXT) -- 'main' or 'test'
- banner_image (TEXT) -- IPFS hash
- logo_image (TEXT) -- IPFS hash
- ipfs_hash (TEXT) -- Collection metadata IPFS hash
- total_supply (INTEGER)
- minted_count (INTEGER)
- floor_price (DECIMAL)
- volume_traded (DECIMAL)
- owners_count (INTEGER)
- listed_count (INTEGER)
- storage_size_mb (DECIMAL)
- hosting_fee_kta (DECIMAL)
- paid_status (TEXT) -- 'unpaid', 'paid', 'expired'
- royalty_percentage (DECIMAL)
- is_verified (BOOLEAN)
- is_featured (BOOLEAN)
- website, twitter, discord (TEXT)
- created_at, updated_at (TIMESTAMP)
```

### Collection Sales Table
```sql
- id (UUID, PRIMARY KEY)
- collection_id (TEXT, FOREIGN KEY)
- token_address (TEXT)
- seller_address (TEXT)
- buyer_address (TEXT)
- price_kta, price_xrge (DECIMAL)
- currency (TEXT)
- network (TEXT)
- transaction_hash (TEXT)
- created_at (TIMESTAMP)
```

## API Endpoints

### Edge Functions

**fx-upload-collection**
- Uploads collection metadata to IPFS
- Stores collection in database
- Returns IPFS hash and gateway URL

**fx-get-collection**
- Fetches collection by ID from Pinata
- Returns full collection metadata

**fx-update-collection**
- Updates collection stats
- Used after batch minting

**fx-batch-upload**
- Handles ZIP + metadata upload
- Extracts images from ZIP
- Uploads each image to IPFS
- Returns mapping of filename → IPFS hash

## User Workflows

### Creating a Collection

1. Navigate to `/collection/create`
2. Fill in collection details:
   - Name, symbol, description
   - Upload banner (1400x400 recommended)
   - Upload logo (400x400 recommended)
   - Set royalty percentage
   - Add social links
   - **Set total supply** (required)
3. Review pricing estimate
4. Click "CREATE COLLECTION"
5. Collection is uploaded to IPFS and saved to database
6. Redirected to collection detail page

### Batch Minting NFTs

1. Navigate to collection page
2. Click "BATCH MINT" (owner only)
3. Choose image source:
   - **Upload ZIP**: For new images
   - **Existing IPFS**: For pre-hosted images
4. Upload metadata file (CSV or JSON)
5. If uploading: Select ZIP file with images
6. Review fee breakdown
7. Click "MINT X NFTS"
8. System processes:
   - Uploads images (if ZIP method)
   - Mints each NFT on-chain
   - Updates collection stats
9. View minted NFTs in collection

### Browsing Collections

1. Navigate to `/collections`
2. Use search bar to find collections
3. Filter by verified/featured
4. Sort by newest, volume, floor, or items
5. Click collection to view details
6. View NFTs and stats

## Mobile Optimization

All collection pages are fully responsive:
- **Mobile-first design**: Base styles for small screens
- **Breakpoints**:
  - `sm` (640px+): Large phones, small tablets
  - `md` (768px+): Tablets
  - `lg` (1024px+): Desktop
  - `xl` (1280px+): Large desktop
- **Touch-friendly**: Minimum 28px tap targets
- **Optimized text**: Scales from 10px to 16px
- **Flexible layouts**: Wrap and stack on small screens

## Best Practices

### For Creators

1. **Choose the right tier**: Start small, upgrade later if needed
2. **Optimize images**: Keep under 1MB each, use PNG or WebP
3. **Complete metadata**: Add detailed descriptions and attributes
4. **Use IPFS**: For maximum decentralization
5. **Set fair royalties**: 5-10% is standard
6. **Verify authenticity**: Apply for verification badge

### For Developers

1. **Validate inputs**: Check collection size, file types
2. **Handle errors**: Graceful failure for IPFS uploads
3. **Update stats**: Call `update_collection_stats()` after sales
4. **Track sales**: Insert into `collection_sales` table
5. **Cache data**: Use Supabase caching for performance
6. **Test both networks**: Mainnet and testnet

## Limitations

- **Max collection size**: 10,000 items
- **Max royalty**: 25%
- **Max image size**: 10MB per file
- **Supported formats**: PNG, JPG, GIF, WebP
- **Metadata required**: Name and image minimum

## Future Enhancements

- [ ] Payment verification system
- [ ] Automatic stats updates via cron
- [ ] Collection analytics dashboard
- [ ] Rarity calculator
- [ ] Trait filtering
- [ ] Collaborative collections (multiple creators)
- [ ] Collection templates
- [ ] Lazy minting option
- [ ] Gasless minting for holders

## Support

For issues or questions:
- GitHub: [Issue Tracker]
- Discord: [Community Server]
- Docs: [Full Documentation]
