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
    <div className="flex min-h-screen items-center justify-center pt-24 pb-16">
      <div className="text-center space-y-4">
        <h1 className="text-4xl md:text-6xl font-bold neon-glow">COMING SOON</h1>
        <p className="text-sm md:text-base text-muted-foreground">
          THIS PAGE IS UNDER CONSTRUCTION
        </p>
      </div>
    </div>
  );
};

export default Collection;
