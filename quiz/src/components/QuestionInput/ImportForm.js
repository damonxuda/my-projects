// src/components/QuestionInput/ImportForm.js
// 智能导入表单组件 - 简化版 (仅Clerk认证)

import React, { useState } from 'react';
import { Check, X, Edit2, AlertCircle, FileText } from 'lucide-react';
import LabelEditor from './LabelEditor';
import { parseMarkdownQuestions, validateParseResult, detectDuplicates } from '../../utils/markdownParser';

const ImportForm = ({ onQuestionsImported, onCancel, existingQuestions, db, user, mathCategories }) => {
  const [importText, setImportText] = useState('');
  const [baseTags, setBaseTags] = useState([]);
  const [showLabelEditor, setShowLabelEditor] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [previewResults, setPreviewResults] = useState(null);

  const handleTagsConfirmed = (tags) => {
    setBaseTags(tags);
    setShowLabelEditor(false);
  };

  const handlePreview = () => {
    if (!importText.trim()) {
      alert('请先输入markdown内容');
      return;
    }

    if (baseTags.length === 0) {
      alert('请先设置课程标签');
      return;
    }

    if (!user) {
      alert('请先登录再预览题目');
      return;
    }

    setIsProcessing(true);
    
    try {
      // 解析markdown
      const parsed = parseMarkdownQuestions(importText, baseTags);
      
      // 验证解析结果
      const validation = validateParseResult(parsed);
      
      // 检测重复
      const duplicationCheck = detectDuplicates(parsed, existingQuestions);
      
      setPreviewResults({
        questions: duplicationCheck.uniqueQuestions,
        validation,
        duplicates: duplicationCheck.duplicates,
        totalParsed: parsed.length,
        uniqueCount: duplicationCheck.uniqueCount,
        duplicateCount: duplicationCheck.duplicateCount
      });
    } catch (error) {
      console.error('解析失败:', error);
      alert('解析失败: ' + error.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleImport = async () => {
    if (!previewResults || previewResults.uniqueCount === 0) {
      alert('没有可导入的题目');
      return;
    }

    if (!user) {
      alert('请先登录再导入题目');
      return;
    }

    setIsProcessing(true);
    
    try {
      const { questions } = previewResults;
      const savedQuestions = [];
      const failedQuestions = [];

      // 保存到数据库 (简化版 - 无权限验证)
      for (const question of questions) {
        try {
          const result = await db.addQuestion(question);
          if (result.success) {
            savedQuestions.push(result.data);
          } else {
            failedQuestions.push({ question, error: result.error });
          }
        } catch (error) {
          failedQuestions.push({ question, error: error.message });
        }
      }

      if (savedQuestions.length > 0) {
        // 通知父组件更新题目列表
        onQuestionsImported(savedQuestions);
        
        // 重置状态
        setImportText('');
        setBaseTags([]);
        setPreviewResults(null);
        
        if (failedQuestions.length > 0) {
          alert(`成功导入 ${savedQuestions.length} 道题目，${failedQuestions.length} 道题目导入失败。`);
        } else {
          alert(`成功导入 ${savedQuestions.length} 道题目！`);
        }
      } else {
        throw new Error('所有题目导入失败');
      }
    } catch (error) {
      console.error('导入失败:', error);
      alert('导入失败: ' + error.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const resetForm = () => {
    setImportText('');
    setBaseTags([]);
    setPreviewResults(null);
    setShowLabelEditor(false);
  };

  // 简化的权限检查 - 只需要登录
  const canImport = () => {
    return user && user.emailAddresses && user.emailAddresses.length > 0;
  };

  return (
    <div className="bg-blue-50 p-6 rounded-lg space-y-4">
      <h3 className="text-lg font-semibold text-blue-800 mb-4 flex items-center gap-2">
        <FileText size={20} />
        智能导入 - AI解析文档
      </h3>

      {/* 简化的权限检查提示 */}
      {!canImport() && (
        <div className="bg-amber-50 border border-amber-200 p-4 rounded-lg">
          <div className="flex items-center gap-2">
            <AlertCircle size={16} className="text-amber-600" />
            <span className="font-medium text-amber-800">
              请先登录后再导入题目。
            </span>
          </div>
        </div>
      )}

      {/* 标签编辑器 */}
      {showLabelEditor ? (
        <LabelEditor
          onConfirm={handleTagsConfirmed}
          onCancel={() => setShowLabelEditor(false)}
          initialTags={baseTags}
          mathCategories={mathCategories}
        />
      ) : (
        <div className="space-y-4">
          {/* 标签状态显示 */}
          {baseTags.length === 0 ? (
            <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle size={16} className="text-yellow-600" />
                <span className="font-medium text-yellow-800">请先设置课程标签</span>
              </div>
              <button
                onClick={() => setShowLabelEditor(true)}
                disabled={!canImport()}
                className={`px-4 py-2 rounded-lg flex items-center gap-2 ${
                  canImport()
                    ? 'bg-purple-500 hover:bg-purple-600 text-white'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
              >
                <Edit2 size={16} />
                设置课程标签
              </button>
            </div>
          ) : (
            <div className="bg-white p-4 rounded-lg border">
              <div className="flex justify-between items-center mb-2">
                <span className="font-medium text-gray-700">已设置的标签：</span>
                <button
                  onClick={() => setShowLabelEditor(true)}
                  disabled={!canImport()}
                  className={`text-sm flex items-center gap-1 ${
                    canImport()
                      ? 'text-purple-600 hover:text-purple-700'
                      : 'text-gray-400 cursor-not-allowed'
                  }`}
                >
                  <Edit2 size={14} />
                  修改标签
                </button>
              </div>
              <div className="flex flex-wrap gap-1">
                {baseTags.map((tag, index) => (
                  <span
                    key={index}
                    className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Markdown输入 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              粘贴markdown文档内容
            </label>
            <textarea
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              rows={12}
              className="w-full p-3 border border-gray-300 rounded-lg font-mono text-sm"
              placeholder="粘贴AI解析的markdown文档内容，支持以下格式：
## 例1. 题目内容
题目描述...

### 解题思路
解题步骤...

**最终答案: 答案内容**

## 例2. 下一道题目..."
              disabled={isProcessing || !canImport()}
            />
          </div>

          {/* 预览结果 */}
          {previewResults && (
            <div className="bg-white p-4 rounded-lg border">
              <h4 className="font-medium text-gray-800 mb-3">📊 解析预览结果</h4>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">
                    {previewResults.totalParsed}
                  </div>
                  <div className="text-sm text-gray-600">解析总数</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {previewResults.uniqueCount}
                  </div>
                  <div className="text-sm text-gray-600">可导入</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-orange-600">
                    {previewResults.duplicateCount}
                  </div>
                  <div className="text-sm text-gray-600">重复</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-600">
                    {previewResults.validation.statistics.withAnswers}
                  </div>
                  <div className="text-sm text-gray-600">有答案</div>
                </div>
              </div>

              {/* 题目类型统计 */}
              {Object.keys(previewResults.validation.statistics.byType).length > 0 && (
                <div className="mb-4">
                  <h5 className="font-medium text-gray-700 mb-2">题目类型分布：</h5>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(previewResults.validation.statistics.byType).map(([type, count]) => (
                      <span key={type} className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs">
                        {type}: {count}道
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* 警告信息 */}
              {previewResults.validation.issues.length > 0 && (
                <div className="bg-yellow-50 border border-yellow-200 p-3 rounded mb-4">
                  <h5 className="font-medium text-yellow-800 mb-2">⚠️ 发现问题：</h5>
                  <ul className="text-sm text-yellow-700 space-y-1">
                    {previewResults.validation.issues.map((issue, index) => (
                      <li key={index}>• {issue}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* 简化的用户状态信息 */}
          {canImport() && (
            <div className="bg-green-50 border border-green-200 p-3 rounded-lg">
              <p className="text-sm text-green-800">
                ✅ <strong>已登录：</strong>您可以导入题目到题库。
              </p>
            </div>
          )}

          {/* 操作按钮 */}
          <div className="flex gap-2">
            {!previewResults ? (
              <>
                <button
                  onClick={handlePreview}
                  className={`px-4 py-2 rounded-lg flex items-center gap-2 ${
                    canImport() && !isProcessing && importText.trim() && baseTags.length > 0
                      ? 'bg-blue-500 hover:bg-blue-600 text-white'
                      : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  }`}
                  disabled={!canImport() || !importText.trim() || baseTags.length === 0 || isProcessing}
                >
                  {isProcessing ? '解析中...' : '预览解析结果'}
                </button>
                <button
                  onClick={resetForm}
                  disabled={!canImport()}
                  className={`px-4 py-2 rounded-lg ${
                    canImport()
                      ? 'bg-gray-500 hover:bg-gray-600 text-white'
                      : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  }`}
                >
                  重置
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={handleImport}
                  className={`px-4 py-2 rounded-lg flex items-center gap-2 ${
                    canImport() && previewResults.uniqueCount > 0 && !isProcessing
                      ? 'bg-green-500 hover:bg-green-600 text-white'
                      : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  }`}
                  disabled={!canImport() || previewResults.uniqueCount === 0 || isProcessing}
                >
                  <Check size={16} />
                  {isProcessing ? '导入中...' : `确认导入 ${previewResults.uniqueCount} 道题目`}
                </button>
                <button
                  onClick={() => setPreviewResults(null)}
                  disabled={!canImport()}
                  className={`px-4 py-2 rounded-lg ${
                    canImport()
                      ? 'bg-orange-500 hover:bg-orange-600 text-white'
                      : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  }`}
                >
                  重新解析
                </button>
              </>
            )}
            
            <button
              onClick={onCancel}
              className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-lg flex items-center gap-2"
            >
              <X size={16} />
              取消
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ImportForm;