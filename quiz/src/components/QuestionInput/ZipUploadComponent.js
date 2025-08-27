// ZipUploadComponent.js - ZIP上传和图片管理组件
import React, { useState } from "react";
import ImageManager from "./ImageManager";

const ZipUploadComponent = ({ onImagesUploaded, imageMap, db }) => {
  const [uploading, setUploading] = useState(false);
  const [uploadResults, setUploadResults] = useState(null);

  const handleZipUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    // 验证文件类型
    if (!file.name.toLowerCase().endsWith(".zip")) {
      alert("请选择zip格式的文件");
      return;
    }

    // 验证文件大小（限制50MB）
    if (file.size > 50 * 1024 * 1024) {
      alert("zip文件不能超过50MB");
      return;
    }

    setUploading(true);
    setUploadResults(null);

    try {
      console.log("开始上传zip文件...");
      const result = await db.uploadImagesFromZip(file);

      if (result.success) {
        setUploadResults(result);

        // 创建图片映射表给父组件
        const newImageMap = { ...imageMap };
        result.uploads.forEach((upload) => {
          newImageMap[upload.originalName] = {
            url: upload.url,
            storageName: upload.storageName,
          };
        });

        onImagesUploaded(newImageMap);

        alert(
          `成功上传 ${result.uploadedCount} 张图片！${result.errors.length > 0 ? `${result.errors.length} 张图片上传失败。` : ""}`
        );
      } else {
        alert("上传失败：" + result.error);
      }
    } catch (error) {
      console.error("上传出错:", error);
      alert("上传出错：" + error.message);
    } finally {
      setUploading(false);
    }
  };

  // 删除单张图片
  const handleDeleteImage = async (originalName) => {
    if (!window.confirm(`确定要删除图片 ${originalName} 吗？`)) {
      return;
    }

    const imageInfo = imageMap[originalName];
    if (!imageInfo) return;

    try {
      const result = await db.deleteImage(imageInfo.storageName);
      if (result.success) {
        const newImageMap = { ...imageMap };
        delete newImageMap[originalName];
        onImagesUploaded(newImageMap);
        alert("图片删除成功");
      } else {
        alert("删除失败：" + result.error);
      }
    } catch (error) {
      console.error("删除图片失败:", error);
      alert("删除失败：" + error.message);
    }
  };

  // 替换图片
  const handleReplaceImage = async (originalName, storageName, newFile) => {
    try {
      const result = await db.replaceImage(storageName, newFile);
      if (result.success) {
        const newImageMap = { ...imageMap };
        newImageMap[originalName] = {
          url: result.url,
          storageName: result.storageName,
        };
        onImagesUploaded(newImageMap);
        alert("图片替换成功");
      } else {
        alert("替换失败：" + result.error);
      }
    } catch (error) {
      console.error("替换图片失败:", error);
      alert("替换失败：" + error.message);
    }
  };

  // 清空所有图片
  const handleClearAll = async () => {
    if (!window.confirm("确定要删除所有已上传的图片吗？此操作不可恢复。")) {
      return;
    }

    const storageNames = Object.values(imageMap).map((img) => img.storageName);
    if (storageNames.length === 0) return;

    try {
      const result = await db.deleteImages(storageNames);
      if (result.success) {
        onImagesUploaded({});
        setUploadResults(null);
        alert("所有图片已清空");
      } else {
        alert("清空失败：" + result.error);
      }
    } catch (error) {
      console.error("清空图片失败:", error);
      alert("清空失败：" + error.message);
    }
  };

  return (
    <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
      <h4 className="font-medium text-green-800 mb-3">批量上传几何图片</h4>

      <div className="mb-4">
        <input
          type="file"
          accept=".zip"
          onChange={handleZipUpload}
          disabled={uploading}
          className="mb-2"
        />
        {uploading && (
          <div className="flex items-center gap-2 text-blue-600 text-sm">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
            正在处理zip文件并上传图片...
          </div>
        )}
        <p className="text-xs text-green-600">
          选择包含所有几何图片的zip文件（01.png, 02.png, 03.png...）
        </p>
      </div>

      {/* 上传结果显示 */}
      {uploadResults && (
        <div className="mt-4 p-3 bg-white rounded border">
          <h5 className="font-medium text-green-700 mb-2">上传完成</h5>
          <div className="text-sm text-gray-700 space-y-1">
            <p>
              成功上传:{" "}
              <span className="font-medium text-green-600">
                {uploadResults.uploadedCount}
              </span>{" "}
              张图片
            </p>
            {uploadResults.errors.length > 0 && (
              <p>
                失败:{" "}
                <span className="font-medium text-red-600">
                  {uploadResults.errors.length}
                </span>{" "}
                张图片
              </p>
            )}
          </div>

          {/* 显示错误信息 */}
          {uploadResults.errors.length > 0 && (
            <div className="mt-3">
              <p className="text-sm font-medium text-red-700 mb-2">
                上传失败的文件:
              </p>
              <div className="space-y-1">
                {uploadResults.errors.map((error, index) => (
                  <div key={index} className="text-xs text-red-600">
                    {error.filename}: {error.error}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 图片管理器 */}
      <ImageManager
        imageMap={imageMap}
        onImageDelete={handleDeleteImage}
        onImageReplace={handleReplaceImage}
        onClearAll={handleClearAll}
      />
    </div>
  );
};

export default ZipUploadComponent;
