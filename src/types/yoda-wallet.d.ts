/**
 * Type definitions for Yoda Wallet browser extension
 * Yoda Wallet is a browser extension for the Keeta blockchain network
 */

interface YodaWalletAccount {
  publicKey: string;
  address?: string;
  name?: string;
}

interface YodaWalletConnectResponse {
  publicKey: string;
  accounts?: YodaWalletAccount[];
}

interface YodaWalletSignResponse {
  signature: string;
  publicKey: string;
}

interface YodaWallet {
  /**
   * Check if wallet is currently connected
   */
  isConnected: boolean;

  /**
   * Connect to Yoda wallet
   * @returns Promise with account information
   */
  connect(): Promise<YodaWalletConnectResponse>;

  /**
   * Disconnect from Yoda wallet
   */
  disconnect(): void;

  /**
   * Get current connected accounts
   * @returns Promise with array of accounts
   */
  getAccounts(): Promise<YodaWalletAccount[]>;

  /**
   * Sign a transaction
   * @param transaction Transaction data to sign
   * @returns Promise with signed transaction
   */
  signTransaction(transaction: any): Promise<any>;

  /**
   * Sign a message
   * @param message Message to sign
   * @returns Promise with signature
   */
  signMessage(message: string | Uint8Array): Promise<YodaWalletSignResponse>;

  /**
   * Listen for wallet events
   * @param event Event name ('accountChanged', 'disconnect', etc.)
   * @param callback Callback function
   */
  on(event: 'accountChanged', callback: (publicKey: string) => void): void;
  on(event: 'disconnect', callback: () => void): void;
  on(event: 'connect', callback: (response: YodaWalletConnectResponse) => void): void;

  /**
   * Remove event listener
   * @param event Event name
   * @param callback Callback function
   */
  off(event: string, callback: (...args: any[]) => void): void;
}

interface Window {
  yoda?: YodaWallet;
  keetaWallet?: YodaWallet;
}

// Event dispatched when Yoda wallet is initialized
interface YodaInitializedEvent extends CustomEvent {
  type: 'yoda#initialized';
}

declare global {
  interface WindowEventMap {
    'yoda#initialized': YodaInitializedEvent;
  }
}

export { YodaWallet, YodaWalletAccount, YodaWalletConnectResponse, YodaWalletSignResponse };

