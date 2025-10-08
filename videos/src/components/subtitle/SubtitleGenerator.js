import React, { useState, useEffect } from 'react';
import { X, Languages, Loader } from 'lucide-react';

const SubtitleGenerator = ({
  onClose,
  currentPath,
  fileApiUrl,
  subtitleApiUrl,
  getToken
}) => {
  const [videos, setVideos] = useState([]);
  const [selectedVideos, setSelectedVideos] = useState(new Map()); // videoKey -> { language, selected }
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');
  const [progress, setProgress] = useState({ current: 0, total: 0, message: '' });

  // 加载当前目录的视频列表
  useEffect(() => {
    loadVideos();
  }, [currentPath]);

  const loadVideos = async () => {
    setLoading(true);
    setError('');

    try {
      console.log('🔍 SubtitleGenerator API URLs:', { fileApiUrl, subtitleApiUrl, currentPath });

      if (!fileApiUrl) {
        throw new Error('FILE_MANAGEMENT_API_URL 未配置');
      }
      if (!subtitleApiUrl) {
        throw new Error('SUBTITLE_API_URL 未配置');
      }

      const token = await getToken();

      // 1. 加载当前目录的文件列表
      const response = await fetch(
        `${fileApiUrl}/files/list?path=${encodeURIComponent(currentPath)}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      console.log('📂 File list response status:', response.status);

      if (!response.ok) {
        throw new Error('Failed to load videos');
      }

      const data = await response.json();
      console.log('📂 File list data:', data.length, 'items');

      // 2. 过滤出视频文件 - 通过文件扩展名判断
      const videoFiles = data.filter(item => {
        // 获取文件名（从 Key 或 name 字段）
        const fileName = item.name || item.Key || '';
        const isVideo = /\.(mp4|avi|mov|wmv|mkv)$/i.test(fileName);
        // 排除文件夹
        const isFolder = item.type === 'folder' || fileName.endsWith('/');
        return isVideo && !isFolder;
      });
      console.log('🎬 Video files found:', videoFiles.length);

      // 3. 规范化视频对象结构
      const normalizedVideos = videoFiles.map(item => ({
        key: item.Key || item.key,
        name: (item.name || item.Key || '').split('/').pop(),
        size: item.Size || item.size || 0,
        type: 'video'
      }));

      console.log('📹 Normalized videos:', normalizedVideos.map(v => v.name));

      // 4. 检查每个视频是否已有字幕
      const videosWithSubtitleInfo = await Promise.all(
        normalizedVideos.map(async (video) => {
          try {
            const subtitleResponse = await fetch(
              `${subtitleApiUrl}/subtitles/list?videoKey=${encodeURIComponent(video.key)}`,
              {
                headers: {
                  'Authorization': `Bearer ${token}`,
                  'Content-Type': 'application/json'
                }
              }
            );

            if (subtitleResponse.ok) {
              const subtitleData = await subtitleResponse.json();
              const subtitles = subtitleData.subtitles || {};

              // 检测有哪些语言的字幕
              const hasSubtitles = Object.keys(subtitles).map(lang => {
                // 语言代码映射 - 支持常用语言
                const langMap = {
                  'ja-JP': '日', 'ja': '日',
                  'en-US': '英', 'en': '英', 'en-GB': '英',
                  'zh-CN': '中', 'zh': '中', 'zh-TW': '繁',
                  'ko-KR': '韩', 'ko': '韩',
                  'fr-FR': '法', 'fr': '法',
                  'de-DE': '德', 'de': '德',
                  'es-ES': '西', 'es': '西',
                  'it-IT': '意', 'it': '意',
                  'pt-BR': '葡', 'pt': '葡',
                  'ru-RU': '俄', 'ru': '俄',
                  'ar-SA': '阿', 'ar': '阿',
                  'hi-IN': '印', 'hi': '印',
                  'th-TH': '泰', 'th': '泰',
                  'vi-VN': '越', 'vi': '越'
                };
                return langMap[lang] || lang.split('-')[0].toUpperCase();
              });

              return {
                ...video,
                hasSubtitles: hasSubtitles.length > 0,
                subtitleLanguages: hasSubtitles
              };
            }
          } catch (err) {
            // 如果查询字幕失败，认为没有字幕
            console.log(`No subtitles for ${video.name}`);
          }

          return {
            ...video,
            hasSubtitles: false,
            subtitleLanguages: []
          };
        })
      );

      setVideos(videosWithSubtitleInfo);
    } catch (err) {
      console.error('Failed to load videos:', err);
      setError('加载视频列表失败: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // 切换视频选择状态
  const toggleVideoSelection = (video) => {
    const newSelected = new Map(selectedVideos);
    if (newSelected.has(video.key)) {
      newSelected.delete(video.key);
    } else {
      newSelected.set(video.key, {
        videoKey: video.key,
        videoName: video.name,
        selected: true,
        startTime: '00:00:00',
        endTime: ''
      });
    }
    setSelectedVideos(newSelected);
  };

  // 更新视频时间范围
  const updateVideoTime = (videoKey, field, value) => {
    const newSelected = new Map(selectedVideos);
    const video = newSelected.get(videoKey);
    if (video) {
      newSelected.set(videoKey, {
        ...video,
        [field]: value
      });
      setSelectedVideos(newSelected);
    }
  };

  // 开始生成字幕
  const startGeneration = async () => {
    if (selectedVideos.size === 0) {
      alert('请至少选择一个视频');
      return;
    }

    setProcessing(true);
    setProgress({ current: 0, total: selectedVideos.size, message: '正在启动字幕生成...' });

    try {
      const token = await getToken();
      const videosArray = Array.from(selectedVideos.values());

      for (let i = 0; i < videosArray.length; i++) {
        const video = videosArray[i];
        setProgress({
          current: i + 1,
          total: videosArray.length,
          message: `正在处理: ${video.videoName}`
        });

        // 调用subtitle-trigger Lambda（自动语言识别）
        const response = await fetch(`${subtitleApiUrl}/subtitles/generate`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            videoKey: video.videoKey,
            startTime: video.startTime || '00:00:00',
            endTime: video.endTime || ''
          })
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`Failed to generate subtitle for ${video.videoName}:`, errorText);
          // 继续处理下一个视频
        }
      }

      setProgress({
        current: videosArray.length,
        total: videosArray.length,
        message: '所有字幕任务已启动！字幕生成需要5-15分钟，请稍后刷新查看。'
      });

      setTimeout(() => {
        onClose();
      }, 3000);

    } catch (err) {
      console.error('Subtitle generation failed:', err);
      setError('字幕生成失败: ' + err.message);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Languages className="text-purple-600" size={28} />
            <div>
              <h2 className="text-2xl font-bold text-gray-900">生成字幕</h2>
              <p className="text-sm text-gray-600 mt-1">
                选择视频，系统将自动识别语言并生成原语言字幕和中文翻译
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={processing}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors disabled:opacity-50"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading && (
            <div className="text-center py-12">
              <Loader className="animate-spin mx-auto mb-4 text-purple-600" size={48} />
              <p className="text-gray-600">正在加载视频列表...</p>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
              <p className="text-red-800">{error}</p>
            </div>
          )}

          {!loading && !processing && videos.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-600">当前目录没有视频文件</p>
            </div>
          )}

          {!loading && !processing && videos.length > 0 && (
            <div>
              <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-800">
                  📁 当前目录: <span className="font-semibold">{currentPath || '根目录'}</span>
                </p>
                <p className="text-sm text-blue-800 mt-2">
                  🤖 自动语言识别: 系统会自动识别视频语言（支持37种语言）
                </p>
                <p className="text-sm text-blue-800 mt-1">
                  💡 提示: 已有字幕的视频会显示语言标记，可以重新生成覆盖
                </p>
              </div>

              <div className="space-y-3">
                {videos.map((video) => {
                  const isSelected = selectedVideos.has(video.key);

                  return (
                    <div
                      key={video.key}
                      className={`border rounded-lg p-4 transition-all ${
                        isSelected
                          ? 'border-purple-500 bg-purple-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-start gap-4">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleVideoSelection(video)}
                          className="mt-1 h-5 w-5 text-purple-600 rounded"
                        />

                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h3 className="font-medium text-gray-900">{video.name}</h3>
                            {video.hasSubtitles && (
                              <div className="flex gap-1">
                                {video.subtitleLanguages.map((lang) => (
                                  <span
                                    key={lang}
                                    className="px-2 py-0.5 bg-green-100 text-green-700 text-xs font-medium rounded"
                                  >
                                    {lang}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                          <p className="text-sm text-gray-500 mt-1">
                            大小: {(video.size / (1024 * 1024)).toFixed(1)} MB
                          </p>

                          {isSelected && (
                            <div className="mt-3 p-3 bg-white border border-purple-200 rounded-lg">
                              <label className="block text-sm font-medium text-gray-700 mb-2">
                                字幕时间范围（可选）
                              </label>
                              <div className="flex items-center gap-3">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm text-gray-600">起始:</span>
                                  <input
                                    type="text"
                                    placeholder="00:00:00"
                                    value={selectedVideos.get(video.key)?.startTime || '00:00:00'}
                                    onChange={(e) => updateVideoTime(video.key, 'startTime', e.target.value)}
                                    className="w-24 px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                                    pattern="[0-9]{2}:[0-9]{2}:[0-9]{2}"
                                  />
                                </div>
                                <span className="text-gray-400">→</span>
                                <div className="flex items-center gap-2">
                                  <span className="text-sm text-gray-600">结束:</span>
                                  <input
                                    type="text"
                                    placeholder="留空表示到结尾"
                                    value={selectedVideos.get(video.key)?.endTime || ''}
                                    onChange={(e) => updateVideoTime(video.key, 'endTime', e.target.value)}
                                    className="w-24 px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                                    pattern="[0-9]{2}:[0-9]{2}:[0-9]{2}"
                                  />
                                </div>
                              </div>
                              <p className="text-xs text-gray-500 mt-2">
                                格式: HH:MM:SS（例如：00:00:30 表示30秒，01:25:00 表示1小时25分）
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {processing && (
            <div className="text-center py-12">
              <Loader className="animate-spin mx-auto mb-4 text-purple-600" size={48} />
              <p className="text-gray-900 font-medium mb-2">{progress.message}</p>
              <p className="text-gray-600">
                进度: {progress.current} / {progress.total}
              </p>
              <div className="mt-4 max-w-md mx-auto">
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-purple-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${(progress.current / progress.total) * 100}%` }}
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {!loading && !processing && videos.length > 0 && (
          <div className="p-6 border-t bg-gray-50">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-600">
                已选择 <span className="font-semibold text-purple-600">{selectedVideos.size}</span> 个视频
              </div>
              <div className="flex gap-3">
                <button
                  onClick={onClose}
                  className="px-6 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={startGeneration}
                  disabled={selectedVideos.size === 0}
                  className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  开始生成字幕
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SubtitleGenerator;
