import React, { useState, useEffect } from 'react';
import { Wifi, WifiOff, Signal, AlertTriangle } from 'lucide-react';
import mobileNetworkHelper from '../utils/mobileNetworkHelper';

const NetworkStatusIndicator = () => {
  const [networkStats, setNetworkStats] = useState(mobileNetworkHelper.getStats());
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // 只在移动端显示
    if (!mobileNetworkHelper.isMobile) {
      return;
    }

    // 定期更新网络状态
    const interval = setInterval(() => {
      const stats = mobileNetworkHelper.getStats();
      setNetworkStats(stats);

      // 网络质量差或有失败记录时显示指示器
      const shouldShow = stats.networkQuality === 'poor' ||
                        stats.networkQuality === 'fair' ||
                        stats.failedUrlsCount > 0 ||
                        stats.activeRetriesCount > 0;

      setIsVisible(shouldShow);
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  if (!mobileNetworkHelper.isMobile || !isVisible) {
    return null;
  }

  const getNetworkIcon = () => {
    if (networkStats.networkStatus === 'offline') {
      return <WifiOff className="text-red-500" size={16} />;
    }

    switch (networkStats.networkQuality) {
      case 'poor':
        return <AlertTriangle className="text-red-500" size={16} />;
      case 'fair':
        return <Signal className="text-yellow-500" size={16} />;
      case 'good':
      case 'excellent':
        return <Wifi className="text-green-500" size={16} />;
      default:
        return <Signal className="text-gray-500" size={16} />;
    }
  };

  const getStatusColor = () => {
    if (networkStats.networkStatus === 'offline') return 'bg-red-100 border-red-300';

    switch (networkStats.networkQuality) {
      case 'poor': return 'bg-red-100 border-red-300';
      case 'fair': return 'bg-yellow-100 border-yellow-300';
      case 'good':
      case 'excellent': return 'bg-green-100 border-green-300';
      default: return 'bg-gray-100 border-gray-300';
    }
  };

  const getStatusText = () => {
    if (networkStats.networkStatus === 'offline') {
      return '网络离线';
    }

    if (networkStats.activeRetriesCount > 0) {
      return `重试中 (${networkStats.activeRetriesCount})`;
    }

    if (networkStats.failedUrlsCount > 0) {
      return `${networkStats.failedUrlsCount} 个加载失败`;
    }

    switch (networkStats.networkQuality) {
      case 'poor': return '网络较慢';
      case 'fair': return '网络一般';
      case 'good': return '网络良好';
      case 'excellent': return '网络极佳';
      default: return '检测中...';
    }
  };

  return (
    <div className={`fixed top-4 right-4 z-50 px-3 py-2 rounded-lg border flex items-center gap-2 shadow-lg backdrop-blur-sm ${getStatusColor()}`}>
      {getNetworkIcon()}
      <span className="text-sm font-medium">
        {getStatusText()}
      </span>
      {networkStats.connectionType !== 'unknown' && (
        <span className="text-xs opacity-70">
          {networkStats.connectionType.toUpperCase()}
        </span>
      )}
    </div>
  );
};

export default NetworkStatusIndicator;