import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Copy, Eye, EyeOff, Wallet, QrCode as QrCodeIcon, AlertTriangle, Send } from "lucide-react";
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
  const { connectWallet, disconnectWallet, publicKey, isConnected, balance, tokens, generateNewWallet, refreshBalance, sendTokens } = useWallet();
  const [importSeed, setImportSeed] = useState("");
  const [showSeed, setShowSeed] = useState(false);
  const [generatedSeed, setGeneratedSeed] = useState("");
  const [qrCode, setQrCode] = useState("");
  const [previewAddress, setPreviewAddress] = useState<string | null>(null);
  const [sendTo, setSendTo] = useState("");
  const [sendAmount, setSendAmount] = useState("");
  const [selectedToken, setSelectedToken] = useState<string>("KTA");
  const [isSending, setIsSending] = useState(false);

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

  const handleExportSeedHex = async () => {
    const storedSeed = localStorage.getItem("keetaWalletSeed");
    if (storedSeed) {
      try {
        const seedHex = await KeetaNet.lib.Account.seedFromPassphrase(storedSeed, { asString: true });
        await navigator.clipboard.writeText(seedHex);
        toast.success("Seed HEX copied! Use this DIRECTLY in backend edge functions (no mnemonic conversion)");
      } catch (error) {
        console.error("Failed to derive seed hex:", error);
        toast.error("Failed to derive seed hex");
      }
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
        <DialogContent className="pixel-border-thick bg-gradient-to-b from-card to-card/80 max-w-[95vw] sm:max-w-lg max-h-[90vh] overflow-y-auto overflow-x-hidden border-4 border-primary shadow-[0_0_30px_rgba(0,255,255,0.3)] p-4 sm:p-6">
          <DialogHeader className="space-y-2 sm:space-y-3 pb-3 sm:pb-4 border-b-2 border-primary/30">
            <DialogTitle className="text-xl sm:text-2xl neon-glow flex items-center gap-2 sm:gap-3">
              <div className="w-8 h-8 sm:w-10 sm:h-10 bg-primary pixel-border-thick flex items-center justify-center shrink-0">
                <Wallet className="w-4 h-4 sm:w-5 sm:h-5 text-background" />
              </div>
              <span className="truncate">WALLET ACTIVE</span>
            </DialogTitle>
            <DialogDescription className="text-[10px] sm:text-xs text-primary/80 font-mono truncate">
              KEETA MAINNET • SECP256K1 • INDEX 0
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 sm:space-y-5 pt-3 sm:pt-4 w-full overflow-x-hidden">
            {/* Balance Section */}
            <div className="pixel-border-thick bg-gradient-to-br from-primary/5 to-primary/10 p-4 sm:p-5 space-y-2 sm:space-y-3 relative overflow-hidden w-full max-w-full">
              <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl -z-10" />
              <div className="flex items-center justify-between gap-2 w-full">
                <Label className="text-[11px] sm:text-[10px] tracking-wider text-primary font-bold truncate">YOUR BALANCES</Label>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 sm:h-7 px-2 sm:px-2 text-[11px] sm:text-[10px] hover:bg-primary/20 pixel-border min-w-[80px] shrink-0"
                  onClick={refreshBalance}
                >
                  ↻ REFRESH
                </Button>
              </div>
              <div className="space-y-2 sm:space-y-2.5 w-full overflow-hidden">
                <div className="flex items-baseline gap-2 w-full overflow-hidden">
                  <div className="text-2xl sm:text-3xl font-bold neon-glow leading-none truncate">{balance || "0.000000"}</div>
                  <div className="text-xs sm:text-sm text-primary/70 shrink-0">KTA</div>
                </div>
                {tokens.map((token) => (
                  <div key={token.address} className="flex items-baseline gap-2 pl-2 border-l-2 border-accent/50 w-full overflow-hidden">
                    <div className="text-lg sm:text-xl font-bold text-accent leading-none truncate">
                      {token.balance}
                    </div>
                    <div className="text-[11px] sm:text-xs text-accent/70 shrink-0">{token.symbol}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Address Section */}
            <div className="space-y-2 sm:space-y-3 w-full max-w-full overflow-hidden">
              <Label className="text-[11px] sm:text-[10px] tracking-wider text-muted-foreground font-bold truncate">YOUR ADDRESS</Label>
              <div className="flex gap-2 w-full max-w-full">
                <Input
                  value={publicKey || ""}
                  readOnly
                  className="pixel-border bg-muted/50 text-[11px] sm:text-[10px] font-mono border-2 border-muted hover:border-primary/50 transition-colors truncate flex-1 min-w-0"
                />
                <Button
                  variant="outline"
                  size="sm"
                  className="pixel-border-thick hover:bg-primary/20 hover:border-primary transition-all min-w-[44px] w-[44px] h-10 shrink-0"
                  onClick={handleCopyAddress}
                >
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Send Tokens Section */}
            <div className="pixel-border-thick bg-gradient-to-br from-accent/5 to-accent/10 p-4 sm:p-5 space-y-3 sm:space-y-4 relative overflow-hidden w-full max-w-full">
              <div className="absolute top-0 left-0 w-32 h-32 bg-accent/5 rounded-full blur-3xl -z-10" />
              <Label className="text-[11px] sm:text-[10px] tracking-wider text-accent font-bold flex items-center gap-2 truncate">
                <Send className="w-4 h-4 shrink-0" />
                <span className="truncate">SEND TOKENS</span>
              </Label>
              
              <div className="space-y-3 w-full max-w-full overflow-hidden">
                <div className="space-y-2 w-full max-w-full overflow-hidden">
                  <Label className="text-[10px] sm:text-[9px] text-muted-foreground truncate">SELECT TOKEN</Label>
                  <Select value={selectedToken} onValueChange={setSelectedToken}>
                    <SelectTrigger className="pixel-border bg-background/50 border-2 text-xs sm:text-xs h-11 sm:h-10 w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="pixel-border bg-background z-50 max-w-[90vw]">
                      <SelectItem value="KTA" className="text-xs">KTA (Balance: {balance || "0.000000"})</SelectItem>
                      {tokens.map((token) => (
                        <SelectItem key={token.address} value={token.address} className="text-xs">
                          {token.symbol} (Balance: {token.balance})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2 w-full max-w-full overflow-hidden">
                  <Label className="text-[10px] sm:text-[9px] text-muted-foreground truncate">RECIPIENT ADDRESS</Label>
                  <Input
                    placeholder="keeta_..."
                    value={sendTo}
                    onChange={(e) => setSendTo(e.target.value)}
                    className="pixel-border bg-background/50 border-2 text-[11px] sm:text-[10px] font-mono h-11 sm:h-10 w-full"
                  />
                </div>

                <div className="space-y-2 w-full max-w-full overflow-hidden">
                  <Label className="text-[10px] sm:text-[9px] text-muted-foreground truncate">AMOUNT</Label>
                  <Input
                    type="number"
                    placeholder="0.000000"
                    value={sendAmount}
                    onChange={(e) => setSendAmount(e.target.value)}
                    className="pixel-border bg-background/50 border-2 text-[11px] sm:text-[10px] h-11 sm:h-10 w-full"
                    step="0.000001"
                  />
                </div>

                <Button
                  className="w-full pixel-border-thick bg-gradient-to-r from-accent to-accent/80 hover:from-accent/90 hover:to-accent text-xs sm:text-xs h-12 sm:h-11 neon-glow-secondary transition-all disabled:opacity-50"
                  onClick={async () => {
                    if (!sendTo || !sendAmount) {
                      toast.error("Please fill in all fields");
                      return;
                    }
                    if (!sendTo.startsWith("keeta_")) {
                      toast.error("Invalid Keeta address");
                      return;
                    }
                    setIsSending(true);
                    try {
                      const tokenAddress = selectedToken === "KTA" ? undefined : selectedToken;
                      await sendTokens(sendTo, sendAmount, tokenAddress);
                      setSendTo("");
                      setSendAmount("");
                      toast.success("Tokens sent successfully!");
                    } catch (error) {
                      console.error("Send error:", error);
                    } finally {
                      setIsSending(false);
                    }
                  }}
                  disabled={isSending}
                >
                  {isSending ? "⏳ SENDING..." : "🚀 SEND TOKENS"}
                </Button>
              </div>
            </div>

            {/* QR Code Section */}
            {qrCode && (
              <div className="pixel-border-thick bg-background p-4 sm:p-5 space-y-2 sm:space-y-3">
                <Label className="text-[11px] sm:text-[10px] tracking-wider text-primary font-bold flex items-center gap-2">
                  <QrCodeIcon className="w-4 h-4" />
                  RECEIVE FUNDS
                </Label>
                <div className="flex justify-center p-3 sm:p-4 bg-white rounded-lg">
                  <img src={qrCode} alt="Address QR Code" className="w-32 h-32 sm:w-40 sm:h-40" />
                </div>
                <p className="text-[10px] sm:text-[9px] text-center text-muted-foreground">
                  Scan this QR code to receive KTA or tokens
                </p>
              </div>
            )}

            {/* Export Options */}
            <div className="space-y-2 pt-3 border-t-2 border-muted/50 w-full max-w-full overflow-hidden">
              <Label className="text-[11px] sm:text-[10px] tracking-wider text-muted-foreground font-bold truncate">EXPORT OPTIONS</Label>
              
              <Button
                variant="outline"
                className="w-full pixel-border-thick text-xs sm:text-xs bg-primary/5 hover:bg-primary/10 border-primary/30 hover:border-primary transition-all h-11 sm:h-10"
                onClick={handleExportConnectedWallet}
              >
                <Copy className="w-3 h-3 mr-2" />
                COPY MNEMONIC PHRASE
              </Button>

              <Button
                variant="outline"
                className="w-full pixel-border-thick text-xs sm:text-xs bg-accent/5 hover:bg-accent/10 border-accent/30 hover:border-accent transition-all h-11 sm:h-10"
                onClick={handleExportSeedHex}
              >
                <Copy className="w-3 h-3 mr-2" />
                COPY SEED HEX (FOR BACKEND)
              </Button>

              <Button
                variant="outline"
                className="w-full pixel-border text-xs sm:text-xs hover:bg-muted/50 h-11 sm:h-10"
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
                💾 EXPORT AS JSON
              </Button>
            </div>

            {/* Disconnect Button */}
            <Button
              variant="destructive"
              className="w-full pixel-border-thick text-xs sm:text-xs bg-destructive/80 hover:bg-destructive transition-all h-12 sm:h-11"
              onClick={handleDisconnect}
            >
              🔌 DISCONNECT WALLET
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="pixel-border-thick bg-gradient-to-b from-card to-card/80 max-w-[95vw] sm:max-w-lg max-h-[90vh] overflow-y-auto border-4 border-primary shadow-[0_0_30px_rgba(0,255,255,0.3)] p-4 sm:p-6">
        <DialogHeader className="space-y-2 sm:space-y-3 pb-3 sm:pb-4 border-b-2 border-primary/30">
          <DialogTitle className="text-xl sm:text-2xl neon-glow flex items-center gap-2 sm:gap-3">
            <div className="w-8 h-8 sm:w-10 sm:h-10 bg-primary pixel-border-thick flex items-center justify-center">
              <Wallet className="w-4 h-4 sm:w-5 sm:h-5 text-background" />
            </div>
            CONNECT WALLET
          </DialogTitle>
          <DialogDescription className="text-[10px] sm:text-xs text-primary/80 font-mono">
            KEETA MAINNET • SECP256K1 • INDEX 0
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="create" className="w-full pt-3 sm:pt-4">
          <TabsList className="grid w-full grid-cols-2 pixel-border-thick bg-muted/50 text-xs p-1 gap-1 h-12 sm:h-11">
            <TabsTrigger 
              value="create" 
              className="text-xs sm:text-xs pixel-border data-[state=active]:bg-primary data-[state=active]:text-background data-[state=active]:neon-glow transition-all"
            >
              🆕 CREATE
            </TabsTrigger>
            <TabsTrigger 
              value="import" 
              className="text-xs sm:text-xs pixel-border data-[state=active]:bg-secondary data-[state=active]:text-background data-[state=active]:neon-glow-secondary transition-all"
            >
              📥 IMPORT
            </TabsTrigger>
          </TabsList>

          <TabsContent value="create" className="space-y-4 sm:space-y-5 mt-4 sm:mt-6">
            {/* Security Warning */}
            <div className="pixel-border-thick bg-destructive/10 border-2 border-destructive/30 p-3 sm:p-4 space-y-2 sm:space-y-2.5">
              <div className="flex items-start gap-2 sm:gap-3">
                <AlertTriangle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
                <div className="space-y-1 sm:space-y-1.5">
                  <p className="text-xs sm:text-xs font-bold text-destructive tracking-wider">⚠️ SECURITY ALERT</p>
                  <p className="text-[11px] sm:text-[10px] text-muted-foreground leading-relaxed">
                    Your seed phrase will be stored in browser localStorage. Never share it with anyone. Write it down offline and keep it safe.
                  </p>
                </div>
              </div>
            </div>

            {!generatedSeed ? (
              <Button
                className="w-full pixel-border-thick bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary text-xs sm:text-xs h-12 sm:h-12 neon-glow transition-all"
                onClick={handleGenerateWallet}
              >
                ✨ GENERATE 24-WORD PHRASE
              </Button>
            ) : (
              <div className="space-y-4 sm:space-y-5">
                <div className="space-y-2 sm:space-y-3">
                  <Label className="text-xs sm:text-xs text-destructive font-bold tracking-wider flex items-center gap-2">
                    <span className="w-2 h-2 bg-destructive rounded-full animate-pulse" />
                    SAVE YOUR RECOVERY PHRASE
                  </Label>
                  <div className="pixel-border-thick bg-gradient-to-br from-background to-muted/30 p-3 sm:p-4 space-y-2 sm:space-y-3">
                    <div className={`text-[11px] sm:text-[10px] font-mono leading-relaxed ${showSeed ? '' : 'blur-md select-none pointer-events-none'} transition-all break-all`}>
                      {generatedSeed}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="pixel-border flex-1 text-[10px] sm:text-[10px] hover:bg-primary/10 hover:border-primary transition-all h-10"
                        onClick={() => setShowSeed(!showSeed)}
                      >
                        {showSeed ? (
                          <><EyeOff className="w-3 h-3 mr-1.5" /> HIDE</>
                        ) : (
                          <><Eye className="w-3 h-3 mr-1.5" /> SHOW</>
                        )}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="pixel-border flex-1 text-[10px] sm:text-[10px] hover:bg-primary/10 hover:border-primary transition-all h-10"
                        onClick={handleCopySeed}
                      >
                        <Copy className="w-3 h-3 mr-1.5" /> COPY
                      </Button>
                    </div>
                  </div>
                  <div className="pixel-border bg-destructive/5 border-destructive/20 p-3">
                    <p className="text-[11px] sm:text-[10px] text-destructive leading-relaxed">
                      ⚠️ Write down these 24 words in exact order. Store them safely offline. You'll need them to recover your wallet. No one can help if you lose them!
                    </p>
                  </div>
                </div>

                <div className="flex gap-2 sm:gap-3 pt-2">
                  <Button
                    variant="outline"
                    className="flex-1 pixel-border-thick text-xs sm:text-xs hover:bg-muted/50 transition-all h-11 sm:h-10"
                    onClick={() => {
                      setGeneratedSeed("");
                      setShowSeed(false);
                    }}
                  >
                    ❌ CANCEL
                  </Button>
                  <Button
                    className="flex-1 pixel-border-thick bg-gradient-to-r from-accent to-accent/80 hover:from-accent/90 hover:to-accent text-xs sm:text-xs transition-all h-11 sm:h-10"
                    onClick={handleConnectWithSeed}
                  >
                    ✅ I SAVED IT
                  </Button>
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="import" className="space-y-4 sm:space-y-5 mt-4 sm:mt-6 overflow-x-hidden">
            <div className="space-y-2 sm:space-y-3 w-full">
              <Label className="text-xs sm:text-xs font-bold tracking-wider break-words">ENTER YOUR 24-WORD PHRASE</Label>
              <textarea
                placeholder="word1 word2 word3 ... word24"
                value={importSeed}
                onChange={(e) => {
                  setImportSeed(e.target.value);
                  setPreviewAddress(null);
                }}
                className="pixel-border-thick bg-muted/30 text-[11px] sm:text-xs font-mono w-full max-w-full min-h-[120px] p-3 sm:p-4 rounded-md resize-none border-2 border-muted hover:border-primary/50 focus:border-primary transition-colors box-border"
              />
              <p className="text-[11px] sm:text-[10px] text-muted-foreground leading-relaxed break-words">
                💡 Separate words with spaces. Old 64-character hex seeds are also supported.
              </p>
            </div>

            <Button
              variant="outline"
              className="w-full max-w-full pixel-border-thick text-[10px] sm:text-xs hover:bg-primary/10 hover:border-primary transition-all h-12 sm:h-11 whitespace-normal leading-tight py-2"
              onClick={handlePreviewAddress}
              disabled={!importSeed.trim()}
            >
              👁️ PREVIEW ADDRESS
            </Button>

            {previewAddress && (
              <div className="pixel-border-thick bg-gradient-to-br from-primary/5 to-primary/10 border-2 border-primary/30 p-3 sm:p-4 space-y-2 sm:space-y-3 w-full overflow-hidden">
                <Label className="text-[11px] sm:text-[10px] tracking-wider text-primary font-bold flex items-center gap-2 break-words">
                  <span className="w-2 h-2 bg-primary rounded-full flex-shrink-0" />
                  DERIVED ADDRESS
                </Label>
                <div className="font-mono text-[11px] sm:text-[10px] break-all bg-background/50 p-2 sm:p-3 rounded pixel-border leading-relaxed overflow-wrap-anywhere w-full">
                  {previewAddress}
                </div>
                <p className="text-[10px] sm:text-[9px] text-muted-foreground leading-relaxed break-words">
                  Compare this with FX Anchor Status on swap page.
                </p>
              </div>
            )}

            <Button
              className="w-full max-w-full pixel-border-thick bg-gradient-to-r from-secondary to-secondary/80 hover:from-secondary/90 hover:to-secondary text-xs sm:text-xs h-12 sm:h-12 neon-glow-secondary transition-all"
              onClick={handleImportWallet}
              disabled={!importSeed.trim()}
            >
              📥 IMPORT WALLET
            </Button>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export default WalletDialog;
