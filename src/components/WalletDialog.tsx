import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { Copy, Eye, EyeOff, Wallet, QrCode as QrCodeIcon, AlertTriangle } from "lucide-react";
import { useWallet } from "@/contexts/WalletContext";
import { toast } from "sonner";
import { toDataURL } from "qrcode";

interface WalletDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const WalletDialog = ({ open, onOpenChange }: WalletDialogProps) => {
  const { connectWallet, disconnectWallet, publicKey, isConnected, balance } = useWallet();
  const [importSeed, setImportSeed] = useState("");
  const [showSeed, setShowSeed] = useState(false);
  const [generatedSeed, setGeneratedSeed] = useState("");
  const [qrCode, setQrCode] = useState("");

  useEffect(() => {
    if (publicKey && open) {
      generateQRCode();
    }
  }, [publicKey, open]);

  const generateQRCode = async () => {
    if (!publicKey) return;
    try {
      const qr = await toDataURL(publicKey);
      setQrCode(qr);
    } catch (error) {
      console.error("Error generating QR code:", error);
    }
  };

  const handleGenerateWallet = async () => {
    try {
      const { generateNewWallet } = useWallet();
      const newSeed = await generateNewWallet();
      setGeneratedSeed(newSeed);
      toast.success("Seed generated! Save it before connecting.");
    } catch (error) {
      console.error("Error generating wallet:", error);
    }
  };

  const handleConnectWithSeed = async () => {
    if (!generatedSeed) {
      toast.error("Please generate a seed first");
      return;
    }
    try {
      await connectWallet(generatedSeed);
      onOpenChange(false);
    } catch (error) {
      console.error("Error connecting wallet:", error);
    }
  };

  const handleImportWallet = async () => {
    if (!importSeed.trim()) {
      toast.error("Please enter a valid seed");
      return;
    }
    try {
      await connectWallet(importSeed);
      setImportSeed("");
      onOpenChange(false);
    } catch (error) {
      console.error("Error importing wallet:", error);
    }
  };

  const handleCopyAddress = () => {
    if (publicKey) {
      navigator.clipboard.writeText(publicKey);
      toast.success("Address copied!");
    }
  };

  const handleCopySeed = () => {
    if (generatedSeed) {
      navigator.clipboard.writeText(generatedSeed);
      toast.success("Seed copied!");
    }
  };

  const handleDisconnect = () => {
    disconnectWallet();
    setGeneratedSeed("");
    onOpenChange(false);
  };

  if (isConnected) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="pixel-border-thick bg-card max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl neon-glow flex items-center gap-2">
              <Wallet className="w-5 h-5" />
              WALLET CONNECTED
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="pixel-border bg-muted p-4 space-y-2">
              <Label className="text-xs text-muted-foreground">BALANCE</Label>
              <div className="text-2xl font-bold neon-glow">{balance || "0.0000"} KTA</div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs">YOUR ADDRESS</Label>
              <div className="flex gap-2">
                <Input
                  value={publicKey || ""}
                  readOnly
                  className="pixel-border bg-muted text-xs font-mono"
                />
                <Button
                  variant="outline"
                  size="sm"
                  className="pixel-border"
                  onClick={handleCopyAddress}
                >
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {qrCode && (
              <div className="flex flex-col items-center gap-2 p-4 pixel-border bg-muted">
                <Label className="text-xs text-muted-foreground flex items-center gap-2">
                  <QrCodeIcon className="w-4 h-4" />
                  SCAN TO RECEIVE
                </Label>
                <img src={qrCode} alt="Address QR Code" className="w-48 h-48" />
              </div>
            )}

            <Button
              variant="destructive"
              className="w-full pixel-border text-xs"
              onClick={handleDisconnect}
            >
              DISCONNECT WALLET
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="pixel-border-thick bg-card max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl neon-glow flex items-center gap-2">
            <Wallet className="w-5 h-5" />
            CONNECT WALLET
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Connect to Keeta Chain testnet
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="create" className="w-full">
          <TabsList className="grid w-full grid-cols-2 pixel-border bg-muted text-xs">
            <TabsTrigger value="create" className="text-xs">CREATE</TabsTrigger>
            <TabsTrigger value="import" className="text-xs">IMPORT</TabsTrigger>
          </TabsList>

          <TabsContent value="create" className="space-y-4">
            <div className="pixel-border bg-destructive/10 p-4 space-y-2">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-destructive flex-shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-xs font-bold text-destructive">SECURITY WARNING</p>
                  <p className="text-xs text-muted-foreground">
                    Your seed will be stored in browser localStorage. Never share it!
                  </p>
                </div>
              </div>
            </div>

            {!generatedSeed ? (
              <Button
                className="w-full pixel-border bg-primary hover:bg-primary/80 text-xs"
                onClick={handleGenerateWallet}
              >
                GENERATE NEW SEED
              </Button>
            ) : (
              <>
                <div className="space-y-2">
                  <Label className="text-xs text-destructive">SAVE YOUR SEED (IMPORTANT!)</Label>
                  <div className="flex gap-2">
                    <Input
                      type={showSeed ? "text" : "password"}
                      value={generatedSeed}
                      readOnly
                      className="pixel-border bg-muted text-xs font-mono"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      className="pixel-border"
                      onClick={() => setShowSeed(!showSeed)}
                    >
                      {showSeed ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="pixel-border"
                      onClick={handleCopySeed}
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>
                  <p className="text-xs text-destructive">
                    ⚠️ Copy and store this seed safely. You'll need it to recover your wallet!
                  </p>
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1 pixel-border text-xs"
                    onClick={() => {
                      setGeneratedSeed("");
                      setShowSeed(false);
                    }}
                  >
                    CANCEL
                  </Button>
                  <Button
                    className="flex-1 pixel-border bg-accent hover:bg-accent/80 text-xs"
                    onClick={handleConnectWithSeed}
                  >
                    I SAVED IT - CONNECT
                  </Button>
                </div>
              </>
            )}
          </TabsContent>

          <TabsContent value="import" className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs">ENTER YOUR SEED</Label>
              <Input
                type="password"
                placeholder="Enter your existing seed..."
                value={importSeed}
                onChange={(e) => setImportSeed(e.target.value)}
                className="pixel-border bg-muted text-xs font-mono"
              />
            </div>

            <Button
              className="w-full pixel-border bg-secondary hover:bg-secondary/80 text-xs"
              onClick={handleImportWallet}
            >
              IMPORT WALLET
            </Button>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export default WalletDialog;
