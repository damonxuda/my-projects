import React, { useState, useEffect, useCallback } from 'react';
import { Film, Play, HardDrive, Loader } from 'lucide-react';

const VideoThumbnail = ({ videoUrl, alt, fileSize, fileName, apiUrl, getToken, clearTokenCache }) => {
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

  // 检查是否是无缩略图的大视频文件
  const isLargeVideoWithoutThumbnail = useCallback((fileName) => {
    const largeVideosWithoutThumbnail = [
      'BBAN-024.mp4',
      'ri.mp4'
    ];
    
    return largeVideosWithoutThumbnail.some(videoName => 
      fileName && fileName.toLowerCase().includes(videoName.toLowerCase())
    );
  }, []);

  // 获取缩略图 - 带重试机制
  const fetchThumbnail = useCallback(async (retryCount = 0) => {
    if (!fileName || !apiUrl || !getToken) {
      return;
    }

    // 检查是否是大视频文件，如果是则直接跳过缩略图请求
    if (isLargeVideoWithoutThumbnail(fileName)) {
      console.log(`跳过大视频文件的缩略图请求: ${fileName}`);
      setLoading(false);
      setError(false);
      return;
    }

    setLoading(true);
    setError(false);

    try {
      const token = await getToken();
      
      const response = await fetch(`${apiUrl}/videos/thumbnail/${encodeURIComponent(fileName)}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        // 对于403认证错误，只在第一次重试时清除token缓存
        if (response.status === 403 && retryCount < 3) {
          if (clearTokenCache && retryCount === 0) {
            console.log(`🔑 ${fileName}: 收到403错误，清除token缓存后重试...`);
            clearTokenCache();
          }
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

      const data = await response.json();

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

  // 尝试直接使用缓存的缩略图URL（避免不必要的Lambda调用）
  const tryDirectThumbnailUrl = useCallback((fileName) => {
    if (!fileName) return null;
    
    // 构建预期的缩略图URL
    const bucketUrl = 'https://damonxuda-video-files.s3.ap-northeast-1.amazonaws.com';
    const thumbnailPath = fileName.replace(/\.[^/.]+$/, '.jpg').replace('videos/', 'thumbnails/');
    return `${bucketUrl}/${thumbnailPath}`;
  }, []);

  // 组件挂载时先尝试直接缩略图，失败后再调用Lambda
  useEffect(() => {
    if (!fileName) return;
    
    // 跳过大视频文件
    if (isLargeVideoWithoutThumbnail(fileName)) {
      console.log(`跳过大视频文件的缩略图请求: ${fileName}`);
      setLoading(false);
      return;
    }

    // 先尝试直接缩略图URL
    const directUrl = tryDirectThumbnailUrl(fileName);
    if (directUrl) {
      console.log(`🎯 尝试直接缩略图URL: ${directUrl}`);
      
      // 创建一个图片来测试URL是否存在，添加超时保护
      const img = new Image();
      img.crossOrigin = 'anonymous'; // 避免CORS问题
      
      const timeout = setTimeout(() => {
        console.log(`⏰ 缩略图检测超时，调用Lambda: ${fileName}`);
        // 超时则调用Lambda
        const delay = Math.random() * 1000;
        setTimeout(() => {
          fetchThumbnail();
        }, delay);
      }, 3000); // 3秒超时
      
      img.onload = () => {
        clearTimeout(timeout);
        console.log(`✅ 缩略图直接命中: ${fileName}`);
        setThumbnailUrl(directUrl);
        setLoading(false);
        setError(false);
      };
      
      img.onerror = () => {
        clearTimeout(timeout);
        console.log(`❌ 缩略图不存在，调用Lambda: ${fileName}`);
        // 缩略图不存在，调用Lambda生成
        const delay = Math.random() * 1000;
        setTimeout(() => {
          fetchThumbnail();
        }, delay);
      };
      
      img.src = directUrl;
    }
  }, [fileName, isLargeVideoWithoutThumbnail, tryDirectThumbnailUrl, fetchThumbnail]);

  return (
    <div className="relative w-full h-32 rounded-lg group cursor-pointer overflow-hidden">
      {thumbnailUrl && !error ? (
        /* 真实缩略图显示 */
        <>
          <img 
            src={thumbnailUrl} 
            alt={fileName || alt}
            className="w-full h-full object-cover"
            onError={() => {
              console.log('缩略图加载失败，回退到默认显示');
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