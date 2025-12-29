-- Add royalty_percentage column to collections table
ALTER TABLE public.collections 
ADD COLUMN IF NOT EXISTS royalty_percentage numeric DEFAULT 5 CHECK (royalty_percentage >= 0 AND royalty_percentage <= 10);

-- Update existing collections to have default 5% royalty
UPDATE public.collections SET royalty_percentage = 5 WHERE royalty_percentage IS NULL;