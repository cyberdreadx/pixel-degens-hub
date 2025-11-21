import { useState } from "react";
import { NavLink } from "./NavLink";
import { Button } from "./ui/button";
import { Wallet, Home, Image, Users, Activity } from "lucide-react";
import { useWallet } from "@/contexts/WalletContext";
import WalletDialog from "./WalletDialog";

const Navigation = () => {
  const { isConnected, publicKey, balance } = useWallet();
  const [walletDialogOpen, setWalletDialogOpen] = useState(false);

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

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
              className="flex items-center gap-2 px-3 py-2 hover:bg-muted transition-colors text-sm"
              activeClassName="bg-muted"
            >
              <Home className="w-5 h-5" />
              <span className="hidden sm:inline">HOME</span>
            </NavLink>
            
            <NavLink
              to="/collection"
              className="flex items-center gap-2 px-3 py-2 hover:bg-muted transition-colors text-sm"
              activeClassName="bg-muted"
            >
              <Image className="w-5 h-5" />
              <span className="hidden sm:inline">NFTS</span>
            </NavLink>
            
            <NavLink
              to="/feed"
              className="flex items-center gap-2 px-3 py-2 hover:bg-muted transition-colors text-sm"
              activeClassName="bg-muted"
            >
              <Activity className="w-5 h-5" />
              <span className="hidden sm:inline">FEED</span>
            </NavLink>
            
            <NavLink
              to="/profile"
              className="flex items-center gap-2 px-3 py-2 hover:bg-muted transition-colors text-sm"
              activeClassName="bg-muted"
            >
              <Users className="w-5 h-5" />
              <span className="hidden sm:inline">PROFILE</span>
            </NavLink>
            
            <Button 
              variant="default" 
              size="sm"
              className="pixel-border bg-primary hover:bg-primary/80 text-sm gap-2 h-10"
              onClick={() => setWalletDialogOpen(true)}
            >
              <Wallet className="w-5 h-5" />
              {isConnected ? (
                <div className="flex items-center gap-2">
                  <span className="hidden md:inline">{balance ? `${balance} KTA` : "0.0000 KTA"}</span>
                  <span className="hidden sm:inline">{publicKey && formatAddress(publicKey)}</span>
                </div>
              ) : (
                <span className="hidden sm:inline">CONNECT</span>
              )}
            </Button>
          </div>
        </div>
      </div>
      
      <WalletDialog open={walletDialogOpen} onOpenChange={setWalletDialogOpen} />
    </nav>
  );
};

export default Navigation;
