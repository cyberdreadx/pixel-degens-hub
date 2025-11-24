import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { useWallet } from "@/contexts/WalletContext";
import { getTokenAddresses } from "@/utils/keetaApi";
import ktaLogo from "@/assets/kta-logo.jpg";
import xrgeLogo from "@/assets/xrge-logo.webp";

interface AddLiquidityDialogProps {
  anchorAddress: string;
  anchorInfo: any;
  onSuccess?: () => void;
}

export function AddLiquidityDialog({ anchorAddress, anchorInfo, onSuccess }: AddLiquidityDialogProps) {
  const { sendTokens, balance, tokens, network, isConnected, refreshBalance } = useWallet();
  const [isOpen, setIsOpen] = useState(false);
  const [ktaAmount, setKtaAmount] = useState("");
  const [xrgeAmount, setXrgeAmount] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [matchRatio, setMatchRatio] = useState(false);

  const xrgeToken = tokens.find(t => t.symbol === 'XRGE');
  const xrgeBalance = xrgeToken?.balance || '0';
  
  // Refresh balances when dialog opens
  useEffect(() => {
    if (isOpen && isConnected) {
      refreshBalance();
    }
  }, [isOpen, isConnected, refreshBalance]);
  
  // Debug logging
  useEffect(() => {
    console.log('[AddLiquidityDialog] Wallet Connected:', isConnected);
    console.log('[AddLiquidityDialog] KTA Balance:', balance);
    console.log('[AddLiquidityDialog] XRGE Token:', xrgeToken);
    console.log('[AddLiquidityDialog] All Tokens:', tokens);
  }, [isConnected, balance, xrgeToken, tokens]);
  
  // Calculate pool ratio (XRGE per KTA)
  const poolRatio = anchorInfo ? 
    parseFloat(anchorInfo.xrgeBalance || '0') / parseFloat(anchorInfo.ktaBalance || '1') : 0;

  const handleKtaChange = (value: string) => {
    setKtaAmount(value);
    
    if (matchRatio && value && poolRatio > 0) {
      const ktaValue = parseFloat(value);
      if (!isNaN(ktaValue)) {
        const calculatedXrge = (ktaValue * poolRatio).toFixed(6);
        setXrgeAmount(calculatedXrge);
      }
    }
  };

  const handleXrgeChange = (value: string) => {
    setXrgeAmount(value);
    
    if (matchRatio && value && poolRatio > 0) {
      const xrgeValue = parseFloat(value);
      if (!isNaN(xrgeValue)) {
        const calculatedKta = (xrgeValue / poolRatio).toFixed(6);
        setKtaAmount(calculatedKta);
      }
    }
  };

  const handleMatchRatioToggle = (checked: boolean) => {
    setMatchRatio(checked);
    
    // If enabling and we have a KTA amount, calculate XRGE
    if (checked && ktaAmount && poolRatio > 0) {
      const ktaValue = parseFloat(ktaAmount);
      if (!isNaN(ktaValue)) {
        const calculatedXrge = (ktaValue * poolRatio).toFixed(6);
        setXrgeAmount(calculatedXrge);
      }
    }
  };

  const handleAddLiquidity = async () => {
    const ktaValue = parseFloat(ktaAmount);
    const xrgeValue = parseFloat(xrgeAmount);

    if (!ktaValue && !xrgeValue) {
      toast.error("Please enter at least one token amount");
      return;
    }

    if (ktaValue && ktaValue > parseFloat(balance || '0')) {
      toast.error(`Insufficient KTA balance. You have ${balance} KTA`);
      return;
    }

    if (xrgeValue && xrgeValue > parseFloat(xrgeBalance)) {
      toast.error(`Insufficient XRGE balance. You have ${xrgeBalance} XRGE`);
      return;
    }

    setIsLoading(true);
    try {
      const tokenAddresses = getTokenAddresses(network);

      // Send KTA if amount specified
      if (ktaValue > 0) {
        await sendTokens(anchorAddress, ktaAmount);
        toast.success(`Sent ${ktaAmount} KTA to liquidity pool`);
      }

      // Send XRGE if amount specified
      if (xrgeValue > 0) {
        await sendTokens(anchorAddress, xrgeAmount, tokenAddresses.XRGE);
        toast.success(`Sent ${xrgeAmount} XRGE to liquidity pool`);
      }

      // Reset form and close dialog
      setKtaAmount("");
      setXrgeAmount("");
      setIsOpen(false);

      // Call success callback
      if (onSuccess) {
        onSuccess();
      }

      toast.success("Liquidity added successfully!");
    } catch (error: any) {
      console.error("Failed to add liquidity:", error);
      toast.error(error.message || "Failed to add liquidity");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button 
          variant="default" 
          size="sm"
          className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
        >
          <Plus className="w-4 h-4" />
          Add Liquidity
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-foreground">Add Liquidity to Pool</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Add KTA and/or XRGE tokens to the liquidity pool to enable swaps.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          {!isConnected && (
            <div className="bg-destructive/10 border border-destructive/20 p-3 rounded-lg text-sm text-destructive">
              Please connect your wallet first to add liquidity.
            </div>
          )}
          
          {/* Match Pool Ratio Toggle */}
          <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
            <div className="space-y-0.5">
              <Label htmlFor="match-ratio" className="text-sm font-medium">
                Match Pool Ratio
              </Label>
              <p className="text-xs text-muted-foreground">
                Auto-calculate proportional amounts
              </p>
            </div>
            <Switch
              id="match-ratio"
              checked={matchRatio}
              onCheckedChange={handleMatchRatioToggle}
              disabled={isLoading}
            />
          </div>

          {matchRatio && poolRatio > 0 && (
            <div className="bg-primary/10 p-2 rounded text-xs text-primary">
              Current pool ratio: 1 KTA = {poolRatio.toFixed(6)} XRGE
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="kta-amount" className="text-sm text-muted-foreground">
              KTA Amount
            </Label>
            <div className="relative">
              <Input
                id="kta-amount"
                type="number"
                placeholder="0.0"
                value={ktaAmount}
                onChange={(e) => handleKtaChange(e.target.value)}
                className="pr-20"
                disabled={isLoading}
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                <img src={ktaLogo} alt="KTA" className="w-5 h-5 rounded-full" />
                <span className="text-sm font-medium">KTA</span>
              </div>
            </div>
            <div className="text-xs text-muted-foreground">
              Available: {balance || '0'} KTA
              {!balance && <span className="text-amber-500 ml-2">(Loading...)</span>}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="xrge-amount" className="text-sm text-muted-foreground">
              XRGE Amount
            </Label>
            <div className="relative">
              <Input
                id="xrge-amount"
                type="number"
                placeholder="0.0"
                value={xrgeAmount}
                onChange={(e) => handleXrgeChange(e.target.value)}
                className="pr-20"
                disabled={isLoading}
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                <img src={xrgeLogo} alt="XRGE" className="w-5 h-5 rounded-full" />
                <span className="text-sm font-medium">XRGE</span>
              </div>
            </div>
            <div className="text-xs text-muted-foreground">
              Available: {xrgeBalance} XRGE
              {xrgeBalance === '0' && tokens.length === 0 && <span className="text-amber-500 ml-2">(Loading...)</span>}
            </div>
          </div>

          <div className="bg-muted/50 p-3 rounded-lg">
            <p className="text-xs text-muted-foreground">
              <strong>Note:</strong> You can add KTA, XRGE, or both tokens to the liquidity pool. 
              Tokens will be sent to the anchor address: <span className="font-mono text-[10px] break-all">{anchorAddress}</span>
            </p>
          </div>

          <Button
            onClick={handleAddLiquidity}
            disabled={isLoading || (!ktaAmount && !xrgeAmount) || !isConnected}
            className="w-full"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Adding Liquidity...
              </>
            ) : !isConnected ? (
              "Connect Wallet First"
            ) : (
              "Add Liquidity"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
