import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ExternalLink, Copy, User, History, ArrowRight, ShoppingCart, Tag, Wallet, X } from "lucide-react";
import { useParams, Link, useLocation } from "react-router-dom";
import { useWallet } from "@/contexts/WalletContext";
import * as KeetaNet from "@keetanetwork/keetanet-client";
import { ipfsToHttp } from "@/utils/nftUtils";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { fetchTokenInfo } from "@/utils/keetaBlockchain";
import { useEffect, useState } from "react";
import { useNFTOwnership } from "@/hooks/useNFTOwnership";
import { formatDistanceToNow } from "date-fns";
import ListNFTDialog from "@/components/ListNFTDialog";
import { BuyNFTConfirmDialog } from "@/components/BuyNFTConfirmDialog";
import { NFTPriceChart } from "@/components/NFTPriceChart";

const NFTDetail = () => {
  const { id } = useParams(); // This is the token address
  const location = useLocation();
  const { network, publicKey, fetchTokens, client, balance, isConnected } = useWallet();
  const [tokenData, setTokenData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const { owner, transactions, isLoading: isLoadingOwnership } = useNFTOwnership(id || '');
  const [showListDialog, setShowListDialog] = useState(false);
  const [activeListing, setActiveListing] = useState<any>(null);
  const [isBuying, setIsBuying] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [showBuyDialog, setShowBuyDialog] = useState(false);
  const [userKTABalance, setUserKTABalance] = useState(0);
  const [userXRGEBalance, setUserXRGEBalance] = useState(0);
  const [sellerUsername, setSellerUsername] = useState<string | null>(null);

  // Refresh wallet data if this is a fresh mint
  useEffect(() => {
    if (location.state?.freshMint) {
      fetchTokens();
    }
  }, [location.state, fetchTokens]);

  // Fetch active listing if NFT is in escrow
  useEffect(() => {
    if (!id || !owner?.isAnchor) return;

    const fetchListing = async () => {
      const { data } = await supabase
        .from('nft_listings')
        .select('*')
        .eq('token_address', id)
        .eq('network', network)
        .eq('status', 'active')
        .maybeSingle();

      setActiveListing(data);

      // Fetch seller profile if listing exists
      if (data?.seller_address) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('username')
          .eq('wallet_address', data.seller_address)
          .maybeSingle();
        
        setSellerUsername(profile?.username || null);
      }
    };

    fetchListing();
  }, [id, network, owner]);

  // Fetch user balances when wallet is connected
  useEffect(() => {
    if (!publicKey) return;

    const fetchBalances = async () => {
      try {
        // For Yoda wallet, use balance from context
        if (!client) {
          // Yoda wallet - use the balance from wallet context
          const balanceNum = parseFloat(balance || '0');
          setUserKTABalance(balanceNum);
          setUserXRGEBalance(0); // XRGE not yet supported for Yoda
          return;
        }

        // For seed phrase wallet, fetch using client
        const tokenAddresses = network === 'test' ? {
          KTA: 'keeta_anyiff4v34alvumupagmdyosydeq24lc4def5mrpmmyhx3j6vj2uucckeqn52',
          XRGE: 'keeta_annmywuiz2pourjmkyuaznxyg6cmv356dda3hpuiqfpwry5m2tlybothdb33s',
        } : {
          KTA: 'keeta_anqdilpazdekdu4acw65fj7smltcp26wbrildkqtszqvverljpwpezmd44ssg',
          XRGE: 'keeta_aolgxwrcepccr5ycg5ctp3ezhhp6vnpitzm7grymm63hzbaqk6lcsbtccgur6',
        };

        const ktaTokenObj = KeetaNet.lib.Account.fromPublicKeyString(tokenAddresses.KTA);
        const xrgeTokenObj = KeetaNet.lib.Account.fromPublicKeyString(tokenAddresses.XRGE);

        const ktaBalance = await client.balance(ktaTokenObj);
        const xrgeBalance = await client.balance(xrgeTokenObj);

        const KTA_DECIMALS = 9;
        const XRGE_DECIMALS = 18;

        setUserKTABalance(Number(ktaBalance) / Math.pow(10, KTA_DECIMALS));
        setUserXRGEBalance(Number(xrgeBalance) / Math.pow(10, XRGE_DECIMALS));
      } catch (error) {
        console.error('[NFTDetail] Error fetching balances:', error);
      }
    };

    fetchBalances();
  }, [client, publicKey, network, balance]);

  useEffect(() => {
    if (!id) return;
    
    const loadTokenData = async () => {
      setLoading(true);
      setError(false);
      
      try {
        const data = await fetchTokenInfo(id, network);
        console.log('[NFTDetail] Loaded token data:', data);
        
        if (!data.isNFT) {
          console.warn('[NFTDetail] Token is not an NFT:', data);
        }
        
        setTokenData(data);
      } catch (err) {
        console.error('[NFTDetail] Error loading token:', err);
        setError(true);
      } finally {
        setLoading(false);
      }
    };
    
    loadTokenData();
  }, [id, network]);

  const copyAddress = () => {
    if (id) {
      navigator.clipboard.writeText(id);
      toast.success("Contract address copied!");
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard!");
  };

  const formatAddress = (addr: string) => {
    if (!addr || addr === 'Unknown') return addr;
    return `${addr.substring(0, 10)}...${addr.substring(addr.length - 8)}`;
  };

  const handleBuyNFT = async () => {
    if (!publicKey || !isConnected) {
      toast.error("Please connect your wallet to buy this NFT");
      return;
    }

    if (!activeListing) {
      toast.error("No active listing found");
      return;
    }

    setIsBuying(true);

    try {
      // Step 1: User sends payment to anchor
      toast.info("Sending payment to escrow...");
      
      const paymentAmount = activeListing.currency === 'KTA' 
        ? activeListing.price_kta 
        : activeListing.price_xrge;
      
      const tokenAddresses = network === 'test' ? {
        KTA: 'keeta_anyiff4v34alvumupagmdyosydeq24lc4def5mrpmmyhx3j6vj2uucckeqn52',
        XRGE: 'keeta_annmywuiz2pourjmkyuaznxyg6cmv356dda3hpuiqfpwry5m2tlybothdb33s',
      } : {
        KTA: 'keeta_anqdilpazdekdu4acw65fj7smltcp26wbrildkqtszqvverljpwpezmd44ssg',
        XRGE: 'keeta_aolgxwrcepccr5ycg5ctp3ezhhp6vnpitzm7grymm63hzbaqk6lcsbtccgur6',
      };
      
      const paymentTokenAddress = activeListing.currency === 'KTA' 
        ? tokenAddresses.KTA 
        : tokenAddresses.XRGE;
      
      // CRITICAL: Use network-specific decimals (testnet KTA=9, mainnet KTA=18)
      const TOKEN_DECIMALS = activeListing.currency === 'KTA' 
        ? (network === 'test' ? 9 : 18)
        : 18;
      const amountInSmallestUnit = BigInt(Math.floor(paymentAmount * Math.pow(10, TOKEN_DECIMALS)));
      
      // Get anchor address
      const { data: anchorData } = await supabase.functions.invoke('fx-anchor-info', {
        body: { network }
      });
      
      if (!anchorData?.address) {
        throw new Error('Failed to get anchor address');
      }
      
      const anchorAddress = anchorData.address;
      
      // Send payment to anchor
      const builder = client.initBuilder();
      const anchorAccountObj = KeetaNet.lib.Account.fromPublicKeyString(anchorAddress);
      const paymentTokenObj = KeetaNet.lib.Account.fromPublicKeyString(paymentTokenAddress);
      
      builder.send(anchorAccountObj, amountInSmallestUnit, paymentTokenObj);
      
      await builder.computeBlocks();
      await builder.publish();
      
      toast.info("Processing purchase...");
      
      // Wait for blockchain
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Step 2: Call backend to complete swap
      const { data, error } = await supabase.functions.invoke('fx-buy-nft', {
        body: {
          listingId: activeListing.id,
          buyerAddress: publicKey,
          network,
        },
      });

      if (error) {
        throw new Error(error.message);
      }

      toast.success("NFT purchased successfully!");
      window.location.reload();
    } catch (error: any) {
      console.error('Error buying NFT:', error);
      toast.error(`Failed to buy NFT: ${error.message}`);
    } finally {
      setIsBuying(false);
    }
  };

  const handleCancelListing = async () => {
    if (!publicKey || !isConnected) {
      toast.error("Please connect your wallet");
      return;
    }

    if (!activeListing || !id) {
      toast.error("No active listing found");
      return;
    }

    // Verify the user is the seller
    if (activeListing.seller_address !== publicKey) {
      toast.error("You can only cancel your own listings");
      return;
    }

    setIsCancelling(true);

    try {
      toast.info("Cancelling listing and returning NFT from escrow...");

      // Call the cancel listing edge function
      const { data, error } = await supabase.functions.invoke('fx-cancel-listing', {
        body: { 
          listingId: activeListing.id,
          network 
        }
      });

      if (error) {
        throw new Error(error.message || 'Failed to cancel listing');
      }

      if (!data.success) {
        throw new Error(data.error || data.warning || 'Failed to cancel listing');
      }

      console.log('[NFTDetail] Cancel listing response:', data);

      const txMessage = data.transactionHash && data.transactionHash !== 'unknown'
        ? `Listing cancelled! NFT returned. Tx: ${data.transactionHash.substring(0, 8)}...`
        : `Listing cancelled! NFT returned to your wallet.`;
      
      toast.success(txMessage);

      // Refresh page to update UI
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    } catch (error: any) {
      console.error('Error cancelling listing:', error);
      toast.error(`Failed to cancel listing: ${error.message}`);
    } finally {
      setIsCancelling(false);
    }
  };

  const explorerUrl = network === 'test'
    ? `https://explorer.test.keeta.com/token/${id}`
    : `https://explorer.keeta.com/token/${id}`;

  if (loading) {
    return (
      <div className="min-h-screen pt-24 pb-16 px-4">
        <div className="container mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8">
            <Skeleton className="aspect-square w-full" />
            <div className="space-y-4">
              <Skeleton className="h-12 w-3/4" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-32 w-full" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !tokenData) {
    return (
      <div className="min-h-screen pt-24 pb-16 px-4">
        <div className="container mx-auto">
          <Link to="/collection" className="text-xs text-primary hover:underline mb-6 inline-block">
            ← BACK TO COLLECTION
          </Link>
          <div className="text-center py-20 space-y-4">
            <div className="text-6xl">❌</div>
            <h2 className="text-2xl font-bold">TOKEN NOT FOUND</h2>
            <p className="text-sm text-muted-foreground">
              This token doesn't exist on {network === 'test' ? 'testnet' : 'mainnet'}
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              Make sure you're on the correct network and the token address is valid
            </p>
          </div>
        </div>
      </div>
    );
  }

  const metadata = tokenData.metadata;
  const imageUrl = metadata?.image ? ipfsToHttp(metadata.image) : '';
  const isOwner = owner?.isYou || false;

  return (
    <div className="min-h-screen pt-20 sm:pt-24 pb-12 sm:pb-16 px-2 sm:px-4">
      <div className="container mx-auto max-w-7xl">
        <Link to="/collection" className="text-[10px] sm:text-xs text-primary hover:underline mb-4 sm:mb-6 inline-block">
          ← BACK TO COLLECTION
        </Link>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 lg:gap-8">
          {/* Image Section */}
          <div className="space-y-3 sm:space-y-4">
            <div className="aspect-square bg-muted pixel-border-thick overflow-hidden w-full flex items-center justify-center">
              {imageUrl ? (
                <img
                  src={imageUrl}
                  alt={metadata?.name || tokenData.name || 'Token'}
                  className="w-full h-full object-contain"
                  style={{ imageRendering: "pixelated" }}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-4xl sm:text-6xl">
                  {tokenData.isNFT ? '🎨' : '🪙'}
                </div>
              )}
            </div>
          </div>

          {/* Details Section */}
          <div className="space-y-3 sm:space-y-4 lg:space-y-6">
            <div>
              {activeListing && (
                <div className="inline-block pixel-border bg-secondary/20 px-2 sm:px-3 py-1 mb-2 sm:mb-3">
                  <span className="text-[10px] sm:text-xs neon-glow-secondary break-all">
                    {sellerUsername || `${activeListing.seller_address.slice(0, 8)}...${activeListing.seller_address.slice(-6)}`}
                  </span>
                </div>
              )}
              {!tokenData.isNFT && (
                <div className="inline-block pixel-border bg-accent/20 px-2 sm:px-3 py-1 mb-2 sm:mb-3 ml-2">
                  <span className="text-[10px] sm:text-xs text-accent">TOKEN</span>
                </div>
              )}
              <h1 className="text-xl sm:text-2xl md:text-3xl lg:text-5xl font-bold neon-glow mb-2 sm:mb-3 break-words leading-tight">
                {metadata?.name || tokenData.name}
              </h1>
            </div>

            {/* Owner Info */}
            {!isLoadingOwnership && owner && (
              <Card className="pixel-border-thick bg-card">
                <CardContent className="p-3 sm:p-4 md:p-6 space-y-2 sm:space-y-3">
                  <div className="flex items-center gap-2">
                    <User className="w-3 h-3 sm:w-4 sm:h-4" />
                    <h3 className="font-bold text-[10px] sm:text-xs md:text-sm">CURRENT OWNER</h3>
                  </div>
                  {owner.isAnchor ? (
                    <div className="space-y-2 sm:space-y-3">
                      <div className="bg-accent/20 pixel-border p-2 sm:p-3">
                        <div className="flex items-center gap-2 mb-1 sm:mb-2">
                          <ShoppingCart className="w-3 h-3 sm:w-4 sm:h-4 text-accent" />
                          <span className="text-[10px] sm:text-xs font-bold text-accent">LISTED FOR SALE</span>
                        </div>
                        <p className="text-[10px] sm:text-xs text-muted-foreground leading-relaxed">
                          This NFT is currently in escrow and available for purchase.
                        </p>
                      </div>
                      {activeListing && (
                        <>
                          <div className="bg-muted pixel-border p-2 sm:p-3">
                            <div className="text-[10px] sm:text-xs text-muted-foreground mb-1 sm:mb-2">Seller:</div>
                            <div className="flex items-center gap-1 sm:gap-2">
                              <code className="text-[10px] sm:text-xs flex-1 truncate min-w-0">
                                {activeListing.seller_address === publicKey ? (
                                  <span className="text-primary font-bold">YOU ({formatAddress(activeListing.seller_address)})</span>
                                ) : (
                                  formatAddress(activeListing.seller_address)
                                )}
                              </code>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-7 w-7 sm:h-8 sm:w-8 flex-shrink-0"
                                onClick={() => copyToClipboard(activeListing.seller_address)}
                              >
                                <Copy className="w-3 h-3" />
                              </Button>
                            </div>
                            <div className="mt-2 sm:mt-3 pt-2 sm:pt-3 border-t border-border">
                              <div className="text-[10px] sm:text-xs text-muted-foreground mb-1">Price:</div>
                              <div className="text-base sm:text-lg font-bold text-primary">
                                {activeListing.currency === 'KTA' ? activeListing.price_kta : activeListing.price_xrge} {activeListing.currency}
                              </div>
                            </div>
                          </div>
                          {publicKey && activeListing.seller_address === publicKey ? (
                            <Button 
                              className="w-full pixel-border-thick gap-1 sm:gap-2 text-xs sm:text-sm h-10 sm:h-11"
                              variant="destructive"
                              onClick={handleCancelListing}
                              disabled={isCancelling}
                            >
                              <X className="w-3 h-3 sm:w-4 sm:h-4" />
                              {isCancelling ? "CANCELLING..." : "CANCEL LISTING"}
                            </Button>
                          ) : publicKey && activeListing.seller_address !== publicKey ? (
                            <Button 
                              className="w-full pixel-border-thick gap-1 sm:gap-2 text-xs sm:text-sm h-10 sm:h-11"
                              onClick={() => setShowBuyDialog(true)}
                              disabled={isBuying}
                            >
                              <Wallet className="w-3 h-3 sm:w-4 sm:h-4" />
                              BUY NOW
                            </Button>
                          ) : null}
                        </>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex items-center gap-1 sm:gap-2 bg-muted p-2 sm:p-3 pixel-border">
                        <code className="text-[10px] sm:text-xs flex-1 truncate min-w-0">
                          {owner.isYou ? (
                            <span className="text-primary font-bold">YOU ({formatAddress(owner.address)})</span>
                          ) : (
                            owner.address !== 'Unknown' ? formatAddress(owner.address) : 'Unknown Owner'
                          )}
                        </code>
                        {owner.address !== 'Unknown' && !owner.isYou && (
                          <Button
                            variant="ghost" 
                            size="icon" 
                            className="h-7 w-7 sm:h-8 sm:w-8 flex-shrink-0"
                            onClick={() => copyToClipboard(owner.address)}
                          >
                            <Copy className="w-3 h-3" />
                          </Button>
                        )}
                      </div>
                      {owner.isYou && !owner.isAnchor && (
                        <Button 
                          className="w-full pixel-border gap-1 sm:gap-2 text-xs h-10 sm:h-11"
                          variant="default"
                          onClick={() => setShowListDialog(true)}
                        >
                          <Tag className="w-3 h-3 sm:w-4 sm:h-4" />
                          LIST FOR SALE
                        </Button>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Contract Address */}
            <Card className="pixel-border-thick bg-card">
              <CardContent className="p-3 sm:p-4 md:p-6 space-y-2 sm:space-y-3">
                <h3 className="font-bold text-[10px] sm:text-xs md:text-sm">CONTRACT ADDRESS</h3>
                <div className="flex items-center gap-1 sm:gap-2 bg-muted p-2 sm:p-3 pixel-border overflow-hidden">
                  <code className="text-[10px] sm:text-xs flex-1 truncate min-w-0">{id}</code>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-7 w-7 sm:h-8 sm:w-8 flex-shrink-0"
                    onClick={copyAddress}
                  >
                    <Copy className="w-3 h-3" />
                  </Button>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full pixel-border gap-1 sm:gap-2 text-[10px] sm:text-xs h-10 sm:h-11"
                  onClick={() => window.open(explorerUrl, '_blank')}
                >
                  <ExternalLink className="w-3 h-3 sm:w-4 sm:h-4" />
                  VIEW ON {network === 'test' ? 'TESTNET' : 'MAINNET'} EXPLORER
                </Button>
              </CardContent>
            </Card>

            {/* Traits/Attributes */}
            {metadata?.attributes && metadata.attributes.length > 0 && (
              <Card className="pixel-border-thick bg-card">
                <CardContent className="p-3 sm:p-4 md:p-6 space-y-3 sm:space-y-4">
                  <h3 className="font-bold text-[10px] sm:text-xs md:text-sm">TRAITS</h3>
                  <div className="grid grid-cols-2 gap-2 md:gap-3">
                    {metadata.attributes.map((attr, idx) => (
                      <div key={idx} className="pixel-border bg-muted p-2 sm:p-3">
                        <div className="text-[9px] sm:text-[10px] text-muted-foreground break-words">{attr.trait_type.toUpperCase()}</div>
                        <div className="font-bold text-[10px] sm:text-xs mt-1 break-words">{attr.value}</div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Description */}
            {metadata?.description && (
              <Card className="pixel-border-thick bg-card">
                <CardContent className="p-3 sm:p-4 md:p-6 space-y-3 sm:space-y-4">
                  <h3 className="font-bold text-[10px] sm:text-xs md:text-sm">DESCRIPTION</h3>
                  <p className="text-[10px] sm:text-xs text-muted-foreground leading-relaxed break-words">
                    {metadata.description}
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Token Info */}
            <Card className="pixel-border-thick bg-card">
              <CardContent className="p-3 sm:p-4 md:p-6 space-y-2 sm:space-y-3">
                <h3 className="font-bold text-[10px] sm:text-xs md:text-sm">TOKEN INFO</h3>
                <div className="space-y-1.5 sm:space-y-2 text-[10px] sm:text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Type:</span>
                    <span className="font-bold">{tokenData.isNFT ? 'NFT' : 'Token'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Network:</span>
                    <span className="font-bold">{network === 'test' ? 'Testnet' : 'Mainnet'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Supply:</span>
                    <span className="font-bold">{tokenData.supply}</span>
                  </div>
                  {tokenData.decimals !== undefined && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Decimals:</span>
                      <span className="font-bold">{tokenData.decimals}</span>
                    </div>
                  )}
                  {metadata?.identifier && (
                    <div className="flex justify-between gap-1 sm:gap-2">
                      <span className="text-muted-foreground flex-shrink-0">Identifier:</span>
                      <span className="font-bold truncate text-right max-w-[60%]">{metadata.identifier}</span>
                    </div>
                  )}
                  {metadata?.nft_id && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">NFT ID:</span>
                      <span className="font-bold">#{metadata.nft_id}</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Price History Chart */}
        {id && (
          <div className="mt-4 sm:mt-6 lg:mt-8">
            <NFTPriceChart tokenAddress={id} network={network} />
          </div>
        )}

        {/* Transaction History */}
        {!isLoadingOwnership && transactions.length > 0 && (
          <div className="mt-4 sm:mt-6 lg:mt-8">
            <Card className="pixel-border-thick bg-card">
              <CardContent className="p-3 sm:p-4 md:p-6 space-y-3 sm:space-y-4">
                <div className="flex items-center gap-2">
                  <History className="w-3 h-3 sm:w-4 sm:h-4" />
                  <h3 className="font-bold text-[10px] sm:text-xs md:text-sm">TRANSACTION HISTORY</h3>
                </div>
                <div className="space-y-2">
                  {transactions.map((tx) => (
                    <div key={tx.id} className="pixel-border bg-muted p-2 sm:p-3">
                      <div className="flex items-center justify-between gap-1 sm:gap-2 mb-1 sm:mb-2">
                        <div className="flex items-center gap-1 sm:gap-2">
                          {tx.type === 'list' && <Tag className="w-3 h-3 text-accent" />}
                          {tx.type === 'sale' && <ShoppingCart className="w-3 h-3 text-primary" />}
                          {tx.type === 'transfer' && <ArrowRight className="w-3 h-3 text-secondary" />}
                          <span className="text-[10px] sm:text-xs font-bold">
                            {tx.type === 'list' && 'LISTED'}
                            {tx.type === 'sale' && 'SOLD'}
                            {tx.type === 'transfer' && 'TRANSFERRED'}
                          </span>
                        </div>
                        <span className="text-[9px] sm:text-[10px] text-muted-foreground whitespace-nowrap">
                          {formatDistanceToNow(new Date(tx.timestamp), { addSuffix: true })}
                        </span>
                      </div>
                      <div className="text-[10px] sm:text-xs space-y-1">
                        <div className="flex items-center gap-1 sm:gap-2 text-muted-foreground">
                          <span className="flex-shrink-0">From:</span>
                          <Link 
                            to={`/profile/${tx.from}`}
                            className="hover:text-primary transition-colors truncate min-w-0"
                          >
                            <code className="break-all">{formatAddress(tx.from)}</code>
                          </Link>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-5 w-5 flex-shrink-0"
                            onClick={(e) => {
                              e.stopPropagation();
                              copyToClipboard(tx.from);
                            }}
                          >
                            <Copy className="w-2 h-2" />
                          </Button>
                        </div>
                        <div className="flex items-center gap-1 sm:gap-2 text-muted-foreground">
                          <span className="flex-shrink-0">To:</span>
                          <Link 
                            to={`/profile/${tx.to}`}
                            className="hover:text-primary transition-colors truncate min-w-0"
                          >
                            <code className="break-all">{formatAddress(tx.to)}</code>
                          </Link>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-5 w-5 flex-shrink-0"
                            onClick={(e) => {
                              e.stopPropagation();
                              copyToClipboard(tx.to);
                            }}
                          >
                            <Copy className="w-2 h-2" />
                          </Button>
                        </div>
                        {tx.price && tx.currency && (
                          <div className="text-primary font-bold mt-1">
                            Price: {tx.price} {tx.currency}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* List NFT Dialog */}
      {tokenData && owner?.isYou && (
        <ListNFTDialog
          open={showListDialog}
          onOpenChange={setShowListDialog}
          tokenAddress={id || ''}
          tokenName={metadata?.name || tokenData.name || 'NFT'}
          tokenImage={imageUrl}
        />
      )}

      {/* Buy NFT Confirmation Dialog */}
      {showBuyDialog && activeListing && (
        <BuyNFTConfirmDialog
          open={showBuyDialog}
          onOpenChange={setShowBuyDialog}
          onConfirm={handleBuyNFT}
          nftName={metadata?.name || tokenData.name || 'NFT'}
          price={activeListing.currency === 'KTA' ? activeListing.price_kta : activeListing.price_xrge}
          currency={activeListing.currency}
          userBalance={activeListing.currency === 'KTA' ? userKTABalance : userXRGEBalance}
          isProcessing={isBuying}
        />
      )}
    </div>
  );
};

export default NFTDetail;
