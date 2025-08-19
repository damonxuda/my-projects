import React, { useState, useEffect } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useClerk } from '@clerk/clerk-react';
import ModuleAccessGuard from '../../../auth-clerk/src/components/ModuleAccessGuard';
import VideoPlayer from './VideoPlayer';
import FileCard from './FileCard';
import Breadcrumb from './Breadcrumb';

const VideoLibrary = () => {
  const [currentPath, setCurrentPath] = useState('');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedVideo, setSelectedVideo] = useState(null);
  
  // 使用 auth-clerk 的 hook
  const { session } = useClerk();

  // API基础URL
  const API_BASE_URL = process.env.REACT_APP_VIDEO_API_URL;

  // 加载文件列表
  const loadItems = async (path = '') => {
    setLoading(true);
    setError('');
    
    try {
      const token = await session?.getToken();
      if (!token) {
        throw new Error('未找到认证token');
      }

      const response = await fetch(
        `${API_BASE_URL}/videos/list?path=${encodeURIComponent(path)}`,
        {
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );

      if (!response.ok) {
        throw new Error(`加载失败: ${response.status}`);
      }
      
      const data = await response.json();
      const processedItems = processFileList(data, path);
      setItems(processedItems);
      
    } catch (err) {
      console.error('加载失败:', err);
      setError(err.message || '加载失败，请刷新重试');
    } finally {
      setLoading(false);
    }
  };

  // 处理文件列表，创建文件夹结构
  const processFileList = (files, currentPath) => {
    const folders = new Map();
    const videos = [];
    
    files.forEach(file => {
      const relativePath = file.Key.startsWith('videos/') 
        ? file.Key.substring(7) 
        : file.Key;
      
      if (currentPath && !relativePath.startsWith(currentPath + '/')) {
        return;
      }
      
      const pathAfterCurrent = currentPath 
        ? relativePath.substring(currentPath.length + 1)
        : relativePath;
      
      const pathParts = pathAfterCurrent.split('/');
      
      if (pathParts.length === 1) {
        if (isVideoFile(pathParts[0])) {
          videos.push({
            type: 'video',
            name: pathParts[0],
            key: file.Key,
            size: file.Size,
            lastModified: file.LastModified,
            path: currentPath ? `${currentPath}/${pathParts[0]}` : pathParts[0]
          });
        }
      } else {
        const folderName = pathParts[0];
        const folderPath = currentPath ? `${currentPath}/${folderName}` : folderName;
        
        if (!folders.has(folderName)) {
          folders.set(folderName, {
            type: 'folder',
            name: folderName,
            path: folderPath,
            count: 0
          });
        }
        folders.get(folderName).count++;
      }
    });
    
    return [
      ...Array.from(folders.values()).sort((a, b) => a.name.localeCompare(b.name)),
      ...videos.sort((a, b) => a.name.localeCompare(b.name))
    ];
  };

  // 检查是否为视频文件
  const isVideoFile = (filename) => {
    const videoExtensions = ['.mp4', '.avi', '.mov', '.wmv', '.flv', '.webm', '.mkv'];
    return videoExtensions.some(ext => 
      filename.toLowerCase().endsWith(ext)
    );
  };

  // 导航到指定路径
  const navigateToPath = (path) => {
    setCurrentPath(path);
    loadItems(path);
  };

  // 初始加载
  useEffect(() => {
    if (session) {
      loadItems();
    }
  }, [session]);

  return (
    <ModuleAccessGuard module="videos">
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto p-6">
          <div className="mb-6">
            <h1 className="text-4xl font-bold text-gray-800 mb-4">
              🎬 视频中心
            </h1>
          </div>

          <Breadcrumb path={currentPath} onNavigate={navigateToPath} />

          {currentPath && (
            <button
              onClick={() => {
                const parentPath = currentPath.split('/').slice(0, -1).join('/');
                navigateToPath(parentPath);
              }}
              className="flex items-center gap-2 mb-6 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
            >
              <ArrowLeft size={16} />
              返回上级
            </button>
          )}

          <div className="bg-white rounded-xl shadow-sm p-6">
            {loading && (
              <div className="text-center py-12">
                <div className="loading-spinner h-12 w-12 mx-auto"></div>
                <p className="mt-4 text-gray-600">正在加载...</p>
              </div>
            )}

            {error && (
              <div className="text-center py-12">
                <p className="text-red-600 mb-4">{error}</p>
                <button
                  onClick={() => loadItems(currentPath)}
                  className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
                >
                  重试
                </button>
              </div>
            )}

            {!loading && !error && items.length === 0 && (
              <div className="text-center py-12 text-gray-600">
                <div className="text-6xl mb-4">📂</div>
                <p className="text-lg">此文件夹为空</p>
              </div>
            )}

            {!loading && !error && items.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
                {items.map((item, index) => (
                  <FileCard
                    key={`${item.type}-${item.name}-${index}`}
                    item={item}
                    onFolderClick={navigateToPath}
                    onVideoPlay={setSelectedVideo}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {selectedVideo && (
          <VideoPlayer
            video={selectedVideo}
            apiUrl={API_BASE_URL}
            onClose={() => setSelectedVideo(null)}
          />
        )}
      </div>
    </ModuleAccessGuard>
  );
};

export default VideoLibrary;