import React from 'react';
import { X, Upload, FolderOpen, Settings, ArrowRight, Copy, Trash2 } from 'lucide-react';

const VideoOperationModals = ({
  show,
  onClose,
  selectedItem,
  selectedItems,
  fileOperation,
  operationData,
  isProcessingOperation,
  currentPath,
  items,
  onOperationComplete,
  setFileOperation,
  setOperationData,
  setIsProcessingOperation,
  apiUrl,
  getToken
}) => {
  if (!show) return null;

  // 处理文件操作执行的函数（这些需要从原来的VideoLibrary.js移植过来）
  const handleCreateFolder = async (folderPath) => {
    setIsProcessingOperation(true);
    try {
      const token = await getToken();
      const response = await fetch(`${apiUrl}/files/create-folder`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ path: folderPath }),
      });

      if (!response.ok) {
        throw new Error(`创建文件夹失败: ${response.status}`);
      }

      onOperationComplete();
      resetOperationState();
    } catch (error) {
      console.error('创建文件夹失败:', error);
      alert(`创建文件夹失败: ${error.message}`);
    } finally {
      setIsProcessingOperation(false);
    }
  };

  const resetOperationState = () => {
    setFileOperation(null);
    setOperationData({});
    onClose();
  };

  const canExecuteOperation = () => {
    if (fileOperation === 'create-folder') {
      return operationData.folderName?.trim();
    }
    if (fileOperation === 'rename') {
      return selectedItem && operationData.newName?.trim();
    }
    if (['move', 'copy', 'delete'].includes(fileOperation)) {
      return selectedItems.length > 0;
    }
    if (fileOperation === 'upload') {
      return operationData.uploadFiles?.length > 0;
    }
    return false;
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg max-w-lg w-full mx-4">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-semibold text-gray-800 flex items-center gap-2">
              <FolderOpen className="text-purple-600" size={24} />
              文件管理
            </h3>
            <button
              onClick={() => {
                resetOperationState();
              }}
              className="text-gray-500 hover:text-gray-700"
            >
              <X size={24} />
            </button>
          </div>

          {!fileOperation ? (
            <div className="space-y-3">
              <p className="text-gray-600 mb-4">选择您想要执行的文件操作：</p>

              <button
                onClick={() => setFileOperation('upload')}
                className="w-full flex items-center gap-3 p-3 text-left border rounded-lg hover:bg-green-50 hover:border-green-300 transition-colors"
              >
                <Upload className="text-green-600" size={20} />
                <div>
                  <div className="font-medium text-gray-800">上传视频</div>
                  <div className="text-sm text-gray-500">上传视频文件到当前目录</div>
                </div>
              </button>

              <button
                onClick={() => setFileOperation('create-folder')}
                className="w-full flex items-center gap-3 p-3 text-left border rounded-lg hover:bg-blue-50 hover:border-blue-300 transition-colors"
              >
                <FolderOpen className="text-blue-600" size={20} />
                <div>
                  <div className="font-medium text-gray-800">创建文件夹</div>
                  <div className="text-sm text-gray-500">在当前目录创建新文件夹</div>
                </div>
              </button>

              <button
                onClick={() => setFileOperation('rename')}
                className="w-full flex items-center gap-3 p-3 text-left border rounded-lg hover:bg-yellow-50 hover:border-yellow-300 transition-colors"
              >
                <Settings className="text-yellow-600" size={20} />
                <div>
                  <div className="font-medium text-gray-800">重命名文件/文件夹</div>
                  <div className="text-sm text-gray-500">选择文件或文件夹进行重命名</div>
                </div>
              </button>

              <button
                onClick={() => setFileOperation('move')}
                className="w-full flex items-center gap-3 p-3 text-left border rounded-lg hover:bg-purple-50 hover:border-purple-300 transition-colors"
              >
                <ArrowRight className="text-purple-600" size={20} />
                <div>
                  <div className="font-medium text-gray-800">移动文件/文件夹</div>
                  <div className="text-sm text-gray-500">选择一个或多个文件/文件夹移动到其他位置</div>
                </div>
              </button>

              <button
                onClick={() => setFileOperation('copy')}
                className="w-full flex items-center gap-3 p-3 text-left border rounded-lg hover:bg-indigo-50 hover:border-indigo-300 transition-colors"
              >
                <Copy className="text-indigo-600" size={20} />
                <div>
                  <div className="font-medium text-gray-800">复制文件/文件夹</div>
                  <div className="text-sm text-gray-500">选择一个或多个文件/文件夹进行复制</div>
                </div>
              </button>

              <button
                onClick={() => setFileOperation('delete')}
                className="w-full flex items-center gap-3 p-3 text-left border rounded-lg hover:bg-red-50 hover:border-red-300 transition-colors"
              >
                <Trash2 className="text-red-600" size={20} />
                <div>
                  <div className="font-medium text-gray-800">删除文件/文件夹</div>
                  <div className="text-sm text-gray-500">选择一个或多个文件/文件夹进行删除</div>
                </div>
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {fileOperation === 'create-folder' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    文件夹名称
                  </label>
                  <input
                    type="text"
                    value={operationData.folderName || ''}
                    onChange={(e) => setOperationData({...operationData, folderName: e.target.value})}
                    placeholder="输入文件夹名称"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    autoFocus
                  />
                  <div className="mt-2 text-xs text-gray-500">
                    文件夹将创建在: {currentPath ? `${currentPath}/` : '根目录/'}
                  </div>
                </div>
              )}

              {fileOperation === 'upload' && (
                <div>
                  <p className="text-sm text-gray-600 mb-3">选择要上传的视频文件：</p>
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                    <input
                      type="file"
                      accept=".mp4,.avi,.mov,.mkv,.webm"
                      multiple
                      onChange={(e) => {
                        const files = Array.from(e.target.files);
                        if (files.length > 0) {
                          setOperationData({...operationData, uploadFiles: files});
                        }
                      }}
                      className="hidden"
                      id="file-upload"
                    />
                    <label
                      htmlFor="file-upload"
                      className="cursor-pointer flex flex-col items-center gap-2"
                    >
                      <Upload className="text-gray-400" size={32} />
                      <span className="text-sm text-gray-600">
                        {operationData.uploadFiles && operationData.uploadFiles.length > 0
                          ? `已选择 ${operationData.uploadFiles.length} 个文件`
                          : '点击选择多个文件或拖拽到此处'}
                      </span>
                      <span className="text-xs text-gray-500">
                        支持: MP4, AVI, MOV, MKV, WebM (最大2GB)
                      </span>
                    </label>
                  </div>
                </div>
              )}

              {/* 其他操作的UI将在后续添加 */}
              {!['create-folder', 'upload'].includes(fileOperation) && (
                <div>
                  <p className="text-sm text-gray-600">
                    {fileOperation === 'move' && '移动文件功能'}
                    {fileOperation === 'copy' && '复制文件功能'}
                    {fileOperation === 'delete' && '删除文件功能'}
                    {fileOperation === 'rename' && '重命名文件功能'}
                    （待完善具体UI）
                  </p>
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => {
                    setFileOperation(null);
                    setOperationData({});
                  }}
                  disabled={isProcessingOperation}
                  className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  返回
                </button>
                <button
                  onClick={async () => {
                    if (fileOperation === 'create-folder' && operationData.folderName) {
                      const folderPath = currentPath ? `${currentPath}/${operationData.folderName}` : operationData.folderName;
                      await handleCreateFolder(folderPath);
                    } else if (fileOperation === 'upload' && operationData.uploadFiles) {
                      // 这里应该调用上传逻辑
                      alert('上传功能需要实现');
                    }
                    // 其他操作将在后续实现
                  }}
                  disabled={isProcessingOperation || !canExecuteOperation()}
                  className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isProcessingOperation ? '处理中...' : '确认'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default VideoOperationModals;