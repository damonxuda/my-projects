// ImageService.js - 图片处理服务类
import JSZip from "jszip";

export class ImageService {
  constructor(supabase) {
    this.supabase = supabase;
  }

  // 删除单个图片
  async deleteImage(storageName) {
    try {
      if (!this.supabase) {
        throw new Error("数据库未初始化");
      }

      const { error } = await this.supabase.storage
        .from("question-images")
        .remove([storageName]);

      if (error) throw error;

      return { success: true };
    } catch (error) {
      console.error("删除图片失败:", error);
      return { success: false, error: error.message };
    }
  }

  // 批量删除图片
  async deleteImages(storageNames) {
    try {
      if (!this.supabase) {
        throw new Error("数据库未初始化");
      }

      const { error } = await this.supabase.storage
        .from("question-images")
        .remove(storageNames);

      if (error) throw error;

      return { success: true };
    } catch (error) {
      console.error("批量删除图片失败:", error);
      return { success: false, error: error.message };
    }
  }

  // 替换图片
  async replaceImage(oldStorageName, newImageFile) {
    try {
      if (!this.supabase) {
        throw new Error("数据库未初始化");
      }

      // 先删除旧图片
      await this.deleteImage(oldStorageName);

      // 上传新图片，使用相同的文件名
      const { data, error } = await this.supabase.storage
        .from("question-images")
        .upload(oldStorageName, newImageFile);

      if (error) throw error;

      // 获取新的公共URL
      const { data: urlData } = this.supabase.storage
        .from("question-images")
        .getPublicUrl(oldStorageName);

      return {
        success: true,
        url: urlData.publicUrl,
        storageName: oldStorageName,
      };
    } catch (error) {
      console.error("替换图片失败:", error);
      return { success: false, error: error.message };
    }
  }

  // 批量上传图片到Supabase Storage
  async uploadImagesFromZip(zipFile, paperUUID = null) {
    try {
      if (!this.supabase) {
        throw new Error("数据库未初始化");
      }

      console.log("开始处理zip文件...");

      // 读取zip文件
      const zip = new JSZip();
      const zipData = await zip.loadAsync(zipFile);

      const uploadResults = [];
      const errors = [];

      // 遍历zip文件中的所有文件
      for (const filename in zipData.files) {
        const file = zipData.files[filename];

        // 跳过文件夹和非图片文件
        if (
          file.dir ||
          !this.isImageFile(filename) ||
          filename.startsWith("__MACOSX") ||
          filename.startsWith("._") ||
          filename.includes("/.")
        ) {
          console.log(`跳过文件: ${filename}`);
          continue;
        }

        try {
          console.log(`处理图片: ${filename}`);

          // 从zip中提取图片数据
          const imageBlob = await file.async("blob");

          // 生成存储文件名
          let storageFileName;
          if (paperUUID) {
            // 使用试卷UUID命名：试卷UUID_原文件名
            storageFileName = `${paperUUID}_${filename}`;
          } else {
            // 临时命名，等试卷创建后再重命名
            storageFileName = `temp_${Date.now()}_${filename}`;
          }

          // 上传到Supabase Storage
          const { data, error } = await this.supabase.storage
            .from("question-images")
            .upload(storageFileName, imageBlob);

          if (error) {
            throw error;
          }

          // 获取公共URL
          const { data: urlData } = this.supabase.storage
            .from("question-images")
            .getPublicUrl(storageFileName);

          uploadResults.push({
            originalName: filename,
            storageName: storageFileName,
            url: urlData.publicUrl,
          });

          console.log(`✅ 成功上传: ${filename}`);
        } catch (error) {
          console.error(`❌ 上传失败 ${filename}:`, error);
          errors.push({ filename, error: error.message });
        }
      }

      return {
        success: true,
        uploadedCount: uploadResults.length,
        uploads: uploadResults,
        errors: errors,
      };
    } catch (error) {
      console.error("处理zip文件失败:", error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  // 重命名临时图片文件
  async renameTemporaryImages(imageMap, paperUUID) {
    try {
      for (const [originalName, imageInfo] of Object.entries(imageMap)) {
        const oldName = imageInfo.storageName;
        const newName = `${paperUUID}_${originalName}`;

        if (oldName.startsWith("temp_")) {
          // 移动/重命名文件
          const { data, error } = await this.supabase.storage
            .from("question-images")
            .move(oldName, newName);

          if (error) {
            console.error(`重命名图片失败 ${oldName} -> ${newName}:`, error);
          } else {
            // 更新imageMap中的信息
            imageInfo.storageName = newName;
            const { data: urlData } = this.supabase.storage
              .from("question-images")
              .getPublicUrl(newName);
            imageInfo.url = urlData.publicUrl;
            console.log(`✅ 重命名成功: ${oldName} -> ${newName}`);
          }
        }
      }
    } catch (error) {
      console.error("重命名临时图片失败:", error);
    }
  }

  // 检查是否为图片文件
  isImageFile(filename) {
    const imageExtensions = [".png", ".jpg", ".jpeg", ".gif", ".webp"];
    const ext = filename.toLowerCase().substring(filename.lastIndexOf("."));
    return imageExtensions.includes(ext);
  }
}
