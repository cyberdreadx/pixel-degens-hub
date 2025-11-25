-- Add network column to price_history table
ALTER TABLE public.price_history 
ADD COLUMN IF NOT EXISTS network TEXT DEFAULT 'main' CHECK (network IN ('main', 'test'));

-- Create index for network filtering
CREATE INDEX IF NOT EXISTS idx_price_history_network 
ON public.price_history(network, timestamp DESC);

-- Update existing records to use 'main' network
UPDATE public.price_history 
SET network = 'main' 
WHERE network IS NULL;

