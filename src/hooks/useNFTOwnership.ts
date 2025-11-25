import { useState, useEffect } from 'react';
import { useWallet } from '@/contexts/WalletContext';
import * as KeetaNet from '@keetanetwork/keetanet-client';
import { supabase } from '@/integrations/supabase/client';

export interface NFTOwner {
  address: string;
  isAnchor: boolean;
  isYou: boolean;
}

export interface NFTTransaction {
  id: string;
  type: 'list' | 'sale' | 'transfer';
  from: string;
  to: string;
  price?: number;
  currency?: string;
  timestamp: string;
  transactionHash?: string;
}

export function useNFTOwnership(tokenAddress: string) {
  const { client, network, publicKey } = useWallet();
  const [owner, setOwner] = useState<NFTOwner | null>(null);
  const [transactions, setTransactions] = useState<NFTTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const ANCHOR_ADDRESS = network === 'test'
    ? 'keeta_aabszsbrqppriqddrkptq5awubshpq3cgsoi4rc624xm6phdt74vo5w7wipwtmi'
    : 'keeta_aabszsbrqppriqddrkptq5awubshpq3cgsoi4rc624xm6phdt74vo5w7wipwtmi';

  useEffect(() => {
    if (!tokenAddress) return;

    const loadOwnership = async () => {
      setIsLoading(true);
      try {
        // Create a standalone client if user isn't connected
        let clientToUse = client;
        if (!client) {
          // Create anonymous read-only client for browsing without wallet
          const dummyAccount = KeetaNet.lib.Account.fromSeed('0'.repeat(64), 0, KeetaNet.lib.Account.AccountKeyAlgorithm.ECDSA_SECP256K1);
          clientToUse = KeetaNet.UserClient.fromNetwork(network, dummyAccount);
        }

        // Find who owns the NFT by checking balances
        const tokenAccountObj = KeetaNet.lib.Account.fromPublicKeyString(tokenAddress);
        
        // Check anchor first (most likely if listed)
        const anchorAccountObj = KeetaNet.lib.Account.fromPublicKeyString(ANCHOR_ADDRESS);
        const anchorBalance = await clientToUse.balance(tokenAccountObj, { account: anchorAccountObj });
        
        if (anchorBalance > 0n) {
          setOwner({
            address: ANCHOR_ADDRESS,
            isAnchor: true,
            isYou: false,
          });
        } else if (publicKey) {
          // Check current user
          const userAccountObj = KeetaNet.lib.Account.fromPublicKeyString(publicKey);
          const userBalance = await clientToUse.balance(tokenAccountObj, { account: userAccountObj });
          
          if (userBalance > 0n) {
            setOwner({
              address: publicKey,
              isAnchor: false,
              isYou: true,
            });
          } else {
            // Someone else owns it - we'd need to scan or check transaction history
            // For now, we'll just say "Unknown" 
            setOwner({
              address: 'Unknown',
              isAnchor: false,
              isYou: false,
            });
          }
        }

        // Load transaction history from database
        await loadTransactionHistory();
      } catch (error) {
        console.error('[useNFTOwnership] Error loading ownership:', error);
      } finally {
        setIsLoading(false);
      }
    };

    const loadTransactionHistory = async () => {
      try {
        const history: NFTTransaction[] = [];

        // Get listing history
        const { data: listings, error: listingError } = await supabase
          .from('nft_listings')
          .select('*')
          .eq('token_address', tokenAddress)
          .eq('network', network)
          .order('created_at', { ascending: false });

        if (!listingError && listings) {
          for (const listing of listings) {
            // Add listing event
            history.push({
              id: `list-${listing.id}`,
              type: 'list',
              from: listing.seller_address,
              to: ANCHOR_ADDRESS,
              price: listing.currency === 'KTA' ? listing.price_kta : listing.price_xrge,
              currency: listing.currency,
              timestamp: listing.created_at,
            });

            // Add sale event if sold
            if (listing.status === 'sold' && listing.buyer_address && listing.sold_at) {
              history.push({
                id: `sale-${listing.id}`,
                type: 'sale',
                from: listing.seller_address,
                to: listing.buyer_address,
                price: listing.currency === 'KTA' ? listing.price_kta : listing.price_xrge,
                currency: listing.currency,
                timestamp: listing.sold_at,
              });
            }
          }
        }

        // Sort by timestamp (newest first)
        history.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

        setTransactions(history);
      } catch (error) {
        console.error('[useNFTOwnership] Error loading transaction history:', error);
      }
    };

    loadOwnership();
  }, [client, tokenAddress, network, publicKey, ANCHOR_ADDRESS]);

  return { owner, transactions, isLoading };
}

