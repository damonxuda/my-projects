import React, { useState, useEffect } from 'react';
import { Film, Play, HardDrive, Loader } from 'lucide-react';

const VideoThumbnail = ({ videoUrl, alt, fileSize, fileName, apiUrl, getToken }) => {
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

  // 获取缩略图
  const fetchThumbnail = async () => {
    if (!fileName || !apiUrl || !getToken) {
      return;
    }

    setLoading(true);
    setError(false);

    try {
      console.log('🖼️ 开始获取缩略图:', fileName);
      const token = await getToken();
      
      const response = await fetch(`${apiUrl}/videos/thumbnail/${encodeURIComponent(fileName)}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      console.log('📸 缩略图API响应:', data);

      if (data.success && data.thumbnailUrl) {
        setThumbnailUrl(data.thumbnailUrl);
        console.log('✅ 缩略图获取成功:', data.cached ? '(缓存)' : '(新生成)');
      } else {
        throw new Error('Invalid response from thumbnail API');
      }
    } catch (err) {
      console.error('❌ 缩略图获取失败:', err);
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  // 组件挂载时获取缩略图
  useEffect(() => {
    fetchThumbnail();
  }, [fileName, apiUrl]);

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