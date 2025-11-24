import { useState } from "react";
import { NavLink } from "./NavLink";
import { Button } from "./ui/button";
import { Wallet, Home, Image, Users, Activity, ArrowDownUp, ArrowLeftRight, Menu, X } from "lucide-react";
import { useWallet } from "@/contexts/WalletContext";
import WalletDialog from "./WalletDialog";
import { Sheet, SheetContent, SheetTrigger } from "./ui/sheet";
import logo from "@/assets/logo.png";

const Navigation = () => {
  const { isConnected, publicKey, balance } = useWallet();
  const [walletDialogOpen, setWalletDialogOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const navLinks = [
    { to: "/", icon: Home, label: "HOME" },
    { to: "/collection", icon: Image, label: "NFTS" },
    { to: "/feed", icon: Activity, label: "FEED" },
    { to: "/profile", icon: Users, label: "PROFILE" },
    { to: "/swap", icon: ArrowDownUp, label: "SWAP" },
    { to: "/bridge", icon: ArrowLeftRight, label: "BRIDGE" },
  ];

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-card/90 backdrop-blur-sm border-b-4 border-primary">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <NavLink to="/" className="flex items-center gap-2">
            <div className="w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center">
              <img 
                src={logo} 
                alt="DEGEN Logo" 
                className="w-full h-full object-contain"
              />
            </div>
            <span className="text-base sm:text-lg neon-glow hidden sm:inline font-bold">DEGEN</span>
          </NavLink>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-2 lg:gap-6">
            {navLinks.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                className="flex items-center gap-2 px-3 py-2 hover:bg-muted transition-colors"
                activeClassName="bg-muted"
              >
                <link.icon className="w-4 h-4" />
                <span className="text-xs">{link.label}</span>
              </NavLink>
            ))}
            
            <Button
              variant="default" 
              size="sm"
              className="pixel-border bg-primary hover:bg-primary/80 text-xs gap-2"
              onClick={() => setWalletDialogOpen(true)}
            >
              <Wallet className="w-4 h-4" />
              {isConnected ? (
                <div className="flex items-center gap-2">
                  <span className="hidden lg:inline">{balance ? `${balance} KTA` : "0.0000 KTA"}</span>
                  <span className="hidden xl:inline">{publicKey && formatAddress(publicKey)}</span>
                </div>
              ) : (
                <span>CONNECT</span>
              )}
            </Button>
          </div>

          {/* Mobile Menu Button */}
          <div className="flex md:hidden items-center gap-2">
            <Button
              variant="default" 
              size="sm"
              className="pixel-border bg-primary hover:bg-primary/80 text-xs"
              onClick={() => setWalletDialogOpen(true)}
            >
              <Wallet className="w-4 h-4" />
            </Button>
            
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" size="sm" className="pixel-border">
                  <Menu className="w-4 h-4" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="pixel-border-thick bg-card w-64">
                <div className="flex flex-col gap-4 mt-8">
                  {navLinks.map((link) => (
                    <NavLink
                      key={link.to}
                      to={link.to}
                      className="flex items-center gap-3 px-4 py-3 hover:bg-muted transition-colors rounded"
                      activeClassName="bg-muted"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      <link.icon className="w-5 h-5" />
                      <span className="text-sm font-semibold">{link.label}</span>
                    </NavLink>
                  ))}
                  
                  {isConnected && (
                    <div className="mt-4 px-4 py-3 pixel-border bg-muted rounded space-y-2">
                      <div className="text-xs text-muted-foreground">BALANCE</div>
                      <div className="text-sm font-bold">{balance || "0.0000"} KTA</div>
                      <div className="text-xs text-muted-foreground break-all">
                        {publicKey && formatAddress(publicKey)}
                      </div>
                    </div>
                  )}
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
      
      <WalletDialog open={walletDialogOpen} onOpenChange={setWalletDialogOpen} />
    </nav>
  );
};

export default Navigation;
