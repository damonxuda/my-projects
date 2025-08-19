import React from 'react';
import { Folder, Film } from 'lucide-react';

const FileCard = ({ item, onFolderClick, onVideoPlay }) => {
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

  const handleClick = () => {
    if (isFolder) {
      onFolderClick(item.path);
    } else if (isVideo) {
      onVideoPlay(item);
    }
  };

  return (
    <div 
      className="file-card border border-gray-200 rounded-xl p-6 cursor-pointer bg-white"
      onClick={handleClick}
    >
      <div className="flex flex-col items-center text-center">
        <div className="text-5xl mb-4">
          {isFolder ? (
            <Folder className="text-blue-500" size={48} />
          ) : isVideo ? (
            <Film className="text-red-500" size={48} />
          ) : (
            '📄'
          )}
        </div>
        
        <h4 className="font-semibold text-gray-800 mb-2 break-words text-truncate-2">
          {item.name}
        </h4>
        
        {isVideo && (
          <div className="text-sm text-gray-600 space-y-1">
            {item.size && (
              <p>大小: {formatFileSize(item.size)}</p>
            )}
            {item.lastModified && (
              <p>更新: {formatDate(item.lastModified)}</p>
            )}
          </div>
        )}
        
        {isFolder && (
          <p className="text-sm text-gray-600">
            {item.count || 0} 项内容
          </p>
        )}
      </div>
    </div>
  );
};

export default FileCard;