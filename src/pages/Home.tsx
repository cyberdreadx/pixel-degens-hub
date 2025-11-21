import { Button } from "@/components/ui/button";
import { ArrowRight, TrendingUp, Users, Zap } from "lucide-react";
import { Link } from "react-router-dom";
import heroBg from "@/assets/hero-bg.png";

const Home = () => {
  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section 
        className="relative min-h-screen flex items-center justify-center overflow-hidden"
        style={{
          backgroundImage: `url(${heroBg})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          imageRendering: "pixelated",
        }}
      >
        <div className="absolute inset-0 bg-background/80 scanlines" />
        
        <div className="relative z-10 container mx-auto px-4 text-center space-y-8">
          <div className="inline-block pixel-border-thick bg-secondary/20 px-4 py-2 mb-4">
            <span className="text-xs neon-glow-secondary">POWERED BY KEETA CHAIN</span>
          </div>
          
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold neon-glow leading-tight">
            DEGEN<br />NFT STORE
          </h1>
          
          <p className="text-sm md:text-base max-w-2xl mx-auto text-muted-foreground leading-relaxed">
            THE MINIMAL 8-BIT NFT MARKETPLACE<br />
            COLLECT • TRADE • CONNECT
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center pt-4">
            <Link to="/collection">
              <Button 
                size="lg" 
                className="pixel-border-thick bg-primary hover:bg-primary/80 gap-2 text-xs md:text-sm"
              >
                EXPLORE NFTS <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
            <Link to="/profile">
              <Button 
                size="lg" 
                variant="outline"
                className="pixel-border-thick gap-2 text-xs md:text-sm"
              >
                CREATE PROFILE
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-16 border-t-4 border-primary bg-card">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center space-y-4 p-6 pixel-border-thick bg-background hover:border-secondary transition-colors">
              <TrendingUp className="w-12 h-12 mx-auto text-primary" />
              <div className="text-3xl font-bold neon-glow">2.4K</div>
              <div className="text-xs text-muted-foreground">TOTAL VOLUME</div>
            </div>
            
            <div className="text-center space-y-4 p-6 pixel-border-thick bg-background hover:border-secondary transition-colors">
              <Zap className="w-12 h-12 mx-auto text-secondary" />
              <div className="text-3xl font-bold neon-glow-secondary">420</div>
              <div className="text-xs text-muted-foreground">NFTS MINTED</div>
            </div>
            
            <div className="text-center space-y-4 p-6 pixel-border-thick bg-background hover:border-accent transition-colors">
              <Users className="w-12 h-12 mx-auto text-accent" />
              <div className="text-3xl font-bold text-accent">1.2K</div>
              <div className="text-xs text-muted-foreground">DEGENS</div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <h2 className="text-2xl md:text-4xl font-bold text-center mb-12 neon-glow">
            WHY DEGEN?
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            <div className="p-6 pixel-border-thick bg-card space-y-4">
              <div className="text-4xl">🎮</div>
              <h3 className="font-bold text-primary">8-BIT AESTHETIC</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Pure retro gaming vibes. Pixel perfect NFTs that bring back the golden age.
              </p>
            </div>
            
            <div className="p-6 pixel-border-thick bg-card space-y-4">
              <div className="text-4xl">⚡</div>
              <h3 className="font-bold text-secondary">KEETA CHAIN</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Lightning fast transactions. Low fees. Built for degens by degens.
              </p>
            </div>
            
            <div className="p-6 pixel-border-thick bg-card space-y-4">
              <div className="text-4xl">🤝</div>
              <h3 className="font-bold text-accent">SOCIAL NETWORK</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Connect with collectors. Share your drops. Build your reputation.
              </p>
            </div>
            
            <div className="p-6 pixel-border-thick bg-card space-y-4">
              <div className="text-4xl">💎</div>
              <h3 className="font-bold text-primary">RARE DROPS</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Limited editions. Exclusive mints. Get in early or stay poor.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Home;
