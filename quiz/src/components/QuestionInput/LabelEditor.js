import React, { useState, useEffect } from 'react';
import { Edit2, Check, X, Plus } from 'lucide-react';

// 临时的 parseLabels 函数（之后从 tagParser.js 导入）
const parseLabels = (input) => {
  console.log('解析标签输入:', input);
  
  const tags = [];
  
  // 解析老师/机构
  if (input.includes('岛主')) tags.push('岛主');
  else if (input.includes('普老师')) tags.push('普老师');
  else tags.push('岛主');
  
  // 解析学期
  const semesterMatch = input.match(/(四|五|六)(竞|上|下|暑)/);
  if (semesterMatch) {
    tags.push(semesterMatch[0]);
  } else {
    tags.push('五竞暑');
  }
  
  // 解析讲次
  const lessonMatch = input.match(/第(\d+|十?\d*)讲/) || input.match(/(\d+)讲/);
  if (lessonMatch) {
    let num = lessonMatch[1];
    if (num.includes('十')) {
      if (num === '十') num = '10';
      else if (num.includes('十')) {
        const parts = num.split('十');
        num = (parseInt(parts[0]) || 1) * 10 + (parseInt(parts[1]) || 0);
      }
    }
    tags.push(`第${parseInt(num) || 1}讲`);
  } else {
    tags.push('第1讲');
  }
  
  // 解析课程名称
  const titleMatch = input.match(/第\d+讲(.+?)(?:$|[，,])/) || 
                    input.match(/(计数|计算|几何|数论|应用题|行程|组合|综合)[^，,]*/) ||
                    input.match(/([一二三四五六七八九十]+)$/);
  if (titleMatch) {
    const title = titleMatch[1].trim();
    if (title && title.length > 0) {
      tags.push(title);
    }
  }
  
  // 智能分类推断
  let category = '';
  if (input.includes('计数')) category = '计数';
  else if (input.includes('组合')) category = '组合';
  else if (input.includes('行程')) category = '行程';
  else if (input.includes('几何')) category = '几何';
  else if (input.includes('数论')) category = '数论';
  else if (input.includes('应用')) category = '应用题';
  else if (input.includes('计算')) category = '计算';
  
  if (category) tags.push(category);
  
  console.log('解析结果标签:', tags);
  return tags;
};

const LabelEditor = ({ onConfirm, onCancel, mathCategories }) => {
  const [labelInput, setLabelInput] = useState('');
  const [parsedTags, setParsedTags] = useState([]);
  const [editableTags, setEditableTags] = useState([]);

  const handleLabelInputChange = (input) => {
    setLabelInput(input);
    const parsed = parseLabels(input);
    setParsedTags(parsed);
    setEditableTags([...parsed]);
  };

  const updateEditableTag = (index, newValue) => {
    const newTags = [...editableTags];
    newTags[index] = newValue;
    setEditableTags(newTags);
  };

  const addEditableTag = () => {
    setEditableTags([...editableTags, '新标签']);
  };

  const removeEditableTag = (index) => {
    const newTags = editableTags.filter((_, i) => i !== index);
    setEditableTags(newTags);
  };

  const handleConfirm = () => {
    if (editableTags.length === 0) {
      alert('请至少设置一个标签！');
      return;
    }
    onConfirm(editableTags);
  };

  return (
    <div className="bg-purple-50 p-4 rounded-lg mb-4">
      <h4 className="font-medium text-purple-800 mb-3">🏷️ 智能标签识别</h4>
      
      <div className="mb-3">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          输入课程信息（如：岛主五竞暑第13讲计数综合二）
        </label>
        <input
          type="text"
          value={labelInput}
          onChange={(e) => handleLabelInputChange(e.target.value)}
          className="w-full p-3 border border-gray-300 rounded-lg"
          placeholder="岛主五竞暑第13讲计数综合二"
        />
      </div>
      
      {labelInput && (
        <div className="bg-white p-3 rounded border mb-3">
          <h5 className="font-medium text-gray-700 mb-2">📝 AI解析结果（可手动修改）：</h5>
          <div className="space-y-2">
            {editableTags.map((tag, index) => (
              <div key={index} className="flex items-center gap-2">
                <input
                  type="text"
                  value={tag}
                  onChange={(e) => updateEditableTag(index, e.target.value)}
                  className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm"
                />
                <button
                  onClick={() => removeEditableTag(index)}
                  className="text-red-500 hover:text-red-700 text-sm px-2"
                >
                  <X size={16} />
                </button>
              </div>
            ))}
            <button
              onClick={addEditableTag}
              className="text-blue-500 hover:text-blue-700 text-sm px-2 py-1 border border-blue-300 rounded flex items-center gap-1"
            >
              <Plus size={14} />
              添加标签
            </button>
          </div>
          
          <div className="mt-3 text-xs text-gray-600">
            <p><strong>奥数七大分类：</strong> {mathCategories.join('、')}</p>
            <p><strong>建议标签顺序：</strong> [老师] [学期] [讲次] [课程名] [分类]</p>
          </div>
        </div>
      )}
      
      <div className="flex gap-2 mt-3">
        <button
          onClick={handleConfirm}
          className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg flex items-center gap-2"
          disabled={editableTags.length === 0}
        >
          <Check size={16} />
          确认标签
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

export default LabelEditor;