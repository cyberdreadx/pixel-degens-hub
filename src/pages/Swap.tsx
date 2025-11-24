import { useState, useEffect } from "react";
import { useWallet } from "@/contexts/WalletContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { ArrowDownUp, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

// Token addresses
const TOKENS = {
  KTA: 'keeta_anqdilpazdekdu4acw65fj7smltcp26wbrildkqtszqvverljpwpezmd44ssg',
  XRGE: 'keeta_aolgxwrcepccr5ycg5ctp3ezhhp6vnpitzm7grymm63hzbaqk6lcsbtccgur6',
};

const Swap = () => {
  const { isConnected, publicKey, balance, tokens, sendTokens, refreshBalance } = useWallet();
  const [fromAmount, setFromAmount] = useState("");
  const [toAmount, setToAmount] = useState("");
  const [fromCurrency, setFromCurrency] = useState("KTA");
  const [toCurrency, setToCurrency] = useState("XRGE");
  const [isLoading, setIsLoading] = useState(false);
  const [rate, setRate] = useState<number | null>(null);
  const [anchorAddress, setAnchorAddress] = useState<string | null>(null);
  const [anchorInfo, setAnchorInfo] = useState<any>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [marketData, setMarketData] = useState<any>(null);

  // Fetch anchor info
  const fetchAnchorInfo = async () => {
    setIsRefreshing(true);
    try {
      const { data, error } = await supabase.functions.invoke('fx-anchor-info');
      if (error) throw error;
      setAnchorAddress(data.address);
      setAnchorInfo(data);
      toast.success('Anchor info refreshed');
    } catch (error) {
      console.error('Failed to fetch anchor info:', error);
      toast.error('Failed to connect to anchor');
    } finally {
      setIsRefreshing(false);
    }
  };

  // Fetch market data from DexScreener
  const fetchMarketData = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('fx-market-data');
      if (error) throw error;
      setMarketData(data);
    } catch (error) {
      console.error('Failed to fetch market data:', error);
    }
  };

  // Fetch anchor info and market data on mount
  useEffect(() => {
    fetchAnchorInfo();
    fetchMarketData();
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
      // Two-transaction swap (user sends first, anchor sends back)
      // This is the standard approach for anchor-initiated swaps
      
      toast.info(`Sending ${fromAmount} ${fromCurrency} to anchor...`);
      
      // Get the token address (undefined for KTA means use base token)
      const fromTokenAddress = fromCurrency === 'KTA' ? undefined : TOKENS[fromCurrency as keyof typeof TOKENS];
      
      // User sends tokens to anchor wallet
      await sendTokens(anchorAddress, fromAmount, fromTokenAddress);
      
      toast.success("Tokens sent. Processing swap...");

      // Call edge function for anchor to send swapped tokens back
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
        
        // Refresh balances after successful swap
        await refreshBalance();
        
        // Also refresh anchor info to show updated liquidity
        await fetchAnchorInfo();
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

        {/* Market Data */}
        {marketData && (marketData.kta || marketData.xrge) && (
          <Card className="mb-4 p-4 bg-card border-border">
            <h3 className="font-semibold text-sm text-foreground mb-3">Market Data</h3>
            <div className="grid grid-cols-2 gap-3">
              {marketData.kta && (
                <div className="space-y-1">
                  <div className="text-xs text-muted-foreground">KTA Price</div>
                  <div className="font-bold text-foreground">
                    ${marketData.kta.price.toFixed(6)}
                  </div>
                  <div className={`text-xs ${marketData.kta.priceChange24h >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                    {marketData.kta.priceChange24h >= 0 ? '↑' : '↓'} {Math.abs(marketData.kta.priceChange24h).toFixed(2)}%
                  </div>
                </div>
              )}
              {marketData.xrge && (
                <div className="space-y-1">
                  <div className="text-xs text-muted-foreground">XRGE Price</div>
                  <div className="font-bold text-foreground">
                    ${marketData.xrge.price.toFixed(6)}
                  </div>
                  <div className={`text-xs ${marketData.xrge.priceChange24h >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                    {marketData.xrge.priceChange24h >= 0 ? '↑' : '↓'} {Math.abs(marketData.xrge.priceChange24h).toFixed(2)}%
                  </div>
                </div>
              )}
            </div>
            {marketData.error && (
              <p className="text-xs text-muted-foreground mt-2">{marketData.error}</p>
            )}
          </Card>
        )}

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
            {isConnected && (
              <p className="text-xs text-muted-foreground mt-1">
                Balance: {balance || "0.000000"} {fromCurrency}
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
            {isConnected && (
              <p className="text-xs text-muted-foreground mt-1">
                Balance: {
                  toCurrency === 'KTA' 
                    ? (balance || "0.000000")
                    : (tokens.find(t => t.symbol === toCurrency)?.balance || "0.000000")
                } {toCurrency}
              </p>
            )}
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

        {/* Anchor Liquidity Status */}
        {anchorInfo && (
          <Card className="mt-4 md:mt-6 p-4 md:p-6 bg-card border-border">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-base md:text-lg text-foreground">
                FX Anchor Liquidity
              </h3>
              <Button
                variant="ghost"
                size="icon"
                onClick={fetchAnchorInfo}
                disabled={isRefreshing}
                className="h-8 w-8"
              >
                <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              </Button>
            </div>
            
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="p-3 bg-muted rounded-lg">
                <div className="text-xs text-muted-foreground mb-1">KTA Balance</div>
                <div className="font-bold text-lg">{parseFloat(anchorInfo.ktaBalance || '0').toFixed(3)} KTA</div>
              </div>
              <div className="p-3 bg-muted rounded-lg">
                <div className="text-xs text-muted-foreground mb-1">XRGE Balance</div>
                <div className="font-bold text-lg">{parseFloat(anchorInfo.xrgeBalance || '0').toFixed(3)} XRGE</div>
              </div>
            </div>
            
            <div className="p-3 bg-muted/50 rounded-lg">
              <div className="text-xs text-muted-foreground mb-1">Anchor Address</div>
              <div className="font-mono text-xs break-all">{anchorInfo.address}</div>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
};

export default Swap;
