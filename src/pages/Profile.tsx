import { useState, useEffect } from "react";
import { useWallet } from "@/contexts/WalletContext";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, User, Wallet, Upload, Eye } from "lucide-react";
import { toast } from "sonner";
import AvatarCropDialog from "@/components/AvatarCropDialog";
import { Link } from "react-router-dom";
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

export default function Profile() {
  const { isConnected, publicKey, tokens, network } = useWallet();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  const [username, setUsername] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [bio, setBio] = useState("");
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const [showCropDialog, setShowCropDialog] = useState(false);
  const [listedNFTs, setListedNFTs] = useState<Set<string>>(new Set());

  // Filter for NFTs (don't require metadata - some NFTs might not have it)
  const nfts = tokens.filter(token => token.isNFT);
  const unlistedNFTs = nfts.filter(nft => !listedNFTs.has(nft.address));
  
  console.log('[Profile] Total tokens:', tokens.length);
  console.log('[Profile] NFTs found:', nfts.length);
  console.log('[Profile] NFTs:', nfts.map(n => ({ name: n.name, hasMetadata: !!n.metadata })));
  
  const displayName = publicKey ? `${publicKey.slice(0, 12)}...${publicKey.slice(-8)}` : '';

  useEffect(() => {
    if (isConnected && publicKey) {
      loadProfile();
      loadListedNFTs();
    } else {
      setIsLoading(false);
    }
  }, [isConnected, publicKey, network]);

  const loadListedNFTs = async () => {
    try {
      const { data, error } = await supabase
        .from('nft_listings')
        .select('token_address')
        .eq('status', 'active')
        .eq('network', network);

      if (error) throw error;

      const listedAddresses = new Set(data?.map(listing => listing.token_address) || []);
      setListedNFTs(listedAddresses);
    } catch (error) {
      console.error('Error loading listed NFTs:', error);
    }
  };

  const loadProfile = async () => {
    if (!publicKey) return;
    
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("wallet_address", publicKey)
        .maybeSingle();

      if (error && error.code !== "PGRST116") {
        throw error;
      }

      if (data) {
        setProfile(data);
        setUsername(data.username || "");
        setAvatarUrl(data.avatar_url || "");
        setBio(data.bio || "");
      }
    } catch (error: any) {
      console.error("Error loading profile:", error);
      toast.error("Failed to load profile");
    } finally {
      setIsLoading(false);
    }
  };

  const handleAvatarSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be less than 5MB');
      return;
    }

    // Create preview URL and show crop dialog
    const reader = new FileReader();
    reader.onload = () => {
      setPreviewImageUrl(reader.result as string);
      setShowCropDialog(true);
    };
    reader.readAsDataURL(file);

    // Reset input so the same file can be selected again
    e.target.value = '';
  };

  const handleCropComplete = async (croppedImageBlob: Blob) => {
    setIsUploadingAvatar(true);
    try {
      // Extract old IPFS hash from current avatar URL if it exists
      let oldIpfsHash = null;
      if (avatarUrl && avatarUrl.includes('ipfs/')) {
        const match = avatarUrl.match(/ipfs\/([a-zA-Z0-9]+)/);
        if (match) {
          oldIpfsHash = match[1];
        }
      }

      const formData = new FormData();
      formData.append('file', croppedImageBlob, 'avatar.jpg');
      if (oldIpfsHash) {
        formData.append('oldIpfsHash', oldIpfsHash);
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/fx-upload-avatar`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: formData,
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to upload avatar');
      }

      const { ipfsUrl } = await response.json();
      setAvatarUrl(ipfsUrl);
      setShowCropDialog(false);
      setPreviewImageUrl(null);
      toast.success('Avatar uploaded to IPFS!');
    } catch (error: any) {
      console.error('Error uploading avatar:', error);
      toast.error(`Failed to upload avatar: ${error.message}`);
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const handleSave = async () => {
    if (!publicKey) return;

    setIsSaving(true);
    try {
      const profileData = {
        wallet_address: publicKey,
        username: username || null,
        avatar_url: avatarUrl || null,
        bio: bio || null,
      };

      // Upload to IPFS via Pinata
      console.log('Uploading profile to IPFS...');
      const ipfsResponse = await supabase.functions.invoke('fx-profile-ipfs', {
        body: {
          profileData,
          oldIpfsHash: profile?.ipfs_hash || null,
        }
      });

      if (ipfsResponse.error) {
        throw new Error(ipfsResponse.error.message || 'Failed to upload to IPFS');
      }

      const { ipfsHash } = ipfsResponse.data;
      console.log('Profile uploaded to IPFS:', ipfsHash);

      // Save to database with IPFS hash (cache layer)
      const dbData = {
        ...profileData,
        ipfs_hash: ipfsHash,
      };

      if (profile) {
        // Update existing profile
        const { error } = await supabase
          .from("profiles")
          .update(dbData)
          .eq("wallet_address", publicKey);

        if (error) throw error;
      } else {
        // Create new profile
        const { data, error } = await supabase
          .from("profiles")
          .insert([dbData])
          .select()
          .single();

        if (error) throw error;
        setProfile(data);
      }

      toast.success("Profile saved to IPFS!");
      setIsEditing(false);
      loadProfile();
    } catch (error: any) {
      console.error("Error saving profile:", error);
      toast.error(`Failed to save profile: ${error.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  if (!isConnected) {
    return (
      <div className="container mx-auto px-4 py-8 pt-24">
        <Card className="max-w-2xl mx-auto p-8 text-center glass border-border">
          <Wallet className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
          <h2 className="text-2xl font-bold mb-2">Connect Your Wallet</h2>
          <p className="text-muted-foreground">
            Please connect your Keeta wallet to view and edit your profile
          </p>
        </Card>
      </div>
    );
  }

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

  return (
    <div className="container mx-auto px-4 py-8 pt-24">
      <Card className="max-w-2xl mx-auto p-6 md:p-8 glass border-border">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl md:text-3xl font-bold neon-glow">Your Profile</h1>
          <div className="flex gap-2">
            {publicKey && (
              <Link to={`/profile/${publicKey}`}>
                <Button variant="outline" size="sm">
                  <Eye className="h-4 w-4 mr-2" />
                  View Public
                </Button>
              </Link>
            )}
            {!isEditing && (
              <Button onClick={() => setIsEditing(true)} variant="outline">
                Edit Profile
              </Button>
            )}
          </div>
        </div>

        <div className="space-y-6">
          {/* Avatar */}
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <Avatar className="h-20 w-20 border-2 border-border">
                <AvatarImage src={avatarUrl || undefined} />
                <AvatarFallback>
                  <User className="h-10 w-10" />
                </AvatarFallback>
              </Avatar>
              {isEditing && (
                <div className="flex-1">
                  <Label htmlFor="avatar_upload" className="cursor-pointer">
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full"
                      disabled={isUploadingAvatar}
                      onClick={() => document.getElementById('avatar_upload')?.click()}
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      {avatarUrl ? 'Change Avatar' : 'Upload Avatar'}
                    </Button>
                  </Label>
                  <Input
                    id="avatar_upload"
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarSelect}
                    disabled={isUploadingAvatar}
                    className="hidden"
                  />
                  <p className="text-xs text-muted-foreground mt-2">
                    Image will be cropped to a circle and uploaded to IPFS
                  </p>
                </div>
              )}
            </div>
            
            {isEditing && (
              <div>
                <Label htmlFor="avatar_url">Or paste image URL:</Label>
                <Input
                  id="avatar_url"
                  value={avatarUrl}
                  onChange={(e) => setAvatarUrl(e.target.value)}
                  placeholder="https://example.com/avatar.png"
                  className="mt-1"
                />
              </div>
            )}
          </div>

          {/* Wallet Address */}
          <div>
            <Label>Wallet Address</Label>
            <div className="mt-1 p-3 bg-muted rounded-md font-mono text-xs break-all">
              {publicKey}
            </div>
          </div>

          {/* Username */}
          <div>
            <Label htmlFor="username">Username</Label>
            {isEditing ? (
              <Input
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter username"
                className="mt-1"
              />
            ) : (
              <div className="mt-1 p-3 bg-muted rounded-md">
                {username || <span className="text-muted-foreground">Not set</span>}
              </div>
            )}
          </div>

          {/* Bio */}
          <div>
            <Label htmlFor="bio">Bio</Label>
            {isEditing ? (
              <Textarea
                id="bio"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Tell us about yourself..."
                rows={4}
                className="mt-1"
              />
            ) : (
              <div className="mt-1 p-3 bg-muted rounded-md min-h-[100px]">
                {bio || <span className="text-muted-foreground">No bio yet</span>}
              </div>
            )}
          </div>

          {/* Action Buttons */}
          {isEditing && (
            <div className="flex gap-2">
              <Button
                onClick={handleSave}
                disabled={isSaving}
                className="flex-1"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save Changes"
                )}
              </Button>
              <Button
                onClick={() => {
                  setIsEditing(false);
                  setUsername(profile?.username || "");
                  setAvatarUrl(profile?.avatar_url || "");
                  setBio(profile?.bio || "");
                }}
                variant="outline"
                disabled={isSaving}
              >
                Cancel
              </Button>
            </div>
          )}

          {/* Profile Stats */}
          {profile && (
            <div className="pt-4 border-t border-border space-y-2">
              <p className="text-xs text-muted-foreground">
                Member since {new Date(profile.created_at).toLocaleDateString()}
              </p>
              {profile.ipfs_hash && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">IPFS:</span>
                  <a
                    href={`https://gateway.pinata.cloud/ipfs/${profile.ipfs_hash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-mono text-primary hover:underline break-all"
                  >
                    {profile.ipfs_hash.slice(0, 12)}...{profile.ipfs_hash.slice(-8)}
                  </a>
                </div>
              )}
            </div>
          )}

          {/* NFTs Section */}
          <div className="pt-6 border-t border-border">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold">Your NFTs</h3>
              <Link to="/collection">
                <Button variant="outline" size="sm">Marketplace</Button>
              </Link>
            </div>
            
            {nfts.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p className="text-sm">No NFTs yet</p>
                <Link to="/mint">
                  <Button className="mt-4" size="sm">Mint Your First NFT</Button>
                </Link>
              </div>
            ) : (
              <Tabs defaultValue="all" className="w-full">
                <TabsList className="grid w-full grid-cols-2 mb-4">
                  <TabsTrigger value="all">All NFTs ({nfts.length})</TabsTrigger>
                  <TabsTrigger value="unlisted">Unlisted ({unlistedNFTs.length})</TabsTrigger>
                </TabsList>
                
                <TabsContent value="all" className="space-y-4">
                  {/* Helpful notice */}
                  <div className="p-3 bg-primary/10 border border-primary/30 pixel-border">
                    <p className="text-xs text-muted-foreground">
                      💡 <strong>Want to see your NFTs on the Feed?</strong> Click an NFT below to view it, then list it for sale!
                    </p>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {nfts.map((nft) => (
                      <NFTCard 
                        key={nft.address}
                        id={nft.address}
                        title={nft.metadata?.name || nft.name}
                        creator={username || profile?.username || displayName}
                        price={nft.balance}
                        image={nft.metadata?.image ? ipfsToHttp(nft.metadata.image) : ''}
                        likes={0}
                        comments={0}
                      />
                    ))}
                  </div>
                </TabsContent>
                
                <TabsContent value="unlisted" className="space-y-4">
                  {unlistedNFTs.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <p className="text-sm">All your NFTs are currently listed for sale</p>
                    </div>
                  ) : (
                    <>
                      <div className="p-3 bg-accent/10 border border-accent/30 pixel-border">
                        <p className="text-xs text-muted-foreground">
                          💎 These NFTs are in your wallet and not listed for sale
                        </p>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {unlistedNFTs.map((nft) => (
                          <NFTCard 
                            key={nft.address}
                            id={nft.address}
                            title={nft.metadata?.name || nft.name}
                            creator={username || profile?.username || displayName}
                            price={nft.balance}
                            image={nft.metadata?.image ? ipfsToHttp(nft.metadata.image) : ''}
                            likes={0}
                            comments={0}
                          />
                        ))}
                      </div>
                    </>
                  )}
                </TabsContent>
              </Tabs>
            )}
          </div>
        </div>
      </Card>

      {/* Avatar Crop Dialog */}
      {previewImageUrl && (
        <AvatarCropDialog
          open={showCropDialog}
          imageUrl={previewImageUrl}
          onClose={() => {
            setShowCropDialog(false);
            setPreviewImageUrl(null);
          }}
          onCropComplete={handleCropComplete}
          isUploading={isUploadingAvatar}
        />
      )}
    </div>
  );
}
