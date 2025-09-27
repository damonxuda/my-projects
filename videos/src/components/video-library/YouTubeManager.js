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

    setIsProcessing(true);
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

      // 生成文件名
      const fileName = `${videoInfo.title}_[${videoId}].youtube.json`;

      // 获取上传URL
      const token = await getToken();
      if (!token) {
        throw new Error("无法获取认证token");
      }

      // 使用FILE_MANAGEMENT_API上传
      const FILE_MANAGEMENT_URL = process.env.REACT_APP_FILE_MANAGEMENT_API_URL;
      const uploadResponse = await fetch(`${FILE_MANAGEMENT_URL}/files/upload-url`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          fileName: fileName,
          content: jsonContent,
          path: "YouTube/",
        }),
      });

      if (!uploadResponse.ok) {
        const errorText = await uploadResponse.text();
        throw new Error(`YouTube视频上传失败: ${uploadResponse.status} - ${errorText.substring(0, 200)}`);
      }

      // 成功
      setYoutubeUrl("");
      alert("YouTube视频添加成功！");
      onComplete();
      onClose();

    } catch (error) {
      console.error("添加YouTube视频失败:", error);
      alert("添加失败，请重试: " + error.message);
    } finally {
      setIsProcessing(false);
    }
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