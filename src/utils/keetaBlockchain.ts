// Direct blockchain data access - bypasses edge functions for read operations
// This is faster and cheaper than using Supabase edge functions for public data

const KEETA_API = {
  main: 'https://rep2.main.network.api.keeta.com/api',
  test: 'https://rep2.test.network.api.keeta.com/api',
};

export interface TokenInfo {
  address: string;
  name: string;
  symbol: string;
  description: string;
  supply: string;
  decimals: number;
  metadata: any;
  isNFT: boolean;
}

export interface AccountBalance {
  token: string;
  balance: string;
}

export interface AccountBalancesResponse {
  balances: AccountBalance[];
}

/**
 * Fetch token information directly from Keeta blockchain
 * Replaces: fx-token-info edge function
 */
export async function fetchTokenInfo(
  tokenAddress: string,
  network: "main" | "test" = "main"
): Promise<TokenInfo> {
  try {
    const response = await fetch(
      `${KEETA_API[network]}/node/ledger/accounts/${tokenAddress}`
    );
    
    if (!response.ok) {
      if (response.status === 404) {
        throw new Error(`Token not found on ${network}net. This token may not exist or may be on a different network.`);
      }
      throw new Error(`Failed to fetch token info: ${response.statusText} (${response.status})`);
    }
    
    const data = await response.json();
    
    console.log('[keetaBlockchain] Raw token data:', data);
    
    // The API returns an array with account info
    const accountData = Array.isArray(data) ? data[0] : data;
    const tokenInfo = accountData?.info || {};
    
    // Parse metadata if present
    let metadata = null;
    if (tokenInfo.metadata) {
      try {
        const metadataJson = atob(tokenInfo.metadata);
        metadata = JSON.parse(metadataJson);
      } catch (e) {
        console.error('Error parsing metadata:', e);
      }
    }
    
    // Convert hex supply to decimal string
    const supplyHex = tokenInfo.supply || '0x0';
    const supply = BigInt(supplyHex).toString();
    
    return {
      address: tokenAddress,
      name: tokenInfo.name || 'Unknown',
      symbol: tokenInfo.symbol || tokenInfo.name || 'UNKNOWN',
      description: tokenInfo.description || '',
      supply,
      decimals: metadata?.decimalPlaces || metadata?.decimals || 0,
      metadata,
      isNFT: metadata?.platform === 'degen8bit' || 
             (supply === '1' && 
              (metadata?.decimalPlaces === 0 || !metadata?.decimalPlaces))
    };
  } catch (error) {
    console.error('[keetaBlockchain] Error fetching token info:', error);
    throw error;
  }
}

/**
 * Fetch account balances directly from Keeta blockchain
 * Replaces: fx-keeta-proxy edge function
 */
export async function fetchAccountBalances(
  address: string,
  network: "main" | "test" = "main"
): Promise<AccountBalancesResponse> {
  try {
    const response = await fetch(
      `${KEETA_API[network]}/node/ledger/accounts/${address}`
    );
    
    if (!response.ok) {
      if (response.status === 404) {
        throw new Error(`Account not found on ${network}net. This account may not exist or may be on a different network.`);
      }
      throw new Error(`Failed to fetch balances: ${response.statusText} (${response.status})`);
    }
    
    const data = await response.json();
    console.log('[keetaBlockchain] Raw account data:', data);
    
    // The API returns an array with account info
    const accountData = Array.isArray(data) ? data[0] : data;
    const balances = accountData?.balances || [];
    
    return { balances };
  } catch (error) {
    console.error('[keetaBlockchain] Error fetching account balances:', error);
    throw error;
  }
}

/**
 * Fetch exchange rate by calculating from anchor pool balances
 * Replaces: fx-rates edge function (for read-only rate queries)
 */
export async function fetchExchangeRate(
  anchorAddress: string,
  network: "main" | "test" = "main",
  fromToken: 'KTA' | 'XRGE' = 'KTA',
  toToken: 'KTA' | 'XRGE' = 'XRGE'
): Promise<{ rate: number; ktaBalance: number; xrgeBalance: number }> {
  try {
    // CRITICAL: Use network-specific decimals (testnet KTA=9, mainnet KTA=18)
    const TOKEN_DECIMALS = {
      KTA: network === 'test' ? 9 : 18,
      XRGE: 18,
    };
    
    const TOKENS = network === 'test' ? {
      KTA: 'keeta_anyiff4v34alvumupagmdyosydeq24lc4def5mrpmmyhx3j6vj2uucckeqn52',
      XRGE: 'keeta_annmywuiz2pourjmkyuaznxyg6cmv356dda3hpuiqfpwry5m2tlybothdb33s',
    } : {
      KTA: 'keeta_anqdilpazdekdu4acw65fj7smltcp26wbrildkqtszqvverljpwpezmd44ssg',
      XRGE: 'keeta_aolgxwrcepccr5ycg5ctp3ezhhp6vnpitzm7grymm63hzbaqk6lcsbtccgur6',
    };
    
    const balanceData = await fetchAccountBalances(anchorAddress, network);
    const allBalances = balanceData.balances || [];
    
    let ktaBalance = 0;
    let xrgeBalance = 0;
    
    for (const balance of allBalances) {
      if (balance.token === TOKENS.KTA) {
        ktaBalance = Number(BigInt(balance.balance)) / Math.pow(10, TOKEN_DECIMALS.KTA);
      } else if (balance.token === TOKENS.XRGE) {
        xrgeBalance = Number(BigInt(balance.balance)) / Math.pow(10, TOKEN_DECIMALS.XRGE);
      }
    }
    
    console.log('[keetaBlockchain] Pool balances:', { ktaBalance, xrgeBalance });
    
    // Calculate rate from pool balances (constant product formula)
    let rate = 0;
    if (ktaBalance > 0 && xrgeBalance > 0) {
      if (fromToken === 'KTA' && toToken === 'XRGE') {
        rate = xrgeBalance / ktaBalance;
      } else if (fromToken === 'XRGE' && toToken === 'KTA') {
        rate = ktaBalance / xrgeBalance;
      }
    }
    
    return { rate, ktaBalance, xrgeBalance };
  } catch (error) {
    console.error('[keetaBlockchain] Error fetching exchange rate:', error);
    throw error;
  }
}

/**
 * Get anchor pool information including balances and rate
 * Useful for displaying pool liquidity and current exchange rates
 */
export async function fetchAnchorPoolInfo(
  anchorAddress: string,
  network: "main" | "test" = "main"
) {
  const { rate, ktaBalance, xrgeBalance } = await fetchExchangeRate(
    anchorAddress,
    network,
    'KTA',
    'XRGE'
  );
  
  return {
    address: anchorAddress,
    ktaBalance,
    xrgeBalance,
    rate,
    inverseRate: rate > 0 ? 1 / rate : 0,
  };
}

