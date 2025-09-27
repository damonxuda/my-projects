import React, { useState, useEffect } from 'react';
import { Youtube, X, Trash2, Plus, ExternalLink } from 'lucide-react';

const YouTubeManagerModal = ({
  show,
  onClose,
  onComplete,
  getToken,
  currentPath
}) => {
  const [showAddForm, setShowAddForm] = useState(false);
  const [youtubeFiles, setYoutubeFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [youtubeUrl, setYoutubeUrl] = useState('');

  const YOUTUBE_MANAGER_URL = process.env.REACT_APP_YOUTUBE_MANAGER_API_URL;

  // 加载YouTube文件列表
  const loadYouTubeFiles = async () => {
    if (!YOUTUBE_MANAGER_URL) return;

    setLoading(true);
    try {
      const token = await getToken();
      const response = await fetch(`${YOUTUBE_MANAGER_URL}/youtube/list`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        setYoutubeFiles(data);
      }
    } catch (error) {
      console.error('加载YouTube文件失败:', error);
    } finally {
      setLoading(false);
    }
  };

  // 添加YouTube视频
  const handleAddYouTube = async () => {
    if (!youtubeUrl.trim()) {
      alert("请输入YouTube链接");
      return;
    }

    // 提取YouTube视频ID
    const extractVideoId = (url) => {
      const regex = /(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/;
      const match = url.match(regex);
      return match ? match[1] : null;
    };

    const videoId = extractVideoId(youtubeUrl);
    if (!videoId) {
      alert("请输入有效的YouTube链接\n例如: https://www.youtube.com/watch?v=dQw4w9WgXcQ");
      return;
    }

    setLoading(true);
    try {
      // 获取视频信息
      const response = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(youtubeUrl)}&format=json`);
      if (!response.ok) {
        throw new Error("无法获取YouTube视频信息");
      }

      const videoInfo = await response.json();

      // 准备JSON数据
      const jsonContent = JSON.stringify({
        videoId: videoId,
        title: videoInfo.title,
        author_name: videoInfo.author_name,
        thumbnail_url: videoInfo.thumbnail_url,
        html: videoInfo.html,
        url: youtubeUrl,
        created_at: new Date().toISOString()
      }, null, 2);

      // 生成文件名 - 清理文件名中的特殊字符
      const safeTitle = videoInfo.title.replace(/[\/\\:*?"<>|]/g, '_');
      const fileName = `${safeTitle}_[${videoId}].youtube.json`;

      // 获取认证token
      const token = await getToken();
      if (!token) {
        throw new Error("无法获取认证token");
      }

      // 使用YOUTUBE_MANAGER_API添加YouTube文件
      const uploadResponse = await fetch(`${YOUTUBE_MANAGER_URL}/youtube/add`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          fileName: fileName,
          content: jsonContent
        }),
      });

      if (!uploadResponse.ok) {
        const errorText = await uploadResponse.text();
        throw new Error(`YouTube文件添加失败: ${uploadResponse.status} - ${errorText.substring(0, 200)}`);
      }

      // 成功
      setYoutubeUrl("");
      alert("YouTube视频添加成功！");
      await loadYouTubeFiles(); // 刷新列表
      onComplete(); // 通知主界面刷新

    } catch (error) {
      console.error("添加YouTube视频失败:", error);
      alert("添加失败，请重试: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  // 批量删除YouTube文件
  const handleBatchDelete = async () => {
    if (selectedFiles.length === 0) {
      alert('请先选择要删除的视频');
      return;
    }

    if (!window.confirm(`确定要删除选中的 ${selectedFiles.length} 个视频吗？`)) return;

    setLoading(true);
    try {
      const token = await getToken();

      for (const file of selectedFiles) {
        const response = await fetch(`${YOUTUBE_MANAGER_URL}/youtube/delete`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ key: file.key }),
        });

        if (!response.ok) {
          throw new Error(`删除 ${file.name} 失败`);
        }
      }

      setSelectedFiles([]);
      await loadYouTubeFiles(); // 刷新列表
      onComplete(); // 通知主界面刷新
      alert('删除成功');
    } catch (error) {
      console.error('批量删除失败:', error);
      alert('删除失败: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // 当显示时加载文件列表
  useEffect(() => {
    if (show) {
      loadYouTubeFiles();
    }
  }, [show]);

  if (!show) return null;

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-10 mx-auto p-6 border w-[900px] max-w-[90vw] shadow-lg rounded-md bg-white">
        {/* 标题 */}
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Youtube className="text-red-600" size={24} />
            YouTube 视频管理
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* 添加YouTube视频区域 */}
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <h4 className="text-lg font-semibold text-red-800 mb-3 flex items-center gap-2">
            <Plus size={18} />
            添加新视频
          </h4>
          <div className="flex gap-3">
            <input
              type="url"
              value={youtubeUrl}
              onChange={(e) => setYoutubeUrl(e.target.value)}
              placeholder="https://www.youtube.com/watch?v=..."
              className="flex-1 border border-gray-300 rounded-md px-3 py-2"
              disabled={loading}
            />
            <button
              onClick={handleAddYouTube}
              disabled={!youtubeUrl.trim() || loading}
              className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-md disabled:opacity-50 flex items-center gap-2"
            >
              <Youtube size={16} />
              {loading ? '添加中...' : '添加'}
            </button>
          </div>
        </div>

        {/* YouTube文件列表 */}
        <div className="max-h-96 overflow-y-auto">
          <div className="flex justify-between items-center mb-4">
            <h4 className="text-lg font-semibold">当前视频列表</h4>
            {selectedFiles.length > 0 && (
              <button
                onClick={handleBatchDelete}
                disabled={loading}
                className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md text-sm flex items-center gap-2 disabled:opacity-50"
              >
                <Trash2 size={16} />
                删除选中 ({selectedFiles.length})
              </button>
            )}
          </div>

          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600 mx-auto"></div>
              <p className="mt-2 text-gray-600">加载中...</p>
            </div>
          ) : youtubeFiles.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Youtube size={48} className="mx-auto mb-4 text-gray-300" />
              <p>暂无 YouTube 视频</p>
              <p className="text-sm mt-2">在上方输入YouTube链接添加视频</p>
            </div>
          ) : (
            <div className="space-y-2">
              {youtubeFiles.map((file) => {
                const isSelected = selectedFiles.some(selected => selected.key === file.key);
                let displayName = file.name;
                let videoUrl = null;

                // 尝试从文件名提取视频ID和标题
                const match = file.name.match(/^(.+)_\[([a-zA-Z0-9_-]+)\]\.youtube\.json$/);
                if (match) {
                  displayName = match[1];
                  videoUrl = `https://www.youtube.com/watch?v=${match[2]}`;
                }

                return (
                  <div
                    key={file.key}
                    className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
                      isSelected ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedFiles([...selectedFiles, file]);
                          } else {
                            setSelectedFiles(selectedFiles.filter(selected => selected.key !== file.key));
                          }
                        }}
                        className="rounded text-red-600"
                      />
                      <Youtube className="text-red-600" size={20} />
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">{displayName}</p>
                        <p className="text-sm text-gray-500">
                          {new Date(file.lastModified).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {videoUrl && (
                        <a
                          href={videoUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-800"
                          title="在YouTube中打开"
                        >
                          <ExternalLink size={16} />
                        </a>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 关闭按钮 */}
        <div className="mt-6 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  );
};

export default YouTubeManagerModal;