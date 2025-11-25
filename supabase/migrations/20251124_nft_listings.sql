-- NFT Listings Table for Marketplace
CREATE TABLE IF NOT EXISTS nft_listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token_address TEXT NOT NULL,
  seller_address TEXT NOT NULL,
  price_kta DECIMAL,
  price_xrge DECIMAL,
  currency TEXT NOT NULL CHECK (currency IN ('KTA', 'XRGE')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'sold', 'cancelled')),
  network TEXT NOT NULL CHECK (network IN ('test', 'main')),
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  sold_at TIMESTAMP WITH TIME ZONE,
  buyer_address TEXT,
  CONSTRAINT price_check CHECK (
    (currency = 'KTA' AND price_kta IS NOT NULL AND price_kta > 0) OR
    (currency = 'XRGE' AND price_xrge IS NOT NULL AND price_xrge > 0)
  )
);

-- Index for faster queries
CREATE INDEX idx_nft_listings_status ON nft_listings(status);
CREATE INDEX idx_nft_listings_token ON nft_listings(token_address);
CREATE INDEX idx_nft_listings_seller ON nft_listings(seller_address);
CREATE INDEX idx_nft_listings_network ON nft_listings(network);

-- Enable Row Level Security
ALTER TABLE nft_listings ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can read active listings
CREATE POLICY "Anyone can view active listings"
  ON nft_listings FOR SELECT
  USING (status = 'active');

-- Policy: Anyone can view all listings (for history/analytics)
CREATE POLICY "Anyone can view all listings"
  ON nft_listings FOR SELECT
  USING (true);

-- Policy: Service role can do everything (for edge functions)
CREATE POLICY "Service role can manage listings"
  ON nft_listings FOR ALL
  USING (auth.role() = 'service_role');
