import React, { useState, useEffect, useCallback } from "react";
import { ArrowLeft, Youtube, Plus, X, Upload, Search, Settings } from "lucide-react";
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

  // 视频扫描转换相关状态
  const [isScanning, setIsScanning] = useState(false);
  const [scanResults, setScanResults] = useState(null);
  const [showScanModal, setShowScanModal] = useState(false);

  // 视频上传相关状态
  const [showUpload, setShowUpload] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

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

  // 微服务架构 - 不同功能使用不同的服务
  const VIDEO_CORE_URL = process.env.REACT_APP_VIDEO_CORE_API_URL;          // 视频列表、播放、删除
  const VIDEO_PROCESSING_URL = process.env.REACT_APP_VIDEO_PROCESSING_API_URL; // 视频处理、重编码
  const YOUTUBE_URL = process.env.REACT_APP_YOUTUBE_API_URL;                // YouTube功能

  // 向后兼容
  const API_BASE_URL = process.env.REACT_APP_VIDEO_API_URL || VIDEO_CORE_URL;

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
      const response = await fetch(`${VIDEO_CORE_URL}/videos/delete`, {
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
      const response = await fetch(`${YOUTUBE_URL}/download`, {
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

  // 扫描现有视频并转换
  const handleScanVideos = async (dryRun = true) => {
    setIsScanning(true);
    setError("");

    try {
      const token = await getCachedToken();
      const response = await fetch(`${VIDEO_PROCESSING_URL}/process/batch`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          folderPath: currentPath, // 只扫描当前文件夹
          dryRun, // 试运行或实际执行
          maxFiles: 20 // 限制文件数量
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`扫描失败: ${errorText}`);
      }

      const result = await response.json();
      setScanResults(result);

      if (dryRun) {
        setShowScanModal(true);
      } else {
        // 实际转换完成，刷新文件列表
        await loadItems(currentPath);
        alert(`转换完成！提交了 ${result.summary.conversionsSubmitted} 个转换任务`);
      }

    } catch (error) {
      console.error("扫描视频失败:", error);
      setError(`扫描失败: ${error.message}`);
    } finally {
      setIsScanning(false);
    }
  };

  // 确认转换
  const handleConfirmConvert = async () => {
    setShowScanModal(false);
    await handleScanVideos(false); // 实际执行转换
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

  // 处理文件选择
  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (file) {
      // 检查文件类型
      const validTypes = ['video/mp4', 'video/avi', 'video/mov', 'video/mkv', 'video/webm'];
      if (!validTypes.includes(file.type)) {
        alert('请选择有效的视频文件 (MP4, AVI, MOV, MKV, WebM)');
        return;
      }

      // 检查文件大小 (限制为 2GB)
      const maxSize = 2 * 1024 * 1024 * 1024; // 2GB
      if (file.size > maxSize) {
        alert('文件大小不能超过 2GB');
        return;
      }

      setSelectedFile(file);
    }
  };

  // 处理视频上传
  const handleVideoUpload = async () => {
    if (!selectedFile) {
      alert('请先选择文件');
      return;
    }

    if (!isAdmin) {
      alert('只有管理员可以上传视频');
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);

    try {
      console.log('🚀 开始上传视频:', selectedFile.name);

      // 构建文件路径
      const fileName = selectedFile.name;
      const targetPath = currentPath ? `videos/${currentPath}/${fileName}` : `videos/${fileName}`;

      console.log('📁 目标路径:', targetPath);

      // 获取预签名上传URL
      const token = await getCachedToken();
      const uploadUrlResponse = await fetch(`${process.env.REACT_APP_VIDEO_CORE_URL}/videos/upload-url`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          fileName: targetPath,
          fileType: selectedFile.type,
          fileSize: selectedFile.size
        })
      });

      if (!uploadUrlResponse.ok) {
        throw new Error(`获取上传URL失败: ${uploadUrlResponse.status}`);
      }

      const { uploadUrl, fileKey } = await uploadUrlResponse.json();
      console.log('✅ 获取上传URL成功');

      // 上传文件到S3
      console.log('📤 上传文件到S3...');
      const uploadResponse = await fetch(uploadUrl, {
        method: 'PUT',
        body: selectedFile,
        headers: {
          'Content-Type': selectedFile.type
        }
      });

      if (!uploadResponse.ok) {
        throw new Error(`文件上传失败: ${uploadResponse.status}`);
      }

      console.log('✅ 文件上传成功');
      setUploadProgress(100);

      // 检查视频编码并可能触发转换
      console.log('🔍 检查视频编码...');
      await checkVideoEncoding(fileKey);

      // 重置状态并刷新列表
      setSelectedFile(null);
      setShowUpload(false);
      setIsUploading(false);
      setUploadProgress(0);

      alert('视频上传成功！');

      // 刷新当前目录
      loadItems(currentPath);

    } catch (error) {
      console.error('❌ 视频上传失败:', error);
      alert(`上传失败: ${error.message}`);
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  // 检查视频编码质量
  const checkVideoEncoding = async (fileKey) => {
    try {
      console.log('🔍 检查视频编码:', fileKey);

      // 这里可以添加视频编码检查逻辑
      // 如果检测到编码问题，自动触发MediaConvert转换

      // 示例：简单的启发式检查（基于文件大小）
      if (selectedFile.size > 50 * 1024 * 1024) { // 大于50MB
        console.log('📹 大文件，建议转换为移动端友好格式');

        // 可以在这里调用转换API
        // const shouldConvert = confirm('检测到大视频文件，是否自动优化为移动端友好格式？');
        // if (shouldConvert) {
        //   await triggerVideoConversion(fileKey);
        // }
      }

    } catch (error) {
      console.error('❌ 视频编码检查失败:', error);
      // 不阻断上传流程
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

              {/* 扫描转换按钮 */}
              <button
                onClick={() => handleScanVideos(true)}
                disabled={isScanning}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isScanning ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>扫描中...</span>
                  </>
                ) : (
                  <>
                    <Search size={20} />
                    <span>扫描视频转换</span>
                  </>
                )}
              </button>

              {/* 上传视频按钮 - 仅管理员可见 */}
              {isAdmin && (
                <button
                  onClick={() => setShowUpload(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                  <Upload size={20} />
                  <span>上传视频</span>
                </button>
              )}

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
                  apiUrl={VIDEO_CORE_URL}
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
          apiUrl={VIDEO_CORE_URL}
          processingApiUrl={VIDEO_PROCESSING_URL}
          onClose={() => setSelectedVideo(null)}
        />
      )}

      {/* 扫描结果模态框 */}
      {showScanModal && scanResults && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-semibold text-gray-800 flex items-center gap-2">
                  <Settings className="text-blue-600" size={24} />
                  视频扫描结果
                </h3>
                <button
                  onClick={() => setShowScanModal(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <X size={24} />
                </button>
              </div>

              {/* 扫描统计 */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                <h4 className="font-semibold text-blue-800 mb-2">扫描统计</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">扫描的视频数量：</span>
                    <span className="font-semibold">{scanResults.summary.totalScanned}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">需要转换：</span>
                    <span className="font-semibold text-orange-600">{scanResults.summary.needsConversion}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">已有移动版本：</span>
                    <span className="font-semibold text-green-600">{scanResults.summary.hasConversion}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">扫描范围：</span>
                    <span className="font-semibold">{currentPath || "所有文件夹"}</span>
                  </div>
                </div>
              </div>

              {/* 需要转换的视频列表 */}
              {scanResults.needsConversion && scanResults.needsConversion.length > 0 && (
                <div className="mb-4">
                  <h4 className="font-semibold text-gray-800 mb-2">需要转换的视频：</h4>
                  <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 max-h-40 overflow-y-auto">
                    {scanResults.needsConversion.map((video, index) => (
                      <div key={index} className="text-sm text-gray-700 mb-1">
                        📹 {video.originalKey.replace('videos/', '')}
                        <span className="text-gray-500 ml-2">
                          ({(video.size / 1024 / 1024).toFixed(1)}MB)
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 已有移动版本的视频 */}
              {scanResults.hasConversion && scanResults.hasConversion.length > 0 && (
                <div className="mb-4">
                  <h4 className="font-semibold text-gray-800 mb-2">已有移动版本：</h4>
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3 max-h-32 overflow-y-auto">
                    {scanResults.hasConversion.slice(0, 3).map((video, index) => (
                      <div key={index} className="text-sm text-gray-700 mb-1">
                        ✅ {video.originalKey.replace('videos/', '')}
                      </div>
                    ))}
                    {scanResults.hasConversion.length > 3 && (
                      <div className="text-sm text-gray-500">
                        ... 还有 {scanResults.hasConversion.length - 3} 个视频
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* 操作按钮 */}
              <div className="flex gap-3 pt-4 border-t">
                <button
                  onClick={() => setShowScanModal(false)}
                  className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  取消
                </button>
                {scanResults.summary.needsConversion > 0 && (
                  <button
                    onClick={handleConfirmConvert}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    确认转换 {scanResults.summary.needsConversion} 个视频
                  </button>
                )}
              </div>

              <div className="mt-3 text-xs text-gray-500">
                💡 转换将生成移动端兼容的视频版本（文件名添加_mobile后缀），转换过程约需2-4分钟
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 上传视频模态框 */}
      {showUpload && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-semibold text-gray-800 flex items-center gap-2">
                  <Upload className="text-green-600" size={24} />
                  上传视频文件
                </h3>
                <button
                  onClick={() => {
                    setShowUpload(false);
                    setSelectedFile(null);
                    setUploadProgress(0);
                  }}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <X size={24} />
                </button>
              </div>

              {!selectedFile ? (
                <div className="space-y-4">
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                    <Upload className="mx-auto h-12 w-12 text-gray-400 mb-3" />
                    <p className="text-gray-600 mb-2">选择视频文件上传</p>
                    <p className="text-sm text-gray-500 mb-4">
                      支持 MP4, AVI, MOV, MKV, WebM 格式，最大 2GB
                    </p>
                    <input
                      type="file"
                      accept="video/*"
                      onChange={handleFileSelect}
                      className="hidden"
                      id="video-file-input"
                    />
                    <label
                      htmlFor="video-file-input"
                      className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 cursor-pointer transition-colors"
                    >
                      选择文件
                    </label>
                  </div>

                  {currentPath && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                      <p className="text-sm text-blue-800">
                        📁 将上传到：<span className="font-semibold">{currentPath}</span>
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center gap-3">
                      <div className="flex-shrink-0">
                        <Upload className="text-green-600" size={20} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {selectedFile.name}
                        </p>
                        <p className="text-sm text-gray-500">
                          {(selectedFile.size / (1024 * 1024)).toFixed(1)} MB
                        </p>
                      </div>
                    </div>
                  </div>

                  {currentPath && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                      <p className="text-sm text-blue-800">
                        📁 目标位置：<span className="font-semibold">videos/{currentPath}/{selectedFile.name}</span>
                      </p>
                    </div>
                  )}

                  {isUploading && (
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>上传进度</span>
                        <span>{uploadProgress}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-green-600 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${uploadProgress}%` }}
                        ></div>
                      </div>
                    </div>
                  )}

                  <div className="flex gap-3 pt-4 border-t">
                    <button
                      onClick={() => {
                        setShowUpload(false);
                        setSelectedFile(null);
                        setUploadProgress(0);
                      }}
                      disabled={isUploading}
                      className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      取消
                    </button>
                    <button
                      onClick={handleVideoUpload}
                      disabled={isUploading}
                      className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {isUploading ? '上传中...' : '开始上传'}
                    </button>
                  </div>

                  <div className="mt-3 text-xs text-gray-500">
                    💡 上传成功后将自动检查视频编码质量，如有需要会提示优化
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default VideoLibrary;
