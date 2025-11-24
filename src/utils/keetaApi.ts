// Keeta chain API interactions via Supabase proxy (bypasses CORS)
import { supabase } from "@/integrations/supabase/client";

const TOKENS = {
  KTA: 'keeta_anqdilpazdekdu4acw65fj7smltcp26wbrildkqtszqvverljpwpezmd44ssg',
  XRGE: 'keeta_aolgxwrcepccr5ycg5ctp3ezhhp6vnpitzm7grymm63hzbaqk6lcsbtccgur6',
};

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
 * Fetch account balances from Keeta chain via proxy edge function
 */
export async function fetchAccountBalances(address: string): Promise<{ kta: number; xrge: number }> {
  try {
    const { data, error } = await supabase.functions.invoke('fx-keeta-proxy', {
      body: { address }
    });

    if (error) throw error;
    
    let ktaBalance = 0;
    let xrgeBalance = 0;

    if (data.balances && Array.isArray(data.balances)) {
      const ktaToken = data.balances.find((b: any) => b.token === TOKENS.KTA);
      const xrgeToken = data.balances.find((b: any) => b.token === TOKENS.XRGE);

      if (ktaToken) {
        ktaBalance = parseInt(ktaToken.balance, 16) / Math.pow(10, 18);
      }
      if (xrgeToken) {
        xrgeBalance = parseInt(xrgeToken.balance, 16) / Math.pow(10, 18);
      }
    }

    return { kta: ktaBalance, xrge: xrgeBalance };
  } catch (error) {
    console.error('Error fetching account balances from Keeta chain:', error);
    throw error;
  }
}

/**
 * Fetch anchor info (balances and rate) directly from chain
 */
export async function fetchAnchorInfo(anchorAddress: string): Promise<AnchorInfo> {
  const balances = await fetchAccountBalances(anchorAddress);
  
  // Calculate rate from pool balances (constant product formula)
  const rate = balances.xrge / balances.kta;

  return {
    address: anchorAddress,
    ktaBalance: balances.kta,
    xrgeBalance: balances.xrge,
    rate,
  };
}

/**
 * Calculate exchange rate based on anchor pool balances
 */
export async function fetchExchangeRate(
  anchorAddress: string,
  from: string = 'KTA',
  to: string = 'XRGE'
): Promise<ExchangeRate> {
  const anchorInfo = await fetchAnchorInfo(anchorAddress);
  
  let rate: number;
  if (from === 'KTA' && to === 'XRGE') {
    rate = anchorInfo.rate;
  } else if (from === 'XRGE' && to === 'KTA') {
    rate = 1 / anchorInfo.rate;
  } else {
    throw new Error(`Unsupported currency pair: ${from}/${to}`);
  }

  return {
    from,
    to,
    rate,
    timestamp: Date.now(),
  };
}
