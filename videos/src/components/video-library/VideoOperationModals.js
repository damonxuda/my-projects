import React from 'react';
import { X } from 'lucide-react';

const VideoOperationModals = ({
  show,
  onClose,
  selectedItem,
  selectedItems,
  fileOperation,
  operationData,
  isProcessingOperation,
  currentPath,
  onOperationComplete,
  setFileOperation,
  setOperationData,
  setIsProcessingOperation,
  apiUrl,
  getToken
}) => {
  if (!show) return null;

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-medium text-gray-900">文件管理</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            文件管理操作（待实现具体逻辑）
          </p>

          <div className="flex space-x-2">
            <button
              onClick={onClose}
              className="flex-1 bg-gray-300 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-400"
            >
              关闭
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VideoOperationModals;