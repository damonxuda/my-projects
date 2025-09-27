import React, { useState } from 'react';
import { FolderIcon, ChevronLeftIcon, ChevronRightIcon } from 'lucide-react';
import VideoThumbnail from '../VideoThumbnail';

const VideoFileList = ({
  items,
  loading,
  currentPath,
  selectedItems,
  setSelectedItems,
  onVideoPlay,
  onNavigate,
  onRefresh,
  apiUrl,
  thumbnailApiUrl,
  getToken
}) => {
  const [selectAll, setSelectAll] = useState(false);

  // 获取路径面包屑
  const getPathSegments = () => {
    if (!currentPath) return [{ name: '根目录', path: '' }];

    const segments = [{ name: '根目录', path: '' }];
    const parts = currentPath.split('/').filter(part => part);

    let currentSegmentPath = '';
    parts.forEach(part => {
      currentSegmentPath += (currentSegmentPath ? '/' : '') + part;
      segments.push({
        name: part,
        path: currentSegmentPath
      });
    });

    return segments;
  };

  // 处理文件选择
  const handleItemSelect = (item) => {
    const itemKey = item.key || item.Key;
    const isSelected = selectedItems.some(selected => (selected.key || selected.Key) === itemKey);

    if (isSelected) {
      setSelectedItems(selectedItems.filter(selected => (selected.key || selected.Key) !== itemKey));
    } else {
      setSelectedItems([...selectedItems, item]);
    }
  };

  // 全选/取消全选
  const handleSelectAll = () => {
    if (selectAll) {
      setSelectedItems([]);
      setSelectAll(false);
    } else {
      setSelectedItems([...items]);
      setSelectAll(true);
    }
  };

  // 处理文件/文件夹点击
  const handleItemClick = (item) => {
    if (item.isDirectory) {
      const newPath = item.key || item.Key;
      onNavigate(newPath.endsWith('/') ? newPath.slice(0, -1) : newPath);
    } else {
      onVideoPlay(item);
    }
  };

  // 格式化文件大小
  const formatFileSize = (bytes) => {
    if (!bytes) return '';
    const mb = bytes / 1024 / 1024;
    if (mb > 1024) {
      return `${(mb/1024).toFixed(1)}GB`;
    }
    return `${mb.toFixed(0)}MB`;
  };

  // 格式化修改时间
  const formatDate = (dateString) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString('zh-CN');
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="bg-white shadow rounded-lg">
      {/* 路径导航 */}
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <nav className="flex" aria-label="Breadcrumb">
            <ol className="flex items-center space-x-2">
              {getPathSegments().map((segment, index) => (
                <li key={index} className="flex items-center">
                  {index > 0 && <ChevronRightIcon className="h-4 w-4 text-gray-400 mx-2" />}
                  <button
                    onClick={() => onNavigate(segment.path)}
                    className={`text-sm font-medium ${
                      index === getPathSegments().length - 1
                        ? 'text-gray-500 cursor-default'
                        : 'text-blue-600 hover:text-blue-800'
                    }`}
                  >
                    {segment.name}
                  </button>
                </li>
              ))}
            </ol>
          </nav>

          <div className="flex items-center space-x-4">
            {/* 全选按钮 */}
            {items.length > 0 && (
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={selectAll}
                  onChange={handleSelectAll}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="ml-2 text-sm text-gray-700">全选</span>
              </label>
            )}

            <button
              onClick={onRefresh}
              className="text-blue-600 hover:text-blue-800 text-sm font-medium"
            >
              刷新
            </button>
          </div>
        </div>

        {/* 选择提示 */}
        {selectedItems.length > 0 && (
          <div className="mt-2 text-sm text-blue-600">
            已选择 {selectedItems.length} 个项目
          </div>
        )}
      </div>

      {/* 文件列表 */}
      <div className="divide-y divide-gray-200">
        {items.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <FolderIcon className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">暂无文件</h3>
            <p className="mt-1 text-sm text-gray-500">
              {currentPath ? '当前文件夹为空' : '开始上传您的第一个视频'}
            </p>
          </div>
        ) : (
          items.map((item, index) => {
            const itemKey = item.key || item.Key;
            const isSelected = selectedItems.some(selected => (selected.key || selected.Key) === itemKey);

            return (
              <div
                key={itemKey || index}
                className={`px-6 py-4 hover:bg-gray-50 ${
                  isSelected ? 'bg-blue-50' : ''
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4 flex-1 min-w-0">
                    {/* 选择框 */}
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => handleItemSelect(item)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />

                    {/* 缩略图或文件夹图标 */}
                    <div className="flex-shrink-0">
                      {item.isDirectory ? (
                        <FolderIcon className="h-10 w-10 text-blue-500" />
                      ) : (
                        <div className="w-16 h-10">
                          <VideoThumbnail
                            fileName={itemKey}
                            fileSize={item.size}
                            apiUrl={apiUrl}
                            getToken={getToken}
                            alt={item.displayName}
                          />
                        </div>
                      )}
                    </div>

                    {/* 文件信息 */}
                    <div className="flex-1 min-w-0">
                      <button
                        onClick={() => handleItemClick(item)}
                        className="text-left w-full"
                      >
                        <p className="text-sm font-medium text-gray-900 truncate hover:text-blue-600">
                          {item.displayName}
                        </p>
                        <div className="flex items-center space-x-4 mt-1">
                          {!item.isDirectory && (
                            <p className="text-xs text-gray-500">
                              {formatFileSize(item.size)}
                            </p>
                          )}
                          <p className="text-xs text-gray-500">
                            {formatDate(item.lastModified)}
                          </p>
                        </div>
                      </button>
                    </div>
                  </div>

                  {/* 文件类型标识 */}
                  <div className="flex-shrink-0">
                    {item.isDirectory ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        文件夹
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        {item.displayName?.split('.').pop()?.toUpperCase() || '视频'}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default VideoFileList;