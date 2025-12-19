import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useWallet } from "@/contexts/WalletContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import * as KeetaNet from "@keetanetwork/keetanet-client";

interface ListNFTDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tokenAddress: string;
  tokenName: string;
  tokenImage: string;
}

const ListNFTDialog = ({ open, onOpenChange, tokenAddress, tokenName, tokenImage }: ListNFTDialogProps) => {
  const { client, account, publicKey, network, isConnected, walletType, sendTokens } = useWallet();
  const [price, setPrice] = useState("");
  const [currency, setCurrency] = useState<'KTA' | 'XRGE'>('KTA');
  const [isListing, setIsListing] = useState(false);
  const [anchorAddress, setAnchorAddress] = useState<string | null>(null);
  const [isLoadingAnchor, setIsLoadingAnchor] = useState(false);

  // Fetch anchor address when dialog opens
  const fetchAnchorAddress = async () => {
    if (!open) return;
    
    setIsLoadingAnchor(true);
    try {
      const { data, error } = await supabase.functions.invoke('fx-anchor-info', {
        body: { network }
      });
      
      if (error || !data?.address) {
        console.error('Failed to get anchor address:', error);
        toast.error('Failed to load escrow address');
        return;
      }
      
      setAnchorAddress(data.address);
    } catch (error) {
      console.error('Error fetching anchor:', error);
      toast.error('Failed to load escrow address');
    } finally {
      setIsLoadingAnchor(false);
    }
  };

  // Fetch anchor address when dialog opens or network changes
  useEffect(() => {
    if (open) {
      fetchAnchorAddress();
    }
  }, [open, network]);

  const handleList = async () => {
    if (!publicKey || !isConnected) {
      toast.error("Please connect your wallet");
      return;
    }

    if (!price || parseFloat(price) <= 0) {
      toast.error("Please enter a valid price");
      return;
    }

    setIsListing(true);

    try {
      // NFT LISTING FLOW:
      // 1. Seller transfers NFT to anchor (escrow) - simple transfer, not atomic
      // 2. Anchor verifies receipt and creates database listing
      // 3. When buyer purchases, atomic swap happens: payment ↔ NFT
      
      if (!anchorAddress) {
        toast.error('Escrow address not loaded. Please close and try again.');
        return;
      }
      
      console.log('Using anchor address:', anchorAddress);
      
      const anchorAccountObj = KeetaNet.lib.Account.fromPublicKeyString(anchorAddress);
      const tokenAccountObj = KeetaNet.lib.Account.fromPublicKeyString(tokenAddress);
      
      // Check if anchor already has the NFT
      console.log('Checking if anchor already has NFT...');
      
      let anchorBalance = 0n;
      
      // Check balance differently based on wallet type
      if (walletType === 'yoda') {
        // For Yoda wallet, use API to check balance
        const apiBase = network === 'test' 
          ? 'https://rep2.test.network.api.keeta.com/api'
          : 'https://rep2.main.network.api.keeta.com/api';
        
        try {
          const response = await fetch(`${apiBase}/node/ledger/accounts/${anchorAddress}`);
          if (response.ok) {
            const data = await response.json();
            const accountData = Array.isArray(data) ? data[0] : data;
            const balances = accountData?.balances || [];
            const tokenBalance = balances.find((b: any) => b.token === tokenAddress);
            anchorBalance = tokenBalance ? BigInt(tokenBalance.balance) : 0n;
          }
        } catch (error) {
          console.error('Error checking anchor balance:', error);
        }
      } else if (client) {
        // For seed wallet, use client
        anchorBalance = await client.balance(tokenAccountObj, { account: anchorAccountObj });
      }
      
      if (anchorBalance > 0n) {
        console.log('✅ Anchor already has NFT, skipping transfer');
        toast.info("NFT already in escrow, creating listing...");
      } else {
        // Step 1: Transfer NFT to anchor (escrow)
        console.log('NFT not in anchor yet, transferring...');
        toast.info("Transferring NFT to escrow...");
        
        if (walletType === 'yoda') {
          // Use Yoda wallet's sendTransaction for transfer
          try {
            console.log('[ListNFTDialog] Attempting Yoda transfer...');
            console.log('[ListNFTDialog] Token:', tokenAddress);
            console.log('[ListNFTDialog] To:', anchorAddress);
            console.log('[ListNFTDialog] Amount: 1');
            
            const txHash = await sendTokens(anchorAddress, '1', tokenAddress);
            console.log('NFT transferred via Yoda:', txHash);
          } catch (error: any) {
            console.error('Yoda transfer error:', error);
            
            // Check if this is a known Yoda wallet limitation
            if (error?.message?.includes('account') || error?.message?.includes('undefined')) {
              throw new Error(
                'Yoda wallet does not yet support NFT transfers via this interface. ' +
                'Please use a seed phrase wallet to list NFTs, or transfer manually and then create the listing.'
              );
            }
            throw error;
          }
        } else if (client) {
          // Use seed wallet client
          const builder = client.initBuilder();
          builder.send(anchorAccountObj, 1n, tokenAccountObj);
          
          await builder.computeBlocks();
          const result = await builder.publish();
          
          console.log('NFT transferred to anchor:', result);
        } else {
          throw new Error('No wallet client available');
        }
        
        toast.info("Creating listing...");
        
        // Wait a moment for blockchain to process the transfer
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
      
      // Step 2: Create the listing in database
      // The edge function will verify the anchor received the NFT
      const { data, error } = await supabase.functions.invoke('fx-list-nft', {
        body: {
          tokenAddress,
          sellerAddress: publicKey,
          price: parseFloat(price),
          currency,
          network,
        },
      });

      if (error) {
        console.error('Edge function error:', error);
        // Try to get more details from the error
        const errorMessage = error.message || 'Unknown error';
        throw new Error(errorMessage);
      }

      toast.success("NFT listed successfully!");
      onOpenChange(false);
      setPrice("");
    } catch (error: any) {
      console.error('Error listing NFT:', error);
      
      // Show more helpful error messages
      let errorMessage = error.message || 'Unknown error';
      
      if (errorMessage.includes('NFT not yet received')) {
        errorMessage = 'Transfer is still processing. Please wait a moment and try again.';
      }
      
      toast.error(`Failed to list NFT: ${errorMessage}`);
    } finally {
      setIsListing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="pixel-border-thick sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold neon-glow">LIST NFT FOR SALE</DialogTitle>
          <DialogDescription className="text-xs">
            Set a price and list your NFT on the marketplace
          </DialogDescription>
        </DialogHeader>

        {/* Yoda Wallet Warning */}
        {walletType === 'yoda' && (
          <div className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded pixel-border">
            <div className="flex items-start gap-2">
              <span className="text-yellow-500 text-lg">⚠️</span>
              <div className="text-xs text-yellow-200">
                <p className="font-bold mb-1">Yoda Wallet Limitation</p>
                <p className="text-yellow-300/90">
                  The Yoda wallet extension does not currently support NFT transfers. 
                  To list NFTs, please use a seed phrase wallet instead.
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-4 py-4">
          {/* NFT Preview */}
          <div className="flex items-center gap-3 p-3 bg-muted rounded pixel-border">
            <img 
              src={tokenImage} 
              alt={tokenName}
              className="w-16 h-16 object-cover rounded"
              style={{ imageRendering: "pixelated" }}
            />
            <div>
              <p className="font-bold text-sm">{tokenName}</p>
              <p className="text-xs text-muted-foreground truncate">{tokenAddress.substring(0, 20)}...</p>
            </div>
          </div>

          {/* Price Input */}
          <div className="space-y-2">
            <Label htmlFor="price" className="text-xs font-bold">PRICE *</Label>
            <Input
              id="price"
              type="number"
              step="0.01"
              min="0"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="0.00"
              className="pixel-border text-xs"
            />
          </div>

          {/* Currency Selection */}
          <div className="space-y-2">
            <Label htmlFor="currency" className="text-xs font-bold">CURRENCY *</Label>
            <Select value={currency} onValueChange={(value: 'KTA' | 'XRGE') => setCurrency(value)}>
              <SelectTrigger className="pixel-border text-xs">
                <SelectValue placeholder="Select currency" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="KTA">KTA</SelectItem>
                <SelectItem value="XRGE">XRGE</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Escrow Address Preview */}
          <div className="space-y-2">
            <Label className="text-xs font-bold">ESCROW ADDRESS</Label>
            <div className="p-3 bg-muted/50 rounded pixel-border">
              {isLoadingAnchor ? (
                <div className="text-xs text-muted-foreground animate-pulse">Loading escrow address...</div>
              ) : anchorAddress ? (
                <div className="space-y-2">
                  <div className="text-xs font-mono break-all text-foreground">{anchorAddress}</div>
                  <div className="text-xs text-muted-foreground">
                    ✓ Your NFT will be sent to this {network === 'test' ? 'testnet' : 'mainnet'} escrow wallet
                  </div>
                </div>
              ) : (
                <div className="text-xs text-red-500">⚠ Failed to load escrow address</div>
              )}
            </div>
          </div>

          {/* Info */}
          <div className="text-xs text-muted-foreground space-y-1 p-3 bg-muted/50 rounded">
            <p>• NFT will be held in escrow until sold</p>
            <p>• You can cancel the listing anytime</p>
            <p>• 2.5% marketplace fee applies</p>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="pixel-border text-xs"
            disabled={isListing}
          >
            CANCEL
          </Button>
          <Button
            onClick={handleList}
            disabled={isListing || !price || !anchorAddress || isLoadingAnchor || walletType === 'yoda'}
            className="pixel-border-thick text-xs"
            title={walletType === 'yoda' ? 'Yoda wallet does not support NFT transfers' : ''}
          >
            {isListing ? "LISTING..." : walletType === 'yoda' ? "NOT SUPPORTED (YODA)" : "LIST FOR SALE"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ListNFTDialog;
