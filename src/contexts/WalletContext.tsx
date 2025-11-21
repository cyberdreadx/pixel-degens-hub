import React, { createContext, useContext, useState, useEffect } from "react";
import * as KeetaNet from "@keetanetwork/keetanet-client";
import { toast } from "sonner";

interface WalletContextType {
  isConnected: boolean;
  publicKey: string | null;
  account: any | null;
  client: any | null;
  balance: string | null;
  connectWallet: (seed?: string) => Promise<void>;
  disconnectWallet: () => void;
  generateNewWallet: () => Promise<string>;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export const WalletProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [account, setAccount] = useState<any | null>(null);
  const [client, setClient] = useState<any | null>(null);
  const [balance, setBalance] = useState<string | null>(null);

  // Load wallet from localStorage on mount
  useEffect(() => {
    const savedSeed = localStorage.getItem("keetaWalletSeed");
    if (savedSeed) {
      connectWallet(savedSeed);
    }
  }, []);

  // Fetch balance when connected
  useEffect(() => {
    if (client && account) {
      fetchBalance();
    }
  }, [client, account]);

  const fetchBalance = async () => {
    if (!client || !account) return;
    
    try {
      const accountInfo = await client.account(account.publicKeyString);
      if (accountInfo && accountInfo.balance !== undefined) {
        // Convert balance from smallest unit to KTA
        const balanceInKTA = Number(accountInfo.balance) / 1000000000000; // Adjust decimals as needed
        setBalance(balanceInKTA.toFixed(4));
      }
    } catch (error) {
      console.error("Error fetching balance:", error);
      setBalance("0.0000");
    }
  };

  const generateNewWallet = async (): Promise<string> => {
    try {
      const seed = KeetaNet.lib.Account.generateRandomSeed({ asString: true });
      return seed as string;
    } catch (error) {
      console.error("Error generating wallet:", error);
      toast.error("Failed to generate wallet");
      throw error;
    }
  };

  const connectWallet = async (seed?: string) => {
    try {
      let walletSeed = seed;
      
      if (!walletSeed) {
        walletSeed = await generateNewWallet();
        toast.success("New wallet generated!");
      }

      // Create account from seed
      const newAccount = KeetaNet.lib.Account.fromSeed(walletSeed, 0);
      const newPublicKey = newAccount.publicKeyString.toString();

      // Connect to test network
      const newClient = KeetaNet.UserClient.fromNetwork("test", newAccount);

      // Save to state
      setAccount(newAccount);
      setPublicKey(newPublicKey);
      setClient(newClient);
      setIsConnected(true);

      // Save seed to localStorage (with user awareness)
      if (!seed) {
        localStorage.setItem("keetaWalletSeed", walletSeed);
      } else {
        localStorage.setItem("keetaWalletSeed", seed);
      }

      toast.success("Wallet connected!");
    } catch (error) {
      console.error("Error connecting wallet:", error);
      toast.error("Failed to connect wallet");
      throw error;
    }
  };

  const disconnectWallet = () => {
    setAccount(null);
    setPublicKey(null);
    setClient(null);
    setIsConnected(false);
    setBalance(null);
    localStorage.removeItem("keetaWalletSeed");
    toast.success("Wallet disconnected");
  };

  return (
    <WalletContext.Provider
      value={{
        isConnected,
        publicKey,
        account,
        client,
        balance,
        connectWallet,
        disconnectWallet,
        generateNewWallet,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
};

export const useWallet = () => {
  const context = useContext(WalletContext);
  if (context === undefined) {
    throw new Error("useWallet must be used within a WalletProvider");
  }
  return context;
};
