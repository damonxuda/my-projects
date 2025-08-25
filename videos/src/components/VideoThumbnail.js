import React from 'react';
import { Film, Play, Clock, HardDrive } from 'lucide-react';

const VideoThumbnail = ({ videoUrl, alt, fileSize, fileName }) => {
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

  return (
    <div className={`relative w-full h-32 bg-gradient-to-br ${getVideoColor(fileName || alt)} rounded-lg group cursor-pointer overflow-hidden`}>
      {/* 主要内容区域 */}
      <div className="absolute inset-0 flex flex-col items-center justify-center text-white p-3">
        {/* 视频图标 */}
        <Film size={32} className="mb-2" />
        
        {/* 文件类型 */}
        <div className="text-xs font-semibold mb-1">
          {getFileExtension(fileName || alt)}
        </div>
        
        {/* 文件大小 */}
        {fileSize && (
          <div className="text-xs opacity-90 flex items-center">
            <HardDrive size={10} className="mr-1" />
            {formatSize(fileSize)}
          </div>
        )}
      </div>

      {/* 右上角装饰 */}
      <div className="absolute top-2 right-2">
        <div className="w-6 h-6 bg-white bg-opacity-20 rounded-full flex items-center justify-center">
          <Play size={12} className="text-white ml-0.5" />
        </div>
      </div>

      {/* 鼠标悬停效果 */}
      <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all duration-200" />
      
      {/* 悬停播放按钮 */}
      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-200">
        <div className="bg-white bg-opacity-90 rounded-full p-3 transform scale-75 group-hover:scale-100 transition-transform duration-200">
          <Play className="text-gray-800" size={20} />
        </div>
      </div>

      {/* 底部渐变条 */}
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-white/30 to-transparent" />
    </div>
  );
};

export default VideoThumbnail;