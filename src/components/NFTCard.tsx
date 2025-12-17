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
            <div className="absolute top-1 right-1 sm:top-2 sm:right-2 bg-primary pixel-border px-1.5 py-0.5 sm:px-2 sm:py-1 text-[10px] sm:text-xs max-w-[90%] truncate">
              {price}
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="p-2 sm:p-3 md:p-4 space-y-1 sm:space-y-2">
          <h3 className="font-bold text-xs sm:text-sm neon-glow truncate">{title}</h3>
          <p className="text-[10px] sm:text-xs text-muted-foreground truncate">by {creator}</p>
        </CardContent>
        
        <CardFooter className="p-2 sm:p-3 md:p-4 pt-0 flex gap-1 sm:gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            className="flex-1 pixel-border text-[10px] sm:text-xs gap-0.5 sm:gap-1 h-7 sm:h-9 px-1 sm:px-3"
            onClick={(e) => e.preventDefault()}
          >
            <Heart className="w-3 h-3" />
            <span className="hidden xs:inline">{likes}</span>
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            className="flex-1 pixel-border text-[10px] sm:text-xs gap-0.5 sm:gap-1 h-7 sm:h-9 px-1 sm:px-3"
            onClick={(e) => e.preventDefault()}
          >
            <MessageSquare className="w-3 h-3" />
            <span className="hidden xs:inline">{comments}</span>
          </Button>
        </CardFooter>
      </Card>
    </Link>
  );
};

export default NFTCard;
