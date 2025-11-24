import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Loader2, User, ExternalLink, Calendar } from "lucide-react";
import { toast } from "sonner";
import { useWallet } from "@/contexts/WalletContext";

interface Profile {
  id: string;
  wallet_address: string;
  username: string | null;
  avatar_url: string | null;
  bio: string | null;
  ipfs_hash: string | null;
  created_at: string;
}

export default function PublicProfile() {
  const { walletAddress } = useParams<{ walletAddress: string }>();
  const { publicKey } = useWallet();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const isOwnProfile = publicKey === walletAddress;

  useEffect(() => {
    if (walletAddress) {
      loadProfile();
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

          {/* NFTs Section - Placeholder */}
          <div className="pt-6 border-t border-border">
            <h3 className="text-lg font-bold mb-4">NFTs</h3>
            <div className="text-center py-8 text-muted-foreground">
              <p>NFT collection coming soon</p>
            </div>
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
