import React, { useState, useEffect } from 'react';
import { Youtube, X, Trash2, Plus } from 'lucide-react';
import YouTubeManager from './YouTubeManager';

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

  // 删除YouTube文件
  const deleteYouTubeFile = async (file) => {
    if (!window.confirm(`确定要删除 ${file.name} 吗？`)) return;

    setDeleting(file.key);
    try {
      const token = await getToken();
      const response = await fetch(`${YOUTUBE_MANAGER_URL}/youtube/delete`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ key: file.key }),
      });

      if (response.ok) {
        await loadYouTubeFiles(); // 刷新列表
        onComplete(); // 通知主界面刷新
      } else {
        alert('删除失败');
      }
    } catch (error) {
      console.error('删除YouTube文件失败:', error);
      alert('删除失败');
    } finally {
      setDeleting(null);
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
      <div className="relative top-10 mx-auto p-6 border w-[800px] max-w-[90vw] shadow-lg rounded-md bg-white">
        {/* 标题 */}
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Youtube className="text-red-600" size={24} />
            YouTube 文件管理
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* 操作按钮 */}
        <div className="mb-6">
          <button
            onClick={() => setShowAddForm(true)}
            className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md flex items-center gap-2"
          >
            <Plus size={16} />
            添加 YouTube 视频
          </button>
        </div>

        {/* YouTube文件列表 */}
        <div className="max-h-96 overflow-y-auto">
          <h4 className="text-lg font-semibold mb-4">当前 YouTube 文件</h4>

          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600 mx-auto"></div>
              <p className="mt-2 text-gray-600">加载中...</p>
            </div>
          ) : youtubeFiles.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Youtube size={48} className="mx-auto mb-4 text-gray-300" />
              <p>暂无 YouTube 文件</p>
            </div>
          ) : (
            <div className="space-y-2">
              {youtubeFiles.map((file) => (
                <div key={file.key} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <Youtube className="text-red-600" size={20} />
                    <div>
                      <p className="font-medium text-gray-900">{file.name}</p>
                      <p className="text-sm text-gray-500">
                        {new Date(file.lastModified).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => deleteYouTubeFile(file)}
                    disabled={deleting === file.key}
                    className="text-red-600 hover:text-red-800 disabled:opacity-50"
                  >
                    {deleting === file.key ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-600"></div>
                    ) : (
                      <Trash2 size={16} />
                    )}
                  </button>
                </div>
              ))}
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

      {/* YouTube添加表单 */}
      <YouTubeManager
        show={showAddForm}
        onClose={() => setShowAddForm(false)}
        onComplete={() => {
          setShowAddForm(false);
          loadYouTubeFiles(); // 重新加载列表
          onComplete(); // 通知主界面刷新
        }}
        getToken={getToken}
      />
    </div>
  );
};

export default YouTubeManagerModal;