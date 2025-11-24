import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { useWallet } from "@/contexts/WalletContext";
import { toast } from "sonner";
import { Upload, Plus, X } from "lucide-react";

interface NFTAttribute {
  trait_type: string;
  value: string;
}

const MintNFT = () => {
  const { client, account, isConnected } = useWallet();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [externalUrl, setExternalUrl] = useState("");
  const [attributes, setAttributes] = useState<NFTAttribute[]>([]);
  const [newTraitType, setNewTraitType] = useState("");
  const [newTraitValue, setNewTraitValue] = useState("");
  const [isMinting, setIsMinting] = useState(false);

  const addAttribute = () => {
    if (!newTraitType || !newTraitValue) {
      toast.error("Please fill in both trait type and value");
      return;
    }
    setAttributes([...attributes, { trait_type: newTraitType, value: newTraitValue }]);
    setNewTraitType("");
    setNewTraitValue("");
  };

  const removeAttribute = (index: number) => {
    setAttributes(attributes.filter((_, i) => i !== index));
  };

  const mintNFT = async () => {
    if (!isConnected || !client || !account) {
      toast.error("Please connect your wallet first");
      return;
    }

    if (!name || !imageUrl) {
      toast.error("Name and image URL are required");
      return;
    }

    setIsMinting(true);

    try {
      // Generate unique NFT identifier number
      const nftId = Date.now();
      const identifier = `NFT_KTA_ANCHOR_${nftId}`;
      
      // Create metadata in our standard format with identifier
      const metadata = {
        platform: "degen8bit",
        version: "1.0",
        identifier: identifier,
        nft_id: nftId,
        name,
        description,
        image: imageUrl,
        attributes,
        ...(externalUrl && { external_url: externalUrl }),
      };

      // Encode metadata as base64
      const metadataJson = JSON.stringify(metadata);
      const metadataBase64 = btoa(metadataJson);

      // Create token with supply=1, decimals=0 (NFT)
      const builder = client.createBuilder(account);
      
      // Use identifier as token address
      const tokenAddress = `keeta_${identifier.toLowerCase()}`;
      
      builder.createToken(
        tokenAddress,
        1, // supply = 1 (single NFT)
        0  // decimals = 0 (not divisible)
      );

      // Set token info with metadata
      builder.setInfo(tokenAddress, {
        name,
        description: description || `${name} - Degen 8bit NFT`,
        defaultPermission: "read",
        metadata: metadataBase64,
      });

      // Build and send transaction
      const transaction = await builder.build();
      const result = await builder.send(transaction);

      toast.success(`NFT minted successfully! Token: ${tokenAddress}`);
      
      // Reset form
      setName("");
      setDescription("");
      setImageUrl("");
      setExternalUrl("");
      setAttributes([]);
    } catch (error: any) {
      console.error("Error minting NFT:", error);
      toast.error(`Failed to mint NFT: ${error.message || "Unknown error"}`);
    } finally {
      setIsMinting(false);
    }
  };

  return (
    <div className="relative min-h-screen pt-24 pb-16">
      <div className="container mx-auto px-4 max-w-2xl">
        <div className="mb-8 space-y-4">
          <h1 className="text-3xl md:text-5xl font-bold neon-glow">MINT NFT</h1>
          <p className="text-xs md:text-sm text-muted-foreground">
            CREATE YOUR 8-BIT MASTERPIECE ON KEETA CHAIN
          </p>
        </div>

        <Card className="p-6 pixel-border-thick bg-card/80 backdrop-blur space-y-6">
          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="name" className="text-xs font-bold">NFT NAME *</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="CYBER ROBOT #001"
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
              placeholder="A rare 8-bit cyber robot from the metaverse..."
              className="pixel-border text-xs min-h-[100px]"
            />
          </div>

          {/* Image URL */}
          <div className="space-y-2">
            <Label htmlFor="image" className="text-xs font-bold">IMAGE URL (IPFS or HTTPS) *</Label>
            <Input
              id="image"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="ipfs://... or https://..."
              className="pixel-border text-xs"
            />
            {imageUrl && (
              <div className="mt-2 relative w-full h-48 border-2 border-primary rounded overflow-hidden">
                <img
                  src={imageUrl.replace("ipfs://", "https://ipfs.io/ipfs/")}
                  alt="NFT Preview"
                  className="w-full h-full object-contain bg-muted"
                  onError={(e) => {
                    e.currentTarget.src = "/placeholder.svg";
                  }}
                />
              </div>
            )}
          </div>

          {/* External URL */}
          <div className="space-y-2">
            <Label htmlFor="external" className="text-xs font-bold">EXTERNAL URL (OPTIONAL)</Label>
            <Input
              id="external"
              value={externalUrl}
              onChange={(e) => setExternalUrl(e.target.value)}
              placeholder="https://yoursite.com"
              className="pixel-border text-xs"
            />
          </div>

          {/* Attributes */}
          <div className="space-y-4">
            <Label className="text-xs font-bold">ATTRIBUTES / TRAITS</Label>
            
            {/* Existing Attributes */}
            {attributes.length > 0 && (
              <div className="space-y-2">
                {attributes.map((attr, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-2 p-2 bg-muted rounded pixel-border"
                  >
                    <div className="flex-1 text-xs">
                      <span className="font-bold">{attr.trait_type}:</span> {attr.value}
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => removeAttribute(index)}
                      className="h-6 w-6 p-0"
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {/* Add New Attribute */}
            <div className="flex gap-2">
              <Input
                value={newTraitType}
                onChange={(e) => setNewTraitType(e.target.value)}
                placeholder="Trait Type (e.g., Background)"
                className="pixel-border text-xs"
              />
              <Input
                value={newTraitValue}
                onChange={(e) => setNewTraitValue(e.target.value)}
                placeholder="Value (e.g., Blue)"
                className="pixel-border text-xs"
              />
              <Button
                onClick={addAttribute}
                size="sm"
                variant="outline"
                className="pixel-border"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Mint Button */}
          <Button
            onClick={mintNFT}
            disabled={!isConnected || isMinting || !name || !imageUrl}
            className="w-full pixel-border-thick text-xs"
            size="lg"
          >
            {isMinting ? "MINTING..." : isConnected ? "MINT NFT" : "CONNECT WALLET FIRST"}
          </Button>

          {/* Info */}
          <div className="text-xs text-muted-foreground space-y-1 p-3 bg-muted/50 rounded">
            <p>• NFTs are created as tokens with supply=1 and decimals=0</p>
            <p>• Metadata includes NFT_KTA_ANCHOR_[ID] identifier for auto-detection</p>
            <p>• Use IPFS for permanent image storage (recommended)</p>
            <p>• Token address: keeta_nft_kta_anchor_[timestamp]</p>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default MintNFT;
