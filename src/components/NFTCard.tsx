import { Heart, MessageSquare } from "lucide-react";
import { Card, CardContent, CardFooter, CardHeader } from "./ui/card";
import { Button } from "./ui/button";
import { Link } from "react-router-dom";

interface NFTCardProps {
  id: string;
  title: string;
  creator: string;
  price: string;
  image: string;
  likes: number;
  comments: number;
}

const NFTCard = ({ id, title, creator, price, image, likes, comments }: NFTCardProps) => {
  return (
    <Link to={`/nft/${id}`}>
      <Card className="pixel-border-thick hover:border-secondary transition-all duration-300 hover:shadow-lg hover:shadow-secondary/50 cursor-pointer overflow-hidden bg-card">
        <CardHeader className="p-0">
          <div className="aspect-square overflow-hidden bg-muted relative flex items-center justify-center">
            <img 
              src={image} 
              alt={title}
              className="w-full h-full object-contain hover:scale-105 transition-transform duration-300"
              style={{ imageRendering: "pixelated" }}
            />
            <div className="absolute top-2 right-2 bg-primary pixel-border px-2 py-1 text-xs">
              {price} KTA
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="p-4 space-y-2">
          <h3 className="font-bold text-sm neon-glow truncate">{title}</h3>
          <p className="text-xs text-muted-foreground">by {creator}</p>
        </CardContent>
        
        <CardFooter className="p-4 pt-0 flex gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            className="flex-1 pixel-border text-xs gap-1"
            onClick={(e) => e.preventDefault()}
          >
            <Heart className="w-3 h-3" />
            {likes}
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            className="flex-1 pixel-border text-xs gap-1"
            onClick={(e) => e.preventDefault()}
          >
            <MessageSquare className="w-3 h-3" />
            {comments}
          </Button>
        </CardFooter>
      </Card>
    </Link>
  );
};

export default NFTCard;
