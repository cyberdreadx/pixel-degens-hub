import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useWallet } from "@/contexts/WalletContext";
import { supabase } from "@/integrations/supabase/client";
import { ipfsToHttp } from "@/utils/nftUtils";
import { toast } from "sonner";
import { ArrowLeft, Save, Loader2, Image as ImageIcon } from "lucide-react";

interface CollectionData {
  id: string;
  name: string;
  symbol: string;
  description: string;
  banner_image: string | null;
  logo_image: string | null;
  creator_address: string;
  total_supply: number | null;
  minted_count: number;
  mint_enabled: boolean;
  mint_price_kta: number | null;
  mint_price_xrge: number | null;
  max_per_wallet: number | null;
  network: string;
}

const EditCollection = () => {
  const { collectionId } = useParams<{ collectionId: string }>();
  const navigate = useNavigate();
  const { publicKey: address, network } = useWallet();
  
  const [collection, setCollection] = useState<CollectionData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [mintEnabled, setMintEnabled] = useState(false);
  const [mintPriceKta, setMintPriceKta] = useState("");
  const [maxPerWallet, setMaxPerWallet] = useState("");
  const [totalSupply, setTotalSupply] = useState("");

  useEffect(() => {
    if (collectionId) {
      loadCollection();
    }
  }, [collectionId]);

  const loadCollection = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const { data, error } = await supabase
        .from('collections')
        .select('*')
        .eq('id', collectionId)
        .single();

      if (error) throw error;
      if (!data) {
        setError("Collection not found");
        return;
      }

      setCollection(data);
      
      // Populate form
      setName(data.name);
      setDescription(data.description || "");
      setMintEnabled(data.mint_enabled);
      setMintPriceKta(data.mint_price_kta?.toString() || "");
      setMaxPerWallet(data.max_per_wallet?.toString() || "");
      setTotalSupply(data.total_supply?.toString() || "");

    } catch (err: any) {
      console.error("Error loading collection:", err);
      setError(err.message || "Failed to load collection");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!collection) return;

    setIsSaving(true);
    try {
      const updates: Record<string, any> = {
        name,
        description,
        mint_enabled: mintEnabled,
        mint_price_kta: mintPriceKta ? parseFloat(mintPriceKta) : null,
        max_per_wallet: maxPerWallet ? parseInt(maxPerWallet) : null,
        total_supply: totalSupply ? parseInt(totalSupply) : null,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from('collections')
        .update(updates)
        .eq('id', collectionId);

      if (error) throw error;

      toast.success("Collection updated successfully!");
      navigate(`/collection/${collectionId}`);

    } catch (err: any) {
      console.error("Error updating collection:", err);
      toast.error(err.message || "Failed to update collection");
    } finally {
      setIsSaving(false);
    }
  };

  // Check if user is owner
  const isOwner = address?.toLowerCase() === collection?.creator_address?.toLowerCase();

  if (isLoading) {
    return (
      <div className="relative min-h-screen pt-24 pb-16">
        <div className="container mx-auto px-4 max-w-2xl">
          <Skeleton className="w-64 h-8 mb-8" />
          <Skeleton className="w-full h-96" />
        </div>
      </div>
    );
  }

  if (error || !collection) {
    return (
      <div className="relative min-h-screen pt-24 pb-16">
        <div className="container mx-auto px-4 text-center py-20">
          <div className="text-6xl mb-4">😕</div>
          <h2 className="text-2xl font-bold mb-2">Collection Not Found</h2>
          <p className="text-muted-foreground mb-4">{error}</p>
          <Link to="/collections">
            <Button className="pixel-border">BROWSE COLLECTIONS</Button>
          </Link>
        </div>
      </div>
    );
  }

  if (!isOwner) {
    return (
      <div className="relative min-h-screen pt-24 pb-16">
        <div className="container mx-auto px-4 text-center py-20">
          <div className="text-6xl mb-4">🔒</div>
          <h2 className="text-2xl font-bold mb-2">Access Denied</h2>
          <p className="text-muted-foreground mb-4">Only the collection owner can edit this collection.</p>
          <Link to={`/collection/${collectionId}`}>
            <Button className="pixel-border">BACK TO COLLECTION</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen pt-24 pb-16">
      <div className="container mx-auto px-4 max-w-2xl">
        {/* Header */}
        <div className="mb-8">
          <Link 
            to={`/collection/${collectionId}`}
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Collection
          </Link>
          <h1 className="text-3xl md:text-4xl font-bold neon-glow">EDIT COLLECTION</h1>
          <p className="text-muted-foreground text-sm mt-2">Update your collection settings</p>
        </div>

        {/* Preview */}
        <div className="flex items-center gap-4 mb-8 p-4 bg-card rounded-lg pixel-border">
          <div className="w-16 h-16 rounded-lg overflow-hidden bg-muted flex-shrink-0">
            {collection.logo_image ? (
              <img
                src={ipfsToHttp(collection.logo_image)}
                alt={collection.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <ImageIcon className="h-6 w-6 text-muted-foreground" />
              </div>
            )}
          </div>
          <div>
            <h2 className="font-bold">{collection.name}</h2>
            <p className="text-sm text-muted-foreground">{collection.symbol}</p>
          </div>
        </div>

        <Card className="p-6 pixel-border-thick bg-card/80 backdrop-blur space-y-6">
          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="name" className="text-xs font-bold">COLLECTION NAME</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Collection"
              className="pixel-border text-xs"
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description" className="text-xs font-bold">DESCRIPTION</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe your collection..."
              className="pixel-border text-xs min-h-[100px]"
            />
          </div>

          {/* Total Supply */}
          <div className="space-y-2">
            <Label htmlFor="totalSupply" className="text-xs font-bold">TOTAL SUPPLY</Label>
            <Input
              id="totalSupply"
              type="number"
              value={totalSupply}
              onChange={(e) => setTotalSupply(e.target.value)}
              placeholder="Leave empty for unlimited"
              className="pixel-border text-xs"
            />
            <p className="text-xs text-muted-foreground">
              Maximum number of NFTs in this collection. Currently minted: {collection.minted_count}
            </p>
          </div>

          {/* Mint Settings Section */}
          <div className="border-t pt-6 space-y-4">
            <h3 className="font-bold text-sm">PUBLIC MINT SETTINGS</h3>
            <p className="text-xs text-muted-foreground">
              Enable this if you want a public mint page where anyone can mint NFTs from a pre-uploaded pool.
              Disable if you're adding NFTs individually through the Mint page.
            </p>

            {/* Enable Mint */}
            <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
              <div>
                <Label htmlFor="mintEnabled" className="text-xs font-bold">ENABLE PUBLIC MINT</Label>
                <p className="text-xs text-muted-foreground mt-1">
                  Show "Mint" button on collection page
                </p>
              </div>
              <Switch
                id="mintEnabled"
                checked={mintEnabled}
                onCheckedChange={setMintEnabled}
              />
            </div>

            {mintEnabled && (
              <>
                {/* Mint Price */}
                <div className="space-y-2">
                  <Label htmlFor="mintPrice" className="text-xs font-bold">MINT PRICE (KTA)</Label>
                  <Input
                    id="mintPrice"
                    type="number"
                    step="0.01"
                    value={mintPriceKta}
                    onChange={(e) => setMintPriceKta(e.target.value)}
                    placeholder="0 for free mint"
                    className="pixel-border text-xs"
                  />
                </div>

                {/* Max Per Wallet */}
                <div className="space-y-2">
                  <Label htmlFor="maxPerWallet" className="text-xs font-bold">MAX PER WALLET</Label>
                  <Input
                    id="maxPerWallet"
                    type="number"
                    value={maxPerWallet}
                    onChange={(e) => setMaxPerWallet(e.target.value)}
                    placeholder="Leave empty for unlimited"
                    className="pixel-border text-xs"
                  />
                </div>
              </>
            )}
          </div>

          {/* Save Button */}
          <div className="flex gap-4 pt-4">
            <Button
              onClick={handleSave}
              disabled={isSaving || !name.trim()}
              className="pixel-border flex-1 gap-2"
            >
              {isSaving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              {isSaving ? "SAVING..." : "SAVE CHANGES"}
            </Button>
            <Link to={`/collection/${collectionId}`}>
              <Button variant="outline" className="pixel-border">
                CANCEL
              </Button>
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default EditCollection;