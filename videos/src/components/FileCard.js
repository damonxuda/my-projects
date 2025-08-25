import React, { useState, useRef, useEffect } from 'react';
import { Folder, Film, Play } from 'lucide-react';

const VideoThumbnail = ({ videoUrl, alt }) => {
  const [thumbnailError, setThumbnailError] = useState(false);
  const [imageError, setImageError] = useState(false);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [thumbnailSrc, setThumbnailSrc] = useState(null);

  const handleLoadedData = () => {
    if (videoRef.current && canvasRef.current) {
      try {
        // 跳转到视频的5秒处或1/10处生成缩略图
        const duration = videoRef.current.duration;
        videoRef.current.currentTime = Math.min(5, duration * 0.1);
      } catch (error) {
        console.error('设置视频时间失败:', error);
        setThumbnailError(true);
      }
    }
  };

  const handleSeeked = () => {
    if (videoRef.current && canvasRef.current) {
      try {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        const thumbnailDataUrl = canvas.toDataURL('image/jpeg', 0.8);
        setThumbnailSrc(thumbnailDataUrl);
      } catch (error) {
        console.error('生成缩略图失败:', error);
        setThumbnailError(true);
      }
    }
  };

  const handleVideoError = (error) => {
    console.error('视频加载失败:', error);
    setThumbnailError(true);
  };

  if (thumbnailError) {
    // 缩略图生成失败时显示默认图标
    return (
      <div className="w-full h-32 bg-gradient-to-br from-red-400 to-red-600 rounded-lg flex items-center justify-center">
        <Film className="text-white" size={48} />
      </div>
    );
  }

  return (
    <div className="relative w-full h-32 bg-gray-200 rounded-lg overflow-hidden">
      {/* 隐藏的视频元素用于生成缩略图 */}
      <video
        ref={videoRef}
        src={videoUrl}
        onLoadedData={handleLoadedData}
        onSeeked={handleSeeked}
        onError={handleVideoError}
        muted
        preload="metadata"
        className="absolute opacity-0 pointer-events-none"
        crossOrigin="anonymous"
      />
      
      {/* 隐藏的canvas用于生成缩略图 */}
      <canvas
        ref={canvasRef}
        className="absolute opacity-0 pointer-events-none"
      />
      
      {/* 显示缩略图或加载状态 */}
      {thumbnailSrc ? (
        <img
          src={thumbnailSrc}
          alt={alt}
          className="w-full h-full object-cover"
          onError={() => setImageError(true)}
        />
      ) : (
        // 加载中的状态
        <div className="w-full h-full bg-gradient-to-br from-gray-300 to-gray-400 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
        </div>
      )}
      
      {/* 播放按钮覆盖层 */}
      <div className="absolute inset-0 bg-black bg-opacity-30 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
        <div className="bg-white bg-opacity-90 rounded-full p-2">
          <Play className="text-gray-800" size={24} />
        </div>
      </div>
    </div>
  );
};

const FileCard = ({ item, onFolderClick, onVideoPlay, getVideoUrl, apiUrl }) => {
  const [videoUrl, setVideoUrl] = useState(null);
  const isVideo = item.type === 'video';
  const isFolder = item.type === 'folder';
  
  const formatFileSize = (bytes) => {
    if (!bytes) return '';
    const mb = bytes / 1024 / 1024;
    return mb > 1024 ? `${(mb/1024).toFixed(1)} GB` : `${mb.toFixed(1)} MB`;
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString('zh-CN');
  };

  // 获取视频URL用于缩略图
  useEffect(() => {
    if (isVideo && getVideoUrl && !videoUrl) {
      const loadVideoUrl = async () => {
        try {
          console.log('🎬 获取视频URL用于缩略图:', item.name);
          const url = await getVideoUrl(item.key);
          setVideoUrl(url);
          console.log('✅ 视频URL获取成功');
        } catch (error) {
          console.error('❌ 获取视频URL失败:', item.name, error);
        }
      };
      loadVideoUrl();
    }
  }, [isVideo, item.key, getVideoUrl, videoUrl, item.name]);

  const handleClick = () => {
    if (isFolder) {
      onFolderClick(item.path);
    } else if (isVideo) {
      onVideoPlay(item);
    }
  };

  return (
    <div 
      className="file-card border border-gray-200 rounded-xl p-4 cursor-pointer bg-white hover:shadow-lg hover:border-gray-300 transition-all duration-200"
      onClick={handleClick}
    >
      <div className="flex flex-col">
        {/* 缩略图/图标区域 */}
        <div className="mb-3">
          {isFolder ? (
            <div className="w-full h-32 bg-gradient-to-br from-blue-400 to-blue-600 rounded-lg flex items-center justify-center">
              <Folder className="text-white" size={48} />
            </div>
          ) : isVideo ? (
            videoUrl ? (
              <VideoThumbnail videoUrl={videoUrl} alt={item.name} />
            ) : (
              // 加载中的占位符
              <div className="w-full h-32 bg-gradient-to-br from-gray-300 to-gray-400 rounded-lg flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
              </div>
            )
          ) : (
            <div className="w-full h-32 bg-gradient-to-br from-gray-400 to-gray-600 rounded-lg flex items-center justify-center">
              <span className="text-white text-2xl">📄</span>
            </div>
          )}
        </div>
        
        {/* 文件信息 */}
        <div className="text-center">
          <h4 className="font-semibold text-gray-800 mb-2 text-sm leading-tight line-clamp-2">
            {item.name}
          </h4>
          
          {isVideo && (
            <div className="text-xs text-gray-600 space-y-1">
              {item.size && (
                <p>大小: {formatFileSize(item.size)}</p>
              )}
              {item.lastModified && (
                <p>更新: {formatDate(item.lastModified)}</p>
              )}
            </div>
          )}
          
          {isFolder && (
            <p className="text-xs text-gray-600">
              {item.count || 0} 项内容
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default FileCard;