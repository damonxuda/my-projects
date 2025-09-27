// 移动端兼容性检查和修复工具
export class MobileCompatibilityChecker {
  constructor() {
    this.isMobile = /Mobi|Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    this.isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    this.isAndroid = /Android/.test(navigator.userAgent);
  }

  // 检查是否为移动设备
  isMobileDevice() {
    return this.isMobile;
  }

  // 验证缩略图URL的移动端兼容性
  async validateThumbnailUrl(url, fileName = '') {
    if (!this.isMobile || !url) {
      return { valid: true, reason: 'Desktop or no URL' };
    }


    try {
      // 1. 基本URL格式检查
      const urlObj = new URL(url);
      const isS3Url = urlObj.hostname.includes('amazonaws.com') || urlObj.hostname.includes('s3');

      if (!isS3Url) {
        return { valid: false, reason: 'Not S3 URL' };
      }

      // 2. 检查必需的S3签名参数
      const requiredParams = ['X-Amz-Algorithm', 'X-Amz-Credential', 'X-Amz-Date', 'X-Amz-SignedHeaders', 'X-Amz-Signature'];
      const missingParams = requiredParams.filter(param => !urlObj.searchParams.has(param));

      if (missingParams.length > 0) {
        return { valid: false, reason: `Missing params: ${missingParams.join(', ')}` };
      }

      // 3. 检查URL过期时间
      const expires = urlObj.searchParams.get('X-Amz-Expires');
      const date = urlObj.searchParams.get('X-Amz-Date');

      if (expires && date) {
        const expiryTime = new Date(date);
        expiryTime.setSeconds(expiryTime.getSeconds() + parseInt(expires));

        if (expiryTime <= new Date()) {
          return { valid: false, reason: 'URL expired' };
        }
      }

      // 4. 移动端网络测试
      const testResult = await this.testUrlAccess(url);
      return testResult;

    } catch (error) {
      console.error('移动端URL验证失败:', error);
      return { valid: false, reason: `Validation error: ${error.message}` };
    }
  }

  // 测试URL的实际可访问性
  async testUrlAccess(url) {
    try {
      // 使用HEAD请求测试URL可访问性（更轻量）
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10秒超时

      const response = await fetch(url, {
        method: 'HEAD',
        mode: 'cors',
        cache: 'no-cache',
        signal: controller.signal,
        headers: {
          'User-Agent': navigator.userAgent // 确保使用移动端User-Agent
        }
      });

      clearTimeout(timeoutId);


      if (response.ok) {
        const contentType = response.headers.get('content-type');
        const contentLength = response.headers.get('content-length');

        return {
          valid: true,
          reason: 'URL accessible',
          details: {
            status: response.status,
            contentType,
            contentLength: contentLength ? parseInt(contentLength) : null
          }
        };
      } else {
        return {
          valid: false,
          reason: `HTTP ${response.status}: ${response.statusText}`,
          details: { status: response.status }
        };
      }

    } catch (error) {
      console.error('移动端网络测试失败:', error);

      // 分析错误类型
      let reason = 'Network error';
      if (error.name === 'AbortError') {
        reason = 'Request timeout';
      } else if (error.message.includes('CORS')) {
        reason = 'CORS error';
      } else if (error.message.includes('Failed to fetch')) {
        reason = 'Network or CORS error';
      }

      return { valid: false, reason, error: error.message };
    }
  }

  // 获取移动端诊断信息
  getDiagnosticInfo() {
    return {
      userAgent: navigator.userAgent,
      isMobile: this.isMobile,
      isIOS: this.isIOS,
      isAndroid: this.isAndroid,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      devicePixelRatio: window.devicePixelRatio,
      connection: navigator.connection ? {
        effectiveType: navigator.connection.effectiveType,
        downlink: navigator.connection.downlink,
        rtt: navigator.connection.rtt
      } : null,
      onLine: navigator.onLine,
      cookieEnabled: navigator.cookieEnabled,
      doNotTrack: navigator.doNotTrack,
      timestamp: new Date().toISOString()
    };
  }

  // 生成移动端优化的缩略图请求参数
  getMobileOptimizedParams() {
    const params = {
      // 移动端优化的图片参数
      'response-cache-control': 'max-age=3600, must-revalidate',
      'response-content-type': 'image/jpeg'
    };

    // iOS特殊优化
    if (this.isIOS) {
      params['response-content-disposition'] = 'inline';
    }

    return params;
  }

  // 检查本地存储可用性
  checkLocalStorageAvailability() {
    try {
      const test = '__storage_test__';
      localStorage.setItem(test, test);
      localStorage.removeItem(test);
      return true;
    } catch (e) {
      console.warn('移动端localStorage不可用:', e);
      return false;
    }
  }

  // 记录移动端特殊问题
  logMobileIssue(issue, context = {}) {
    const logData = {
      timestamp: new Date().toISOString(),
      issue,
      context,
      diagnostic: this.getDiagnosticInfo()
    };

    console.error('🚨 移动端问题报告:', logData);

    // 尝试保存到localStorage用于后续分析
    try {
      const existingLogs = JSON.parse(localStorage.getItem('mobile_issues') || '[]');
      existingLogs.push(logData);

      // 只保留最近50条记录
      const recentLogs = existingLogs.slice(-50);
      localStorage.setItem('mobile_issues', JSON.stringify(recentLogs));
    } catch (e) {
      console.warn('无法保存移动端问题日志:', e);
    }

    return logData;
  }

  // 获取保存的移动端问题日志
  getMobileIssueLog() {
    try {
      return JSON.parse(localStorage.getItem('mobile_issues') || '[]');
    } catch (e) {
      return [];
    }
  }

  // 清除移动端问题日志
  clearMobileIssueLog() {
    try {
      localStorage.removeItem('mobile_issues');
    } catch (e) {
      console.warn('无法清除移动端问题日志:', e);
    }
  }
}

// 全局单例
const mobileCompatibility = new MobileCompatibilityChecker();

export default mobileCompatibility;