import React, { useState, useEffect, useCallback } from "react";
import {
  Folder,
  Play,
  Youtube,
  ExternalLink,
  Trash2,
  MoreVertical,
} from "lucide-react";
import VideoThumbnail from "./VideoThumbnail";

const FileCard = ({
  item,
  onFolderClick,
  onVideoPlay,
  getVideoUrl,
  apiUrl,
  getCachedToken,
  clearTokenCache,
  onDelete,
}) => {
  const [videoUrl, setVideoUrl] = useState(null);
  const [youtubeData, setYoutubeData] = useState(null);
  const [showMenu, setShowMenu] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const isVideo = item.type === "video";
  const isFolder = item.type === "folder";
  const isYouTube = item.type === "youtube";

  const formatFileSize = (bytes) => {
    if (!bytes) return "";
    const mb = bytes / 1024 / 1024;
    return mb > 1024 ? `${(mb / 1024).toFixed(1)} GB` : `${mb.toFixed(1)} MB`;
  };

  const formatDate = (dateString) => {
    if (!dateString) return "";
    return new Date(dateString).toLocaleDateString("zh-CN");
  };

  // 提取YouTube视频ID（支持新旧文件名格式）
  const extractVideoId = useCallback((filename) => {
    // 新格式：Title_[videoId].youtube.json
    const newFormatMatch = filename.match(/_\[([^\]]+)\]\.youtube\.json$/);
    if (newFormatMatch) {
      return newFormatMatch[1];
    }

    // 老格式：YouTube视频_videoId.youtube.json
    const oldFormatMatch = filename.match(
      /YouTube视频_([^.]+)\.youtube\.json$/
    );
    if (oldFormatMatch) {
      return oldFormatMatch[1];
    }

    return null;
  }, []);

  // 获取显示标题（从文件名提取）
  const getDisplayTitle = useCallback(
    (filename) => {
      // 新格式：提取Title部分
      const newFormatMatch = filename.match(/^(.+)_\[[^\]]+\]\.youtube\.json$/);
      if (newFormatMatch) {
        return newFormatMatch[1];
      }

      // 老格式：使用videoId作为标题
      const videoId = extractVideoId(filename);
      if (videoId) {
        return `YouTube视频_${videoId}`;
      }

      // 兜底：使用文件名去掉扩展名
      return filename.replace(".youtube.json", "");
    },
    [extractVideoId]
  );

  // 获取视频URL用于播放
  useEffect(() => {
    if (isVideo && getVideoUrl && !videoUrl) {
      const loadVideoUrl = async () => {
        try {
          const url = await getVideoUrl(item.key);
          setVideoUrl(url);
        } catch (error) {
          console.error("❌ 获取视频URL失败:", item.name, error);
        }
      };
      loadVideoUrl();
    }
  }, [isVideo, item.key, getVideoUrl, videoUrl, item.name]);



  // 处理YouTube数据 - 使用简化逻辑从文件名提取信息
  useEffect(() => {
    if (isYouTube) {
      const videoId = extractVideoId(item.name);
      const displayTitle = getDisplayTitle(item.name);

      const youtubeInfo = {
        videoId: videoId,
        title: displayTitle,
        displayName: displayTitle,
        channelTitle: "Unknown",
        thumbnailUrl: videoId
          ? `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`
          : null,
        url: null,
        description: "",
      };

      setYoutubeData(youtubeInfo);
    }
  }, [isYouTube, item.name, extractVideoId, getDisplayTitle]);

  // 处理删除
  const handleDelete = async (e) => {
    e.stopPropagation();

    if (
      !window.confirm(
        `确定要删除 "${isYouTube && youtubeData ? youtubeData.displayName : item.name}" 吗？`
      )
    ) {
      return;
    }

    setIsDeleting(true);
    try {
      await onDelete(item);
      setShowMenu(false);
    } catch (error) {
      alert("删除失败，请重试");
      console.error("删除文件失败:", error);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleClick = () => {
    if (isFolder) {
      onFolderClick(item.path);
    } else if (isVideo || isYouTube) {
      onVideoPlay(item);
    }
  };

  const handleMenuClick = (e) => {
    e.stopPropagation();
    setShowMenu(!showMenu);
  };

  return (
    <div
      className="file-card border border-gray-200 rounded-xl p-4 cursor-pointer bg-white hover:shadow-lg hover:border-gray-300 transition-all duration-200 relative group"
      onClick={handleClick}
    >
      {/* 删除菜单按钮 - 只对视频和YouTube文件显示 */}
      {(isVideo || isYouTube) && (
        <div className="absolute top-2 right-2 z-10">
          <button
            onClick={handleMenuClick}
            className="opacity-0 group-hover:opacity-100 transition-opacity bg-white bg-opacity-90 hover:bg-opacity-100 rounded-full p-1 shadow-md"
            title="更多操作"
          >
            <MoreVertical size={16} className="text-gray-600" />
          </button>

          {/* 下拉菜单 */}
          {showMenu && (
            <div className="absolute right-0 top-8 bg-white border border-gray-200 rounded-lg shadow-lg py-1 min-w-24 z-20">
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 disabled:opacity-50 flex items-center gap-2"
              >
                <Trash2 size={14} />
                {isDeleting ? "删除中..." : "删除"}
              </button>
            </div>
          )}
        </div>
      )}

      <div className="flex flex-col">
        {/* 缩略图/图标区域 */}
        <div className="mb-3 relative">
          {isFolder ? (
            <div className="w-full h-32 bg-gradient-to-br from-blue-400 to-blue-600 rounded-lg flex items-center justify-center">
              <Folder className="text-white" size={48} />
            </div>
          ) : isYouTube ? (
            <div className="w-full h-32 rounded-lg overflow-hidden relative">
              {youtubeData?.thumbnailUrl ? (
                <>
                  <img
                    src={youtubeData.thumbnailUrl}
                    alt={youtubeData.displayName}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.target.style.display = "none";
                      e.target.nextElementSibling.style.display = "flex";
                    }}
                  />
                  <div
                    className="w-full h-full bg-gradient-to-br from-red-400 to-red-600 flex items-center justify-center"
                    style={{ display: "none" }}
                  >
                    <Youtube className="text-white" size={48} />
                  </div>
                </>
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-red-400 to-red-600 flex items-center justify-center">
                  <Youtube className="text-white" size={48} />
                </div>
              )}

              {/* YouTube标识 */}
              <div className="absolute top-2 left-2 bg-black bg-opacity-70 rounded px-2 py-1 flex items-center gap-1">
                <Youtube className="text-red-500" size={12} />
                <ExternalLink className="text-white" size={10} />
              </div>

              {/* 播放按钮覆盖层 */}
              <div className="absolute inset-0 bg-black bg-opacity-30 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                <div className="bg-red-600 rounded-full p-3">
                  <Play className="text-white" size={24} fill="white" />
                </div>
              </div>
            </div>
          ) : isVideo ? (
            <VideoThumbnail 
              videoUrl={videoUrl} 
              alt={item.name}
              fileSize={item.size}
              fileName={item.key}  // 使用完整的S3路径
              apiUrl={apiUrl}
              getCachedToken={getCachedToken}
              clearTokenCache={clearTokenCache}
            />
          ) : (
            <div className="w-full h-32 bg-gradient-to-br from-gray-400 to-gray-600 rounded-lg flex items-center justify-center">
              <span className="text-white text-2xl">📄</span>
            </div>
          )}
        </div>

        {/* 文件信息 */}
        <div className="text-center">
          <h4 className="font-semibold text-gray-800 mb-2 text-sm leading-tight line-clamp-2">
            {isYouTube && youtubeData ? youtubeData.displayName : item.name}
          </h4>

          {isVideo && (
            <div className="text-xs text-gray-600 space-y-1">
              {item.size && <p>大小: {formatFileSize(item.size)}</p>}
              {item.lastModified && (
                <p>更新: {formatDate(item.lastModified)}</p>
              )}
            </div>
          )}

          {isYouTube && (
            <div className="text-xs text-gray-600 space-y-1">
              <div className="flex items-center justify-center gap-1">
                <Youtube className="text-red-500" size={12} />
                <span className="text-red-600 font-medium">YouTube视频</span>
              </div>
              {item.lastModified && (
                <p>添加: {formatDate(item.lastModified)}</p>
              )}
            </div>
          )}

          {isFolder && (
            <p className="text-xs text-gray-600">{item.count || 0} 项内容</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default FileCard;
