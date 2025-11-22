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
import * as KeetaNet from "@keetanetwork/keetanet-client";
import * as bip39 from "bip39";

interface WalletDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const WalletDialog = ({ open, onOpenChange }: WalletDialogProps) => {
  const { connectWallet, disconnectWallet, publicKey, isConnected, balance, generateNewWallet, refreshBalance } = useWallet();
  const [importSeed, setImportSeed] = useState("");
  const [showSeed, setShowSeed] = useState(false);
  const [generatedSeed, setGeneratedSeed] = useState("");
  const [qrCode, setQrCode] = useState("");
  const [previewAddress, setPreviewAddress] = useState<string | null>(null);

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

  const handleExportConnectedWallet = () => {
    const storedSeed = localStorage.getItem("keetaWalletSeed");
    if (storedSeed) {
      navigator.clipboard.writeText(storedSeed);
      toast.success("Connected wallet phrase copied! Use this for ANCHOR_WALLET_SEED.");
    } else {
      toast.error("No seed found in localStorage");
    }
  };

  const handleDisconnect = () => {
    disconnectWallet();
    setGeneratedSeed("");
    onOpenChange(false);
  };

  const handlePreviewAddress = async () => {
    if (!importSeed.trim()) {
      setPreviewAddress(null);
      return;
    }

    try {
      let actualSeed = importSeed.trim();
      
      // Convert mnemonic to seed using Keeta's seedFromPassphrase (not bip39!)
      if (bip39.validateMnemonic(actualSeed)) {
        actualSeed = await KeetaNet.lib.Account.seedFromPassphrase(actualSeed, { asString: true }) as string;
      }

      // Create account from seed using secp256k1 at index 0
      const { AccountKeyAlgorithm } = KeetaNet.lib.Account;
      const account = KeetaNet.lib.Account.fromSeed(actualSeed, 0, AccountKeyAlgorithm.ECDSA_SECP256K1);
      const address = account.publicKeyString.toString();
      
      console.log('Derived with secp256k1 at index 0:', address);
      
      setPreviewAddress(address);
      toast.info("Address preview generated (secp256k1, index 0)");
    } catch (error) {
      console.error("Error previewing address:", error);
      setPreviewAddress("Error: Invalid seed format");
      toast.error("Invalid seed format");
    }
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
              <div className="flex items-center justify-between">
                <Label className="text-xs text-muted-foreground">BALANCE</Label>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-xs"
                  onClick={refreshBalance}
                >
                  REFRESH
                </Button>
              </div>
              <div className="text-2xl font-bold neon-glow">{balance || "0.000000"} KTA</div>
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
              variant="outline"
              className="w-full pixel-border text-xs bg-primary/10 border-primary/20"
              onClick={handleExportConnectedWallet}
            >
              <Copy className="w-3 h-3 mr-2" />
              COPY WALLET PHRASE (FOR ANCHOR_WALLET_SEED)
            </Button>

            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1 pixel-border text-xs"
                onClick={() => {
                  const walletData = {
                    seed: localStorage.getItem("keetaWalletSeed"),
                    publicKey: publicKey,
                    network: "mainnet"
                  };
                  const dataStr = JSON.stringify(walletData, null, 2);
                  const blob = new Blob([dataStr], { type: "application/json" });
                  const url = URL.createObjectURL(blob);
                  const link = document.createElement("a");
                  link.href = url;
                  link.download = `keeta-wallet-${publicKey?.substring(0, 8)}.json`;
                  link.click();
                  URL.revokeObjectURL(url);
                  toast.success("Wallet exported!");
                }}
              >
                EXPORT JSON
              </Button>
              <Button
                variant="destructive"
                className="flex-1 pixel-border text-xs"
                onClick={handleDisconnect}
              >
                DISCONNECT
              </Button>
            </div>
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
            Connect to Keeta Chain mainnet (secp256k1, index 0)
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
                GENERATE 24-WORD PHRASE
              </Button>
            ) : (
              <>
                <div className="space-y-2">
                  <Label className="text-xs text-destructive">SAVE YOUR 24-WORD RECOVERY PHRASE</Label>
                  <div className="pixel-border bg-muted p-3 space-y-2">
                    <div className={`text-xs font-mono ${showSeed ? '' : 'blur-sm select-none'}`}>
                      {generatedSeed}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="pixel-border flex-1 text-xs"
                        onClick={() => setShowSeed(!showSeed)}
                      >
                        {showSeed ? <><EyeOff className="w-3 h-3 mr-1" /> HIDE</> : <><Eye className="w-3 h-3 mr-1" /> SHOW</>}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="pixel-border flex-1 text-xs"
                        onClick={handleCopySeed}
                      >
                        <Copy className="w-3 h-3 mr-1" /> COPY
                      </Button>
                    </div>
                  </div>
                  <p className="text-xs text-destructive">
                    ⚠️ Write down these 24 words in order. You'll need them to recover your wallet!
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
              <Label className="text-xs">ENTER YOUR 24-WORD RECOVERY PHRASE</Label>
              <textarea
                placeholder="Enter your 24-word recovery phrase..."
                value={importSeed}
                onChange={(e) => {
                  setImportSeed(e.target.value);
                  setPreviewAddress(null); // Clear preview on change
                }}
                className="pixel-border bg-muted text-xs font-mono w-full min-h-[100px] p-3 rounded-md resize-none"
              />
              <p className="text-xs text-muted-foreground">
                Separate words with spaces. Old hex seeds also supported.
              </p>
            </div>

            <Button
              variant="outline"
              className="w-full pixel-border text-xs"
              onClick={handlePreviewAddress}
              disabled={!importSeed.trim()}
            >
              PREVIEW ADDRESS (DON'T CONNECT YET)
            </Button>

            {previewAddress && (
              <div className="pixel-border bg-muted p-3 space-y-2">
                <Label className="text-xs text-primary">DERIVED ADDRESS (secp256k1, INDEX 0):</Label>
                <div className="font-mono text-xs break-all bg-background p-2 rounded">
                  {previewAddress}
                </div>
                <p className="text-xs text-muted-foreground">
                  Compare this to the FX Anchor Status address on the swap page. They should match if using the same phrase.
                </p>
              </div>
            )}

            <Button
              className="w-full pixel-border bg-secondary hover:bg-secondary/80 text-xs"
              onClick={handleImportWallet}
              disabled={!importSeed.trim()}
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
