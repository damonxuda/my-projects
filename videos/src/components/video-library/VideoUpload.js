import React, { useState } from 'react';
import { Upload, X } from 'lucide-react';

const VideoUpload = ({
  show,
  onClose,
  onComplete,
  currentPath,
  apiUrl,
  formatConverterUrl,
  getToken
}) => {
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // 文件选择处理
  const handleFileSelect = (event) => {
    const files = Array.from(event.target.files);
    setSelectedFiles(files);
  };

  // 上传处理
  const handleUpload = async () => {
    if (selectedFiles.length === 0) return;

    setIsUploading(true);
    // TODO: 实现上传逻辑
    setTimeout(() => {
      setIsUploading(false);
      onComplete();
      onClose();
    }, 2000);
  };

  if (!show) return null;

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-medium text-gray-900">上传视频</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              选择视频文件
            </label>
            <input
              type="file"
              multiple
              accept="video/*"
              onChange={handleFileSelect}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
            />
          </div>

          {selectedFiles.length > 0 && (
            <div>
              <p className="text-sm text-gray-600">已选择 {selectedFiles.length} 个文件</p>
              <ul className="text-xs text-gray-500 mt-1">
                {selectedFiles.map((file, index) => (
                  <li key={index}>{file.name}</li>
                ))}
              </ul>
            </div>
          )}

          {isUploading && (
            <div>
              <div className="bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                ></div>
              </div>
              <p className="text-sm text-gray-600 mt-1">上传中... {uploadProgress}%</p>
            </div>
          )}

          <div className="flex space-x-2">
            <button
              onClick={handleUpload}
              disabled={selectedFiles.length === 0 || isUploading}
              className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              <Upload className="inline h-4 w-4 mr-2" />
              {isUploading ? '上传中...' : '开始上传'}
            </button>
            <button
              onClick={onClose}
              disabled={isUploading}
              className="flex-1 bg-gray-300 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-400"
            >
              取消
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VideoUpload;