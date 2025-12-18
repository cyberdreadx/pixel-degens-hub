import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useWallet } from "@/contexts/WalletContext";
import { ipfsToHttp } from "@/utils/nftUtils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { 
  Sparkles, 
  Minus, 
  Plus, 
  Loader2,
  CheckCircle,
  AlertCircle,
  ArrowLeft
} from "lucide-react";
import * as KeetaNet from "@keetanetwork/keetanet-client";

const { Account } = KeetaNet.lib;
const { AccountKeyAlgorithm } = Account;

interface CollectionMetadata {
  collection_id: string;
  name: string;
  symbol: string;
  description: string;
  banner_image: string;
  logo_image: string;
  creator: string;
  total_supply: number | null;
  minted_count: number;
  mint_price_kta: number;
  max_per_wallet: number;
  mint_enabled: boolean;
  network: string;
}

const PublicMint = () => {
  const { collectionId } = useParams<{ collectionId: string }>();
  const { client, account, isConnected, publicKey: address, network, balance } = useWallet();
  
  const [collection, setCollection] = useState<CollectionMetadata | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [isMinting, setIsMinting] = useState(false);
  const [mintedTokens, setMintedTokens] = useState<string[]>([]);

  useEffect(() => {
    if (collectionId) {
      loadCollection();
    }
  }, [collectionId, network]);

  const loadCollection = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const { data, error } = await supabase.functions.invoke('fx-get-collection', {
        body: { collectionId, network },
      });

      if (error) throw error;
      
      if (!data?.collection) {
        setError("Collection not found");
        return;
      }

      setCollection(data.collection);
    } catch (err: any) {
      console.error("Error loading collection:", err);
      setError(err.message || "Failed to load collection");
    } finally {
      setIsLoading(false);
    }
  };

  const handleMint = async () => {
    if (!isConnected || !client || !account || !collection) {
      toast.error("Please connect your wallet first");
      return;
    }

    if (!collection.mint_enabled) {
      toast.error("Public minting is not enabled for this collection");
      return;
    }

    const totalCost = collection.mint_price_kta * quantity;
    if (parseFloat(balance || "0") < totalCost) {
      toast.error(`Insufficient balance. You need ${totalCost.toFixed(4)} KTA`);
      return;
    }

    setIsMinting(true);
    setMintedTokens([]);

    try {
      const minted: string[] = [];

      for (let i = 0; i < quantity; i++) {
        toast.info(`Minting ${i + 1} of ${quantity}...`);

        // Generate unique NFT ID
        const nftId = Date.now() + i;
        const identifier = `NFT_${collection.symbol}_${nftId}`;

        // Create metadata for this NFT
        const metadata = {
          platform: "degenswap",
          version: "1.0",
          identifier,
          nft_id: nftId,
          collection_id: collectionId,
          name: `${collection.name} #${collection.minted_count + i + 1}`,
          description: collection.description || '',
          image: collection.logo_image, // Use collection logo as placeholder
          symbol: collection.symbol,
        };

        const metadataBase64 = btoa(JSON.stringify(metadata));

        // Build minting transaction
        const builder = client.initBuilder();
        const pendingTokenAccount = builder.generateIdentifier(AccountKeyAlgorithm.TOKEN);
        await builder.computeBlocks();
        const tokenAccount = pendingTokenAccount.account;

        // Set token info
        builder.setInfo(
          {
            name: collection.symbol,
            description: `${collection.name} #${collection.minted_count + i + 1}`,
            metadata: metadataBase64,
            defaultPermission: new KeetaNet.lib.Permissions(['ACCESS'], []),
          },
          { account: tokenAccount }
        );

        // Mint supply of 1
        builder.modifyTokenSupply(1n, { account: tokenAccount });
        await builder.computeBlocks();

        // Keep the token in user's wallet
        builder.updateAccounts({
          account: tokenAccount,
          signer: account,
        });

        builder.send(account, 1n, tokenAccount);

        // If there's a mint price, send payment to creator
        if (collection.mint_price_kta > 0) {
          const creatorAccount = KeetaNet.lib.Account.fromPublicKeyString(collection.creator);
          const priceInUnits = BigInt(Math.floor(collection.mint_price_kta * 1e8));
          builder.send(creatorAccount, priceInUnits, account);
        }

        await builder.publish();

        const tokenAddress = tokenAccount.publicKeyString.toString();
        minted.push(tokenAddress);

        // Small delay between mints
        if (i < quantity - 1) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }

      setMintedTokens(minted);

      // Update collection minted count
      await supabase.functions.invoke('fx-update-collection', {
        body: { 
          collectionId, 
          updates: { 
            minted_count: (collection.minted_count || 0) + quantity 
          } 
        },
      });

      toast.success(`Successfully minted ${quantity} NFT(s)!`);
      
      // Refresh collection data
      loadCollection();

    } catch (err: any) {
      console.error("Mint error:", err);
      toast.error(`Minting failed: ${err.message}`);
    } finally {
      setIsMinting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="relative min-h-screen pt-24 pb-16">
        <div className="container mx-auto px-4 max-w-2xl">
          <Skeleton className="w-full h-48 mb-8 rounded-xl" />
          <Skeleton className="w-64 h-8 mb-4" />
          <Skeleton className="w-full h-32" />
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

  const remaining = collection.total_supply 
    ? collection.total_supply - (collection.minted_count || 0)
    : null;
  const isSoldOut = remaining !== null && remaining <= 0;
  const maxMintable = Math.min(
    collection.max_per_wallet || 10,
    remaining || 10
  );
  const totalCost = collection.mint_price_kta * quantity;

  return (
    <div className="relative min-h-screen pt-24 pb-16">
      <div className="container mx-auto px-4 max-w-2xl">
        {/* Back Link */}
        <Link 
          to={`/collection/${collectionId}`}
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary mb-6"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Collection
        </Link>

        {/* Collection Header */}
        <Card className="overflow-hidden pixel-border-thick mb-8">
          {/* Banner */}
          <div className="relative w-full h-32 overflow-hidden">
            {collection.banner_image ? (
              <img
                src={ipfsToHttp(collection.banner_image)}
                alt={`${collection.name} banner`}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-r from-primary/20 via-accent/20 to-primary/20" />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-card to-transparent" />
          </div>

          {/* Logo & Info */}
          <div className="p-6 -mt-12 relative">
            <div className="flex items-end gap-4 mb-4">
              <div className="w-20 h-20 rounded-xl overflow-hidden border-4 border-card shadow-xl flex-shrink-0">
                {collection.logo_image ? (
                  <img
                    src={ipfsToHttp(collection.logo_image)}
                    alt={`${collection.name} logo`}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-muted flex items-center justify-center">
                    <Sparkles className="h-6 w-6 text-muted-foreground" />
                  </div>
                )}
              </div>
              <div className="flex-1 pb-1">
                <h1 className="text-2xl font-bold neon-glow">{collection.name}</h1>
                <p className="text-xs text-muted-foreground">{collection.symbol}</p>
              </div>
            </div>

            {collection.description && (
              <p className="text-sm text-muted-foreground mb-4">{collection.description}</p>
            )}

            {/* Stats */}
            <div className="grid grid-cols-3 gap-4 text-center p-4 bg-muted/50 rounded-lg">
              <div>
                <p className="text-xs text-muted-foreground">PRICE</p>
                <p className="font-bold text-primary">
                  {collection.mint_price_kta > 0 ? `${collection.mint_price_kta} KTA` : 'FREE'}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">MINTED</p>
                <p className="font-bold">
                  {collection.minted_count || 0}
                  {collection.total_supply && ` / ${collection.total_supply}`}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">REMAINING</p>
                <p className="font-bold">
                  {remaining !== null ? remaining : '∞'}
                </p>
              </div>
            </div>
          </div>
        </Card>

        {/* Mint Section */}
        <Card className="p-6 pixel-border-thick space-y-6">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            MINT NFT
          </h2>

          {!collection.mint_enabled ? (
            <div className="p-4 bg-destructive/10 border border-destructive/30 rounded-lg flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-destructive" />
              <p className="text-sm">Public minting is not enabled for this collection.</p>
            </div>
          ) : isSoldOut ? (
            <div className="p-4 bg-muted rounded-lg text-center">
              <p className="text-lg font-bold mb-2">🎉 SOLD OUT!</p>
              <p className="text-sm text-muted-foreground">All NFTs in this collection have been minted.</p>
            </div>
          ) : mintedTokens.length > 0 ? (
            <div className="space-y-4">
              <div className="p-4 bg-primary/10 border border-primary/30 rounded-lg flex items-center gap-3">
                <CheckCircle className="h-5 w-5 text-primary" />
                <p className="text-sm">Successfully minted {mintedTokens.length} NFT(s)!</p>
              </div>
              <div className="space-y-2">
                {mintedTokens.map((tokenAddress, i) => (
                  <Link
                    key={tokenAddress}
                    to={`/nft/${tokenAddress}`}
                    className="block p-3 bg-muted rounded hover:bg-muted/80 transition-colors text-xs"
                  >
                    <span className="text-muted-foreground">NFT #{i + 1}:</span>{' '}
                    <span className="font-mono">{tokenAddress.slice(0, 16)}...{tokenAddress.slice(-8)}</span>
                  </Link>
                ))}
              </div>
              <Button 
                onClick={() => setMintedTokens([])} 
                variant="outline" 
                className="w-full"
              >
                MINT MORE
              </Button>
            </div>
          ) : (
            <>
              {/* Quantity Selector */}
              <div className="space-y-2">
                <label className="text-xs font-bold">QUANTITY</label>
                <div className="flex items-center gap-4">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    disabled={quantity <= 1}
                    className="h-10 w-10"
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                  <Input
                    type="number"
                    min={1}
                    max={maxMintable}
                    value={quantity}
                    onChange={(e) => setQuantity(Math.min(maxMintable, Math.max(1, parseInt(e.target.value) || 1)))}
                    className="w-20 text-center pixel-border"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setQuantity(Math.min(maxMintable, quantity + 1))}
                    disabled={quantity >= maxMintable}
                    className="h-10 w-10"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                  <span className="text-xs text-muted-foreground">
                    max {maxMintable} per wallet
                  </span>
                </div>
              </div>

              {/* Total Cost */}
              <div className="p-4 bg-muted rounded-lg space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Price per NFT:</span>
                  <span>{collection.mint_price_kta > 0 ? `${collection.mint_price_kta} KTA` : 'FREE'}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Quantity:</span>
                  <span>x{quantity}</span>
                </div>
                <div className="flex justify-between font-bold border-t border-border pt-2 mt-2">
                  <span>Total:</span>
                  <span className="text-primary">{totalCost > 0 ? `${totalCost.toFixed(4)} KTA` : 'FREE'}</span>
                </div>
              </div>

              {/* Balance Warning */}
              {isConnected && totalCost > 0 && parseFloat(balance || "0") < totalCost && (
                <div className="p-3 bg-destructive/10 border border-destructive/30 rounded-lg text-xs text-destructive">
                  Insufficient balance. You need {totalCost.toFixed(4)} KTA (current: {parseFloat(balance || "0").toFixed(4)} KTA)
                </div>
              )}

              {/* Mint Button */}
              <Button
                onClick={handleMint}
                disabled={!isConnected || isMinting || (totalCost > 0 && parseFloat(balance || "0") < totalCost)}
                className="w-full pixel-border-thick"
                size="lg"
              >
                {isMinting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    MINTING...
                  </>
                ) : !isConnected ? (
                  'CONNECT WALLET TO MINT'
                ) : (
                  `MINT ${quantity} NFT${quantity > 1 ? 'S' : ''} FOR ${totalCost > 0 ? `${totalCost.toFixed(4)} KTA` : 'FREE'}`
                )}
              </Button>
            </>
          )}
        </Card>
      </div>
    </div>
  );
};

export default PublicMint;
