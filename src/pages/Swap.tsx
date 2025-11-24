import { useState, useEffect } from "react";
import { useWallet } from "@/contexts/WalletContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { ArrowDownUp, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import TradingChart from "@/components/TradingChart";
import xrgeLogo from "@/assets/xrge-logo.webp";
import ktaLogo from "@/assets/kta-logo.jpg";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { getTokenAddresses } from "@/utils/keetaApi";
import { AddLiquidityDialog } from "@/components/AddLiquidityDialog";
import { useMarketData } from "@/hooks/useMarketData";

const ANCHOR_ADDRESS = 'keeta_aab4yyxf3mw5mi6coye4zm6ovk2e36b2g6xxhfpa4ol4eh22vumrp4kjtbyckla';

const Swap = () => {
  const { isConnected, publicKey, balance, tokens, sendTokens, refreshBalance, network } = useWallet();
  const { getUsdValue, formatUsd } = useMarketData();
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
  const [slippage, setSlippage] = useState(3); // Default 3% slippage tolerance for small pools
  const [isLoadingMarket, setIsLoadingMarket] = useState(true);
  const [isLoadingRate, setIsLoadingRate] = useState(false);
  const [priceImpact, setPriceImpact] = useState<number | null>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [isLoadingTx, setIsLoadingTx] = useState(false);

  // Fetch anchor info and rate together
  const fetchAnchorInfo = async () => {
    setIsRefreshing(true);
    try {
      const { data, error } = await supabase.functions.invoke('fx-anchor-info', {
        body: { network }
      });
      if (error) throw error;
      setAnchorAddress(data.address);
      setAnchorInfo(data);
      
      // Also refresh the rate
      await fetchRate();
      
      toast.success('Liquidity and rates refreshed');
    } catch (error) {
      console.error('Failed to fetch anchor info:', error);
      toast.error('Failed to connect to anchor');
    } finally {
      setIsRefreshing(false);
    }
  };

  // Fetch market data from DexScreener
  const fetchMarketData = async () => {
    setIsLoadingMarket(true);
    try {
      const { data, error } = await supabase.functions.invoke('fx-market-data');
      if (error) throw error;
      setMarketData(data);
    } catch (error) {
      console.error('Failed to fetch market data:', error);
    } finally {
      setIsLoadingMarket(false);
    }
  };

  // Fetch transactions from blockchain via edge function
  const fetchTransactions = async () => {
    setIsLoadingTx(true);
    try {
      // Fetch all swap records from price_history for current network
      const { data, error } = await supabase
        .from("price_history")
        .select("*")
        .eq("network", network)  // Filter by current network
        .gt("volume_24h", 0)
        .order("timestamp", { ascending: false })
        .limit(20);

      if (error) throw error;
      setTransactions(data || []);
    } catch (error) {
      console.error('Failed to fetch transactions:', error);
      toast.error('Failed to load transactions');
    } finally {
      setIsLoadingTx(false);
    }
  };

  // Fetch anchor info and market data on mount and when network changes
  useEffect(() => {
    fetchAnchorInfo();
    fetchMarketData();
    fetchTransactions();
    
    // Refresh transactions every 30 seconds
    const interval = setInterval(fetchTransactions, 30000);
    return () => clearInterval(interval);
  }, [network]);

  // Fetch rate on mount and when currencies or network change
  useEffect(() => {
    fetchRate();
  }, [fromCurrency, toCurrency, network]);

  const fetchRate = async () => {
    setIsLoadingRate(true);
    try {
      const { data, error } = await supabase.functions.invoke('fx-rates', {
        body: { from: fromCurrency, to: toCurrency, network }
      });

      if (error) throw error;
      
      setRate(data.rate);
      return data.rate;
    } catch (error: any) {
      console.error('Error fetching rate:', error);
      toast.error('Failed to fetch exchange rate');
      return null;
    } finally {
      setIsLoadingRate(false);
    }
  };

  const calculatePriceImpact = (swapAmount: number) => {
    if (!anchorInfo || !rate) return null;

    const fromPoolBalance = fromCurrency === 'KTA' 
      ? parseFloat(anchorInfo.ktaBalance || '0')
      : parseFloat(anchorInfo.xrgeBalance || '0');
    const toPoolBalance = toCurrency === 'KTA'
      ? parseFloat(anchorInfo.ktaBalance || '0') 
      : parseFloat(anchorInfo.xrgeBalance || '0');

    if (fromPoolBalance <= 0 || toPoolBalance <= 0) return null;

    // Constant product: k = x * y
    const k = fromPoolBalance * toPoolBalance;
    
    // After swap: new_from = from + swapAmount
    const newFromBalance = fromPoolBalance + swapAmount;
    
    // new_to = k / new_from
    const newToBalance = k / newFromBalance;
    
    // New rate after swap
    const newRate = newFromBalance / newToBalance;
    
    // Current rate
    const currentRate = fromPoolBalance / toPoolBalance;
    
    // Price impact percentage
    const impact = ((newRate - currentRate) / currentRate) * 100;
    
    return Math.abs(impact);
  };

  const handleFromAmountChange = async (value: string) => {
    setFromAmount(value);
    
    if (!value || isNaN(parseFloat(value))) {
      setToAmount("");
      setPriceImpact(null);
      return;
    }

    const swapAmount = parseFloat(value);
    
    // Calculate output using constant product formula (x * y = k)
    if (anchorInfo) {
      const fromPoolBalance = fromCurrency === 'KTA' 
        ? parseFloat(anchorInfo.ktaBalance || '0')
        : parseFloat(anchorInfo.xrgeBalance || '0');
      const toPoolBalance = toCurrency === 'KTA'
        ? parseFloat(anchorInfo.ktaBalance || '0') 
        : parseFloat(anchorInfo.xrgeBalance || '0');

      if (fromPoolBalance > 0 && toPoolBalance > 0) {
        // Constant product: k = x * y
        const k = fromPoolBalance * toPoolBalance;
        
        // After adding swapAmount: new_from = from + swapAmount
        const newFromBalance = fromPoolBalance + swapAmount;
        
        // new_to = k / new_from
        const newToBalance = k / newFromBalance;
        
        // Output amount = current_to - new_to
        const outputAmount = toPoolBalance - newToBalance;
        
        setToAmount(outputAmount.toFixed(6));
        
        // Calculate price impact
        const impact = calculatePriceImpact(swapAmount);
        setPriceImpact(impact);
        return;
      }
    }

    // Fallback to rate-based calculation if pool info not available
    const currentRate = rate || await fetchRate();
    if (currentRate) {
      const calculated = swapAmount * currentRate;
      setToAmount(calculated.toFixed(6));
      
      // Calculate price impact
      const impact = calculatePriceImpact(swapAmount);
      setPriceImpact(impact);
    }
  };

  const handleSwapCurrencies = () => {
    setFromCurrency(toCurrency);
    setToCurrency(fromCurrency);
    setFromAmount(toAmount);
    setToAmount(fromAmount);
    setRate(null);
    
    // Recalculate price impact with swapped values
    if (toAmount && parseFloat(toAmount) > 0) {
      const impact = calculatePriceImpact(parseFloat(toAmount));
      setPriceImpact(impact);
    } else {
      setPriceImpact(null);
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

    // Liquidity validation
    if (!anchorInfo) {
      toast.error("Unable to verify liquidity. Please refresh.");
      return;
    }

    const swapAmount = parseFloat(fromAmount);
    const fromPoolBalance = fromCurrency === 'KTA' 
      ? parseFloat(anchorInfo.ktaBalance || '0')
      : parseFloat(anchorInfo.xrgeBalance || '0');
    const toPoolBalance = toCurrency === 'KTA'
      ? parseFloat(anchorInfo.ktaBalance || '0') 
      : parseFloat(anchorInfo.xrgeBalance || '0');

    // Calculate max allowed swap (15% of from pool to prevent draining)
    const maxSwapAmount = fromPoolBalance * 0.15;
    
    if (swapAmount > maxSwapAmount) {
      toast.error(
        `Amount too large! Max swap: ${maxSwapAmount.toFixed(6)} ${fromCurrency} (15% of pool)`,
        { duration: 5000 }
      );
      return;
    }

    // Check if anchor has enough liquidity to fulfill the swap
    const expectedToAmount = parseFloat(toAmount);
    if (expectedToAmount > toPoolBalance) {
      toast.error(
        `Insufficient liquidity! Pool only has ${toPoolBalance.toFixed(3)} ${toCurrency}`,
        { duration: 5000 }
      );
      return;
    }

    // Warn if output would drain >50% of pool
    if (expectedToAmount > toPoolBalance * 0.5) {
      toast.warning(
        `Large trade! This will impact pool balance significantly.`,
        { duration: 4000 }
      );
    }

    setIsLoading(true);

    try {
      // Fetch the latest rate right before swapping to minimize slippage
      toast.info("Checking current rate...");
      const latestRate = await fetchRate();
      
      if (!latestRate) {
        toast.error("Unable to fetch current rate. Please try again.");
        setIsLoading(false);
        return;
      }
      
      // Recalculate the expected output with the latest rate
      const latestExpectedOutput = (swapAmount * latestRate).toFixed(6);
      setToAmount(latestExpectedOutput);
      
      // Calculate price impact with latest rate
      const impact = calculatePriceImpact(swapAmount);
      setPriceImpact(impact);
      
      // Two-transaction swap (user sends first, anchor sends back)
      // This is the standard approach for anchor-initiated swaps
      
      toast.info(`Sending ${fromAmount} ${fromCurrency} to anchor...`);
      
      // Get the token address (undefined for KTA means use base token)
      const tokenAddrs = getTokenAddresses(network);
      const fromTokenAddress = fromCurrency === 'KTA' ? undefined : tokenAddrs[fromCurrency as keyof typeof tokenAddrs];
      
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
          expectedRate: latestRate, // Use the freshly fetched rate
          slippageTolerance: slippage, // Pass slippage tolerance percentage
          network, // Pass the current network
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
        
        // Manually trigger price recording for this network (especially important for testnet)
        try {
          console.log('Triggering fx-record-price for network:', network);
          const { data: priceData, error: priceError } = await supabase.functions.invoke('fx-record-price', {
            body: { network: network }
          });
          console.log('Price recording result:', priceData, priceError);
        } catch (priceError) {
          console.warn('Failed to record price snapshot:', priceError);
        }
        
        // Refresh chart data
        await fetchTransactions();
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
    <div className="min-h-screen bg-background pt-20 pb-8">
      <div className="max-w-7xl mx-auto px-4 md:px-6">
        <h1 className="text-3xl md:text-4xl font-bold text-center mb-6 md:mb-8 text-foreground neon-glow animate-fade-in">
          DEGEN SWAP
        </h1>

        <div className="grid lg:grid-cols-[400px_1fr] gap-6 items-start w-full animate-fade-in">
          {/* Left column: Swap interface and market data */}
          <div className="space-y-4 w-full">
            {/* Market Data and Pool Rates */}
            <div className="grid grid-cols-1 gap-4">
              {/* BASE Chain Prices */}
              {isLoadingMarket ? (
                <Card className="p-4 bg-card border-border">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="h-4 w-32 bg-muted animate-pulse rounded"></div>
                    <div className="h-5 w-24 bg-muted animate-pulse rounded-full"></div>
                  </div>
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <div className="h-3 w-16 bg-muted animate-pulse rounded"></div>
                      <div className="h-6 w-24 bg-muted animate-pulse rounded"></div>
                      <div className="h-3 w-20 bg-muted animate-pulse rounded"></div>
                    </div>
                    <div className="space-y-1">
                      <div className="h-3 w-16 bg-muted animate-pulse rounded"></div>
                      <div className="h-6 w-24 bg-muted animate-pulse rounded"></div>
                      <div className="h-3 w-20 bg-muted animate-pulse rounded"></div>
                    </div>
                  </div>
                </Card>
              ) : marketData && (marketData.kta || marketData.xrge) ? (
                <Card className="p-4 glass-light border-border/50 shadow-none hover-scale transition-all duration-300 animate-fade-in">
                  <div className="flex items-center gap-2 mb-3">
                    <h3 className="font-semibold text-sm text-foreground">BASE Chain Prices</h3>
                    <span className="text-xs px-2 py-0.5 bg-primary/10 text-primary rounded-full animate-pulse">External Market</span>
                  </div>
                  <div className="space-y-3">
                    {marketData.kta && (
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <img src={ktaLogo} alt="KTA" className="w-4 h-4 rounded-full" />
                          KTA
                        </div>
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
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <img src={xrgeLogo} alt="XRGE" className="w-4 h-4 rounded-full" />
                          XRGE
                        </div>
                        <div className="font-bold text-foreground">
                          ${marketData.xrge.price.toFixed(6)}
                        </div>
                        <div className={`text-xs ${marketData.xrge.priceChange24h >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                          {marketData.xrge.priceChange24h >= 0 ? '↑' : '↓'} {Math.abs(marketData.xrge.priceChange24h).toFixed(2)}%
                        </div>
                        <div className="text-xs text-muted-foreground">
                          MCap: ${(marketData.xrge.marketCap / 1000).toFixed(1)}K
                        </div>
                      </div>
                    )}
                  </div>
                </Card>
              ) : null}

              {/* Keeta Pool Rate */}
              {isLoadingRate ? (
                <Card className="p-4 bg-card border-border">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="h-4 w-32 bg-muted animate-pulse rounded"></div>
                    <div className="h-5 w-24 bg-muted animate-pulse rounded-full"></div>
                  </div>
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <div className="h-3 w-24 bg-muted animate-pulse rounded"></div>
                      <div className="h-6 w-40 bg-muted animate-pulse rounded"></div>
                    </div>
                    <div className="space-y-1">
                      <div className="h-3 w-20 bg-muted animate-pulse rounded"></div>
                      <div className="h-4 w-32 bg-muted animate-pulse rounded"></div>
                    </div>
                  </div>
                </Card>
              ) : rate && anchorInfo ? (
                <Card className="p-4 glass-light border-border/50 shadow-none hover-scale transition-all duration-300 animate-fade-in">
                  <div className="flex items-center gap-2 mb-3">
                    <h3 className="font-semibold text-sm text-foreground">Keeta Pool Rate</h3>
                    <span className="text-xs px-2 py-0.5 bg-accent/10 text-accent rounded-full animate-pulse">Your Swap Rate</span>
                  </div>
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <div className="text-xs text-muted-foreground">Exchange Rate</div>
                      <div className="font-bold text-foreground">
                        1 {fromCurrency} = {rate.toFixed(6)} {toCurrency}
                      </div>
                      {fromCurrency === 'KTA' && toCurrency === 'XRGE' && rate > 0 && (
                        <div className="text-xs text-muted-foreground">
                          1 XRGE = {(1 / rate).toFixed(6)} KTA
                        </div>
                      )}
                      {fromCurrency === 'XRGE' && toCurrency === 'KTA' && rate > 0 && (
                        <div className="text-xs text-muted-foreground">
                          1 KTA = {(1 / rate).toFixed(6)} XRGE
                        </div>
                      )}
                    </div>
                    <div className="space-y-1">
                      <div className="text-xs text-muted-foreground">Pool Liquidity</div>
                      <div className="text-xs font-medium text-foreground">
                        {parseFloat(anchorInfo.ktaBalance || '0').toFixed(2)} KTA / {parseFloat(anchorInfo.xrgeBalance || '0').toFixed(2)} XRGE
                      </div>
                      <div className="text-xs text-primary">
                        Total: {formatUsd(
                          getUsdValue(parseFloat(anchorInfo.ktaBalance || '0'), 'KTA') +
                          getUsdValue(parseFloat(anchorInfo.xrgeBalance || '0'), 'XRGE')
                        )}
                      </div>
                    </div>
                  </div>
                </Card>
              ) : null}
            </div>

            {/* Swap Interface Card */}
            <Card className="p-4 md:p-6 glass border-border/50 shadow-none animate-scale-in hover-scale transition-all duration-300">
          {/* From Section */}
          <div className="mb-4 animate-fade-in">
            <label className="text-sm text-muted-foreground mb-2 block">
              From
            </label>
            <div className="flex gap-2">
              <Input
                type="number"
                placeholder="0.0"
                value={fromAmount}
                onChange={(e) => handleFromAmountChange(e.target.value)}
                className="flex-1 focus:scale-105 transition-all duration-200"
              />
              <div className="px-4 py-2 bg-muted rounded-md flex items-center gap-2 min-w-[80px] justify-center hover:scale-105 transition-transform duration-200">
                {fromCurrency === 'KTA' && <img src={ktaLogo} alt="KTA" className="w-5 h-5 rounded-full animate-pulse" />}
                {fromCurrency === 'XRGE' && <img src={xrgeLogo} alt="XRGE" className="w-5 h-5 rounded-full animate-pulse" />}
                <span className="font-bold text-foreground">{fromCurrency}</span>
              </div>
            </div>
            <div className="mt-1 space-y-0.5">
              {isConnected && (
                <p className="text-xs text-muted-foreground">
                  Balance: {
                    fromCurrency === 'KTA' 
                      ? (balance || "0.000000")
                      : (tokens.find(t => t.symbol === fromCurrency)?.balance || "0.000000")
                  } {fromCurrency}
                </p>
              )}
              {fromAmount && parseFloat(fromAmount) > 0 && (
                <p className="text-xs text-primary">
                  ≈ {formatUsd(getUsdValue(parseFloat(fromAmount), fromCurrency as 'KTA' | 'XRGE'))}
                </p>
              )}
            </div>
          </div>

          {/* Swap Button */}
          <div className="flex justify-center my-4">
            <Button
              variant="outline"
              size="icon"
              onClick={handleSwapCurrencies}
              className="rounded-full hover:rotate-180 hover:scale-110 transition-all duration-300"
            >
              <ArrowDownUp className="h-4 w-4" />
            </Button>
          </div>

          {/* To Section */}
          <div className="mb-6 animate-fade-in">
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
              <div className="px-4 py-2 bg-muted rounded-md flex items-center gap-2 min-w-[80px] justify-center hover:scale-105 transition-transform duration-200">
                {toCurrency === 'KTA' && <img src={ktaLogo} alt="KTA" className="w-5 h-5 rounded-full animate-pulse" />}
                {toCurrency === 'XRGE' && <img src={xrgeLogo} alt="XRGE" className="w-5 h-5 rounded-full animate-pulse" />}
                <span className="font-bold text-foreground">{toCurrency}</span>
              </div>
            </div>
            <div className="mt-1 space-y-0.5">
              {isConnected && (
                <p className="text-xs text-muted-foreground">
                  Balance: {
                    toCurrency === 'KTA' 
                      ? (balance || "0.000000")
                      : (tokens.find(t => t.symbol === toCurrency)?.balance || "0.000000")
                  } {toCurrency}
                </p>
              )}
              {toAmount && parseFloat(toAmount) > 0 && (
                <p className="text-xs text-accent">
                  ≈ {formatUsd(getUsdValue(parseFloat(toAmount), toCurrency as 'KTA' | 'XRGE'))}
                </p>
              )}
            </div>
          </div>

          {/* Price Impact Display */}
          {priceImpact !== null && fromAmount && parseFloat(fromAmount) > 0 && (
            <div className={`mb-4 p-3 rounded-lg border animate-fade-in hover-scale transition-all duration-200 ${
              priceImpact < 1 
                ? 'bg-green-500/10 border-green-500/20' 
                : priceImpact < 5 
                ? 'bg-yellow-500/10 border-yellow-500/20'
                : 'bg-red-500/10 border-red-500/20'
            }`}>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Price Impact</span>
                <span className={`text-sm font-bold ${
                  priceImpact < 1 
                    ? 'text-green-500' 
                    : priceImpact < 5 
                    ? 'text-yellow-500 animate-pulse'
                    : 'text-red-500 animate-pulse'
                }`}>
                  {priceImpact < 0.01 ? '<0.01' : priceImpact.toFixed(2)}%
                </span>
              </div>
              {priceImpact >= 5 && (
                <p className="text-xs text-red-500 mt-1 animate-pulse">
                  ⚠️ High price impact! This trade will significantly affect the pool.
                </p>
              )}
              {priceImpact >= 1 && priceImpact < 5 && (
                <p className="text-xs text-yellow-600 mt-1">
                  Moderate price impact. Consider splitting into smaller trades.
                </p>
              )}
            </div>
          )}


          {/* Swap Action Button */}
          <Button
            onClick={handleSwap}
            disabled={!isConnected || isLoading || !fromAmount}
            className="w-full hover:scale-105 transition-all duration-300 neon-glow hover:shadow-2xl"
            size="lg"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                <span className="animate-pulse">Swapping...</span>
              </>
            ) : !isConnected ? (
              "Connect Wallet to Swap"
            ) : (
              <span className="animate-pulse">Swap</span>
          )}
          </Button>

          {/* Slippage Settings */}
          <div className="mt-4 p-3 bg-muted/50 rounded-lg animate-fade-in">
            <label className="text-xs text-muted-foreground mb-2 block">
              Slippage Tolerance
            </label>
            <div className="flex gap-2">
              {[0.5, 1, 3, 5].map((percentage) => (
                <Button
                  key={percentage}
                  variant={slippage === percentage ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSlippage(percentage)}
                  className="flex-1 min-w-[50px] hover:scale-110 transition-all duration-200"
                >
                  {percentage}%
                </Button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Maximum acceptable rate change during swap execution
            </p>
          </div>
        </Card>
      </div>

      {/* Right column: Trading Chart */}
      <div className="w-full lg:min-w-0 animate-fade-in">
        <TradingChart fromToken={fromCurrency} toToken={toCurrency} network={network} />
      </div>
    </div>

    {/* Anchor Liquidity Status */}
        {isRefreshing ? (
          <Card className="mt-4 md:mt-6 p-4 md:p-6 glass border-border/50 shadow-none">
            <div className="flex items-center justify-between mb-4">
              <div className="h-5 w-48 bg-muted animate-pulse rounded"></div>
              <div className="h-8 w-8 bg-muted animate-pulse rounded-full"></div>
            </div>
            
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="p-3 bg-muted rounded-lg">
                <div className="h-3 w-20 bg-muted-foreground/20 animate-pulse rounded mb-2"></div>
                <div className="h-6 w-24 bg-muted-foreground/20 animate-pulse rounded"></div>
              </div>
              <div className="p-3 bg-muted rounded-lg">
                <div className="h-3 w-20 bg-muted-foreground/20 animate-pulse rounded mb-2"></div>
                <div className="h-6 w-24 bg-muted-foreground/20 animate-pulse rounded"></div>
              </div>
            </div>
            
            <div className="p-3 bg-muted/50 rounded-lg">
              <div className="h-3 w-24 bg-muted-foreground/20 animate-pulse rounded mb-2"></div>
              <div className="h-4 w-full bg-muted-foreground/20 animate-pulse rounded"></div>
            </div>
          </Card>
        ) : anchorInfo ? (
          <Card className="mt-4 md:mt-6 p-4 md:p-6 bg-card border-border animate-scale-in hover-scale transition-all duration-300">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-base md:text-lg text-foreground neon-glow-secondary">
                FX Anchor Liquidity
              </h3>
              <div className="flex items-center gap-2">
                <AddLiquidityDialog 
                  anchorAddress={anchorInfo.address}
                  anchorInfo={anchorInfo}
                  onSuccess={() => {
                    fetchAnchorInfo();
                    refreshBalance();
                  }}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={fetchAnchorInfo}
                  disabled={isRefreshing}
                  className="h-8 w-8 hover:rotate-180 transition-all duration-300"
                >
                  <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                </Button>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="p-2 md:p-3 bg-muted rounded-lg hover:scale-105 transition-transform duration-200 animate-fade-in overflow-hidden">
                <div className="text-xs text-muted-foreground mb-1">KTA Balance</div>
                <div className="font-bold text-sm md:text-lg break-words">{parseFloat(anchorInfo.ktaBalance || '0').toFixed(3)} KTA</div>
              </div>
              <div className="p-2 md:p-3 bg-muted rounded-lg hover:scale-105 transition-transform duration-200 animate-fade-in overflow-hidden">
                <div className="text-xs text-muted-foreground mb-1">XRGE Balance</div>
                <div className="font-bold text-sm md:text-lg break-words">{parseFloat(anchorInfo.xrgeBalance || '0').toFixed(3)} XRGE</div>
              </div>
            </div>
            
            <div className="p-3 bg-muted/50 rounded-lg animate-fade-in">
              <div className="text-xs text-muted-foreground mb-1">Anchor Address</div>
              <div className="font-mono text-xs break-all">{anchorInfo.address}</div>
            </div>
          </Card>
        ) : null}

        {/* Transaction History */}
        <Card className="mt-6 p-6 glass-card hover-scale transition-all duration-300 animate-fade-in">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-bold neon-glow-secondary">Recent Swaps</h3>
            <Button
              variant="ghost"
              size="icon"
              onClick={fetchTransactions}
              disabled={isLoadingTx}
              className="h-8 w-8 hover:rotate-180 transition-all duration-300"
            >
              <RefreshCw className={`h-4 w-4 ${isLoadingTx ? 'animate-spin' : ''}`} />
            </Button>
          </div>
          <ScrollArea className="h-[400px] w-full">
            {isLoadingTx ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="animate-fade-in">Time</TableHead>
                    <TableHead className="animate-fade-in">Type</TableHead>
                    <TableHead className="text-right animate-fade-in">Amount</TableHead>
                    <TableHead className="text-right animate-fade-in">Rate (KTA/XRGE)</TableHead>
                    <TableHead className="text-right animate-fade-in">USD Value</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.map((tx, index) => {
                    const time = new Date(tx.timestamp).toLocaleTimeString();
                    // BUY XRGE = spending KTA to get XRGE (green)
                    // SELL XRGE = spending XRGE to get KTA (red)
                    const isBuyingXRGE = tx.from_token === "KTA";
                    const label = isBuyingXRGE ? "BUY XRGE" : "SELL XRGE";
                    const inputAmount = tx.volume_24h || 0;
                    const outputAmount = inputAmount * (tx.rate || 0);
                    
                    // Normalize rate to always show KTA per XRGE for consistency
                    // If from_token is KTA, rate is XRGE/KTA, so invert it to get KTA/XRGE
                    // If from_token is XRGE, rate is already KTA/XRGE
                    const normalizedRate = isBuyingXRGE ? (1 / tx.rate) : tx.rate;
                    
                    // Calculate USD value
                    let usdValue = 0;
                    if (marketData) {
                      if (tx.from_token === "KTA" && marketData.kta) {
                        usdValue = inputAmount * marketData.kta.price;
                      } else if (tx.from_token === "XRGE" && marketData.xrge) {
                        usdValue = inputAmount * marketData.xrge.price;
                      }
                    }
                    
                    return (
                      <TableRow 
                        key={tx.id}
                        className="hover-scale transition-all duration-200"
                        style={{ animationDelay: `${index * 50}ms` }}
                      >
                        <TableCell className="font-mono text-xs animate-fade-in">
                          {time}
                        </TableCell>
                        <TableCell>
                          <span 
                            className={`px-2 py-1 rounded text-xs font-bold ${
                              isBuyingXRGE
                                ? "bg-green-500/20 text-green-400" 
                                : "bg-red-500/20 text-red-400"
                            }`}
                          >
                            {label}
                          </span>
                        </TableCell>
                        <TableCell className="text-right font-mono animate-fade-in">
                          {inputAmount.toFixed(4)} {tx.from_token} → {outputAmount.toFixed(4)} {tx.to_token}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs animate-fade-in">
                          {normalizedRate.toFixed(8)} KTA
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm animate-fade-in text-green-400">
                          {usdValue > 0 ? `$${usdValue.toFixed(2)}` : '-'}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {transactions.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground animate-fade-in">
                        No transactions found
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </ScrollArea>
        </Card>
      </div>
    </div>
  );
};

export default Swap;
