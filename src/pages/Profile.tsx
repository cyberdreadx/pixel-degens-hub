import { useState, useEffect } from "react";
import { useWallet } from "@/contexts/WalletContext";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Loader2, User, Wallet } from "lucide-react";
import { toast } from "sonner";

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
  const { isConnected, publicKey } = useWallet();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  const [username, setUsername] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [bio, setBio] = useState("");
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);

  useEffect(() => {
    if (isConnected && publicKey) {
      loadProfile();
    } else {
      setIsLoading(false);
    }
  }, [isConnected, publicKey]);

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

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
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
      formData.append('file', file);
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
        throw new Error('Failed to upload avatar');
      }

      const { ipfsUrl } = await response.json();
      setAvatarUrl(ipfsUrl);
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
          {!isEditing && (
            <Button onClick={() => setIsEditing(true)} variant="outline">
              Edit Profile
            </Button>
          )}
        </div>

        <div className="space-y-6">
          {/* Avatar */}
          <div className="flex items-center gap-4">
            <Avatar className="h-20 w-20 border-2 border-border">
              <AvatarImage src={avatarUrl || undefined} />
              <AvatarFallback>
                <User className="h-10 w-10" />
              </AvatarFallback>
            </Avatar>
            {isEditing && (
              <div className="flex-1 space-y-2">
                <Label htmlFor="avatar_upload">Upload Avatar</Label>
                <Input
                  id="avatar_upload"
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarUpload}
                  disabled={isUploadingAvatar}
                  className="cursor-pointer"
                />
                {isUploadingAvatar && (
                  <p className="text-xs text-muted-foreground">
                    <Loader2 className="inline h-3 w-3 animate-spin mr-1" />
                    Uploading to IPFS...
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  Or paste URL:
                </p>
                <Input
                  id="avatar_url"
                  value={avatarUrl}
                  onChange={(e) => setAvatarUrl(e.target.value)}
                  placeholder="https://example.com/avatar.png"
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
        </div>
      </Card>
    </div>
  );
}
