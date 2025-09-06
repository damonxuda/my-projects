import React, { useState, useEffect } from 'react';
import { X, Play, Download } from 'lucide-react';
import { useAuth } from '../../../auth-clerk/src';

const VideoPlayer = ({ video, apiUrl, onClose }) => {
  const [videoUrl, setVideoUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { getToken, isSignedIn } = useAuth();

  useEffect(() => {
    const loadVideoUrl = async () => {
      try {
        console.log('🎬 开始加载视频URL');
        console.log('📋 video对象:', video);
        console.log('🌐 apiUrl:', apiUrl);
        
        const token = await getToken();
        console.log('🎫 获取到token:', token ? '有效' : '无效');
        
        const requestUrl = `${apiUrl}/videos/url/${encodeURIComponent(video.key)}`;
        console.log('📡 完整请求URL:', requestUrl);
        console.log('🔑 video.key:', video.key);
        
        const response = await fetch(requestUrl, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        console.log('📨 响应状态码:', response.status);
        console.log('📨 响应状态文本:', response.statusText);
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error('❌ 响应错误内容:', errorText);
          throw new Error(`获取视频URL失败: ${response.status} ${response.statusText}`);
        }

        const responseText = await response.text();
        
        let data;
        try {
          data = JSON.parse(responseText);
        } catch (parseError) {
          throw new Error('服务器返回的数据格式错误');
        }
        
        if (data.url) {
          setVideoUrl(data.url);
        } else {
          throw new Error('服务器返回的数据中没有视频URL');
        }
        
      } catch (err) {
        setError(`加载视频失败: ${err.message}`);
      } finally {
        setLoading(false);
      }
    };

    if (video && isSignedIn) {
      loadVideoUrl();
    }
  }, [video, isSignedIn, apiUrl, getToken]);

  if (!video) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="video-player-modal bg-white rounded-xl p-6">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-bold text-gray-800 pr-4">{video.name}</h3>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full flex-shrink-0"
          >
            <X size={24} />
          </button>
        </div>

        {loading && (
          <div className="text-center py-12">
            <div className="loading-spinner h-12 w-12 mx-auto"></div>
            <p className="mt-4 text-gray-600">正在加载视频...</p>
          </div>
        )}

        {error && (
          <div className="text-center py-12">
            <p className="text-red-600 mb-4">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
            >
              重试
            </button>
          </div>
        )}

        {videoUrl && !loading && !error && (
          <div className="space-y-6">
            <video
              src={videoUrl}
              controls
              className="responsive-video"
              onError={() => setError('视频播放失败')}
            >
              您的浏览器不支持视频播放
            </video>

            <div className="flex flex-wrap gap-3 justify-center">
              <a
                href={videoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
              >
                <Play size={16} />
                外部播放器打开
              </a>
              <a
                href={videoUrl}
                download={video.name}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                <Download size={16} />
                下载视频
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default VideoPlayer;