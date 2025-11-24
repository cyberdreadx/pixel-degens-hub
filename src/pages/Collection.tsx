import NFTCard from "@/components/NFTCard";
import { Button } from "@/components/ui/button";
import { Filter, Search, Sparkles } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useWallet } from "@/contexts/WalletContext";
import { ipfsToHttp } from "@/utils/nftUtils";
import { Link } from "react-router-dom";
import nft1 from "@/assets/nft1.png";
import nft2 from "@/assets/nft2.png";
import nft3 from "@/assets/nft3.png";
import nft4 from "@/assets/nft4.png";
import nft5 from "@/assets/nft5.png";
import nft6 from "@/assets/nft6.png";

const mockNFTs = [
  {
    id: "1",
    title: "CYBER ROBOT #001",
    creator: "0xDEGEN",
    price: "0.5",
    image: nft1,
    likes: 42,
    comments: 12,
  },
  {
    id: "2",
    title: "ALIEN SUPREME #069",
    creator: "0xVIBE",
    price: "1.2",
    image: nft2,
    likes: 88,
    comments: 23,
  },
  {
    id: "3",
    title: "SPACE WARRIOR #420",
    creator: "0xMOON",
    price: "0.8",
    image: nft3,
    likes: 156,
    comments: 45,
  },
  {
    id: "4",
    title: "PIXEL CAT #777",
    creator: "0xWHALE",
    price: "2.1",
    image: nft4,
    likes: 234,
    comments: 67,
  },
  {
    id: "5",
    title: "MYSTIC WIZARD #333",
    creator: "0xMAGIC",
    price: "1.5",
    image: nft5,
    likes: 99,
    comments: 34,
  },
  {
    id: "6",
    title: "ASTRO VOYAGER #888",
    creator: "0xSTAR",
    price: "0.9",
    image: nft6,
    likes: 167,
    comments: 52,
  },
];

const Collection = () => {
  const { tokens, isConnected } = useWallet();
  
  // Filter for NFTs only
  const nfts = tokens.filter(token => token.isNFT && token.metadata);
  
  return (
    <div className="relative min-h-screen pt-24 pb-16">
      <div className="container mx-auto px-4">
        {/* Header */}
        <div className="mb-8 space-y-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl md:text-5xl font-bold neon-glow">NFT COLLECTION</h1>
            <p className="text-xs md:text-sm text-muted-foreground">
              {isConnected ? `YOUR DEGEN 8BIT NFTS (${nfts.length})` : 'CONNECT WALLET TO VIEW YOUR NFTS'}
            </p>
          </div>
          <Link to="/mint">
            <Button className="pixel-border-thick gap-2">
              <Sparkles className="w-4 h-4" />
              MINT NFT
            </Button>
          </Link>
        </div>

        {/* Content */}
        {!isConnected ? (
          <div className="text-center py-20 space-y-4">
            <div className="text-6xl">🔒</div>
            <h2 className="text-2xl font-bold">CONNECT YOUR WALLET</h2>
            <p className="text-sm text-muted-foreground">
              Connect your Keeta wallet to view your NFT collection
            </p>
          </div>
        ) : nfts.length === 0 ? (
          <div className="text-center py-20 space-y-4">
            <div className="text-6xl">🎨</div>
            <h2 className="text-2xl font-bold">NO NFTS YET</h2>
            <p className="text-sm text-muted-foreground">
              Mint your first Degen 8bit NFT to get started
            </p>
            <Link to="/mint">
              <Button className="pixel-border-thick gap-2 mt-4">
                <Sparkles className="w-4 h-4" />
                MINT YOUR FIRST NFT
              </Button>
            </Link>
          </div>
        ) : (
          <>
            {/* Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {nfts.map((nft) => (
                <NFTCard 
                  key={nft.address}
                  id={nft.address}
                  title={nft.metadata.name || nft.name}
                  creator={nft.metadata.version || "degen8bit v1.0"}
                  price={nft.balance}
                  image={ipfsToHttp(nft.metadata.image)}
                  likes={0}
                  comments={0}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default Collection;
