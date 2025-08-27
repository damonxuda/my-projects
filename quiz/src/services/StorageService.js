// StorageService.js - 文件存储服务类
export class StorageService {
  constructor() {
    // 构造函数暂时为空，可后续添加配置
  }

  // 生成存储文件名
  generateStorageFileName(originalName, paperUUID = null) {
    if (paperUUID) {
      // 使用试卷UUID命名：试卷UUID_原文件名
      return `${paperUUID}_${originalName}`;
    } else {
      // 临时命名，等试卷创建后再重命名
      return `temp_${Date.now()}_${originalName}`;
    }
  }

  // 清理文件名（移除特殊字符等）
  sanitizeFileName(filename) {
    return filename
      .replace(/[^a-zA-Z0-9._-]/g, "_") // 替换特殊字符为下划线
      .replace(/_{2,}/g, "_") // 连续下划线替换为单个
      .toLowerCase(); // 转为小写
  }

  // 验证文件类型
  validateFileType(filename, allowedExtensions) {
    const ext = filename.toLowerCase().substring(filename.lastIndexOf("."));
    return allowedExtensions.includes(ext);
  }

  // 验证文件大小
  validateFileSize(fileSize, maxSizeMB) {
    const maxSizeBytes = maxSizeMB * 1024 * 1024;
    return fileSize <= maxSizeBytes;
  }

  // 检查是否为临时文件
  isTemporaryFile(storageName) {
    return storageName.startsWith("temp_");
  }

  // 从存储名称提取原始文件名
  extractOriginalName(storageName) {
    // 移除前缀（paperUUID_ 或 temp_timestamp_）
    const parts = storageName.split("_");
    if (parts.length > 1) {
      if (parts[0] === "temp") {
        // temp_timestamp_filename 格式
        return parts.slice(2).join("_");
      } else {
        // paperUUID_filename 格式
        return parts.slice(1).join("_");
      }
    }
    return storageName;
  }

  // 批量处理文件名映射
  createFileMapping(files, paperUUID = null) {
    const mapping = {};
    files.forEach((file) => {
      const storageName = this.generateStorageFileName(file.name, paperUUID);
      mapping[file.name] = {
        originalName: file.name,
        storageName: storageName,
        size: file.size,
        type: file.type,
      };
    });
    return mapping;
  }

  // 获取文件扩展名
  getFileExtension(filename) {
    return filename.toLowerCase().substring(filename.lastIndexOf("."));
  }

  // 生成唯一标识符
  generateUniqueId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  // 格式化文件大小显示
  formatFileSize(bytes) {
    if (bytes === 0) return "0 Bytes";

    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  }
}
