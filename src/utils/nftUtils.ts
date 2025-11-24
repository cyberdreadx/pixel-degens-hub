export interface NFTMetadata {
  platform: string;
  version: string;
  name: string;
  description: string;
  image: string;
  attributes: Array<{
    trait_type: string;
    value: string;
  }>;
  external_url?: string;
}

export interface NFT {
  tokenAddress: string;
  name: string;
  description: string;
  image: string;
  attributes: Array<{
    trait_type: string;
    value: string;
  }>;
  externalUrl?: string;
  owner: string;
  balance: string;
}

/**
 * Check if a token is a Degen 8bit NFT based on metadata
 */
export const isDegen8bitNFT = (metadata: any): boolean => {
  try {
    if (!metadata || typeof metadata !== "object") return false;
    return metadata.platform === "degen8bit";
  } catch {
    return false;
  }
};

/**
 * Decode base64 metadata from Keeta token info
 */
export const decodeTokenMetadata = (metadataBase64: string): NFTMetadata | null => {
  try {
    const metadataJson = atob(metadataBase64);
    const metadata = JSON.parse(metadataJson);
    return metadata;
  } catch (error) {
    console.error("Error decoding metadata:", error);
    return null;
  }
};

/**
 * Convert IPFS URL to HTTP gateway URL
 */
export const ipfsToHttp = (ipfsUrl: string): string => {
  if (ipfsUrl.startsWith("ipfs://")) {
    return ipfsUrl.replace("ipfs://", "https://ipfs.io/ipfs/");
  }
  return ipfsUrl;
};

/**
 * Check if a token is an NFT (supply=1, decimals=0)
 */
export const isNFTToken = (supply: string | number, decimals: number): boolean => {
  return decimals === 0 && (supply === "1" || supply === 1);
};
