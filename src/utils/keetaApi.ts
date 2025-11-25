// Keeta chain API interactions - now using direct blockchain access for speed!
import { 
  fetchAccountBalances as fetchAccountBalancesDirect,
  fetchExchangeRate as fetchExchangeRateDirect,
  fetchTokenInfo as fetchTokenInfoDirect,
  fetchAnchorPoolInfo,
} from "./keetaBlockchain";

export const TOKENS = {
  MAINNET: {
    KTA: 'keeta_anqdilpazdekdu4acw65fj7smltcp26wbrildkqtszqvverljpwpezmd44ssg',
    XRGE: 'keeta_aolgxwrcepccr5ycg5ctp3ezhhp6vnpitzm7grymm63hzbaqk6lcsbtccgur6',
  },
  TESTNET: {
    KTA: 'keeta_anyiff4v34alvumupagmdyosydeq24lc4def5mrpmmyhx3j6vj2uucckeqn52',
    XRGE: 'keeta_annmywuiz2pourjmkyuaznxyg6cmv356dda3hpuiqfpwry5m2tlybothdb33s',
  }
};

export function getTokenAddresses(network: "main" | "test") {
  return network === "main" ? TOKENS.MAINNET : TOKENS.TESTNET;
}

export interface AnchorInfo {
  address: string;
  ktaBalance: number;
  xrgeBalance: number;
  rate: number;
}

export interface ExchangeRate {
  from: string;
  to: string;
  rate: number;
  timestamp: number;
}

/**
 * Fetch account balances from Keeta chain - now directly from blockchain!
 * @deprecated Use fetchAccountBalancesDirect from keetaBlockchain.ts for better performance
 */
export async function fetchAccountBalances(
  address: string, 
  network: "main" | "test" = "main"
): Promise<{ kta: number; xrge: number }> {
  try {
    const TOKEN_DECIMALS = {
      KTA: 18,
      XRGE: 18,
    };
    
    const tokenAddrs = getTokenAddresses(network);
    const balanceData = await fetchAccountBalancesDirect(address, network);
    
    let ktaBalance = 0;
    let xrgeBalance = 0;

    if (balanceData.balances && Array.isArray(balanceData.balances)) {
      const ktaToken = balanceData.balances.find((b: any) => b.token === tokenAddrs.KTA);
      const xrgeToken = balanceData.balances.find((b: any) => b.token === tokenAddrs.XRGE);

      if (ktaToken) {
        ktaBalance = Number(BigInt(ktaToken.balance)) / Math.pow(10, TOKEN_DECIMALS.KTA);
      }
      if (xrgeToken) {
        xrgeBalance = Number(BigInt(xrgeToken.balance)) / Math.pow(10, TOKEN_DECIMALS.XRGE);
      }
    }

    return { kta: ktaBalance, xrge: xrgeBalance };
  } catch (error) {
    console.error('Error fetching account balances from Keeta chain:', error);
    throw error;
  }
}

/**
 * Fetch anchor info (balances and rate) - now directly from blockchain!
 */
export async function fetchAnchorInfo(
  anchorAddress: string,
  network: "main" | "test" = "main"
): Promise<AnchorInfo> {
  const poolInfo = await fetchAnchorPoolInfo(anchorAddress, network);
  
  return {
    address: anchorAddress,
    ktaBalance: poolInfo.ktaBalance,
    xrgeBalance: poolInfo.xrgeBalance,
    rate: poolInfo.rate,
  };
}

/**
 * Calculate exchange rate based on anchor pool balances - now directly from blockchain!
 */
export async function fetchExchangeRate(
  anchorAddress: string,
  network: "main" | "test" = "main",
  from: string = 'KTA',
  to: string = 'XRGE'
): Promise<ExchangeRate> {
  const { rate } = await fetchExchangeRateDirect(
    anchorAddress, 
    network, 
    from as 'KTA' | 'XRGE', 
    to as 'KTA' | 'XRGE'
  );

  return {
    from,
    to,
    rate,
    timestamp: Date.now(),
  };
}

/**
 * Fetch token info directly from Keeta chain - now from blockchain directly!
 */
export async function fetchTokenInfo(
  tokenAddress: string,
  network: "main" | "test" = "main"
): Promise<any> {
  return fetchTokenInfoDirect(tokenAddress, network);
}
