// 移动端缩略图问题诊断工具
class MobileDebugger {
  constructor() {
    this.isMobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
    this.logs = [];
    this.testResults = new Map();
  }

  log(message, data = null) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      message,
      data,
      userAgent: navigator.userAgent,
      isMobile: this.isMobile
    };
    this.logs.push(logEntry);
    console.log(`[MobileDebug] ${message}`, data);
  }

  // 测试单个缩略图URL
  async testThumbnailUrl(url, videoKey) {
    if (!url) {
      this.log(`URL测试失败: ${videoKey} - URL为空`);
      return { success: false, error: 'URL为空' };
    }

    this.log(`开始测试URL: ${videoKey}`, { url: url.substring(0, 100) + '...' });

    try {
      // 1. URL格式验证
      const urlObj = new URL(url);
      const urlAnalysis = {
        protocol: urlObj.protocol,
        hostname: urlObj.hostname,
        pathname: urlObj.pathname,
        hasSignature: urlObj.searchParams.has('X-Amz-Signature'),
        hasExpires: urlObj.searchParams.has('X-Amz-Expires'),
        hasDate: urlObj.searchParams.has('X-Amz-Date'),
        expires: urlObj.searchParams.get('X-Amz-Expires'),
        date: urlObj.searchParams.get('X-Amz-Date')
      };

      this.log(`URL分析结果: ${videoKey}`, urlAnalysis);

      // 2. HEAD请求测试可访问性
      const headStart = Date.now();
      try {
        const headResponse = await fetch(url, {
          method: 'HEAD',
          mode: 'cors',
          cache: 'no-cache'
        });

        const headDuration = Date.now() - headStart;
        const headResult = {
          status: headResponse.status,
          statusText: headResponse.statusText,
          headers: Object.fromEntries(headResponse.headers.entries()),
          duration: headDuration
        };

        this.log(`HEAD请求结果: ${videoKey}`, headResult);

        if (headResponse.ok) {
          // 3. 实际图片加载测试
          const imageTest = await this.testImageLoad(url);
          const result = {
            success: true,
            urlAnalysis,
            headResult,
            imageTest,
            videoKey
          };

          this.testResults.set(videoKey, result);
          return result;
        } else {
          const result = {
            success: false,
            error: `HTTP ${headResponse.status}: ${headResponse.statusText}`,
            urlAnalysis,
            headResult,
            videoKey
          };

          this.testResults.set(videoKey, result);
          return result;
        }

      } catch (headError) {
        this.log(`HEAD请求失败: ${videoKey}`, { error: headError.message });

        const result = {
          success: false,
          error: `网络错误: ${headError.message}`,
          urlAnalysis,
          headError: headError.message,
          videoKey
        };

        this.testResults.set(videoKey, result);
        return result;
      }

    } catch (urlError) {
      this.log(`URL解析失败: ${videoKey}`, { error: urlError.message });

      const result = {
        success: false,
        error: `URL格式错误: ${urlError.message}`,
        videoKey
      };

      this.testResults.set(videoKey, result);
      return result;
    }
  }

  // 测试图片加载
  testImageLoad(url) {
    return new Promise((resolve) => {
      const startTime = Date.now();
      const img = new Image();

      img.onload = () => {
        const duration = Date.now() - startTime;
        resolve({
          success: true,
          width: img.width || img.naturalWidth,
          height: img.height || img.naturalHeight,
          duration
        });
      };

      img.onerror = (e) => {
        const duration = Date.now() - startTime;
        resolve({
          success: false,
          error: e.message || '图片加载失败',
          duration
        });
      };

      // 10秒超时
      setTimeout(() => {
        resolve({
          success: false,
          error: '加载超时',
          duration: Date.now() - startTime
        });
      }, 10000);

      img.src = url;
    });
  }

  // 批量测试缓存中的URLs
  async testCachedThumbnails() {
    this.log('开始批量测试缓存中的缩略图URLs');

    const results = [];
    const cacheKeys = Object.keys(localStorage).filter(key => key.startsWith('thumbnails_'));

    for (const cacheKey of cacheKeys) {
      try {
        const cacheData = JSON.parse(localStorage.getItem(cacheKey));
        if (cacheData && cacheData.thumbnailUrls) {
          const path = cacheKey.replace('thumbnails_', '');
          this.log(`测试路径缓存: ${path}`, {
            urlCount: Object.keys(cacheData.thumbnailUrls).length
          });

          // 测试前5个URL（避免过多请求）
          const urlEntries = Object.entries(cacheData.thumbnailUrls).slice(0, 5);
          for (const [videoKey, url] of urlEntries) {
            if (url) {
              const result = await this.testThumbnailUrl(url, videoKey);
              results.push(result);
              // 添加延迟避免请求过快
              await new Promise(resolve => setTimeout(resolve, 100));
            }
          }
        }
      } catch (error) {
        this.log(`解析缓存失败: ${cacheKey}`, { error: error.message });
      }
    }

    this.log('批量测试完成', {
      total: results.length,
      successful: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length
    });

    return results;
  }

  // 检查移动端特殊问题
  checkMobileIssues() {
    const issues = [];

    // 检查User-Agent
    if (this.isMobile) {
      issues.push({
        type: 'info',
        message: '检测到移动设备',
        data: { userAgent: navigator.userAgent }
      });
    }

    // 检查网络状态
    if ('connection' in navigator) {
      const connection = navigator.connection;
      if (connection.effectiveType && ['slow-2g', '2g'].includes(connection.effectiveType)) {
        issues.push({
          type: 'warning',
          message: '网络连接较慢',
          data: {
            effectiveType: connection.effectiveType,
            downlink: connection.downlink
          }
        });
      }
    }

    // 检查localStorage可用性
    try {
      localStorage.setItem('test', 'test');
      localStorage.removeItem('test');
    } catch (e) {
      issues.push({
        type: 'error',
        message: 'localStorage不可用',
        data: { error: e.message }
      });
    }

    // 检查CORS支持
    if (!window.fetch) {
      issues.push({
        type: 'error',
        message: 'fetch API不支持',
        data: {}
      });
    }

    this.log('移动端问题检查完成', { issues });
    return issues;
  }

  // 生成诊断报告
  generateReport() {
    const mobileIssues = this.checkMobileIssues();
    const testSummary = {
      total: this.testResults.size,
      successful: Array.from(this.testResults.values()).filter(r => r.success).length,
      failed: Array.from(this.testResults.values()).filter(r => !r.success).length
    };

    const failureReasons = Array.from(this.testResults.values())
      .filter(r => !r.success)
      .reduce((acc, r) => {
        acc[r.error] = (acc[r.error] || 0) + 1;
        return acc;
      }, {});

    return {
      timestamp: new Date().toISOString(),
      isMobile: this.isMobile,
      userAgent: navigator.userAgent,
      mobileIssues,
      testSummary,
      failureReasons,
      testResults: Array.from(this.testResults.values()),
      logs: this.logs.slice(-50) // 最近50条日志
    };
  }

  // 清除测试结果
  clearResults() {
    this.testResults.clear();
    this.logs = [];
    this.log('测试结果已清除');
  }
}

// 创建全局实例
window.mobileDebugger = new MobileDebugger();

// 如果是移动端，自动开始检查
if (window.mobileDebugger.isMobile) {
  window.mobileDebugger.log('移动端调试器已启动');
  window.mobileDebugger.checkMobileIssues();
}

export default window.mobileDebugger;