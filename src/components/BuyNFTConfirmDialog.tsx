import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle, Wallet, ArrowRight } from "lucide-react";

interface BuyNFTConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  nftName: string;
  price: number;
  currency: string;
  userBalance: number;
  isProcessing: boolean;
}

export function BuyNFTConfirmDialog({
  open,
  onOpenChange,
  onConfirm,
  nftName,
  price,
  currency,
  userBalance,
  isProcessing,
}: BuyNFTConfirmDialogProps) {
  const hasEnoughBalance = userBalance >= price;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="pixel-border-thick max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl neon-glow">CONFIRM PURCHASE</DialogTitle>
          <DialogDescription>
            Review the details before buying this NFT
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="pixel-border bg-muted p-4 space-y-3">
            <div>
              <div className="text-xs text-muted-foreground mb-1">NFT</div>
              <div className="font-bold">{nftName}</div>
            </div>
            
            <div className="border-t border-border pt-3">
              <div className="text-xs text-muted-foreground mb-1">Price</div>
              <div className="text-2xl font-bold text-primary">
                {price} {currency}
              </div>
            </div>

            <div className="border-t border-border pt-3">
              <div className="text-xs text-muted-foreground mb-1">Your Balance</div>
              <div className={`text-lg font-bold ${hasEnoughBalance ? 'text-foreground' : 'text-destructive'}`}>
                {userBalance.toFixed(6)} {currency}
              </div>
            </div>

            {hasEnoughBalance && (
              <div className="border-t border-border pt-3">
                <div className="text-xs text-muted-foreground mb-1">Balance After Purchase</div>
                <div className="text-lg font-bold">
                  {(userBalance - price).toFixed(6)} {currency}
                </div>
              </div>
            )}
          </div>

          {!hasEnoughBalance && (
            <Alert variant="destructive" className="pixel-border">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="text-xs">
                Insufficient {currency} balance. You need {(price - userBalance).toFixed(6)} more {currency} to complete this purchase.
              </AlertDescription>
            </Alert>
          )}

          <Alert className="pixel-border bg-accent/20 border-accent">
            <Wallet className="h-4 w-4" />
            <AlertDescription className="text-xs">
              You will send {price} {currency} to the escrow. Once verified, the NFT will be transferred to your wallet.
            </AlertDescription>
          </Alert>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isProcessing}
            className="pixel-border"
          >
            CANCEL
          </Button>
          <Button
            onClick={onConfirm}
            disabled={!hasEnoughBalance || isProcessing}
            className="pixel-border-thick gap-2"
          >
            {isProcessing ? (
              "PROCESSING..."
            ) : (
              <>
                CONFIRM PURCHASE
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
