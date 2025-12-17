import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import * as KeetaNet from "@keetanetwork/keetanet-client";
import { toast } from "sonner";
import * as bip39 from "bip39";
import { Buffer } from "buffer";
import { getTokenAddresses } from "@/utils/keetaApi";
import { getTokenDecimals } from "@/utils/tokenDecimals";

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
  walletType: "seed" | "yoda" | null;
  isYodaInstalled: boolean;
  connectWallet: (seed?: string) => Promise<void>;
  connectYodaWallet: () => Promise<void>;
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
  const [walletType, setWalletType] = useState<"seed" | "yoda" | null>(null);
  const [isYodaInstalled, setIsYodaInstalled] = useState(false);
  const [network, setNetwork] = useState<"main" | "test">(() => {
    const savedNetwork = localStorage.getItem("keetaNetwork") as "main" | "test";
    console.log('[WalletContext] Initializing network from localStorage:', savedNetwork || 'test');
    return savedNetwork || "test";
  });

  // Check if Yoda wallet is installed
  useEffect(() => {
    const checkYodaWallet = () => {
      const yoda = (window as any).yoda || (window as any).keetaWallet;
      setIsYodaInstalled(!!yoda);
      console.log('[WalletContext] Yoda wallet detected:', !!yoda);
    };
    
    checkYodaWallet();
    
    // Listen for wallet installation
    window.addEventListener('yoda#initialized', checkYodaWallet);
    
    return () => {
      window.removeEventListener('yoda#initialized', checkYodaWallet);
    };
  }, []);

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
    const walletTypePreference = localStorage.getItem("keetaWalletType");
    
    if (walletTypePreference === "yoda") {
      // Auto-connect Yoda wallet if previously used
      const savedAddress = localStorage.getItem("yodaAddress");
      const yoda = (window as any).yoda;
      if (yoda && yoda.isYoda && savedAddress) {
        // Wait a bit for extension to fully initialize
        setTimeout(() => {
          connectYodaWallet().catch(err => {
            console.log('[WalletContext] Auto-connect Yoda failed:', err);
            localStorage.removeItem("keetaWalletType");
            localStorage.removeItem("yodaAddress");
          });
        }, 500);
      }
    } else {
      // Auto-connect with seed phrase if available
      const savedSeed = localStorage.getItem("keetaWalletSeed");
      if (savedSeed) {
        connectWallet(savedSeed);
      }
    }
  }, []);

  // Fetch balance when connected
  useEffect(() => {
    if (walletType === 'yoda' && publicKey) {
      // For Yoda wallet, fetch using Yoda's API
      fetchBalance();
      // Note: fetchTokensInternal won't work without client, 
      // we'd need to implement token fetching via Yoda API if needed
    } else if (client && account) {
      // For seed phrase wallet, use client
      fetchBalance();
      fetchTokensInternal();
    }
  }, [client, account, walletType, publicKey]);

  const fetchBalance = useCallback(async () => {
    try {
      console.log('[WalletContext] Fetching balances for network:', network);
      
      // If using Yoda wallet, use its getBalance method
      if (walletType === 'yoda' && publicKey) {
        const yoda = (window as any).yoda;
        if (!yoda || !yoda.getBalance) {
          console.error('[WalletContext] Yoda wallet not available');
          setBalance("0.000");
          return;
        }
        
        try {
          const yodaBalance = await yoda.getBalance(publicKey);
          console.log('[WalletContext] Yoda balance:', yodaBalance);
          
          // Yoda returns balance as a string with decimals already applied
          const balanceNum = parseFloat(yodaBalance) || 0;
          const balanceStr = balanceNum.toFixed(3);
          setBalance(balanceStr);
          toast.success("Balance refreshed!");
          return;
        } catch (yodaError) {
          console.error('[WalletContext] Yoda getBalance failed:', yodaError);
          toast.error("Failed to fetch balance from Yoda wallet");
          return;
        }
      }
      
      // For seed phrase wallet, we need client
      if (!client || !account) {
        console.log('[WalletContext] No client or account available');
        return;
      }
      
      // Regular balance fetching via client
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
      
      // KTA uses network-specific decimals: testnet=9, mainnet=18
      const decimals = getTokenDecimals('KTA', network);
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
  }, [client, account, network, walletType, publicKey]);

  const fetchTokensInternal = useCallback(async () => {
    // Yoda wallet doesn't support token fetching through client yet
    if (walletType === 'yoda') {
      console.log('[WalletContext] Token fetching not yet implemented for Yoda wallet');
      setTokens([]);
      return;
    }
    
    if (!client || !account) return;

    try {
      // Get all balances
      const balances = await client.allBalances();
      
      // Get base token address for comparison
      const baseTokenAddr = client.baseToken.publicKeyString.toString();
      
      // Get token info for all tokens with ACL permissions
      let tokenInfoMap: Map<string, any> = new Map();
      try {
        const tokensWithInfo = await client.listACLsByPrincipalWithInfo({ account });
        tokensWithInfo.forEach((entry: any) => {
          if (entry.entity && entry.info) {
            const tokenAddr = entry.entity.publicKeyString?.toString() || entry.entity.publicKeyString?.get();
            if (tokenAddr) {
              tokenInfoMap.set(tokenAddr, entry.info);
            }
          }
        });
      } catch (e) {
        console.log('Could not fetch token info list:', e);
      }
      
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
          
          // Get token info from the map we fetched earlier
          const info = tokenInfoMap.get(tokenAddress);
          let isNFT = false;
          let metadata: any = null;
          
          console.log('[Token Info]', tokenAddress, info);
          
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
            decimals = getTokenDecimals('XRGE', network);
          } else if (tokenAddress === KTA_MAINNET || tokenAddress === KTA_TESTNET) {
            symbol = 'KTA';
            name = 'Keeta Token';
            decimals = getTokenDecimals('KTA', network);
          } else if (info) {
            // For custom tokens, use info from blockchain
            symbol = info.name || 'UNKNOWN';
            name = info.description || info.name || 'Unknown Token';
            
            // Check if this is an NFT (supply of 1)
            const supply = info.supply ? BigInt(info.supply) : 0n;
            if (supply === 1n) {
              isNFT = true;
              decimals = 0;
            }
            
            // Check metadata for decimal places and additional NFT metadata
            if (info.metadata) {
              try {
                const metadataJson = atob(info.metadata);
                metadata = JSON.parse(metadataJson);
                
                // Check if metadata specifies decimal places
                if (metadata.decimalPlaces !== undefined) {
                  decimals = parseInt(metadata.decimalPlaces);
                } else if (metadata.decimals !== undefined) {
                  decimals = parseInt(metadata.decimals);
                }
                
                // Check if this is a Degen 8bit NFT (or any NFT with platform metadata)
                if (metadata.platform === "degen8bit" || (supply === 1n && metadata.image)) {
                  isNFT = true;
                  symbol = info.name || 'NFT';
                  name = metadata.name || name;
                  decimals = 0;
                }
              } catch (e) {
                // Not valid metadata, ignore
                console.error('[WalletContext] Failed to parse metadata for', tokenAddress, e);
              }
            }
            
            console.log('[Token Parsed]', { symbol, name, decimals, supply: info.supply, isNFT });
          } else {
            // No info available - token exists but we don't have details
            symbol = tokenAddress.substring(0, 12) + '...';
            name = 'Unknown Token';
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
      
      // Debug: Log NFT detection
      const nftList = tokenList.filter(t => t.isNFT);
      console.log('[WalletContext] Total tokens fetched:', tokenList.length);
      console.log('[WalletContext] NFTs detected:', nftList.length);
      nftList.forEach(nft => {
        console.log('[WalletContext] NFT:', {
          name: nft.name,
          address: nft.address,
          hasMetadata: !!nft.metadata,
          metadata: nft.metadata
        });
      });
      
      setTokens(tokenList);
    } catch (error) {
      console.error('Failed to fetch Keeta tokens:', error);
    }
  }, [client, account, walletType]);

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

      console.log('[WalletContext] Connected wallet (secp256k1, index 0, seedFromPassphrase method):', newPublicKey);
      console.log('[WalletContext] Connecting to network:', network);

      // Connect to selected network
      const newClient = KeetaNet.UserClient.fromNetwork(network, newAccount);
      console.log('[WalletContext] Client created for network:', network);

      // Save to state
      setAccount(newAccount);
      setPublicKey(newPublicKey);
      setClient(newClient);
      setIsConnected(true);
      setWalletType("seed");

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

  const connectYodaWallet = async () => {
    try {
      const yoda = (window as any).yoda;
      
      if (!yoda || !yoda.isYoda) {
        toast.error("Yoda wallet not found. Please install the Yoda wallet extension.");
        window.open("https://chrome.google.com/webstore", "_blank");
        return;
      }

      console.log('[WalletContext] Connecting to Yoda wallet...');
      console.log('[WalletContext] Yoda detected:', yoda.isYoda);
      console.log('[WalletContext] Chain ID:', yoda.chainId);

      // Request accounts using the proper Yoda wallet API
      const accounts = await yoda.request({ 
        method: 'keeta_requestAccounts' 
      });
      
      if (!accounts || accounts.length === 0) {
        throw new Error("No accounts returned from Yoda wallet");
      }

      const yodaPublicKey = accounts[0];
      console.log('[WalletContext] Yoda wallet connected:', yodaPublicKey);
      console.log('[WalletContext] Yoda chainId:', yoda.chainId);

      // Check Yoda's network and warn if it doesn't match
      const yodaNetwork = yoda.chainId;
      if (yodaNetwork) {
        const isMainnet = yodaNetwork.includes('main') || yodaNetwork === 'keeta-main';
        const expectedNetwork = network === 'main' ? 'mainnet' : 'testnet';
        const actualNetwork = isMainnet ? 'mainnet' : 'testnet';
        
        if (expectedNetwork !== actualNetwork) {
          console.warn(`[WalletContext] Network mismatch! App: ${network}, Yoda: ${actualNetwork}`);
          toast.error(`⚠️ Yoda wallet is on ${actualNetwork} but app is set to ${expectedNetwork}. Please switch networks in Yoda wallet.`);
        }
      }

      // For Yoda wallet, we don't need a full client with signing capabilities
      // We'll use Yoda's API for all operations
      
      // Save to state (account and client are null for Yoda wallet)
      setAccount(null);
      setPublicKey(yodaPublicKey);
      setClient(null);
      setIsConnected(true);
      setWalletType("yoda");

      // Save connection preference
      localStorage.setItem("keetaWalletType", "yoda");
      localStorage.setItem("yodaAddress", yodaPublicKey);
      localStorage.removeItem("keetaWalletSeed");

      toast.success("Yoda wallet connected!");

      // Listen for account changes
      if (yoda.on) {
        yoda.on('accountsChanged', (newAccounts: string[]) => {
          console.log('[WalletContext] Yoda accounts changed:', newAccounts);
          if (newAccounts && newAccounts.length > 0) {
            const newAddress = newAccounts[0];
            setPublicKey(newAddress);
            // Reconnect with new account
            connectYodaWallet();
          } else {
            // No accounts - user disconnected
            disconnectWallet();
          }
        });

        yoda.on('disconnect', () => {
          console.log('[WalletContext] Yoda wallet disconnected event');
          disconnectWallet();
        });
      }

    } catch (error) {
      console.error("Error connecting Yoda wallet:", error);
      toast.error(`Failed to connect Yoda wallet: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  };

  const disconnectWallet = () => {
    // If using Yoda wallet, disconnect from it
    if (walletType === "yoda") {
      const yoda = (window as any).yoda;
      if (yoda && yoda.disconnect) {
        try {
          yoda.disconnect();
          console.log('[WalletContext] Disconnected from Yoda wallet');
        } catch (e) {
          console.log('[WalletContext] Yoda disconnect error:', e);
        }
      }
      localStorage.removeItem("yodaAddress");
    }

    setAccount(null);
    setPublicKey(null);
    setClient(null);
    setIsConnected(false);
    setBalance(null);
    setTokens([]);
    setWalletType(null);
    localStorage.removeItem("keetaWalletSeed");
    localStorage.removeItem("keetaWalletType");
    toast.success("Wallet disconnected");
  };

  const refreshBalance = useCallback(async () => {
    await Promise.all([fetchBalance(), fetchTokensInternal()]);
  }, [fetchBalance, fetchTokensInternal]);

  const switchNetwork = (newNetwork: "main" | "test") => {
    console.log('[WalletContext] switchNetwork called:', { newNetwork, isConnected, currentNetwork: network });
    
    if (isConnected) {
      toast.error("Please disconnect wallet before switching networks");
      return;
    }
    
    console.log('[WalletContext] Switching network from', network, 'to', newNetwork);
    setNetwork(newNetwork);
    localStorage.setItem("keetaNetwork", newNetwork);
    console.log('[WalletContext] Network switched and saved to localStorage');
    
    toast.success(`✓ Switched to ${newNetwork === "main" ? "MAINNET" : "TESTNET"}`, {
      duration: 3000,
    });
  };

  const sendTokens = useCallback(async (to: string, amount: string, tokenAddress?: string) => {
    try {
      // If using Yoda wallet, use its sendTransaction method
      if (walletType === 'yoda') {
        const yoda = (window as any).yoda;
        if (!yoda) {
          throw new Error('Yoda wallet not available');
        }

        console.log('[sendTokens] Using Yoda wallet to send');
        console.log('[sendTokens] To:', to);
        console.log('[sendTokens] Amount:', amount);
        
        // Yoda wallet's sendTransaction expects the amount as a string
        const txHash = await yoda.sendTransaction({
          to: to,
          amount: amount
        });
        
        console.log('[sendTokens] Yoda transaction sent:', txHash);
        
        // Refresh balances after sending
        await fetchBalance();
        
        toast.success("Transaction sent via Yoda wallet!");
        return { txHash };
      }

      // Regular seed phrase wallet flow
      if (!account || !client) {
        throw new Error('Wallet not connected');
      }
      
      const builder = client.initBuilder();
      
      // Create recipient account from public key string
      const recipientAccount = Account.fromPublicKeyString(to);
      
      // Determine decimals based on token and network
      const baseTokenAddr = client.baseToken.publicKeyString.toString();
      const isKTA = !tokenAddress || tokenAddress === baseTokenAddr;
      const decimals = isKTA ? getTokenDecimals('KTA', network) : 18;
      
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
  }, [account, client, walletType]);

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
        walletType,
        isYodaInstalled,
        connectWallet,
        connectYodaWallet,
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
