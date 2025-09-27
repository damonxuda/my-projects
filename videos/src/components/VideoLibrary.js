import React, { useState, useEffect, useCallback } from "react";
import { ArrowLeft, Youtube, Plus, X, Upload, Search, Settings, FolderOpen, ArrowRight, Copy, Trash2 } from "lucide-react";
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

  // 移除手动扫描功能，转为自动触发

  // 视频上传相关状态
  const [showUpload, setShowUpload] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [currentUploadIndex, setCurrentUploadIndex] = useState(0);

  // 文件管理相关状态
  const [showFileManager, setShowFileManager] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [selectedItems, setSelectedItems] = useState([]); // 多选文件
  const [fileOperation, setFileOperation] = useState(null); // 'rename', 'move', 'copy', 'create-folder', 'batch-move'
  const [operationData, setOperationData] = useState({});
  const [isProcessingOperation, setIsProcessingOperation] = useState(false);

  const { user, isSignedIn, isAdmin, getToken } = useAuth();

  // 跨模块导航功能 - 使用Clerk官方SSO机制
  const handleCrossModuleNavigation = (targetUrl) => {
    // 直接跳转，卫星应用会自动同步认证状态
    window.location.href = targetUrl;
  };

  // 5个专门化Lambda函数架构
  const FILE_MANAGEMENT_URL = process.env.REACT_APP_FILE_MANAGEMENT_API_URL; // 文件管理
  const THUMBNAIL_GENERATOR_URL = process.env.REACT_APP_THUMBNAIL_GENERATOR_API_URL; // 缩略图生成
  const FORMAT_CONVERTER_URL = process.env.REACT_APP_FORMAT_CONVERTER_API_URL; // 格式转换
  const VIDEO_PLAYER_URL = process.env.REACT_APP_VIDEO_PLAYER_API_URL; // 播放URL生成
  const YOUTUBE_MANAGER_URL = process.env.REACT_APP_YOUTUBE_MANAGER_API_URL; // YouTube管理

  // 环境变量已配置完成，调试日志已清理

  // 向后兼容：保持旧的变量名以防部署时环境变量未更新
  const VIDEO_CORE_URL = FILE_MANAGEMENT_URL || process.env.REACT_APP_VIDEO_CORE_API_URL;
  const VIDEO_PROCESSING_URL = FORMAT_CONVERTER_URL || process.env.REACT_APP_VIDEO_PROCESSING_API_URL;
  const YOUTUBE_URL = YOUTUBE_MANAGER_URL || process.env.REACT_APP_YOUTUBE_API_URL;
  const API_BASE_URL = FILE_MANAGEMENT_URL || process.env.REACT_APP_VIDEO_API_URL || VIDEO_CORE_URL;

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

      const token = await getToken();
      const response = await fetch(`${FILE_MANAGEMENT_URL}/files/delete`, {
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
      const token = await getToken();
      const response = await fetch(`${YOUTUBE_MANAGER_URL}/youtube/download`, {
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

  // 扫描功能已移除，改为上传时自动触发处理

  // 处理文件列表，创建文件夹结构（支持YouTube JSON文件）
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
            });
          } else if (isYoutube) {
            youtubeVideos.push({
              key: file.Key,
              name: relativePath,
              type: "youtube",
              size: file.Size,
              lastModified: file.LastModified,
              path: currentPath,
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
              });
            } else if (isYoutube) {
              youtubeVideos.push({
                key: file.Key,
                name: fileName,
                type: "youtube",
                size: file.Size,
                lastModified: file.LastModified,
                path: currentPath,
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

  // 加载视频列表 - 简化认证方式
  const loadItems = useCallback(async (path = "") => {
    setLoading(true);
    setError("");

    try {
      if (!isSignedIn || !user) {
        throw new Error("用户未登录");
      }

      // 获取认证token
      const token = await getToken();
      if (!token) {
        throw new Error("无法获取认证token");
      }

      // 直接调用Lambda API
      const apiPath = '/files/list';
      const requestUrl = `${FILE_MANAGEMENT_URL}${apiPath}?path=${encodeURIComponent(path)}`;


      const response = await fetch(requestUrl, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
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
    } catch (err) {
      console.error("VideoLibrary: 加载失败:", err);

      // 🔥 管理员降级处理：如果是403错误且用户是管理员，显示备用内容
      if (err.message.includes('403') && isAdmin) {
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
  }, [isSignedIn, user, getToken, processFileList, isAdmin]);


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
    const files = Array.from(event.target.files);

    if (files.length > 0) {
      const validTypes = ['video/mp4', 'video/avi', 'video/mov', 'video/mkv', 'video/webm'];
      const maxSize = 2 * 1024 * 1024 * 1024; // 2GB
      const validFiles = [];
      const invalidFiles = [];

      files.forEach(file => {
        if (!validTypes.includes(file.type)) {
          invalidFiles.push(`${file.name} (格式不支持)`);
        } else if (file.size > maxSize) {
          invalidFiles.push(`${file.name} (文件过大，超过2GB)`);
        } else {
          validFiles.push(file);
        }
      });

      if (invalidFiles.length > 0) {
        alert(`以下文件无法上传：\n${invalidFiles.join('\n')}`);
      }

      if (validFiles.length > 0) {
        setSelectedFiles(validFiles);
        setCurrentUploadIndex(0);
      }
    }
  };

  // 处理视频上传
  const handleVideoUpload = async () => {
    if (!selectedFiles || selectedFiles.length === 0) {
      alert('请先选择文件');
      return;
    }

    if (!isAdmin) {
      alert('只有管理员可以上传视频');
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);
    setCurrentUploadIndex(0);

    try {
      for (let i = 0; i < selectedFiles.length; i++) {
        const currentFile = selectedFiles[i];
        setCurrentUploadIndex(i);


        // 构建文件路径
        const fileName = currentFile.name;
        const targetPath = currentPath ? `videos/${currentPath}/${fileName}` : `videos/${fileName}`;


        // 获取预签名上传URL
        const token = await getToken();
        const uploadUrlResponse = await fetch(`${FILE_MANAGEMENT_URL}/files/upload-url`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            fileName: targetPath,
            fileType: currentFile.type,
            fileSize: currentFile.size
          })
        });

        if (!uploadUrlResponse.ok) {
          throw new Error(`获取上传URL失败: ${uploadUrlResponse.status}`);
        }

        const { uploadUrl, fileKey } = await uploadUrlResponse.json();
        // 上传文件到S3
        const uploadResponse = await fetch(uploadUrl, {
          method: 'PUT',
          body: currentFile,
          headers: {
            'Content-Type': currentFile.type
          }
        });

        if (!uploadResponse.ok) {
          throw new Error(`文件上传失败: ${uploadResponse.status}`);
        }


        // 更新进度
        const progress = Math.round(((i + 1) / selectedFiles.length) * 100);
        setUploadProgress(progress);

        // 检查视频编码并可能触发转换
        await checkVideoEncoding(fileKey, currentFile.size);
      }

      // 重置状态并刷新列表
      setSelectedFiles([]);
      setShowUpload(false);
      setIsUploading(false);
      setUploadProgress(0);
      setCurrentUploadIndex(0);

      alert(`所有视频上传成功！共上传 ${selectedFiles.length} 个文件`);

      // 刷新当前目录
      loadItems(currentPath);

    } catch (error) {
      console.error('❌ 视频上传失败:', error);
      alert(`上传失败: ${error.message}`);
      setIsUploading(false);
      setUploadProgress(0);
      setCurrentUploadIndex(0);
    }
  };

  // 检查视频编码并自动转换
  const checkVideoEncoding = async (fileKey, fileSize) => {
    try {

      const token = await getToken();

      // 调用自动分析和转换API
      const response = await fetch(`${FORMAT_CONVERTER_URL}/convert/auto-analyze/${encodeURIComponent(fileKey)}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          autoConvert: true // 启用自动转换
        })
      });

      if (!response.ok) {
        console.warn('⚠️ 视频兼容性检测失败:', response.status);
        return; // 不阻断上传流程
      }

      const result = await response.json();
      const { compatibilityAnalysis, recommendation, autoConversion = {} } = result;

      // 关键判断：系统建议转换吗？
      const needsConversion = recommendation.shouldConvert;
      // 关键判断：系统触发自动转换了吗？
      const autoConversionTriggered = autoConversion?.triggered;

      // 静默处理转换结果，只记录错误
      if (autoConversionTriggered && !autoConversion.result?.success) {
        console.error('❌ 自动转换启动失败:', autoConversion.result?.error);
      } else if (needsConversion && !autoConversionTriggered) {
        console.error('🐛 需要转换但未自动触发，原因:', recommendation.reasons);
      }

    } catch (error) {
      console.error('❌ 视频编码检查失败:', error);
      // 不阻断上传流程，但记录错误
      console.warn('⚠️ 跳过视频兼容性检查，文件已成功上传');
    }
  };

  // 文件管理函数
  const handleRenameItem = async (oldPath, newPath) => {
    if (!isAdmin) {
      alert('只有管理员可以重命名文件');
      return;
    }

    setIsProcessingOperation(true);
    try {
      const token = await getToken();
      const response = await fetch(`${FILE_MANAGEMENT_URL}/files/rename`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ oldPath, newPath })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || '重命名失败');
      }

      const result = await response.json();

      alert('重命名成功！');
      setShowFileManager(false);
      setSelectedItem(null);
      setFileOperation(null);

      // 刷新当前目录
      loadItems(currentPath);

    } catch (error) {
      console.error('❌ 重命名失败:', error);
      alert(`重命名失败: ${error.message}`);
    } finally {
      setIsProcessingOperation(false);
    }
  };

  const handleCopyItem = async (sourcePath, targetPath) => {
    if (!isAdmin) {
      alert('只有管理员可以复制文件');
      return;
    }

    setIsProcessingOperation(true);
    try {
      const token = await getToken();
      const response = await fetch(`${FILE_MANAGEMENT_URL}/files/copy`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ sourcePath, targetPath })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || '复制失败');
      }

      const result = await response.json();

      alert('复制成功！');
      setShowFileManager(false);
      setSelectedItem(null);
      setFileOperation(null);

      // 刷新当前目录
      loadItems(currentPath);

    } catch (error) {
      console.error('❌ 复制失败:', error);
      alert(`复制失败: ${error.message}`);
    } finally {
      setIsProcessingOperation(false);
    }
  };

  const handleCreateFolder = async (folderPath) => {
    if (!isAdmin) {
      alert('只有管理员可以创建文件夹');
      return;
    }

    setIsProcessingOperation(true);
    try {
      const token = await getToken();
      const response = await fetch(`${FILE_MANAGEMENT_URL}/files/create-folder`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ folderPath })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || '创建文件夹失败');
      }

      const result = await response.json();

      alert('文件夹创建成功！');
      setShowFileManager(false);
      setFileOperation(null);

      // 刷新当前目录
      loadItems(currentPath);

    } catch (error) {
      console.error('❌ 创建文件夹失败:', error);
      alert(`创建文件夹失败: ${error.message}`);
    } finally {
      setIsProcessingOperation(false);
    }
  };

  // 删除文件
  const handleDeleteItem = async (filePath) => {
    if (!isAdmin) {
      alert('只有管理员可以删除文件');
      return;
    }

    setIsProcessingOperation(true);
    try {
      const token = await getToken();
      const response = await fetch(`${FILE_MANAGEMENT_URL}/files/delete`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ key: filePath })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || '删除失败');
      }

      const result = await response.json();

      alert('文件删除成功！');
      setShowFileManager(false);
      setSelectedItem(null);
      setFileOperation(null);

      // 刷新当前目录
      loadItems(currentPath);

    } catch (error) {
      console.error('❌ 删除失败:', error);
      alert(`删除失败: ${error.message}`);
    } finally {
      setIsProcessingOperation(false);
    }
  };

  // 辅助函数：自动扩展选择以包含mobile版本
  const expandSelectionWithMobile = (files) => {
    const expandedMap = new Map();

    // 先添加所有已选择的文件
    files.forEach(item => {
      const key = item.key || item.Key;
      expandedMap.set(key, item);
    });

    // 查找并添加对应的mobile版本或原文件
    files.forEach(item => {
      const key = item.key || item.Key;

      // 只处理mp4视频文件
      if (key && key.endsWith('.mp4')) {
        if (key.includes('_mobile.mp4')) {
          // 如果选中了mobile版本，查找原文件
          const originalKey = key.replace('_mobile.mp4', '.mp4');
          // 在当前文件列表中查找原文件
          const originalFile = [...itemsToDisplay, ...items].find(f =>
            (f.key || f.Key) === originalKey
          );
          if (originalFile && !expandedMap.has(originalKey)) {
            expandedMap.set(originalKey, originalFile);
            console.log(`自动添加原文件: ${originalKey}`);
          }
        } else {
          // 如果选中了原文件，查找mobile版本
          const mobileKey = key.replace('.mp4', '_mobile.mp4');
          // 在当前文件列表中查找mobile文件
          const mobileFile = [...itemsToDisplay, ...items].find(f =>
            (f.key || f.Key) === mobileKey
          );
          if (mobileFile && !expandedMap.has(mobileKey)) {
            expandedMap.set(mobileKey, mobileFile);
            console.log(`自动添加mobile版本: ${mobileKey}`);
          }
        }
      }
    });

    return Array.from(expandedMap.values());
  };

  // 批量移动文件
  const handleBatchMoveItems = async (files, targetFolder) => {
    if (!isAdmin) {
      alert('只有管理员可以移动文件');
      return;
    }

    // 自动扩展选择以包含mobile版本
    const expandedFiles = expandSelectionWithMobile(files);
    console.log(`原选择 ${files.length} 个文件，扩展后 ${expandedFiles.length} 个文件`);

    setIsProcessingOperation(true);
    try {
      const token = await getToken();
      const response = await fetch(`${FILE_MANAGEMENT_URL}/files/move`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          files: expandedFiles.map(item => item.key || item.Key),
          targetFolder: targetFolder
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || '批量移动失败');
      }

      const result = await response.json();

      alert(`批量移动成功！已移动 ${expandedFiles.length} 个文件`);
      setShowFileManager(false);
      setSelectedItems([]);
      setFileOperation(null);

      // 刷新当前目录
      loadItems(currentPath);

    } catch (error) {
      console.error('❌ 批量移动失败:', error);
      alert(`批量移动失败: ${error.message}`);
    } finally {
      setIsProcessingOperation(false);
    }
  };

  // 批量复制文件
  const handleBatchCopyItems = async (files, targetFolder) => {
    if (!isAdmin) {
      alert('只有管理员可以复制文件');
      return;
    }

    // 自动扩展选择以包含mobile版本
    const expandedFiles = expandSelectionWithMobile(files);
    console.log(`原选择 ${files.length} 个文件，扩展后 ${expandedFiles.length} 个文件`);

    setIsProcessingOperation(true);
    try {
      const token = await getToken();
      const response = await fetch(`${FILE_MANAGEMENT_URL}/files/copy`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          files: expandedFiles.map(item => item.key || item.Key),
          targetFolder: targetFolder
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || '批量复制失败');
      }

      const result = await response.json();

      alert(`批量复制成功！已复制 ${expandedFiles.length} 个文件`);
      setShowFileManager(false);
      setSelectedItems([]);
      setFileOperation(null);

      // 刷新当前目录
      loadItems(currentPath);

    } catch (error) {
      console.error('❌ 批量复制失败:', error);
      alert(`批量复制失败: ${error.message}`);
    } finally {
      setIsProcessingOperation(false);
    }
  };

  // 批量删除文件
  const handleBatchDeleteItems = async (files) => {
    if (!isAdmin) {
      alert('只有管理员可以删除文件');
      return;
    }

    // 自动扩展选择以包含mobile版本
    const expandedFiles = expandSelectionWithMobile(files);
    console.log(`原选择 ${files.length} 个文件，扩展后 ${expandedFiles.length} 个文件`);

    // 确认删除
    const confirmDelete = window.confirm(
      `确定要删除选中的 ${expandedFiles.length} 个文件吗？\n\n⚠️ 此操作不可恢复！\n\n文件列表：\n${expandedFiles.map(f => f.name).join('\n')}`
    );

    if (!confirmDelete) {
      return;
    }

    setIsProcessingOperation(true);
    try {
      const token = await getToken();
      const response = await fetch(`${FILE_MANAGEMENT_URL}/files/batch-delete`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          files: expandedFiles.map(item => item.key || item.Key)
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || '批量删除失败');
      }

      const result = await response.json();

      alert(`批量删除成功！已删除 ${expandedFiles.length} 个文件`);
      setShowFileManager(false);
      setSelectedItems([]);
      setFileOperation(null);

      // 刷新当前目录
      loadItems(currentPath);

    } catch (error) {
      console.error('❌ 批量删除失败:', error);
      alert(`批量删除失败: ${error.message}`);
    } finally {
      setIsProcessingOperation(false);
    }
  };

  // 检查是否可以执行操作
  const canExecuteOperation = () => {
    switch (fileOperation) {
      case 'create-folder':
        return operationData.folderName && operationData.folderName.trim() !== '';
      case 'rename':
        return selectedItem && operationData.newName && operationData.newName.trim() !== '' && operationData.newName !== selectedItem.name;
      case 'move':
        return selectedItems && selectedItems.length > 0 && operationData.targetFolder !== undefined;
      case 'copy':
        return selectedItems && selectedItems.length > 0 && operationData.targetFolder !== undefined;
      case 'delete':
        return selectedItems && selectedItems.length > 0;
      case 'upload':
        return operationData.uploadFiles && operationData.uploadFiles.length > 0;
      default:
        return false;
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
              {/* YouTube添加按钮 - 仅管理员可见 */}
              {isAdmin && (
                <button
                  onClick={() => setShowAddYouTube(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                >
                  <Youtube size={20} />
                  <span>添加YouTube视频</span>
                  <Plus size={16} />
                </button>
              )}

              {/* 文件管理按钮 - 仅管理员可见 */}
              {isAdmin && (
                <button
                  onClick={() => setShowFileManager(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <FolderOpen size={20} />
                  <span>管理视频</span>
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
                  apiUrl={FILE_MANAGEMENT_URL}
                  thumbnailApiUrl={THUMBNAIL_GENERATOR_URL}
                  getToken={getToken}
                  // 多选相关props
                  isMultiSelectMode={['move', 'copy', 'delete'].includes(fileOperation)}
                  isSelected={selectedItems.some(selected => selected.key === item.key)}
                  onSelectionChange={(selected) => {
                    if (selected) {
                      setSelectedItems([...selectedItems, item]);
                    } else {
                      setSelectedItems(selectedItems.filter(selected => selected.key !== item.key));
                    }
                  }}
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
          apiUrl={VIDEO_PLAYER_URL}
          processingApiUrl={FORMAT_CONVERTER_URL}
          onClose={() => setSelectedVideo(null)}
        />
      )}

      {/* 扫描功能已移除，改为上传时自动处理 */}

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
                    setSelectedFiles([]);
                    setUploadProgress(0);
                    setCurrentUploadIndex(0);
                  }}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <X size={24} />
                </button>
              </div>

              {selectedFiles.length === 0 ? (
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
                      multiple
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
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-medium text-gray-900">
                        已选择 {selectedFiles.length} 个文件
                      </span>
                      <button
                        onClick={() => setSelectedFiles([])}
                        className="text-sm text-red-600 hover:text-red-700"
                      >
                        清空选择
                      </button>
                    </div>

                    <div className="space-y-2 max-h-32 overflow-y-auto">
                      {selectedFiles.map((file, index) => (
                        <div key={index} className="flex items-center gap-3 p-2 bg-white rounded border">
                          <Upload className="text-green-600 flex-shrink-0" size={16} />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">
                              {file.name}
                            </p>
                            <p className="text-xs text-gray-500">
                              {(file.size / (1024 * 1024)).toFixed(1)} MB
                            </p>
                          </div>
                          <button
                            onClick={() => {
                              const newFiles = selectedFiles.filter((_, i) => i !== index);
                              setSelectedFiles(newFiles);
                            }}
                            className="text-red-500 hover:text-red-700 flex-shrink-0"
                          >
                            <X size={16} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  {currentPath && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                      <p className="text-sm text-blue-800">
                        📁 目标位置：<span className="font-semibold">videos/{currentPath}/[{selectedFiles.length}个文件]</span>
                      </p>
                    </div>
                  )}

                  {isUploading && (
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>
                          上传进度 ({currentUploadIndex + 1}/{selectedFiles.length})
                        </span>
                        <span>{uploadProgress}%</span>
                      </div>
                      {selectedFiles.length > 1 && (
                        <p className="text-xs text-gray-500">
                          当前: {selectedFiles[currentUploadIndex]?.name}
                        </p>
                      )}
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
                        setSelectedFiles([]);
                        setUploadProgress(0);
                        setCurrentUploadIndex(0);
                      }}
                      disabled={isUploading}
                      className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      取消
                    </button>
                    <button
                      onClick={handleVideoUpload}
                      disabled={isUploading || selectedFiles.length === 0}
                      className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {isUploading ? `上传中... (${currentUploadIndex + 1}/${selectedFiles.length})` : `开始上传 (${selectedFiles.length}个文件)`}
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

      {/* 文件管理模态框 */}
      {showFileManager && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg max-w-lg w-full mx-4">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-semibold text-gray-800 flex items-center gap-2">
                  <FolderOpen className="text-purple-600" size={24} />
                  文件管理
                </h3>
                <button
                  onClick={() => {
                    setShowFileManager(false);
                    setSelectedItem(null);
                    setSelectedItems([]);
                    setFileOperation(null);
                    setOperationData({});
                  }}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <X size={24} />
                </button>
              </div>

              {!fileOperation ? (
                <div className="space-y-3">
                  <p className="text-gray-600 mb-4">选择您想要执行的文件操作：</p>

                  <button
                    onClick={() => setFileOperation('upload')}
                    className="w-full flex items-center gap-3 p-3 text-left border rounded-lg hover:bg-green-50 hover:border-green-300 transition-colors"
                  >
                    <Upload className="text-green-600" size={20} />
                    <div>
                      <div className="font-medium text-gray-800">上传视频</div>
                      <div className="text-sm text-gray-500">上传视频文件到当前目录</div>
                    </div>
                  </button>

                  <button
                    onClick={() => setFileOperation('create-folder')}
                    className="w-full flex items-center gap-3 p-3 text-left border rounded-lg hover:bg-blue-50 hover:border-blue-300 transition-colors"
                  >
                    <FolderOpen className="text-blue-600" size={20} />
                    <div>
                      <div className="font-medium text-gray-800">创建文件夹</div>
                      <div className="text-sm text-gray-500">在当前目录创建新文件夹</div>
                    </div>
                  </button>

                  <button
                    onClick={() => setFileOperation('rename')}
                    className="w-full flex items-center gap-3 p-3 text-left border rounded-lg hover:bg-yellow-50 hover:border-yellow-300 transition-colors"
                  >
                    <Settings className="text-yellow-600" size={20} />
                    <div>
                      <div className="font-medium text-gray-800">重命名文件/文件夹</div>
                      <div className="text-sm text-gray-500">选择文件或文件夹进行重命名</div>
                    </div>
                  </button>

                  <button
                    onClick={() => setFileOperation('move')}
                    className="w-full flex items-center gap-3 p-3 text-left border rounded-lg hover:bg-purple-50 hover:border-purple-300 transition-colors"
                  >
                    <ArrowRight className="text-purple-600" size={20} />
                    <div>
                      <div className="font-medium text-gray-800">移动文件/文件夹</div>
                      <div className="text-sm text-gray-500">选择一个或多个文件/文件夹移动到其他位置</div>
                    </div>
                  </button>

                  <button
                    onClick={() => setFileOperation('copy')}
                    className="w-full flex items-center gap-3 p-3 text-left border rounded-lg hover:bg-indigo-50 hover:border-indigo-300 transition-colors"
                  >
                    <Copy className="text-indigo-600" size={20} />
                    <div>
                      <div className="font-medium text-gray-800">复制文件/文件夹</div>
                      <div className="text-sm text-gray-500">选择一个或多个文件/文件夹进行复制</div>
                    </div>
                  </button>

                  <button
                    onClick={() => setFileOperation('delete')}
                    className="w-full flex items-center gap-3 p-3 text-left border rounded-lg hover:bg-red-50 hover:border-red-300 transition-colors"
                  >
                    <Trash2 className="text-red-600" size={20} />
                    <div>
                      <div className="font-medium text-gray-800">删除文件/文件夹</div>
                      <div className="text-sm text-gray-500">选择一个或多个文件/文件夹进行删除</div>
                    </div>
                  </button>

                  <button
                    onClick={() => setFileOperation('copy')}
                    className="w-full flex items-center gap-3 p-3 text-left border rounded-lg hover:bg-indigo-50 hover:border-indigo-300 transition-colors"
                  >
                    <Plus className="text-indigo-600" size={20} />
                    <div>
                      <div className="font-medium text-gray-800">复制文件/文件夹</div>
                      <div className="text-sm text-gray-500">复制文件或文件夹到其他位置</div>
                    </div>
                  </button>

                  <button
                    onClick={() => setFileOperation('delete')}
                    className="w-full flex items-center gap-3 p-3 text-left border rounded-lg hover:bg-red-50 hover:border-red-300 transition-colors"
                  >
                    <X className="text-red-600" size={20} />
                    <div>
                      <div className="font-medium text-gray-800">删除文件/文件夹</div>
                      <div className="text-sm text-gray-500">选择文件或文件夹进行删除</div>
                    </div>
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {fileOperation === 'create-folder' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        文件夹名称
                      </label>
                      <input
                        type="text"
                        value={operationData.folderName || ''}
                        onChange={(e) => setOperationData({...operationData, folderName: e.target.value})}
                        placeholder="输入文件夹名称"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                      />
                      <div className="mt-2 text-xs text-gray-500">
                        将在路径 videos/{currentPath || ''} 下创建
                      </div>
                    </div>
                  )}

                  {fileOperation === 'rename' && (
                    <div>
                      {!selectedItem ? (
                        <div>
                          <p className="text-sm text-gray-600 mb-3">选择要重命名的文件：</p>
                          <div className="max-h-60 overflow-y-auto space-y-2">
                            {items.map((item, index) => (
                              <button
                                key={index}
                                onClick={() => setSelectedItem(item)}
                                className="w-full text-left p-2 border rounded hover:bg-gray-50 transition-colors"
                              >
                                <div className="font-medium">{item.name}</div>
                                <div className="text-xs text-gray-500">
                                  {item.type === 'folder' ? '文件夹' : '文件'}
                                </div>
                              </button>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div>
                          <div className="mb-3">
                            <span className="text-sm text-gray-600">重命名: </span>
                            <span className="font-medium">{selectedItem.name}</span>
                          </div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            新名称
                          </label>
                          <input
                            type="text"
                            value={operationData.newName || selectedItem.name}
                            onChange={(e) => setOperationData({...operationData, newName: e.target.value})}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                          />
                        </div>
                      )}
                    </div>
                  )}

                  {fileOperation === 'copy' && (
                    <div>
                      {!selectedItem ? (
                        <div>
                          <p className="text-sm text-gray-600 mb-3">选择要复制的文件或文件夹：</p>
                          <div className="max-h-60 overflow-y-auto space-y-2">
                            {items.map((item, index) => (
                              <button
                                key={index}
                                onClick={() => setSelectedItem(item)}
                                className="w-full text-left p-2 border rounded hover:bg-gray-50 transition-colors"
                              >
                                <div className="font-medium">{item.name}</div>
                                <div className="text-xs text-gray-500">
                                  {item.type === 'folder' ? '文件夹' : '文件'}
                                </div>
                              </button>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div>
                          <div className="mb-3">
                            <span className="text-sm text-gray-600">复制: </span>
                            <span className="font-medium">{selectedItem.name}</span>
                          </div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            目标路径 (相对于videos/)
                          </label>
                          <input
                            type="text"
                            value={operationData.targetPath || currentPath}
                            onChange={(e) => setOperationData({...operationData, targetPath: e.target.value})}
                            placeholder="目标文件夹路径"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                          />
                          <div className="mt-2 text-xs text-gray-500">
                            文件将复制到: videos/{operationData.targetPath || currentPath}/
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {fileOperation === 'upload' && (
                    <div>
                      <p className="text-sm text-gray-600 mb-3">选择要上传的视频文件：</p>
                      <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                        <input
                          type="file"
                          accept=".mp4,.avi,.mov,.mkv,.webm"
                          multiple
                          onChange={(e) => {
                            const files = Array.from(e.target.files);
                            if (files.length > 0) {
                              setOperationData({...operationData, uploadFiles: files});
                            }
                          }}
                          className="hidden"
                          id="file-upload"
                        />
                        <label
                          htmlFor="file-upload"
                          className="cursor-pointer flex flex-col items-center gap-2"
                        >
                          <Upload className="text-gray-400" size={32} />
                          <span className="text-sm text-gray-600">
                            {operationData.uploadFiles && operationData.uploadFiles.length > 0 ? `已选择 ${operationData.uploadFiles.length} 个文件` : '点击选择多个文件或拖拽到此处'}
                          </span>
                          <span className="text-xs text-gray-500">
                            支持: MP4, AVI, MOV, MKV, WebM (最大2GB)
                          </span>
                        </label>
                      </div>
                    </div>
                  )}

                  {fileOperation === 'move' && (
                    <div>
                      {!selectedItem ? (
                        <div>
                          <p className="text-sm text-gray-600 mb-3">选择要移动的文件：</p>
                          <div className="max-h-60 overflow-y-auto space-y-2">
                            {items.map((item, index) => (
                              <button
                                key={index}
                                onClick={() => setSelectedItem(item)}
                                className="w-full text-left p-2 border rounded hover:bg-gray-50 transition-colors"
                              >
                                <div className="font-medium">{item.name}</div>
                                <div className="text-xs text-gray-500">
                                  {item.type === 'folder' ? '文件夹' : '文件'}
                                </div>
                              </button>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div>
                          <div className="mb-3">
                            <span className="text-sm text-gray-600">移动: </span>
                            <span className="font-medium">{selectedItem.name}</span>
                          </div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            目标路径 (相对于videos/)
                          </label>
                          <input
                            type="text"
                            value={operationData.targetPath || currentPath}
                            onChange={(e) => setOperationData({...operationData, targetPath: e.target.value})}
                            placeholder="目标文件夹路径"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                          />
                          <div className="mt-2 text-xs text-gray-500">
                            文件将移动到: videos/{operationData.targetPath || currentPath}/
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {fileOperation === 'batch-move' && (
                    <div>
                      <div className="mb-3">
                        <p className="text-sm text-gray-600 mb-3">选择要批量移动的文件或文件夹：</p>
                        <div className="max-h-60 overflow-y-auto space-y-2">
                          {items.map((item, index) => (
                            <label key={index} className="flex items-center gap-3 p-2 border rounded hover:bg-gray-50 transition-colors cursor-pointer">
                              <input
                                type="checkbox"
                                checked={selectedItems.some(selected => selected.key === item.key)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedItems([...selectedItems, item]);
                                  } else {
                                    setSelectedItems(selectedItems.filter(selected => selected.key !== item.key));
                                  }
                                }}
                                className="rounded text-orange-600"
                              />
                              <div className="flex-1">
                                <div className="font-medium">{item.name}</div>
                                <div className="text-xs text-gray-500">
                                  {item.type === 'folder' ? '文件夹' : '文件'}
                                </div>
                              </div>
                            </label>
                          ))}
                        </div>

                        {selectedItems.length > 0 && (
                          <div className="mt-3 p-2 bg-orange-50 border border-orange-200 rounded">
                            <p className="text-sm text-orange-800">
                              已选择 {selectedItems.length} 个文件
                            </p>
                          </div>
                        )}
                      </div>

                      {selectedItems.length > 0 && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            目标文件夹
                          </label>
                          <input
                            type="text"
                            value={operationData.targetFolder || ''}
                            onChange={(e) => setOperationData({...operationData, targetFolder: e.target.value})}
                            placeholder="输入目标文件夹名称（如：贾老师初联一轮/第1讲）"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                          />
                          <div className="mt-2 text-xs text-gray-500">
                            文件将移动到: videos/{operationData.targetFolder || '根目录'}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {fileOperation === 'batch-copy' && (
                    <div>
                      <div className="mb-3">
                        <p className="text-sm text-gray-600 mb-3">选择要批量复制的文件或文件夹：</p>
                        <div className="max-h-60 overflow-y-auto space-y-2">
                          {items.map((item, index) => (
                            <label key={index} className="flex items-center gap-3 p-2 border rounded hover:bg-gray-50 transition-colors cursor-pointer">
                              <input
                                type="checkbox"
                                checked={selectedItems.some(selected => selected.key === item.key)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedItems([...selectedItems, item]);
                                  } else {
                                    setSelectedItems(selectedItems.filter(selected => selected.key !== item.key));
                                  }
                                }}
                                className="rounded text-indigo-600"
                              />
                              <div className="flex-1">
                                <div className="font-medium">{item.name}</div>
                                <div className="text-xs text-gray-500">
                                  {item.type === 'folder' ? '文件夹' : '文件'}
                                </div>
                              </div>
                            </label>
                          ))}
                        </div>

                        {selectedItems.length > 0 && (
                          <div className="mt-3 p-2 bg-indigo-50 border border-indigo-200 rounded">
                            <p className="text-sm text-indigo-800">
                              已选择 {selectedItems.length} 个文件
                            </p>
                          </div>
                        )}
                      </div>

                      {selectedItems.length > 0 && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            目标文件夹
                          </label>
                          <input
                            type="text"
                            value={operationData.targetFolder || ''}
                            onChange={(e) => setOperationData({...operationData, targetFolder: e.target.value})}
                            placeholder="输入目标文件夹名称（如：贾老师初联一轮/第1讲）"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                          />
                          <div className="mt-2 text-xs text-gray-500">
                            文件将复制到: videos/{operationData.targetFolder || '根目录'}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {fileOperation === 'batch-delete' && (
                    <div>
                      <div className="mb-3">
                        <p className="text-sm text-gray-600 mb-3">选择要批量删除的文件或文件夹：</p>
                        <div className="max-h-60 overflow-y-auto space-y-2">
                          {items.map((item, index) => (
                            <label key={index} className="flex items-center gap-3 p-2 border rounded hover:bg-gray-50 transition-colors cursor-pointer">
                              <input
                                type="checkbox"
                                checked={selectedItems.some(selected => selected.key === item.key)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedItems([...selectedItems, item]);
                                  } else {
                                    setSelectedItems(selectedItems.filter(selected => selected.key !== item.key));
                                  }
                                }}
                                className="rounded text-red-600"
                              />
                              <div className="flex-1">
                                <div className="font-medium">{item.name}</div>
                                <div className="text-xs text-gray-500">
                                  {item.type === 'folder' ? '文件夹' : '文件'}
                                </div>
                              </div>
                            </label>
                          ))}
                        </div>

                        {selectedItems.length > 0 && (
                          <div className="mt-3 p-2 bg-red-50 border border-red-200 rounded">
                            <p className="text-sm text-red-800">
                              已选择 {selectedItems.length} 个文件 - ⚠️ 删除操作不可恢复
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {fileOperation === 'delete' && (
                    <div>
                      {!selectedItem ? (
                        <div>
                          <p className="text-sm text-gray-600 mb-3">选择要删除的文件或文件夹：</p>
                          <div className="max-h-60 overflow-y-auto space-y-2">
                            {items.map((item, index) => (
                              <button
                                key={index}
                                onClick={() => setSelectedItem(item)}
                                className="w-full text-left p-2 border rounded hover:bg-red-50 transition-colors"
                              >
                                <div className="font-medium">{item.name}</div>
                                <div className="text-xs text-red-500">
                                  {item.type === 'folder' ? '文件夹' : '文件'}
                                </div>
                              </button>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div>
                          <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                            <span className="text-sm text-red-600">⚠️ 警告: 即将删除文件</span>
                            <div className="font-medium text-red-800 mt-1">{selectedItem.name}</div>
                            <div className="text-xs text-red-600 mt-2">
                              此操作不可撤销，请谨慎操作！
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="flex gap-3 pt-4 border-t">
                    <button
                      onClick={() => {
                        setFileOperation(null);
                        setSelectedItem(null);
                        setSelectedItems([]);
                        setOperationData({});
                      }}
                      disabled={isProcessingOperation}
                      className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      返回
                    </button>
                    <button
                      onClick={async () => {
                        if (fileOperation === 'create-folder' && operationData.folderName) {
                          const folderPath = currentPath ? `${currentPath}/${operationData.folderName}` : operationData.folderName;
                          await handleCreateFolder(folderPath);
                        } else if (fileOperation === 'rename' && selectedItem && operationData.newName) {
                          const oldPath = selectedItem.key || (currentPath ? `videos/${currentPath}/${selectedItem.name}` : `videos/${selectedItem.name}`);
                          const newPath = currentPath ? `videos/${currentPath}/${operationData.newName}` : `videos/${operationData.newName}`;
                          await handleRenameItem(oldPath, newPath);
                        } else if (fileOperation === 'move' && selectedItems.length > 0 && operationData.targetFolder !== undefined) {
                          await handleBatchMoveItems(selectedItems, operationData.targetFolder);
                        } else if (fileOperation === 'copy' && selectedItems.length > 0 && operationData.targetFolder !== undefined) {
                          await handleBatchCopyItems(selectedItems, operationData.targetFolder);
                        } else if (fileOperation === 'delete' && selectedItems.length > 0) {
                          await handleBatchDeleteItems(selectedItems);
                        } else if (fileOperation === 'upload' && operationData.uploadFiles) {
                          // 设置上传状态并执行上传
                          setSelectedFiles(operationData.uploadFiles);
                          setShowFileManager(false); // 关闭文件管理模态框
                          setShowUpload(true); // 显示上传模态框
                          // 重置上传状态
                          setIsUploading(false);
                          setUploadProgress(0);
                          setCurrentUploadIndex(0);
                      }}
                      disabled={isProcessingOperation || !canExecuteOperation()}
                      className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {isProcessingOperation ? '处理中...' : '确认'}
                    </button>
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
