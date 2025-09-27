import React, { useState } from 'react';
import { FolderIcon, ChevronRightIcon, RefreshCw } from 'lucide-react';
import FileCard from '../FileCard';
import Breadcrumb from '../Breadcrumb';

const VideoFileList = ({
  items,
  loading,
  currentPath,
  onVideoPlay,
  onNavigate,
  onRefresh,
  apiUrl,
  thumbnailApiUrl,
  getToken
}) => {

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
            path={currentPath}
            onNavigate={onNavigate}
          />

          <div className="flex items-center space-x-3">
            <button
              onClick={onRefresh}
              className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <RefreshCw className="w-4 h-4 mr-1.5" />
              刷新
            </button>
          </div>
        </div>

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

              return (
                <FileCard
                  key={itemKey || index}
                  item={item}
                  onFolderClick={onNavigate}
                  onVideoPlay={onVideoPlay}
                  apiUrl={apiUrl}
                  thumbnailApiUrl={thumbnailApiUrl}
                  getToken={getToken}
                  isMultiSelectMode={false}
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