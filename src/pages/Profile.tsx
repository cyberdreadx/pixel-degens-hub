import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Settings, Share2 } from "lucide-react";
import NFTCard from "@/components/NFTCard";
import nft1 from "@/assets/nft1.png";
import nft4 from "@/assets/nft4.png";
import nft6 from "@/assets/nft6.png";

const ownedNFTs = [
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
    id: "4",
    title: "PIXEL CAT #777",
    creator: "0xWHALE",
    price: "2.1",
    image: nft4,
    likes: 234,
    comments: 67,
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

const Profile = () => {
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

export default Profile;
