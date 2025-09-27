import React from 'react';
import { Upload, X } from 'lucide-react';

const VideoUpload = ({
  show,
  onClose,
  onComplete,
  currentPath,
  apiUrl,
  formatConverterUrl,
  getToken,
  selectedFiles,
  setSelectedFiles,
  isUploading,
  setIsUploading,
  uploadProgress,
  setUploadProgress,
  currentUploadIndex,
  setCurrentUploadIndex
}) => {
  // 移除本地状态，使用传入的props

  // 关闭处理
  const handleClose = () => {
    setSelectedFiles([]);
    setUploadProgress(0);
    setCurrentUploadIndex(0);
    onClose();
  };

  // 文件选择处理
  const handleFileSelect = (event) => {
    const files = Array.from(event.target.files);
    setSelectedFiles(files);
  };

  // 检查视频编码并自动转换
  const checkVideoEncoding = async (fileKey, fileSize) => {
    try {
      const token = await getToken();
      const response = await fetch(`${formatConverterUrl}/video/check-encoding`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          fileName: fileKey,
          fileSize: fileSize
        })
      });

      if (!response.ok) {
        console.warn('⚠️ 视频兼容性检测失败:', response.status);
        return; // 不阻断上传流程
      }

      const result = await response.json();
      console.log('✅ 视频编码检查完成:', result);
    } catch (error) {
      console.error('❌ 视频编码检查失败:', error);
      console.warn('⚠️ 跳过视频兼容性检查，文件已成功上传');
    }
  };

  // 处理视频上传
  const handleUpload = async () => {
    if (!selectedFiles || selectedFiles.length === 0) {
      window.alert('请先选择文件');
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);
    setCurrentUploadIndex(0);

    try {
      for (let i = 0; i < selectedFiles.length; i++) {
        const currentFile = selectedFiles[i];
        setCurrentUploadIndex(i);

        // 处理文件名
        const fileName = currentFile.name;
        const targetPath = currentPath ? `videos/${currentPath}/${fileName}` : `videos/${fileName}`;

        // 获取预签名上传URL
        const token = await getToken();
        const uploadUrlResponse = await fetch(`${apiUrl}/files/upload-url`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            fileName: targetPath,
            fileType: currentFile.type,
            fileSize: currentFile.size
          })
        });

        if (!uploadUrlResponse.ok) {
          throw new Error(`获取上传URL失败: ${uploadUrlResponse.status}`);
        }

        const { uploadUrl, fileKey } = await uploadUrlResponse.json();

        // 上传文件到S3
        const uploadResponse = await fetch(uploadUrl, {
          method: 'PUT',
          body: currentFile,
          headers: {
            'Content-Type': currentFile.type
          }
        });

        if (!uploadResponse.ok) {
          throw new Error(`文件上传失败: ${uploadResponse.status}`);
        }

        // 更新进度
        const progress = Math.round(((i + 1) / selectedFiles.length) * 100);
        setUploadProgress(progress);

        // 检查视频编码并可能触发转换
        await checkVideoEncoding(fileKey, currentFile.size);
      }

      // 重置状态并刷新列表
      setSelectedFiles([]);
      setIsUploading(false);
      setUploadProgress(0);
      setCurrentUploadIndex(0);

      window.alert(`所有视频上传成功！共上传 ${selectedFiles.length} 个文件`);

      // 刷新当前目录
      onComplete();
      onClose();

    } catch (error) {
      console.error('❌ 视频上传失败:', error);
      window.alert(`上传失败: ${error.message}`);
      setIsUploading(false);
      setUploadProgress(0);
      setCurrentUploadIndex(0);
    }
  };

  if (!show) return null;

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-medium text-gray-900">上传视频</h3>
          <button onClick={handleClose} className="text-gray-400 hover:text-gray-600">
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

          {currentPath && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-sm text-blue-800">
                📁 将上传到：<span className="font-semibold">{currentPath}</span>
              </p>
            </div>
          )}

          {isUploading && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>
                  上传进度 ({currentUploadIndex + 1}/{selectedFiles.length})
                </span>
                <span>{uploadProgress}%</span>
              </div>
              {selectedFiles.length > 1 && (
                <p className="text-xs text-gray-500">
                  当前: {selectedFiles[currentUploadIndex]?.name}
                </p>
              )}
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                ></div>
              </div>
            </div>
          )}

          <div className="flex space-x-2">
            <button
              onClick={handleUpload}
              disabled={selectedFiles.length === 0 || isUploading}
              className="flex-1 bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 disabled:opacity-50"
            >
              <Upload className="inline h-4 w-4 mr-2" />
              {isUploading ? `上传中... (${currentUploadIndex + 1}/${selectedFiles.length})` : `开始上传 (${selectedFiles.length}个文件)`}
            </button>
            <button
              onClick={handleClose}
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