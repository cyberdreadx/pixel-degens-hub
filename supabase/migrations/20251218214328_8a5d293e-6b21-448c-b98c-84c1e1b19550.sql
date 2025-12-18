-- Create table to store unminted NFT pool for collections
CREATE TABLE public.collection_nfts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  collection_id TEXT NOT NULL,
  nft_index INTEGER NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  image_ipfs TEXT NOT NULL,
  attributes JSONB DEFAULT '[]'::jsonb,
  minted BOOLEAN NOT NULL DEFAULT false,
  minted_to TEXT,
  minted_at TIMESTAMP WITH TIME ZONE,
  token_address TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Ensure unique index per collection
  UNIQUE(collection_id, nft_index)
);

-- Enable RLS
ALTER TABLE public.collection_nfts ENABLE ROW LEVEL SECURITY;

-- Anyone can view NFT pool (to see remaining supply)
CREATE POLICY "Anyone can view collection NFTs"
ON public.collection_nfts
FOR SELECT
USING (true);

-- Anyone can insert (edge function handles validation)
CREATE POLICY "Anyone can create collection NFTs"
ON public.collection_nfts
FOR INSERT
WITH CHECK (true);

-- Anyone can update (edge function handles minting)
CREATE POLICY "Anyone can update collection NFTs"
ON public.collection_nfts
FOR UPDATE
USING (true)
WITH CHECK (true);

-- Create index for faster queries
CREATE INDEX idx_collection_nfts_collection_id ON public.collection_nfts(collection_id);
CREATE INDEX idx_collection_nfts_unminted ON public.collection_nfts(collection_id, minted) WHERE minted = false;