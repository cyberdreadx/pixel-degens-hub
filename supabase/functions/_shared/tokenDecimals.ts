// Token decimal places for Keeta network tokens
export const TOKEN_DECIMALS = {
  KTA: 18,  // Keeta base token uses 18 decimals on testnet/mainnet
  XRGE: 18, // XRGE uses standard 18 decimals
} as const;

export function getTokenDecimals(tokenSymbol: 'KTA' | 'XRGE'): number {
  return TOKEN_DECIMALS[tokenSymbol];
}

export function getDecimalDivisor(decimals: number): number {
  return Math.pow(10, decimals);
}
