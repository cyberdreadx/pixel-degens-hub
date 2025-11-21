import { NavLink } from "./NavLink";
import { Button } from "./ui/button";
import { Wallet, Home, Image, Users, Activity } from "lucide-react";

const Navigation = () => {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-card/90 backdrop-blur-sm border-b-4 border-primary">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <NavLink to="/" className="flex items-center gap-2">
            <div className="w-12 h-12 bg-primary pixel-border-thick flex items-center justify-center">
              <span className="text-2xl">🎮</span>
            </div>
            <span className="text-lg neon-glow hidden sm:inline">DEGEN</span>
          </NavLink>

          <div className="flex items-center gap-2 sm:gap-6">
            <NavLink
              to="/"
              className="flex items-center gap-2 px-3 py-2 hover:bg-muted transition-colors"
              activeClassName="bg-muted"
            >
              <Home className="w-4 h-4" />
              <span className="hidden sm:inline text-xs">HOME</span>
            </NavLink>
            
            <NavLink
              to="/collection"
              className="flex items-center gap-2 px-3 py-2 hover:bg-muted transition-colors"
              activeClassName="bg-muted"
            >
              <Image className="w-4 h-4" />
              <span className="hidden sm:inline text-xs">NFTS</span>
            </NavLink>
            
            <NavLink
              to="/feed"
              className="flex items-center gap-2 px-3 py-2 hover:bg-muted transition-colors"
              activeClassName="bg-muted"
            >
              <Activity className="w-4 h-4" />
              <span className="hidden sm:inline text-xs">FEED</span>
            </NavLink>
            
            <NavLink
              to="/profile"
              className="flex items-center gap-2 px-3 py-2 hover:bg-muted transition-colors"
              activeClassName="bg-muted"
            >
              <Users className="w-4 h-4" />
              <span className="hidden sm:inline text-xs">PROFILE</span>
            </NavLink>
            
            <Button 
              variant="default" 
              size="sm"
              className="pixel-border bg-primary hover:bg-primary/80 text-xs gap-2"
            >
              <Wallet className="w-4 h-4" />
              <span className="hidden sm:inline">CONNECT</span>
            </Button>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navigation;
