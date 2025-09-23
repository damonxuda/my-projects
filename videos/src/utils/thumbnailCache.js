// 缩略图批量缓存管理器
class ThumbnailCache {
  constructor() {
    this.cache = new Map();
    this.loadingPromises = new Map(); // 避免重复请求
  }

  // 获取缓存key
  getCacheKey(path) {
    return `thumbnails_${path || 'root'}`;
  }

  // 检查缓存是否有效
  isCacheValid(cacheData) {
    if (!cacheData || !cacheData.expiresAt) return false;
    return Date.now() < cacheData.expiresAt;
  }

  // 从localStorage加载缓存
  loadFromStorage(path) {
    try {
      const cacheKey = this.getCacheKey(path);
      const stored = localStorage.getItem(cacheKey);
      if (stored) {
        const data = JSON.parse(stored);
        if (this.isCacheValid(data)) {
          this.cache.set(path, data);
          return data;
        } else {
          // 过期缓存删除
          localStorage.removeItem(cacheKey);
        }
      }
    } catch (error) {
      console.error('加载缓存失败:', error);
    }
    return null;
  }

  // 保存到localStorage
  saveToStorage(path, data) {
    try {
      const cacheKey = this.getCacheKey(path);
      localStorage.setItem(cacheKey, JSON.stringify(data));
    } catch (error) {
      console.error('保存缓存失败:', error);
    }
  }

  // 获取单个视频的缩略图URL
  getThumbnailUrl(videoKey) {
    // 确定文件夹路径
    const pathParts = videoKey.split('/');
    const path = pathParts.length > 2 ? pathParts[1] : ''; // videos/Movies/xxx.mp4 -> Movies

    // 先检查内存缓存
    let cacheData = this.cache.get(path);

    // 如果内存中没有，尝试从localStorage加载
    if (!cacheData) {
      cacheData = this.loadFromStorage(path);
    }

    // 如果有有效缓存，直接返回
    if (cacheData && this.isCacheValid(cacheData)) {
      const url = cacheData.thumbnailUrls[videoKey] || null;
      // 临时调试：检查缓存数据结构
      if (!url) {
        console.log(`DEBUG: 缓存中无URL for ${videoKey}`);
        console.log('DEBUG: 可用的keys:', Object.keys(cacheData.thumbnailUrls || {}));
        console.log('DEBUG: 完整缓存数据:', cacheData);
      }
      return url;
    }

    return null; // 需要加载
  }

  // 批量加载缩略图URLs
  async loadBatchThumbnails(path, apiUrl, getToken) {
    // 避免重复请求
    const loadingKey = path || 'root';
    if (this.loadingPromises.has(loadingKey)) {
      console.log(`⏳ 等待正在进行的请求: ${path}`);
      return await this.loadingPromises.get(loadingKey);
    }

    const loadPromise = this._performBatchLoad(path, apiUrl, getToken);
    this.loadingPromises.set(loadingKey, loadPromise);

    try {
      const result = await loadPromise;
      this.loadingPromises.delete(loadingKey);
      return result;
    } catch (error) {
      this.loadingPromises.delete(loadingKey);
      throw error;
    }
  }

  // 执行批量加载
  async _performBatchLoad(path, apiUrl, getToken) {
    try {
      const token = await getToken();
      const pathParam = path ? `?path=${encodeURIComponent(path)}` : '';
      const url = `${apiUrl}/thumbnails/batch${pathParam}`;
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const responseText = await response.text();
        throw new Error(`批量获取缩略图失败: ${response.status} - ${responseText}`);
      }

      const data = await response.json();

      // 临时调试：检查API响应数据结构
      console.log(`DEBUG API响应 for path "${path}":`, {
        success: data.success,
        count: data.count,
        thumbnailUrlsKeys: Object.keys(data.thumbnailUrls || {}),
        sampleData: data
      });

      if (data.success) {
        // 保存到内存和localStorage
        this.cache.set(path, data);
        this.saveToStorage(path, data);
        return data;
      } else {
        throw new Error('批量获取缩略图返回失败状态');
      }
    } catch (error) {
      console.error(`批量加载失败 ${path}:`, error);
      throw error;
    }
  }

  // 清除指定路径的缓存
  clearCache(path) {
    const cacheKey = this.getCacheKey(path);
    this.cache.delete(path);
    localStorage.removeItem(cacheKey);
    console.log(`🗑️ 清除缓存: ${path}`);
  }

  // 清除所有过期缓存
  cleanupExpiredCache() {
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('thumbnails_')) {
        keys.push(key);
      }
    }

    keys.forEach(key => {
      try {
        const data = JSON.parse(localStorage.getItem(key));
        if (!this.isCacheValid(data)) {
          localStorage.removeItem(key);
          console.log(`🗑️ 清除过期缓存: ${key}`);
        }
      } catch (error) {
        localStorage.removeItem(key);
      }
    });
  }
}

// 全局单例
const thumbnailCache = new ThumbnailCache();

// 页面加载时清理过期缓存
thumbnailCache.cleanupExpiredCache();

export default thumbnailCache;