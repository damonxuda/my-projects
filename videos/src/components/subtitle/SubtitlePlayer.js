import React, { useState, useEffect, useRef } from 'react';
import { Languages, Loader } from 'lucide-react';

// 辅助函数：获取语言显示名称
function getLanguageLabel(lang) {
  const labels = {
    'ja-JP': '日语',
    'en-US': '英语',
    'zh-CN': '中文',
    'ko-KR': '韩语',
    'fr-FR': '法语',
    'de-DE': '德语',
    'es-ES': '西班牙语',
    'it-IT': '意大利语',
    'pt-BR': '葡萄牙语',
    'ru-RU': '俄语'
  };
  return labels[lang] || lang;
}

const SubtitlePlayer = ({
  videoKey,
  videoRef,
  apiUrl,
  getToken
}) => {
  const [subtitles, setSubtitles] = useState({});
  const [currentSubtitle, setCurrentSubtitle] = useState('none');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // 加载字幕文件列表
  useEffect(() => {
    if (videoKey && apiUrl) {
      loadSubtitles();
    }
  }, [videoKey]);

  const loadSubtitles = async () => {
    setLoading(true);
    setError('');

    try {
      const token = await getToken();
      const response = await fetch(
        `${apiUrl}/subtitles/list?videoKey=${encodeURIComponent(videoKey)}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.ok) {
        if (response.status === 404) {
          // 没有字幕文件，这是正常情况
          setSubtitles({});
          return;
        }
        throw new Error('Failed to load subtitles');
      }

      const data = await response.json();
      setSubtitles(data.subtitles || {});

      // 如果有字幕，默认选中中文字幕
      if (data.subtitles && Object.keys(data.subtitles).length > 0) {
        if (data.subtitles['zh-CN']) {
          setCurrentSubtitle('zh-CN');
        } else {
          // 选择第一个可用的字幕
          setCurrentSubtitle(Object.keys(data.subtitles)[0]);
        }
      }

    } catch (err) {
      console.error('Failed to load subtitles:', err);
      setError('');  // 静默处理错误，不干扰视频播放
      setSubtitles({});
    } finally {
      setLoading(false);
    }
  };

  // 添加字幕轨道到video元素
  useEffect(() => {
    if (!videoRef || !videoRef.current || !subtitles || Object.keys(subtitles).length === 0) {
      return;
    }

    const video = videoRef.current;

    // 移除旧的track元素
    const existingTracks = video.querySelectorAll('track');
    existingTracks.forEach(track => track.remove());

    // 添加新的track元素
    Object.keys(subtitles).forEach((lang) => {
      const track = document.createElement('track');
      track.kind = 'subtitles';
      track.src = subtitles[lang];
      track.srclang = lang;
      track.label = getLanguageLabel(lang);

      if (lang === currentSubtitle) {
        track.default = true;
      }

      video.appendChild(track);
    });

    console.log('✅ 字幕轨道已添加:', Object.keys(subtitles));
  }, [subtitles, videoRef]);

  // 切换字幕
  const changeSubtitle = (lang) => {
    setCurrentSubtitle(lang);

    // 更新video标签的字幕轨道
    if (videoRef && videoRef.current) {
      const tracks = videoRef.current.textTracks;
      for (let i = 0; i < tracks.length; i++) {
        if (lang === 'none') {
          tracks[i].mode = 'disabled';
        } else if (tracks[i].language === lang) {
          tracks[i].mode = 'showing';
        } else {
          tracks[i].mode = 'hidden';
        }
      }
    }
  };

  const availableSubtitles = Object.keys(subtitles);

  // 如果没有字幕，不显示控制器
  if (availableSubtitles.length === 0 && !loading) {
    return null;
  }

  return (
    <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
      <div className="flex items-center gap-3">
        <Languages className="text-purple-600" size={20} />
        <span className="text-sm font-medium text-gray-700">字幕控制:</span>

        {loading && (
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Loader className="animate-spin" size={16} />
            <span>加载中...</span>
          </div>
        )}

        {!loading && availableSubtitles.length > 0 && (
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => changeSubtitle('none')}
              className={`px-3 py-1 text-sm rounded-md transition-colors ${
                currentSubtitle === 'none'
                  ? 'bg-purple-600 text-white'
                  : 'bg-white border border-gray-300 text-gray-700 hover:border-purple-300'
              }`}
            >
              无字幕
            </button>

            {availableSubtitles.map((lang) => {
              const label = getLanguageLabel(lang);
              return (
                <button
                  key={lang}
                  onClick={() => changeSubtitle(lang)}
                  className={`px-3 py-1 text-sm rounded-md transition-colors ${
                    currentSubtitle === lang
                      ? 'bg-purple-600 text-white'
                      : 'bg-white border border-gray-300 text-gray-700 hover:border-purple-300'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        )}

        {!loading && availableSubtitles.length === 0 && (
          <span className="text-sm text-gray-500">此视频暂无字幕</span>
        )}
      </div>
    </div>
  );
};

export default SubtitlePlayer;
