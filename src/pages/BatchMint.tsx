import { useState, useRef, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { useWallet } from "@/contexts/WalletContext";
import { toast } from "sonner";
import { Upload, FileText, Image, AlertCircle, CheckCircle, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import * as KeetaNet from "@keetanetwork/keetanet-client";

const { Account } = KeetaNet.lib;
const { AccountKeyAlgorithm } = Account;

interface CSVRow {
  name: string;
  description: string;
  image_filename: string;
  attributes?: string; // JSON string of attributes
}

interface MintProgress {
  total: number;
  completed: number;
  current: string;
  status: 'idle' | 'uploading' | 'minting' | 'complete' | 'error';
  errors: string[];
}

const BatchMint = () => {
  const { collectionId } = useParams<{ collectionId: string }>();
  const navigate = useNavigate();
  const { client, account, isConnected, publicKey: address, network, balance } = useWallet();
  
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [zipFile, setZipFile] = useState<File | null>(null);
  const [csvData, setCsvData] = useState<CSVRow[]>([]);
  const [images, setImages] = useState<Map<string, File>>(new Map());
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

  const handleCSVSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.csv')) {
      toast.error("Please select a CSV file");
      return;
    }

    setCsvFile(file);

    // Parse CSV
    const text = await file.text();
    const lines = text.split('\n').filter(line => line.trim());
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    
    const requiredHeaders = ['name', 'description', 'image_filename'];
    const missingHeaders = requiredHeaders.filter(h => !headers.includes(h));
    
    if (missingHeaders.length > 0) {
      toast.error(`Missing CSV columns: ${missingHeaders.join(', ')}`);
      setCsvFile(null);
      return;
    }

    const rows: CSVRow[] = [];
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim());
      const row: any = {};
      headers.forEach((header, index) => {
        row[header] = values[index] || '';
      });
      
      if (row.name && row.image_filename) {
        rows.push(row as CSVRow);
      }
    }

    setCsvData(rows);
    toast.success(`Loaded ${rows.length} NFTs from CSV`);
  };

  const handleZIPSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.zip')) {
      toast.error("Please select a ZIP file");
      return;
    }

    setZipFile(file);
    
    // We'll extract in the edge function for now
    // For client-side extraction, we'd need JSZip library
    toast.success("ZIP file selected. Images will be extracted during minting.");
  };

  const calculateFee = () => {
    const nftCount = csvData.length;
    if (nftCount === 0) return { kta: 0, usd: 0 };
    
    // Base fee: 0.1 KTA per NFT for transaction + variable upload fee
    const ktaPerNFT = 0.1;
    const totalKTA = nftCount * ktaPerNFT;
    const estimatedUSD = totalKTA * 0.25; // Approximate KTA price
    
    return { kta: totalKTA, usd: estimatedUSD };
  };

  const startBatchMint = async () => {
    if (!isConnected || !client || !account) {
      toast.error("Please connect your wallet first");
      return;
    }

    if (!csvFile || csvData.length === 0) {
      toast.error("Please upload a valid CSV file");
      return;
    }

    if (!zipFile) {
      toast.error("Please upload a ZIP file with images");
      return;
    }

    const fee = calculateFee();
    if (parseFloat(balance || "0") < fee.kta) {
      toast.error(`Insufficient balance. You need at least ${fee.kta.toFixed(2)} KTA`);
      return;
    }

    setProgress({
      total: csvData.length,
      completed: 0,
      current: 'Uploading images to IPFS...',
      status: 'uploading',
      errors: [],
    });

    try {
      // Upload ZIP file and CSV to edge function for batch processing
      const formData = new FormData();
      formData.append('csv', csvFile);
      formData.append('zip', zipFile);
      formData.append('collectionId', collectionId || '');
      formData.append('network', network);

      toast.info("Uploading files to IPFS...");

      const { data: uploadData, error: uploadError } = await supabase.functions.invoke('fx-batch-upload', {
        body: formData,
      });

      if (uploadError) throw uploadError;

      const imageHashes: Map<string, string> = new Map(Object.entries(uploadData.images || {}));

      setProgress(prev => ({
        ...prev,
        current: 'Starting batch mint...',
        status: 'minting',
      }));

      // Mint each NFT
      const errors: string[] = [];
      
      for (let i = 0; i < csvData.length; i++) {
        const nft = csvData[i];
        const imageHash = imageHashes.get(nft.image_filename);
        
        setProgress(prev => ({
          ...prev,
          current: `Minting ${nft.name} (${i + 1}/${csvData.length})...`,
          completed: i,
        }));

        try {
          if (!imageHash) {
            throw new Error(`Image not found: ${nft.image_filename}`);
          }

          // Generate unique NFT identifier
          const nftId = Date.now() + i;
          const identifier = `NFT_KTA_ANCHOR_${nftId}`;

          // Parse attributes if provided
          let attributes: any[] = [];
          if (nft.attributes) {
            try {
              attributes = JSON.parse(nft.attributes);
            } catch {
              // Ignore parsing errors
            }
          }

          // Create metadata
          const metadata = {
            platform: "degenswap",
            version: "1.0",
            identifier,
            nft_id: nftId,
            collection_id: collectionId,
            name: nft.name,
            description: nft.description,
            image: `ipfs://${imageHash}`,
            attributes,
          };

          const metadataBase64 = btoa(JSON.stringify(metadata));

          // Create token using Keeta SDK
          const builder = client.initBuilder();
          const pendingTokenAccount = builder.generateIdentifier(AccountKeyAlgorithm.TOKEN);
          await builder.computeBlocks();
          const tokenAccount = pendingTokenAccount.account;

          // Set token info
          builder.setInfo(
            {
              name: nft.name.substring(0, 4).toUpperCase().replace(/[^A-Z]/g, '') || 'NFT',
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

          // Small delay between mints to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 500));
          
        } catch (err: any) {
          console.error(`Error minting ${nft.name}:`, err);
          errors.push(`${nft.name}: ${err.message}`);
        }
      }

      // Update collection minted count
      await supabase.functions.invoke('fx-update-collection', {
        body: { 
          collectionId, 
          updates: { 
            minted_count: csvData.length - errors.length 
          } 
        },
      });

      setProgress({
        total: csvData.length,
        completed: csvData.length,
        current: errors.length > 0 
          ? `Completed with ${errors.length} errors` 
          : 'All NFTs minted successfully!',
        status: errors.length > 0 ? 'error' : 'complete',
        errors,
      });

      if (errors.length === 0) {
        toast.success("Batch minting complete!");
      } else {
        toast.warning(`Minted ${csvData.length - errors.length} of ${csvData.length} NFTs`);
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
            UPLOAD CSV + ZIP TO MINT MULTIPLE NFTS AT ONCE
          </p>
        </div>

        <Card className="p-6 pixel-border-thick bg-card/80 backdrop-blur space-y-6">
          {/* CSV Upload */}
          <div className="space-y-4">
            <Label className="text-xs font-bold">1. UPLOAD CSV FILE</Label>
            <input
              ref={csvInputRef}
              type="file"
              accept=".csv"
              onChange={handleCSVSelect}
              className="hidden"
            />
            <Button
              onClick={() => csvInputRef.current?.click()}
              variant="outline"
              className="w-full pixel-border h-20 flex-col gap-2"
              disabled={progress.status !== 'idle'}
            >
              <FileText className="h-6 w-6" />
              {csvFile ? (
                <span className="text-xs">{csvFile.name} ({csvData.length} NFTs)</span>
              ) : (
                <span className="text-xs">SELECT CSV FILE</span>
              )}
            </Button>
            <div className="text-xs text-muted-foreground p-3 bg-muted/50 rounded">
              <p className="font-bold mb-1">Required CSV columns:</p>
              <p>• <code>name</code> - NFT name</p>
              <p>• <code>description</code> - NFT description</p>
              <p>• <code>image_filename</code> - Matching filename in ZIP</p>
              <p>• <code>attributes</code> (optional) - JSON array of traits</p>
            </div>
          </div>

          {/* ZIP Upload */}
          <div className="space-y-4">
            <Label className="text-xs font-bold">2. UPLOAD ZIP WITH IMAGES</Label>
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
            <p className="text-xs text-muted-foreground">
              ZIP should contain images with filenames matching <code>image_filename</code> column in CSV
            </p>
          </div>

          {/* Fee Estimate */}
          {csvData.length > 0 && (
            <div className="p-4 bg-muted/50 rounded space-y-2">
              <h3 className="text-xs font-bold">ESTIMATED FEE</h3>
              <div className="flex justify-between text-sm">
                <span>NFTs to mint:</span>
                <span className="font-bold">{csvData.length}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Estimated cost:</span>
                <span className="font-bold">{fee.kta.toFixed(2)} KTA (~${fee.usd.toFixed(2)})</span>
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
                <div className="p-3 bg-destructive/10 rounded text-xs">
                  <p className="font-bold mb-1">Errors:</p>
                  {progress.errors.map((err, i) => (
                    <p key={i} className="text-destructive">{err}</p>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Mint Button */}
          <Button
            onClick={startBatchMint}
            disabled={
              !isConnected || 
              !csvFile || 
              !zipFile || 
              csvData.length === 0 ||
              progress.status !== 'idle'
            }
            className="w-full pixel-border-thick text-xs"
            size="lg"
          >
            {progress.status !== 'idle' 
              ? "MINTING IN PROGRESS..."
              : isConnected 
                ? `MINT ${csvData.length} NFTS`
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
