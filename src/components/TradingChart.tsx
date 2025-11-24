import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from "recharts";
import { Loader2 } from "lucide-react";

type Timeframe = '1H' | '24H' | '7D' | '30D';

interface ChartData {
  timestamp: string;
  rate: number;
  time: string;
}

interface TradingChartProps {
  fromToken: string;
  toToken: string;
}

const TradingChart = ({ fromToken, toToken }: TradingChartProps) => {
  const [timeframe, setTimeframe] = useState<Timeframe>('24H');
  const [chartData, setChartData] = useState<ChartData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState({ high: 0, low: 0, change: 0 });

  useEffect(() => {
    fetchPriceHistory();
    
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchPriceHistory, 30000);
    return () => clearInterval(interval);
  }, [fromToken, toToken, timeframe]);

  const getTimeframeHours = (tf: Timeframe): number => {
    switch (tf) {
      case '1H': return 1;
      case '24H': return 24;
      case '7D': return 168;
      case '30D': return 720;
    }
  };

  const fetchPriceHistory = async () => {
    setIsLoading(true);
    try {
      const hoursAgo = getTimeframeHours(timeframe);
      const startTime = new Date();
      startTime.setHours(startTime.getHours() - hoursAgo);

      const { data, error } = await supabase
        .from('price_history')
        .select('*')
        .eq('from_token', fromToken)
        .eq('to_token', toToken)
        .gte('timestamp', startTime.toISOString())
        .order('timestamp', { ascending: true });

      if (error) throw error;

      if (data && data.length > 0) {
        const formatted = data.map((item: any) => ({
          timestamp: item.timestamp,
          rate: parseFloat(item.rate),
          time: new Date(item.timestamp).toLocaleTimeString('en-US', { 
            hour: '2-digit', 
            minute: '2-digit',
            ...(timeframe === '7D' || timeframe === '30D' ? { month: 'short', day: 'numeric' } : {})
          })
        }));

        setChartData(formatted);

        // Calculate stats
        const rates = formatted.map(d => d.rate);
        const high = Math.max(...rates);
        const low = Math.min(...rates);
        const change = rates.length > 1 
          ? ((rates[rates.length - 1] - rates[0]) / rates[0]) * 100 
          : 0;

        setStats({ high, low, change });
      } else {
        setChartData([]);
        setStats({ high: 0, low: 0, change: 0 });
      }
    } catch (error) {
      console.error('Error fetching price history:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatRate = (value: number) => {
    return value > 100 ? value.toFixed(2) : value.toFixed(6);
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-background/95 backdrop-blur border border-border rounded-lg p-3 shadow-lg">
          <p className="text-sm text-muted-foreground mb-1">{payload[0].payload.time}</p>
          <p className="text-lg font-bold text-primary">
            {formatRate(payload[0].value)}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <Card className="p-6 bg-card border-border">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-xl font-bold text-foreground mb-2">
            {fromToken}/{toToken} Chart
          </h3>
          {chartData.length > 0 && (
            <div className="flex gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">24h Change: </span>
                <span className={stats.change >= 0 ? "text-green-500" : "text-red-500"}>
                  {stats.change >= 0 ? '+' : ''}{stats.change.toFixed(2)}%
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">High: </span>
                <span className="text-foreground font-medium">{formatRate(stats.high)}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Low: </span>
                <span className="text-foreground font-medium">{formatRate(stats.low)}</span>
              </div>
            </div>
          )}
        </div>
        <div className="flex gap-2">
          {(['1H', '24H', '7D', '30D'] as Timeframe[]).map((tf) => (
            <Button
              key={tf}
              variant={timeframe === tf ? "default" : "outline"}
              size="sm"
              onClick={() => setTimeframe(tf)}
              className="min-w-[60px]"
            >
              {tf}
            </Button>
          ))}
        </div>
      </div>

      <div className="h-[400px] w-full">
        {isLoading ? (
          <div className="h-full flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : chartData.length === 0 ? (
          <div className="h-full flex items-center justify-center text-muted-foreground">
            No price data available for this timeframe
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="colorRate" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
              <XAxis 
                dataKey="time" 
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
              />
              <YAxis 
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
                tickFormatter={formatRate}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="rate"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                fill="url(#colorRate)"
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </Card>
  );
};

export default TradingChart;