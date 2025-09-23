import React, { useState, useEffect, useCallback } from 'react';
import { Film, Play, HardDrive, Loader } from 'lucide-react';
import thumbnailCache from '../utils/thumbnailCache';

const VideoThumbnail = ({ alt, fileSize, fileName, apiUrl, getToken }) => {
  const [thumbnailUrl, setThumbnailUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  // 根据文件扩展名显示不同的颜色
  const getVideoColor = (filename) => {
    const ext = filename.toLowerCase().split('.').pop();
    switch (ext) {
      case 'mp4': return 'from-blue-500 to-blue-600';
      case 'avi': return 'from-red-500 to-red-600';
      case 'mov': return 'from-green-500 to-green-600';
      case 'wmv': return 'from-purple-500 to-purple-600';
      case 'mkv': return 'from-orange-500 to-orange-600';
      default: return 'from-gray-500 to-gray-600';
    }
  };

  // 格式化文件大小
  const formatSize = (bytes) => {
    if (!bytes) return '';
    const mb = bytes / 1024 / 1024;
    if (mb > 1024) {
      return `${(mb/1024).toFixed(1)}GB`;
    }
    return `${mb.toFixed(0)}MB`;
  };

  // 获取文件扩展名
  const getFileExtension = (filename) => {
    return filename.split('.').pop().toUpperCase();
  };

  // 检查是否是无缩略图的大视频文件 (>1GB)
  const isLargeVideoWithoutThumbnail = useCallback((fileName, fileSize) => {
    // 1GB = 1024 * 1024 * 1024 bytes - 超过1GB的文件跳过缩略图生成
    const oneGBInBytes = 1024 * 1024 * 1024;
    
    // 如果文件大小超过1GB，不生成缩略图
    if (fileSize && fileSize > oneGBInBytes) {
      console.log(`跳过大文件 (${formatSize(fileSize)}): ${fileName}`);
      return true;
    }
    
    return false;
  }, []);

  // 获取缩略图 - 带重试机制
  const fetchThumbnail = useCallback(async (retryCount = 0) => {
    if (!fileName || !apiUrl || !getToken) {
      return;
    }

    // 检查是否是大视频文件，如果是则直接跳过缩略图请求
    if (isLargeVideoWithoutThumbnail(fileName, fileSize)) {
      console.log(`跳过大视频文件的缩略图请求: ${fileName}`);
      setLoading(false);
      setError(false);
      return;
    }

    setLoading(true);
    setError(false);

    try {
      const token = await getToken();
      
      const response = await fetch(`${apiUrl}/thumbnails/generate/${encodeURIComponent(fileName)}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        // 对于403认证错误，进行重试
        if (response.status === 403 && retryCount < 3) {
          const delay = Math.min(1000 * Math.pow(2, retryCount), 10000);
          console.log(`${fileName}: 缩略图请求失败 (${response.status})，${delay}ms后重试 (${retryCount + 1}/3)...`);
          setTimeout(() => fetchThumbnail(retryCount + 1), delay);
          return;
        }
        // 对于502/503等服务器错误，直接重试但不清除token缓存
        if (response.status >= 500 && retryCount < 3) {
          const delay = Math.min(1000 * Math.pow(2, retryCount), 10000);
          console.log(`${fileName}: 服务器错误 (${response.status})，${delay}ms后重试 (${retryCount + 1}/3)... (不清除token)`);
          setTimeout(() => fetchThumbnail(retryCount + 1), delay);
          return;
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const responseText = await response.text();
      
      // 检查响应是否是HTML而不是JSON
      if (responseText.trim().startsWith('<!DOCTYPE') || responseText.trim().startsWith('<html')) {
        console.error(`❌ ${fileName} - 缩略图API返回HTML响应:`, responseText.substring(0, 500));
        throw new Error('缩略图服务返回HTML页面而非JSON数据');
      }
      
      let data;
      try {
        data = JSON.parse(responseText);
      } catch (parseError) {
        console.error(`❌ ${fileName} - 缩略图JSON解析失败:`, parseError);
        console.error(`❌ ${fileName} - 原始响应:`, responseText);
        throw new Error(`缩略图JSON解析失败: ${parseError.message}`);
      }

      if (data.success && data.thumbnailUrl) {
        setThumbnailUrl(data.thumbnailUrl);
      } else {
        throw new Error('Invalid response from thumbnail API');
      }
    } catch (err) {
      console.error(`缩略图加载失败 (${fileName}):`, err.message);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [fileName, apiUrl, getToken, isLargeVideoWithoutThumbnail]);

  // 从缓存加载缩略图
  const loadThumbnailFromCache = useCallback(async () => {
    try {
      console.log(`🔍 开始加载缩略图: ${fileName}`);
      console.log(`🔍 thumbnailCache对象:`, thumbnailCache);
      console.log(`🔍 thumbnailCache.getThumbnailUrl存在:`, typeof thumbnailCache.getThumbnailUrl);
      
      setLoading(true);
      setError(false);

      // 1. 先尝试从缓存获取
      console.log(`🔍 准备调用 thumbnailCache.getThumbnailUrl(${fileName})`);
      const cachedUrl = thumbnailCache.getThumbnailUrl(fileName);
      console.log(`🔍 getThumbnailUrl返回结果:`, cachedUrl);
      if (cachedUrl) {
        console.log(`📦 缩略图缓存命中: ${fileName} -> ${cachedUrl}`);
        setThumbnailUrl(cachedUrl);
        setLoading(false);
        return;
      }

      // 2. 缓存未命中，需要批量加载该文件夹的缩略图
      console.log(`❌ 缩略图缓存未命中，开始批量加载: ${fileName}`);
      
      // 确定文件夹路径
      const pathParts = fileName.split('/');
      const folderPath = pathParts.length > 2 ? pathParts[1] : ''; // videos/Movies/xxx.mp4 -> Movies

      // 批量加载该文件夹的所有缩略图
      console.log(`🚀 开始批量加载: ${folderPath}`);
      await thumbnailCache.loadBatchThumbnails(folderPath, apiUrl, getToken);
      console.log(`🚀 批量加载完成: ${folderPath}`);
      
      // 3. 批量加载完成后，再次尝试获取缩略图URL
      const batchLoadedUrl = thumbnailCache.getThumbnailUrl(fileName);
      console.log(`🔍 批量加载后检查缓存: ${fileName} -> ${batchLoadedUrl ? '找到URL' : '未找到URL'}`);
      
      if (batchLoadedUrl) {
        console.log(`✅ 批量加载成功: ${fileName}`);
        setThumbnailUrl(batchLoadedUrl);
      } else {
        console.log(`❌ 批量加载后仍无缩略图: ${fileName}，回退到单独生成`);
        // 回退到单独生成，但增加随机延迟避免并发资源耗尽
        const delay = Math.random() * 5000 + 2000; // 2-7秒随机延迟
        console.log(`⏳ ${fileName}: ${Math.round(delay/1000)}秒后开始生成缩略图`);
        setTimeout(() => {
          console.log(`🔄 开始为 ${fileName} 生成缩略图`);
          fetchThumbnail();
        }, delay);
        return;
      }
      
    } catch (error) {
      console.error(`缩略图加载失败 (${fileName}):`, error.message);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [fileName, apiUrl, getToken, fetchThumbnail]);

  // 尝试直接使用缓存的缩略图URL（避免不必要的Lambda调用）
  const tryDirectThumbnailUrl = useCallback((fileName) => {
    if (!fileName) return null;
    
    // 构建预期的缩略图URL - 缩略图在thumbnails/目录下
    const bucketUrl = 'https://damonxuda-video-files.s3.ap-northeast-1.amazonaws.com';
    // videos/xxx.mp4 -> thumbnails/xxx.jpg
    // videos/Movies/xxx.mp4 -> thumbnails/Movies/xxx.jpg
    const baseName = fileName.split('/').slice(1).join('/'); // 去掉videos/前缀
    const thumbnailPath = `thumbnails/${baseName.replace(/\.[^/.]+$/, '.jpg')}`;
    return `${bucketUrl}/${thumbnailPath}`;
  }, []);

  // 组件挂载时使用批量缓存机制加载缩略图
  useEffect(() => {
    console.log(`🟡 VideoThumbnail useEffect 触发 - fileName: ${fileName}`);
    console.log(`🟡 apiUrl: ${apiUrl}, getToken: ${!!getToken}`);
    
    if (!fileName) {
      console.log(`🟡 fileName为空，跳过: ${fileName}`);
      return;
    }
    
    // 跳过大视频文件
    if (isLargeVideoWithoutThumbnail(fileName, fileSize)) {
      console.log(`跳过大视频文件的缩略图请求: ${fileName}`);
      setLoading(false);
      return;
    }

    console.log(`🟡 开始调用 loadThumbnailFromCache: ${fileName}`);
    loadThumbnailFromCache();
  }, [fileName, fileSize]); // 只依赖真正的值，不依赖函数

  return (
    <div className="relative w-full h-32 rounded-lg group cursor-pointer overflow-hidden">
      {thumbnailUrl && !error ? (
        /* 真实缩略图显示 */
        <>
          <img 
            src={thumbnailUrl} 
            alt={fileName || alt}
            className="w-full h-full object-cover"
            onError={(e) => {
              console.log('🔴 缩略图img加载失败:', fileName);
              console.log('🔴 失败的URL:', thumbnailUrl);
              console.log('🔴 错误事件:', e);
              console.log('🔴 img元素:', e.target);
              setError(true);
            }}
          />
          
          {/* 右上角播放图标 */}
          <div className="absolute top-2 right-2">
            <div className="w-6 h-6 bg-black bg-opacity-50 rounded-full flex items-center justify-center">
              <Play size={12} className="text-white ml-0.5" />
            </div>
          </div>

          {/* 鼠标悬停效果 */}
          <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-all duration-200" />
          
          {/* 悬停播放按钮 */}
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-200">
            <div className="bg-white bg-opacity-90 rounded-full p-3 transform scale-75 group-hover:scale-100 transition-transform duration-200">
              <Play className="text-gray-800" size={20} />
            </div>
          </div>

          {/* 底部视频信息 */}
          <div className="absolute bottom-2 left-2">
            <div className="bg-black bg-opacity-70 rounded px-2 py-1 flex items-center gap-1">
              <Film className="text-white" size={12} />
              <span className="text-white text-xs font-medium">
                {getFileExtension(fileName || alt)}
              </span>
              {fileSize && (
                <>
                  <span className="text-white text-xs mx-1">•</span>
                  <span className="text-white text-xs">
                    {formatSize(fileSize)}
                  </span>
                </>
              )}
            </div>
          </div>
        </>
      ) : (
        /* 加载状态或默认显示 */
        <>
          <div className={`w-full h-full bg-gradient-to-br ${getVideoColor(fileName || alt)} flex flex-col items-center justify-center text-white p-3`}>
            {loading ? (
              /* 加载动画 */
              <>
                <Loader size={32} className="mb-2 animate-spin" />
                <div className="text-xs font-semibold">
                  生成缩略图中...
                </div>
              </>
            ) : (
              /* 默认图标显示 */
              <>
                <Film size={32} className="mb-2" />
                <div className="text-xs font-semibold mb-1">
                  {getFileExtension(fileName || alt)}
                </div>
                {fileSize && (
                  <div className="text-xs opacity-90 flex items-center">
                    <HardDrive size={10} className="mr-1" />
                    {formatSize(fileSize)}
                  </div>
                )}
                {error && (
                  <div className="text-xs opacity-75 mt-1 text-yellow-200">
                    缩略图生成失败
                  </div>
                )}
              </>
            )}
          </div>

          {/* 右上角播放图标 - 始终显示 */}
          <div className="absolute top-2 right-2">
            <div className="w-6 h-6 bg-black bg-opacity-50 rounded-full flex items-center justify-center">
              <Play size={12} className="text-white ml-0.5" />
            </div>
          </div>

          {/* 鼠标悬停效果 */}
          <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-all duration-200" />
          
          {/* 悬停播放按钮 */}
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-200">
            <div className="bg-white bg-opacity-90 rounded-full p-3 transform scale-75 group-hover:scale-100 transition-transform duration-200">
              <Play className="text-gray-800" size={20} />
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default VideoThumbnail;