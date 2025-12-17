import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { WalletProvider } from "./contexts/WalletContext";
import Home from "./pages/Home";
import Collection from "./pages/Collection";
import CollectionDetail from "./pages/CollectionDetail";
import CreateCollection from "./pages/CreateCollection";
import BatchMint from "./pages/BatchMint";
import NFTDetail from "./pages/NFTDetail";
import Feed from "./pages/Feed";
import Profile from "./pages/Profile";
import PublicProfile from "./pages/PublicProfile";
import Swap from "./pages/Swap";
import Bridge from "./pages/Bridge";
import MintNFT from "./pages/MintNFT";
import AnchorStatus from "./pages/AnchorStatus";
import RecoverNFT from "./pages/RecoverNFT";
import NotFound from "./pages/NotFound";
import Navigation from "./components/Navigation";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <WalletProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <div className="overflow-x-hidden w-full">
            <Navigation />
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/collection" element={<Collection />} />
              <Route path="/collection/create" element={<CreateCollection />} />
              <Route path="/collection/:collectionId" element={<CollectionDetail />} />
              <Route path="/collection/:collectionId/batch-mint" element={<BatchMint />} />
              <Route path="/nft/:id" element={<NFTDetail />} />
              <Route path="/feed" element={<Feed />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/profile/:walletAddress" element={<PublicProfile />} />
              <Route path="/swap" element={<Swap />} />
              <Route path="/bridge" element={<Bridge />} />
              <Route path="/mint" element={<MintNFT />} />
              <Route path="/anchor-status" element={<AnchorStatus />} />
              <Route path="/recover" element={<RecoverNFT />} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </div>
        </BrowserRouter>
      </TooltipProvider>
    </WalletProvider>
  </QueryClientProvider>
);

export default App;
