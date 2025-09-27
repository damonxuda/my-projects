// 移动端网络优化助手
class MobileNetworkHelper {
  constructor() {
    this.isMobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
    this.retryAttempts = new Map(); // 记录重试次数
    this.failedUrls = new Set(); // 记录失败的URL
    this.networkStatus = 'unknown';
    this.connectionType = 'unknown';

    // 初始化网络状态检测
    this.initNetworkMonitoring();
  }

  // 初始化网络监控
  initNetworkMonitoring() {
    // 检测网络连接状态
    if ('navigator' in window && 'onLine' in navigator) {
      this.networkStatus = navigator.onLine ? 'online' : 'offline';

      window.addEventListener('online', () => {
        this.networkStatus = 'online';
        console.log('🌐 网络已恢复，清除失败URL记录');
        this.failedUrls.clear();
      });

      window.addEventListener('offline', () => {
        this.networkStatus = 'offline';
        console.log('📴 网络已断开');
      });
    }

    // 检测连接类型（如果支持）
    if ('connection' in navigator) {
      const connection = navigator.connection;
      this.connectionType = connection.effectiveType || connection.type || 'unknown';

      connection.addEventListener('change', () => {
        this.connectionType = connection.effectiveType || connection.type || 'unknown';
        console.log('📶 网络类型变化:', this.connectionType,
          '下行速度:', connection.downlink, 'Mbps',
          'RTT:', connection.rtt, 'ms');
      });
    }
  }

  // 检查网络质量
  getNetworkQuality() {
    if (!('connection' in navigator)) {
      return 'unknown';
    }

    const connection = navigator.connection;
    const effectiveType = connection.effectiveType;
    const downlink = connection.downlink;
    const rtt = connection.rtt;

    if (effectiveType === 'slow-2g' || downlink < 0.5 || rtt > 2000) {
      return 'poor';
    } else if (effectiveType === '2g' || downlink < 1.5 || rtt > 1000) {
      return 'fair';
    } else if (effectiveType === '3g' || downlink < 10) {
      return 'good';
    } else {
      return 'excellent';
    }
  }

  // 获取重试配置（根据网络质量调整）
  getRetryConfig() {
    const quality = this.getNetworkQuality();

    switch (quality) {
      case 'poor':
        return { maxRetries: 5, baseDelay: 2000, maxDelay: 10000 };
      case 'fair':
        return { maxRetries: 4, baseDelay: 1500, maxDelay: 8000 };
      case 'good':
        return { maxRetries: 3, baseDelay: 1000, maxDelay: 5000 };
      case 'excellent':
        return { maxRetries: 2, baseDelay: 500, maxDelay: 3000 };
      default:
        return { maxRetries: 3, baseDelay: 1000, maxDelay: 5000 };
    }
  }

  // 计算指数退避延迟
  calculateDelay(attempt, baseDelay, maxDelay) {
    const exponentialDelay = baseDelay * Math.pow(2, attempt);
    const jitter = Math.random() * 0.3 * exponentialDelay; // 30% 随机抖动
    return Math.min(exponentialDelay + jitter, maxDelay);
  }

  // 智能图片加载（带重试机制）
  async loadImageWithRetry(url, filename) {
    if (!this.isMobile) {
      // 非移动端直接加载
      return this.loadImage(url);
    }

    const urlKey = `${filename}_${url.substring(0, 50)}`;

    // 检查是否已经失败过
    if (this.failedUrls.has(urlKey)) {
      console.log('🚫 URL已标记为失败，跳过加载:', filename);
      throw new Error('URL已知失败');
    }

    // 检查网络状态
    if (this.networkStatus === 'offline') {
      console.log('📴 设备离线，无法加载图片:', filename);
      throw new Error('设备离线');
    }

    const retryConfig = this.getRetryConfig();
    const currentAttempts = this.retryAttempts.get(urlKey) || 0;

    console.log(`🔄 开始加载图片 (${currentAttempts + 1}/${retryConfig.maxRetries + 1}):`, filename);
    console.log('📶 当前网络质量:', this.getNetworkQuality());

    try {
      const result = await this.loadImage(url);

      // 成功时清除重试记录
      this.retryAttempts.delete(urlKey);
      console.log('✅ 图片加载成功:', filename);

      return result;

    } catch (error) {
      console.error(`❌ 图片加载失败 (尝试 ${currentAttempts + 1}):`, filename, error.message);

      // 更新重试次数
      this.retryAttempts.set(urlKey, currentAttempts + 1);

      // 检查是否还能重试
      if (currentAttempts < retryConfig.maxRetries) {
        const delay = this.calculateDelay(currentAttempts, retryConfig.baseDelay, retryConfig.maxDelay);

        console.log(`⏰ ${delay}ms后重试加载:`, filename);

        // 等待后重试
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.loadImageWithRetry(url, filename);

      } else {
        // 达到最大重试次数，标记为失败
        this.failedUrls.add(urlKey);
        this.retryAttempts.delete(urlKey);

        console.error('💥 图片加载彻底失败，已标记:', filename);
        throw new Error(`图片加载失败，已重试 ${retryConfig.maxRetries} 次`);
      }
    }
  }

  // 基础图片加载方法
  loadImage(url) {
    return new Promise((resolve, reject) => {
      const img = new Image();

      const timeout = setTimeout(() => {
        reject(new Error('加载超时'));
      }, 15000); // 15秒超时

      img.onload = () => {
        clearTimeout(timeout);
        resolve({
          success: true,
          width: img.naturalWidth,
          height: img.naturalHeight,
          url: url
        });
      };

      img.onerror = () => {
        clearTimeout(timeout);
        reject(new Error('图片加载错误'));
      };

      // 设置加载参数
      img.crossOrigin = 'anonymous';
      img.loading = 'eager'; // 移动端优先加载
      img.src = url;
    });
  }

  // 清除失败记录（网络恢复时调用）
  clearFailureRecords() {
    this.failedUrls.clear();
    this.retryAttempts.clear();
    console.log('🧹 已清除所有失败记录');
  }

  // 获取统计信息
  getStats() {
    return {
      networkStatus: this.networkStatus,
      connectionType: this.connectionType,
      networkQuality: this.getNetworkQuality(),
      failedUrlsCount: this.failedUrls.size,
      activeRetriesCount: this.retryAttempts.size,
      retryConfig: this.getRetryConfig()
    };
  }

  // 预连接到AWS域名（提前建立连接）
  preconnectToAWS() {
    if (!this.isMobile) return;

    const link = document.createElement('link');
    link.rel = 'preconnect';
    link.href = 'https://damonxuda-video-files.s3.ap-northeast-1.amazonaws.com';
    link.crossOrigin = 'anonymous';
    document.head.appendChild(link);

    console.log('🔗 已预连接AWS S3域名');
  }
}

// 创建全局实例
const mobileNetworkHelper = new MobileNetworkHelper();

// 页面加载时预连接
if (mobileNetworkHelper.isMobile) {
  mobileNetworkHelper.preconnectToAWS();
}

export default mobileNetworkHelper;