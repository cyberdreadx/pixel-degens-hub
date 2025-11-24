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
  network: "main" | "test";
}

const TradingChart = ({ fromToken, toToken, network }: TradingChartProps) => {
  const [timeframe, setTimeframe] = useState<Timeframe>('24H');
  const [chartData, setChartData] = useState<ChartData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState({ high: 0, low: 0, change: 0 });

  // The chart shows the price of toToken in terms of fromToken
  // So for KTA/XRGE, we show "how much KTA per XRGE" (XRGE price in KTA)
  // This means when someone buys XRGE, XRGE price should go UP

  useEffect(() => {
    fetchPriceHistory();
    
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchPriceHistory, 30000);
    return () => clearInterval(interval);
  }, [fromToken, toToken, timeframe, network]);

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
        .eq('from_token', toToken)  // Inverted: we want "to" token price in "from" token terms
        .eq('to_token', fromToken)  // So query is reversed
        .gte('timestamp', startTime.toISOString())
        .order('timestamp', { ascending: true });

      if (error) throw error;

      if (data && data.length > 0) {
        const formatted = data.map((item: any) => ({
          timestamp: item.timestamp,
          rate: parseFloat(item.rate),  // This is now toToken/fromToken (e.g., XRGE/KTA)
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
    return value > 100 ? value.toFixed(2) : value.toFixed(5);
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
    <Card className="p-3 md:p-6 glass border-border/50 shadow-none overflow-hidden">
        <div className="space-y-3 md:space-y-4">
        {/* Header with title */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 md:gap-3">
          <div>
            <h3 className="text-base md:text-xl font-bold text-foreground">
              {toToken}/{fromToken} Chart {network === "test" && <span className="text-xs text-yellow-500">(TESTNET)</span>}
            </h3>
            <p className="text-[10px] md:text-xs text-muted-foreground mt-0.5">
              Price of {toToken} in {fromToken} terms • {network === "main" ? "Mainnet" : "Testnet"} data
            </p>
          </div>
          
          {/* Timeframe buttons */}
          <div className="flex gap-1.5 md:gap-2 flex-wrap">
            {(['1H', '24H', '7D', '30D'] as Timeframe[]).map((tf) => (
              <Button
                key={tf}
                variant={timeframe === tf ? "default" : "outline"}
                size="sm"
                onClick={() => setTimeframe(tf)}
                className="min-w-[50px] flex-1 sm:flex-none text-xs md:text-sm px-2 md:px-4"
              >
                {tf}
              </Button>
            ))}
          </div>
        </div>

        {/* Stats row */}
        {chartData.length > 0 && (
          <div className="grid grid-cols-3 gap-2 md:gap-4 text-[10px] md:text-sm">
            <div className="bg-muted/50 rounded-lg p-2 md:p-3">
              <span className="text-muted-foreground block mb-0.5 md:mb-1">24h Change</span>
              <span className={`font-bold text-xs md:text-base ${stats.change >= 0 ? "text-green-500" : "text-red-500"}`}>
                {stats.change >= 0 ? '+' : ''}{stats.change.toFixed(2)}%
              </span>
            </div>
            <div className="bg-muted/50 rounded-lg p-2 md:p-3">
              <span className="text-muted-foreground block mb-0.5 md:mb-1">High</span>
              <span className="text-foreground font-bold text-xs md:text-base break-all">{formatRate(stats.high)}</span>
            </div>
            <div className="bg-muted/50 rounded-lg p-2 md:p-3">
              <span className="text-muted-foreground block mb-0.5 md:mb-1">Low</span>
              <span className="text-foreground font-bold text-xs md:text-base break-all">{formatRate(stats.low)}</span>
            </div>
          </div>
        )}
      </div>

      {/* Chart container with proper spacing */}
      <div className="h-[280px] md:h-[400px] w-full mt-3 md:mt-4 overflow-x-hidden">
        {isLoading ? (
          <div className="h-full flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : chartData.length === 0 ? (
          <div className="h-full flex items-center justify-center text-center text-muted-foreground text-xs md:text-sm px-4">
            {network === "test" 
              ? "No testnet price data available. Testnet requires separate liquidity and trading activity."
              : "No price data available for this timeframe"}
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart 
              data={chartData}
              margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
            >
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
                fontSize={10}
                tick={{ fontSize: 10 }}
                tickMargin={8}
              />
              <YAxis 
                stroke="hsl(var(--muted-foreground))"
                fontSize={9}
                tick={{ fontSize: 9 }}
                tickFormatter={formatRate}
                width={50}
                tickMargin={5}
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