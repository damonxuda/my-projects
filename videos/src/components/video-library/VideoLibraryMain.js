import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from "../../../../auth-clerk/src";
import VideoFileList from './VideoFileList';
import FileOperations from './FileOperations';
import VideoUpload from './VideoUpload';
import YouTubeManager from './YouTubeManager';
import VideoOperationModals from './VideoOperationModals';

const VideoLibraryMain = () => {
  // 核心状态
  const [currentPath, setCurrentPath] = useState("");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedVideo, setSelectedVideo] = useState(null);

  // UI控制状态
  const [showUpload, setShowUpload] = useState(false);
  const [showAddYouTube, setShowAddYouTube] = useState(false);
  const [showFileManager, setShowFileManager] = useState(false);

  // 文件操作状态
  const [selectedItem, setSelectedItem] = useState(null);
  const [selectedItems, setSelectedItems] = useState([]);
  const [fileOperation, setFileOperation] = useState(null);
  const [operationData, setOperationData] = useState({});
  const [isProcessingOperation, setIsProcessingOperation] = useState(false);

  const { user, isSignedIn, isAdmin, getToken } = useAuth();

  // API配置
  const FILE_MANAGEMENT_URL = process.env.REACT_APP_FILE_MANAGEMENT_API_URL;
  const THUMBNAIL_GENERATOR_URL = process.env.REACT_APP_THUMBNAIL_GENERATOR_API_URL;
  const FORMAT_CONVERTER_URL = process.env.REACT_APP_FORMAT_CONVERTER_API_URL;
  const VIDEO_PLAYER_URL = process.env.REACT_APP_VIDEO_PLAYER_API_URL;
  const YOUTUBE_MANAGER_URL = process.env.REACT_APP_YOUTUBE_MANAGER_API_URL;

  // 跨模块导航处理
  const handleCrossModuleNavigation = (targetUrl) => {
    if (targetUrl && targetUrl !== window.location.href) {
      window.location.href = targetUrl;
    }
  };

  // 文件列表处理逻辑
  const processFileList = useCallback((files, currentPath) => {
    // 实现文件列表处理逻辑
    const processedItems = files.map(file => ({
      ...file,
      isDirectory: file.key ? file.key.endsWith('/') : false,
      displayName: file.key ? file.key.split('/').pop() || file.key : file.fileName,
      parentPath: currentPath
    }));

    return processedItems.sort((a, b) => {
      if (a.isDirectory && !b.isDirectory) return -1;
      if (!a.isDirectory && b.isDirectory) return 1;
      return a.displayName.localeCompare(b.displayName);
    });
  }, []);

  // 加载文件列表
  const loadItems = useCallback(async (path = "") => {
    if (!isSignedIn || !FILE_MANAGEMENT_URL) {
      return;
    }

    setLoading(true);
    setError("");

    try {
      const token = await getToken();
      const apiPath = '/files/list';
      const requestUrl = `${FILE_MANAGEMENT_URL}${apiPath}?path=${encodeURIComponent(path)}`;

      const response = await fetch(requestUrl, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      if (data.success) {
        const processedItems = processFileList(data.files || [], path);
        setItems(processedItems);
        setCurrentPath(path);
      } else {
        throw new Error(data.error || 'Failed to load files');
      }
    } catch (err) {
      console.error('Error loading items:', err);
      setError(`Failed to load files: ${err.message}`);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [isSignedIn, FILE_MANAGEMENT_URL, getToken, processFileList]);

  // 路径导航
  const navigateToPath = (path) => {
    setCurrentPath(path);
    loadItems(path);
  };

  // 视频播放处理
  const handleVideoPlay = (video) => {
    setSelectedVideo(video);
  };

  // 清除文件选择
  const clearSelection = () => {
    setSelectedItems([]);
    setSelectedItem(null);
  };

  // 刷新文件列表
  const refreshItems = () => {
    loadItems(currentPath);
    clearSelection();
  };

  // 初始加载
  useEffect(() => {
    if (isSignedIn) {
      loadItems();
    }
  }, [isSignedIn, loadItems]);

  // 权限检查
  if (!isSignedIn) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">请先登录</h2>
          <p className="text-gray-600">您需要登录才能访问视频库</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        {/* 页面标题和操作按钮 */}
        <div className="px-4 py-6 sm:px-0">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-3xl font-bold text-gray-900">视频库</h1>
            <div className="flex space-x-4">
              {isAdmin && (
                <button
                  onClick={() => setShowAddYouTube(true)}
                  className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md"
                >
                  添加 YouTube
                </button>
              )}
              {isAdmin && (
                <button
                  onClick={() => setShowUpload(true)}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md"
                >
                  上传视频
                </button>
              )}
              <button
                onClick={() => setShowFileManager(true)}
                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md"
              >
                文件管理
              </button>
            </div>
          </div>

          {/* 错误提示 */}
          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
              {error}
            </div>
          )}

          {/* 文件列表组件 */}
          <VideoFileList
            items={items}
            loading={loading}
            currentPath={currentPath}
            selectedItems={selectedItems}
            setSelectedItems={setSelectedItems}
            onVideoPlay={handleVideoPlay}
            onNavigate={navigateToPath}
            onRefresh={refreshItems}
            apiUrl={FILE_MANAGEMENT_URL}
            thumbnailApiUrl={THUMBNAIL_GENERATOR_URL}
            getToken={getToken}
          />

          {/* 文件操作组件 */}
          <FileOperations
            selectedItems={selectedItems}
            currentPath={currentPath}
            items={items}
            onOperationComplete={refreshItems}
            onClearSelection={clearSelection}
            apiUrl={FILE_MANAGEMENT_URL}
            getToken={getToken}
          />
        </div>
      </div>

      {/* YouTube管理器 */}
      <YouTubeManager
        show={showAddYouTube}
        onClose={() => setShowAddYouTube(false)}
        onComplete={refreshItems}
        apiUrl={YOUTUBE_MANAGER_URL}
        getToken={getToken}
      />

      {/* 视频上传 */}
      <VideoUpload
        show={showUpload}
        onClose={() => setShowUpload(false)}
        onComplete={refreshItems}
        currentPath={currentPath}
        apiUrl={FILE_MANAGEMENT_URL}
        formatConverterUrl={FORMAT_CONVERTER_URL}
        getToken={getToken}
      />

      {/* 文件管理操作弹窗 */}
      <VideoOperationModals
        show={showFileManager}
        onClose={() => setShowFileManager(false)}
        selectedItem={selectedItem}
        selectedItems={selectedItems}
        fileOperation={fileOperation}
        operationData={operationData}
        isProcessingOperation={isProcessingOperation}
        currentPath={currentPath}
        onOperationComplete={refreshItems}
        setFileOperation={setFileOperation}
        setOperationData={setOperationData}
        setIsProcessingOperation={setIsProcessingOperation}
        apiUrl={FILE_MANAGEMENT_URL}
        getToken={getToken}
      />

      {/* 视频播放器 */}
      {selectedVideo && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-4xl w-full mx-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium">视频播放</h3>
              <button
                onClick={() => setSelectedVideo(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>
            {/* VideoPlayer组件将在后续创建 */}
            <div className="text-center py-8">
              <p>视频播放器组件</p>
              <p className="text-sm text-gray-500">{selectedVideo.displayName}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VideoLibraryMain;