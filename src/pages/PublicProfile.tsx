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

export default function PublicProfile() {
  const { walletAddress } = useParams<{ walletAddress: string }>();
  const { publicKey } = useWallet();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [tokens, setTokens] = useState<TokenWithMetadata[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingTokens, setIsLoadingTokens] = useState(true);
  const isOwnProfile = publicKey === walletAddress;
  
  // Default to testnet for now - could be made configurable later
  const network = 'test';
  
  // XRGE token address for testnet
  const XRGE_ADDRESS = 'keeta_annmywuiz2pourjmkyuaznxyg6cmv356dda3hpuiqfpwry5m2tlybothdb33s';

  console.log('🔍 [PublicProfile] COMPONENT RENDER');
  console.log('🔍 [PublicProfile] walletAddress from URL:', walletAddress);
  console.log('🔍 [PublicProfile] publicKey:', publicKey);
  console.log('🔍 [PublicProfile] network:', network);

  useEffect(() => {
    console.log('🔍 [PublicProfile] useEffect triggered');
    console.log('🔍 [PublicProfile] walletAddress in useEffect:', walletAddress);
    
    if (walletAddress) {
      console.log('🔍 [PublicProfile] Component mounted with address:', walletAddress);
      loadProfile();
      loadTokens();
    } else {
      console.log('❌ [PublicProfile] NO walletAddress!');
    }
  }, [walletAddress]);

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

  const loadTokens = async () => {
    if (!walletAddress) {
      console.log('[PublicProfile] No wallet address');
      return;
    }
    
    setIsLoadingTokens(true);
    try {
      console.log('[PublicProfile] Loading tokens for:', walletAddress);
      console.log('[PublicProfile] Network:', network);
      
      // Create a temporary account for read-only access
      // Use seedFromPassphrase to convert a passphrase to a proper seed (needs to be long enough)
      const passphrase = 'temporary-read-only-seed-for-public-profile-viewing-on-keeta-network-degen8bit-application';
      const tempSeed = await KeetaNet.lib.Account.seedFromPassphrase(passphrase);
      const tempAccount = KeetaNet.lib.Account.fromSeed(tempSeed, 0, KeetaNet.lib.Account.AccountKeyAlgorithm.ECDSA_SECP256K1);
      const client = KeetaNet.UserClient.fromNetwork(network, tempAccount);
      
      console.log('[PublicProfile] Client created');
      
      // Get the actual account we want to view
      const accountObj = KeetaNet.lib.Account.fromPublicKeyString(walletAddress);
      
      console.log('[PublicProfile] Fetching tokens...');
      
      // Fetch tokens with info for the target account
      const tokensWithInfo = await client.listACLsByPrincipalWithInfo({ account: accountObj });
      
      console.log('[PublicProfile] Found tokens:', tokensWithInfo.length);
      
      const processedTokens: TokenWithMetadata[] = [];
      
      for (const tokenInfo of tokensWithInfo) {
        if (!tokenInfo.entity.isToken()) continue;
        
        const balance = tokenInfo.balances?.[0]?.balance || 0n;
        const supply = BigInt(tokenInfo.info.supply || '0');
        const isNFT = supply === 1n;
        const tokenAddress = tokenInfo.entity.publicKeyString.toString();
        const isXRGE = tokenAddress === XRGE_ADDRESS;
        
        // Log ALL tokens found (even with 0 balance) for debugging
        console.log('[PublicProfile] Token Found:', {
          address: tokenAddress.slice(0, 20) + '...',
          name: tokenInfo.info.name,
          balance: balance.toString(),
          supply: supply.toString(),
          isNFT,
          willBeIncluded: balance > 0n && (isNFT || isXRGE)
        });
        
        // Skip tokens with 0 balance (they were transferred/listed)
        if (balance <= 0n) {
          console.log('[PublicProfile] ⚠️ Skipping token (balance is 0 - may be listed for sale)');
          continue;
        }
        
        // Only show NFTs and XRGE token
        if (!isNFT && !isXRGE) continue;
        
        console.log('[PublicProfile] ✅ Including token:', tokenInfo.info.name);
        
        let metadata = null;
        if (tokenInfo.info.metadata) {
          try {
            const metadataBuffer = Buffer.from(tokenInfo.info.metadata, 'base64');
            metadata = JSON.parse(metadataBuffer.toString('utf8'));
            console.log('[PublicProfile] Metadata parsed:', metadata);
          } catch (e) {
            console.error('[PublicProfile] Failed to parse metadata:', e);
          }
        }
        
        processedTokens.push({
          address: tokenInfo.entity.publicKeyString.toString(),
          name: tokenInfo.info.name || 'Unknown',
          symbol: '',
          balance: balance.toString(),
          isNFT,
          metadata
        });
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
          <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground text-lg">Loading profile...</p>
        </div>
      </div>
    );
  }

  const displayName = profile?.username || `${walletAddress?.slice(0, 12)}...${walletAddress?.slice(-8)}`;
  const nfts = tokens.filter(t => t.isNFT);

  return (
    <div className="min-h-screen pt-16">
      {/* Hero Section with Gradient Background */}
      <div className="relative h-64 md:h-80 bg-gradient-to-br from-primary/20 via-secondary/20 to-accent/20 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(var(--primary-rgb),0.1),transparent_50%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_50%,rgba(var(--accent-rgb),0.1),transparent_50%)]" />
        <div className="absolute inset-0 scanlines opacity-10" />
      </div>

      {/* Profile Content */}
      <div className="container mx-auto px-4 -mt-24 md:-mt-32 pb-12">
        <div className="max-w-5xl mx-auto">
          {/* Avatar & Header Card */}
          <Card className="p-6 md:p-8 glass border-border mb-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-primary/5 to-transparent rounded-full blur-3xl" />
            
            <div className="relative flex flex-col md:flex-row items-start md:items-end gap-6">
              {/* Large Avatar */}
              <Avatar className="h-32 w-32 md:h-40 md:w-40 border-4 border-background shadow-2xl ring-2 ring-primary/20">
                <AvatarImage src={profile?.avatar_url || undefined} />
                <AvatarFallback className="bg-gradient-to-br from-primary to-accent">
                  <User className="h-16 w-16 md:h-20 md:w-20 text-primary-foreground" />
                </AvatarFallback>
              </Avatar>

              {/* Name & Info */}
              <div className="flex-1">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4">
                  <div>
                    <h1 className="text-3xl md:text-4xl font-bold mb-2 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                      {displayName}
                    </h1>
                    {profile?.username && (
                      <p className="text-sm text-muted-foreground font-mono flex items-center gap-2">
                        {walletAddress?.slice(0, 16)}...{walletAddress?.slice(-8)}
                        <a
                          href={`https://explorer.keeta.com/account/${walletAddress}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:text-primary/80 transition-colors"
                        >
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </p>
                    )}
                  </div>
                  
                  {isOwnProfile && (
                    <Link to="/profile">
                      <Button className="shadow-lg">
                        Edit Profile
                      </Button>
                    </Link>
                  )}
                </div>

                {/* Stats Row */}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div className="bg-gradient-to-br from-primary/10 to-primary/5 rounded-lg p-4 border border-primary/20">
                    <div className="text-2xl md:text-3xl font-bold text-primary mb-1">{nfts.length}</div>
                    <div className="text-xs text-muted-foreground uppercase tracking-wide">NFTs Owned</div>
                  </div>
                  {profile?.created_at && (
                    <div className="bg-gradient-to-br from-accent/10 to-accent/5 rounded-lg p-4 border border-accent/20">
                      <div className="text-sm md:text-base font-bold text-accent mb-1">
                        {new Date(profile.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                      </div>
                      <div className="text-xs text-muted-foreground uppercase tracking-wide">Member Since</div>
                    </div>
                  )}
                  {profile?.ipfs_hash && (
                    <div className="bg-gradient-to-br from-secondary/10 to-secondary/5 rounded-lg p-4 border border-secondary/20 col-span-2 md:col-span-1">
                      <a
                        href={`https://gateway.pinata.cloud/ipfs/${profile.ipfs_hash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 group"
                      >
                        <div className="text-xs font-mono text-secondary group-hover:text-secondary/80 transition-colors">
                          {profile.ipfs_hash.slice(0, 10)}...
                        </div>
                        <ExternalLink className="h-3 w-3 text-secondary" />
                      </a>
                      <div className="text-xs text-muted-foreground uppercase tracking-wide mt-1">IPFS Profile</div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Bio Section */}
            {profile?.bio && (
              <div className="mt-6 pt-6 border-t border-border">
                <p className="text-foreground leading-relaxed">{profile.bio}</p>
              </div>
            )}
          </Card>

          {/* NFT Collection */}
          <Card className="p-6 md:p-8 glass border-border">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold">NFT Collection</h2>
              <div className="px-4 py-2 bg-primary/10 rounded-full">
                <span className="text-sm font-medium text-primary">{nfts.length} items</span>
              </div>
            </div>

            {isLoadingTokens ? (
              <div className="text-center py-16">
                <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
                <p className="text-muted-foreground">Loading collection...</p>
              </div>
            ) : nfts.length === 0 ? (
              <div className="text-center py-16 border-2 border-dashed border-border rounded-lg">
                <div className="text-muted-foreground mb-2 text-lg">No NFTs in collection</div>
                <p className="text-sm text-muted-foreground/60">
                  {isOwnProfile ? "Start collecting NFTs to see them here" : "This user hasn't collected any NFTs yet"}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {nfts.map((nft) => (
                  <NFTCard 
                    key={nft.address}
                    id={nft.address}
                    title={nft.metadata?.name || nft.name}
                    creator={nft.metadata?.platform || nft.metadata?.version || "keeta network"}
                    price={nft.balance}
                    image={nft.metadata?.image ? ipfsToHttp(nft.metadata.image) : ''}
                    likes={0}
                    comments={0}
                  />
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
