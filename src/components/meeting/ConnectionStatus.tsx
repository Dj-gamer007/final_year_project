import { useState, useEffect, useRef } from 'react';
import { Wifi, WifiOff, Loader2, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ConnectionStatusProps {
  className?: string;
}

type ConnectionState = 'excellent' | 'good' | 'slow' | 'offline' | 'checking';

const ConnectionStatus = ({ className }: ConnectionStatusProps) => {
  const [connectionState, setConnectionState] = useState<ConnectionState>('checking');
  const [latency, setLatency] = useState<number | null>(null);
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    const checkConnection = async () => {
      const start = performance.now();
      
      try {
        // Use a lightweight endpoint check
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);
        
        const response = await fetch('https://www.google.com/generate_204', {
          method: 'HEAD',
          mode: 'no-cors',
          cache: 'no-cache',
          signal: controller.signal,
        });
        
        clearTimeout(timeout);
        const end = performance.now();
        const roundTrip = Math.round(end - start);
        
        setLatency(roundTrip);
        
        if (roundTrip < 100) {
          setConnectionState('excellent');
        } else if (roundTrip < 300) {
          setConnectionState('good');
        } else {
          setConnectionState('slow');
        }
      } catch {
        if (!navigator.onLine) {
          setConnectionState('offline');
          setLatency(null);
        } else {
          setConnectionState('slow');
          setLatency(null);
        }
      }
    };

    // Initial check
    checkConnection();

    // Check every 10 seconds
    intervalRef.current = window.setInterval(checkConnection, 10000);

    // Listen for online/offline events
    const handleOnline = () => checkConnection();
    const handleOffline = () => {
      setConnectionState('offline');
      setLatency(null);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const getStatusConfig = () => {
    switch (connectionState) {
      case 'excellent':
        return {
          icon: Wifi,
          label: 'Excellent',
          color: 'text-green-500',
          bgColor: 'bg-green-500/10',
          borderColor: 'border-green-500/30',
        };
      case 'good':
        return {
          icon: Wifi,
          label: 'Good',
          color: 'text-emerald-500',
          bgColor: 'bg-emerald-500/10',
          borderColor: 'border-emerald-500/30',
        };
      case 'slow':
        return {
          icon: AlertTriangle,
          label: 'Slow',
          color: 'text-amber-500',
          bgColor: 'bg-amber-500/10',
          borderColor: 'border-amber-500/30',
        };
      case 'offline':
        return {
          icon: WifiOff,
          label: 'Offline',
          color: 'text-destructive',
          bgColor: 'bg-destructive/10',
          borderColor: 'border-destructive/30',
        };
      case 'checking':
      default:
        return {
          icon: Loader2,
          label: 'Checking',
          color: 'text-muted-foreground',
          bgColor: 'bg-muted/50',
          borderColor: 'border-border',
        };
    }
  };

  const config = getStatusConfig();
  const Icon = config.icon;

  return (
    <div
      className={cn(
        'flex items-center gap-1.5 px-2 py-1 rounded-full text-xs border transition-colors',
        config.bgColor,
        config.borderColor,
        className
      )}
    >
      <Icon
        className={cn(
          'w-3 h-3',
          config.color,
          connectionState === 'checking' && 'animate-spin'
        )}
      />
      <span className={config.color}>
        {config.label}
        {latency !== null && connectionState !== 'offline' && (
          <span className="ml-1 opacity-70">{latency}ms</span>
        )}
      </span>
    </div>
  );
};

export default ConnectionStatus;
