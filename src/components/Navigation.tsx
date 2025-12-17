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
  return <nav className="fixed top-0 left-0 right-0 z-50 bg-card/95 backdrop-blur-md border-b-2 sm:border-b-4 border-primary shadow-lg">
      <div className="container mx-auto px-2 sm:px-4 py-2 sm:py-3">
        <div className="flex items-center justify-between gap-2">
          {/* Logo */}
          <NavLink to="/" className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <div className="w-8 h-8 sm:w-10 sm:h-10 lg:w-12 lg:h-12 flex items-center justify-center">
              <img src={logo} alt="Logo" className="w-full h-full" />
            </div>
            <span className="text-sm sm:text-base lg:text-lg neon-glow hidden sm:inline font-bold truncate">DEGEN SWAP</span>
          </NavLink>

          {/* Desktop Navigation - Optimized spacing */}
          <div className="hidden lg:flex items-center gap-1 xl:gap-2 flex-1 justify-center">
            {navLinks.slice(0, 5).map(link => <NavLink key={link.to} to={link.to} className="flex items-center gap-1.5 px-2 xl:px-3 py-2 hover:bg-muted transition-colors rounded pixel-border-thin" activeClassName="bg-muted border-primary">
                <link.icon className="w-3.5 h-3.5 xl:w-4 xl:h-4 shrink-0" />
                <span className="text-[10px] xl:text-xs font-semibold whitespace-nowrap">{link.label}</span>
              </NavLink>)}
          </div>

          {/* Right side controls */}
          <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
            {/* Network Switch - Desktop only */}
            <div className="hidden lg:flex items-center gap-1.5 px-2 py-1.5 pixel-border bg-muted rounded">
              <Network className="w-3 h-3 shrink-0" />
              <span className="text-[9px] xl:text-[10px] font-bold whitespace-nowrap">{network === "main" ? "MAIN" : "TEST"}</span>
              <Switch checked={network === "main"} onCheckedChange={checked => switchNetwork(checked ? "main" : "test")} disabled={isConnected} className="scale-75" />
            </div>

            {/* Theme Toggle */}
            <Button variant="outline" size="sm" className="pixel-border text-xs h-8 w-8 sm:h-9 sm:w-9 p-0" onClick={toggleTheme} title={`Switch to ${theme === "dark" ? "Colecovision" : "8-bit"} theme`}>
              <Palette className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </Button>

            {/* Wallet Button */}
            <Button variant="default" size="sm" className="pixel-border bg-primary hover:bg-primary/80 text-[10px] sm:text-xs gap-1 sm:gap-1.5 h-8 sm:h-9 px-2 sm:px-3 whitespace-nowrap" onClick={() => setWalletDialogOpen(true)}>
              <Wallet className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
              {isConnected ? <div className="flex items-center gap-1 sm:gap-1.5">
                  <span className="hidden md:inline truncate max-w-[80px] xl:max-w-none">{balance ? `${parseFloat(balance).toFixed(2)} KTA` : "0 KTA"}</span>
                  <span className="hidden xl:inline text-[9px]">{publicKey && formatAddress(publicKey)}</span>
                </div> : <span className="hidden sm:inline">CONNECT</span>}
            </Button>

            {/* Mobile Menu - Tablet and below */}
            <div className="lg:hidden">
              <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
                <SheetTrigger asChild>
                  <Button variant="outline" size="sm" className="pixel-border h-8 w-8 sm:h-9 sm:w-9 p-0">
                    <Menu className="w-4 h-4" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="right" className="pixel-border-thick bg-card w-[280px] sm:w-[320px] p-0">
                  <div className="flex flex-col h-full">
                    {/* Mobile Menu Header */}
                    <div className="p-4 border-b-2 border-primary">
                      <h2 className="text-lg font-bold neon-glow">MENU</h2>
                    </div>

                    {/* Mobile Menu Links */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-2">
                      {navLinks.map(link => <NavLink key={link.to} to={link.to} className="flex items-center gap-3 px-4 py-3 hover:bg-muted transition-colors rounded pixel-border-thin" activeClassName="bg-muted border-primary" onClick={() => setMobileMenuOpen(false)}>
                          <link.icon className="w-5 h-5 shrink-0" />
                          <span className="text-sm font-semibold">{link.label}</span>
                        </NavLink>)}
                    </div>

                    {/* Mobile Menu Footer */}
                    <div className="p-4 border-t-2 border-primary space-y-3">
                      {/* Network Switch */}
                      <div className="flex items-center justify-between px-3 py-2 pixel-border bg-muted rounded">
                        <div className="flex items-center gap-2">
                          <Network className="w-4 h-4" />
                          <span className="text-xs font-bold">{network === "main" ? "MAINNET" : "TESTNET"}</span>
                        </div>
                        <Switch checked={network === "main"} onCheckedChange={checked => switchNetwork(checked ? "main" : "test")} disabled={isConnected} />
                      </div>

                      {/* Wallet Info */}
                      {isConnected && <div className="px-3 py-3 pixel-border bg-muted/50 rounded space-y-2">
                          <div className="text-[10px] text-muted-foreground font-semibold">WALLET</div>
                          <div className="text-sm font-bold truncate">{balance ? `${parseFloat(balance).toFixed(3)} KTA` : "0 KTA"}</div>
                          {xrgeToken && <div className="text-sm font-bold truncate">{parseFloat(xrgeToken.balance).toFixed(3)} XRGE</div>}
                          <div className="text-[10px] text-muted-foreground break-all font-mono">
                            {publicKey && publicKey}
                          </div>
                        </div>}
                    </div>
                  </div>
                </SheetContent>
              </Sheet>
            </div>
          </div>

        </div>
      </div>

      <WalletDialog open={walletDialogOpen} onOpenChange={setWalletDialogOpen} />
    </nav>;
};
export default Navigation;