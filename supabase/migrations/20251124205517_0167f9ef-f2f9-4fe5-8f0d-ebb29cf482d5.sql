-- Add network column to price_history table to separate testnet and mainnet data
ALTER TABLE price_history ADD COLUMN network TEXT NOT NULL DEFAULT 'main';

-- Create index for faster network filtering
CREATE INDEX idx_price_history_network ON price_history(network, timestamp DESC);