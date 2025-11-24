import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Heart, MessageSquare, Share2, ShoppingCart } from "lucide-react";
import { useParams, Link } from "react-router-dom";
import nft1 from "@/assets/nft1.png";
import { Textarea } from "@/components/ui/textarea";

const NFTDetail = () => {
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

export default NFTDetail;
