import { useState } from "react";
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
  const { client, account, publicKey, network } = useWallet();
  const [price, setPrice] = useState("");
  const [currency, setCurrency] = useState<'KTA' | 'XRGE'>('KTA');
  const [isListing, setIsListing] = useState(false);

  const handleList = async () => {
    if (!client || !account || !publicKey) {
      toast.error("Please connect your wallet");
      return;
    }

    if (!price || parseFloat(price) <= 0) {
      toast.error("Please enter a valid price");
      return;
    }

    setIsListing(true);

    try {
      // Create the seller's side of the atomic swap
      const builder = client.initBuilder();
      
      const tokenAccountObj = KeetaNet.lib.Account.fromPublicKeyString(tokenAddress);
      
      // Get anchor address from the backend
      const anchorAddress = network === 'test' 
        ? 'keeta_aabszsbrqppriqddrkptq5awubshpq3cgsoi4rc624xm6phdt74vo5w7wipwtmi'
        : 'keeta_aabszsbrqppriqddrkptq5awubshpq3cgsoi4rc624xm6phdt74vo5w7wipwtmi'; // Update with mainnet anchor
      
      const anchorAccountObj = KeetaNet.lib.Account.fromPublicKeyString(anchorAddress);
      
      // Seller sends NFT to anchor
      builder.send(anchorAccountObj, 1n, tokenAccountObj);
      
      // Compute the block using the client
      const computed = await client.computeBuilderBlocks(builder);
      
      if (!computed.blocks || computed.blocks.length === 0) {
        throw new Error('Failed to create swap block');
      }
      
      console.log('Swap blocks computed:', computed.blocks.length);
      
      // Get the block bytes
      const swapBlock = computed.blocks[0];
      const swapBlockBytes = swapBlock.toBytes();
      const swapBlockBase64 = btoa(
        String.fromCharCode(...new Uint8Array(swapBlockBytes))
      );

      // Call the edge function to complete listing
      const { data, error } = await supabase.functions.invoke('fx-list-nft', {
        body: {
          tokenAddress,
          sellerAddress: publicKey,
          price: parseFloat(price),
          currency,
          network,
          swapBlockBytes: swapBlockBase64,
        },
      });

      if (error) throw error;

      toast.success("NFT listed successfully!");
      onOpenChange(false);
      setPrice("");
    } catch (error: any) {
      console.error('Error listing NFT:', error);
      toast.error(`Failed to list NFT: ${error.message}`);
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
            disabled={isListing || !price}
            className="pixel-border-thick text-xs"
          >
            {isListing ? "LISTING..." : "LIST FOR SALE"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ListNFTDialog;
