// Token decimal places for Keeta network tokens
// Based on keeta-cli observations and network behavior

export const TOKEN_DECIMALS = {
  KTA: 9,   // Keeta base token uses 9 decimals for sending
  XRGE: 18, // XRGE uses standard 18 decimals
} as const;

// Display decimals are different from transaction decimals for KTA
export const DISPLAY_DECIMALS = {
  KTA: 6,   // KTA balance display uses 6 decimals
  XRGE: 18, // XRGE display uses 18 decimals
} as const;

export function getTokenDecimals(tokenSymbol: 'KTA' | 'XRGE'): number {
  return TOKEN_DECIMALS[tokenSymbol];
}

export function getDisplayDecimals(tokenSymbol: 'KTA' | 'XRGE'): number {
  return DISPLAY_DECIMALS[tokenSymbol];
}

export function getDecimalDivisor(decimals: number): number {
  return Math.pow(10, decimals);
}
