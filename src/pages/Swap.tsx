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

  // Fetch anchor address on mount
  useEffect(() => {
    const fetchAnchorAddress = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('fx-anchor-info');
        if (error) throw error;
        setAnchorAddress(data.address);
      } catch (error) {
        console.error('Failed to fetch anchor address:', error);
        toast.error('Failed to connect to anchor');
      }
    };
    fetchAnchorAddress();
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
        <div className="mt-6 p-4 bg-muted rounded-lg">
          <h3 className="font-semibold text-foreground mb-2">About FX Anchor</h3>
          <p className="text-sm text-muted-foreground">
            This is your own FX anchor running on Lovable Cloud. It enables
            seamless token swaps between KTA and XRGE using exchange rates
            calculated in real-time.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Swap;
