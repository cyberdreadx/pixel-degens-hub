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
  const { publicKey, network } = useWallet();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [tokens, setTokens] = useState<TokenWithMetadata[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingTokens, setIsLoadingTokens] = useState(true);
  const isOwnProfile = publicKey === walletAddress;

  useEffect(() => {
    if (walletAddress) {
      loadProfile();
      loadTokens();
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

  const loadTokens = async () => {
    if (!walletAddress) return;
    
    setIsLoadingTokens(true);
    try {
      console.log('[PublicProfile] Loading tokens for:', walletAddress);
      console.log('[PublicProfile] Network:', network);
      
      // Create a temporary account for read-only access
      const tempSeed = 'temporary-read-only-seed-for-public-profile-viewing';
      const tempAccount = KeetaNet.lib.Account.fromSeed(tempSeed, 0, KeetaNet.lib.Account.AccountKeyAlgorithm.ECDSA_SECP256K1);
      const client = KeetaNet.UserClient.fromNetwork(network || 'test', tempAccount);
      
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
        if (balance <= 0n) continue;
        
        const supply = BigInt(tokenInfo.info.supply || '0');
        const isNFT = supply === 1n;
        
        console.log('[PublicProfile] Token:', {
          address: tokenInfo.entity.publicKeyString.toString(),
          name: tokenInfo.info.name,
          balance: balance.toString(),
          supply: supply.toString(),
          isNFT
        });
        
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
          symbol: '', // Symbol is not directly available from AccountInfo
          balance: balance.toString(),
          isNFT,
          metadata
        });
      }
      
      console.log('[PublicProfile] Processed tokens:', processedTokens.length);
      console.log('[PublicProfile] NFTs:', processedTokens.filter(t => t.isNFT && t.metadata).length);
      
      setTokens(processedTokens);
    } catch (error: any) {
      console.error("[PublicProfile] Error loading tokens:", error);
    } finally {
      setIsLoadingTokens(false);
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8 pt-24">
        <Card className="max-w-2xl mx-auto p-8 text-center glass border-border">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Loading profile...</p>
        </Card>
      </div>
    );
  }

  const displayName = profile?.username || `${walletAddress?.slice(0, 12)}...${walletAddress?.slice(-8)}`;

  return (
    <div className="container mx-auto px-4 py-8 pt-24">
      <Card className="max-w-2xl mx-auto p-6 md:p-8 glass border-border">
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-center gap-4">
            <Avatar className="h-20 w-20 border-2 border-border">
              <AvatarImage src={profile?.avatar_url || undefined} />
              <AvatarFallback>
                <User className="h-10 w-10" />
              </AvatarFallback>
            </Avatar>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold neon-glow">
                {displayName}
              </h1>
              {profile?.username && (
                <p className="text-xs text-muted-foreground font-mono mt-1">
                  {walletAddress?.slice(0, 12)}...{walletAddress?.slice(-8)}
                </p>
              )}
            </div>
          </div>

          {isOwnProfile && (
            <Link to="/profile">
              <Button variant="outline" size="sm">
                Edit Profile
              </Button>
            </Link>
          )}
        </div>

        <div className="space-y-6">
          {/* Bio */}
          {profile?.bio ? (
            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-2">Bio</h3>
              <p className="text-foreground">{profile.bio}</p>
            </div>
          ) : (
            <p className="text-muted-foreground italic">No bio yet</p>
          )}

          {/* Wallet Address */}
          <div>
            <h3 className="text-sm font-medium text-muted-foreground mb-2">Wallet</h3>
            <div className="p-3 bg-muted rounded-md font-mono text-xs break-all flex items-center justify-between">
              <span>{walletAddress}</span>
              <a
                href={`https://explorer.keeta.com/account/${walletAddress}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline ml-2"
              >
                <ExternalLink className="h-4 w-4" />
              </a>
            </div>
          </div>

          {/* Member Since */}
          {profile?.created_at && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="h-4 w-4" />
              <span>Member since {new Date(profile.created_at).toLocaleDateString()}</span>
            </div>
          )}

          {/* IPFS Hash */}
          {profile?.ipfs_hash && (
            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-2">IPFS Profile</h3>
              <a
                href={`https://gateway.pinata.cloud/ipfs/${profile.ipfs_hash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-mono text-primary hover:underline break-all flex items-center gap-2"
              >
                <span>{profile.ipfs_hash.slice(0, 12)}...{profile.ipfs_hash.slice(-8)}</span>
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          )}

          {/* NFTs Section */}
          <div className="pt-6 border-t border-border">
            <h3 className="text-lg font-bold mb-4">NFTs ({tokens.filter(t => t.isNFT && t.metadata).length})</h3>
            {isLoadingTokens ? (
              <div className="text-center py-8">
                <Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" />
              </div>
            ) : tokens.filter(t => t.isNFT && t.metadata).length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>No NFTs yet</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {tokens.filter(t => t.isNFT && t.metadata).map((nft) => (
                  <NFTCard 
                    key={nft.address}
                    id={nft.address}
                    title={nft.metadata.name || nft.name}
                    creator={nft.metadata.version || "degen8bit v1.0"}
                    price={nft.balance}
                    image={ipfsToHttp(nft.metadata.image)}
                    likes={0}
                    comments={0}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Activity Section - Placeholder */}
          <div className="pt-6 border-t border-border">
            <h3 className="text-lg font-bold mb-4">Recent Activity</h3>
            <div className="text-center py-8 text-muted-foreground">
              <p>Activity feed coming soon</p>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
