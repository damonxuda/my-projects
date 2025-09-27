import React, { useState, useEffect, useCallback } from "react";
import {
  Folder,
  Play,
  Youtube,
  ExternalLink,
} from "lucide-react";
import VideoThumbnail from "./VideoThumbnail";

const FileCard = ({
  item,
  onFolderClick,
  onVideoPlay,
  apiUrl,
  thumbnailApiUrl,
  getToken,
  // 多选相关props
  isMultiSelectMode = false,
  isSelected = false,
  onSelectionChange,
}) => {
  const [youtubeData, setYoutubeData] = useState(null);
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

  // 不再需要预先获取视频URL，播放时再获取



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

  const handleClick = (e) => {
    // 文件夹总是直接进入，不受多选模式影响
    if (isFolder) {
      onFolderClick(item.path);
      return;
    }

    // 如果是多选模式且不是文件夹，处理选择逻辑
    if (isMultiSelectMode && onSelectionChange) {
      e.preventDefault();
      e.stopPropagation();
      onSelectionChange(!isSelected);
      return;
    }

    // 普通模式下的视频文件点击逻辑
    if (isVideo || isYouTube) {
      onVideoPlay(item);
    }
  };

  return (
    <div
      className={`file-card border rounded-xl p-4 cursor-pointer bg-white hover:shadow-lg transition-all duration-200 relative group ${
        isMultiSelectMode && isSelected && !isFolder
          ? 'border-blue-500 bg-blue-50 shadow-md'
          : 'border-gray-200 hover:border-gray-300'
      }`}
      onClick={handleClick}
    >
      {/* 删除功能已移至文件管理下拉菜单 */}

      <div className="flex flex-col">
        {/* 缩略图/图标区域 */}
        <div className="mb-3 relative">
          {/* 多选模式复选框 - 文件夹不显示复选框 */}
          {isMultiSelectMode && !isFolder && (
            <div className="absolute top-2 right-2 z-10">
              <div className={`w-6 h-6 rounded border-2 flex items-center justify-center ${
                isSelected
                  ? 'bg-blue-500 border-blue-500'
                  : 'bg-white border-gray-300'
              }`}>
                {isSelected && (
                  <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
                  </svg>
                )}
              </div>
            </div>
          )}
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
              alt={item.name}
              fileSize={item.size}
              fileName={item.key}  // 使用完整的S3路径
              apiUrl={thumbnailApiUrl || apiUrl}
              getToken={getToken}
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

        </div>
      </div>
    </div>
  );
};

export default FileCard;
