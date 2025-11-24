-- Add IPFS hash column to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS ipfs_hash TEXT;