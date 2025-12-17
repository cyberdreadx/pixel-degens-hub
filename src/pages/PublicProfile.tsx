import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Loader2, User, ExternalLink, Calendar } from "lucide-react";
import { toast } from "sonner";
import { useWallet } from "@/contexts/WalletContext";
import * as KeetaNet from "@keetanetwork/keetanet-client";
import NFTCard from "@/components/NFTCard";
import { ipfsToHttp } from "@/utils/nftUtils";

interface Profile {
  id: string;
  wallet_address: string;
  username: string | null;
  avatar_url: string | null;
  bio: string | null;
  ipfs_hash: string | null;
  created_at: string;
}

interface TokenWithMetadata {
  address: string;
  name: string;
  symbol: string;
  balance: string;
  isNFT: boolean;
  metadata: any;
}

interface NFTListing {
  id: string;
  token_address: string;
  seller_address: string;
  price_kta: number | null;
  price_xrge: number | null;
  currency: string;
  status: string;
  network: string;
  created_at: string;
}

export default function PublicProfile() {
  const { walletAddress } = useParams<{ walletAddress: string }>();
  const { publicKey, network } = useWallet();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [tokens, setTokens] = useState<TokenWithMetadata[]>([]);
  const [listings, setListings] = useState<NFTListing[]>([]);
  const [listedNFTs, setListedNFTs] = useState<TokenWithMetadata[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingTokens, setIsLoadingTokens] = useState(true);
  const isOwnProfile = publicKey === walletAddress;
  
  // XRGE token address for current network
  const XRGE_ADDRESS = network === 'main'
    ? 'keeta_aolgxwrcepccr5ycg5ctp3ezhhp6vnpitzm7grymm63hzbaqk6lcsbtccgur6'
    : 'keeta_annmywuiz2pourjmkyuaznxyg6cmv356dda3hpuiqfpwry5m2tlybothdb33s';

  console.log('🔍 [PublicProfile] COMPONENT RENDER');
  console.log('🔍 [PublicProfile] walletAddress from URL:', walletAddress);
  console.log('🔍 [PublicProfile] publicKey:', publicKey);
  console.log('🔍 [PublicProfile] network:', network);

  useEffect(() => {
    console.log('🔍 [PublicProfile] useEffect triggered');
    console.log('🔍 [PublicProfile] walletAddress in useEffect:', walletAddress);
    console.log('🔍 [PublicProfile] network:', network);
    
    if (walletAddress) {
      console.log('🔍 [PublicProfile] Component mounted with address:', walletAddress);
      loadProfile();
      loadTokens();
      loadListings();
    } else {
      console.log('❌ [PublicProfile] NO walletAddress!');
    }
  }, [walletAddress, network]);

  const loadProfile = async () => {
    if (!walletAddress) return;
    
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("wallet_address", walletAddress)
        .maybeSingle();

      if (error && error.code !== "PGRST116") {
        throw error;
      }

      setProfile(data);
    } catch (error: any) {
      console.error("Error loading profile:", error);
      toast.error("Failed to load profile");
    } finally {
      setIsLoading(false);
    }
  };

  const loadListings = async () => {
    if (!walletAddress) return;
    
    try {
      const { data, error } = await supabase
        .from('nft_listings')
        .select('*')
        .eq('seller_address', walletAddress)
        .eq('status', 'active')
        .eq('network', network);

      if (error) throw error;
      
      setListings(data || []);
      
      // Load token info for listed NFTs
      if (data && data.length > 0) {
        await loadListedNFTs(data);
      }
    } catch (error: any) {
      console.error('[PublicProfile] Error loading listings:', error);
    }
  };

  const loadListedNFTs = async (listingsData: NFTListing[]) => {
    try {
      const passphrase = 'temporary-read-only-seed-for-public-profile-viewing-on-keeta-network-degen8bit-application';
      const tempSeed = await KeetaNet.lib.Account.seedFromPassphrase(passphrase);
      const tempAccount = KeetaNet.lib.Account.fromSeed(tempSeed, 0, KeetaNet.lib.Account.AccountKeyAlgorithm.ECDSA_SECP256K1);

      const listedTokens: TokenWithMetadata[] = [];

      for (const listing of listingsData) {
        try {
          const tokenAddress = listing.token_address;
          const tokenAccount = KeetaNet.lib.Account.fromPublicKeyString(tokenAddress);
          
          // Use the listing's network directly
          const tokenNetwork = listing.network;
          
          // Fetch token info using the correct Keeta API endpoint
          const apiBase = tokenNetwork === 'test' 
            ? 'https://rep2.test.network.api.keeta.com/api'
            : 'https://rep2.main.network.api.keeta.com/api';
          
          const response = await fetch(`${apiBase}/node/ledger/accounts/${tokenAddress}`);
          if (!response.ok) continue;
          
          const rawData = await response.json();
          const accountData = Array.isArray(rawData) ? rawData[0] : rawData;
          const tokenInfo = accountData?.info || {};
          
          let metadata = null;
          if (tokenInfo.metadata) {
            try {
              const metadataJson = atob(tokenInfo.metadata);
              metadata = JSON.parse(metadataJson);
            } catch (e) {
              console.error('[PublicProfile] Failed to parse listed NFT metadata:', e);
            }
          }

          listedTokens.push({
            address: tokenAddress,
            name: tokenInfo.name || 'Unknown',
            symbol: '',
            balance: '1',
            isNFT: true,
            metadata
          });
        } catch (error) {
          console.error('[PublicProfile] Error loading listed NFT:', listing.token_address, error);
        }
      }

      setListedNFTs(listedTokens);
    } catch (error: any) {
      console.error('[PublicProfile] Error loading listed NFTs:', error);
    }
  };

  const loadTokens = async () => {
    if (!walletAddress) {
      console.log('[PublicProfile] No wallet address');
      return;
    }
    
    setIsLoadingTokens(true);
    try {
      console.log('[PublicProfile] Loading tokens for:', walletAddress);
      console.log('[PublicProfile] Network:', network);
      
      // Use direct Keeta API to fetch balances
      const apiBase = network === 'test' 
        ? 'https://rep2.test.network.api.keeta.com/api'
        : 'https://rep2.main.network.api.keeta.com/api';
      
      console.log('[PublicProfile] Fetching from API:', apiBase);
      console.log('[PublicProfile] Wallet address:', walletAddress);
      
      const response = await fetch(`${apiBase}/node/ledger/accounts/${walletAddress}`);
      
      console.log('[PublicProfile] API response status:', response.status, response.statusText);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('[PublicProfile] API error response:', errorText);
        throw new Error(`Failed to fetch account data: ${response.statusText}`);
      }
      
      const rawData = await response.json();
      console.log('[PublicProfile] Raw API data:', rawData);
      
      const accountData = Array.isArray(rawData) ? rawData[0] : rawData;
      console.log('[PublicProfile] Account data:', accountData);
      
      const allBalances = accountData?.balances || [];
      
      console.log('[PublicProfile] Found balances:', allBalances.length);
      console.log('[PublicProfile] All balances:', allBalances);
      
      const processedTokens: TokenWithMetadata[] = [];
      
      for (let idx = 0; idx < allBalances.length; idx++) {
        const balanceEntry = allBalances[idx];
        const tokenAddress = balanceEntry.token;
        const balance = BigInt(balanceEntry.balance);
        const isXRGE = tokenAddress === XRGE_ADDRESS;
        
        // Skip zero balances
        if (balance <= 0n) continue;
        
        try {
          console.log(`[PublicProfile] Processing token ${idx + 1}/${allBalances.length}:`, tokenAddress.slice(0, 20) + '...');
          
          // Fetch token info - use /accounts endpoint to get token account info
          const tokenResponse = await fetch(`${apiBase}/node/ledger/accounts/${tokenAddress}`);
          console.log('[PublicProfile] Token API response:', tokenResponse.status);
          
          if (!tokenResponse.ok) {
            console.warn('[PublicProfile] Failed to fetch token info for:', tokenAddress);
            continue;
          }
          
          const tokenData = await tokenResponse.json();
          console.log('[PublicProfile] Raw token data:', tokenData);
          
          const tokenAccountData = Array.isArray(tokenData) ? tokenData[0] : tokenData;
          const tokenInfo = tokenAccountData?.info || {};
          console.log('[PublicProfile] Parsed token info:', tokenInfo);
          
          // Convert hex supply to BigInt
          const supplyHex = tokenInfo?.supply || '0x0';
          const supply = BigInt(supplyHex);
          
          // Parse metadata to get decimals and check platform
          let metadata = null;
          if (tokenInfo?.metadata) {
            try {
              const metadataJson = atob(tokenInfo.metadata);
              metadata = JSON.parse(metadataJson);
            } catch (e) {
              console.error('[PublicProfile] Failed to parse metadata for', tokenAddress);
            }
          }
          
          const decimals = metadata?.decimalPlaces || metadata?.decimals || tokenInfo?.decimals || 0;
          
          // Check if it's an NFT: platform is degen8bit OR (supply = 1 and decimals = 0)
          const isNFT = metadata?.platform === 'degen8bit' ||
                        (supply === 1n && decimals === 0);
          
          console.log('[PublicProfile] Token analysis:', {
            address: tokenAddress.slice(0, 20) + '...',
            name: tokenInfo?.name,
            balance: balance.toString(),
            supply: supply.toString(),
            decimals,
            isNFT,
            isXRGE,
            willInclude: isNFT || isXRGE
          });
          
          // Only include NFTs and XRGE
          if (!isNFT && !isXRGE) continue;
          
          console.log('[PublicProfile] ✅ Including token:', tokenInfo?.name);
          console.log('[PublicProfile] Metadata:', metadata);
          
          processedTokens.push({
            address: tokenAddress,
            name: tokenInfo?.name || 'Unknown',
            symbol: tokenInfo?.symbol || '',
            balance: balance.toString(),
            isNFT,
            metadata
          });
        } catch (err) {
          console.error(`[PublicProfile] Error processing token ${tokenAddress}:`, err);
        }
      }
      
      console.log('[PublicProfile] Processed tokens:', processedTokens.length);
      console.log('[PublicProfile] NFTs detected:', processedTokens.filter(t => t.isNFT).length);
      console.log('[PublicProfile] NFTs with metadata:', processedTokens.filter(t => t.isNFT && t.metadata).length);
      
      // Log each NFT for debugging
      processedTokens.filter(t => t.isNFT).forEach(nft => {
        console.log('[PublicProfile] NFT Found:', {
          name: nft.name,
          address: nft.address.slice(0, 20) + '...',
          hasMetadata: !!nft.metadata,
          metadataKeys: nft.metadata ? Object.keys(nft.metadata) : []
        });
      });
      
      setTokens(processedTokens);
    } catch (error: any) {
      console.error("[PublicProfile] Error loading tokens:", error);
    } finally {
      setIsLoadingTokens(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 pt-20">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4 text-primary neon-glow" />
          <p className="text-muted-foreground text-lg font-pixel">Loading profile...</p>
        </div>
      </div>
    );
  }

  const displayName = profile?.username || `${walletAddress?.slice(0, 12)}...${walletAddress?.slice(-8)}`;
  const nfts = tokens.filter(t => t.isNFT);
  const activeListings = listings.filter(l => l.status === 'active');

  return (
    <div className="min-h-screen pt-16 bg-gradient-to-br from-background via-background to-purple-950/20">
      {/* Animated Background Effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-accent/5 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute inset-0 scanlines opacity-5" />
      </div>

      {/* Profile Content */}
      <div className="container mx-auto px-4 py-12 relative z-10">
        <div className="max-w-6xl mx-auto space-y-8">
          {/* Profile Header Card */}
          <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-background/95 via-background/90 to-purple-950/30 backdrop-blur-sm border border-primary/20 pixel-border p-8 md:p-12 animate-fade-in">
            {/* Glow Effects */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-primary/10 to-transparent rounded-full blur-3xl" />
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-gradient-to-tr from-accent/10 to-transparent rounded-full blur-3xl" />
            
            <div className="relative flex flex-col md:flex-row items-center md:items-start gap-8">
              {/* Neon Avatar */}
              <div className="relative animate-scale-in">
                <div className="absolute inset-0 bg-gradient-to-br from-primary to-accent rounded-full blur-xl opacity-50 animate-pulse" />
                <Avatar className="relative h-40 w-40 md:h-48 md:w-48 border-4 border-primary/30 shadow-2xl shadow-primary/20 bg-gradient-to-br from-primary/20 to-accent/20">
                  <AvatarImage src={profile?.avatar_url || undefined} className="object-cover" />
                  <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-background">
                    <User className="h-20 w-20 md:h-24 md:w-24" />
                  </AvatarFallback>
                </Avatar>
              </div>

              {/* Profile Info */}
              <div className="flex-1 text-center md:text-left space-y-6">
                <div>
                  {/* Wallet Address with Neon Glow */}
                  <h1 className="text-3xl md:text-5xl font-bold font-pixel mb-3 neon-glow text-primary break-all">
                    {walletAddress?.slice(0, 16)}...{walletAddress?.slice(-10)}
                  </h1>
                  
                  {profile?.username && (
                    <p className="text-xl text-muted-foreground mb-2">@{profile.username}</p>
                  )}

                  <div className="flex items-center justify-center md:justify-start gap-3 mt-4">
                    <a
                      href={`https://explorer.${network === 'test' ? 'test.' : ''}keeta.com/account/${walletAddress}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-sm text-primary hover:text-primary/80 transition-colors pixel-border px-4 py-2 bg-primary/5 rounded hover:bg-primary/10"
                    >
                      <ExternalLink className="h-4 w-4" />
                      <span className="font-pixel">VIEW ON EXPLORER</span>
                    </a>
                    
                    {isOwnProfile && (
                      <Link to="/profile">
                        <Button className="pixel-border font-pixel neon-glow">
                          EDIT PROFILE
                        </Button>
                      </Link>
                    )}
                  </div>
                </div>

                {/* Bio */}
                {profile?.bio && (
                  <div className="bg-background/50 rounded-lg p-4 border border-border/50">
                    <p className="text-foreground leading-relaxed">{profile.bio}</p>
                  </div>
                )}

                {/* Stats Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6">
                  {/* NFT Count */}
                  <div className="relative group">
                    <div className="absolute inset-0 bg-primary/20 rounded-lg blur group-hover:bg-primary/30 transition-colors" />
                    <div className="relative bg-background/80 backdrop-blur-sm rounded-lg p-6 border border-primary/30 text-center pixel-border hover:border-primary/50 transition-all">
                      <div className="text-4xl font-bold font-pixel text-primary neon-glow mb-2">{nfts.length}</div>
                      <div className="text-xs text-muted-foreground uppercase tracking-widest font-pixel">NFTs OWNED</div>
                    </div>
                  </div>

                  {/* Listed NFTs Count */}
                  <div className="relative group">
                    <div className="absolute inset-0 bg-accent/20 rounded-lg blur group-hover:bg-accent/30 transition-colors" />
                    <div className="relative bg-background/80 backdrop-blur-sm rounded-lg p-6 border border-accent/30 text-center pixel-border hover:border-accent/50 transition-all">
                      <div className="text-4xl font-bold font-pixel text-accent neon-glow mb-2">{activeListings.length}</div>
                      <div className="text-xs text-muted-foreground uppercase tracking-widest font-pixel">NFTs LISTED</div>
                    </div>
                  </div>

                  {/* Member Since */}
                  {profile?.created_at && (
                    <div className="relative group">
                      <div className="absolute inset-0 bg-secondary/20 rounded-lg blur group-hover:bg-secondary/30 transition-colors" />
                      <div className="relative bg-background/80 backdrop-blur-sm rounded-lg p-6 border border-secondary/30 text-center pixel-border hover:border-secondary/50 transition-all">
                        <div className="text-sm font-bold font-pixel text-secondary mb-2">
                          {new Date(profile.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                        </div>
                        <div className="text-xs text-muted-foreground uppercase tracking-widest font-pixel">MEMBER SINCE</div>
                      </div>
                    </div>
                  )}

                  {/* IPFS */}
                  {profile?.ipfs_hash && (
                    <div className="relative group">
                      <div className="absolute inset-0 bg-muted/20 rounded-lg blur group-hover:bg-muted/30 transition-colors" />
                      <a
                        href={`https://gateway.pinata.cloud/ipfs/${profile.ipfs_hash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="relative block bg-background/80 backdrop-blur-sm rounded-lg p-6 border border-muted/30 text-center pixel-border hover:border-muted/50 transition-all"
                      >
                        <div className="text-xs font-mono text-muted-foreground mb-2 truncate">
                          {profile.ipfs_hash.slice(0, 12)}...
                        </div>
                        <div className="text-xs text-muted-foreground uppercase tracking-widest font-pixel flex items-center justify-center gap-1">
                          IPFS PROFILE <ExternalLink className="h-3 w-3" />
                        </div>
                      </a>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* NFT Collection Section */}
          <div className="relative overflow-hidden rounded-xl bg-background/95 backdrop-blur-sm border border-border/50 p-6 md:p-8 animate-fade-in" style={{ animationDelay: '0.1s' }}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl md:text-3xl font-bold font-pixel text-primary neon-glow">NFT COLLECTION</h2>
              <div className="pixel-border px-4 py-2 bg-primary/10 rounded">
                <span className="text-sm font-bold font-pixel text-primary">{nfts.length} ITEMS</span>
              </div>
            </div>

            {isLoadingTokens ? (
              <div className="text-center py-20">
                <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4 text-primary neon-glow" />
                <p className="text-muted-foreground font-pixel">LOADING COLLECTION...</p>
              </div>
            ) : nfts.length === 0 ? (
              <div className="text-center py-20 border-2 border-dashed border-primary/30 rounded-lg bg-background/30 backdrop-blur-sm pixel-border">
                <div className="text-primary font-bold text-xl mb-3 font-pixel neon-glow">NO NFTs IN COLLECTION</div>
                <p className="text-sm text-muted-foreground font-pixel">
                  {isOwnProfile ? "THIS USER HASN'T COLLECTED ANY NFTs YET" : "START COLLECTING NFTs TO SEE THEM HERE"}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {nfts.map((nft, index) => (
                  <div key={nft.address} className="animate-scale-in" style={{ animationDelay: `${index * 0.05}s` }}>
                    <NFTCard 
                      id={nft.address}
                      title={nft.metadata?.name || nft.name}
                      creator={nft.metadata?.platform || nft.metadata?.version || "keeta network"}
                      price={nft.balance}
                      image={nft.metadata?.image ? ipfsToHttp(nft.metadata.image) : ''}
                      likes={0}
                      comments={0}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Listed NFTs Section */}
          {activeListings.length > 0 && (
            <div className="relative overflow-hidden rounded-xl bg-background/95 backdrop-blur-sm border border-border/50 p-6 md:p-8 animate-fade-in mt-8" style={{ animationDelay: '0.2s' }}>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl md:text-3xl font-bold font-pixel text-accent neon-glow">LISTED FOR SALE</h2>
                <div className="pixel-border px-4 py-2 bg-accent/10 rounded">
                  <span className="text-sm font-bold font-pixel text-accent">{activeListings.length} ITEMS</span>
                </div>
              </div>

              {listedNFTs.length === 0 ? (
                <div className="text-center py-10">
                  <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-accent neon-glow" />
                  <p className="text-muted-foreground font-pixel">LOADING LISTINGS...</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {listedNFTs.map((nft, index) => {
                    const listing = listings.find(l => l.token_address === nft.address);
                    return (
                      <div key={nft.address} className="animate-scale-in" style={{ animationDelay: `${index * 0.05}s` }}>
                        <div className="relative">
                          <NFTCard 
                            id={nft.address}
                            title={nft.metadata?.name || nft.name}
                            creator={nft.metadata?.platform || nft.metadata?.version || "keeta network"}
                            price={listing?.price_kta ? listing.price_kta.toString() : listing?.price_xrge ? listing.price_xrge.toString() : '0'}
                            image={nft.metadata?.image ? ipfsToHttp(nft.metadata.image) : ''}
                            likes={0}
                            comments={0}
                          />
                          <div className="absolute top-2 right-2 bg-accent/90 backdrop-blur-sm px-3 py-1 rounded pixel-border">
                            <span className="text-xs font-pixel text-background font-bold">
                              {listing?.price_kta ? `${listing.price_kta} KTA` : listing?.price_xrge ? `${listing.price_xrge} XRGE` : 'LISTED'}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
