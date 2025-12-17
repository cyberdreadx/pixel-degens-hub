import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useWallet } from "@/contexts/WalletContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useState, useEffect } from "react";
import { Loader2, Package, AlertCircle, CheckCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

const RecoverNFT = () => {
  const { network, publicKey, isConnected } = useWallet();
  const [tokenAddress, setTokenAddress] = useState("");
  const [isRecovering, setIsRecovering] = useState(false);
  const [isScanningEscrow, setIsScanningEscrow] = useState(false);
  const [orphanedNFTs, setOrphanedNFTs] = useState<any[]>([]);
  const [cancelledListings, setCancelledListings] = useState<any[]>([]);
  const [isLoadingListings, setIsLoadingListings] = useState(false);

  // Load user's cancelled listings on mount
  useEffect(() => {
    if (publicKey && isConnected) {
      loadCancelledListings();
    }
  }, [publicKey, isConnected, network]);

  const loadCancelledListings = async () => {
    if (!publicKey) return;

    setIsLoadingListings(true);
    try {
      const { data, error } = await supabase
        .from('nft_listings')
        .select('*')
        .eq('seller_address', publicKey)
        .eq('status', 'cancelled')
        .eq('network', network)
        .order('created_at', { ascending: false });

      if (error) throw error;

      console.log('[RecoverNFT] Found cancelled listings:', data?.length || 0);
      setCancelledListings(data || []);
    } catch (error: any) {
      console.error('[RecoverNFT] Error loading listings:', error);
    } finally {
      setIsLoadingListings(false);
    }
  };

  const scanEscrowWallet = async () => {
    setIsScanningEscrow(true);
    try {
      toast.info("Scanning escrow wallet for stuck NFTs...");

      const { data, error } = await supabase.functions.invoke('fx-recover-listings', {
        body: { network }
      });

      if (error) throw error;

      console.log('[RecoverNFT] Scan results:', data);

      if (data.orphanedNFTs && data.orphanedNFTs.length > 0) {
        setOrphanedNFTs(data.orphanedNFTs);
        toast.success(`Found ${data.orphanedNFTs.length} stuck NFT(s) in escrow!`);
      } else {
        toast.info("No orphaned NFTs found in escrow");
        setOrphanedNFTs([]);
      }
    } catch (error: any) {
      console.error('[RecoverNFT] Scan error:', error);
      toast.error(`Failed to scan: ${error.message}`);
    } finally {
      setIsScanningEscrow(false);
    }
  };

  const recoverNFT = async (nftTokenAddress?: string, recipientAddr?: string) => {
    if (!isConnected || !publicKey) {
      toast.error("Please connect your wallet");
      return;
    }

    const targetToken = nftTokenAddress || tokenAddress;
    const targetRecipient = recipientAddr || publicKey;

    if (!targetToken) {
      toast.error("Please enter the NFT token address");
      return;
    }

    setIsRecovering(true);

    try {
      toast.info("Recovering NFT from escrow...");

      const { data, error } = await supabase.functions.invoke('fx-recover-nft', {
        body: { 
          tokenAddress: targetToken,
          recipientAddress: targetRecipient,
          network 
        }
      });

      if (error) {
        throw new Error(error.message || 'Failed to recover NFT');
      }

      if (!data.success) {
        throw new Error(data.error || 'Failed to recover NFT');
      }

      console.log('[RecoverNFT] Recovery response:', data);

      const txMessage = data.transactionHash && data.transactionHash !== 'unknown'
        ? `NFT recovered! Tx: ${data.transactionHash.substring(0, 12)}...`
        : `NFT recovered! ${data.message || 'Check your wallet.'}`;
      
      toast.success(txMessage);
      
      // Reload cancelled listings
      await loadCancelledListings();
      
      // Clear the input
      setTokenAddress("");

      // Optionally scan again to update orphaned list
      setTimeout(() => scanEscrowWallet(), 2000);

    } catch (error: any) {
      console.error('[RecoverNFT] Recovery error:', error);
      toast.error(`Failed to recover: ${error.message}`);
    } finally {
      setIsRecovering(false);
    }
  };

  if (!isConnected) {
    return (
      <div className="min-h-screen pt-24 pb-16 px-4">
        <div className="container max-w-4xl mx-auto">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Please connect your wallet to recover stuck NFTs.
            </AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-24 pb-16 px-4">
      <div className="container max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold pixel-text">🔧 NFT RECOVERY</h1>
          <p className="text-muted-foreground">
            Recover NFTs stuck in escrow from cancelled listings
          </p>
          <p className="text-xs text-muted-foreground">
            Network: <span className="font-mono font-bold">{network === 'test' ? 'TESTNET' : 'MAINNET'}</span>
          </p>
        </div>

        {/* Scan Escrow Button */}
        <Card className="pixel-border-thick">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="w-5 h-5" />
              Scan Escrow Wallet
            </CardTitle>
            <CardDescription>
              Check for any NFTs stuck in the escrow wallet without active listings
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              onClick={scanEscrowWallet} 
              disabled={isScanningEscrow}
              className="w-full pixel-border-thick"
            >
              {isScanningEscrow && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {isScanningEscrow ? "SCANNING..." : "SCAN ESCROW WALLET"}
            </Button>

            {/* Orphaned NFTs List */}
            {orphanedNFTs.length > 0 && (
              <div className="mt-4 space-y-2">
                <h3 className="font-semibold text-sm">Stuck NFTs Found:</h3>
                {orphanedNFTs.map((nft, idx) => (
                  <div key={idx} className="p-3 border rounded-lg space-y-2">
                    <div>
                      <div className="text-xs text-muted-foreground">Token Address:</div>
                      <div className="font-mono text-xs break-all">{nft.tokenAddress}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Name:</div>
                      <div className="text-sm font-semibold">{nft.name}</div>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      This NFT is in escrow but has no active listing
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Your Cancelled Listings */}
        <Card className="pixel-border-thick">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5" />
              Your Cancelled Listings
            </CardTitle>
            <CardDescription>
              These are your cancelled listings. If the NFT is still in escrow, you can recover it.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingListings ? (
              <div className="text-center py-8 text-muted-foreground">
                <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                Loading your listings...
              </div>
            ) : cancelledListings.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No cancelled listings found for your wallet
              </div>
            ) : (
              <div className="space-y-3">
                {cancelledListings.map((listing) => (
                  <div key={listing.id} className="p-4 border rounded-lg space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 space-y-2">
                        <div>
                          <div className="text-xs text-muted-foreground">Token Address:</div>
                          <div className="font-mono text-xs break-all">{listing.token_address}</div>
                        </div>
                        <div className="flex gap-4 text-xs">
                          <div>
                            <span className="text-muted-foreground">Price:</span>{' '}
                            <span className="font-semibold">
                              {listing.price_kta || listing.price_xrge} {listing.currency}
                            </span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Cancelled:</span>{' '}
                            <span>{new Date(listing.updated_at).toLocaleDateString()}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    <Button
                      onClick={() => recoverNFT(listing.token_address, listing.seller_address)}
                      disabled={isRecovering}
                      size="sm"
                      className="w-full pixel-border-thick"
                      variant="default"
                    >
                      {isRecovering ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          RECOVERING...
                        </>
                      ) : (
                        <>
                          <CheckCircle className="w-4 h-4 mr-2" />
                          RECOVER THIS NFT
                        </>
                      )}
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Manual Recovery */}
        <Card className="pixel-border-thick">
          <CardHeader>
            <CardTitle>Manual Recovery</CardTitle>
            <CardDescription>
              If you know the token address, you can manually recover an NFT
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="tokenAddress">NFT Token Address</Label>
              <Input
                id="tokenAddress"
                placeholder="keeta_an..."
                value={tokenAddress}
                onChange={(e) => setTokenAddress(e.target.value)}
                className="font-mono text-xs"
              />
            </div>

            <div className="space-y-2">
              <Label>Your Wallet Address (Recipient)</Label>
              <div className="font-mono text-xs p-3 bg-muted rounded-md break-all">
                {publicKey}
              </div>
            </div>

            <Button
              onClick={() => recoverNFT()}
              disabled={isRecovering || !tokenAddress}
              className="w-full pixel-border-thick"
            >
              {isRecovering && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {isRecovering ? "RECOVERING..." : "RECOVER NFT"}
            </Button>
          </CardContent>
        </Card>

        {/* Help Text */}
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="text-xs">
            <strong>How this works:</strong> When you cancel a listing, the NFT should automatically return from escrow. 
            If it didn't (due to the old bug), use this page to manually recover it. The NFT must have been part of a 
            cancelled listing under your wallet address.
          </AlertDescription>
        </Alert>
      </div>
    </div>
  );
};

export default RecoverNFT;

