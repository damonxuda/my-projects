// 游戏通用工具函数

class GameUtils {
  // 时间格式化
  static formatTime(milliseconds) {
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    const sec = seconds % 60;
    const min = minutes % 60;
    
    const pad = (num) => (num < 10 ? '0' + num : String(num));
    
    if (hours > 0) {
      return `${pad(hours)}:${pad(min)}:${pad(sec)}`;
    }
    return `${pad(min)}:${pad(sec)}`;
  }

  // 防抖函数
  static debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  // 节流函数
  static throttle(func, limit) {
    let inThrottle;
    return function(...args) {
      if (!inThrottle) {
        func.apply(this, args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    };
  }

  // 触觉反馈（移动设备）
  static vibrate(pattern = 50) {
    if (navigator.vibrate) {
      navigator.vibrate(pattern);
    }
  }

  // 检查是否为移动设备
  static isMobile() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  }

  // 检查是否为触摸设备
  static isTouchDevice() {
    return ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
  }

  // 全屏功能
  static requestFullscreen(element = document.documentElement) {
    if (element.requestFullscreen) {
      element.requestFullscreen();
    } else if (element.webkitRequestFullscreen) {
      element.webkitRequestFullscreen();
    } else if (element.mozRequestFullScreen) {
      element.mozRequestFullScreen();
    } else if (element.msRequestFullscreen) {
      element.msRequestFullscreen();
    }
  }

  // 退出全屏
  static exitFullscreen() {
    if (document.exitFullscreen) {
      document.exitFullscreen();
    } else if (document.webkitExitFullscreen) {
      document.webkitExitFullscreen();
    } else if (document.mozCancelFullScreen) {
      document.mozCancelFullScreen();
    } else if (document.msExitFullscreen) {
      document.msExitFullscreen();
    }
  }

  // 生成随机ID
  static generateId(length = 8) {
    return Math.random().toString(36).substring(2, 2 + length);
  }

  // 深拷贝对象
  static deepClone(obj) {
    if (obj === null || typeof obj !== 'object') return obj;
    if (obj instanceof Date) return new Date(obj.getTime());
    if (obj instanceof Array) return obj.map(item => GameUtils.deepClone(item));
    if (typeof obj === 'object') {
      const copy = {};
      Object.keys(obj).forEach(key => {
        copy[key] = GameUtils.deepClone(obj[key]);
      });
      return copy;
    }
  }
}

// Web环境下的导出
if (typeof module !== 'undefined' && module.exports) {
  module.exports = GameUtils;
} else if (typeof window !== 'undefined') {
  window.GameUtils = GameUtils;
}