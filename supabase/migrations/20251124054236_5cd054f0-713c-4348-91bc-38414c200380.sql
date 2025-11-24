-- Create table for price history
CREATE TABLE IF NOT EXISTS public.price_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
  from_token TEXT NOT NULL,
  to_token TEXT NOT NULL,
  rate DECIMAL(24, 8) NOT NULL,
  kta_balance DECIMAL(24, 8),
  xrge_balance DECIMAL(24, 8),
  volume_24h DECIMAL(24, 8) DEFAULT 0
);

-- Create index for faster queries
CREATE INDEX idx_price_history_timestamp ON public.price_history(timestamp DESC);
CREATE INDEX idx_price_history_tokens ON public.price_history(from_token, to_token, timestamp DESC);

-- Enable RLS
ALTER TABLE public.price_history ENABLE ROW LEVEL SECURITY;

-- Public read access (anyone can view price history)
CREATE POLICY "Allow public read access to price history"
ON public.price_history
FOR SELECT
USING (true);