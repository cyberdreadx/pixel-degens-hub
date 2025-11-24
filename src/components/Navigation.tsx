import { useState, useEffect } from "react";
import { NavLink } from "./NavLink";
import { Button } from "./ui/button";
import { Wallet, Home, Image, Users, Activity, ArrowDownUp, ArrowLeftRight, Menu, X, Palette, Network, Settings } from "lucide-react";
import { useWallet } from "@/contexts/WalletContext";
import WalletDialog from "./WalletDialog";
import { Sheet, SheetContent, SheetTrigger } from "./ui/sheet";
import logo from "@/assets/logo.png";
import { Switch } from "./ui/switch";
import { Label } from "./ui/label";
const Navigation = () => {
  const {
    isConnected,
    publicKey,
    balance,
    tokens,
    network,
    switchNetwork
  } = useWallet();
  const [walletDialogOpen, setWalletDialogOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [theme, setTheme] = useState<"dark" | "colecovision">(() => {
    return localStorage.getItem("theme") as "dark" | "colecovision" || "dark";
  });
  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove("dark", "colecovision");
    root.classList.add(theme);
    localStorage.setItem("theme", theme);
  }, [theme]);
  const toggleTheme = () => {
    setTheme(prev => prev === "dark" ? "colecovision" : "dark");
  };
  const xrgeToken = tokens.find(t => t.symbol === "XRGE");
  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };
  const navLinks = [{
    to: "/",
    icon: Home,
    label: "HOME"
  }, {
    to: "/collection",
    icon: Image,
    label: "NFTS"
  }, {
    to: "/feed",
    icon: Activity,
    label: "FEED"
  }, {
    to: "/profile",
    icon: Users,
    label: "PROFILE"
  }, {
    to: "/swap",
    icon: ArrowDownUp,
    label: "SWAP"
  }, {
    to: "/bridge",
    icon: ArrowLeftRight,
    label: "BRIDGE"
  }, {
    to: "/anchor-status",
    icon: Settings,
    label: "ANCHOR"
  }];
  return <nav className="fixed top-0 left-0 right-0 z-50 bg-card/90 backdrop-blur-sm border-b-4 border-primary">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <NavLink to="/" className="flex items-center gap-2">
            <div className="w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center">
              
            </div>
            <span className="text-base sm:text-lg neon-glow hidden sm:inline font-bold">DEGEN SWAP</span>
          </NavLink>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-2 lg:gap-6">
            {navLinks.map(link => <NavLink key={link.to} to={link.to} className="flex items-center gap-2 px-3 py-2 hover:bg-muted transition-colors" activeClassName="bg-muted">
                <link.icon className="w-4 h-4" />
                <span className="text-xs">{link.label}</span>
              </NavLink>)}

            <div className="flex items-center gap-2 px-3 py-1.5 pixel-border bg-muted rounded">
              <Network className="w-3 h-3" />
              <span className="text-[10px] font-bold">{network === "main" ? "MAIN" : "TEST"}</span>
              <Switch checked={network === "main"} onCheckedChange={checked => switchNetwork(checked ? "main" : "test")} disabled={isConnected} className="scale-75" />
            </div>

            <Button variant="outline" size="sm" className="pixel-border text-xs" onClick={toggleTheme} title={`Switch to ${theme === "dark" ? "Colecovision" : "8-bit"} theme`}>
              <Palette className="w-4 h-4" />
            </Button>

            <Button variant="default" size="sm" className="pixel-border bg-primary hover:bg-primary/80 text-xs gap-2" onClick={() => setWalletDialogOpen(true)}>
              <Wallet className="w-4 h-4" />
              {isConnected ? <div className="flex items-center gap-2">
                  <span className="hidden lg:inline">{balance ? `${balance} KTA` : "0.0000 KTA"}</span>
                  <span className="hidden xl:inline">{publicKey && formatAddress(publicKey)}</span>
                </div> : <span>CONNECT</span>}
            </Button>
          </div>

          {/* Mobile Menu Button */}
          <div className="flex md:hidden items-center gap-2">
            <div className="flex items-center gap-1 px-2 py-1 pixel-border bg-muted rounded">
              <Network className="w-3 h-3" />
              <Switch checked={network === "main"} onCheckedChange={checked => switchNetwork(checked ? "main" : "test")} disabled={isConnected} className="scale-75" />
            </div>

            <Button variant="outline" size="sm" className="pixel-border text-xs" onClick={toggleTheme}>
              <Palette className="w-4 h-4" />
            </Button>

            <Button variant="default" size="sm" className="pixel-border bg-primary hover:bg-primary/80 text-xs" onClick={() => setWalletDialogOpen(true)}>
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
                  {navLinks.map(link => <NavLink key={link.to} to={link.to} className="flex items-center gap-3 px-4 py-3 hover:bg-muted transition-colors rounded" activeClassName="bg-muted" onClick={() => setMobileMenuOpen(false)}>
                      <link.icon className="w-5 h-5" />
                      <span className="text-sm font-semibold">{link.label}</span>
                    </NavLink>)}

                  {isConnected && <div className="mt-4 px-4 py-3 pixel-border bg-muted rounded space-y-1.5">
                      <div className="text-[10px] text-muted-foreground">BALANCE</div>
                      <div className="text-xs font-bold">{balance || "0.0000"} KTA</div>
                      {xrgeToken && <div className="text-xs font-bold">{xrgeToken.balance} XRGE</div>}
                      <div className="text-[10px] text-muted-foreground break-all">
                        {publicKey && formatAddress(publicKey)}
                      </div>
                    </div>}
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>

      <WalletDialog open={walletDialogOpen} onOpenChange={setWalletDialogOpen} />
    </nav>;
};
export default Navigation;