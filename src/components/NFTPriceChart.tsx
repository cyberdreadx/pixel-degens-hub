import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { format } from 'date-fns';

interface NFTPriceChartProps {
  tokenAddress: string;
  network: string;
}

interface PricePoint {
  timestamp: string;
  price: number;
  type: 'listing' | 'sale';
  currency: string;
}

export function NFTPriceChart({ tokenAddress, network }: NFTPriceChartProps) {
  const [priceData, setPriceData] = useState<PricePoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchPriceHistory();
  }, [tokenAddress, network]);

  const fetchPriceHistory = async () => {
    try {
      setIsLoading(true);
      
      const { data, error } = await supabase
        .from('nft_listings')
        .select('*')
        .eq('token_address', tokenAddress)
        .eq('network', network)
        .order('created_at', { ascending: true });

      if (error) throw error;

      const points: PricePoint[] = [];
      
      data?.forEach((listing) => {
        // Add listing price point
        points.push({
          timestamp: listing.created_at,
          price: listing.currency === 'KTA' ? listing.price_kta || 0 : listing.price_xrge || 0,
          type: 'listing',
          currency: listing.currency,
        });

        // Add sale price point if sold
        if (listing.status === 'sold' && listing.sold_at) {
          points.push({
            timestamp: listing.sold_at,
            price: listing.currency === 'KTA' ? listing.price_kta || 0 : listing.price_xrge || 0,
            type: 'sale',
            currency: listing.currency,
          });
        }
      });

      setPriceData(points);
    } catch (error) {
      console.error('Failed to fetch price history:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-card border border-border p-3 rounded-lg shadow-lg">
          <p className="text-sm font-medium">
            {format(new Date(data.timestamp), 'MMM dd, yyyy HH:mm')}
          </p>
          <p className="text-sm text-muted-foreground capitalize">
            {data.type}
          </p>
          <p className="text-lg font-bold text-primary">
            {data.price} {data.currency}
          </p>
        </div>
      );
    }
    return null;
  };

  if (isLoading) {
    return (
      <Card className="p-6">
        <Skeleton className="h-[300px] w-full" />
      </Card>
    );
  }

  if (priceData.length === 0) {
    return (
      <Card className="p-6">
        <p className="text-center text-muted-foreground">No price history available</p>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold mb-4">Price History</h3>
      <ResponsiveContainer width="100%" height={300}>
        <AreaChart data={priceData}>
          <defs>
            <linearGradient id="priceGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
              <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis
            dataKey="timestamp"
            tickFormatter={(timestamp) => format(new Date(timestamp), 'MMM dd')}
            stroke="hsl(var(--muted-foreground))"
          />
          <YAxis
            stroke="hsl(var(--muted-foreground))"
            tickFormatter={(value) => `${value}`}
          />
          <Tooltip content={<CustomTooltip />} />
          <Area
            type="monotone"
            dataKey="price"
            stroke="hsl(var(--primary))"
            strokeWidth={2}
            fill="url(#priceGradient)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </Card>
  );
}
