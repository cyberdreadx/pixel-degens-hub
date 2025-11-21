import NFTCard from "@/components/NFTCard";
import { Button } from "@/components/ui/button";
import { Filter, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
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
  return (
    <div className="min-h-screen pt-24 pb-16">
      <div className="container mx-auto px-4">
        {/* Header */}
        <div className="mb-8 space-y-4">
          <h1 className="text-3xl md:text-5xl font-bold neon-glow">NFT COLLECTION</h1>
          <p className="text-xs md:text-sm text-muted-foreground">
            EXPLORE THE DOPEST 8-BIT DROPS
          </p>
        </div>

        {/* Filters */}
        <div className="mb-8 flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              placeholder="SEARCH NFTS..." 
              className="pl-10 pixel-border bg-card text-xs"
            />
          </div>
          <Button 
            variant="outline" 
            className="pixel-border gap-2 text-xs"
          >
            <Filter className="w-4 h-4" />
            FILTER
          </Button>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {mockNFTs.map((nft) => (
            <NFTCard key={nft.id} {...nft} />
          ))}
        </div>

        {/* Load More */}
        <div className="mt-12 text-center">
          <Button 
            variant="outline" 
            size="lg"
            className="pixel-border-thick text-xs"
          >
            LOAD MORE NFTS
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Collection;
