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
import { useMarketData } from "@/hooks/useMarketData";

interface WalletDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const WalletDialog = ({ open, onOpenChange }: WalletDialogProps) => {
  const { connectWallet, connectYodaWallet, disconnectWallet, publicKey, isConnected, balance, tokens, generateNewWallet, refreshBalance, sendTokens, network, walletType, isYodaInstalled } = useWallet();
  const { getUsdValue, formatUsd } = useMarketData();
  const [importSeed, setImportSeed] = useState("");
  const [showSeed, setShowSeed] = useState(false);
  const [generatedSeed, setGeneratedSeed] = useState("");
  const [qrCode, setQrCode] = useState("");
  const [previewAddress, setPreviewAddress] = useState<string | null>(null);
  const [sendTo, setSendTo] = useState("");
  const [sendAmount, setSendAmount] = useState("");
  const [selectedToken, setSelectedToken] = useState<string>("KTA");
  const [isSending, setIsSending] = useState(false);
  
  // XRGE token address for filtering
  const XRGE_TESTNET = 'keeta_annmywuiz2pourjmkyuaznxyg6cmv356dda3hpuiqfpwry5m2tlybothdb33s';
  const XRGE_MAINNET = 'keeta_aolgxwrcepccr5ycg5ctp3ezhhp6vnpitzm7grymm63hzbaqk6lcsbtccgur6';
  const XRGE_ADDRESS = network === 'main' ? XRGE_MAINNET : XRGE_TESTNET;
  
  // Filter tokens to only show XRGE and NFTs
  const filteredTokens = tokens.filter(token => {
    const isXRGE = token.address === XRGE_ADDRESS;
    const isNFT = token.isNFT;
    return isXRGE || isNFT;
  });

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
        <DialogContent className="pixel-border-thick bg-gradient-to-b from-card to-card/80 w-[calc(100vw-2rem)] sm:w-[calc(100vw-4rem)] md:max-w-2xl lg:max-w-3xl h-[calc(100vh-2rem)] sm:h-[calc(100vh-4rem)] md:max-h-[85vh] flex flex-col border-4 border-primary shadow-[0_0_30px_rgba(0,255,255,0.3)] p-0 gap-0">
          <DialogHeader className="flex-none space-y-1.5 sm:space-y-2 p-3 sm:p-4 md:p-5 pb-2 sm:pb-3 border-b-2 border-primary/30">
            <DialogTitle className="text-lg sm:text-xl md:text-2xl lg:text-3xl neon-glow flex items-center gap-2 font-bold">
              <div className={`w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 pixel-border-thick flex items-center justify-center shrink-0 ${
                walletType === 'yoda' ? 'bg-purple-600' : 'bg-primary'
              }`}>
                <Wallet className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6 text-background" />
              </div>
              <span className="truncate text-sm sm:text-base md:text-lg lg:text-xl">
                {walletType === 'yoda' ? '🟣 YODA' : 'WALLET'}
              </span>
            </DialogTitle>
            <DialogDescription className="text-[9px] sm:text-[10px] md:text-xs text-primary font-mono truncate font-semibold">
              {network === "main" ? "MAINNET" : "TESTNET"} • {walletType === 'yoda' ? 'YODA' : 'INDEX 0'}
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto overflow-x-hidden px-3 sm:px-4 md:px-5 pb-3 sm:pb-4 md:pb-5 space-y-3 sm:space-y-4">
            {/* Network Indicator - Always Visible */}
            <div className={`pixel-border-thick p-3 sm:p-4 space-y-2 ${
              walletType === 'yoda' ? 'bg-gradient-to-br from-purple-500/10 to-purple-600/5' : 'bg-gradient-to-br from-blue-500/10 to-blue-600/5'
            }`}>
              <div className="flex items-center justify-between gap-2">
                <div className="space-y-1">
                  <div className="text-xs sm:text-sm font-bold text-foreground/80 uppercase tracking-wider">
                    Network Status
                  </div>
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${network === 'main' ? 'bg-green-500' : 'bg-yellow-500'} animate-pulse`} />
                    <span className="text-sm sm:text-base font-bold">
                      Site: <span className={network === 'main' ? 'text-green-400' : 'text-yellow-400'}>
                        {network === 'main' ? 'MAINNET' : 'TESTNET'}
                      </span>
                    </span>
                  </div>
                  {walletType === 'yoda' && typeof window !== 'undefined' && (window as any).yoda && (
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
                      <span className="text-sm sm:text-base font-bold">
                        Yoda: <span className="text-purple-400">
                          {((window as any).yoda.chainId || '').includes('main') || (window as any).yoda.chainId === 'keeta-main' ? 'MAINNET' : 'TESTNET'}
                        </span>
                      </span>
                    </div>
                  )}
                </div>
              </div>
              
              {/* Network Mismatch Warning */}
              {walletType === 'yoda' && typeof window !== 'undefined' && (window as any).yoda && (() => {
                const yodaChainId = (window as any).yoda.chainId || '';
                const yodaIsMainnet = yodaChainId.includes('main') || yodaChainId === 'keeta-main';
                const siteIsMainnet = network === 'main';
                const mismatch = yodaIsMainnet !== siteIsMainnet;
                
                return mismatch ? (
                  <div className="pixel-border bg-red-500/20 border-red-500/50 p-2 sm:p-3 space-y-1.5">
                    <div className="flex items-center gap-2 text-red-400">
                      <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
                      <span className="text-xs sm:text-sm font-bold uppercase">Network Mismatch!</span>
                    </div>
                    <p className="text-[10px] sm:text-xs text-red-300 leading-tight">
                      Your Yoda wallet is on <strong>{yodaIsMainnet ? 'MAINNET' : 'TESTNET'}</strong> but the site is set to <strong>{siteIsMainnet ? 'MAINNET' : 'TESTNET'}</strong>.
                    </p>
                    <p className="text-[10px] sm:text-xs text-red-200 leading-tight font-semibold">
                      → Switch networks in your Yoda wallet extension to match the site!
                    </p>
                  </div>
                ) : (
                  <div className="pixel-border bg-green-500/20 border-green-500/50 p-2 text-center">
                    <span className="text-[10px] sm:text-xs text-green-300 font-bold">✓ Networks Match</span>
                  </div>
                );
              })()}
            </div>

            {/* Balance Section */}
            <div className="pixel-border-thick bg-gradient-to-br from-primary/5 to-primary/10 p-3 sm:p-4 md:p-5 space-y-2 sm:space-y-3 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-24 h-24 sm:w-32 sm:h-32 bg-primary/5 rounded-full blur-3xl -z-10" />
              <div className="flex items-center justify-between gap-2">
                <Label className="text-xs sm:text-sm md:text-base tracking-wider text-primary font-bold truncate">BALANCES</Label>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2 sm:px-3 text-[10px] sm:text-xs hover:bg-primary/20 pixel-border shrink-0 font-semibold"
                  onClick={refreshBalance}
                >
                  ↻
                </Button>
              </div>
              <div className="space-y-2 sm:space-y-3">
                <div className="space-y-1">
                  <div className="flex items-baseline gap-1.5 sm:gap-2">
                    <div className="text-2xl sm:text-3xl md:text-4xl font-bold neon-glow leading-none truncate">{balance || "0.000000"}</div>
                    <div className="text-sm sm:text-base md:text-lg text-primary font-semibold shrink-0">KTA</div>
                  </div>
                  <div className="text-xs sm:text-sm md:text-base text-foreground/80 font-medium">
                    {formatUsd(getUsdValue(parseFloat(balance || '0'), 'KTA'))}
                  </div>
                </div>
                {filteredTokens.map((token) => (
                  <div key={token.address} className="space-y-1 pl-2 sm:pl-3 border-l-2 border-accent/50">
                    <div className="flex items-baseline gap-1.5 sm:gap-2">
                      <div className="text-xl sm:text-2xl md:text-3xl font-bold text-accent leading-none truncate">
                        {token.balance}
                      </div>
                      <div className="text-xs sm:text-sm md:text-base text-accent font-semibold shrink-0">{token.symbol}</div>
                    </div>
                    <div className="text-xs sm:text-sm md:text-base text-foreground/80 font-medium">
                      {formatUsd(getUsdValue(parseFloat(token.balance || '0'), token.symbol as 'KTA' | 'XRGE'))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Address Section */}
            <div className="space-y-1.5 sm:space-y-2">
              <Label className="text-xs sm:text-sm md:text-base tracking-wider text-foreground font-bold truncate">ADDRESS</Label>
              <div className="flex gap-2">
                <Input
                  value={publicKey || ""}
                  readOnly
                  className="pixel-border bg-muted/50 text-[10px] sm:text-xs md:text-sm font-mono border-2 border-muted hover:border-primary/50 transition-colors truncate flex-1 min-w-0 h-9 sm:h-10 md:h-11"
                />
                <Button
                  variant="outline"
                  size="sm"
                  className="pixel-border-thick hover:bg-primary/20 hover:border-primary transition-all w-9 sm:w-10 md:w-12 h-9 sm:h-10 md:h-11 p-0 shrink-0"
                  onClick={handleCopyAddress}
                >
                  <Copy className="w-3.5 h-3.5 sm:w-4 sm:h-4 md:w-5 md:h-5" />
                </Button>
              </div>
            </div>

            {/* Send Tokens Section */}
            <div className="pixel-border-thick bg-gradient-to-br from-accent/5 to-accent/10 p-3 sm:p-4 md:p-5 space-y-2 sm:space-y-3 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-24 h-24 sm:w-32 sm:h-32 bg-accent/5 rounded-full blur-3xl -z-10" />
              <Label className="text-xs sm:text-sm md:text-base tracking-wider text-accent font-bold flex items-center gap-1.5 sm:gap-2">
                <Send className="w-3.5 h-3.5 sm:w-4 sm:h-4 md:w-5 md:h-5 shrink-0" />
                <span className="truncate">SEND</span>
              </Label>
              
              <div className="space-y-2 sm:space-y-2.5">
                <div className="space-y-1 sm:space-y-1.5">
                  <Label className="text-[10px] sm:text-xs md:text-sm text-foreground font-semibold truncate">TOKEN</Label>
                  <Select value={selectedToken} onValueChange={setSelectedToken}>
                    <SelectTrigger className="pixel-border bg-background/50 border-2 text-xs sm:text-sm md:text-base h-9 sm:h-10 md:h-11 font-medium">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="pixel-border bg-background z-50 max-w-[90vw]">
                      <SelectItem value="KTA" className="text-xs sm:text-sm">KTA ({balance || "0.000000"})</SelectItem>
                      {filteredTokens.map((token) => (
                        <SelectItem key={token.address} value={token.address} className="text-xs sm:text-sm">
                          {token.symbol} ({token.balance})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div className="space-y-1 sm:space-y-1.5">
                    <Label className="text-[10px] sm:text-xs md:text-sm text-foreground font-semibold truncate">AMOUNT</Label>
                    <Input
                      type="number"
                      placeholder="0.000000"
                      value={sendAmount}
                      onChange={(e) => setSendAmount(e.target.value)}
                      className="pixel-border bg-background/50 border-2 text-xs sm:text-sm md:text-base h-9 sm:h-10 md:h-11 font-medium"
                      step="0.000001"
                    />
                  </div>

                  <div className="space-y-1 sm:space-y-1.5 sm:col-span-2">
                    <Label className="text-[10px] sm:text-xs md:text-sm text-foreground font-semibold truncate">TO</Label>
                    <Input
                      placeholder="keeta_..."
                      value={sendTo}
                      onChange={(e) => setSendTo(e.target.value)}
                      className="pixel-border bg-background/50 border-2 text-[10px] sm:text-xs md:text-sm font-mono h-9 sm:h-10 md:h-11"
                    />
                  </div>
                </div>

                <Button
                  className="w-full pixel-border-thick bg-gradient-to-r from-accent to-accent/80 hover:from-accent/90 hover:to-accent text-xs sm:text-sm md:text-base h-9 sm:h-10 md:h-11 neon-glow-secondary transition-all disabled:opacity-50 font-bold"
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
                  {isSending ? "⏳" : "🚀"} {isSending ? "SENDING..." : "SEND"}
                </Button>
              </div>
            </div>

            {/* QR Code Section */}
            {qrCode && (
              <details className="pixel-border-thick bg-background group">
                <summary className="cursor-pointer p-2 sm:p-3 md:p-4 flex items-center justify-between hover:bg-muted/50 transition-colors">
                  <Label className="text-[10px] sm:text-xs md:text-sm tracking-wider text-primary font-bold flex items-center gap-1.5 sm:gap-2 cursor-pointer">
                    <QrCodeIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    RECEIVE QR
                  </Label>
                  <span className="text-primary group-open:rotate-180 transition-transform">▼</span>
                </summary>
                <div className="p-2 sm:p-3 md:p-4 pt-0 space-y-2">
                  <div className="flex justify-center p-2 sm:p-3 bg-white rounded-lg">
                    <img src={qrCode} alt="Address QR Code" className="w-28 h-28 sm:w-32 sm:h-32 md:w-40 md:h-40" />
                  </div>
                  <p className="text-[9px] sm:text-[10px] text-center text-muted-foreground">
                    Scan to receive
                  </p>
                </div>
              </details>
            )}

            {/* Export Options - Only show for seed wallets */}
            {walletType === 'seed' && (
              <details className="pixel-border-thick bg-muted/10 group">
                <summary className="cursor-pointer p-2 sm:p-3 md:p-4 flex items-center justify-between hover:bg-muted/30 transition-colors">
                  <Label className="text-[10px] sm:text-xs md:text-sm tracking-wider text-muted-foreground font-bold cursor-pointer">EXPORT</Label>
                  <span className="text-muted-foreground group-open:rotate-180 transition-transform">▼</span>
                </summary>
                <div className="p-2 sm:p-3 md:p-4 pt-0 space-y-2">
                  <Button
                    variant="outline"
                    className="w-full pixel-border-thick text-[10px] sm:text-xs md:text-sm bg-primary/5 hover:bg-primary/10 border-primary/30 hover:border-primary transition-all h-8 sm:h-9 md:h-10"
                    onClick={handleExportConnectedWallet}
                  >
                    <Copy className="w-3 h-3 mr-1.5" />
                    PHRASE
                  </Button>

                  <Button
                    variant="outline"
                    className="w-full pixel-border-thick text-[10px] sm:text-xs md:text-sm bg-accent/5 hover:bg-accent/10 border-accent/30 hover:border-accent transition-all h-8 sm:h-9 md:h-10"
                    onClick={handleExportSeedHex}
                  >
                    <Copy className="w-3 h-3 mr-1.5" />
                    HEX
                  </Button>

                  <Button
                    variant="outline"
                    className="w-full pixel-border text-[10px] sm:text-xs md:text-sm hover:bg-muted/50 h-8 sm:h-9 md:h-10"
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
                    💾 JSON
                  </Button>
                </div>
              </details>
            )}

            {/* Yoda Wallet Info */}
            {walletType === 'yoda' && (
              <div className="pixel-border-thick bg-purple-500/10 border-2 border-purple-500/30 p-2 sm:p-3 md:p-4">
                <div className="flex items-start gap-1.5 sm:gap-2">
                  <Wallet className="w-4 h-4 sm:w-5 sm:h-5 text-purple-400 flex-shrink-0 mt-0.5" />
                  <div className="space-y-0.5 sm:space-y-1">
                    <p className="text-[10px] sm:text-xs md:text-sm font-bold text-purple-400 tracking-wider">🟣 YODA</p>
                    <p className="text-[9px] sm:text-[10px] md:text-xs text-muted-foreground leading-relaxed">
                      Keys managed by extension
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer with Disconnect Button */}
          <div className="flex-none border-t-2 border-muted/30 p-3 sm:p-4 md:p-5 bg-card/50">
            <Button
              variant="destructive"
              className="w-full pixel-border-thick text-xs sm:text-sm md:text-base bg-destructive/80 hover:bg-destructive transition-all h-9 sm:h-10 md:h-11 font-bold"
              onClick={handleDisconnect}
            >
              🔌 DISCONNECT
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="pixel-border-thick bg-gradient-to-b from-card to-card/80 w-[calc(100vw-2rem)] sm:w-[calc(100vw-4rem)] md:max-w-2xl lg:max-w-3xl h-[calc(100vh-2rem)] sm:h-[calc(100vh-4rem)] md:max-h-[85vh] flex flex-col border-4 border-primary shadow-[0_0_30px_rgba(0,255,255,0.3)] p-0 gap-0">
        <DialogHeader className="flex-none space-y-1.5 sm:space-y-2 p-3 sm:p-4 md:p-5 pb-2 sm:pb-3 border-b-2 border-primary/30">
          <DialogTitle className="text-lg sm:text-xl md:text-2xl lg:text-3xl neon-glow flex items-center gap-2 font-bold">
            <div className="w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 bg-primary pixel-border-thick flex items-center justify-center shrink-0">
              <Wallet className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6 text-background" />
            </div>
            <span className="text-sm sm:text-base md:text-lg lg:text-xl">CONNECT</span>
          </DialogTitle>
          <DialogDescription className="text-[9px] sm:text-[10px] md:text-xs text-primary/80 font-mono truncate">
            {network === "main" ? "MAINNET" : "TESTNET"} • SECP256K1
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto overflow-x-hidden px-3 sm:px-4 md:px-5 pb-3 sm:pb-4 md:pb-5">
          {/* Yoda Wallet Connection */}
          <div className="pt-2 sm:pt-3 md:pt-4 space-y-2 sm:space-y-3">
            <Button
              className={`w-full pixel-border-thick bg-gradient-to-r text-xs sm:text-sm md:text-base h-12 sm:h-14 md:h-16 neon-glow transition-all font-bold ${
                isYodaInstalled 
                  ? 'from-purple-600 to-purple-500 hover:from-purple-500 hover:to-purple-400' 
                  : 'from-muted to-muted/80 hover:from-muted/90 hover:to-muted/70'
              }`}
              onClick={async () => {
                try {
                  await connectYodaWallet();
                  onOpenChange(false);
                } catch (error) {
                  console.error("Error connecting Yoda wallet:", error);
                }
              }}
            >
              <div className="flex items-center gap-2 sm:gap-3">
                <div className={`w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 rounded-full flex items-center justify-center ${
                  isYodaInstalled ? 'bg-white/20' : 'bg-white/10'
                }`}>
                  <Wallet className="w-3.5 h-3.5 sm:w-4 sm:h-4 md:w-5 md:h-5" />
                </div>
                <div className="flex flex-col items-start">
                  <span className="text-xs sm:text-sm md:text-base font-bold">
                    {isYodaInstalled ? '🟢 Yoda' : '⚪ Install Yoda'}
                  </span>
                  <span className="text-[9px] sm:text-[10px] opacity-80 hidden sm:block">
                    {isYodaInstalled ? 'Extension detected' : 'Get extension'}
                  </span>
                </div>
              </div>
            </Button>

            <div className="relative my-3 sm:my-4">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t-2 border-muted/30" />
              </div>
              <div className="relative flex justify-center text-[10px] sm:text-xs uppercase">
                <span className="bg-card px-3 sm:px-4 text-muted-foreground font-bold pixel-border bg-background py-0.5 sm:py-1">
                  Or seed phrase
                </span>
              </div>
            </div>
          </div>

          <Tabs defaultValue="create" className="w-full">
            <TabsList className="grid w-full grid-cols-2 pixel-border-thick bg-muted/50 text-xs p-0.5 sm:p-1 gap-0.5 sm:gap-1 h-9 sm:h-10 md:h-11">
              <TabsTrigger 
                value="create" 
                className="text-[10px] sm:text-xs md:text-sm pixel-border data-[state=active]:bg-primary data-[state=active]:text-background data-[state=active]:neon-glow transition-all"
              >
                🆕 CREATE
              </TabsTrigger>
              <TabsTrigger 
                value="import" 
                className="text-[10px] sm:text-xs md:text-sm pixel-border data-[state=active]:bg-secondary data-[state=active]:text-background data-[state=active]:neon-glow-secondary transition-all"
              >
                📥 IMPORT
              </TabsTrigger>
            </TabsList>

            <TabsContent value="create" className="space-y-2 sm:space-y-3 md:space-y-4 mt-2 sm:mt-3 md:mt-4">
              {/* Security Warning */}
              <div className="pixel-border-thick bg-destructive/10 border-2 border-destructive/30 p-2 sm:p-3 md:p-4 space-y-1 sm:space-y-1.5">
                <div className="flex items-start gap-1.5 sm:gap-2 md:gap-3">
                  <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5 text-destructive flex-shrink-0 mt-0.5" />
                  <div className="space-y-0.5 sm:space-y-1">
                    <p className="text-[10px] sm:text-xs font-bold text-destructive tracking-wider">⚠️ SECURITY</p>
                    <p className="text-[9px] sm:text-[10px] md:text-xs text-muted-foreground leading-relaxed">
                      Seed stored in browser. Never share. Write down offline.
                    </p>
                  </div>
                </div>
              </div>

              {!generatedSeed ? (
                <Button
                  className="w-full pixel-border-thick bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary text-xs sm:text-sm md:text-base h-10 sm:h-11 md:h-12 neon-glow transition-all font-bold"
                  onClick={handleGenerateWallet}
                >
                  ✨ GENERATE PHRASE
                </Button>
              ) : (
                <div className="space-y-2 sm:space-y-3 md:space-y-4">
                  <div className="space-y-1.5 sm:space-y-2">
                    <Label className="text-[10px] sm:text-xs text-destructive font-bold tracking-wider flex items-center gap-1.5 sm:gap-2">
                      <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-destructive rounded-full animate-pulse" />
                      SAVE RECOVERY PHRASE
                    </Label>
                    <div className="pixel-border-thick bg-gradient-to-br from-background to-muted/30 p-2 sm:p-3 md:p-4 space-y-1.5 sm:space-y-2">
                      <div className={`text-[9px] sm:text-[10px] md:text-xs font-mono leading-relaxed ${showSeed ? '' : 'blur-md select-none pointer-events-none'} transition-all break-all`}>
                        {generatedSeed}
                      </div>
                      <div className="flex gap-1.5 sm:gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="pixel-border flex-1 text-[9px] sm:text-[10px] md:text-xs hover:bg-primary/10 hover:border-primary transition-all h-8 sm:h-9 md:h-10"
                          onClick={() => setShowSeed(!showSeed)}
                        >
                          {showSeed ? (
                            <><EyeOff className="w-2.5 h-2.5 sm:w-3 sm:h-3 mr-1" /> HIDE</>
                          ) : (
                            <><Eye className="w-2.5 h-2.5 sm:w-3 sm:h-3 mr-1" /> SHOW</>
                          )}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="pixel-border flex-1 text-[9px] sm:text-[10px] md:text-xs hover:bg-primary/10 hover:border-primary transition-all h-8 sm:h-9 md:h-10"
                          onClick={handleCopySeed}
                        >
                          <Copy className="w-2.5 h-2.5 sm:w-3 sm:h-3 mr-1" /> COPY
                        </Button>
                      </div>
                    </div>
                    <div className="pixel-border bg-destructive/5 border-destructive/20 p-2 sm:p-3">
                      <p className="text-[9px] sm:text-[10px] md:text-xs text-destructive leading-relaxed">
                        ⚠️ Write down in order. Store offline. Required for recovery!
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-1.5 sm:gap-2 md:gap-3 pt-1 sm:pt-2">
                    <Button
                      variant="outline"
                      className="flex-1 pixel-border-thick text-[10px] sm:text-xs md:text-sm hover:bg-muted/50 transition-all h-9 sm:h-10 md:h-11 font-bold"
                      onClick={() => {
                        setGeneratedSeed("");
                        setShowSeed(false);
                      }}
                    >
                      ❌ CANCEL
                    </Button>
                    <Button
                      className="flex-1 pixel-border-thick bg-gradient-to-r from-accent to-accent/80 hover:from-accent/90 hover:to-accent text-[10px] sm:text-xs md:text-sm transition-all h-9 sm:h-10 md:h-11 font-bold"
                      onClick={handleConnectWithSeed}
                    >
                      ✅ SAVED IT
                    </Button>
                  </div>
                </div>
              )}
            </TabsContent>

            <TabsContent value="import" className="space-y-2 sm:space-y-3 md:space-y-4 mt-2 sm:mt-3 md:mt-4">
              <div className="space-y-1.5 sm:space-y-2">
                <Label className="text-[10px] sm:text-xs md:text-sm font-bold tracking-wider break-words">ENTER 24-WORD PHRASE</Label>
                <textarea
                  placeholder="word1 word2 word3 ... word24"
                  value={importSeed}
                  onChange={(e) => {
                    setImportSeed(e.target.value);
                    setPreviewAddress(null);
                  }}
                  className="pixel-border-thick bg-muted/30 text-[9px] sm:text-[10px] md:text-xs font-mono w-full min-h-[100px] sm:min-h-[120px] p-2 sm:p-3 md:p-4 rounded-md resize-none border-2 border-muted hover:border-primary/50 focus:border-primary transition-colors"
                />
                <p className="text-[9px] sm:text-[10px] md:text-xs text-muted-foreground leading-relaxed">
                  💡 Space-separated. Hex seeds supported.
                </p>
              </div>

              <Button
                variant="outline"
                className="w-full pixel-border-thick text-[10px] sm:text-xs md:text-sm hover:bg-primary/10 hover:border-primary transition-all h-9 sm:h-10 md:h-11 font-bold"
                onClick={handlePreviewAddress}
                disabled={!importSeed.trim()}
              >
                👁️ PREVIEW
              </Button>

              {previewAddress && (
                <div className="pixel-border-thick bg-gradient-to-br from-primary/5 to-primary/10 border-2 border-primary/30 p-2 sm:p-3 md:p-4 space-y-1.5 sm:space-y-2">
                  <Label className="text-[10px] sm:text-xs tracking-wider text-primary font-bold flex items-center gap-1.5 sm:gap-2">
                    <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-primary rounded-full flex-shrink-0" />
                    ADDRESS
                  </Label>
                  <div className="font-mono text-[9px] sm:text-[10px] md:text-xs break-all bg-background/50 p-2 sm:p-3 rounded pixel-border leading-relaxed">
                    {previewAddress}
                  </div>
                  <p className="text-[9px] sm:text-[10px] text-muted-foreground leading-relaxed">
                    Compare with FX Anchor Status
                  </p>
                </div>
              )}

              <Button
                className="w-full pixel-border-thick bg-gradient-to-r from-secondary to-secondary/80 hover:from-secondary/90 hover:to-secondary text-xs sm:text-sm md:text-base h-10 sm:h-11 md:h-12 neon-glow-secondary transition-all font-bold"
                onClick={handleImportWallet}
                disabled={!importSeed.trim()}
              >
                📥 IMPORT
              </Button>
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default WalletDialog;
