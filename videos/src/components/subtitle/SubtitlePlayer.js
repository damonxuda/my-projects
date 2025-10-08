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
  const [translating, setTranslating] = useState(false);

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

      // 给所有字幕URL添加token参数（track元素无法发送Authorization header）
      const subtitlesWithToken = {};
      if (data.subtitles) {
        for (const [lang, url] of Object.entries(data.subtitles)) {
          subtitlesWithToken[lang] = `${url}&token=${encodeURIComponent(token)}`;
        }
      }

      setSubtitles(subtitlesWithToken);

      // 如果有字幕，默认选中中文字幕
      if (subtitlesWithToken && Object.keys(subtitlesWithToken).length > 0) {
        if (subtitlesWithToken['zh-CN']) {
          setCurrentSubtitle('zh-CN');
        } else {
          // 选择第一个可用的字幕
          setCurrentSubtitle(Object.keys(subtitlesWithToken)[0]);
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
    Object.keys(subtitles).forEach((lang, index) => {
      const track = document.createElement('track');
      track.kind = 'subtitles';
      track.src = subtitles[lang];
      track.srclang = lang;
      track.label = getLanguageLabel(lang);

      // 监听track加载事件
      track.addEventListener('load', () => {
        console.log(`✅ Track ${lang} 加载成功, cues:`, track.track.cues?.length || 0);

        // 加载成功后，设置正确的mode
        const textTrack = video.textTracks[index];
        if (textTrack) {
          if (lang === currentSubtitle) {
            textTrack.mode = 'showing';
            console.log(`🎯 自动激活字幕: ${lang}`);
          } else {
            textTrack.mode = 'hidden';
          }
        }
      });

      track.addEventListener('error', (e) => {
        console.error(`❌ Track ${lang} 加载失败:`, e);
      });

      video.appendChild(track);
    });

    console.log('✅ 字幕轨道已添加:', Object.keys(subtitles));
  }, [subtitles, videoRef]);

  // 切换字幕
  const changeSubtitle = (lang) => {
    console.log('🎯 切换字幕:', lang);
    setCurrentSubtitle(lang);

    // 更新video标签的字幕轨道
    if (videoRef && videoRef.current) {
      const tracks = videoRef.current.textTracks;
      console.log('📊 总共有', tracks.length, '个字幕轨道');

      for (let i = 0; i < tracks.length; i++) {
        console.log(`轨道 ${i}:`, {
          language: tracks[i].language,
          label: tracks[i].label,
          kind: tracks[i].kind,
          mode: tracks[i].mode
        });

        if (lang === 'none') {
          tracks[i].mode = 'disabled';
        } else if (tracks[i].language === lang) {
          console.log('✅ 匹配到字幕轨道，设置为showing');
          tracks[i].mode = 'showing';
        } else {
          tracks[i].mode = 'hidden';
        }

        console.log(`轨道 ${i} 更新后 mode:`, tracks[i].mode);
      }
    }
  };

  // 重新翻译字幕（使用Claude）
  const retranslateSubtitle = async () => {
    // 找到原语言字幕（非中文的第一个字幕）
    const sourceLang = Object.keys(subtitles).find(lang => lang !== 'zh-CN');
    if (!sourceLang) {
      alert('没有找到原语言字幕');
      return;
    }

    if (!window.confirm(`确定要使用Claude重新翻译${getLanguageLabel(sourceLang)}字幕吗？这将替换现有的中文字幕。`)) {
      return;
    }

    setTranslating(true);
    setError('');

    try {
      const token = await getToken();
      const response = await fetch(`${apiUrl}/subtitles/translate`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          videoKey,
          sourceLang
        })
      });

      if (!response.ok) {
        throw new Error('翻译失败');
      }

      const result = await response.json();
      console.log('✅ 翻译成功:', result);
      alert('翻译完成！正在重新加载字幕...');

      // 重新加载字幕列表
      await loadSubtitles();

      // 自动切换到中文字幕
      setCurrentSubtitle('zh-CN');

    } catch (err) {
      console.error('翻译失败:', err);
      alert('翻译失败: ' + err.message);
    } finally {
      setTranslating(false);
    }
  };

  const availableSubtitles = Object.keys(subtitles);

  // 如果没有字幕，不显示控制器
  if (availableSubtitles.length === 0 && !loading) {
    return null;
  }

  return (
    <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
      <div className="flex items-center gap-3 flex-wrap">
        <Languages className="text-purple-600" size={20} />
        <span className="text-sm font-medium text-gray-700">字幕控制:</span>

        {loading && (
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Loader className="animate-spin" size={16} />
            <span>加载中...</span>
          </div>
        )}

        {!loading && availableSubtitles.length > 0 && (
          <>
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

            {/* 重新翻译按钮 - 仅当有原语言字幕时显示 */}
            {availableSubtitles.some(lang => lang !== 'zh-CN') && (
              <button
                onClick={retranslateSubtitle}
                disabled={translating}
                className={`px-3 py-1 text-sm rounded-md transition-colors ${
                  translating
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-blue-500 text-white hover:bg-blue-600'
                }`}
              >
                {translating ? (
                  <span className="flex items-center gap-2">
                    <Loader className="animate-spin" size={14} />
                    翻译中...
                  </span>
                ) : (
                  `🔄 重新翻译为中文`
                )}
              </button>
            )}
          </>
        )}

        {!loading && availableSubtitles.length === 0 && (
          <span className="text-sm text-gray-500">此视频暂无字幕</span>
        )}
      </div>
    </div>
  );
};

export default SubtitlePlayer;
