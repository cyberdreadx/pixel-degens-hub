import { Button } from "@/components/ui/button";
import { ArrowRight, TrendingUp, Users, Zap } from "lucide-react";
import { Link } from "react-router-dom";
import heroBg from "@/assets/hero-bg.png";

const Home = () => {
  return (
    <div className="min-h-screen pt-16 sm:pt-20">
      {/* Hero Section */}
      <section 
        className="relative min-h-[calc(100vh-4rem)] sm:min-h-[calc(100vh-5rem)] flex items-center justify-center overflow-hidden px-4 py-12 sm:py-16 md:py-20"
        style={{
          backgroundImage: `url(${heroBg})`,
          backgroundPosition: "center",
          imageRendering: "pixelated",
        }}
      >
        <div className="absolute inset-0 bg-background/80 scanlines" />
        
        <div className="relative z-10 container mx-auto text-center space-y-4 sm:space-y-6 md:space-y-8 max-w-5xl">
          {/* Badge */}
          <div className="inline-block pixel-border-thick bg-secondary/20 px-3 py-1.5 sm:px-4 sm:py-2 animate-pulse">
            <span className="text-[10px] sm:text-xs md:text-sm neon-glow-secondary font-bold tracking-wider">POWERED BY KEETA CHAIN</span>
          </div>
          
          {/* Main Title */}
          <h1 className="text-3xl sm:text-5xl md:text-6xl lg:text-7xl xl:text-8xl font-bold neon-glow leading-tight tracking-tight">
            DEGEN<br />NFT STORE
          </h1>
          
          {/* Subtitle */}
          <p className="text-xs sm:text-sm md:text-base lg:text-lg max-w-xl sm:max-w-2xl mx-auto text-muted-foreground leading-relaxed font-semibold">
            THE MINIMAL 8-BIT NFT MARKETPLACE<br />
            <span className="text-primary">COLLECT • TRADE • CONNECT</span>
          </p>
          
          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center items-stretch sm:items-center pt-4 sm:pt-6 max-w-md sm:max-w-none mx-auto">
            <Link to="/collection" className="w-full sm:w-auto">
              <Button 
                size="lg" 
                className="w-full pixel-border-thick bg-primary hover:bg-primary/80 gap-2 text-xs sm:text-sm md:text-base h-12 sm:h-14 font-bold transition-all hover:scale-105"
              >
                EXPLORE NFTS <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5" />
              </Button>
            </Link>
            <Link to="/profile" className="w-full sm:w-auto">
              <Button 
                size="lg" 
                variant="outline"
                className="w-full pixel-border-thick gap-2 text-xs sm:text-sm md:text-base h-12 sm:h-14 font-bold transition-all hover:scale-105"
              >
                CREATE PROFILE
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-8 sm:py-12 md:py-16 border-t-2 sm:border-t-4 border-primary bg-card">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 md:gap-8">
            <div className="text-center space-y-2 sm:space-y-3 md:space-y-4 p-4 sm:p-5 md:p-6 pixel-border-thick bg-background hover:border-primary transition-all hover:scale-105 cursor-pointer">
              <TrendingUp className="w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 mx-auto text-primary" />
              <div className="text-2xl sm:text-3xl md:text-4xl font-bold neon-glow">2.4K</div>
              <div className="text-[10px] sm:text-xs md:text-sm text-muted-foreground font-semibold tracking-wider">TOTAL VOLUME</div>
            </div>
            
            <div className="text-center space-y-2 sm:space-y-3 md:space-y-4 p-4 sm:p-5 md:p-6 pixel-border-thick bg-background hover:border-secondary transition-all hover:scale-105 cursor-pointer">
              <Zap className="w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 mx-auto text-secondary" />
              <div className="text-2xl sm:text-3xl md:text-4xl font-bold neon-glow-secondary">420</div>
              <div className="text-[10px] sm:text-xs md:text-sm text-muted-foreground font-semibold tracking-wider">NFTS MINTED</div>
            </div>
            
            <div className="text-center space-y-2 sm:space-y-3 md:space-y-4 p-4 sm:p-5 md:p-6 pixel-border-thick bg-background hover:border-accent transition-all hover:scale-105 cursor-pointer sm:col-span-1">
              <Users className="w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 mx-auto text-accent" />
              <div className="text-2xl sm:text-3xl md:text-4xl font-bold text-accent">1.2K</div>
              <div className="text-[10px] sm:text-xs md:text-sm text-muted-foreground font-semibold tracking-wider">DEGENS</div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-8 sm:py-12 md:py-16 lg:py-20">
        <div className="container mx-auto px-4">
          <h2 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold text-center mb-6 sm:mb-8 md:mb-12 neon-glow">
            WHY DEGEN?
          </h2>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 md:gap-8 max-w-5xl mx-auto">
            <div className="p-4 sm:p-5 md:p-6 pixel-border-thick bg-card space-y-2 sm:space-y-3 md:space-y-4 hover:border-primary transition-all hover:scale-105 cursor-pointer">
              <div className="text-3xl sm:text-4xl md:text-5xl">🎮</div>
              <h3 className="text-sm sm:text-base md:text-lg font-bold text-primary">8-BIT AESTHETIC</h3>
              <p className="text-[10px] sm:text-xs md:text-sm text-muted-foreground leading-relaxed">
                Pure retro gaming vibes. Pixel perfect NFTs that bring back the golden age.
              </p>
            </div>
            
            <div className="p-4 sm:p-5 md:p-6 pixel-border-thick bg-card space-y-2 sm:space-y-3 md:space-y-4 hover:border-secondary transition-all hover:scale-105 cursor-pointer">
              <div className="text-3xl sm:text-4xl md:text-5xl">⚡</div>
              <h3 className="text-sm sm:text-base md:text-lg font-bold text-secondary">KEETA CHAIN</h3>
              <p className="text-[10px] sm:text-xs md:text-sm text-muted-foreground leading-relaxed">
                Lightning fast transactions. Low fees. Built for degens by degens.
              </p>
            </div>
            
            <div className="p-4 sm:p-5 md:p-6 pixel-border-thick bg-card space-y-2 sm:space-y-3 md:space-y-4 hover:border-accent transition-all hover:scale-105 cursor-pointer">
              <div className="text-3xl sm:text-4xl md:text-5xl">🤝</div>
              <h3 className="text-sm sm:text-base md:text-lg font-bold text-accent">SOCIAL NETWORK</h3>
              <p className="text-[10px] sm:text-xs md:text-sm text-muted-foreground leading-relaxed">
                Connect with collectors. Share your drops. Build your reputation.
              </p>
            </div>
            
            <div className="p-4 sm:p-5 md:p-6 pixel-border-thick bg-card space-y-2 sm:space-y-3 md:space-y-4 hover:border-primary transition-all hover:scale-105 cursor-pointer">
              <div className="text-3xl sm:text-4xl md:text-5xl">💎</div>
              <h3 className="text-sm sm:text-base md:text-lg font-bold text-primary">RARE DROPS</h3>
              <p className="text-[10px] sm:text-xs md:text-sm text-muted-foreground leading-relaxed">
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
