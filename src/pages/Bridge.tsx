import { useState, useEffect } from "react";
import { useWallet } from "@/contexts/WalletContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, Wallet, Loader2, RefreshCw, Copy, CheckCircle2, AlertCircle } from "lucide-react";
import { toast } from "sonner";

// Extend Window interface for MetaMask
declare global {
  interface Window {
    ethereum?: any;
  }
}

// MetaMask/BASE wallet types
interface BaseWallet {
  address: string | null;
  isConnected: boolean;
}

// Transfer status types
interface TransferStatus {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  fromChain: 'BASE' | 'Keeta';
  toChain: 'BASE' | 'Keeta';
  token: string;
  amount: string;
  timestamp: number;
}

const Bridge = () => {
  const { isConnected: keetaConnected, publicKey: keetaAddress, client } = useWallet();
  
  // BASE wallet state
  const [baseWallet, setBaseWallet] = useState<BaseWallet>({ address: null, isConnected: false });
  const [isConnectingBase, setIsConnectingBase] = useState(false);
  
  // Bridge state
  const [bridgeClient, setBridgeClient] = useState<any>(null);
  const [providers, setProviders] = useState<any[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<any>(null);
  const [isLoadingProviders, setIsLoadingProviders] = useState(false);
  
  // Transfer state
  const [transferAmount, setTransferAmount] = useState("");
  const [selectedToken, setSelectedToken] = useState<"KTA" | "XRGE">("KTA");
  const [isTransferring, setIsTransferring] = useState(false);
  const [activeTransfers, setActiveTransfers] = useState<TransferStatus[]>([]);
  
  // Persistent address state
  const [persistentAddress, setPersistentAddress] = useState<string | null>(null);
  const [isGeneratingAddress, setIsGeneratingAddress] = useState(false);

  // Initialize bridge client when Keeta wallet connects
  useEffect(() => {
    if (client && keetaConnected) {
      try {
        // Note: Bridge client initialization will be available when @keetanetwork/anchor is properly imported
        // For now, we'll show the UI and indicate providers are coming soon
        console.log("Bridge functionality coming soon");
      } catch (error) {
        console.error("Failed to initialize bridge client:", error);
      }
    }
  }, [client, keetaConnected]);

  // Fetch available bridge providers
  const fetchProviders = async () => {
    // Bridge provider discovery will be implemented when anchor service is available
    setIsLoadingProviders(false);
    console.log("Bridge providers will be loaded from anchor service");
  };

  // Load providers when bridge client is ready
  useEffect(() => {
    if (bridgeClient) {
      fetchProviders();
    }
  }, [bridgeClient]);

  // Connect MetaMask for BASE network
  const connectBaseWallet = async () => {
    if (typeof window.ethereum === 'undefined') {
      toast.error("MetaMask not installed. Please install MetaMask to bridge from BASE.");
      return;
    }
    
    setIsConnectingBase(true);
    try {
      // Request account access
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      
      // Switch to BASE network (chain ID: 8453)
      try {
        await window.ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: '0x2105' }], // 8453 in hex
        });
      } catch (switchError: any) {
        // Chain not added, add it
        if (switchError.code === 4902) {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [{
              chainId: '0x2105',
              chainName: 'Base',
              nativeCurrency: { name: 'Ethereum', symbol: 'ETH', decimals: 18 },
              rpcUrls: ['https://mainnet.base.org'],
              blockExplorerUrls: ['https://basescan.org']
            }]
          });
        } else {
          throw switchError;
        }
      }
      
      setBaseWallet({ address: accounts[0], isConnected: true });
      toast.success(`BASE wallet connected: ${accounts[0].slice(0, 6)}...${accounts[0].slice(-4)}`);
    } catch (error) {
      console.error("Failed to connect BASE wallet:", error);
      toast.error("Failed to connect BASE wallet");
    } finally {
      setIsConnectingBase(false);
    }
  };

  // Initiate deposit (BASE → Keeta)
  const initiateDeposit = async () => {
    if (!selectedProvider || !baseWallet.isConnected || !keetaAddress) {
      toast.error("Please connect both BASE and Keeta wallets");
      return;
    }
    
    if (!transferAmount || parseFloat(transferAmount) <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }
    
    setIsTransferring(true);
    try {
      // Initiate transfer request
      const transfer = await selectedProvider.initiateTransfer({
        asset: selectedToken === 'KTA' 
          ? 'keeta_anqdilpazdekdu4acw65fj7smltcp26wbrildkqtszqvverljpwpezmd44ssg'
          : 'keeta_aolgxwrcepccr5ycg5ctp3ezhhp6vnpitzm7grymm63hzbaqk6lcsbtccgur6',
        amount: transferAmount,
        destination: keetaAddress,
        source: baseWallet.address
      });
      
      // Add to active transfers
      const newTransfer: TransferStatus = {
        id: transfer.transferId,
        status: 'pending',
        fromChain: 'BASE',
        toChain: 'Keeta',
        token: selectedToken,
        amount: transferAmount,
        timestamp: Date.now()
      };
      
      setActiveTransfers(prev => [newTransfer, ...prev]);
      
      // Show deposit instructions
      const instructions = transfer.instructions[0];
      toast.success(
        `Deposit initiated! Send ${transferAmount} ${selectedToken} to: ${instructions.address}`,
        { duration: 10000 }
      );
      
      setTransferAmount("");
      
      // Poll for status updates
      pollTransferStatus(transfer);
    } catch (error: any) {
      console.error("Deposit failed:", error);
      toast.error(error.message || "Failed to initiate deposit");
    } finally {
      setIsTransferring(false);
    }
  };

  // Initiate withdrawal (Keeta → BASE)
  const initiateWithdrawal = async () => {
    if (!selectedProvider || !keetaConnected || !baseWallet.address) {
      toast.error("Please connect both Keeta and BASE wallets");
      return;
    }
    
    if (!transferAmount || parseFloat(transferAmount) <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }
    
    setIsTransferring(true);
    try {
      // Initiate transfer request
      const transfer = await selectedProvider.initiateTransfer({
        asset: selectedToken === 'KTA' 
          ? 'keeta_anqdilpazdekdu4acw65fj7smltcp26wbrildkqtszqvverljpwpezmd44ssg'
          : 'keeta_aolgxwrcepccr5ycg5ctp3ezhhp6vnpitzm7grymm63hzbaqk6lcsbtccgur6',
        amount: transferAmount,
        destination: baseWallet.address,
        source: keetaAddress
      });
      
      // Add to active transfers
      const newTransfer: TransferStatus = {
        id: transfer.transferId,
        status: 'pending',
        fromChain: 'Keeta',
        toChain: 'BASE',
        token: selectedToken,
        amount: transferAmount,
        timestamp: Date.now()
      };
      
      setActiveTransfers(prev => [newTransfer, ...prev]);
      
      toast.success("Withdrawal initiated! Processing...");
      setTransferAmount("");
      
      // Poll for status updates
      pollTransferStatus(transfer);
    } catch (error: any) {
      console.error("Withdrawal failed:", error);
      toast.error(error.message || "Failed to initiate withdrawal");
    } finally {
      setIsTransferring(false);
    }
  };

  // Poll transfer status
  const pollTransferStatus = async (transfer: any) => {
    const pollInterval = setInterval(async () => {
      try {
        const status = await transfer.getTransferStatus();
        
        // Update transfer status in state
        setActiveTransfers(prev => 
          prev.map(t => 
            t.id === transfer.transferId 
              ? { ...t, status: status.status }
              : t
          )
        );
        
        // Stop polling if completed or failed
        if (status.status === 'completed' || status.status === 'failed') {
          clearInterval(pollInterval);
          
          if (status.status === 'completed') {
            toast.success("Transfer completed successfully!");
          } else {
            toast.error("Transfer failed");
          }
        }
      } catch (error) {
        console.error("Failed to poll status:", error);
      }
    }, 5000); // Poll every 5 seconds
    
    // Clear interval after 5 minutes
    setTimeout(() => clearInterval(pollInterval), 300000);
  };

  // Generate persistent forwarding address
  const generatePersistentAddress = async () => {
    if (!selectedProvider || !keetaAddress) {
      toast.error("Please connect Keeta wallet first");
      return;
    }
    
    setIsGeneratingAddress(true);
    try {
      const result = await selectedProvider.createPersistentForwardingAddress({
        asset: 'keeta_anqdilpazdekdu4acw65fj7smltcp26wbrildkqtszqvverljpwpezmd44ssg', // KTA
        destination: keetaAddress
      });
      
      if (result?.address) {
        setPersistentAddress(result.address);
        toast.success("Persistent address created!");
      }
    } catch (error) {
      console.error("Failed to generate address:", error);
      toast.error("Failed to generate persistent address");
    } finally {
      setIsGeneratingAddress(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard!");
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      case 'failed':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      case 'processing':
        return <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />;
      default:
        return <Loader2 className="w-4 h-4 text-yellow-500 animate-spin" />;
    }
  };

  return (
    <div className="min-h-screen bg-background pt-20 px-4 pb-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl md:text-4xl font-bold text-center mb-2 text-foreground">
          Cross-Chain Bridge
        </h1>
        <p className="text-center text-muted-foreground mb-8">
          Transfer KTA and XRGE between BASE and Keeta networks
        </p>

        {/* Wallet Connection Status */}
        <Card className="p-4 mb-6 bg-card border-border">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="text-xs text-muted-foreground">BASE Network</div>
              {baseWallet.isConnected ? (
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/30">
                    Connected
                  </Badge>
                  <span className="text-sm font-mono">
                    {baseWallet.address?.slice(0, 6)}...{baseWallet.address?.slice(-4)}
                  </span>
                </div>
              ) : (
                <Button
                  onClick={connectBaseWallet}
                  disabled={isConnectingBase}
                  size="sm"
                  variant="outline"
                >
                  {isConnectingBase ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Connecting...
                    </>
                  ) : (
                    <>
                      <Wallet className="mr-2 h-4 w-4" />
                      Connect MetaMask
                    </>
                  )}
                </Button>
              )}
            </div>
            
            <div className="space-y-2">
              <div className="text-xs text-muted-foreground">Keeta Network</div>
              {keetaConnected ? (
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/30">
                    Connected
                  </Badge>
                  <span className="text-sm font-mono">
                    {keetaAddress?.slice(0, 10)}...{keetaAddress?.slice(-6)}
                  </span>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Connect wallet in navigation</p>
              )}
            </div>
          </div>
        </Card>

        {/* Bridge Interface */}
        <Tabs defaultValue="deposit" className="mb-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="deposit">Deposit to Keeta</TabsTrigger>
            <TabsTrigger value="withdraw">Withdraw to BASE</TabsTrigger>
          </TabsList>

          <TabsContent value="deposit">
            <Card className="p-6 bg-card border-border">
              <div className="space-y-4">
                <div>
                  <label className="text-sm text-muted-foreground mb-2 block">
                    Token
                  </label>
                  <div className="flex gap-2">
                    <Button
                      variant={selectedToken === "KTA" ? "default" : "outline"}
                      onClick={() => setSelectedToken("KTA")}
                      className="flex-1"
                    >
                      KTA
                    </Button>
                    <Button
                      variant={selectedToken === "XRGE" ? "default" : "outline"}
                      onClick={() => setSelectedToken("XRGE")}
                      className="flex-1"
                    >
                      XRGE
                    </Button>
                  </div>
                </div>

                <div>
                  <label className="text-sm text-muted-foreground mb-2 block">
                    Amount
                  </label>
                  <Input
                    type="number"
                    placeholder="0.0"
                    value={transferAmount}
                    onChange={(e) => setTransferAmount(e.target.value)}
                  />
                </div>

                <div className="flex items-center justify-center py-4">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <span className="text-sm">BASE</span>
                    <ArrowRight className="w-4 h-4" />
                    <span className="text-sm">Keeta</span>
                  </div>
                </div>

                <Button
                  onClick={initiateDeposit}
                  disabled={!baseWallet.isConnected || !keetaConnected || isTransferring || !selectedProvider}
                  className="w-full"
                  size="lg"
                >
                  {isTransferring ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Initiating...
                    </>
                  ) : (
                    "Initiate Deposit"
                  )}
                </Button>

                {!selectedProvider && (
                  <p className="text-xs text-center text-muted-foreground">
                    No bridge providers available yet. Check back soon!
                  </p>
                )}
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="withdraw">
            <Card className="p-6 bg-card border-border">
              <div className="space-y-4">
                <div>
                  <label className="text-sm text-muted-foreground mb-2 block">
                    Token
                  </label>
                  <div className="flex gap-2">
                    <Button
                      variant={selectedToken === "KTA" ? "default" : "outline"}
                      onClick={() => setSelectedToken("KTA")}
                      className="flex-1"
                    >
                      KTA
                    </Button>
                    <Button
                      variant={selectedToken === "XRGE" ? "default" : "outline"}
                      onClick={() => setSelectedToken("XRGE")}
                      className="flex-1"
                    >
                      XRGE
                    </Button>
                  </div>
                </div>

                <div>
                  <label className="text-sm text-muted-foreground mb-2 block">
                    Amount
                  </label>
                  <Input
                    type="number"
                    placeholder="0.0"
                    value={transferAmount}
                    onChange={(e) => setTransferAmount(e.target.value)}
                  />
                </div>

                <div className="flex items-center justify-center py-4">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <span className="text-sm">Keeta</span>
                    <ArrowRight className="w-4 h-4" />
                    <span className="text-sm">BASE</span>
                  </div>
                </div>

                <Button
                  onClick={initiateWithdrawal}
                  disabled={!keetaConnected || !baseWallet.isConnected || isTransferring || !selectedProvider}
                  className="w-full"
                  size="lg"
                >
                  {isTransferring ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Initiating...
                    </>
                  ) : (
                    "Initiate Withdrawal"
                  )}
                </Button>

                {!selectedProvider && (
                  <p className="text-xs text-center text-muted-foreground">
                    No bridge providers available yet. Check back soon!
                  </p>
                )}
              </div>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Persistent Address Generator */}
        <Card className="p-6 mb-6 bg-card border-border">
          <h3 className="font-semibold mb-4 text-foreground">Persistent Deposit Address</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Generate a permanent BASE address that automatically forwards deposits to your Keeta wallet
          </p>
          
          {persistentAddress ? (
            <div className="p-3 bg-muted rounded-lg">
              <div className="flex items-center justify-between">
                <span className="text-sm font-mono break-all">{persistentAddress}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copyToClipboard(persistentAddress)}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ) : (
            <Button
              onClick={generatePersistentAddress}
              disabled={isGeneratingAddress || !keetaConnected || !selectedProvider}
              variant="outline"
            >
              {isGeneratingAddress ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                "Generate Address"
              )}
            </Button>
          )}
        </Card>

        {/* Active Transfers */}
        {activeTransfers.length > 0 && (
          <Card className="p-6 bg-card border-border">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-foreground">Active Transfers</h3>
              <Button
                variant="ghost"
                size="icon"
                onClick={fetchProviders}
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
            
            <div className="space-y-3">
              {activeTransfers.map((transfer) => (
                <div
                  key={transfer.id}
                  className="p-3 bg-muted rounded-lg flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    {getStatusIcon(transfer.status)}
                    <div>
                      <div className="text-sm font-medium">
                        {transfer.amount} {transfer.token}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {transfer.fromChain} → {transfer.toChain}
                      </div>
                    </div>
                  </div>
                  <Badge variant="outline" className="capitalize">
                    {transfer.status}
                  </Badge>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Bridge Provider Status */}
        {isLoadingProviders && (
          <Card className="p-6 bg-card border-border">
            <div className="flex items-center justify-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm text-muted-foreground">Loading bridge providers...</span>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
};

export default Bridge;
