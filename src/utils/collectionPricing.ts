/**
 * Collection Pricing Calculator
 * 
 * Calculates hosting fees based on collection size and image count
 */

export interface PricingTier {
  maxItems: number;
  pricePerItem: number;
  name: string;
  description: string;
}

export interface CollectionPricing {
  totalItems: number;
  storageSizeMB: number;
  hostingFeeKTA: number;
  tier: PricingTier;
  breakdown: {
    baseHostingFee: number;
    storageFee: number;
    transactionFees: number;
  };
}

// Pricing Tiers
export const PRICING_TIERS: PricingTier[] = [
  {
    maxItems: 100,
    pricePerItem: 0.01,
    name: "Starter",
    description: "Perfect for small collections (up to 100 items)"
  },
  {
    maxItems: 500,
    pricePerItem: 0.008,
    name: "Standard",
    description: "Great for medium collections (101-500 items)"
  },
  {
    maxItems: 1000,
    pricePerItem: 0.006,
    name: "Pro",
    description: "For large collections (501-1,000 items)"
  },
  {
    maxItems: 5000,
    pricePerItem: 0.005,
    name: "Premium",
    description: "For major collections (1,001-5,000 items)"
  },
  {
    maxItems: 10000,
    pricePerItem: 0.004,
    name: "Enterprise",
    description: "For massive collections (5,001-10,000 items)"
  },
];

// Storage costs
const STORAGE_COST_PER_MB = 0.001; // KTA per MB
const AVERAGE_IMAGE_SIZE_MB = 0.5; // Estimated average NFT image size
const TX_FEE_PER_NFT = 0.01; // Transaction fee per NFT minted

/**
 * Get the appropriate pricing tier for a collection size
 */
export function getPricingTier(itemCount: number): PricingTier {
  for (const tier of PRICING_TIERS) {
    if (itemCount <= tier.maxItems) {
      return tier;
    }
  }
  // Default to enterprise tier for very large collections
  return PRICING_TIERS[PRICING_TIERS.length - 1];
}

/**
 * Calculate total pricing for a collection
 */
export function calculateCollectionPricing(
  itemCount: number,
  estimatedSizeMB?: number
): CollectionPricing {
  const tier = getPricingTier(itemCount);
  
  // Calculate storage size
  const storageSizeMB = estimatedSizeMB || (itemCount * AVERAGE_IMAGE_SIZE_MB);
  
  // Base hosting fee (per item)
  const baseHostingFee = itemCount * tier.pricePerItem;
  
  // Storage fee (per MB)
  const storageFee = storageSizeMB * STORAGE_COST_PER_MB;
  
  // Transaction fees for minting
  const transactionFees = itemCount * TX_FEE_PER_NFT;
  
  // Total hosting fee (one-time payment)
  const hostingFeeKTA = baseHostingFee + storageFee;
  
  return {
    totalItems: itemCount,
    storageSizeMB,
    hostingFeeKTA,
    tier,
    breakdown: {
      baseHostingFee,
      storageFee,
      transactionFees,
    },
  };
}

/**
 * Get estimated size from a ZIP file
 */
export function estimateSizeFromZip(zipSizeMB: number): number {
  // ZIP compression typically reduces size by 10-30%
  // So actual size is ~1.2x the ZIP size
  return zipSizeMB * 1.2;
}

/**
 * Format KTA price with USD estimate
 */
export function formatPricing(kta: number, ktaToUsd: number = 0.25): string {
  return `${kta.toFixed(4)} KTA (~$${(kta * ktaToUsd).toFixed(2)} USD)`;
}

/**
 * Validate collection size is within limits
 */
export function validateCollectionSize(itemCount: number): {
  valid: boolean;
  error?: string;
} {
  const MAX_COLLECTION_SIZE = 10000;
  
  if (itemCount <= 0) {
    return { valid: false, error: "Collection must have at least 1 item" };
  }
  
  if (itemCount > MAX_COLLECTION_SIZE) {
    return { 
      valid: false, 
      error: `Maximum collection size is ${MAX_COLLECTION_SIZE.toLocaleString()} items` 
    };
  }
  
  return { valid: true };
}

/**
 * Get all pricing tiers with examples
 */
export function getAllPricingTiers() {
  return PRICING_TIERS.map(tier => ({
    ...tier,
    examplePricing: calculateCollectionPricing(tier.maxItems),
  }));
}
