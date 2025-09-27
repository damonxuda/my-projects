import React, { useState } from 'react';
import { Youtube, X } from 'lucide-react';

const YouTubeManager = ({
  show,
  onClose,
  onComplete,
  apiUrl,
  getToken
}) => {
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const handleAddYouTube = async () => {
    if (!youtubeUrl.trim()) return;

    setIsProcessing(true);
    // TODO: 实现YouTube下载逻辑
    setTimeout(() => {
      setIsProcessing(false);
      onComplete();
      onClose();
    }, 3000);
  };

  if (!show) return null;

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-medium text-gray-900">添加 YouTube 视频</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              YouTube URL
            </label>
            <input
              type="url"
              value={youtubeUrl}
              onChange={(e) => setYoutubeUrl(e.target.value)}
              placeholder="https://www.youtube.com/watch?v=..."
              className="w-full border border-gray-300 rounded-md px-3 py-2"
            />
          </div>

          <div className="flex space-x-2">
            <button
              onClick={handleAddYouTube}
              disabled={!youtubeUrl.trim() || isProcessing}
              className="flex-1 bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 disabled:opacity-50"
            >
              <Youtube className="inline h-4 w-4 mr-2" />
              {isProcessing ? '处理中...' : '添加视频'}
            </button>
            <button
              onClick={onClose}
              disabled={isProcessing}
              className="flex-1 bg-gray-300 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-400"
            >
              取消
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default YouTubeManager;