import React, { useState } from 'react';
import { FolderIcon, ChevronRightIcon, RefreshCw } from 'lucide-react';
import FileCard from '../FileCard';
import Breadcrumb from '../Breadcrumb';

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

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border">
      {/* 路径导航和控制栏 */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between mb-3">
          <Breadcrumb
            currentPath={currentPath}
            onNavigate={onNavigate}
          />

          <div className="flex items-center space-x-3">
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
              className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <RefreshCw className="w-4 h-4 mr-1.5" />
              刷新
            </button>
          </div>
        </div>

        {/* 选择状态提示 */}
        {selectedItems.length > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-md p-2">
            <p className="text-sm text-blue-800">
              已选择 {selectedItems.length} 个项目
            </p>
          </div>
        )}
      </div>

      {/* 文件网格 */}
      <div className="p-4">
        {loading ? (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-3 text-sm text-gray-600">加载中...</span>
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-12">
            <FolderIcon className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">暂无文件</h3>
            <p className="mt-1 text-sm text-gray-500">
              {currentPath ? '当前文件夹为空' : '开始上传您的第一个视频'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {items.map((item, index) => {
              const itemKey = item.key || item.Key;
              const isSelected = selectedItems.some(selected => (selected.key || selected.Key) === itemKey);

              return (
                <FileCard
                  key={itemKey || index}
                  item={item}
                  onFolderClick={onNavigate}
                  onVideoPlay={onVideoPlay}
                  apiUrl={apiUrl}
                  thumbnailApiUrl={thumbnailApiUrl}
                  getToken={getToken}
                  isMultiSelectMode={true}
                  isSelected={isSelected}
                  onSelectionChange={(selected) => {
                    if (selected) {
                      setSelectedItems([...selectedItems, item]);
                    } else {
                      setSelectedItems(selectedItems.filter(selected => (selected.key || selected.Key) !== itemKey));
                    }
                  }}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default VideoFileList;