import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ExternalLink, Copy } from "lucide-react";
import { useParams, Link } from "react-router-dom";
import { useWallet } from "@/contexts/WalletContext";
import { ipfsToHttp } from "@/utils/nftUtils";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

const NFTDetail = () => {
  const { id } = useParams(); // This is the token address
  const { tokens, isConnected, network, publicKey } = useWallet();

  // Find the NFT by token address
  const nft = tokens.find(token => token.address === id && token.isNFT);

  const copyAddress = () => {
    if (id) {
      navigator.clipboard.writeText(id);
      toast.success("Contract address copied!");
    }
  };

  const explorerUrl = network === 'test' 
    ? `https://explorer.test.keeta.com/token/${id}`
    : `https://explorer.keeta.com/token/${id}`;

  if (!isConnected) {
    return (
      <div className="min-h-screen pt-24 pb-16 px-4 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="text-6xl">🔒</div>
          <h2 className="text-2xl font-bold">CONNECT YOUR WALLET</h2>
          <p className="text-sm text-muted-foreground">
            Connect your wallet to view NFT details
          </p>
        </div>
      </div>
    );
  }

  if (!nft) {
    return (
      <div className="min-h-screen pt-24 pb-16 px-4">
        <div className="container mx-auto">
          <Link to="/collection" className="text-xs text-primary hover:underline mb-6 inline-block">
            ← BACK TO COLLECTION
          </Link>
          <div className="text-center py-20 space-y-4">
            <div className="text-6xl">❌</div>
            <h2 className="text-2xl font-bold">NFT NOT FOUND</h2>
            <p className="text-sm text-muted-foreground">
              This NFT doesn't exist in your collection
            </p>
          </div>
        </div>
      </div>
    );
  }

  const metadata = nft.metadata;
  const imageUrl = metadata?.image ? ipfsToHttp(metadata.image) : '';

  return (
    <div className="min-h-screen pt-24 pb-16 px-4">
      <div className="container mx-auto">
        <Link to="/collection" className="text-xs text-primary hover:underline mb-6 md:mb-8 inline-block">
          ← BACK TO COLLECTION
        </Link>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8">
          {/* Image Section */}
          <div className="space-y-4">
            <div className="aspect-square bg-muted pixel-border-thick overflow-hidden">
              {imageUrl ? (
                <img 
                  src={imageUrl} 
                  alt={metadata.name || 'NFT'}
                  className="w-full h-full object-cover"
                  style={{ imageRendering: "pixelated" }}
                />
              ) : (
                <Skeleton className="w-full h-full" />
              )}
            </div>
          </div>

          {/* Details Section */}
          <div className="space-y-4 md:space-y-6">
            <div>
              {metadata?.platform && (
                <div className="inline-block pixel-border bg-secondary/20 px-3 py-1 mb-3 md:mb-4">
                  <span className="text-xs neon-glow-secondary">{metadata.platform.toUpperCase()}</span>
                </div>
              )}
              <h1 className="text-2xl md:text-3xl lg:text-5xl font-bold neon-glow mb-3 md:mb-4">
                {metadata?.name || nft.name}
              </h1>
              <p className="text-xs md:text-sm text-muted-foreground">
                Owned by <span className="text-primary">{publicKey?.substring(0, 8)}...{publicKey?.substring(publicKey.length - 6)}</span>
              </p>
            </div>

            {/* Contract Address */}
            <Card className="pixel-border-thick bg-card">
              <CardContent className="p-4 md:p-6 space-y-3">
                <h3 className="font-bold text-xs md:text-sm">CONTRACT ADDRESS</h3>
                <div className="flex items-center gap-2 bg-muted p-3 pixel-border">
                  <code className="text-xs flex-1 truncate">{id}</code>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-8 w-8 flex-shrink-0"
                    onClick={copyAddress}
                  >
                    <Copy className="w-3 h-3" />
                  </Button>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full pixel-border gap-2 text-xs"
                  onClick={() => window.open(explorerUrl, '_blank')}
                >
                  <ExternalLink className="w-3 h-3" />
                  VIEW ON {network === 'test' ? 'TESTNET' : 'MAINNET'} EXPLORER
                </Button>
              </CardContent>
            </Card>

            {/* Traits/Attributes */}
            {metadata?.attributes && metadata.attributes.length > 0 && (
              <Card className="pixel-border-thick bg-card">
                <CardContent className="p-4 md:p-6 space-y-4">
                  <h3 className="font-bold text-xs md:text-sm">TRAITS</h3>
                  <div className="grid grid-cols-2 gap-2 md:gap-3">
                    {metadata.attributes.map((attr, idx) => (
                      <div key={idx} className="pixel-border bg-muted p-3">
                        <div className="text-xs text-muted-foreground">{attr.trait_type.toUpperCase()}</div>
                        <div className="font-bold text-xs mt-1">{attr.value}</div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Description */}
            {metadata?.description && (
              <Card className="pixel-border-thick bg-card">
                <CardContent className="p-4 md:p-6 space-y-4">
                  <h3 className="font-bold text-xs md:text-sm">DESCRIPTION</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {metadata.description}
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Token Info */}
            <Card className="pixel-border-thick bg-card">
              <CardContent className="p-4 md:p-6 space-y-3">
                <h3 className="font-bold text-xs md:text-sm">TOKEN INFO</h3>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Network:</span>
                    <span className="font-bold">{network === 'test' ? 'Testnet' : 'Mainnet'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Supply:</span>
                    <span className="font-bold">{nft.balance}</span>
                  </div>
                  {metadata?.identifier && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Identifier:</span>
                      <span className="font-bold truncate max-w-[200px]">{metadata.identifier}</span>
                    </div>
                  )}
                  {metadata?.nft_id && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">NFT ID:</span>
                      <span className="font-bold">#{metadata.nft_id}</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NFTDetail;
