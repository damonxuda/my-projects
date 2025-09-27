import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from "../../../../auth-clerk/src";
import VideoFileList from './VideoFileList';
import FileOperations from './FileOperations';
import VideoUpload from './VideoUpload';
import YouTubeManager from './YouTubeManager';
import VideoOperationModals from './VideoOperationModals';
import VideoPlayer from '../VideoPlayer';

const VideoLibraryMain = () => {
  // 核心状态 - Deploy trigger 2024-09-27
  const [currentPath, setCurrentPath] = useState("");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedVideo, setSelectedVideo] = useState(null);

  // UI控制状态
  const [showUpload, setShowUpload] = useState(false);
  const [showAddYouTube, setShowAddYouTube] = useState(false);
  const [showFileManager, setShowFileManager] = useState(false);

  // 上传相关状态
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [currentUploadIndex, setCurrentUploadIndex] = useState(0);

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

  // 文件列表处理逻辑 - 完整的原始逻辑
  const processFileList = useCallback((files, currentPath) => {
    const folders = new Map();
    const videos = [];
    const youtubeVideos = [];

    // 第一遍遍历：识别后端文件夹类型，设置初始计数为0
    files.forEach((file) => {
      // Skip the root "videos/" entry
      if (file.Key === "videos/") return;
      // 隐藏 .folder_placeholder 文件，用户不应该看到它们
      if (file.Key && file.Key.endsWith("/.folder_placeholder")) return;
      // 处理后端返回的文件夹类型 - 初始化为0计数，让后续遍历来计算
      if (file.Type === "folder") {
        const folderName = file.Name;
        if (folderName) {
          // 隐藏Movies文件夹（仅管理员可见）
          if (folderName === "Movies" && !isAdmin) {
            return;
          }
          // 处理后端返回的文件夹
          folders.set(folderName, {
            key: file.Key,
            name: folderName,
            type: "folder",
            path: currentPath ? `${currentPath}/${folderName}` : folderName,
            isDirectory: true,
            displayName: folderName
          });
        }
        return;
      }
    });

    // 第二遍遍历：处理文件并计算文件夹内容
    files.forEach((file) => {
      // Skip the root "videos/" entry
      if (file.Key === "videos/") return;
      // 隐藏 .folder_placeholder 文件，用户不应该看到它们
      if (file.Key && file.Key.endsWith("/.folder_placeholder")) return;
      // 跳过文件夹类型（已在第一遍处理）
      if (file.Type === "folder") return;
      // Remove "videos/" prefix for processing
      const relativePath = file.Key.replace("videos/", "");
      // 统一的文件处理逻辑
      const pathParts = relativePath.split("/");

      if (currentPath === "") {
        // 在根目录层级
        if (pathParts.length === 1) {
          // 根目录的直接文件
          const isVideo = /\.(mp4|avi|mov|wmv|mkv)$/i.test(relativePath);
          const isYoutube = relativePath.endsWith(".youtube.json");
          if (isVideo) {
            videos.push({
              key: file.Key,
              name: relativePath,
              type: "video",
              size: file.Size,
              lastModified: file.LastModified,
              path: currentPath,
              isDirectory: false,
              displayName: relativePath
            });
          } else if (isYoutube) {
            youtubeVideos.push({
              key: file.Key,
              name: relativePath,
              type: "youtube",
              size: file.Size,
              lastModified: file.LastModified,
              path: currentPath,
              isDirectory: false,
              displayName: relativePath
            });
          }
        } else {
          // 子文件夹中的文件 - 计入文件夹计数
          const folderName = pathParts[0];
          // 隐藏Movies文件夹（仅管理员可见）
          if (folderName === "Movies" && !isAdmin) {
            return;
          }
          // 为文件夹创建条目
          if (!folders.has(folderName)) {
            folders.set(folderName, {
              key: `videos/${folderName}/`,
              name: folderName,
              type: "folder",
              path: folderName,
              isDirectory: true,
              displayName: folderName
            });
          }
        }
      } else {
        // 在特定文件夹内
        if (relativePath.startsWith(currentPath + "/")) {
          const pathAfterCurrent = relativePath.substring(currentPath.length + 1);
          const remainingParts = pathAfterCurrent.split("/");
          if (remainingParts.length === 1) {
            // 当前文件夹的直接文件
            const fileName = remainingParts[0];
            const isVideo = /\.(mp4|avi|mov|wmv|mkv)$/i.test(fileName);
            const isYoutube = fileName.endsWith(".youtube.json");
            if (isVideo) {
              videos.push({
                key: file.Key,
                name: fileName,
                type: "video",
                size: file.Size,
                lastModified: file.LastModified,
                path: currentPath,
                isDirectory: false,
                displayName: fileName
              });
            } else if (isYoutube) {
              youtubeVideos.push({
                key: file.Key,
                name: fileName,
                type: "youtube",
                size: file.Size,
                lastModified: file.LastModified,
                path: currentPath,
                isDirectory: false,
                displayName: fileName
              });
            }
          }
        }
      }
    });

    return [
      ...Array.from(folders.values()),
      ...videos.sort((a, b) => a.name.localeCompare(b.name)),
      ...youtubeVideos.sort((a, b) => a.name.localeCompare(b.name)),
    ];
  }, [isAdmin]);

  // 加载文件列表
  const loadItems = useCallback(async (path = "") => {
    if (!isSignedIn || !user || !FILE_MANAGEMENT_URL) {
      return;
    }

    setLoading(true);
    setError("");

    try {
      if (!isSignedIn || !user) {
        throw new Error("用户未登录");
      }

      const token = await getToken();
      if (!token) {
        throw new Error("无法获取认证token");
      }

      const apiPath = '/files/list';
      const requestUrl = `${FILE_MANAGEMENT_URL}${apiPath}?path=${encodeURIComponent(path)}`;

      const response = await fetch(requestUrl, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ loadItems - Error response:', errorText);
        throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
      }

      const responseText = await response.text();
      let data;
      try {
        data = JSON.parse(responseText);
      } catch (parseError) {
        console.error('❌ loadItems - JSON解析失败:', parseError);
        throw new Error(`JSON解析失败: ${parseError.message}`);
      }

      const processedItems = processFileList(data, path);
      setItems(processedItems);
      setCurrentPath(path);
    } catch (err) {
      console.error("VideoLibrary: 加载失败:", err);
      // 管理员降级处理：如果是403错误且用户是管理员，显示备用内容
      if (err.message.includes('403') && isAdmin) {
        setError("");
        setItems([
          {
            type: 'folder',
            name: '📁 示例视频目录',
            path: 'sample-videos/',
            size: null,
            lastModified: new Date().toISOString(),
            isDirectory: true,
            displayName: '示例视频目录'
          }
        ]);
      } else {
        setError(`Failed to load files: ${err.message}`);
        setItems([]);
      }
    } finally {
      setLoading(false);
    }
  }, [isSignedIn, user, FILE_MANAGEMENT_URL, getToken, processFileList, isAdmin]);

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

  // 处理上传触发
  const handleUploadTrigger = (files) => {
    setSelectedFiles(files);
    setShowFileManager(false); // 关闭文件管理模态框
    setShowUpload(true); // 显示上传模态框
    // 重置上传状态
    setIsUploading(false);
    setUploadProgress(0);
    setCurrentUploadIndex(0);
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
              <button
                onClick={() => setShowFileManager(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md"
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
            onVideoPlay={handleVideoPlay}
            onNavigate={navigateToPath}
            onRefresh={refreshItems}
            apiUrl={FILE_MANAGEMENT_URL}
            thumbnailApiUrl={THUMBNAIL_GENERATOR_URL}
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
        selectedFiles={selectedFiles}
        setSelectedFiles={setSelectedFiles}
        isUploading={isUploading}
        setIsUploading={setIsUploading}
        uploadProgress={uploadProgress}
        setUploadProgress={setUploadProgress}
        currentUploadIndex={currentUploadIndex}
        setCurrentUploadIndex={setCurrentUploadIndex}
      />

      {/* 文件管理操作弹窗 */}
      <VideoOperationModals
        show={showFileManager}
        onClose={() => setShowFileManager(false)}
        fileOperation={fileOperation}
        operationData={operationData}
        isProcessingOperation={isProcessingOperation}
        currentPath={currentPath}
        items={items}
        onOperationComplete={refreshItems}
        setFileOperation={setFileOperation}
        setOperationData={setOperationData}
        setIsProcessingOperation={setIsProcessingOperation}
        apiUrl={FILE_MANAGEMENT_URL}
        getToken={getToken}
        onUploadTrigger={handleUploadTrigger}
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
            <VideoPlayer
              video={selectedVideo}
              apiUrl={VIDEO_PLAYER_URL}
              getToken={getToken}
              onClose={() => setSelectedVideo(null)}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default VideoLibraryMain;