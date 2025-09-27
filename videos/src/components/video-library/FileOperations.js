import React, { useState } from 'react';
import { Trash2, Copy, Move, FolderPlus, Edit3 } from 'lucide-react';

const FileOperations = ({
  selectedItems,
  currentPath,
  items,
  onOperationComplete,
  onClearSelection,
  apiUrl,
  getToken
}) => {
  const [processing, setProcessing] = useState(false);
  const [showOperationModal, setShowOperationModal] = useState(false);
  const [operationType, setOperationType] = useState(null);
  const [operationData, setOperationData] = useState({});

  // 自动选择mobile版本关联
  const expandSelectionWithMobile = (files) => {
    const expandedMap = new Map();

    files.forEach(item => {
      const key = item.key || item.Key;
      if (key && key.endsWith('.mp4')) {
        if (key.includes('_mobile.mp4')) {
          // 如果选择了mobile文件，找对应的原文件
          const originalKey = key.replace('_mobile.mp4', '.mp4');
          const originalFile = items.find(f => (f.key || f.Key) === originalKey);
          if (originalFile && !expandedMap.has(originalKey)) {
            expandedMap.set(originalKey, originalFile);
          }
        } else {
          // 如果选择了原文件，找对应的mobile文件
          const mobileKey = key.replace('.mp4', '_mobile.mp4');
          const mobileFile = items.find(f => (f.key || f.Key) === mobileKey);
          if (mobileFile && !expandedMap.has(mobileKey)) {
            expandedMap.set(mobileKey, mobileFile);
          }
        }
      }
      // 总是包含原选择的文件
      expandedMap.set(key, item);
    });

    return Array.from(expandedMap.values());
  };

  // 批量移动文件
  const handleBatchMove = async (targetFolder) => {
    setProcessing(true);
    try {
      const expandedFiles = expandSelectionWithMobile(selectedItems);

      const response = await fetch(`${apiUrl}/files/move`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${await getToken()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          files: expandedFiles.map(item => ({
            key: item.key || item.Key,
            size: item.size || item.Size,
            lastModified: item.lastModified || item.LastModified
          })),
          targetFolder
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      if (result.success) {
        onOperationComplete();
        onClearSelection();
        setShowOperationModal(false);
      } else {
        throw new Error(result.error || 'Move operation failed');
      }
    } catch (error) {
      console.error('批量移动失败:', error);
      alert(`移动失败: ${error.message}`);
    } finally {
      setProcessing(false);
    }
  };

  // 批量复制文件
  const handleBatchCopy = async (targetFolder) => {
    setProcessing(true);
    try {
      const expandedFiles = expandSelectionWithMobile(selectedItems);

      const response = await fetch(`${apiUrl}/files/copy`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${await getToken()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          files: expandedFiles.map(item => ({
            key: item.key || item.Key,
            size: item.size || item.Size,
            lastModified: item.lastModified || item.LastModified
          })),
          targetFolder
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      if (result.success) {
        onOperationComplete();
        onClearSelection();
        setShowOperationModal(false);
      } else {
        throw new Error(result.error || 'Copy operation failed');
      }
    } catch (error) {
      console.error('批量复制失败:', error);
      alert(`复制失败: ${error.message}`);
    } finally {
      setProcessing(false);
    }
  };

  // 批量删除文件
  const handleBatchDelete = async () => {
    if (!window.confirm(`确定要删除选中的 ${selectedItems.length} 个文件/文件夹吗？此操作不可撤销。`)) {
      return;
    }

    setProcessing(true);
    try {
      const expandedFiles = expandSelectionWithMobile(selectedItems);

      const response = await fetch(`${apiUrl}/files/batch-delete`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${await getToken()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          files: expandedFiles.map(item => ({
            key: item.key || item.Key,
            isDirectory: item.isDirectory || false
          }))
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      if (result.success) {
        onOperationComplete();
        onClearSelection();
      } else {
        throw new Error(result.error || 'Delete operation failed');
      }
    } catch (error) {
      console.error('批量删除失败:', error);
      alert(`删除失败: ${error.message}`);
    } finally {
      setProcessing(false);
    }
  };

  // 创建文件夹
  const handleCreateFolder = async (folderName) => {
    setProcessing(true);
    try {
      const folderPath = currentPath ? `${currentPath}/${folderName}` : folderName;

      const response = await fetch(`${apiUrl}/files/create-folder`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${await getToken()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ folderPath }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      if (result.success) {
        onOperationComplete();
        setShowOperationModal(false);
      } else {
        throw new Error(result.error || 'Create folder failed');
      }
    } catch (error) {
      console.error('创建文件夹失败:', error);
      alert(`创建文件夹失败: ${error.message}`);
    } finally {
      setProcessing(false);
    }
  };

  // 获取可用的目标文件夹
  const getAvailableFolders = () => {
    const folders = items.filter(item => item.isDirectory);
    return folders.map(folder => ({
      name: folder.displayName,
      path: folder.key || folder.Key
    }));
  };

  // 开始操作
  const startOperation = (type) => {
    setOperationType(type);
    setOperationData({});
    setShowOperationModal(true);
  };

  if (selectedItems.length === 0) {
    return (
      <div className="mt-4">
        <div className="bg-white rounded-lg border-2 border-dashed border-gray-300 p-6">
          <div className="text-center">
            <FolderPlus className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">文件操作</h3>
            <p className="mt-1 text-sm text-gray-500">
              选择文件后可以进行移动、复制、删除等操作
            </p>
            <div className="mt-6">
              <button
                onClick={() => startOperation('createFolder')}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
              >
                <FolderPlus className="mr-2 h-4 w-4" />
                创建文件夹
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-4">
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-medium text-gray-900">
              已选择 {selectedItems.length} 个项目
            </h3>
            <p className="text-sm text-gray-500">
              选择操作类型
            </p>
          </div>

          <div className="flex space-x-2">
            <button
              onClick={() => startOperation('move')}
              disabled={processing}
              className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
            >
              <Move className="mr-2 h-4 w-4" />
              移动
            </button>

            <button
              onClick={() => startOperation('copy')}
              disabled={processing}
              className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
            >
              <Copy className="mr-2 h-4 w-4" />
              复制
            </button>

            <button
              onClick={handleBatchDelete}
              disabled={processing}
              className="inline-flex items-center px-3 py-2 border border-red-300 shadow-sm text-sm leading-4 font-medium rounded-md text-red-700 bg-white hover:bg-red-50 disabled:opacity-50"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              删除
            </button>

            <button
              onClick={onClearSelection}
              disabled={processing}
              className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
            >
              取消选择
            </button>
          </div>
        </div>
      </div>

      {/* 操作模态框 */}
      {showOperationModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                {operationType === 'move' && '移动文件'}
                {operationType === 'copy' && '复制文件'}
                {operationType === 'createFolder' && '创建文件夹'}
              </h3>

              {(operationType === 'move' || operationType === 'copy') && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    选择目标文件夹:
                  </label>
                  <select
                    value={operationData.targetFolder || ''}
                    onChange={(e) => setOperationData({...operationData, targetFolder: e.target.value})}
                    className="w-full border border-gray-300 rounded-md px-3 py-2"
                  >
                    <option value="">根目录</option>
                    {getAvailableFolders().map(folder => (
                      <option key={folder.path} value={folder.path}>
                        {folder.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {operationType === 'createFolder' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    文件夹名称:
                  </label>
                  <input
                    type="text"
                    value={operationData.folderName || ''}
                    onChange={(e) => setOperationData({...operationData, folderName: e.target.value})}
                    className="w-full border border-gray-300 rounded-md px-3 py-2"
                    placeholder="输入文件夹名称"
                  />
                </div>
              )}

              <div className="flex space-x-2 mt-6">
                <button
                  onClick={() => {
                    if (operationType === 'move') {
                      handleBatchMove(operationData.targetFolder || '');
                    } else if (operationType === 'copy') {
                      handleBatchCopy(operationData.targetFolder || '');
                    } else if (operationType === 'createFolder') {
                      handleCreateFolder(operationData.folderName);
                    }
                  }}
                  disabled={processing || (operationType === 'createFolder' && !operationData.folderName)}
                  className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50"
                >
                  {processing ? '处理中...' : '确认'}
                </button>
                <button
                  onClick={() => setShowOperationModal(false)}
                  disabled={processing}
                  className="flex-1 bg-gray-300 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-400 disabled:opacity-50"
                >
                  取消
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FileOperations;