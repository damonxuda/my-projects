import React, { useState } from 'react';
import { Check, X } from 'lucide-react';

const ManualForm = ({ onSubmit, onCancel, categories, questionTypes }) => {
  const [newQuestion, setNewQuestion] = useState({
    tags: [],
    questionType: '例1',
    category: '计数',
    questionText: '',
    answer: '',
    solutionSteps: ''
  });

  const handleSubmit = () => {
    if (!newQuestion.questionText.trim()) {
      alert('请输入题目内容！');
      return;
    }

    // 构建标签数组
    const tags = [];
    if (newQuestion.category) {
      tags.push(newQuestion.category);
    }
    
    const questionToSubmit = {
      ...newQuestion,
      tags: [...tags, ...newQuestion.tags],
      createdAt: new Date().toISOString()
    };
    
    onSubmit(questionToSubmit);
    
    // 重置表单
    setNewQuestion({
      tags: [],
      questionType: '例1',
      category: '计数',
      questionText: '',
      answer: '',
      solutionSteps: ''
    });
  };

  const addCustomTag = () => {
    const tagInput = prompt('请输入自定义标签:');
    if (tagInput && tagInput.trim()) {
      setNewQuestion({
        ...newQuestion,
        tags: [...newQuestion.tags, tagInput.trim()]
      });
    }
  };

  const removeTag = (index) => {
    const newTags = newQuestion.tags.filter((_, i) => i !== index);
    setNewQuestion({ ...newQuestion, tags: newTags });
  };

  return (
    <div className="bg-gray-50 p-6 rounded-lg mb-6">
      <h3 className="text-lg font-semibold text-gray-800 mb-4">✏️ 手动添加题目</h3>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">题目类型</label>
          <select
            value={newQuestion.questionType}
            onChange={(e) => setNewQuestion({...newQuestion, questionType: e.target.value})}
            className="w-full p-2 border border-gray-300 rounded-lg"
          >
            {questionTypes.map(type => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">分类</label>
          <select
            value={newQuestion.category}
            onChange={(e) => setNewQuestion({...newQuestion, category: e.target.value})}
            className="w-full p-2 border border-gray-300 rounded-lg"
          >
            {categories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>
      </div>

      {/* 自定义标签 */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">自定义标签</label>
        <div className="flex gap-2 mb-2">
          <button
            onClick={addCustomTag}
            className="text-blue-500 hover:text-blue-700 text-sm px-3 py-1 border border-blue-300 rounded"
          >
            + 添加标签
          </button>
        </div>
        {newQuestion.tags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {newQuestion.tags.map((tag, index) => (
              <span
                key={index}
                className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-sm flex items-center gap-1"
              >
                {tag}
                <button
                  onClick={() => removeTag(index)}
                  className="text-blue-600 hover:text-blue-800"
                >
                  <X size={14} />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>
      
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">题目内容</label>
        <textarea
          value={newQuestion.questionText}
          onChange={(e) => setNewQuestion({...newQuestion, questionText: e.target.value})}
          rows={4}
          className="w-full p-2 border border-gray-300 rounded-lg"
          placeholder="输入题目文字..."
        />
      </div>
      
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">参考答案</label>
        <textarea
          value={newQuestion.answer}
          onChange={(e) => setNewQuestion({...newQuestion, answer: e.target.value})}
          rows={3}
          className="w-full p-2 border border-gray-300 rounded-lg"
          placeholder="输入参考答案..."
        />
      </div>
      
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">解题思路</label>
        <textarea
          value={newQuestion.solutionSteps}
          onChange={(e) => setNewQuestion({...newQuestion, solutionSteps: e.target.value})}
          rows={4}
          className="w-full p-2 border border-gray-300 rounded-lg"
          placeholder="详细的解题步骤和思路..."
        />
      </div>
      
      <div className="flex gap-2">
        <button
          onClick={handleSubmit}
          className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg flex items-center gap-2"
        >
          <Check size={16} />
          保存到数据库
        </button>
        <button
          onClick={onCancel}
          className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-lg flex items-center gap-2"
        >
          <X size={16} />
          取消
        </button>
      </div>
    </div>
  );
};

export default ManualForm;