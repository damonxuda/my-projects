// 用户状态显示组件
// 在游戏界面显示当前用户身份和存储状态

class UserStatusWidget {
  constructor(storage, containerId = 'user-status-widget') {
    this.storage = storage;
    this.containerId = containerId;
    this.widget = null;
    this.updateInterval = null;
  }

  // 创建并显示用户状态组件
  create() {
    this.widget = document.createElement('div');
    this.widget.id = this.containerId;
    this.widget.className = 'user-status-widget';
    
    // 添加CSS样式
    this.addStyles();
    
    // 更新内容
    this.updateContent();
    
    // 定期更新状态（处理登录状态变化）
    this.startAutoUpdate();
    
    return this.widget;
  }

  // 添加到指定容器
  appendTo(parentElement) {
    if (!this.widget) {
      this.create();
    }
    
    if (typeof parentElement === 'string') {
      parentElement = document.getElementById(parentElement);
    }
    
    if (parentElement) {
      parentElement.appendChild(this.widget);
    }
  }

  // 更新用户状态显示
  updateContent() {
    if (!this.widget) return;

    const status = this.storage.getUserStatus();
    const storageDesc = this.storage.getStorageDescription();
    const syncStatus = this.storage.getSyncStatus();

    this.widget.innerHTML = `
      <div class="user-status-header">
        <span class="user-icon">${status.icon}</span>
        <span class="user-name">${status.displayName}</span>
        <span class="user-type-badge ${status.type}">${status.type === 'registered' ? '已登录' : '游客模式'}</span>
      </div>
      <div class="storage-info">
        <div class="storage-type">
          <span class="storage-icon">${status.storageType === 'cloud' ? '☁️' : '💾'}</span>
          <span class="storage-text">${storageDesc}</span>
        </div>
        ${this.getSyncStatusHTML(syncStatus)}
      </div>
    `;
  }

  // 获取同步状态HTML
  getSyncStatusHTML(syncStatus) {
    if (!syncStatus.isLoggedIn) {
      return '<div class="sync-hint">💡 登录后可享受多设备同步</div>';
    }

    if (!syncStatus.isOnline) {
      return `<div class="sync-status offline">
        📱 离线模式 ${syncStatus.queueLength > 0 ? `(${syncStatus.queueLength}项待同步)` : ''}
      </div>`;
    }

    if (syncStatus.queueLength > 0) {
      return `<div class="sync-status syncing">🔄 正在同步 (${syncStatus.queueLength}项)</div>`;
    }

    const lastSync = syncStatus.lastSyncTime ? 
      new Date(syncStatus.lastSyncTime).toLocaleTimeString() : '从未';
    
    return `<div class="sync-status synced">✅ 已同步 (${lastSync})</div>`;
  }

  // 添加CSS样式
  addStyles() {
    const styleId = 'user-status-widget-styles';
    if (document.getElementById(styleId)) return;

    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      .user-status-widget {
        background: rgba(255, 255, 255, 0.95);
        border-radius: 12px;
        padding: 12px 16px;
        margin: 8px;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        font-size: 14px;
        max-width: 300px;
        backdrop-filter: blur(10px);
        border: 1px solid rgba(255, 255, 255, 0.2);
      }

      .user-status-header {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 8px;
      }

      .user-icon {
        font-size: 16px;
      }

      .user-name {
        font-weight: 600;
        color: #333;
        flex: 1;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .user-type-badge {
        padding: 2px 8px;
        border-radius: 12px;
        font-size: 12px;
        font-weight: 500;
      }

      .user-type-badge.registered {
        background: #e7f5e7;
        color: #2d7d32;
      }

      .user-type-badge.guest {
        background: #fff3e0;
        color: #f57c00;
      }

      .storage-info {
        font-size: 12px;
        color: #666;
      }

      .storage-type {
        display: flex;
        align-items: center;
        gap: 6px;
        margin-bottom: 4px;
      }

      .storage-icon {
        font-size: 14px;
      }

      .storage-text {
        line-height: 1.3;
      }

      .sync-status, .sync-hint {
        display: flex;
        align-items: center;
        gap: 4px;
        font-size: 11px;
        margin-top: 4px;
      }

      .sync-status.synced {
        color: #2d7d32;
      }

      .sync-status.syncing {
        color: #1976d2;
      }

      .sync-status.offline {
        color: #f57c00;
      }

      .sync-hint {
        color: #666;
        font-style: italic;
      }

      /* 响应式设计 */
      @media (max-width: 480px) {
        .user-status-widget {
          margin: 4px;
          padding: 8px 12px;
          font-size: 13px;
        }
        
        .user-name {
          max-width: 120px;
        }
      }

      /* 暗色主题支持 */
      @media (prefers-color-scheme: dark) {
        .user-status-widget {
          background: rgba(40, 40, 40, 0.95);
          border: 1px solid rgba(255, 255, 255, 0.1);
        }
        
        .user-name {
          color: #e0e0e0;
        }
        
        .storage-info {
          color: #b0b0b0;
        }
      }
    `;
    
    document.head.appendChild(style);
  }

  // 开始自动更新
  startAutoUpdate() {
    // 每5秒更新一次状态
    this.updateInterval = setInterval(() => {
      this.updateContent();
    }, 5000);
  }

  // 停止自动更新
  stopAutoUpdate() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
  }

  // 销毁组件
  destroy() {
    this.stopAutoUpdate();
    if (this.widget && this.widget.parentNode) {
      this.widget.parentNode.removeChild(this.widget);
    }
    this.widget = null;
  }

  // 手动刷新状态
  refresh() {
    this.updateContent();
  }

  // 隐藏/显示组件
  toggle(visible = null) {
    if (!this.widget) return;
    
    if (visible === null) {
      visible = this.widget.style.display === 'none';
    }
    
    this.widget.style.display = visible ? 'block' : 'none';
  }
}

// 快速创建用户状态组件的工具函数
function createUserStatusWidget(storage, containerId) {
  const widget = new UserStatusWidget(storage, containerId);
  return widget.create();
}

// 导出
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { UserStatusWidget, createUserStatusWidget };
} else if (typeof window !== 'undefined') {
  window.UserStatusWidget = UserStatusWidget;
  window.createUserStatusWidget = createUserStatusWidget;
}

console.log('👤 用户状态显示组件已加载');