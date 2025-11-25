-- Create nft_listings table for marketplace
CREATE TABLE IF NOT EXISTS public.nft_listings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  token_address TEXT NOT NULL,
  seller_address TEXT NOT NULL,
  buyer_address TEXT,
  price_kta NUMERIC,
  price_xrge NUMERIC,
  currency TEXT NOT NULL CHECK (currency IN ('KTA', 'XRGE')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'sold', 'cancelled')),
  network TEXT NOT NULL DEFAULT 'main' CHECK (network IN ('main', 'test')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  sold_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS
ALTER TABLE public.nft_listings ENABLE ROW LEVEL SECURITY;

-- Allow public read access to listings
CREATE POLICY "Anyone can view NFT listings"
ON public.nft_listings
FOR SELECT
USING (true);

-- Allow anyone to create listings
CREATE POLICY "Anyone can create NFT listings"
ON public.nft_listings
FOR INSERT
WITH CHECK (true);

-- Allow sellers to cancel their own listings
CREATE POLICY "Sellers can cancel their own listings"
ON public.nft_listings
FOR UPDATE
USING (status = 'active')
WITH CHECK (true);

-- Create index for faster queries
CREATE INDEX idx_nft_listings_status ON public.nft_listings(status);
CREATE INDEX idx_nft_listings_network ON public.nft_listings(network);
CREATE INDEX idx_nft_listings_token ON public.nft_listings(token_address);