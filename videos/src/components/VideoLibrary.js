import React, { useState, useEffect } from "react";
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

  const { user, isSignedIn, isAdmin, fetchVideoList, getVideoUrl, getToken } =
    useAuth();

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
      console.log("开始删除文件:", item.name);

      const token = await getToken();
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
        const errorData = await response.json();
        throw new Error(errorData.details || `删除失败: ${response.status}`);
      }

      const result = await response.json();
      console.log("文件删除成功:", result);

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
        throw new Error(`上传失败: ${response.status}`);
      }

      const result = await response.json();
      console.log("YouTube视频添加成功:", result);

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

  // 加载视频列表
  const loadItems = async (path = "") => {
    setLoading(true);
    setError("");

    try {
      if (!isSignedIn || !user) {
        throw new Error("用户未登录");
      }

      console.log("VideoLibrary: 加载视频列表, path:", path);

      const data = await fetchVideoList(path);
      console.log("原始文件数据:", data.length, "个文件");

      // 调试：输出所有文件名
      data.forEach((file, index) => {
        const filename = file.Key.split("/").pop();
        console.log(`文件${index + 1}:`, filename, "| 完整路径:", file.Key);
      });

      const processedItems = processFileList(data, path);
      setItems(processedItems);

      console.log("VideoLibrary: 处理后项目数:", processedItems.length);
      console.log(
        "处理结果:",
        processedItems.map((item) => ({ name: item.name, type: item.type }))
      );
    } catch (err) {
      console.error("VideoLibrary: 加载失败:", err);
      setError(err.message || "加载失败，请刷新重试");
    } finally {
      setLoading(false);
    }
  };

  // 处理文件列表，创建文件夹结构（支持YouTube JSON文件）
  const processFileList = (files, currentPath) => {
    const folders = new Map();
    const videos = [];
    const youtubeVideos = [];

    console.log("开始处理文件列表, currentPath:", currentPath);

    files.forEach((file) => {
      const relativePath = file.Key.startsWith("videos/")
        ? file.Key.substring(7)
        : file.Key;

      if (currentPath && !relativePath.startsWith(currentPath + "/")) {
        console.log("跳过文件（路径不匹配）:", relativePath);
        return;
      }

      const pathAfterCurrent = currentPath
        ? relativePath.substring(currentPath.length + 1)
        : relativePath;

      const pathParts = pathAfterCurrent.split("/");

      if (pathParts.length === 1) {
        const filename = pathParts[0];

        // 检查是否是YouTube JSON文件
        if (filename.endsWith(".youtube.json")) {
          youtubeVideos.push({
            type: "youtube",
            name: filename,
            key: file.Key,
            size: file.Size,
            lastModified: file.LastModified,
            path: currentPath ? `${currentPath}/${filename}` : filename,
          });
          console.log(`添加YouTube视频: ${filename}`);
        } else if (isVideoFile(filename)) {
          videos.push({
            type: "video",
            name: filename,
            key: file.Key,
            size: file.Size,
            lastModified: file.LastModified,
            path: currentPath ? `${currentPath}/${filename}` : filename,
          });
          console.log(`添加本地视频: ${filename}`);
        } else {
          console.log(`跳过非视频文件: ${filename}`);
        }
      } else {
        const folderName = pathParts[0];
        const folderPath = currentPath
          ? `${currentPath}/${folderName}`
          : folderName;

        if (!folders.has(folderName)) {
          folders.set(folderName, {
            type: "folder",
            name: folderName,
            path: folderPath,
            count: 0,
          });
        }
        folders.get(folderName).count++;
        console.log(`处理文件夹: ${folderName}`);
      }
    });

    console.log(
      `最终统计: ${folders.size} 个文件夹, ${videos.length} 个本地视频, ${youtubeVideos.length} 个YouTube视频`
    );

    return [
      ...Array.from(folders.values()).sort((a, b) =>
        a.name.localeCompare(b.name)
      ),
      ...videos.sort((a, b) => a.name.localeCompare(b.name)),
      ...youtubeVideos.sort((a, b) => a.name.localeCompare(b.name)),
    ];
  };

  // 检查是否为视频文件 - 加强调试
  const isVideoFile = (filename) => {
    const videoExtensions = [
      ".mp4",
      ".avi",
      ".mov",
      ".wmv",
      ".flv",
      ".webm",
      ".mkv",
    ];
    const lowerFilename = filename.toLowerCase();

    console.log(`视频格式检查: "${filename}" -> "${lowerFilename}"`);

    const result = videoExtensions.some((ext) => {
      const matches = lowerFilename.endsWith(ext);
      if (matches) {
        console.log(`匹配格式: ${ext}`);
      }
      return matches;
    });

    console.log(`"${filename}" 检查结果: ${result}`);
    return result;
  };

  // 导航到指定路径
  const navigateToPath = (path) => {
    setCurrentPath(path);
    loadItems(path);
  };

  // 视频播放处理（支持YouTube）
  const handleVideoPlay = (video) => {
    console.log("点击视频:", video.name, "类型:", video.type);

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
      console.log("播放YouTube视频:", youtubeVideo.name);

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
        console.log("打开YouTube链接:", youtubeUrl);
        window.open(youtubeUrl, "_blank");
      } else {
        console.error("无法从文件名提取videoId:", filename);
        alert("无法获取YouTube视频ID，请重试");
      }
    } catch (error) {
      console.error("播放YouTube视频失败:", error);
      alert("播放失败，请重试");
    }
  };

  // 初始加载
  useEffect(() => {
    if (isSignedIn && user) {
      loadItems();
    }
  }, [isSignedIn, user]);

  return (
    <>
      {/* YouTube添加区域 */}
      <div className="mb-6 bg-white rounded-lg shadow-sm border">
        {!showAddYouTube ? (
          <div className="p-4">
            <button
              onClick={() => setShowAddYouTube(true)}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              <Youtube size={20} />
              <span>添加YouTube视频</span>
              <Plus size={16} />
            </button>
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
                  key={`${item.type}-${item.name}-${index}`}
                  item={item}
                  onFolderClick={navigateToPath}
                  onVideoPlay={handleVideoPlay}
                  getVideoUrl={getVideoUrl}
                  apiUrl={API_BASE_URL}
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
