import React, { useState, useEffect } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useAuth } from '../../../auth-clerk/src';
import VideoPlayer from './VideoPlayer';
import FileCard from './FileCard';
import Breadcrumb from './Breadcrumb';

const VideoLibrary = () => {
  const [currentPath, setCurrentPath] = useState('');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedVideo, setSelectedVideo] = useState(null);
  
  const { 
    user, 
    isSignedIn, 
    isAdmin, 
    fetchVideoList,
    getVideoUrl,
    getToken
  } = useAuth();

  const API_BASE_URL = process.env.REACT_APP_VIDEO_API_URL;

  // 加载视频列表
  const loadItems = async (path = '') => {
    setLoading(true);
    setError('');
    
    try {
      if (!isSignedIn || !user) {
        throw new Error('用户未登录');
      }

      console.log('VideoLibrary: 加载视频列表, path:', path);
      
      const data = await fetchVideoList(path);
      console.log('🔍 原始文件数据:', data.length, '个文件');
      
      // 调试：输出所有文件名
      data.forEach((file, index) => {
        const filename = file.Key.split('/').pop();
        console.log(`📄 文件${index + 1}:`, filename, '| 完整路径:', file.Key);
      });
      
      const processedItems = processFileList(data, path);
      setItems(processedItems);
      
      console.log('VideoLibrary: 处理后项目数:', processedItems.length);
      console.log('📊 处理结果:', processedItems.map(item => ({ name: item.name, type: item.type })));
      
    } catch (err) {
      console.error('VideoLibrary: 加载失败:', err);
      setError(err.message || '加载失败，请刷新重试');
    } finally {
      setLoading(false);
    }
  };

  // 处理文件列表，创建文件夹结构
  const processFileList = (files, currentPath) => {
    const folders = new Map();
    const videos = [];
    
    console.log('🔄 开始处理文件列表, currentPath:', currentPath);
    
    files.forEach(file => {
      const relativePath = file.Key.startsWith('videos/') 
        ? file.Key.substring(7) 
        : file.Key;
      
      if (currentPath && !relativePath.startsWith(currentPath + '/')) {
        console.log('⏭️ 跳过文件（路径不匹配）:', relativePath);
        return;
      }
      
      const pathAfterCurrent = currentPath 
        ? relativePath.substring(currentPath.length + 1)
        : relativePath;
      
      const pathParts = pathAfterCurrent.split('/');
      
      if (pathParts.length === 1) {
        const filename = pathParts[0];
        const isVideo = isVideoFile(filename);
        
        console.log(`🎬 检查文件: "${filename}" | 是否视频: ${isVideo}`);
        
        if (isVideo) {
          videos.push({
            type: 'video',
            name: filename,
            key: file.Key,
            size: file.Size,
            lastModified: file.LastModified,
            path: currentPath ? `${currentPath}/${filename}` : filename
          });
          console.log(`✅ 添加视频: ${filename}`);
        } else {
          console.log(`❌ 跳过非视频文件: ${filename}`);
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
        console.log(`📁 处理文件夹: ${folderName}`);
      }
    });
    
    console.log(`📈 最终统计: ${folders.size} 个文件夹, ${videos.length} 个视频`);
    
    return [
      ...Array.from(folders.values()).sort((a, b) => a.name.localeCompare(b.name)),
      ...videos.sort((a, b) => a.name.localeCompare(b.name))
    ];
  };

  // 检查是否为视频文件 - 加强调试
  const isVideoFile = (filename) => {
    const videoExtensions = ['.mp4', '.avi', '.mov', '.wmv', '.flv', '.webm', '.mkv'];
    const lowerFilename = filename.toLowerCase();
    
    console.log(`🔍 视频格式检查: "${filename}" -> "${lowerFilename}"`);
    
    const result = videoExtensions.some(ext => {
      const matches = lowerFilename.endsWith(ext);
      if (matches) {
        console.log(`✅ 匹配格式: ${ext}`);
      }
      return matches;
    });
    
    console.log(`🎯 "${filename}" 检查结果: ${result}`);
    return result;
  };

  // 导航到指定路径
  const navigateToPath = (path) => {
    setCurrentPath(path);
    loadItems(path);
  };

  // 视频播放处理
  const handleVideoPlay = (video) => {
    console.log('🎬 点击视频:', video.name);
    setSelectedVideo(video);
  };

  // 初始加载
  useEffect(() => {
    if (isSignedIn && user) {
      loadItems();
    }
  }, [isSignedIn, user]);

  return (
    <>
      {/* 面包屑导航 */}
      <div className="mb-6">
        <Breadcrumb path={currentPath} onNavigate={navigateToPath} />
      </div>

      {/* 返回上级按钮 */}
      {currentPath && (
        <div className="mb-6">
          <button
            onClick={() => {
              const parentPath = currentPath.split('/').slice(0, -1).join('/');
              navigateToPath(parentPath);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
          >
            <ArrowLeft size={16} />
            返回上级
          </button>
        </div>
      )}

      {/* 主内容区域 */}
      <div className="bg-gray-50 rounded-lg border border-gray-200 p-6">
        {loading && (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
            <p className="mt-4 text-gray-600">正在加载...</p>
          </div>
        )}

        {error && (
          <div className="text-center py-12">
            <div className="bg-red-50 border border-red-200 rounded-lg p-6 mb-6">
              <h3 className="text-lg font-medium text-red-800 mb-4">加载出错</h3>
              <p className="text-red-600 mb-4">{error}</p>
              
              {/* 调试信息 */}
              <details className="text-left text-sm">
                <summary className="cursor-pointer text-red-700 hover:text-red-800">
                  查看详细信息
                </summary>
                <div className="mt-3 p-3 bg-red-100 rounded text-red-700">
                  <div className="space-y-1">
                    <p><strong>API URL:</strong> {API_BASE_URL}</p>
                    <p><strong>用户状态:</strong> {isSignedIn ? '已登录' : '未登录'}</p>
                    <p><strong>用户邮箱:</strong> {user?.emailAddresses?.[0]?.emailAddress}</p>
                    <p><strong>管理员权限:</strong> {isAdmin ? '是' : '否'}</p>
                    <p><strong>当前路径:</strong> {currentPath || '根目录'}</p>
                  </div>
                </div>
              </details>
            </div>
            
            <button
              onClick={() => loadItems(currentPath)}
              className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
            >
              重新加载
            </button>
          </div>
        )}

        {!loading && !error && items.length === 0 && (
          <div className="text-center py-12 text-gray-600">
            <div className="text-6xl mb-4">📂</div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">文件夹为空</h3>
            <p className="text-gray-500">
              当前路径: <span className="font-medium">{currentPath || '根目录'}</span>
            </p>
          </div>
        )}

        {!loading && !error && items.length > 0 && (
          <div>
            {/* 统计信息 */}
            <div className="mb-6 p-4 bg-white rounded-lg border border-gray-300">
              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-600">
                  <span className="font-medium text-gray-900">当前位置:</span> {currentPath || '根目录'}
                </div>
                <div className="text-sm text-gray-600">
                  找到 <span className="font-medium text-blue-600">{items.filter(i => i.type === 'folder').length}</span> 个文件夹，
                  <span className="font-medium text-green-600">{items.filter(i => i.type === 'video').length}</span> 个视频
                </div>
              </div>
            </div>

            {/* 文件网格 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {items.map((item, index) => (
                <FileCard
                  key={`${item.type}-${item.name}-${index}`}
                  item={item}
                  onFolderClick={navigateToPath}
                  onVideoPlay={handleVideoPlay}
                  getVideoUrl={getVideoUrl}
                  apiUrl={API_BASE_URL}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 视频播放器弹窗 */}
      {selectedVideo && (
        <VideoPlayer
          video={selectedVideo}
          apiUrl={API_BASE_URL}
          onClose={() => setSelectedVideo(null)}
        />
      )}
    </>
  );
};

export default VideoLibrary;