import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { useWallet } from "@/contexts/WalletContext";
import { toast } from "sonner";
import { Upload, Plus, X, ChevronDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import * as KeetaNet from "@keetanetwork/keetanet-client";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const { Account } = KeetaNet.lib;
const { AccountKeyAlgorithm } = Account;

interface NFTAttribute {
  trait_type: string;
  value: string;
}

interface Collection {
  id: string;
  name: string;
  symbol: string;
}

const MintNFT = () => {
  const { client, account, isConnected, network, balance, walletType, publicKey } = useWallet();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [ticker, setTicker] = useState("");
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [externalUrl, setExternalUrl] = useState("");
  const [attributes, setAttributes] = useState<NFTAttribute[]>([]);
  const [newTraitType, setNewTraitType] = useState("");
  const [newTraitValue, setNewTraitValue] = useState("");
  const [isMinting, setIsMinting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [selectedCollectionId, setSelectedCollectionId] = useState<string>("");
  const [loadingCollections, setLoadingCollections] = useState(false);

  // Load user's collections
  useEffect(() => {
    const loadCollections = async () => {
      if (!publicKey && !account) return;
      
      const walletAddress = publicKey || account?.publicKeyString?.get();
      if (!walletAddress) return;

      setLoadingCollections(true);
      try {
        const { data, error } = await supabase
          .from('collections')
          .select('id, name, symbol')
          .eq('creator_address', walletAddress)
          .eq('network', network);

        if (error) throw error;
        setCollections(data || []);
      } catch (error) {
        console.error('Error loading collections:', error);
      } finally {
        setLoadingCollections(false);
      }
    };

    loadCollections();
  }, [publicKey, account, network]);

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

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error("Please select an image file");
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Image must be less than 10MB");
      return;
    }

    setSelectedFile(file);
    const preview = URL.createObjectURL(file);
    setPreviewUrl(preview);
  };

  const uploadToIPFS = async () => {
    if (!selectedFile) {
      toast.error("Please select a file first");
      return;
    }

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);

      const { data, error } = await supabase.functions.invoke('fx-upload-ipfs', {
        body: formData,
      });

      if (error) throw error;

      setImageUrl(data.ipfsUrl);
      toast.success("Image uploaded to IPFS successfully!");
      return data.ipfsUrl;
    } catch (error: any) {
      console.error('Error uploading to IPFS:', error);
      toast.error(`Failed to upload: ${error.message}`);
      throw error;
    } finally {
      setIsUploading(false);
    }
  };

  const mintNFT = async () => {
    if (!isConnected) {
      toast.error("Please connect your wallet first");
      return;
    }

    if (!name || !ticker) {
      toast.error("Name and ticker are required");
      return;
    }

    // Check if wallet has sufficient KTA balance
    if (!balance || parseFloat(balance) < 0.1) {
      toast.error("Insufficient KTA balance. You need at least 0.1 KTA to mint an NFT (for transaction fees).");
      return;
    }

    let finalImageUrl = imageUrl;

    // If file selected but not uploaded, upload it first
    if (selectedFile && !finalImageUrl) {
      try {
        const uploadedUrl = await uploadToIPFS();
        finalImageUrl = uploadedUrl || imageUrl;
      } catch {
        return; // Upload failed, stop minting
      }
    }

    if (!finalImageUrl) {
      toast.error("Image is required");
      return;
    }

    setIsMinting(true);

    try {
      // For Yoda wallet, use backend minting
      if (walletType === 'yoda' && publicKey) {
        console.log('[MintNFT] Using backend minting for Yoda wallet');
        
        const { data, error } = await supabase.functions.invoke('fx-mint-nft', {
          body: {
            name,
            ticker,
            description,
            imageUrl: finalImageUrl,
            attributes,
            externalUrl,
            recipientAddress: publicKey,
            network,
            collectionId: selectedCollectionId || undefined
          }
        });

        if (error) throw error;
        if (!data.success) throw new Error(data.error || 'Minting failed');

        toast.success(`Token minted successfully!`);
        
        // Wait for blockchain to process
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Redirect to the newly minted NFT detail page
        navigate(`/nft/${data.tokenAddress}`, { state: { freshMint: true } });
        return;
      }

      // For seed phrase wallet, use direct SDK minting
      if (!client || !account) {
        toast.error("Wallet client not available");
        return;
      }

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
        image: finalImageUrl,
        attributes,
        ...(externalUrl && { external_url: externalUrl }),
        ...(selectedCollectionId && { collection_id: selectedCollectionId }),
      };

      // Encode metadata as base64
      const metadataJson = JSON.stringify(metadata);
      const metadataBase64 = btoa(metadataJson);

      // Create token using Keeta SDK
      const builder = client.initBuilder();
      
      // Generate a new token account identifier  
      const pendingTokenAccount = builder.generateIdentifier(AccountKeyAlgorithm.TOKEN);
      await builder.computeBlocks();
      const tokenAccount = pendingTokenAccount.account;

      // Format ticker for Keeta SDK (strict A-Z only, max 4 characters)
      const formattedSymbol = ticker.trim().toUpperCase().replace(/[^A-Z]/g, '').substring(0, 4);

      // Hardcoded supply of 1
      const supplyAmount = 1n;

      // Set token info first
      builder.setInfo(
        {
          name: formattedSymbol, // YODA (this is the symbol/ticker, requires strict format)
          description: name, // "Yoda #1" (this is the token name)
          metadata: metadataBase64, // Contains description and other metadata
          defaultPermission: new KeetaNet.lib.Permissions(['ACCESS'], []),
        },
        { account: tokenAccount }
      );

      // Increase total token supply
      builder.modifyTokenSupply(supplyAmount, { account: tokenAccount });
      
      // Compute blocks to finalize the supply modification before sending
      await builder.computeBlocks();
      
      // Update builder context to send from token account (signed by user as admin)
      builder.updateAccounts({ 
        account: tokenAccount,
        signer: account  // User signs on behalf of token account
      });
      
      // Distribute tokens from token account to user's wallet
      builder.send(account, supplyAmount, tokenAccount);

      // Publish the transaction
      await builder.publish();

      const tokenAddress = tokenAccount.publicKeyString.get();
      
      // If minting to a collection, update minted_count
      if (selectedCollectionId) {
        try {
          const { data: collection } = await supabase
            .from('collections')
            .select('minted_count')
            .eq('id', selectedCollectionId)
            .single();
          
          if (collection) {
            await supabase
              .from('collections')
              .update({ 
                minted_count: (collection.minted_count || 0) + 1,
                updated_at: new Date().toISOString()
              })
              .eq('id', selectedCollectionId);
          }
        } catch (dbError) {
          console.error('[MintNFT] Failed to update collection count:', dbError);
        }
      }

      toast.success(`Token minted successfully!`);
      
      // Wait a moment for blockchain to process
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Redirect to the newly minted NFT detail page
      navigate(`/nft/${tokenAddress}`, { state: { freshMint: true } });
    } catch (error: any) {
      console.error("Error minting token:", error);
      toast.error(`Failed to mint token: ${error.message || "Unknown error"}`);
    } finally {
      setIsMinting(false);
    }
  };

  return (
    <div className="relative min-h-screen pt-24 pb-16">
      <div className="container mx-auto px-4 max-w-2xl">
        <div className="mb-8 space-y-4">
          <h1 className="text-3xl md:text-5xl font-bold neon-glow">MINT TOKEN</h1>
          <div className="flex items-center gap-3">
            <p className="text-xs md:text-sm text-muted-foreground">
              CREATE YOUR TOKEN ON KEETA CHAIN
            </p>
            <div className="px-3 py-1 pixel-border bg-muted rounded text-xs font-bold">
              {network === "main" ? "MAINNET" : "TESTNET"}
            </div>
          </div>
        </div>

        <Card className="p-6 pixel-border-thick bg-card/80 backdrop-blur space-y-6">
          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="name" className="text-xs font-bold">TOKEN NAME *</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Awesome Token"
              className="pixel-border text-xs"
            />
            <p className="text-xs text-muted-foreground">
              Your token's display name (can include anything - letters, numbers, symbols, spaces)
            </p>
          </div>

          {/* Ticker */}
          <div className="space-y-2">
            <Label htmlFor="ticker" className="text-xs font-bold">TICKER / SYMBOL * (4 LETTERS MAX)</Label>
            <Input
              id="ticker"
              value={ticker}
              onChange={(e) => setTicker(e.target.value.toUpperCase())}
              placeholder="YODA"
              maxLength={4}
              className="pixel-border text-xs"
            />
            <p className="text-xs text-muted-foreground">
              Letters only, max 4 characters (special characters removed automatically)
            </p>
          </div>

          {/* Collection (Optional) */}
          <div className="space-y-2">
            <Label className="text-xs font-bold">COLLECTION (OPTIONAL)</Label>
            <Select
              value={selectedCollectionId || "none"}
              onValueChange={(val) => setSelectedCollectionId(val === "none" ? "" : val)}
              disabled={loadingCollections}
            >
              <SelectTrigger className="pixel-border text-xs">
                <SelectValue placeholder={loadingCollections ? "Loading collections..." : "No collection (standalone NFT)"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No collection (standalone NFT)</SelectItem>
                {collections.map((collection) => (
                  <SelectItem key={collection.id} value={collection.id}>
                    {collection.name} ({collection.symbol})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Associate this NFT with one of your collections, or create it as a standalone token
            </p>
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

          {/* Image Upload */}
          <div className="space-y-2">
            <Label className="text-xs font-bold">IMAGE *</Label>
            
            {/* File Upload Button */}
            <div className="flex gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                className="hidden"
              />
              <Button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                variant="outline"
                className="pixel-border text-xs flex-1"
                disabled={isUploading}
              >
                <Upload className="h-4 w-4 mr-2" />
                {selectedFile ? selectedFile.name : "SELECT IMAGE FROM DEVICE"}
              </Button>
              {selectedFile && !imageUrl && (
                <Button
                  type="button"
                  onClick={uploadToIPFS}
                  disabled={isUploading}
                  className="pixel-border text-xs"
                >
                  {isUploading ? "UPLOADING..." : "UPLOAD TO IPFS"}
                </Button>
              )}
            </div>

            {/* Or use URL */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">Or paste URL</span>
              </div>
            </div>

            <Input
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="ipfs://... or https://..."
              className="pixel-border text-xs"
              disabled={isUploading}
            />

            {/* Image Preview */}
            {(previewUrl || imageUrl) && (
              <div className="mt-2 relative w-full h-48 border-2 border-primary rounded overflow-hidden">
                <img
                  src={previewUrl || imageUrl.replace("ipfs://", "https://ipfs.io/ipfs/")}
                  alt="NFT Preview"
                  className="w-full h-full object-contain bg-muted"
                  onError={(e) => {
                    e.currentTarget.src = "/placeholder.svg";
                  }}
                />
                {imageUrl && (
                  <div className="absolute top-2 right-2 bg-green-500/90 text-white px-2 py-1 rounded text-xs font-bold">
                    ✓ UPLOADED
                  </div>
                )}
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
            disabled={!isConnected || isMinting || isUploading || !name || !ticker || (!imageUrl && !selectedFile)}
            className="w-full pixel-border-thick text-xs"
            size="lg"
          >
            {isMinting ? "MINTING..." : isUploading ? "UPLOADING IMAGE..." : !isConnected ? "CONNECT WALLET FIRST" : "MINT TOKEN"}
          </Button>

          {/* Info */}
          <div className="text-xs text-muted-foreground space-y-1 p-3 bg-muted/50 rounded">
            <p>• Tokens are created with supply of 1</p>
            <p>• Token will be distributed to your wallet</p>
            <p>• Use IPFS for permanent image storage (recommended)</p>
            <p>• <strong>Transaction fee:</strong> ~0.05-0.1 KTA</p>
            <p>• Your balance: <strong>{balance || "0.000"} KTA</strong></p>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default MintNFT;
