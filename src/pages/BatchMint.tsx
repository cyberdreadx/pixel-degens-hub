import { useState, useRef, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useWallet } from "@/contexts/WalletContext";
import { toast } from "sonner";
import { Upload, FileText, Image, AlertCircle, CheckCircle, Loader2, Link2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import * as KeetaNet from "@keetanetwork/keetanet-client";

const { Account } = KeetaNet.lib;
const { AccountKeyAlgorithm } = Account;

// Pricing constants
const FEE_PER_IMAGE_KTA = 0.001; // Per image upload fee
const MAX_COLLECTION_SIZE = 10000; // 10K max

interface NFTMetadata {
  name: string;
  description: string;
  image: string; // filename, path, or IPFS hash
  symbol?: string;
  seller_fee_basis_points?: number;
  attributes?: Array<{ trait_type: string; value: string }>;
  properties?: {
    files?: Array<{ type: string; uri: string }>;
    category?: string;
  };
}

interface MintProgress {
  total: number;
  completed: number;
  current: string;
  status: 'idle' | 'uploading' | 'minting' | 'complete' | 'error';
  errors: string[];
}

type ImageSourceType = 'upload' | 'ipfs';

const BatchMint = () => {
  const { collectionId } = useParams<{ collectionId: string }>();
  const navigate = useNavigate();
  const { client, account, isConnected, publicKey: address, network, balance } = useWallet();
  
  const [imageSource, setImageSource] = useState<ImageSourceType>('upload');
  const [metadataFile, setMetadataFile] = useState<File | null>(null);
  const [metadataType, setMetadataType] = useState<'csv' | 'json'>('csv');
  const [zipFile, setZipFile] = useState<File | null>(null);
  const [nftData, setNftData] = useState<NFTMetadata[]>([]);
  const [collectionName, setCollectionName] = useState<string>("");
  const [progress, setProgress] = useState<MintProgress>({
    total: 0,
    completed: 0,
    current: '',
    status: 'idle',
    errors: [],
  });
  
  const csvInputRef = useRef<HTMLInputElement>(null);
  const zipInputRef = useRef<HTMLInputElement>(null);

  // Load collection info
  useEffect(() => {
    if (collectionId) {
      loadCollection();
    }
  }, [collectionId]);

  const loadCollection = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('fx-get-collection', {
        body: { collectionId, network },
      });

      if (error) throw error;
      
      if (data?.collection) {
        setCollectionName(data.collection.name);
        
        // Check if user is the owner
        if (data.collection.creator.toLowerCase() !== address?.toLowerCase()) {
          toast.error("You don't have permission to mint for this collection");
          navigate(`/collection/${collectionId}`);
        }
      }
    } catch (err: any) {
      console.error("Error loading collection:", err);
      toast.error("Failed to load collection");
    }
  };

  // Check if image field looks like an IPFS hash/URL
  const isIpfsImage = (image: string): boolean => {
    return image.startsWith('ipfs://') || 
           image.startsWith('Qm') || 
           image.startsWith('bafy') ||
           image.includes('ipfs.io') ||
           image.includes('pinata.cloud');
  };

  const handleMetadataSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    const isJson = file.name.endsWith('.json');
    const isCsv = file.name.endsWith('.csv');
    const isMultipleJson = files.length > 1 && Array.from(files).every(f => f.name.endsWith('.json'));

    if (!isJson && !isCsv && !isMultipleJson) {
      toast.error("Please select CSV or JSON file(s)");
      return;
    }

    setMetadataFile(file);

    let parsedNfts: NFTMetadata[] = [];

    if (isCsv) {
      setMetadataType('csv');
      const text = await file.text();
      const lines = text.split('\n').filter(line => line.trim());
      const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
      
      const requiredHeaders = ['name', 'image'];
      const missingHeaders = requiredHeaders.filter(h => !headers.includes(h) && !headers.includes('image_filename'));
      
      if (missingHeaders.length > 0) {
        toast.error(`Missing CSV columns: ${missingHeaders.join(', ')}`);
        setMetadataFile(null);
        return;
      }

      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim());
        const row: any = {};
        headers.forEach((header, index) => {
          row[header] = values[index] || '';
        });
        
        if (row.name && (row.image || row.image_filename)) {
          parsedNfts.push({
            name: row.name,
            description: row.description || '',
            image: row.image || row.image_filename,
            symbol: row.symbol,
            seller_fee_basis_points: row.seller_fee_basis_points ? parseInt(row.seller_fee_basis_points) : undefined,
            attributes: row.attributes ? JSON.parse(row.attributes) : undefined,
          });
        }
      }
    } else {
      setMetadataType('json');
      const jsonFiles = isMultipleJson ? Array.from(files) : [file];

      for (const jsonFile of jsonFiles) {
        try {
          const text = await jsonFile.text();
          const json = JSON.parse(text);
          const items = Array.isArray(json) ? json : [json];
          
          for (const item of items) {
            if (item.name && item.image) {
              parsedNfts.push({
                name: item.name,
                description: item.description || '',
                image: item.image,
                symbol: item.symbol,
                seller_fee_basis_points: item.seller_fee_basis_points,
                attributes: item.attributes,
                properties: item.properties,
              });
            }
          }
        } catch (err) {
          console.error(`Error parsing ${jsonFile.name}:`, err);
        }
      }
    }

    // Validate collection size
    if (parsedNfts.length > MAX_COLLECTION_SIZE) {
      toast.error(`Maximum collection size is ${MAX_COLLECTION_SIZE.toLocaleString()} NFTs`);
      setMetadataFile(null);
      return;
    }

    // Auto-detect if metadata contains IPFS links
    const hasIpfsLinks = parsedNfts.some(nft => isIpfsImage(nft.image));
    if (hasIpfsLinks) {
      setImageSource('ipfs');
      toast.info("Detected IPFS links in metadata - no ZIP upload needed");
    }

    setNftData(parsedNfts);
    toast.success(`Loaded ${parsedNfts.length} NFTs from ${isCsv ? 'CSV' : 'JSON'}`);
  };

  const handleZIPSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.zip')) {
      toast.error("Please select a ZIP file");
      return;
    }

    setZipFile(file);
    toast.success("ZIP file selected. Images will be extracted during minting.");
  };

  const calculateFee = () => {
    const nftCount = nftData.length;
    if (nftCount === 0) return { kta: 0, usd: 0, breakdown: { upload: 0, tx: 0 } };
    
    // Transaction fee (always charged)
    const txFeePerNFT = 0.01;
    const totalTxFee = nftCount * txFeePerNFT;
    
    // Upload fee (only if uploading images)
    const uploadFee = imageSource === 'upload' ? nftCount * FEE_PER_IMAGE_KTA : 0;
    
    const totalKTA = totalTxFee + uploadFee;
    const estimatedUSD = totalKTA * 0.25;
    
    return { 
      kta: totalKTA, 
      usd: estimatedUSD,
      breakdown: { upload: uploadFee, tx: totalTxFee }
    };
  };

  const startBatchMint = async () => {
    if (!isConnected || !client || !account) {
      toast.error("Please connect your wallet first");
      return;
    }

    if (!metadataFile || nftData.length === 0) {
      toast.error("Please upload a valid metadata file (CSV or JSON)");
      return;
    }

    // Require ZIP only if uploading images
    if (imageSource === 'upload' && !zipFile) {
      toast.error("Please upload a ZIP file with images");
      return;
    }

    // Validate IPFS links if using pre-existing
    if (imageSource === 'ipfs') {
      const invalidLinks = nftData.filter(nft => !isIpfsImage(nft.image));
      if (invalidLinks.length > 0) {
        toast.error(`${invalidLinks.length} NFTs have invalid IPFS links`);
        return;
      }
    }

    const fee = calculateFee();
    if (parseFloat(balance || "0") < fee.kta) {
      toast.error(`Insufficient balance. You need at least ${fee.kta.toFixed(4)} KTA`);
      return;
    }

    setProgress({
      total: nftData.length,
      completed: 0,
      current: imageSource === 'upload' ? 'Uploading images to IPFS...' : 'Preparing metadata...',
      status: 'uploading',
      errors: [],
    });

    try {
      let imageHashes: Map<string, string> = new Map();

      // Only upload if using ZIP
      if (imageSource === 'upload' && zipFile) {
        const formData = new FormData();
        formData.append('metadata', metadataFile!);
        formData.append('metadataType', metadataType);
        formData.append('zip', zipFile);
        formData.append('collectionId', collectionId || '');
        formData.append('network', network);

        toast.info("Uploading files to IPFS...");

        // Use direct fetch for FormData - supabase.functions.invoke doesn't handle files properly
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const supabaseAnonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
        
        const uploadResponse = await fetch(`${supabaseUrl}/functions/v1/fx-batch-upload`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${supabaseAnonKey}`,
          },
          body: formData,
        });

        if (!uploadResponse.ok) {
          const errorData = await uploadResponse.json();
          throw new Error(errorData.error || 'Upload failed');
        }

        const uploadData = await uploadResponse.json();
        if (!uploadData.success) {
          throw new Error(uploadData.error || 'Upload failed');
        }
        
        imageHashes = new Map(Object.entries(uploadData.images || {}));
      } else {
        // Use existing IPFS links - normalize them
        for (const nft of nftData) {
          let hash = nft.image;
          if (hash.startsWith('ipfs://')) {
            hash = hash.replace('ipfs://', '');
          } else if (hash.includes('/ipfs/')) {
            hash = hash.split('/ipfs/')[1];
          }
          imageHashes.set(nft.image, hash);
        }
      }

      setProgress(prev => ({
        ...prev,
        current: 'Starting batch mint...',
        status: 'minting',
      }));

      const errors: string[] = [];
      
      for (let i = 0; i < nftData.length; i++) {
        const nft = nftData[i];
        const imageFilename = nft.image.replace(/^.*[\\/]/, '');
        const imageHash = imageHashes.get(imageFilename) || imageHashes.get(nft.image) || nft.image;
        
        setProgress(prev => ({
          ...prev,
          current: `Minting ${nft.name} (${i + 1}/${nftData.length})...`,
          completed: i,
        }));

        try {
          const nftId = Date.now() + i;
          const identifier = `NFT_KTA_ANCHOR_${nftId}`;

          // Normalize IPFS hash
          let finalImageHash = imageHash;
          if (finalImageHash.startsWith('ipfs://')) {
            finalImageHash = finalImageHash.replace('ipfs://', '');
          }

          const metadata = {
            platform: "degenswap",
            version: "1.0",
            identifier,
            nft_id: nftId,
            collection_id: collectionId,
            name: nft.name,
            description: nft.description || '',
            image: `ipfs://${finalImageHash}`,
            symbol: nft.symbol || 'NFT',
            seller_fee_basis_points: nft.seller_fee_basis_points || 0,
            attributes: nft.attributes || [],
            properties: nft.properties || {
              files: [{ type: 'image/png', uri: `ipfs://${finalImageHash}` }],
              category: 'image'
            },
          };

          const metadataBase64 = btoa(JSON.stringify(metadata));

          const builder = client.initBuilder();
          const pendingTokenAccount = builder.generateIdentifier(AccountKeyAlgorithm.TOKEN);
          await builder.computeBlocks();
          const tokenAccount = pendingTokenAccount.account;

          const tokenSymbol = (nft.symbol || nft.name.substring(0, 4))
            .toUpperCase()
            .replace(/[^A-Z0-9]/g, '')
            .substring(0, 4) || 'NFT';

          builder.setInfo(
            {
              name: tokenSymbol,
              description: nft.name,
              metadata: metadataBase64,
              defaultPermission: new KeetaNet.lib.Permissions(['ACCESS'], []),
            },
            { account: tokenAccount }
          );

          builder.modifyTokenSupply(1n, { account: tokenAccount });
          await builder.computeBlocks();

          builder.updateAccounts({
            account: tokenAccount,
            signer: account,
          });

          builder.send(account, 1n, tokenAccount);
          await builder.publish();

          await new Promise(resolve => setTimeout(resolve, 500));
          
        } catch (err: any) {
          console.error(`Error minting ${nft.name}:`, err);
          errors.push(`${nft.name}: ${err.message}`);
        }
      }

      await supabase.functions.invoke('fx-update-collection', {
        body: { 
          collectionId, 
          updates: { 
            minted_count: nftData.length - errors.length 
          } 
        },
      });

      setProgress({
        total: nftData.length,
        completed: nftData.length,
        current: errors.length > 0 
          ? `Completed with ${errors.length} errors` 
          : 'All NFTs minted successfully!',
        status: errors.length > 0 ? 'error' : 'complete',
        errors,
      });

      if (errors.length === 0) {
        toast.success("Batch minting complete!");
      } else {
        toast.warning(`Minted ${nftData.length - errors.length} of ${nftData.length} NFTs`);
      }

    } catch (err: any) {
      console.error("Batch mint error:", err);
      setProgress(prev => ({
        ...prev,
        status: 'error',
        current: `Error: ${err.message}`,
        errors: [...prev.errors, err.message],
      }));
      toast.error(`Batch mint failed: ${err.message}`);
    }
  };

  const fee = calculateFee();
  const needsZip = imageSource === 'upload';
  const canMint = isConnected && metadataFile && nftData.length > 0 && (!needsZip || zipFile) && progress.status === 'idle';

  return (
    <div className="relative min-h-screen pt-24 pb-16">
      <div className="container mx-auto px-4 max-w-3xl">
        <div className="mb-8 space-y-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Link to={`/collection/${collectionId}`} className="hover:text-primary">
              {collectionName || 'Collection'}
            </Link>
            <span>/</span>
            <span>Batch Mint</span>
          </div>
          <h1 className="text-3xl md:text-5xl font-bold neon-glow">BATCH MINT</h1>
          <p className="text-xs md:text-sm text-muted-foreground">
            MINT UP TO {MAX_COLLECTION_SIZE.toLocaleString()} NFTS AT ONCE
          </p>
        </div>

        <Card className="p-6 pixel-border-thick bg-card/80 backdrop-blur space-y-6">
          {/* Image Source Selection */}
          <div className="space-y-4">
            <Label className="text-xs font-bold">1. HOW ARE IMAGES PROVIDED?</Label>
            <Tabs value={imageSource} onValueChange={(v) => setImageSource(v as ImageSourceType)}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="upload" className="text-xs">
                  <Upload className="h-4 w-4 mr-2" />
                  UPLOAD ZIP
                </TabsTrigger>
                <TabsTrigger value="ipfs" className="text-xs">
                  <Link2 className="h-4 w-4 mr-2" />
                  EXISTING IPFS
                </TabsTrigger>
              </TabsList>
              <TabsContent value="upload" className="mt-4">
                <div className="p-3 bg-muted/50 rounded text-xs text-muted-foreground">
                  <p className="font-bold mb-1">Upload new images:</p>
                  <p>• We'll upload your images to IPFS via Pinata</p>
                  <p>• Fee: {FEE_PER_IMAGE_KTA} KTA per image</p>
                  <p>• ZIP should contain images matching metadata filenames</p>
                </div>
              </TabsContent>
              <TabsContent value="ipfs" className="mt-4">
                <div className="p-3 bg-muted/50 rounded text-xs text-muted-foreground">
                  <p className="font-bold mb-1">Use existing IPFS links:</p>
                  <p>• Your metadata must contain IPFS hashes/URLs</p>
                  <p>• Formats: <code>ipfs://Qm...</code>, <code>Qm...</code>, <code>bafy...</code></p>
                  <p>• No upload fee - only transaction costs</p>
                </div>
              </TabsContent>
            </Tabs>
          </div>

          {/* Metadata Upload */}
          <div className="space-y-4">
            <Label className="text-xs font-bold">2. UPLOAD METADATA (CSV OR JSON)</Label>
            <input
              ref={csvInputRef}
              type="file"
              accept=".csv,.json"
              multiple
              onChange={handleMetadataSelect}
              className="hidden"
            />
            <Button
              onClick={() => csvInputRef.current?.click()}
              variant="outline"
              className="w-full pixel-border h-20 flex-col gap-2"
              disabled={progress.status !== 'idle'}
            >
              <FileText className="h-6 w-6" />
              {metadataFile ? (
                <span className="text-xs">{metadataFile.name} ({nftData.length} NFTs)</span>
              ) : (
                <span className="text-xs">SELECT CSV OR JSON FILE(S)</span>
              )}
            </Button>
            <div className="text-xs text-muted-foreground p-3 bg-muted/50 rounded space-y-2">
              <div>
                <p className="font-bold mb-1">Required fields:</p>
                <p>• <code>name</code> - NFT name</p>
                <p>• <code>image</code> - filename (for ZIP) or IPFS hash (for existing)</p>
              </div>
              <div>
                <p className="font-bold mb-1">Optional fields:</p>
                <p>• <code>description</code>, <code>symbol</code>, <code>attributes</code>, <code>seller_fee_basis_points</code></p>
              </div>
            </div>
          </div>

          {/* ZIP Upload - Only show if uploading images */}
          {imageSource === 'upload' && (
            <div className="space-y-4">
              <Label className="text-xs font-bold">3. UPLOAD ZIP WITH IMAGES</Label>
              <input
                ref={zipInputRef}
                type="file"
                accept=".zip"
                onChange={handleZIPSelect}
                className="hidden"
              />
              <Button
                onClick={() => zipInputRef.current?.click()}
                variant="outline"
                className="w-full pixel-border h-20 flex-col gap-2"
                disabled={progress.status !== 'idle'}
              >
                <Image className="h-6 w-6" />
                {zipFile ? (
                  <span className="text-xs">{zipFile.name}</span>
                ) : (
                  <span className="text-xs">SELECT ZIP FILE</span>
                )}
              </Button>
            </div>
          )}

          {/* Fee Estimate */}
          {nftData.length > 0 && (
            <div className="p-4 bg-muted/50 rounded space-y-2">
              <h3 className="text-xs font-bold">FEE BREAKDOWN</h3>
              <div className="flex justify-between text-sm">
                <span>NFTs to mint:</span>
                <span className="font-bold">{nftData.length.toLocaleString()}</span>
              </div>
              {imageSource === 'upload' && (
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Upload fee ({FEE_PER_IMAGE_KTA} KTA × {nftData.length}):</span>
                  <span>{fee.breakdown.upload.toFixed(4)} KTA</span>
                </div>
              )}
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Transaction fees:</span>
                <span>{fee.breakdown.tx.toFixed(4)} KTA</span>
              </div>
              <div className="flex justify-between text-sm border-t border-border pt-2 mt-2">
                <span className="font-bold">Total:</span>
                <span className="font-bold">{fee.kta.toFixed(4)} KTA (~${fee.usd.toFixed(2)})</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Your balance:</span>
                <span className={`font-bold ${parseFloat(balance || "0") < fee.kta ? 'text-destructive' : 'text-green-500'}`}>
                  {balance || "0"} KTA
                </span>
              </div>
            </div>
          )}

          {/* Progress */}
          {progress.status !== 'idle' && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                {progress.status === 'complete' ? (
                  <CheckCircle className="h-5 w-5 text-green-500" />
                ) : progress.status === 'error' ? (
                  <AlertCircle className="h-5 w-5 text-destructive" />
                ) : (
                  <Loader2 className="h-5 w-5 animate-spin" />
                )}
                <span className="text-sm">{progress.current}</span>
              </div>
              <Progress value={(progress.completed / progress.total) * 100} />
              <p className="text-xs text-muted-foreground">
                {progress.completed} / {progress.total} completed
              </p>
              
              {progress.errors.length > 0 && (
                <div className="p-3 bg-destructive/10 rounded text-xs max-h-32 overflow-y-auto">
                  <p className="font-bold mb-1">Errors:</p>
                  {progress.errors.slice(0, 10).map((err, i) => (
                    <p key={i} className="text-destructive">{err}</p>
                  ))}
                  {progress.errors.length > 10 && (
                    <p className="text-destructive">...and {progress.errors.length - 10} more</p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Mint Button */}
          <Button
            onClick={startBatchMint}
            disabled={!canMint}
            className="w-full pixel-border-thick text-xs"
            size="lg"
          >
            {progress.status !== 'idle' 
              ? "MINTING IN PROGRESS..."
              : isConnected 
                ? `MINT ${nftData.length.toLocaleString()} NFTS`
                : "CONNECT WALLET FIRST"
            }
          </Button>

          {progress.status === 'complete' && (
            <Link to={`/collection/${collectionId}`}>
              <Button variant="outline" className="w-full pixel-border">
                VIEW COLLECTION
              </Button>
            </Link>
          )}
        </Card>
      </div>
    </div>
  );
};

export default BatchMint;
