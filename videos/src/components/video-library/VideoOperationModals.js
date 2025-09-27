import React, { useState, useEffect } from 'react';
import { X, Upload, FolderOpen, Settings, ArrowRight, Copy, Trash2 } from 'lucide-react';

const VideoOperationModals = ({
  show,
  onClose,
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
  getToken,
  onUploadTrigger
}) => {
  const [selectedItems, setSelectedItems] = useState([]);

  // 重置选择状态
  useEffect(() => {
    if (!show || !fileOperation) {
      setSelectedItems([]);
    }
  }, [show, fileOperation]);

  if (!show) return null;

  // 处理文件操作执行的函数
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
      window.alert(`创建文件夹失败: ${error.message}`);
    } finally {
      setIsProcessingOperation(false);
    }
  };

  const handleBatchMoveItems = async (items, targetFolder) => {
    console.log('🔧 API修复版本 2024-09-27: 使用个体/files/move调用，不使用batch-move端点');
    setIsProcessingOperation(true);
    try {
      const token = await getToken();

      // 逐个移动文件，因为Lambda只有单个移动端点 - Force deployment
      for (const item of items) {
        const response = await fetch(`${apiUrl}/files/move`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            oldPath: item.key || item.Key,
            newPath: targetFolder ? `videos/${targetFolder}/${item.name}` : `videos/${item.name}`
          }),
        });

        if (!response.ok) {
          throw new Error(`移动文件 ${item.name} 失败: ${response.status}`);
        }
      }

      onOperationComplete();
      resetOperationState();
    } catch (error) {
      console.error('批量移动失败:', error);
      window.alert(`批量移动失败: ${error.message}`);
    } finally {
      setIsProcessingOperation(false);
    }
  };

  const handleBatchCopyItems = async (items, targetFolder) => {
    setIsProcessingOperation(true);
    try {
      const token = await getToken();

      // 逐个复制文件，因为Lambda只有单个复制端点
      for (const item of items) {
        const response = await fetch(`${apiUrl}/files/copy`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            sourcePath: item.key || item.Key,
            targetPath: targetFolder ? `videos/${targetFolder}/${item.name}` : `videos/${item.name}`
          }),
        });

        if (!response.ok) {
          throw new Error(`复制文件 ${item.name} 失败: ${response.status}`);
        }
      }

      onOperationComplete();
      resetOperationState();
    } catch (error) {
      console.error('批量复制失败:', error);
      window.alert(`批量复制失败: ${error.message}`);
    } finally {
      setIsProcessingOperation(false);
    }
  };

  const handleBatchDeleteItems = async (items) => {
    console.log('🔧 API修复版本 2024-09-27: 使用个体/files/delete调用，不使用batch-delete端点');
    setIsProcessingOperation(true);
    try {
      const token = await getToken();
      // 逐个删除文件，因为Lambda只有单个删除端点 - 保持与move/copy操作一致
      for (const item of items) {
        const response = await fetch(`${apiUrl}/files/delete`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            filePath: item.key || item.Key
          }),
        });

        if (!response.ok) {
          throw new Error(`删除文件 ${item.name} 失败: ${response.status}`);
        }
      }

      onOperationComplete();
      resetOperationState();
    } catch (error) {
      console.error('批量删除失败:', error);
      window.alert(`批量删除失败: ${error.message}`);
    } finally {
      setIsProcessingOperation(false);
    }
  };

  const resetOperationState = () => {
    setFileOperation(null);
    setOperationData({});
    setSelectedItems([]);
    onClose();
  };

  const canExecuteOperation = () => {
    if (fileOperation === 'create-folder') {
      return operationData.folderName?.trim();
    }
    if (['move', 'copy'].includes(fileOperation)) {
      return selectedItems.length > 0 && operationData.targetFolder !== undefined;
    }
    if (fileOperation === 'delete') {
      return selectedItems.length > 0;
    }
    if (fileOperation === 'upload') {
      return operationData.uploadFiles?.length > 0;
    }
    return false;
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto">
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

              {fileOperation === 'move' && (
                <div>
                  <div className="mb-3">
                    <p className="text-sm text-gray-600 mb-3">选择要移动的文件或文件夹：</p>
                    <div className="max-h-60 overflow-y-auto space-y-2 border rounded-lg p-2">
                      {items.map((item, index) => (
                        <label key={index} className="flex items-center gap-3 p-2 border rounded hover:bg-gray-50 transition-colors cursor-pointer">
                          <input
                            type="checkbox"
                            checked={selectedItems.some(selected => (selected.key || selected.Key) === (item.key || item.Key))}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedItems([...selectedItems, item]);
                              } else {
                                setSelectedItems(selectedItems.filter(selected =>
                                  (selected.key || selected.Key) !== (item.key || item.Key)
                                ));
                              }
                            }}
                            className="rounded text-purple-600"
                          />
                          <div className="flex-1">
                            <div className="font-medium">{item.name}</div>
                            <div className="text-xs text-gray-500">
                              {item.type === 'folder' ? '文件夹' : '文件'}
                            </div>
                          </div>
                        </label>
                      ))}
                    </div>

                    {selectedItems.length > 0 && (
                      <div className="mt-3 p-2 bg-purple-50 border border-purple-200 rounded">
                        <p className="text-sm text-purple-800">
                          已选择 {selectedItems.length} 个项目
                        </p>
                      </div>
                    )}
                  </div>

                  {selectedItems.length > 0 && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        目标文件夹
                      </label>
                      <input
                        type="text"
                        value={operationData.targetFolder || ''}
                        onChange={(e) => setOperationData({...operationData, targetFolder: e.target.value})}
                        placeholder="输入目标文件夹路径（留空表示根目录）"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                      />
                      <div className="mt-2 text-xs text-gray-500">
                        文件将移动到: videos/{operationData.targetFolder || '根目录'}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {fileOperation === 'copy' && (
                <div>
                  <div className="mb-3">
                    <p className="text-sm text-gray-600 mb-3">选择要复制的文件或文件夹：</p>
                    <div className="max-h-60 overflow-y-auto space-y-2 border rounded-lg p-2">
                      {items.map((item, index) => (
                        <label key={index} className="flex items-center gap-3 p-2 border rounded hover:bg-gray-50 transition-colors cursor-pointer">
                          <input
                            type="checkbox"
                            checked={selectedItems.some(selected => (selected.key || selected.Key) === (item.key || item.Key))}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedItems([...selectedItems, item]);
                              } else {
                                setSelectedItems(selectedItems.filter(selected =>
                                  (selected.key || selected.Key) !== (item.key || item.Key)
                                ));
                              }
                            }}
                            className="rounded text-indigo-600"
                          />
                          <div className="flex-1">
                            <div className="font-medium">{item.name}</div>
                            <div className="text-xs text-gray-500">
                              {item.type === 'folder' ? '文件夹' : '文件'}
                            </div>
                          </div>
                        </label>
                      ))}
                    </div>

                    {selectedItems.length > 0 && (
                      <div className="mt-3 p-2 bg-indigo-50 border border-indigo-200 rounded">
                        <p className="text-sm text-indigo-800">
                          已选择 {selectedItems.length} 个项目
                        </p>
                      </div>
                    )}
                  </div>

                  {selectedItems.length > 0 && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        目标文件夹
                      </label>
                      <input
                        type="text"
                        value={operationData.targetFolder || ''}
                        onChange={(e) => setOperationData({...operationData, targetFolder: e.target.value})}
                        placeholder="输入目标文件夹路径（留空表示根目录）"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      />
                      <div className="mt-2 text-xs text-gray-500">
                        文件将复制到: videos/{operationData.targetFolder || '根目录'}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {fileOperation === 'delete' && (
                <div>
                  <div className="mb-3">
                    <p className="text-sm text-gray-600 mb-3">选择要删除的文件或文件夹：</p>
                    <div className="max-h-60 overflow-y-auto space-y-2 border rounded-lg p-2">
                      {items.map((item, index) => (
                        <label key={index} className="flex items-center gap-3 p-2 border rounded hover:bg-gray-50 transition-colors cursor-pointer">
                          <input
                            type="checkbox"
                            checked={selectedItems.some(selected => (selected.key || selected.Key) === (item.key || item.Key))}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedItems([...selectedItems, item]);
                              } else {
                                setSelectedItems(selectedItems.filter(selected =>
                                  (selected.key || selected.Key) !== (item.key || item.Key)
                                ));
                              }
                            }}
                            className="rounded text-red-600"
                          />
                          <div className="flex-1">
                            <div className="font-medium">{item.name}</div>
                            <div className="text-xs text-gray-500">
                              {item.type === 'folder' ? '文件夹' : '文件'}
                            </div>
                          </div>
                        </label>
                      ))}
                    </div>

                    {selectedItems.length > 0 && (
                      <div className="mt-3 p-2 bg-red-50 border border-red-200 rounded">
                        <p className="text-sm text-red-800">
                          将删除 {selectedItems.length} 个项目（此操作不可恢复）
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-4 border-t">
                <button
                  onClick={() => {
                    setFileOperation(null);
                    setOperationData({});
                    setSelectedItems([]);
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
                    } else if (fileOperation === 'move' && selectedItems.length > 0) {
                      await handleBatchMoveItems(selectedItems, operationData.targetFolder || '');
                    } else if (fileOperation === 'copy' && selectedItems.length > 0) {
                      await handleBatchCopyItems(selectedItems, operationData.targetFolder || '');
                    } else if (fileOperation === 'delete' && selectedItems.length > 0) {
                      if (window.confirm(`确定要删除选中的 ${selectedItems.length} 个项目吗？此操作不可恢复。`)) {
                        await handleBatchDeleteItems(selectedItems);
                      }
                    } else if (fileOperation === 'upload' && operationData.uploadFiles) {
                      // 触发上传流程 - 关闭当前模态框并打开VideoUpload组件
                      if (onUploadTrigger) {
                        onUploadTrigger(operationData.uploadFiles);
                        resetOperationState();
                      }
                    }
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