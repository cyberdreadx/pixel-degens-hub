import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { useWallet } from "@/contexts/WalletContext";
import { toast } from "sonner";
import { Upload, Plus, X, Globe, Twitter, MessageCircle, Sparkles, Info, DollarSign, FileText, ImageIcon, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { calculateCollectionPricing, formatPricing, getAllPricingTiers, validateCollectionSize } from "@/utils/collectionPricing";

interface SocialLinks {
  website?: string;
  twitter?: string;
  discord?: string;
}

const CreateCollection = () => {
  const { isConnected, publicKey: address, network } = useWallet();
  const navigate = useNavigate();
  
  // Collection Details
  const [name, setName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [description, setDescription] = useState("");
  const [bannerUrl, setBannerUrl] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  
  // Creator Info
  const [royaltyPercentage, setRoyaltyPercentage] = useState("5");
  
  // Social Links
  const [socialLinks, setSocialLinks] = useState<SocialLinks>({});
  
  // Supply Info
  const [totalSupply, setTotalSupply] = useState("");
  
  // Mint Pricing
  const [mintPrice, setMintPrice] = useState("");
  const [maxPerWallet, setMaxPerWallet] = useState("10");
  const [mintEnabled, setMintEnabled] = useState(true);
  
  // Upload States
  const [isUploading, setIsUploading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [showPricingTiers, setShowPricingTiers] = useState(false);
  const [selectedBanner, setSelectedBanner] = useState<File | null>(null);
  const [selectedLogo, setSelectedLogo] = useState<File | null>(null);
  const [bannerPreview, setBannerPreview] = useState("");
  const [logoPreview, setLogoPreview] = useState("");
  
  // NFT Assets Upload (for lazy mint)
  const [nftMetadataFile, setNftMetadataFile] = useState<File | null>(null);
  const [nftZipFile, setNftZipFile] = useState<File | null>(null);
  const [nftCount, setNftCount] = useState(0);
  const [uploadProgress, setUploadProgress] = useState("");
  
  const bannerInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const nftMetadataInputRef = useRef<HTMLInputElement>(null);
  const nftZipInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (
    e: React.ChangeEvent<HTMLInputElement>, 
    type: 'banner' | 'logo'
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error("Please select an image file");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error("Image must be less than 10MB");
      return;
    }

    const preview = URL.createObjectURL(file);
    
    if (type === 'banner') {
      setSelectedBanner(file);
      setBannerPreview(preview);
    } else {
      setSelectedLogo(file);
      setLogoPreview(preview);
    }
  };

  const handleNftMetadataSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isJson = file.name.endsWith('.json');
    const isCsv = file.name.endsWith('.csv');

    if (!isJson && !isCsv) {
      toast.error("Please select a CSV or JSON file");
      return;
    }

    setNftMetadataFile(file);

    // Parse to count NFTs
    try {
      const text = await file.text();
      let count = 0;

      if (isCsv) {
        const lines = text.split('\n').filter(line => line.trim());
        count = Math.max(0, lines.length - 1); // Subtract header row
      } else {
        const json = JSON.parse(text);
        count = Array.isArray(json) ? json.length : 1;
      }

      setNftCount(count);
      setTotalSupply(count.toString());
      toast.success(`Loaded metadata for ${count} NFTs`);
    } catch (err) {
      toast.error("Failed to parse metadata file");
      setNftMetadataFile(null);
    }
  };

  const handleNftZipSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.zip')) {
      toast.error("Please select a ZIP file");
      return;
    }

    setNftZipFile(file);
    toast.success("ZIP file selected");
  };

  const uploadToIPFS = async (file: File): Promise<string> => {
    const formData = new FormData();
    formData.append('file', file);

    const { data, error } = await supabase.functions.invoke('fx-upload-ipfs', {
      body: formData,
    });

    if (error) throw error;
    return data.ipfsUrl;
  };

  const createCollection = async () => {
    if (!isConnected || !address) {
      toast.error("Please connect your wallet first");
      return;
    }

    if (!name || !symbol || !totalSupply) {
      toast.error("Name, symbol, and total supply are required");
      return;
    }

    const supplyInt = parseInt(totalSupply);
    const validation = validateCollectionSize(supplyInt);
    if (!validation.valid) {
      toast.error(validation.error);
      return;
    }

    setIsCreating(true);

    try {
      setIsUploading(true);
      
      // Upload banner and logo if selected
      let finalBannerUrl = bannerUrl;
      let finalLogoUrl = logoUrl;
      
      if (selectedBanner) {
        toast.info("Uploading banner to IPFS...");
        finalBannerUrl = await uploadToIPFS(selectedBanner);
      }
      
      if (selectedLogo) {
        toast.info("Uploading logo to IPFS...");
        finalLogoUrl = await uploadToIPFS(selectedLogo);
      }
      
      setIsUploading(false);

      // Generate unique collection ID
      const collectionId = `COL_${Date.now()}`;
      
      // Calculate pricing
      const pricing = calculateCollectionPricing(supplyInt);
      
      // Create collection metadata
      const collectionMetadata = {
        platform: "degenswap",
        version: "1.0",
        type: "collection",
        collection_id: collectionId,
        name,
        symbol: symbol.toUpperCase(),
        description,
        banner_image: finalBannerUrl,
        logo_image: finalLogoUrl,
        creator: address,
        royalty_percentage: parseFloat(royaltyPercentage) || 0,
        social_links: socialLinks,
        total_supply: supplyInt,
        minted_count: 0,
        network,
        created_at: new Date().toISOString(),
        // Public mint settings
        mint_price_kta: parseFloat(mintPrice) || 0,
        max_per_wallet: parseInt(maxPerWallet) || 10,
        mint_enabled: mintEnabled,
        pricing: {
          hosting_fee_kta: pricing.hostingFeeKTA,
          storage_size_mb: pricing.storageSizeMB,
          tier: pricing.tier.name,
        },
      };

      // Upload collection metadata to IPFS
      toast.info("Uploading collection metadata to IPFS...");
      setUploadProgress("Creating collection...");
      
      const { data, error } = await supabase.functions.invoke('fx-upload-collection', {
        body: { metadata: collectionMetadata },
      });

      if (error) throw error;

      // If NFT assets are provided, upload them to the pool
      if (nftMetadataFile && nftZipFile && mintEnabled) {
        setUploadProgress("Uploading NFT assets to IPFS...");
        toast.info("Uploading NFT images to IPFS... This may take a while.");

        const formData = new FormData();
        formData.append('collectionId', collectionId);
        formData.append('network', network);
        formData.append('metadata', nftMetadataFile);
        formData.append('metadataType', nftMetadataFile.name.endsWith('.csv') ? 'csv' : 'json');
        formData.append('zip', nftZipFile);

        // Use direct fetch for FormData
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const supabaseAnonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
        
        const uploadResponse = await fetch(`${supabaseUrl}/functions/v1/fx-upload-nft-pool`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${supabaseAnonKey}`,
          },
          body: formData,
        });

        if (!uploadResponse.ok) {
          const errorData = await uploadResponse.json();
          console.error("Pool upload error:", errorData);
          toast.error(`NFT upload failed: ${errorData.error || 'Unknown error'}`);
          // Still continue to collection page since collection was created
        } else {
          const uploadData = await uploadResponse.json();
          toast.success(`Uploaded ${uploadData.uploaded} NFTs to the mint pool!`);
        }
      }

      setUploadProgress("");
      toast.success("Collection created successfully!");
      
      // Navigate to collection page
      navigate(`/collection/${collectionId}`);
      
    } catch (error: any) {
      console.error("Error creating collection:", error);
      toast.error(`Failed to create collection: ${error.message}`);
    } finally {
      setIsCreating(false);
      setIsUploading(false);
      setUploadProgress("");
    }
  };

  return (
    <div className="relative min-h-screen pt-24 pb-16">
      <div className="container mx-auto px-4 max-w-3xl">
        <div className="mb-8 space-y-4">
          <h1 className="text-3xl md:text-5xl font-bold neon-glow">CREATE COLLECTION</h1>
          <div className="flex items-center gap-3">
            <p className="text-xs md:text-sm text-muted-foreground">
              CREATE A NEW NFT COLLECTION ON KEETA CHAIN
            </p>
            <div className="px-3 py-1 pixel-border bg-muted rounded text-xs font-bold">
              {network === "main" ? "MAINNET" : "TESTNET"}
            </div>
          </div>
        </div>

        <Card className="p-6 pixel-border-thick bg-card/80 backdrop-blur space-y-8">
          {/* Basic Info Section */}
          <div className="space-y-6">
            <h2 className="text-lg font-bold flex items-center gap-2">
              <Sparkles className="h-5 w-5" />
              COLLECTION DETAILS
            </h2>

            {/* Banner Image */}
            <div className="space-y-2">
              <Label className="text-xs font-bold">BANNER IMAGE</Label>
              <input
                ref={bannerInputRef}
                type="file"
                accept="image/*"
                onChange={(e) => handleFileSelect(e, 'banner')}
                className="hidden"
              />
              <div 
                onClick={() => bannerInputRef.current?.click()}
                className="relative w-full h-32 border-2 border-dashed border-muted-foreground/30 rounded-lg overflow-hidden cursor-pointer hover:border-primary transition-colors"
              >
                {(bannerPreview || bannerUrl) ? (
                  <img
                    src={bannerPreview || bannerUrl.replace("ipfs://", "https://ipfs.io/ipfs/")}
                    alt="Banner Preview"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="flex items-center justify-center h-full text-muted-foreground">
                    <Upload className="h-6 w-6 mr-2" />
                    <span className="text-xs">CLICK TO UPLOAD BANNER (1400x400 recommended)</span>
                  </div>
                )}
              </div>
            </div>

            {/* Logo Image */}
            <div className="space-y-2">
              <Label className="text-xs font-bold">LOGO IMAGE</Label>
              <input
                ref={logoInputRef}
                type="file"
                accept="image/*"
                onChange={(e) => handleFileSelect(e, 'logo')}
                className="hidden"
              />
              <div className="flex items-start gap-4">
                <div 
                  onClick={() => logoInputRef.current?.click()}
                  className="relative w-24 h-24 border-2 border-dashed border-muted-foreground/30 rounded-lg overflow-hidden cursor-pointer hover:border-primary transition-colors flex-shrink-0"
                >
                  {(logoPreview || logoUrl) ? (
                    <img
                      src={logoPreview || logoUrl.replace("ipfs://", "https://ipfs.io/ipfs/")}
                      alt="Logo Preview"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full text-muted-foreground">
                      <Upload className="h-4 w-4" />
                    </div>
                  )}
                </div>
                <p className="text-xs text-muted-foreground pt-2">
                  Square image recommended (400x400). This will be displayed as your collection's icon.
                </p>
              </div>
            </div>

            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="name" className="text-xs font-bold">COLLECTION NAME *</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Cyber Punks Genesis"
                className="pixel-border text-xs"
              />
            </div>

            {/* Symbol */}
            <div className="space-y-2">
              <Label htmlFor="symbol" className="text-xs font-bold">SYMBOL * (4 LETTERS MAX)</Label>
              <Input
                id="symbol"
                value={symbol}
                onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                placeholder="CPGS"
                maxLength={4}
                className="pixel-border text-xs"
              />
              <p className="text-xs text-muted-foreground">
                A short identifier for your collection (e.g., BAYC, MAYC)
              </p>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description" className="text-xs font-bold">DESCRIPTION</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="A limited edition collection of 10,000 unique digital collectibles..."
                className="pixel-border text-xs min-h-[100px]"
              />
            </div>
          </div>

          {/* Creator & Royalties Section */}
          <div className="space-y-6 border-t border-border pt-6">
            <h2 className="text-lg font-bold">CREATOR & ROYALTIES</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs font-bold">CREATOR WALLET</Label>
                <Input
                  value={address || "Connect wallet"}
                  disabled
                  className="pixel-border text-xs bg-muted"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="royalty" className="text-xs font-bold">ROYALTY PERCENTAGE</Label>
                <Input
                  id="royalty"
                  type="number"
                  min="0"
                  max="25"
                  step="0.1"
                  value={royaltyPercentage}
                  onChange={(e) => setRoyaltyPercentage(e.target.value)}
                  placeholder="5"
                  className="pixel-border text-xs"
                />
                <p className="text-xs text-muted-foreground">Max 25%</p>
              </div>
            </div>
          </div>

          {/* Social Links Section */}
          <div className="space-y-6 border-t border-border pt-6">
            <h2 className="text-lg font-bold">SOCIAL LINKS</h2>

            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Globe className="h-4 w-4 text-muted-foreground" />
                <Input
                  value={socialLinks.website || ""}
                  onChange={(e) => setSocialLinks({ ...socialLinks, website: e.target.value })}
                  placeholder="https://yourwebsite.com"
                  className="pixel-border text-xs"
                />
              </div>
              
              <div className="flex items-center gap-2">
                <Twitter className="h-4 w-4 text-muted-foreground" />
                <Input
                  value={socialLinks.twitter || ""}
                  onChange={(e) => setSocialLinks({ ...socialLinks, twitter: e.target.value })}
                  placeholder="https://twitter.com/yourcollection"
                  className="pixel-border text-xs"
                />
              </div>
              
              <div className="flex items-center gap-2">
                <MessageCircle className="h-4 w-4 text-muted-foreground" />
                <Input
                  value={socialLinks.discord || ""}
                  onChange={(e) => setSocialLinks({ ...socialLinks, discord: e.target.value })}
                  placeholder="https://discord.gg/yourcollection"
                  className="pixel-border text-xs"
                />
              </div>
            </div>
          </div>

          {/* Supply Section */}
          <div className="space-y-6 border-t border-border pt-6">
            <h2 className="text-lg font-bold">SUPPLY & MINT SETTINGS</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="supply" className="text-xs font-bold">TOTAL SUPPLY *</Label>
                <Input
                  id="supply"
                  type="number"
                  min="1"
                  max="10000"
                  value={totalSupply}
                  onChange={(e) => setTotalSupply(e.target.value)}
                  placeholder="100"
                  className="pixel-border text-xs"
                />
                <p className="text-xs text-muted-foreground">
                  Max 10,000 NFTs
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="mintPrice" className="text-xs font-bold">MINT PRICE (KTA)</Label>
                <Input
                  id="mintPrice"
                  type="number"
                  min="0"
                  step="0.01"
                  value={mintPrice}
                  onChange={(e) => setMintPrice(e.target.value)}
                  placeholder="0.5"
                  className="pixel-border text-xs"
                />
                <p className="text-xs text-muted-foreground">
                  Price per NFT for public mint
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="maxPerWallet" className="text-xs font-bold">MAX PER WALLET</Label>
                <Input
                  id="maxPerWallet"
                  type="number"
                  min="1"
                  max="100"
                  value={maxPerWallet}
                  onChange={(e) => setMaxPerWallet(e.target.value)}
                  placeholder="10"
                  className="pixel-border text-xs"
                />
                <p className="text-xs text-muted-foreground">
                  Limit per wallet address
                </p>
              </div>

              <div className="space-y-2 flex items-center gap-3 pt-6">
                <input
                  type="checkbox"
                  id="mintEnabled"
                  checked={mintEnabled}
                  onChange={(e) => setMintEnabled(e.target.checked)}
                  className="h-4 w-4"
                />
                <Label htmlFor="mintEnabled" className="text-xs font-bold cursor-pointer">
                  ENABLE PUBLIC MINTING
                </Label>
              </div>
            </div>

            {/* NFT Assets Upload Section - Only show if mint enabled */}
            {mintEnabled && (
              <div className="p-4 bg-accent/10 border border-accent/30 pixel-border space-y-4">
                <h3 className="text-sm font-bold flex items-center gap-2">
                  <ImageIcon className="h-4 w-4" />
                  NFT ASSETS (FOR PUBLIC MINT)
                </h3>
                <p className="text-xs text-muted-foreground">
                  Upload your NFT metadata and images. These will be available for public minting.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Metadata File */}
                  <div className="space-y-2">
                    <Label className="text-xs font-bold">METADATA FILE (CSV/JSON)</Label>
                    <input
                      ref={nftMetadataInputRef}
                      type="file"
                      accept=".csv,.json"
                      onChange={handleNftMetadataSelect}
                      className="hidden"
                    />
                    <div 
                      onClick={() => nftMetadataInputRef.current?.click()}
                      className="p-4 border-2 border-dashed border-muted-foreground/30 rounded-lg cursor-pointer hover:border-accent transition-colors text-center"
                    >
                      {nftMetadataFile ? (
                        <div className="space-y-1">
                          <FileText className="h-6 w-6 mx-auto text-accent" />
                          <p className="text-xs font-bold">{nftMetadataFile.name}</p>
                          <p className="text-xs text-muted-foreground">{nftCount} NFTs</p>
                        </div>
                      ) : (
                        <div className="space-y-1">
                          <FileText className="h-6 w-6 mx-auto text-muted-foreground" />
                          <p className="text-xs">Click to upload CSV or JSON</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* ZIP File */}
                  <div className="space-y-2">
                    <Label className="text-xs font-bold">IMAGES ZIP FILE</Label>
                    <input
                      ref={nftZipInputRef}
                      type="file"
                      accept=".zip"
                      onChange={handleNftZipSelect}
                      className="hidden"
                    />
                    <div 
                      onClick={() => nftZipInputRef.current?.click()}
                      className="p-4 border-2 border-dashed border-muted-foreground/30 rounded-lg cursor-pointer hover:border-accent transition-colors text-center"
                    >
                      {nftZipFile ? (
                        <div className="space-y-1">
                          <ImageIcon className="h-6 w-6 mx-auto text-accent" />
                          <p className="text-xs font-bold">{nftZipFile.name}</p>
                          <p className="text-xs text-muted-foreground">{(nftZipFile.size / 1024 / 1024).toFixed(1)} MB</p>
                        </div>
                      ) : (
                        <div className="space-y-1">
                          <ImageIcon className="h-6 w-6 mx-auto text-muted-foreground" />
                          <p className="text-xs">Click to upload ZIP</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <p className="text-[10px] text-muted-foreground">
                  💡 Metadata must have "name" and "image" columns. Image filenames must match files in ZIP.
                </p>
              </div>
            )}

            {/* Pricing Calculator */}
            {totalSupply && parseInt(totalSupply) > 0 && (
              <div className="p-4 bg-primary/10 border border-primary/30 pixel-border space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold flex items-center gap-2">
                    <DollarSign className="h-4 w-4" />
                    HOSTING FEE ESTIMATE
                  </h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs h-6"
                    onClick={() => setShowPricingTiers(!showPricingTiers)}
                  >
                    <Info className="h-3 w-3 mr-1" />
                    {showPricingTiers ? "HIDE" : "VIEW"} TIERS
                  </Button>
                </div>

                {(() => {
                  const pricing = calculateCollectionPricing(parseInt(totalSupply));
                  const validation = validateCollectionSize(parseInt(totalSupply));
                  
                  if (!validation.valid) {
                    return (
                      <p className="text-xs text-destructive">{validation.error}</p>
                    );
                  }

                  return (
                    <>
                      <div className="space-y-2 text-xs">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Tier:</span>
                          <span className="font-bold text-primary">{pricing.tier.name}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Items:</span>
                          <span className="font-bold">{pricing.totalItems.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Est. Storage:</span>
                          <span className="font-bold">{pricing.storageSizeMB.toFixed(2)} MB</span>
                        </div>
                        <div className="flex justify-between border-t border-border pt-2 mt-2">
                          <span className="font-bold">One-time Hosting Fee:</span>
                          <span className="font-bold text-primary">{formatPricing(pricing.hostingFeeKTA)}</span>
                        </div>
                        <div className="flex justify-between text-[10px] text-muted-foreground">
                          <span>+ Minting fees:</span>
                          <span>~{formatPricing(pricing.breakdown.transactionFees)}</span>
                        </div>
                      </div>
                      
                      <p className="text-[10px] text-muted-foreground leading-relaxed">
                        💡 This one-time fee covers permanent IPFS hosting for your collection's images and metadata. Minting fees are separate and paid per NFT during batch minting.
                      </p>
                    </>
                  );
                })()}
              </div>
            )}

            {/* Pricing Tiers Breakdown */}
            {showPricingTiers && (
              <div className="p-4 bg-muted/50 rounded space-y-3">
                <h4 className="text-xs font-bold">PRICING TIERS</h4>
                {getAllPricingTiers().map((tier, idx) => (
                  <div key={idx} className="text-xs p-2 bg-background rounded border border-border">
                    <div className="flex justify-between items-start mb-1">
                      <span className="font-bold">{tier.name}</span>
                      <span className="text-[10px] text-muted-foreground">{tier.pricePerItem} KTA/item</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground">{tier.description}</p>
                    <p className="text-[10px] text-primary mt-1">
                      Example: {tier.maxItems} items = {formatPricing(tier.examplePricing.hostingFeeKTA)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Create Button */}
          <Button
            onClick={createCollection}
            disabled={!isConnected || isCreating || isUploading || !name || !symbol || !totalSupply}
            className="w-full pixel-border-thick text-xs"
            size="lg"
          >
            {isCreating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {uploadProgress || "CREATING..."}
              </>
            ) : isUploading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                UPLOADING ASSETS...
              </>
            ) : isConnected ? (
              "CREATE COLLECTION"
            ) : (
              "CONNECT WALLET FIRST"
            )}
          </Button>

          {/* Info */}
          <div className="text-xs text-muted-foreground space-y-1 p-3 bg-muted/50 rounded">
            <p>• Collection metadata is stored on IPFS (fully decentralized)</p>
            <p>• Upload NFT assets to enable public minting (lazy mint)</p>
            <p>• Royalties apply to secondary sales on the marketplace</p>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default CreateCollection;
