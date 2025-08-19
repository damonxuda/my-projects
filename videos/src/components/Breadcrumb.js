import React from 'react';
import { Home } from 'lucide-react';

const Breadcrumb = ({ path, onNavigate }) => {
  const pathParts = path === '' ? [] : path.split('/');
  
  return (
    <div className="flex items-center gap-2 mb-6 p-4 bg-gray-50 rounded-lg border">
      <button
        onClick={() => onNavigate('')}
        className="flex items-center gap-2 px-3 py-1 hover:bg-gray-200 rounded-md transition-colors"
      >
        <Home size={16} />
        <span>根目录</span>
      </button>
      
      {pathParts.map((part, index) => {
        const currentPath = pathParts.slice(0, index + 1).join('/');
        return (
          <React.Fragment key={index}>
            <span className="text-gray-400">/</span>
            <button
              onClick={() => onNavigate(currentPath)}
              className="px-3 py-1 hover:bg-gray-200 rounded-md transition-colors"
            >
              {part}
            </button>
          </React.Fragment>
        );
      })}
    </div>
  );
};

export default Breadcrumb;