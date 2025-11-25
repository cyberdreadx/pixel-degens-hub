// Token decimal places for Keeta network tokens
// CRITICAL: Testnet and mainnet use DIFFERENT decimals for KTA!

// Testnet decimals
const TOKEN_DECIMALS_TESTNET = {
  KTA: 9,   // Testnet KTA uses 9 decimals
  XRGE: 18, // XRGE uses 18 decimals on both networks
} as const;

// Mainnet decimals
const TOKEN_DECIMALS_MAINNET = {
  KTA: 18,  // Mainnet KTA uses 18 decimals
  XRGE: 18, // XRGE uses 18 decimals on both networks
} as const;

// Legacy export for backwards compatibility (uses mainnet)
export const TOKEN_DECIMALS = TOKEN_DECIMALS_MAINNET;

/**
 * Get token decimals for a specific network
 * CRITICAL: Testnet uses 9 decimals for KTA, Mainnet uses 18
 */
export function getTokenDecimals(tokenSymbol: 'KTA' | 'XRGE', network: 'main' | 'test' = 'main'): number {
  const decimals = network === 'test' ? TOKEN_DECIMALS_TESTNET : TOKEN_DECIMALS_MAINNET;
  return decimals[tokenSymbol];
}

/**
 * Get all token decimals for a network
 */
export function getNetworkDecimals(network: 'main' | 'test' = 'main') {
  return network === 'test' ? TOKEN_DECIMALS_TESTNET : TOKEN_DECIMALS_MAINNET;
}

export function getDecimalDivisor(decimals: number): number {
  return Math.pow(10, decimals);
}
