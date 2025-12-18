-- Create collections table for storing collection metadata
CREATE TABLE public.collections (
  id TEXT NOT NULL PRIMARY KEY,
  name TEXT NOT NULL,
  symbol TEXT NOT NULL,
  description TEXT,
  creator_address TEXT NOT NULL,
  logo_image TEXT,
  banner_image TEXT,
  total_supply INTEGER,
  minted_count INTEGER NOT NULL DEFAULT 0,
  floor_price NUMERIC,
  volume_traded NUMERIC NOT NULL DEFAULT 0,
  listed_count INTEGER NOT NULL DEFAULT 0,
  is_verified BOOLEAN NOT NULL DEFAULT false,
  is_featured BOOLEAN NOT NULL DEFAULT false,
  network TEXT NOT NULL DEFAULT 'main',
  mint_enabled BOOLEAN NOT NULL DEFAULT false,
  mint_price_kta NUMERIC,
  mint_price_xrge NUMERIC,
  max_per_wallet INTEGER,
  ipfs_hash TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.collections ENABLE ROW LEVEL SECURITY;

-- Anyone can view collections
CREATE POLICY "Anyone can view collections"
  ON public.collections
  FOR SELECT
  USING (true);

-- Anyone can create collections (wallet-based auth)
CREATE POLICY "Anyone can create collections"
  ON public.collections
  FOR INSERT
  WITH CHECK (true);

-- Only creator can update their collection
CREATE POLICY "Creator can update their collection"
  ON public.collections
  FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- Create indexes
CREATE INDEX idx_collections_network ON public.collections(network);
CREATE INDEX idx_collections_creator ON public.collections(creator_address);
CREATE INDEX idx_collections_featured ON public.collections(is_featured) WHERE is_featured = true;

-- Trigger for updated_at
CREATE TRIGGER update_collections_updated_at
  BEFORE UPDATE ON public.collections
  FOR EACH ROW
  EXECUTE FUNCTION public.update_profiles_updated_at();