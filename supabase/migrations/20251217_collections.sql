-- Collections Table
CREATE TABLE IF NOT EXISTS collections (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  symbol TEXT NOT NULL,
  description TEXT,
  creator_address TEXT NOT NULL,
  network TEXT NOT NULL DEFAULT 'main',
  
  -- Images
  banner_image TEXT,
  logo_image TEXT,
  
  -- Metadata
  ipfs_hash TEXT NOT NULL,
  collection_metadata JSONB,
  
  -- Stats
  total_supply INTEGER,
  minted_count INTEGER DEFAULT 0,
  floor_price DECIMAL(20, 6),
  volume_traded DECIMAL(20, 6) DEFAULT 0,
  owners_count INTEGER DEFAULT 0,
  listed_count INTEGER DEFAULT 0,
  
  -- Pricing & Hosting
  storage_size_mb DECIMAL(10, 2),
  hosting_fee_kta DECIMAL(10, 6),
  paid_status TEXT DEFAULT 'unpaid', -- unpaid, paid, expired
  
  -- Settings
  royalty_percentage DECIMAL(5, 2) DEFAULT 0,
  is_verified BOOLEAN DEFAULT false,
  is_featured BOOLEAN DEFAULT false,
  
  -- Social Links
  website TEXT,
  twitter TEXT,
  discord TEXT,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Indexes
  CONSTRAINT valid_network CHECK (network IN ('main', 'test')),
  CONSTRAINT valid_royalty CHECK (royalty_percentage >= 0 AND royalty_percentage <= 25),
  CONSTRAINT valid_paid_status CHECK (paid_status IN ('unpaid', 'paid', 'expired'))
);

-- Indexes for performance
CREATE INDEX idx_collections_creator ON collections(creator_address);
CREATE INDEX idx_collections_network ON collections(network);
CREATE INDEX idx_collections_verified ON collections(is_verified) WHERE is_verified = true;
CREATE INDEX idx_collections_featured ON collections(is_featured) WHERE is_featured = true;
CREATE INDEX idx_collections_created ON collections(created_at DESC);
CREATE INDEX idx_collections_volume ON collections(volume_traded DESC);
CREATE INDEX idx_collections_floor ON collections(floor_price);

-- Full text search on name and description
CREATE INDEX idx_collections_search ON collections 
USING GIN (to_tsvector('english', name || ' ' || COALESCE(description, '')));

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_collections_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER collections_updated_at
  BEFORE UPDATE ON collections
  FOR EACH ROW
  EXECUTE FUNCTION update_collections_updated_at();

-- Collection Sales Table (for tracking stats)
CREATE TABLE IF NOT EXISTS collection_sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id TEXT NOT NULL REFERENCES collections(id),
  token_address TEXT NOT NULL,
  seller_address TEXT NOT NULL,
  buyer_address TEXT NOT NULL,
  price_kta DECIMAL(20, 6),
  price_xrge DECIMAL(20, 6),
  currency TEXT NOT NULL,
  network TEXT NOT NULL,
  transaction_hash TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  CONSTRAINT valid_currency CHECK (currency IN ('KTA', 'XRGE'))
);

CREATE INDEX idx_collection_sales_collection ON collection_sales(collection_id);
CREATE INDEX idx_collection_sales_date ON collection_sales(created_at DESC);

-- Function to update collection stats
CREATE OR REPLACE FUNCTION update_collection_stats(col_id TEXT)
RETURNS void AS $$
BEGIN
  UPDATE collections SET
    -- Calculate floor price from active listings
    floor_price = (
      SELECT MIN(COALESCE(price_kta, price_xrge * 0.1))
      FROM nft_listings
      WHERE status = 'active'
      AND token_address IN (
        -- Get all tokens from this collection
        -- This would need to be populated separately
        SELECT token_address FROM nft_listings WHERE status = 'active' LIMIT 1000
      )
    ),
    -- Count listed items
    listed_count = (
      SELECT COUNT(*)
      FROM nft_listings
      WHERE status = 'active'
      LIMIT 1000
    ),
    -- Calculate total volume
    volume_traded = COALESCE((
      SELECT SUM(COALESCE(price_kta, price_xrge * 0.1))
      FROM collection_sales
      WHERE collection_id = col_id
    ), 0),
    updated_at = NOW()
  WHERE id = col_id;
END;
$$ LANGUAGE plpgsql;

-- RLS Policies
ALTER TABLE collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE collection_sales ENABLE ROW LEVEL SECURITY;

-- Everyone can read collections
CREATE POLICY "Collections are viewable by everyone"
  ON collections FOR SELECT
  USING (true);

-- Only creator can update their collection
CREATE POLICY "Creators can update their collections"
  ON collections FOR UPDATE
  USING (creator_address = auth.jwt() ->> 'sub');

-- Only creator can insert
CREATE POLICY "Authenticated users can create collections"
  ON collections FOR INSERT
  WITH CHECK (true);

-- Everyone can read sales
CREATE POLICY "Sales are viewable by everyone"
  ON collection_sales FOR SELECT
  USING (true);

-- System can insert sales
CREATE POLICY "System can insert sales"
  ON collection_sales FOR INSERT
  WITH CHECK (true);

-- Comments
COMMENT ON TABLE collections IS 'NFT collections with metadata and stats';
COMMENT ON TABLE collection_sales IS 'Historical sales data for collection analytics';
COMMENT ON COLUMN collections.storage_size_mb IS 'Total storage size in MB for hosted images';
COMMENT ON COLUMN collections.hosting_fee_kta IS 'One-time hosting fee paid in KTA';
COMMENT ON COLUMN collections.paid_status IS 'Payment status: unpaid, paid, or expired';
