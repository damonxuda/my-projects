// ImageManager.js - 图片管理组件
import React, { useState } from "react";
import { Trash2, RefreshCw, Eye, X } from "lucide-react";

const ImageManager = ({
  imageMap,
  onImageDelete,
  onImageReplace,
  onClearAll,
}) => {
  const [previewImage, setPreviewImage] = useState(null);

  const handleReplaceImage = async (originalName, storageName) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (file) {
        await onImageReplace(originalName, storageName, file);
      }
    };
    input.click();
  };

  const imageEntries = Object.entries(imageMap);

  if (imageEntries.length === 0) {
    return null;
  }

  return (
    <div className="mt-4 p-3 bg-white rounded border">
      <div className="flex items-center justify-between mb-3">
        <h5 className="font-medium text-green-700">
          已上传的图片 ({imageEntries.length}张)
        </h5>
        <button
          onClick={onClearAll}
          className="px-3 py-1 bg-red-500 hover:bg-red-600 text-white text-sm rounded flex items-center gap-1"
        >
          <Trash2 size={14} />
          清空全部
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {imageEntries.map(([originalName, imageInfo]) => (
          <div key={originalName} className="relative group">
            <div className="aspect-square bg-gray-100 rounded-lg overflow-hidden border">
              <img
                src={imageInfo.url}
                alt={originalName}
                className="w-full h-full object-cover cursor-pointer hover:opacity-80 transition-opacity"
                onClick={() =>
                  setPreviewImage({ name: originalName, url: imageInfo.url })
                }
              />
            </div>

            <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-50 transition-all rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100">
              <div className="flex gap-1">
                <button
                  onClick={() =>
                    setPreviewImage({ name: originalName, url: imageInfo.url })
                  }
                  className="p-1 bg-blue-500 hover:bg-blue-600 text-white rounded text-xs"
                  title="预览"
                >
                  <Eye size={12} />
                </button>
                <button
                  onClick={() =>
                    handleReplaceImage(originalName, imageInfo.storageName)
                  }
                  className="p-1 bg-yellow-500 hover:bg-yellow-600 text-white rounded text-xs"
                  title="替换"
                >
                  <RefreshCw size={12} />
                </button>
                <button
                  onClick={() => onImageDelete(originalName)}
                  className="p-1 bg-red-500 hover:bg-red-600 text-white rounded text-xs"
                  title="删除"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </div>

            <p className="text-xs text-gray-600 mt-1 text-center truncate">
              {originalName}
            </p>
          </div>
        ))}
      </div>

      {/* 图片预览模态框 */}
      {previewImage && (
        <div
          className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50"
          onClick={() => setPreviewImage(null)}
        >
          <div className="relative max-w-4xl max-h-full p-4">
            <button
              onClick={() => setPreviewImage(null)}
              className="absolute top-2 right-2 p-2 bg-white rounded-full hover:bg-gray-100"
            >
              <X size={16} />
            </button>
            <img
              src={previewImage.url}
              alt={previewImage.name}
              className="max-w-full max-h-full object-contain rounded"
              onClick={(e) => e.stopPropagation()}
            />
            <p className="text-white text-center mt-2">{previewImage.name}</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default ImageManager;
