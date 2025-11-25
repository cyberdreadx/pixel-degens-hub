import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import * as KeetaNet from "@keetanetwork/keetanet-client";
import { toast } from "sonner";
import * as bip39 from "bip39";
import { Buffer } from "buffer";
import { getTokenAddresses } from "@/utils/keetaApi";
import { TOKEN_DECIMALS, DISPLAY_DECIMALS } from "@/utils/tokenDecimals";

const { Account } = KeetaNet.lib;
const { AccountKeyAlgorithm } = Account;

interface WalletContextType {
  isConnected: boolean;
  publicKey: string | null;
  account: any | null;
  client: any | null;
  balance: string | null;
  tokens: KeetaToken[];
  network: "main" | "test";
  connectWallet: (seed?: string) => Promise<void>;
  disconnectWallet: () => void;
  generateNewWallet: () => Promise<string>;
  refreshBalance: () => Promise<void>;
  fetchTokens: () => Promise<void>;
  sendTokens: (to: string, amount: string, tokenAddress?: string) => Promise<any>;
  switchNetwork: (network: "main" | "test") => void;
}

interface KeetaToken {
  address: string;
  symbol: string;
  name: string;
  balance: string;
  decimals: number;
  price?: number;
  isNFT?: boolean;
  metadata?: any;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export const WalletProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [account, setAccount] = useState<any | null>(null);
  const [client, setClient] = useState<any | null>(null);
  const [balance, setBalance] = useState<string | null>(null);
  const [tokens, setTokens] = useState<KeetaToken[]>([]);
  const [network, setNetwork] = useState<"main" | "test">(() => {
    return (localStorage.getItem("keetaNetwork") as "main" | "test") || "test";
  });

  // Expose wallet context to window for atomic swap signing
  useEffect(() => {
    if (client && account) {
      (window as any).__walletContext = { client, account };
    } else {
      (window as any).__walletContext = null;
    }
  }, [client, account]);

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

  const fetchBalance = useCallback(async () => {
    if (!client || !account) return;
    
    try {
      console.log('[WalletContext] Fetching balances for network:', network);
      const allBalances = await client.allBalances();
      console.log('[WalletContext] Raw allBalances response:', allBalances);
      console.log('[WalletContext] allBalances type:', typeof allBalances, 'keys:', Object.keys(allBalances || {}));
      
      // allBalances returns an object: { [tokenId]: { token: 'address', balance: bigint } }
      if (!allBalances || Object.keys(allBalances).length === 0) {
        console.log('[WalletContext] No balances found');
        setBalance("0.000000");
        return;
      }
      
      // Get the correct KTA token address for current network
      const tokenAddrs = getTokenAddresses(network);
      const ktaAddress = tokenAddrs.KTA;
      
      // Also get the base token address from the client (this is the canonical KTA address)
      const baseTokenAddr = client.baseToken.publicKeyString.toString();
      console.log('[WalletContext] Network:', network);
      console.log('[WalletContext] Expected KTA address:', ktaAddress);
      console.log('[WalletContext] Client base token:', baseTokenAddr);
      
      // Find KTA balance by iterating over balance entries
      let ktaBalance = BigInt(0);
      let foundKTA = false;
      
      for (const [tokenId, balanceData] of Object.entries(allBalances)) {
        // Parse the balance data (handles bigint serialization)
        const tokenInfo = JSON.parse(JSON.stringify(balanceData, (k: string, v: any) => typeof v === 'bigint' ? v.toString() : v));
        const tokenAddr = String(tokenInfo.token || '');
        console.log('[WalletContext] Token entry:', { tokenId, tokenAddr, balance: tokenInfo.balance });
        
        // Match against both the static address AND the base token from client
        if (tokenAddr === ktaAddress || tokenAddr === baseTokenAddr) {
          const balStr = String(tokenInfo.balance || '0');
          ktaBalance = BigInt(balStr);
          foundKTA = true;
          console.log('[WalletContext] ✅ Found KTA balance:', balStr, 'from token:', tokenAddr);
          break;
        }
      }
      
      if (!foundKTA) {
        console.warn('[WalletContext] KTA token not found in balances. All tokens:', 
          Object.entries(allBalances).map(([id, data]: [string, any]) => {
            const info = JSON.parse(JSON.stringify(data, (k, v) => typeof v === 'bigint' ? v.toString() : v));
            return info.token;
          })
        );
      }
      
      // KTA uses 9 decimals for blockchain, display with 3 decimal places
      const decimals = TOKEN_DECIMALS.KTA;
      const divisor = Math.pow(10, decimals);
      const balanceNum = Number(ktaBalance) / divisor;
      const balanceStr = balanceNum.toFixed(3);
      
      console.log('[WalletContext] Raw KTA balance (bigint):', ktaBalance.toString());
      console.log('[WalletContext] Decimals used:', decimals);
      console.log('[WalletContext] Final KTA balance:', balanceStr);
      setBalance(balanceStr);
      toast.success("Balance refreshed!");
    } catch (error) {
      console.error("[WalletContext] Error fetching balance:", error);
      setBalance("0.000000");
      toast.error("Failed to refresh balance");
    }
  }, [client, account, network]);

  const fetchTokensInternal = useCallback(async () => {
    if (!client || !account) return;

    try {
      // Get all balances
      const balances = await client.allBalances();
      
      // Get base token address for comparison
      const baseTokenAddr = client.baseToken.publicKeyString.toString();
      
      // Fetch token info for each balance to detect NFTs and metadata
      const tokenPromises = balances
        .filter((balanceData: any) => {
          const tokenInfo = JSON.parse(JSON.stringify(balanceData, (k: string, v: any) => typeof v === 'bigint' ? v.toString() : v));
          const tokenAddress = tokenInfo.token;
          
          // Filter out native KTA token and zero balances
          return tokenInfo.balance !== '0' && tokenInfo.balance !== 0 && tokenAddress !== baseTokenAddr;
        })
        .map(async (balanceData: any) => {
          const tokenInfo = JSON.parse(JSON.stringify(balanceData, (k: string, v: any) => typeof v === 'bigint' ? v.toString() : v));
          const tokenAddress = tokenInfo.token;
          
          // Try to get token info from blockchain
          let info: any = null;
          let isNFT = false;
          let metadata: any = null;
          
          try {
            info = await client.getInfo(tokenAddress);
          } catch (e) {
            console.log('Could not fetch info for token:', tokenAddress);
          }
          
          // Identify known tokens (mainnet and testnet)
          const XRGE_MAINNET = 'keeta_aolgxwrcepccr5ycg5ctp3ezhhp6vnpitzm7grymm63hzbaqk6lcsbtccgur6';
          const XRGE_TESTNET = 'keeta_annmywuiz2pourjmkyuaznxyg6cmv356dda3hpuiqfpwry5m2tlybothdb33s';
          const KTA_MAINNET = 'keeta_anqdilpazdekdu4acw65fj7smltcp26wbrildkqtszqvverljpwpezmd44ssg';
          const KTA_TESTNET = 'keeta_anyiff4v34alvumupagmdyosydeq24lc4def5mrpmmyhx3j6vj2uucckeqn52';
          
          let symbol = 'UNKNOWN';
          let name = 'Unknown Token';
          let decimals = 0; // Default to 0 for custom tokens (assume NFT unless specified)
          
          // Check for known tokens first
          if (tokenAddress === XRGE_MAINNET || tokenAddress === XRGE_TESTNET) {
            symbol = 'XRGE';
            name = 'XRGE Token';
            decimals = TOKEN_DECIMALS.XRGE; // 18
          } else if (tokenAddress === KTA_MAINNET || tokenAddress === KTA_TESTNET) {
            symbol = 'KTA';
            name = 'Keeta Token';
            decimals = TOKEN_DECIMALS.KTA; // 6
          } else if (info) {
            // For custom tokens, use info from blockchain
            symbol = info.name || 'UNKNOWN';
            name = info.description || info.name || 'Unknown Token';
            // Custom tokens default to 0 decimals (NFT-style) unless metadata specifies otherwise
          }
          
          // Check if this is an NFT (supply=1, decimals=0)
          // Note: We'll need to check token supply from info if available
          if (info && info.metadata) {
            try {
              const metadataJson = atob(info.metadata);
              metadata = JSON.parse(metadataJson);
              
              // Check if this is a Degen 8bit NFT
              if (metadata.platform === "degen8bit") {
                isNFT = true;
                symbol = 'NFT';
                name = metadata.name || name;
                decimals = 0;
              }
            } catch (e) {
              // Not valid metadata, ignore
            }
          }
          
          // Convert balance (NFTs have decimals=0, regular tokens use proper decimals)
          const rawBalance = BigInt(tokenInfo.balance);
          const readableBalance = decimals === 0 
            ? Number(rawBalance).toString() 
            : (Number(rawBalance) / Math.pow(10, decimals)).toFixed(3);
          
          return {
            address: tokenAddress,
            symbol,
            name,
            balance: readableBalance,
            decimals,
            price: 0,
            isNFT,
            metadata,
          };
        });
      
      const tokenList = await Promise.all(tokenPromises);
      setTokens(tokenList);
    } catch (error) {
      console.error('Failed to fetch Keeta tokens:', error);
    }
  }, [client, account]);

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
      console.log('Network:', network);

      // Connect to selected network
      const newClient = KeetaNet.UserClient.fromNetwork(network, newAccount);

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

  const refreshBalance = useCallback(async () => {
    await Promise.all([fetchBalance(), fetchTokensInternal()]);
  }, [fetchBalance, fetchTokensInternal]);

  const switchNetwork = (newNetwork: "main" | "test") => {
    if (isConnected) {
      toast.error("Please disconnect wallet before switching networks");
      return;
    }
    setNetwork(newNetwork);
    localStorage.setItem("keetaNetwork", newNetwork);
    toast.success(`Switched to ${newNetwork === "main" ? "Mainnet" : "Testnet"}`);
  };

  const sendTokens = useCallback(async (to: string, amount: string, tokenAddress?: string) => {
    if (!account || !client) {
      throw new Error('Wallet not connected');
    }

    try {
      // Start building a transaction
      const builder = client.initBuilder();
      
      // Create recipient account from public key string
      const recipientAccount = Account.fromPublicKeyString(to);
      
      // Determine decimals based on token (KTA uses 6, others may use 18)
      const baseTokenAddr = client.baseToken.publicKeyString.toString();
      const isKTA = !tokenAddress || tokenAddress === baseTokenAddr;
      const decimals = isKTA ? TOKEN_DECIMALS.KTA : 18; // Default to 18 for other tokens
      
      console.log('[sendTokens] Input amount:', amount);
      console.log('[sendTokens] Is KTA:', isKTA);
      console.log('[sendTokens] Decimals:', decimals);
      console.log('[sendTokens] Parsed amount:', parseFloat(amount));
      console.log('[sendTokens] Multiplier:', Math.pow(10, decimals));
      
      const amountBigInt = BigInt(Math.floor(parseFloat(amount) * Math.pow(10, decimals)));
      console.log('[sendTokens] Final bigint amount:', amountBigInt.toString());
      
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
        network,
        connectWallet,
        disconnectWallet,
        generateNewWallet,
        refreshBalance,
        fetchTokens: fetchTokensInternal,
        sendTokens,
        switchNetwork,
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
