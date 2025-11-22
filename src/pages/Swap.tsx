import { useState, useEffect } from "react";
import { useWallet } from "@/contexts/WalletContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { ArrowDownUp, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

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

  // Fetch anchor info on mount
  useEffect(() => {
    const fetchAnchorInfo = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('fx-anchor-info');
        if (error) throw error;
        setAnchorAddress(data.address);
        setAnchorInfo(data);
        console.log('Anchor info:', data);
      } catch (error) {
        console.error('Failed to fetch anchor info:', error);
        toast.error('Failed to connect to anchor');
      }
    };
    fetchAnchorInfo();
  }, []);

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
    <div className="min-h-screen bg-background pt-20 px-4">
      <div className="max-w-md mx-auto">
        <h1 className="text-4xl font-bold text-center mb-8 text-foreground">
          Token Swap
        </h1>

        <Card className="p-6 bg-card border-border">
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
        <Card className="mt-6 p-4 bg-card border-border">
          <h3 className="font-semibold text-foreground mb-2">FX Anchor Status</h3>
          
          {anchorInfo ? (
            <div className="space-y-2 text-sm">
              <div className="p-3 bg-muted rounded">
                <div className="text-xs text-muted-foreground mb-1">Address (Index 1)</div>
                <div className="font-mono text-xs break-all">{anchorInfo.address}</div>
              </div>
              
              <div className="grid grid-cols-2 gap-2">
                <div className="p-3 bg-muted rounded">
                  <div className="text-xs text-muted-foreground mb-1">KTA Balance</div>
                  <div className="font-bold">{anchorInfo.ktaBalance || '0'} KTA</div>
                </div>
                <div className="p-3 bg-muted rounded">
                  <div className="text-xs text-muted-foreground mb-1">XRGE Balance</div>
                  <div className="font-bold">{anchorInfo.xrgeBalance || '0'} XRGE</div>
                </div>
              </div>
              
              <div className="p-2 bg-primary/10 border border-primary/20 rounded text-xs">
                <div className="font-semibold mb-1">Expected: keeta_aabky6l7...eaq</div>
                <div className={anchorInfo.address === 'keeta_aabky6l7q6znyl4mqougwr63pecljbq7zdb7xqvwqd3sftvxzzkdxstiect4eaq' 
                  ? 'text-green-600 dark:text-green-400' 
                  : 'text-destructive'}>
                  {anchorInfo.address === 'keeta_aabky6l7q6znyl4mqougwr63pecljbq7zdb7xqvwqd3sftvxzzkdxstiect4eaq'
                    ? '✓ Address matches! Anchor is correct.'
                    : '✗ Address mismatch! Update ANCHOR_WALLET_SEED with correct mnemonic.'}
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Loading anchor info...</p>
          )}
          
          <Button
            onClick={handleDebugSeed}
            disabled={isScanning}
            variant="outline"
            className="w-full"
          >
            {isScanning ? 'Testing...' : 'Test Seed Conversion Methods'}
          </Button>

          {scanResults && scanResults.matchFound && (
            <div className="mt-4 p-3 bg-primary/10 border border-primary/20 rounded text-sm">
              <div className="font-semibold text-primary mb-2">✅ Match Found!</div>
              <div className="text-xs space-y-1">
                <div>Method: <span className="font-mono">{scanResults.matchFound.method}</span></div>
                <div>Index: <span className="font-mono">{scanResults.matchFound.index}</span></div>
                <div className="font-mono text-xs break-all">{scanResults.matchFound.address}</div>
              </div>
            </div>
          )}
          
          {scanResults && !scanResults.matchFound && scanResults.results && (
            <div className="mt-4 p-3 bg-muted rounded text-xs">
              <div className="font-semibold mb-2">No match found in either method</div>
              {scanResults.mnemonicInfo && (
                <div className="space-y-1 text-muted-foreground">
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
