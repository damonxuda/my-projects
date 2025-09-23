import React, { useState, useEffect } from 'react';
import { X, Play, Download } from 'lucide-react';
import { useAuth } from '../../../auth-clerk/src';

const VideoPlayer = ({ video, apiUrl, processingApiUrl, onClose }) => {
  const [videoUrl, setVideoUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isRecoding, setIsRecoding] = useState(false);
  const [recodingProgress, setRecodingProgress] = useState('');
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

        const token = await getCachedToken();

        const requestUrl = `${apiUrl}/play/url/${encodeURIComponent(video.key)}`;

        const response = await fetch(requestUrl, {
          headers: { Authorization: `Bearer ${token}` }
        });


        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`获取视频URL失败: ${response.status} ${response.statusText}`);
        }

        const responseText = await response.text();

        // 检查响应是否是HTML而不是JSON
        if (responseText.trim().startsWith('<!DOCTYPE') || responseText.trim().startsWith('<html')) {
          console.error('❌ VideoPlayer - 收到HTML响应而非JSON:', responseText.substring(0, 500));
          throw new Error('视频服务返回HTML页面而非JSON数据，请检查API端点配置');
        }

        let data;
        try {
          data = JSON.parse(responseText);
        } catch (parseError) {
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
    setIsRecoding(false);
    setRecodingProgress('');
  }, [video?.key]);

  // 检测移动端设备
  const isMobile = () => {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  };

  // 重编码视频为移动端兼容格式
  const reencodeVideoForMobile = async () => {
    try {
      setIsRecoding(true);
      setError('');
      setRecodingProgress('正在为移动端重新编码视频，请稍候...');


      const token = await getCachedToken();
      const reencodeUrl = `${processingApiUrl}/process/video`;


      const response = await fetch(reencodeUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          inputKey: video.key
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`重编码失败: ${response.status} ${errorText}`);
      }

      const result = await response.json();

      if (result.success && result.recodedUrl) {
        setVideoUrl(result.recodedUrl);
        setRecodingProgress(result.cached ?
          '使用已有的移动端兼容版本' :
          '重编码完成，正在加载移动端兼容版本...'
        );
      } else {
        throw new Error('重编码响应中缺少视频URL');
      }

    } catch (err) {
      setError(`重编码失败: ${err.message}`);
      setRecodingProgress('');
    } finally {
      setIsRecoding(false);
    }
  };

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
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={() => window.location.reload()}
                className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
              >
                重试
              </button>
              {isMobile() && error.includes('格式不兼容') && (
                <button
                  onClick={reencodeVideoForMobile}
                  disabled={isRecoding}
                  className="px-6 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:bg-gray-400"
                >
                  {isRecoding ? '处理中...' : '重编码为移动端格式'}
                </button>
              )}
            </div>
          </div>
        )}

        {isRecoding && (
          <div className="text-center py-12">
            <div className="loading-spinner h-12 w-12 mx-auto"></div>
            <p className="mt-4 text-blue-600">{recodingProgress}</p>
            <p className="text-sm text-gray-500 mt-2">
              重编码可能需要几分钟时间，请保持页面打开
            </p>
          </div>
        )}

        {videoUrl && !loading && !error && (
          <div className="space-y-6">
            <video
              src={videoUrl}
              controls
              className="responsive-video"
              onError={(e) => {
                const errorCode = e.target.error?.code;

                // 如果是移动端且错误代码是4（格式错误），提示重编码
                if (isMobile() && errorCode === 4) {
                  setError(`移动端播放格式不兼容 (错误代码: ${errorCode})`);
                } else {
                  setError(`视频播放失败 (错误代码: ${errorCode || 'unknown'})`);
                }
              }}
              onLoadedMetadata={(e) => {
                if (e.target.videoWidth === 0 || e.target.videoHeight === 0) {
                  console.warn('⚠️ 检测到可能的纯音频文件或视频流损坏');
                }
              }}
              onCanPlay={() => {}}
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