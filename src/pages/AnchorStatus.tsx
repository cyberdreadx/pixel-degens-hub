import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useWallet } from "@/contexts/WalletContext";
import { toast } from "sonner";
import { Copy, ExternalLink, RefreshCw } from "lucide-react";

const AnchorStatus = () => {
  const { network } = useWallet();
  const [anchorInfo, setAnchorInfo] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchAnchorInfo = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('fx-anchor-info', {
        body: { network }
      });

      if (error) throw error;
      setAnchorInfo(data);
    } catch (error: any) {
      console.error('Failed to fetch anchor info:', error);
      toast.error('Failed to load anchor status');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAnchorInfo();
  }, [network]);

  const copyAddress = () => {
    if (anchorInfo?.address) {
      navigator.clipboard.writeText(anchorInfo.address);
      toast.success('Anchor address copied!');
    }
  };

  const openExplorer = () => {
    if (anchorInfo?.address) {
      const explorerUrl = network === 'test' 
        ? `https://test.network.keeta.com/address/${anchorInfo.address}`
        : `https://network.keeta.com/address/${anchorInfo.address}`;
      window.open(explorerUrl, '_blank');
    }
  };

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-foreground">
              Anchor Status
            </h1>
            <p className="text-muted-foreground mt-2">
              {network === "main" ? "Mainnet" : "Testnet"} FX Anchor Wallet Information
            </p>
          </div>
          <Button onClick={fetchAnchorInfo} disabled={isLoading} size="sm">
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {anchorInfo && (
          <>
            {/* Anchor Address Card */}
            <Card className="p-6 glass border-border/50">
              <h2 className="text-xl font-bold text-foreground mb-4">Anchor Wallet Address</h2>
              <div className="space-y-4">
                <div className="bg-muted/50 rounded-lg p-4 break-all font-mono text-sm">
                  {anchorInfo.address}
                </div>
                <div className="flex gap-2 flex-wrap">
                  <Button onClick={copyAddress} variant="outline" size="sm">
                    <Copy className="h-4 w-4 mr-2" />
                    Copy Address
                  </Button>
                  <Button onClick={openExplorer} variant="outline" size="sm">
                    <ExternalLink className="h-4 w-4 mr-2" />
                    View on Explorer
                  </Button>
                </div>
                {anchorInfo.note && (
                  <div className="text-sm text-muted-foreground bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3">
                    ℹ️ {anchorInfo.note}
                  </div>
                )}
              </div>
            </Card>

            {/* Balance Card */}
            <Card className="p-6 glass border-border/50">
              <h2 className="text-xl font-bold text-foreground mb-4">Liquidity Pool Balances</h2>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="bg-muted/50 rounded-lg p-4">
                  <div className="text-sm text-muted-foreground mb-1">KTA Balance</div>
                  <div className="text-2xl font-bold text-foreground">
                    {parseFloat(anchorInfo.ktaBalance || '0').toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 6
                    })}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">KTA</div>
                </div>
                <div className="bg-muted/50 rounded-lg p-4">
                  <div className="text-sm text-muted-foreground mb-1">XRGE Balance</div>
                  <div className="text-2xl font-bold text-foreground">
                    {parseFloat(anchorInfo.xrgeBalance || '0').toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 6
                    })}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">XRGE</div>
                </div>
              </div>
            </Card>

            {/* Warning for insufficient liquidity */}
            {(parseFloat(anchorInfo.ktaBalance || '0') < 100 || parseFloat(anchorInfo.xrgeBalance || '0') < 1000000) && (
              <Card className="p-6 glass border-red-500/50 bg-red-500/5">
                <h3 className="text-lg font-bold text-red-500 mb-2">⚠️ Insufficient Liquidity</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  The anchor wallet needs more tokens to enable swaps. Send both KTA and XRGE to the anchor address above to add liquidity.
                </p>
                <div className="text-sm space-y-1">
                  <div>• Recommended minimum: 1,000 KTA</div>
                  <div>• Recommended minimum: 10,000,000 XRGE</div>
                </div>
              </Card>
            )}

            {/* How to Fund */}
            <Card className="p-6 glass border-border/50">
              <h2 className="text-xl font-bold text-foreground mb-4">How to Add Liquidity</h2>
              <div className="space-y-3 text-sm text-muted-foreground">
                <p>1. Copy the anchor wallet address above</p>
                <p>2. Go to the Swap page and connect your wallet</p>
                <p>3. Use "Send Tokens" in your wallet to transfer KTA and XRGE to the anchor address</p>
                <p>4. Wait for the transaction to confirm (~30 seconds)</p>
                <p>5. Click "Refresh" above to see updated balances</p>
              </div>
            </Card>
          </>
        )}
      </div>
    </div>
  );
};

export default AnchorStatus;
