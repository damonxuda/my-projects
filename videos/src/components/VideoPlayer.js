import React, { useState, useEffect, useRef } from 'react';
import { X, Play, Download } from 'lucide-react';
import { useAuth } from '../../../auth-clerk/src';
import { SubtitlePlayer } from './subtitle';

const VideoPlayer = ({ video, apiUrl, processingApiUrl, onClose }) => {
  const [videoUrl, setVideoUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isRecoding, setIsRecoding] = useState(false);
  const [recodingProgress, setRecodingProgress] = useState('');
  const [currentPlayingKey, setCurrentPlayingKey] = useState(''); // 追踪当前正在播放的文件
  const { getCachedToken, isSignedIn } = useAuth();
  const videoRef = useRef(null); // 视频元素引用，用于字幕控制

  // 本地缓存，避免重复检查mobile版本
  const [mobileVersionCache] = useState(new Map());

  // 快速检查文件是否存在（使用GET请求，因为Lambda Function URL不支持HEAD）
  const quickCheckExists = async (videoKey) => {
    // 先查缓存
    if (mobileVersionCache.has(videoKey)) {
      console.log(`📋 缓存命中: ${videoKey} = ${mobileVersionCache.get(videoKey)}`);
      return mobileVersionCache.get(videoKey);
    }

    try {
      const token = await getCachedToken();
      const checkUrl = `${apiUrl}/play/url/${encodeURIComponent(videoKey)}`;

      // 使用GET请求检查，但不下载内容
      const response = await fetch(checkUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Range': 'bytes=0-0' // 只请求第一个字节，减少流量
        }
      });

      const exists = response.ok;
      mobileVersionCache.set(videoKey, exists);
      console.log(`🔍 文件存在检查: ${videoKey} = ${exists}`);
      return exists;
    } catch (error) {
      console.log(`❌ 文件存在检查失败: ${videoKey}`, error);
      mobileVersionCache.set(videoKey, false);
      return false;
    }
  };

  // 效率优先版本选择：总是先播放用户点击的文件
  const selectVideoVersion = (originalKey) => {
    console.log(`🎯 效率优先策略: ${originalKey}`);

    // 规则1: 如果点击的是mobile文件，直接返回mobile版本
    if (originalKey.includes('_mobile.mp4')) {
      console.log('✅ 用户点击mobile版本，直接播放');
      return originalKey;
    }

    // 规则2: 否则总是先尝试播放原文件（效率优先）
    console.log('💻 优先尝试播放原文件（90%成功率）');
    return originalKey;
  };

  // 智能播放逻辑 - 增强版实现
  useEffect(() => {
    const smartLoadVideoUrl = async () => {
      // 防止重复请求：如果已经有URL且是相同视频，直接返回
      if (videoUrl) {
        return;
      }

      try {
        setLoading(true);
        setError('');

        const token = await getCachedToken();

        // 对于原文件，尝试使用智能端点获取全面信息
        if (!video.key.includes('_mobile.mp4')) {
          console.log('🧠 尝试智能分析端点');
          try {
            const smartUrl = `${apiUrl}/play/smart/${encodeURIComponent(video.key)}`;
            const smartResponse = await fetch(smartUrl, {
              headers: { Authorization: `Bearer ${token}` }
            });

            if (smartResponse.ok) {
              const smartData = await smartResponse.json();
              console.log('🎯 智能分析结果:', smartData);

              // 根据分析结果选择播放策略
              const recommendation = smartData.recommendation;
              let selectedUrl = smartData.original.url;
              let selectedKey = smartData.original.key;

              // 如果是移动端且建议使用mobile版本
              if (isMobile() && recommendation.strategy === 'mobile_preferred' && smartData.mobile.exists) {
                selectedUrl = smartData.mobile.url;
                selectedKey = smartData.mobile.key;
                console.log('📱 移动端优先选择mobile版本');
              } else {
                console.log('💻 选择原文件播放');
              }

              setCurrentPlayingKey(selectedKey);
              setVideoUrl(selectedUrl);

              // 将智能分析数据存储起来，以便错误处理时使用
              window._videoSmartData = smartData;
              return;
            }
          } catch (smartError) {
            console.log('⚠️  智能端点失败，回退到标准方式:', smartError.message);
          }
        }

        // 回退到标准播放逻辑
        console.log('🔄 使用标准播放逻辑');
        const videoKeyToLoad = selectVideoVersion(video.key);
        console.log(`🎯 标准选择播放版本: ${videoKeyToLoad}`);
        setCurrentPlayingKey(videoKeyToLoad);

        const requestUrl = `${apiUrl}/play/url/${encodeURIComponent(videoKeyToLoad)}`;
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
      smartLoadVideoUrl();
    }
  }, [video?.key, isSignedIn, apiUrl]);

  // 当video改变时重置所有状态
  useEffect(() => {
    setVideoUrl('');
    setError('');
    setIsRecoding(false);
    setRecodingProgress('');
    setCurrentPlayingKey(''); // 重置当前播放的文件
  }, [video?.key]);

  // 检测移动端设备
  const isMobile = () => {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  };

  // 使用MediaConvert转换视频为移动端兼容格式
  const reencodeVideoForMobile = async () => {
    try {
      setIsRecoding(true);
      setError('');
      setRecodingProgress('正在启动MediaConvert转换任务...');

      const token = await getCachedToken();

      // 使用FORMAT_CONVERTER_LAMBDA进行转换
      const FORMAT_CONVERTER_URL = process.env.REACT_APP_FORMAT_CONVERTER_API_URL;
      const convertUrl = `${FORMAT_CONVERTER_URL}/convert/process/${encodeURIComponent(video.key)}`;

      console.log(`🔄 启动视频转换: ${convertUrl}`);

      const response = await fetch(convertUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          inputKey: video.key,
          outputPrefix: 'videos', // 输出到相同目录
          settings: {
            quality: 'standard',
            format: 'mp4',
            resolution: '720p',
            enableMobile: true
          }
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`启动转换失败: ${response.status} ${errorText}`);
      }

      const result = await response.json();
      console.log('✅ MediaConvert任务已启动:', result);

      if (result.success && result.jobId) {
        setRecodingProgress(`MediaConvert任务已启动 (ID: ${result.jobId})`);

        // 轮询转换状态
        pollConversionStatus(result.jobId, token, FORMAT_CONVERTER_URL);
      } else {
        throw new Error('转换任务启动失败');
      }

    } catch (err) {
      console.error('❌ 转换失败:', err);
      setError(`转换失败: ${err.message}`);
      setRecodingProgress('');
      setIsRecoding(false);
    }
  };

  // 轮询转换状态
  const pollConversionStatus = async (jobId, token, baseUrl, attempts = 0) => {
    const maxAttempts = 60; // 最多查询60次（约15分钟）

    if (attempts >= maxAttempts) {
      setError('转换超时，请稍后手动检查');
      setIsRecoding(false);
      return;
    }

    try {
      const statusUrl = `${baseUrl}/convert/status/${jobId}`;
      const response = await fetch(statusUrl, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const status = await response.json();
        console.log(`📊 转换状态 (${attempts + 1}/${maxAttempts}):`, status);

        if (status.status === 'COMPLETE') {
          setRecodingProgress('转换完成，正在加载优化版本...');

          // 转换完成，尝试加载mobile版本
          const mobileKey = video.key.replace('.mp4', '_mobile.mp4');

          // 清除缓存，重新检查mobile版本
          mobileVersionCache.delete(mobileKey);

          if (await quickCheckExists(mobileKey)) {
            // 加载mobile版本
            const videoToken = await getCachedToken();
            const requestUrl = `${apiUrl}/play/url/${encodeURIComponent(mobileKey)}`;
            const videoResponse = await fetch(requestUrl, {
              headers: { Authorization: `Bearer ${videoToken}` }
            });

            if (videoResponse.ok) {
              const data = await videoResponse.json();
              if (data.url) {
                console.log('🎉 转换完成，切换到mobile版本');
                setVideoUrl(data.url);
                setRecodingProgress('');
                setIsRecoding(false);
                return;
              }
            }
          }

          throw new Error('转换完成但无法加载优化版本');
        } else if (status.status === 'ERROR') {
          throw new Error(`转换失败: ${status.message || '未知错误'}`);
        } else {
          // 继续轮询
          setRecodingProgress(`转换中... (状态: ${status.status})`);
          setTimeout(() => {
            pollConversionStatus(jobId, token, baseUrl, attempts + 1);
          }, 15000); // 15秒后再次查询
        }
      } else {
        throw new Error(`状态查询失败: ${response.status}`);
      }
    } catch (err) {
      console.error('❌ 状态查询错误:', err);
      setError(`转换状态查询失败: ${err.message}`);
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
              {error.includes('格式不兼容') && (
                <button
                  onClick={reencodeVideoForMobile}
                  disabled={isRecoding}
                  className="px-6 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:bg-gray-400"
                >
                  {isRecoding ? '处理中...' : '重新编码为兼容格式'}
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
              ref={videoRef}
              src={videoUrl}
              controls
              className="responsive-video"
              onError={async (e) => {
                const errorCode = e.target.error?.code;
                console.log(`❌ 视频播放错误: 代码=${errorCode}, 当前播放: ${currentPlayingKey || video.key}`);

                // 智能错误恢复逻辑
                if (errorCode === 4) {
                  // H.264编码不兼容，尝试使用fallback策略
                  const mobileKey = video.key.replace('.mp4', '_mobile.mp4');

                  // 如果当前播放的已经是mobile版本，说明mobile版本也有问题
                  if (currentPlayingKey.includes('_mobile.mp4')) {
                    setError(`优化版本播放失败 (错误代码: ${errorCode})`);
                    return;
                  }

                  console.log('🚨 播放失败，尝试智能fallback...');

                  // 优先使用智能分析数据（如果可用）
                  const smartData = window._videoSmartData;
                  if (smartData && smartData.mobile.exists) {
                    console.log('💡 使用智能分析数据进行快速fallback');
                    try {
                      setLoading(true);
                      setError('');
                      console.log('🎯 快速切换到mobile版本');
                      setCurrentPlayingKey(smartData.mobile.key);
                      setVideoUrl(smartData.mobile.url);
                      return;
                    } catch (quickSwitchError) {
                      console.error('❌ 快速切换失败:', quickSwitchError);
                      setLoading(false);
                    }
                  }

                  // 回退到传统检查方式
                  if (await quickCheckExists(mobileKey)) {
                    console.log('✅ 找到mobile版本，自动切换播放');
                    try {
                      setLoading(true);
                      setError('');
                      const token = await getCachedToken();
                      const requestUrl = `${apiUrl}/play/url/${encodeURIComponent(mobileKey)}`;
                      const response = await fetch(requestUrl, {
                        headers: { Authorization: `Bearer ${token}` }
                      });

                      if (response.ok) {
                        const data = await response.json();
                        if (data.url) {
                          console.log('🎯 自动切换到mobile版本成功');
                          setCurrentPlayingKey(mobileKey);
                          setVideoUrl(data.url);
                          return;
                        }
                      }
                    } catch (autoSwitchError) {
                      console.error('❌ 自动切换到mobile版本失败:', autoSwitchError);
                    } finally {
                      setLoading(false);
                    }
                  }

                  // 没有mobile版本，提示用户转换
                  setError(`播放格式不兼容，需要重新编码 (错误代码: ${errorCode})`);
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

            {/* 字幕控制组件 */}
            <SubtitlePlayer
              videoKey={video.key}
              videoRef={videoRef}
              apiUrl={process.env.REACT_APP_SUBTITLE_API_URL || apiUrl}
              getToken={getCachedToken}
            />

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