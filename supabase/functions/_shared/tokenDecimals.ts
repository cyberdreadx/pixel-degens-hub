// Token decimal places for Keeta network tokens
export const TOKEN_DECIMALS = {
  KTA: 6,   // Keeta base token uses 6 decimals
  XRGE: 18, // XRGE uses standard 18 decimals
} as const;

export function getTokenDecimals(tokenSymbol: 'KTA' | 'XRGE'): number {
  return TOKEN_DECIMALS[tokenSymbol];
}

export function getDecimalDivisor(decimals: number): number {
  return Math.pow(10, decimals);
}
