import React, { useState, useEffect } from 'react';
import { X, Play, Download } from 'lucide-react';
import { useAuth } from '../../../auth-clerk/src';

const VideoPlayer = ({ video, apiUrl, onClose }) => {
  const [videoUrl, setVideoUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { getCachedToken, isSignedIn } = useAuth();

  useEffect(() => {
    const loadVideoUrl = async () => {
      // 防止重复请求：如果已经有URL且是相同视频，直接返回
      if (videoUrl) {
        return;
      }

      try {
        setLoading(true);
        setError('');
        console.log('🎬 开始加载视频URL');
        console.log('📋 video对象:', video);
        console.log('🌐 apiUrl:', apiUrl);

        const token = await getCachedToken();
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
        console.log('📄 VideoPlayer - Raw response (first 200 chars):', responseText.substring(0, 200));

        // 检查响应是否是HTML而不是JSON
        if (responseText.trim().startsWith('<!DOCTYPE') || responseText.trim().startsWith('<html')) {
          console.error('❌ VideoPlayer - 收到HTML响应而非JSON:', responseText.substring(0, 500));
          throw new Error('视频服务返回HTML页面而非JSON数据，请检查API端点配置');
        }

        let data;
        try {
          data = JSON.parse(responseText);
        } catch (parseError) {
          console.error('❌ VideoPlayer - JSON解析失败:', parseError);
          console.error('❌ VideoPlayer - 原始响应:', responseText);
          throw new Error(`视频URL JSON解析失败: ${parseError.message}. 响应内容: ${responseText.substring(0, 200)}`);
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
  }, [video?.key, isSignedIn, apiUrl]);

  // 当video改变时重置videoUrl
  useEffect(() => {
    setVideoUrl('');
    setError('');
  }, [video?.key]);

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
              onError={(e) => {
                console.error('视频播放错误:', e);
                console.error('错误代码:', e.target.error?.code);
                console.error('错误消息:', e.target.error?.message);
                setError(`视频播放失败 (错误代码: ${e.target.error?.code || 'unknown'})`);
              }}
              onLoadedMetadata={(e) => {
                console.log('视频元数据加载完成');
                console.log('视频时长:', e.target.duration);
                console.log('视频宽度:', e.target.videoWidth);
                console.log('视频高度:', e.target.videoHeight);
                if (e.target.videoWidth === 0 || e.target.videoHeight === 0) {
                  console.warn('⚠️ 检测到可能的纯音频文件或视频流损坏');
                }
              }}
              onCanPlay={() => {
                console.log('✅ 视频可以开始播放');
              }}
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