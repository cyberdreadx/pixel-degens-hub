import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import * as KeetaNet from "@keetanetwork/keetanet-client";
import { toast } from "sonner";
import * as bip39 from "bip39";
import { Buffer } from "buffer";

const { Account } = KeetaNet.lib;
const { AccountKeyAlgorithm } = Account;

interface WalletContextType {
  isConnected: boolean;
  publicKey: string | null;
  account: any | null;
  client: any | null;
  balance: string | null;
  tokens: KeetaToken[];
  connectWallet: (seed?: string) => Promise<void>;
  disconnectWallet: () => void;
  generateNewWallet: () => Promise<string>;
  refreshBalance: () => Promise<void>;
  fetchTokens: () => Promise<void>;
  sendTokens: (to: string, amount: string, tokenAddress?: string) => Promise<any>;
}

interface KeetaToken {
  address: string;
  symbol: string;
  name: string;
  balance: string;
  decimals: number;
  price?: number;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export const WalletProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [account, setAccount] = useState<any | null>(null);
  const [client, setClient] = useState<any | null>(null);
  const [balance, setBalance] = useState<string | null>(null);
  const [tokens, setTokens] = useState<KeetaToken[]>([]);

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
      fetchTokensInternal();
    }
  }, [client, account]);

  const fetchBalance = async () => {
    if (!client || !account) return;
    
    try {
      // Get all balances (matches Keeta SDK pattern)
      const allBalances = await client.allBalances();
      
      // Get base token address for comparison
      const baseTokenAddr = client.baseToken.publicKeyString.toString();
      
      // Find KTA balance from allBalances
      let keetaBalance = BigInt(0);
      if (Array.isArray(allBalances)) {
        for (const balanceData of allBalances) {
          const tokenInfo = JSON.parse(JSON.stringify(balanceData, (k: string, v: any) => typeof v === 'bigint' ? v.toString() : v));
          const tokenAddress = tokenInfo.token;
          
          if (tokenAddress === baseTokenAddr) {
            keetaBalance = BigInt(tokenInfo.balance || 0);
            break;
          }
        }
      }
      
      // Convert balance from smallest unit to KTA (18 decimals)
      const balanceInKTA = Number(keetaBalance) / Math.pow(10, 18);
      setBalance(balanceInKTA.toFixed(6));
    } catch (error) {
      console.error("Error fetching balance:", error);
      setBalance("0.000000");
    }
  };

  const fetchTokensInternal = async () => {
    if (!client || !account) return;

    try {
      // Get all balances
      const balances = await client.allBalances();
      
      // Get base token address for comparison
      const baseTokenAddr = client.baseToken.publicKeyString.toString();
      
      // Convert to our token format
      // Filter out the native KTA token since it's displayed separately
      const tokenList: KeetaToken[] = balances
        .filter((balanceData: any) => {
          const tokenInfo = JSON.parse(JSON.stringify(balanceData, (k: string, v: any) => typeof v === 'bigint' ? v.toString() : v));
          const tokenAddress = tokenInfo.token;
          
          // Filter out native KTA token and zero balances
          return tokenInfo.balance !== '0' && tokenInfo.balance !== 0 && tokenAddress !== baseTokenAddr;
        })
        .map((balanceData: any) => {
          const tokenInfo = JSON.parse(JSON.stringify(balanceData, (k: string, v: any) => typeof v === 'bigint' ? v.toString() : v));
          const tokenAddress = tokenInfo.token;
          
          // Identify known tokens
          const XRGE_ADDRESS = 'keeta_aolgxwrcepccr5ycg5ctp3ezhhp6vnpitzm7grymm63hzbaqk6lcsbtccgur6';
          let symbol = 'UNKNOWN';
          let name = 'Unknown Token';
          
          if (tokenAddress === XRGE_ADDRESS) {
            symbol = 'XRGE';
            name = 'XRGE Token';
          }
          
          // Convert balance from smallest unit to human-readable (18 decimals)
          const rawBalance = BigInt(tokenInfo.balance);
          const readableBalance = Number(rawBalance) / Math.pow(10, 18);
          
          return {
            address: tokenAddress,
            symbol,
            name,
            balance: readableBalance.toFixed(6),
            decimals: 18,
            price: 0,
          };
        });
      
      setTokens(tokenList);
    } catch (error) {
      console.error('Failed to fetch Keeta tokens:', error);
    }
  };

  const generateNewWallet = async (): Promise<string> => {
    try {
      // Generate 24-word mnemonic (256 bits of entropy)
      const mnemonic = bip39.generateMnemonic(256);
      console.log('Generated new wallet mnemonic (will use secp256k1, index 0)');
      return mnemonic;
    } catch (error) {
      console.error("Error generating wallet:", error);
      toast.error("Failed to generate wallet");
      throw error;
    }
  };

  const connectWallet = async (seedOrMnemonic?: string) => {
    try {
      let walletSeed = seedOrMnemonic;
      
      if (!walletSeed) {
        walletSeed = await generateNewWallet();
        toast.success("New wallet generated!");
      }

      // Convert mnemonic to seed using CLI-compatible method (seedFromPassphrase)
      const seedHex = await KeetaNet.lib.Account.seedFromPassphrase(walletSeed, { asString: true });

      // Create account from seed using secp256k1 algorithm at index 0
      const newAccount = KeetaNet.lib.Account.fromSeed(seedHex, 0, AccountKeyAlgorithm.ECDSA_SECP256K1);
      const newPublicKey = newAccount.publicKeyString.toString();

      console.log('Connected wallet (secp256k1, index 0, seedFromPassphrase method):', newPublicKey);

      // Connect to mainnet
      const newClient = KeetaNet.UserClient.fromNetwork("main", newAccount);

      // Save to state
      setAccount(newAccount);
      setPublicKey(newPublicKey);
      setClient(newClient);
      setIsConnected(true);

      // Save mnemonic/seed to localStorage
      if (!seedOrMnemonic) {
        localStorage.setItem("keetaWalletSeed", walletSeed);
      } else {
        localStorage.setItem("keetaWalletSeed", seedOrMnemonic);
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
    setTokens([]);
    localStorage.removeItem("keetaWalletSeed");
    toast.success("Wallet disconnected");
  };

  const fetchTokens = useCallback(async () => {
    await fetchTokensInternal();
  }, [client, account]);

  const sendTokens = useCallback(async (to: string, amount: string, tokenAddress?: string) => {
    if (!account || !client) {
      throw new Error('Wallet not connected');
    }

    try {
      // Start building a transaction
      const builder = client.initBuilder();
      
      // Create recipient account from public key string
      const recipientAccount = Account.fromPublicKeyString(to);
      
      // Convert amount to BigInt (assuming 18 decimals for KTA)
      const amountBigInt = BigInt(Math.floor(parseFloat(amount) * Math.pow(10, 18)));
      
      // Get base token address
      const baseTokenAddr = client.baseToken.publicKeyString.toString();
      
      if (tokenAddress && tokenAddress !== baseTokenAddr) {
        // Send specific token
        const tokenAccount = Account.fromPublicKeyString(tokenAddress);
        builder.send(recipientAccount, amountBigInt, tokenAccount);
      } else {
        // Send native KTA (base token)
        builder.send(recipientAccount, amountBigInt, client.baseToken);
      }
      
      // Publish the transaction
      const result = await builder.publish();
      
      // Refresh balances after sending
      await fetchBalance();
      await fetchTokensInternal();
      
      toast.success("Transaction sent!");
      return result;
    } catch (error) {
      console.error('Failed to send tokens:', error);
      toast.error("Failed to send transaction");
      throw error;
    }
  }, [account, client]);

  return (
    <WalletContext.Provider
      value={{
        isConnected,
        publicKey,
        account,
        client,
        balance,
        tokens,
        connectWallet,
        disconnectWallet,
        generateNewWallet,
        refreshBalance: fetchBalance,
        fetchTokens,
        sendTokens,
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
