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
    // 确定文件夹路径 - 与VideoThumbnail.js保持一致
    const pathParts = videoKey.split('/');
    let path = '';
    if (pathParts.length > 2) {
      // videos/Movies/xxx.mp4 -> Movies
      // videos/贾老师初联一轮/xxx.mp4 -> 贾老师初联一轮
      path = pathParts[1];
    } else if (pathParts.length === 2) {
      // videos/Fish20250908.mp4 -> '' (根目录)
      path = '';
    }

    console.log('缓存查询路径:', path, '原文件名:', videoKey);

    // 先检查内存缓存
    let cacheData = this.cache.get(path);

    // 如果内存中没有，尝试从localStorage加载
    if (!cacheData) {
      cacheData = this.loadFromStorage(path);
    }

    // 如果有有效缓存，直接返回
    if (cacheData && this.isCacheValid(cacheData)) {
      const url = cacheData.thumbnailUrls[videoKey] || null;
      return url;
    }

    return null; // 需要加载
  }

  // 批量加载缩略图URLs
  async loadBatchThumbnails(path, apiUrl, getToken) {
    // 避免重复请求
    const loadingKey = path || 'root';

    if (this.loadingPromises.has(loadingKey)) {
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

  // 清除所有缓存（用于文件操作后强制刷新）
  clearAllCache() {
    // 清除内存缓存
    this.cache.clear();

    // 清除localStorage中的所有缩略图缓存
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('thumbnails_')) {
        keys.push(key);
      }
    }

    keys.forEach(key => {
      localStorage.removeItem(key);
    });

    console.log(`🗑️ 清除所有缩略图缓存: ${keys.length} 个缓存项`);
  }
}

// 全局单例
const thumbnailCache = new ThumbnailCache();

// 页面加载时清理过期缓存
thumbnailCache.cleanupExpiredCache();

export default thumbnailCache;