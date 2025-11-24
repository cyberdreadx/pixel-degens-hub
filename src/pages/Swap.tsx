import { useState, useEffect } from "react";
import { useWallet } from "@/contexts/WalletContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { ArrowDownUp, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import * as KeetaNet from "@keetanetwork/keetanet-client";
import * as bip39 from "bip39";

// Token addresses
const TOKENS = {
  KTA: 'keeta_anqdilpazdekdu4acw65fj7smltcp26wbrildkqtszqvverljpwpezmd44ssg',
  XRGE: 'keeta_aolgxwrcepccr5ycg5ctp3ezhhp6vnpitzm7grymm63hzbaqk6lcsbtccgur6',
};

const Swap = () => {
  const { isConnected, publicKey, balance, sendTokens } = useWallet();
  const [fromAmount, setFromAmount] = useState("");
  const [toAmount, setToAmount] = useState("");
  const [fromCurrency, setFromCurrency] = useState("KTA");
  const [toCurrency, setToCurrency] = useState("XRGE");
  const [isLoading, setIsLoading] = useState(false);
  const [rate, setRate] = useState<number | null>(null);
  const [anchorAddress, setAnchorAddress] = useState<string | null>(null);
  const [anchorInfo, setAnchorInfo] = useState<any>(null);
  const [scanResults, setScanResults] = useState<any>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [compareResults, setCompareResults] = useState<any>(null);
  const [compareMnemonic, setCompareMnemonic] = useState("");
  const [frontendAnchorAddress, setFrontendAnchorAddress] = useState<string | null>(null);

  // Fetch anchor info on mount - keep backend for balance checks
  useEffect(() => {
    const fetchAnchorInfo = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('fx-anchor-info');
        if (error) throw error;
        setAnchorAddress(data.address);
        setAnchorInfo(data);
        console.log('Backend anchor info:', data);
      } catch (error) {
        console.error('Failed to fetch anchor info:', error);
        toast.error('Failed to connect to anchor');
      }
    };
    fetchAnchorInfo();
  }, []);

  // Derive anchor address using frontend method (same as wallet preview)
  const deriveFrontendAnchor = async (mnemonic: string) => {
    try {
      let actualSeed = mnemonic.trim();
      
      if (bip39.validateMnemonic(actualSeed)) {
        actualSeed = await KeetaNet.lib.Account.seedFromPassphrase(actualSeed, { asString: true }) as string;
      }

      const { AccountKeyAlgorithm } = KeetaNet.lib.Account;
      const account = KeetaNet.lib.Account.fromSeed(actualSeed, 0, AccountKeyAlgorithm.ECDSA_SECP256K1);
      const address = account.publicKeyString.toString();
      
      console.log('Frontend derived anchor (secp256k1, index 0):', address);
      setFrontendAnchorAddress(address);
      
      return address;
    } catch (error) {
      console.error("Error deriving frontend anchor:", error);
      toast.error("Invalid mnemonic format");
      return null;
    }
  };

  // Fetch rate on mount and when currencies change
  useEffect(() => {
    fetchRate();
  }, [fromCurrency, toCurrency]);

  const fetchRate = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('fx-rates', {
        body: { from: fromCurrency, to: toCurrency }
      });

      if (error) throw error;
      
      setRate(data.rate);
      return data.rate;
    } catch (error: any) {
      console.error('Error fetching rate:', error);
      toast.error('Failed to fetch exchange rate');
      return null;
    }
  };

  const handleFromAmountChange = async (value: string) => {
    setFromAmount(value);
    
    if (!value || isNaN(parseFloat(value))) {
      setToAmount("");
      return;
    }

    const currentRate = rate || await fetchRate();
    if (currentRate) {
      const calculated = parseFloat(value) * currentRate;
      setToAmount(calculated.toFixed(6));
    }
  };

  const handleSwapCurrencies = () => {
    setFromCurrency(toCurrency);
    setToCurrency(fromCurrency);
    setFromAmount(toAmount);
    setToAmount(fromAmount);
    setRate(null);
  };

  const handleScanDerivations = async () => {
    setIsScanning(true);
    try {
      const { data, error } = await supabase.functions.invoke('fx-anchor-scan');
      if (error) throw error;
      setScanResults(data);
      toast.success('Scan complete!');
    } catch (error: any) {
      toast.error(`Scan failed: ${error.message}`);
    } finally {
      setIsScanning(false);
    }
  };

  const handleDebugSeed = async () => {
    setIsScanning(true);
    try {
      const { data, error } = await supabase.functions.invoke('fx-anchor-debug');
      if (error) throw error;
      console.log('Debug results:', data);
      
      if (data.matchFound) {
        toast.success(`Match found! Use ${data.matchFound.method} at index ${data.matchFound.index}`);
      } else {
        toast.error('No match found. Check mnemonic.');
      }
      
      setScanResults(data);
    } catch (error: any) {
      toast.error(`Debug failed: ${error.message}`);
    } finally {
      setIsScanning(false);
    }
  };

  const handleCompareMnemonic = async () => {
    if (!compareMnemonic.trim()) {
      toast.error("Please paste a mnemonic phrase first");
      return;
    }

    setIsScanning(true);
    try {
      const { data, error } = await supabase.functions.invoke('fx-anchor-compare', {
        body: { userMnemonic: compareMnemonic }
      });
      
      if (error) throw error;
      
      console.log('Compare results:', data);
      setCompareResults(data);
      
      if (data.match) {
        toast.success('✓ Perfect match! Both mnemonics derive the same address.');
      } else {
        toast.error('✗ Mismatch detected. See details below.');
      }
    } catch (error: any) {
      toast.error(`Compare failed: ${error.message}`);
    } finally {
      setIsScanning(false);
    }
  };

  const handleSwap = async () => {
    if (!isConnected || !publicKey) {
      toast.error("Please connect your wallet first");
      return;
    }

    if (!anchorAddress) {
      toast.error("Anchor not available. Please try again.");
      return;
    }

    if (!fromAmount || parseFloat(fromAmount) <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }

    setIsLoading(true);

    try {
      // Step 1: User sends tokens to anchor
      toast.info(`Sending ${fromAmount} ${fromCurrency} to anchor...`);
      
      // Get the token address (undefined for KTA means use base token)
      const fromTokenAddress = fromCurrency === 'KTA' ? undefined : TOKENS[fromCurrency as keyof typeof TOKENS];
      
      // Send tokens to anchor wallet (sendTokens handles conversion to smallest units)
      await sendTokens(anchorAddress, fromAmount, fromTokenAddress);
      
      toast.success("Tokens sent to anchor. Processing swap...");

      // Step 2: Call edge function to have anchor send back swapped tokens
      const { data, error } = await supabase.functions.invoke('fx-swap', {
        body: {
          fromCurrency,
          toCurrency,
          amount: fromAmount,
          userPublicKey: publicKey,
        }
      });

      if (error) throw error;

      if (data.success) {
        toast.success(
          `Swap complete! Received ${data.toAmount} ${data.toCurrency}`
        );
        setFromAmount("");
        setToAmount("");
      } else {
        toast.error(data.error || "Swap failed");
      }
    } catch (error: any) {
      console.error('Swap error:', error);
      toast.error(error.message || "Failed to execute swap");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background pt-20 px-4 pb-8">
      <div className="max-w-md mx-auto">
        <h1 className="text-3xl md:text-4xl font-bold text-center mb-6 md:mb-8 text-foreground">
          Token Swap
        </h1>

        <Card className="p-4 md:p-6 bg-card border-border">
          {/* From Section */}
          <div className="mb-4">
            <label className="text-sm text-muted-foreground mb-2 block">
              From
            </label>
            <div className="flex gap-2">
              <Input
                type="number"
                placeholder="0.0"
                value={fromAmount}
                onChange={(e) => handleFromAmountChange(e.target.value)}
                className="flex-1"
              />
              <div className="px-4 py-2 bg-muted rounded-md flex items-center min-w-[80px] justify-center">
                <span className="font-bold text-foreground">{fromCurrency}</span>
              </div>
            </div>
            {isConnected && balance && (
              <p className="text-xs text-muted-foreground mt-1">
                Balance: {balance} KTA
              </p>
            )}
          </div>

          {/* Swap Button */}
          <div className="flex justify-center my-4">
            <Button
              variant="outline"
              size="icon"
              onClick={handleSwapCurrencies}
              className="rounded-full"
            >
              <ArrowDownUp className="h-4 w-4" />
            </Button>
          </div>

          {/* To Section */}
          <div className="mb-6">
            <label className="text-sm text-muted-foreground mb-2 block">
              To
            </label>
            <div className="flex gap-2">
              <Input
                type="number"
                placeholder="0.0"
                value={toAmount}
                readOnly
                className="flex-1"
              />
              <div className="px-4 py-2 bg-muted rounded-md flex items-center min-w-[80px] justify-center">
                <span className="font-bold text-foreground">{toCurrency}</span>
              </div>
            </div>
          </div>

          {/* Rate Display */}
          {rate && (
            <div className="mb-6 p-3 bg-muted rounded-md">
              <p className="text-sm text-muted-foreground">
                Rate: 1 {fromCurrency} = {rate} {toCurrency}
              </p>
            </div>
          )}

          {/* Swap Action Button */}
          <Button
            onClick={handleSwap}
            disabled={!isConnected || isLoading || !fromAmount}
            className="w-full"
            size="lg"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Swapping...
              </>
            ) : !isConnected ? (
              "Connect Wallet to Swap"
            ) : (
              "Swap"
            )}
          </Button>
        </Card>

        {/* Info Section */}
        <Card className="mt-4 md:mt-6 p-3 md:p-4 bg-card border-border">
          <h3 className="font-semibold text-sm md:text-base text-foreground mb-2">FX Anchor Status (Frontend Derivation)</h3>
          
          <div className="space-y-2 text-sm mb-4">
            <label className="text-xs text-muted-foreground">
              PASTE ANCHOR SEED TO DERIVE ADDRESS (FRONTEND METHOD):
            </label>
            <textarea
              placeholder="Paste 24-word anchor seed phrase..."
              value={compareMnemonic}
              onChange={(e) => setCompareMnemonic(e.target.value)}
              className="w-full min-h-[60px] md:min-h-[80px] p-2 text-xs font-mono bg-muted border border-border rounded"
            />
            <Button
              onClick={() => deriveFrontendAnchor(compareMnemonic)}
              disabled={!compareMnemonic.trim()}
              variant="default"
              className="w-full text-xs"
              size="sm"
            >
              Derive Address (Frontend Method)
            </Button>
          </div>

          {frontendAnchorAddress && (
            <div className="space-y-2 text-sm">
              <div className="p-2 md:p-3 bg-muted rounded">
                <div className="text-xs text-muted-foreground mb-1">Frontend Derived Address (secp256k1, Index 0)</div>
                <div className="font-mono text-[10px] md:text-xs break-all">{frontendAnchorAddress}</div>
              </div>
              
              <div className="p-2 bg-primary/10 border border-primary/20 rounded text-xs">
                <div className="font-semibold mb-1">Expected: keeta_aabky6l7...eaq</div>
                <div className={frontendAnchorAddress === 'keeta_aabky6l7q6znyl4mqougwr63pecljbq7zdb7xqvwqd3sftvxzzkdxstiect4eaq' 
                  ? 'text-green-600 dark:text-green-400' 
                  : 'text-destructive'}>
                  {frontendAnchorAddress === 'keeta_aabky6l7q6znyl4mqougwr63pecljbq7zdb7xqvwqd3sftvxzzkdxstiect4eaq'
                    ? '✓ Address matches expected wallet!'
                    : '✗ Address mismatch - different seed or derivation.'}
                </div>
              </div>
            </div>
          )}

          {anchorInfo && (
            <div className="mt-4 pt-4 border-t border-border">
              <h4 className="text-xs font-semibold text-muted-foreground mb-2">Backend Anchor (for balance reference):</h4>
              <div className="grid grid-cols-2 gap-2">
                <div className="p-2 bg-muted rounded">
                  <div className="text-[10px] md:text-xs text-muted-foreground mb-1">KTA Balance</div>
                  <div className="font-bold text-xs md:text-sm">{anchorInfo.ktaBalance || '0'} KTA</div>
                </div>
                <div className="p-2 bg-muted rounded">
                  <div className="text-[10px] md:text-xs text-muted-foreground mb-1">XRGE Balance</div>
                  <div className="font-bold text-xs md:text-sm">{anchorInfo.xrgeBalance || '0'} XRGE</div>
                </div>
              </div>
              <div className="mt-2 p-2 bg-muted rounded">
                <div className="text-[10px] md:text-xs text-muted-foreground mb-1">Backend Address</div>
                <div className="font-mono text-[10px] md:text-xs break-all">{anchorInfo.address}</div>
              </div>
            </div>
          )}
          
          <div className="space-y-2 pt-2 border-t border-border mt-3">
            <label className="text-xs text-muted-foreground">
              PASTE YOUR WALLET MNEMONIC TO COMPARE WITH ANCHOR_WALLET_SEED:
            </label>
            <textarea
              placeholder="Paste your 24-word phrase here..."
              value={compareMnemonic}
              onChange={(e) => setCompareMnemonic(e.target.value)}
              className="w-full min-h-[60px] md:min-h-[80px] p-2 text-xs font-mono bg-muted border border-border rounded"
            />
            <Button
              onClick={handleCompareMnemonic}
              disabled={isScanning || !compareMnemonic.trim()}
              variant="default"
              className="w-full"
              size="sm"
            >
              {isScanning ? 'Comparing...' : 'Compare with ANCHOR_WALLET_SEED'}
            </Button>
          </div>

          {compareResults && (
            <div className={`mt-4 p-2 md:p-3 rounded text-sm border ${
              compareResults.match 
                ? 'bg-green-500/10 border-green-500/20' 
                : 'bg-destructive/10 border-destructive/20'
            }`}>
              <div className="font-semibold mb-2 text-xs md:text-sm">
                {compareResults.match ? '✅ MATCH!' : '✗ MISMATCH'}
              </div>
              
              <div className="space-y-2 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <div className="text-muted-foreground text-[10px] md:text-xs">Your Mnemonic:</div>
                    <div className="font-mono text-[10px] break-all">{compareResults.userAddress}</div>
                    <div className="text-muted-foreground mt-1 text-[10px]">Words: {compareResults.userMnemonicWordCount}</div>
                    <div className="text-muted-foreground text-[10px]">First: {compareResults.userFirstWord}</div>
                    <div className="text-muted-foreground text-[10px]">Last: {compareResults.userLastWord}</div>
                  </div>
                  
                  <div>
                    <div className="text-muted-foreground text-[10px] md:text-xs">ANCHOR_WALLET_SEED:</div>
                    <div className="font-mono text-[10px] break-all">{compareResults.anchorAddress}</div>
                    <div className="text-muted-foreground mt-1 text-[10px]">Words: {compareResults.anchorMnemonicWordCount}</div>
                    <div className="text-muted-foreground text-[10px]">First: {compareResults.anchorFirstWord}</div>
                    <div className="text-muted-foreground text-[10px]">Last: {compareResults.anchorLastWord}</div>
                  </div>
                </div>

                <div className="pt-2 border-t border-border/50 text-[10px] md:text-xs">
                  <div>Intermediate seeds match: {compareResults.seedsMatch ? '✓' : '✗'}</div>
                  <div>Final addresses match: {compareResults.addressesMatch ? '✓' : '✗'}</div>
                </div>
              </div>
            </div>
          )}

          {scanResults && scanResults.matchFound && (
            <div className="mt-4 p-2 md:p-3 bg-primary/10 border border-primary/20 rounded text-sm">
              <div className="font-semibold text-primary mb-2 text-xs md:text-sm">✅ Match Found!</div>
              <div className="text-xs space-y-1">
                <div className="text-[10px] md:text-xs">Method: <span className="font-mono">{scanResults.matchFound.method}</span></div>
                <div className="text-[10px] md:text-xs">Index: <span className="font-mono">{scanResults.matchFound.index}</span></div>
                <div className="font-mono text-[10px] break-all">{scanResults.matchFound.address}</div>
              </div>
            </div>
          )}
          
          {scanResults && !scanResults.matchFound && scanResults.results && (
            <div className="mt-4 p-2 md:p-3 bg-muted rounded text-xs">
              <div className="font-semibold mb-2 text-xs md:text-sm">No match found in either method</div>
              {scanResults.mnemonicInfo && (
                <div className="space-y-1 text-muted-foreground text-[10px] md:text-xs">
                  <div>Word count: {scanResults.mnemonicInfo.wordCount}</div>
                  <div>First word: {scanResults.mnemonicInfo.firstWord}</div>
                  <div>Last word: {scanResults.mnemonicInfo.lastWord}</div>
                </div>
              )}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};

export default Swap;
