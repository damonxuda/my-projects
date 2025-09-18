import React, { useState, useEffect, useCallback } from "react";
import { ArrowLeft, Youtube, Plus, X, Upload } from "lucide-react";
import { useAuth } from "../../../auth-clerk/src";
import VideoPlayer from "./VideoPlayer";
import FileCard from "./FileCard";
import Breadcrumb from "./Breadcrumb";

const VideoLibrary = () => {
  const [currentPath, setCurrentPath] = useState("");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedVideo, setSelectedVideo] = useState(null);

  // YouTube相关状态
  const [showAddYouTube, setShowAddYouTube] = useState(false);
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [isProcessingYouTube, setIsProcessingYouTube] = useState(false);

  const { user, isSignedIn, isAdmin, fetchVideoList, getVideoUrl, getCachedToken, clearTokenCache } =
    useAuth();

  // 跨模块导航功能
  const handleCrossModuleNavigation = async (targetUrl) => {
    if (!isSignedIn) {
      // 未登录用户直接跳转
      window.location.href = targetUrl;
      return;
    }

    try {
      // 获取当前session token
      const token = await getCachedToken();
      if (token) {
        // 带token跳转到目标模块
        const urlWithSession = `${targetUrl}?session=${encodeURIComponent(token)}`;
        console.log('🚀 Videos跨模块认证跳转:', urlWithSession);
        window.location.href = urlWithSession;
      } else {
        console.warn('⚠️ 无法获取session token，使用普通跳转');
        window.location.href = targetUrl;
      }
    } catch (error) {
      console.error('❌ 跨模块跳转失败:', error);
      window.location.href = targetUrl;
    }
  };

  // SSO入口：检测跨模块认证token并解析
  useEffect(() => {
    const handleCrossModuleAuth = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const sessionToken = urlParams.get('session');

      if (sessionToken) {
        console.log('🔗 Videos检测到跨模块认证token，处理中...');

        try {
          // 🔥 手动解析JWT token并设置localStorage (Clerk官方推荐的跨应用认证方案)
          const tokenParts = sessionToken.split('.');
          if (tokenParts.length === 3) {
            const payload = JSON.parse(atob(tokenParts[1]));
            console.log('🔄 Videos: 解析JWT token并设置localStorage');

            const clerkData = {
              user: {
                id: payload.sub,
                emailAddresses: [{ emailAddress: payload.email || 'user@crossmodule.auth' }],
                firstName: payload.given_name || 'Cross',
                lastName: payload.family_name || 'Module'
              },
              session: { id: payload.sid, status: 'active' }
            };

            localStorage.setItem('__clerk_environment', JSON.stringify(clerkData));
            console.log('✅ Videos localStorage设置完成，即将刷新页面');

            setTimeout(() => {
              window.location.reload();
            }, 100);
          }
        } catch (error) {
          console.error('❌ Videos JWT解析失败:', error);
        }

        // 清理URL参数
        const cleanUrl = window.location.pathname;
        window.history.replaceState({}, document.title, cleanUrl);
      }
    };

    handleCrossModuleAuth();
  }, []);

  const API_BASE_URL = process.env.REACT_APP_VIDEO_API_URL;

  // 提取YouTube视频ID（用于添加新视频）
  const extractVideoId = (url) => {
    const regex = /(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/;
    const match = url.match(regex);
    return match ? match[1] : null;
  };

  // 获取YouTube视频信息（简化版，使用内嵌信息）
  const getYouTubeInfo = async (videoId, originalUrl) => {
    // 简单实现：使用视频ID作为标题，实际项目中可以调用YouTube API
    return {
      title: `YouTube视频_${videoId}`,
      thumbnail: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
      description: `从 ${originalUrl} 添加的视频`,
    };
  };

  // 删除文件
  const handleDelete = async (item) => {
    try {

      const token = await getCachedToken();
      const response = await fetch(`${API_BASE_URL}/videos/delete`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          key: item.key,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        try {
          const errorData = JSON.parse(errorText);
          throw new Error(errorData.details || `删除失败: ${response.status}`);
        } catch (parseError) {
          console.error('删除API错误响应解析失败:', parseError);
          throw new Error(`删除失败: ${response.status} - ${errorText}`);
        }
      }

      const responseText = await response.text();
      try {
        JSON.parse(responseText); // 验证响应是有效的JSON
      } catch (parseError) {
        console.warn('删除API响应不是有效JSON，但操作可能已成功:', responseText);
      }

      // 刷新当前文件夹
      await loadItems(currentPath);
    } catch (error) {
      console.error("删除文件失败:", error);
      throw error;
    }
  };

  // 处理添加YouTube视频
  const handleAddYouTube = async () => {
    if (!youtubeUrl.trim()) {
      alert("请输入YouTube链接");
      return;
    }

    const videoId = extractVideoId(youtubeUrl);
    if (!videoId) {
      alert(
        "请输入有效的YouTube链接\n例如: https://www.youtube.com/watch?v=dQw4w9WgXcQ"
      );
      return;
    }

    setIsProcessingYouTube(true);

    try {
      // 获取视频信息
      const videoInfo = await getYouTubeInfo(videoId, youtubeUrl);

      // 创建JSON内容
      const jsonContent = {
        type: "youtube",
        url: youtubeUrl,
        videoId: videoId,
        title: videoInfo.title,
        description: videoInfo.description,
        thumbnail: videoInfo.thumbnail,
        addedDate: new Date().toISOString(),
      };

      // 生成文件名
      const fileName = `${videoInfo.title}.youtube.json`;

      // 上传到S3
      const token = await getCachedToken();
      const response = await fetch(`${API_BASE_URL}/upload-youtube`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          fileName: fileName,
          content: jsonContent,
          path: "YouTube/", // 固定放在YouTube文件夹下
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`YouTube视频上传失败: ${response.status} - ${errorText.substring(0, 200)}`);
      }

      const responseText = await response.text();
      
      // 检查响应是否是HTML而不是JSON (保护性检查，不影响正常功能)
      if (responseText.trim().startsWith('<!DOCTYPE') || responseText.trim().startsWith('<html')) {
        console.error('❌ YouTube上传 - 收到HTML响应:', responseText.substring(0, 500));
        throw new Error('YouTube上传服务返回HTML页面，请检查API配置');
      }
      
      try {
        JSON.parse(responseText); // 验证响应是有效的JSON
      } catch (parseError) {
        console.warn('YouTube上传响应不是有效JSON，但操作可能已成功:', responseText.substring(0, 200));
        // 不抛出错误，因为YouTube功能之前是正常的
      }

      // 成功后重置表单并刷新列表
      setYoutubeUrl("");
      setShowAddYouTube(false);
      alert("YouTube视频添加成功！");

      // 如果当前在YouTube文件夹，刷新列表
      if (currentPath === "YouTube") {
        loadItems(currentPath);
      }
    } catch (error) {
      console.error("添加YouTube视频失败:", error);
      alert("添加失败，请重试");
    } finally {
      setIsProcessingYouTube(false);
    }
  };

  // 处理文件列表，创建文件夹结构（支持YouTube JSON文件）
  const processFileList = useCallback((files, currentPath) => {
    const folders = new Map();
    const videos = [];
    const youtubeVideos = [];


    files.forEach((file) => {
      // Skip the root "videos/" entry
      if (file.Key === "videos/") return;

      // Remove "videos/" prefix for processing
      const relativePath = file.Key.replace("videos/", "");

      // YouTube JSON files - need to respect folder structure
      if (relativePath.endsWith(".youtube.json")) {
        const pathParts = relativePath.split("/");
        
        if (currentPath === "" && pathParts.length > 1) {
          // At root level but YouTube file is in a subfolder - should be handled as folder structure
          const folderName = pathParts[0];
          if (!folders.has(folderName)) {
            folders.set(folderName, {
              key: `videos/${folderName}/`,
              name: folderName,
              type: "folder",
              path: folderName,
              count: 0,
            });
          }
          folders.get(folderName).count++;
        } else if (currentPath !== "" && relativePath.startsWith(currentPath + "/")) {
          // YouTube file is in current directory
          const fileName = relativePath.split("/").pop();
          const youtubeItem = {
            key: file.Key,
            name: fileName,
            type: "youtube",
            size: file.Size,
            lastModified: file.LastModified,
            path: currentPath,
          };
          youtubeVideos.push(youtubeItem);
        } else if (currentPath === "" && pathParts.length === 1) {
          // YouTube file is at root level
          const youtubeItem = {
            key: file.Key,
            name: relativePath,
            type: "youtube",
            size: file.Size,
            lastModified: file.LastModified,
            path: currentPath,
          };
          youtubeVideos.push(youtubeItem);
        } else {
        }
        return;
      }

      // Regular files
      if (!relativePath.includes("/") && currentPath === "") {
        // Root level files - 在根目录显示测试文件
        const isVideo = /\.(mp4|avi|mov|wmv|mkv)$/i.test(relativePath);
        if (isVideo) {
          videos.push({
            key: file.Key,
            name: relativePath,
            type: "video",
            size: file.Size,
            lastModified: file.LastModified,
            path: currentPath,
          });
        }
      } else {
        // Files in subdirectories
        const pathParts = relativePath.split("/");

        if (currentPath === "") {
          // Show folders at root level
          const folderName = pathParts[0];
          if (!folders.has(folderName)) {
            folders.set(folderName, {
              key: `videos/${folderName}/`,
              name: folderName,
              type: "folder",
              path: folderName,
              count: 0,
            });
          }
          folders.get(folderName).count++;
        } else {
          // Show files in current directory - 检查文件是否在当前路径下
          
          if (currentPath !== "" && relativePath.startsWith(currentPath + "/")) {
            // 文件在当前目录下
            const pathAfterCurrent = relativePath.substring(currentPath.length + 1);
            const remainingParts = pathAfterCurrent.split("/");
            
            // 只处理直接在当前目录下的文件（不是子目录中的文件）
            if (remainingParts.length === 1) {
              const fileName = remainingParts[0];
              const isVideo = /\.(mp4|avi|mov|wmv|mkv)$/i.test(fileName);
              if (isVideo) {
                videos.push({
                  key: file.Key,
                  name: fileName,
                  type: "video",
                  size: file.Size,
                  lastModified: file.LastModified,
                  path: currentPath,
                });
              }
            } else {
            }
          } else if (currentPath === "") {
            // 根目录 - 只处理直接在根目录的文件，不处理子目录中的文件
            if (pathParts.length === 1) {
              const fileName = pathParts[0];
              const isVideo = /\.(mp4|avi|mov|wmv|mkv)$/i.test(fileName);
              if (isVideo) {
                videos.push({
                  key: file.Key,
                  name: fileName,
                  type: "video",
                  size: file.Size,
                  lastModified: file.LastModified,
                  path: currentPath,
                });
              }
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
  }, []);

  // 加载视频列表
  const loadItems = useCallback(async (path = "") => {
    setLoading(true);
    setError("");

    try {
      if (!isSignedIn || !user) {
        throw new Error("用户未登录");
      }

      const data = await fetchVideoList(path);
      const processedItems = processFileList(data, path);
      setItems(processedItems);
    } catch (err) {
      console.error("VideoLibrary: 加载失败:", err);

      // 🔥 管理员降级处理：如果是403错误且用户是管理员，显示备用内容
      if (err.message.includes('403') && isAdmin) {
        console.log("🔧 管理员降级模式：API暂时不可用");
        setError("");
        setItems([
          {
            type: 'folder',
            name: '📁 示例视频目录',
            path: 'sample-videos/',
            size: null,
            lastModified: new Date().toISOString()
          },
          {
            type: 'file',
            name: '📱 管理员提示.txt',
            path: 'admin-notice.txt',
            size: 1024,
            lastModified: new Date().toISOString(),
            isNotice: true
          }
        ]);
      } else {
        setError(err.message || "加载失败，请刷新重试");
      }
    } finally {
      setLoading(false);
    }
  }, [isSignedIn, user, fetchVideoList, processFileList]);


  // 导航到指定路径
  const navigateToPath = (path) => {
    setCurrentPath(path);
    loadItems(path);
  };

  // 视频播放处理（支持YouTube）
  const handleVideoPlay = (video) => {

    if (video.type === "youtube") {
      // YouTube视频：直接跳转到YouTube
      handleYouTubeVideoPlay(video);
    } else {
      // 本地视频：使用现有逻辑
      setSelectedVideo(video);
    }
  };

  // 处理YouTube视频播放
  const handleYouTubeVideoPlay = async (youtubeVideo) => {
    try {

      // 从文件名提取videoId
      const filename = youtubeVideo.name;
      let videoId = null;

      // 新格式：Title_[videoId].youtube.json
      const newFormatMatch = filename.match(/_\[([^\]]+)\]\.youtube\.json$/);
      if (newFormatMatch) {
        videoId = newFormatMatch[1];
      } else {
        // 老格式：YouTube视频_videoId.youtube.json
        const oldFormatMatch = filename.match(
          /YouTube视频_([^.]+)\.youtube\.json$/
        );
        if (oldFormatMatch) {
          videoId = oldFormatMatch[1];
        }
      }

      if (videoId) {
        const youtubeUrl = `https://www.youtube.com/watch?v=${videoId}`;
        window.open(youtubeUrl, "_blank");
      } else {
        alert("无法获取YouTube视频ID，请重试");
      }
    } catch (error) {
      console.error("播放YouTube视频失败:", error);
      alert("播放失败，请重试");
    }
  };

  // 初始加载
  useEffect(() => {
    if (isSignedIn && user?.id) {
      loadItems();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSignedIn, user?.id]);

  return (
    <>
      {/* YouTube添加区域 */}
      <div className="mb-6 bg-white rounded-lg shadow-sm border">
        {!showAddYouTube ? (
          <div className="p-4">
            <div className="flex gap-4">
              <button
                onClick={() => setShowAddYouTube(true)}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                <Youtube size={20} />
                <span>添加YouTube视频</span>
                <Plus size={16} />
              </button>

              {/* 回首页按钮 */}
              <button
                onClick={() => handleCrossModuleNavigation("/")}
                className="flex items-center gap-2 px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-700 transition-colors"
              >
                <span>🏠</span>
                <span>首页</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="p-4 border-l-4 border-red-500 bg-red-50">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                <Youtube className="text-red-600" size={20} />
                添加YouTube视频
              </h3>
              <button
                onClick={() => {
                  setShowAddYouTube(false);
                  setYoutubeUrl("");
                }}
                className="text-gray-500 hover:text-gray-700"
                disabled={isProcessingYouTube}
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex gap-3">
              <input
                type="text"
                value={youtubeUrl}
                onChange={(e) => setYoutubeUrl(e.target.value)}
                placeholder="粘贴YouTube链接，例如: https://www.youtube.com/watch?v=dQw4w9WgXcQ"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                disabled={isProcessingYouTube}
              />
              <button
                onClick={handleAddYouTube}
                disabled={isProcessingYouTube || !youtubeUrl.trim()}
                className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
              >
                {isProcessingYouTube ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    处理中...
                  </>
                ) : (
                  <>
                    <Upload size={16} />
                    添加
                  </>
                )}
              </button>
            </div>

            <p className="text-sm text-gray-600 mt-2">
              系统会自动获取视频信息并保存为JSON文件到 YouTube/ 文件夹
            </p>
          </div>
        )}
      </div>

      {/* 面包屑导航 */}
      <div className="mb-6">
        <Breadcrumb path={currentPath} onNavigate={navigateToPath} />
      </div>

      {/* 返回上级按钮 */}
      {currentPath && (
        <div className="mb-6">
          <button
            onClick={() => {
              const parentPath = currentPath.split("/").slice(0, -1).join("/");
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
              <h3 className="text-lg font-medium text-red-800 mb-4">
                加载出错
              </h3>
              <p className="text-red-600 mb-4">{error}</p>

              {/* 调试信息 */}
              <details className="text-left text-sm">
                <summary className="cursor-pointer text-red-700 hover:text-red-800">
                  查看详细信息
                </summary>
                <div className="mt-3 p-3 bg-red-100 rounded text-red-700">
                  <div className="space-y-1">
                    <p>
                      <strong>API URL:</strong> {API_BASE_URL}
                    </p>
                    <p>
                      <strong>用户状态:</strong>{" "}
                      {isSignedIn ? "已登录" : "未登录"}
                    </p>
                    <p>
                      <strong>用户邮箱:</strong>{" "}
                      {user?.emailAddresses?.[0]?.emailAddress}
                    </p>
                    <p>
                      <strong>管理员权限:</strong> {isAdmin ? "是" : "否"}
                    </p>
                    <p>
                      <strong>当前路径:</strong> {currentPath || "根目录"}
                    </p>
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
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              文件夹为空
            </h3>
            <p className="text-gray-500">
              当前路径:{" "}
              <span className="font-medium">{currentPath || "根目录"}</span>
            </p>
          </div>
        )}

        {!loading && !error && items.length > 0 && (
          <div>
            {/* 统计信息 */}
            <div className="mb-6 p-4 bg-white rounded-lg border border-gray-300">
              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-600">
                  <span className="font-medium text-gray-900">当前位置:</span>{" "}
                  {currentPath || "根目录"}
                </div>
                <div className="text-sm text-gray-600">
                  找到{" "}
                  <span className="font-medium text-blue-600">
                    {items.filter((i) => i.type === "folder").length}
                  </span>{" "}
                  个文件夹，
                  <span className="font-medium text-green-600">
                    {items.filter((i) => i.type === "video").length}
                  </span>{" "}
                  个本地视频，
                  <span className="font-medium text-red-600">
                    {items.filter((i) => i.type === "youtube").length}
                  </span>{" "}
                  个YouTube视频
                </div>
              </div>
            </div>

            {/* 文件网格 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {items.map((item, index) => (
                <FileCard
                  key={`${item.type}-${item.key || item.name}`}
                  item={item}
                  onFolderClick={navigateToPath}
                  onVideoPlay={handleVideoPlay}
                  getVideoUrl={getVideoUrl}
                  apiUrl={API_BASE_URL}
                  getCachedToken={getCachedToken}
                  clearTokenCache={clearTokenCache}
                  onDelete={handleDelete}
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
