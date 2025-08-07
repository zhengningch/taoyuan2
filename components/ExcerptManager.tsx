'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

interface Excerpt {
  id: string;
  content: string;
  source_url?: string;
  notes?: string;
  created_at: string;
}

interface ExcerptManagerProps {
  userId: string;
}

export default function ExcerptManager({ userId }: ExcerptManagerProps) {
  const [excerpts, setExcerpts] = useState<Excerpt[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredExcerpts, setFilteredExcerpts] = useState<Excerpt[]>([]);
  const [generatingEssay, setGeneratingEssay] = useState<string | null>(null);
  const [essayModalOpen, setEssayModalOpen] = useState(false);
  const [essayContent, setEssayContent] = useState('');
  const [currentExcerptId, setCurrentExcerptId] = useState<string | null>(null);
  const [editingNotes, setEditingNotes] = useState<string | null>(null);
  const [notesContent, setNotesContent] = useState('');
  const [editingContent, setEditingContent] = useState<string | null>(null);
  const [excerptContent, setExcerptContent] = useState('');
  const [excerptError, setExcerptError] = useState<string | null>(null);

  useEffect(() => {
    loadExcerpts();
  }, [userId]);

  useEffect(() => {
    // 监听摘抄添加事件
    const handleExcerptAdded = () => {
      loadExcerpts();
    };

    document.addEventListener('excerptAdded', handleExcerptAdded);
    
    return () => {
      document.removeEventListener('excerptAdded', handleExcerptAdded);
    };
  }, []);

  useEffect(() => {
    if (!searchTerm.trim()) {
      setFilteredExcerpts(excerpts);
    } else {
      const filtered = excerpts.filter(excerpt =>
        excerpt.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (excerpt.notes && excerpt.notes.toLowerCase().includes(searchTerm.toLowerCase()))
      );
      setFilteredExcerpts(filtered);
    }
  }, [searchTerm, excerpts]);

  const loadExcerpts = async () => {
    try {
      setExcerptError(null); // 清除之前的错误
      const { data, error } = await supabase
        .from('excerpts')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error loading excerpts:', error);
        setExcerptError(`数据库错误：${error.message}`);
        setExcerpts([]);
      } else {
        setExcerpts(data || []);
        setExcerptError(null);
      }
    } catch (error) {
      console.error('Error loading excerpts:', error);
      setExcerptError(`网络错误：${error instanceof Error ? error.message : '请检查网络连接'}`);
      setExcerpts([]);
    } finally {
      setLoading(false);
    }
  };

  const generateEssay = async (excerpt: Excerpt) => {
    setGeneratingEssay(excerpt.id);
    setEssayModalOpen(true);
    setEssayContent('');
    setCurrentExcerptId(excerpt.id);

    try {
      const message = `根据这句话，生成一段高中思辨类作文的段落例文，请注意语言的整散结合，优美和简洁：\n${excerpt.content}`;
      
      const response = await fetch('/api/essay', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ message })
      });

      const data = await response.json();
      
      if (response.ok) {
        setEssayContent(data.reply || '生成范文失败，请稍后再试');
      } else {
        setEssayContent(`生成范文失败：${data.error || '未知错误'}`);
      }
    } catch (error) {
      console.error('生成范文时出错:', error);
      setEssayContent('生成范文时出错，请稍后再试');
    } finally {
      setGeneratingEssay(null);
    }
  };

  const saveNotesToExcerpt = async () => {
    if (!currentExcerptId || !essayContent) {
      alert('无法保存笔记：缺少必要信息');
      return;
    }

    try {
      const { error } = await supabase
        .from('excerpts')
        .update({ notes: essayContent })
        .eq('id', currentExcerptId)
        .eq('user_id', userId);

      if (error) {
        console.error('Error saving notes:', error);
        alert('保存笔记失败：' + error.message);
      } else {
        // Update local state
        setExcerpts(excerpts.map(excerpt => 
          excerpt.id === currentExcerptId 
            ? { ...excerpt, notes: essayContent }
            : excerpt
        ));
        setEssayModalOpen(false);
        alert('笔记已保存');
      }
    } catch (error) {
      console.error('Error saving notes:', error);
      alert('保存笔记失败');
    }
  };

  const startEditingNotes = (excerpt: Excerpt) => {
    setEditingNotes(excerpt.id);
    setNotesContent(excerpt.notes || '');
  };

  const saveEditedNotes = async (excerptId: string) => {
    try {
      const { error } = await supabase
        .from('excerpts')
        .update({ notes: notesContent })
        .eq('id', excerptId)
        .eq('user_id', userId);

      if (error) {
        console.error('Error updating notes:', error);
        alert('更新笔记失败：' + error.message);
      } else {
        setExcerpts(excerpts.map(excerpt => 
          excerpt.id === excerptId 
            ? { ...excerpt, notes: notesContent }
            : excerpt
        ));
        setEditingNotes(null);
        setNotesContent('');
        alert('笔记已更新');
      }
    } catch (error) {
      console.error('Error updating notes:', error);
      alert('更新笔记失败');
    }
  };

  const cancelEditingNotes = () => {
    setEditingNotes(null);
    setNotesContent('');
  };

  const startEditingContent = (excerpt: Excerpt) => {
    setEditingContent(excerpt.id);
    setExcerptContent(excerpt.content);
  };

  const saveEditedContent = async (excerptId: string) => {
    if (!excerptContent.trim()) {
      alert('摘抄内容不能为空');
      return;
    }

    try {
      const { error } = await supabase
        .from('excerpts')
        .update({ content: excerptContent })
        .eq('id', excerptId)
        .eq('user_id', userId);

      if (error) {
        console.error('Error updating content:', error);
        alert('更新摘抄失败：' + error.message);
      } else {
        setExcerpts(excerpts.map(excerpt => 
          excerpt.id === excerptId 
            ? { ...excerpt, content: excerptContent }
            : excerpt
        ));
        setEditingContent(null);
        setExcerptContent('');
        alert('摘抄已更新');
      }
    } catch (error) {
      console.error('Error updating content:', error);
      alert('更新摘抄失败');
    }
  };

  const cancelEditingContent = () => {
    setEditingContent(null);
    setExcerptContent('');
  };

  const deleteExcerpt = async (id: string) => {
    if (!confirm('确定要删除这条摘抄吗？')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('excerpts')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('Error deleting excerpt:', error);
        alert('删除失败');
      } else {
        setExcerpts(excerpts.filter(excerpt => excerpt.id !== id));
      }
    } catch (error) {
      console.error('Error deleting excerpt:', error);
      alert('删除失败');
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('zh-CN');
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-3xl font-bold text-gray-800 mb-6">我的摘抄</h1>
      
      {/* 搜索框 */}
      <div className="mb-6">
        <input
          type="text"
          placeholder="搜索摘抄内容..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* 摘抄列表 */}
      {filteredExcerpts.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-6xl mb-4">📝</div>
          <p className="text-gray-500 text-lg mb-2">
            {searchTerm ? '没有找到匹配的摘抄' : '还没有摘抄内容'}
          </p>
          {!searchTerm && (
            <div className="text-gray-400 space-y-2">
              <p>在任何页面选择文本后点击"摘抄"按钮来添加摘抄</p>
              <div className="text-sm mt-4 p-4 bg-blue-50 rounded-lg max-w-md mx-auto">
                <p className="font-medium text-blue-800 mb-2">💡 使用提示：</p>
                <ul className="text-blue-700 text-left space-y-1">
                  <li>• 选中任意文本即可看到摘抄按钮</li>
                  <li>• 摘抄会自动保存页面标题和链接</li>
                  <li>• 可以为摘抄生成AI范文和添加笔记</li>
                </ul>
              </div>
              {excerptError && (
                <div className="text-sm mt-4 p-4 bg-red-50 rounded-lg max-w-md mx-auto">
                  <p className="font-medium text-red-800 mb-2">⚠️ 加载失败：</p>
                  <p className="text-red-700">{excerptError}</p>
                  <button
                    onClick={loadExcerpts}
                    className="mt-2 px-3 py-1 bg-red-500 text-white rounded text-sm hover:bg-red-600"
                  >
                    重新加载
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {filteredExcerpts.map((excerpt) => (
            <div key={excerpt.id} className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
              <div className="flex justify-between items-start mb-3">
                <div className="flex-1">
                  {/* 摘抄内容部分 */}
                  <div className="mb-3">
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="text-sm font-medium text-gray-700">摘抄内容</h4>
                      <button
                        onClick={() => startEditingContent(excerpt)}
                        className="text-xs text-blue-500 hover:text-blue-700"
                      >
                        编辑
                      </button>
                    </div>
                    {editingContent === excerpt.id ? (
                      <div>
                        <textarea
                          value={excerptContent}
                          onChange={(e) => setExcerptContent(e.target.value)}
                          className="w-full p-3 border border-gray-300 rounded-lg text-gray-800 leading-relaxed"
                          rows={4}
                          placeholder="请输入摘抄内容..."
                        />
                        <div className="flex gap-2 mt-2">
                          <button
                            onClick={() => saveEditedContent(excerpt.id)}
                            className="px-2 py-1 bg-green-500 text-white rounded text-xs hover:bg-green-600"
                          >
                            保存
                          </button>
                          <button
                            onClick={cancelEditingContent}
                            className="px-2 py-1 bg-gray-500 text-white rounded text-xs hover:bg-gray-600"
                          >
                            取消
                          </button>
                        </div>
                      </div>
                    ) : (
                      <p className="text-gray-800 leading-relaxed bg-gray-50 p-3 rounded-lg">
                        {excerpt.content}
                      </p>
                    )}
                  </div>
                  
                  {/* 笔记部分 */}
                  {excerpt.notes && (
                    <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                      <div className="flex justify-between items-start mb-2">
                        <h4 className="text-sm font-medium text-gray-700">笔记</h4>
                        <button
                          onClick={() => startEditingNotes(excerpt)}
                          className="text-xs text-blue-500 hover:text-blue-700"
                        >
                          编辑
                        </button>
                      </div>
                      {editingNotes === excerpt.id ? (
                        <div>
                          <textarea
                            value={notesContent}
                            onChange={(e) => setNotesContent(e.target.value)}
                            className="w-full p-2 border border-gray-300 rounded text-sm"
                            rows={4}
                          />
                          <div className="flex gap-2 mt-2">
                            <button
                              onClick={() => saveEditedNotes(excerpt.id)}
                              className="px-2 py-1 bg-green-500 text-white rounded text-xs hover:bg-green-600"
                            >
                              保存
                            </button>
                            <button
                              onClick={cancelEditingNotes}
                              className="px-2 py-1 bg-gray-500 text-white rounded text-xs hover:bg-gray-600"
                            >
                              取消
                            </button>
                          </div>
                        </div>
                      ) : (
                        <p className="text-gray-600 text-sm whitespace-pre-wrap">
                          {excerpt.notes}
                        </p>
                      )}
                    </div>
                  )}
                  
                  <div className="flex items-center justify-between text-sm text-gray-500 mt-3">
                    <span>{formatDate(excerpt.created_at)}</span>
                  </div>
                </div>
                <div className="ml-4 flex gap-2">
                  <button
                    onClick={() => generateEssay(excerpt)}
                    disabled={generatingEssay === excerpt.id}
                    className="px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600 transition-colors disabled:opacity-50"
                  >
                    {generatingEssay === excerpt.id ? '生成中...' : '生成范文'}
                  </button>
                  <button
                    onClick={() => deleteExcerpt(excerpt.id)}
                    className="px-3 py-1 bg-red-500 text-white rounded text-sm hover:bg-red-600 transition-colors"
                  >
                    删除
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 范文弹窗 */}
      {essayModalOpen && (
        <div className="fixed top-4 right-4 z-50">
          <div className="bg-white rounded-lg p-4 max-w-md w-80 shadow-lg border border-gray-200">
            <div className="flex justify-between items-center mb-3">
              <h2 className="text-lg font-bold text-gray-800">AI生成范文</h2>
              <button
                onClick={() => setEssayModalOpen(false)}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <span className="text-xl">&times;</span>
              </button>
            </div>
            
            <div className="overflow-y-auto max-h-60 mb-3">
              {generatingEssay ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                  <span className="ml-2">正在生成范文...</span>
                </div>
              ) : (
                <div className="whitespace-pre-wrap text-gray-800 leading-relaxed text-sm">
                  {essayContent}
                </div>
              )}
            </div>
            
            <div className="flex justify-end gap-1">
              <button
                onClick={saveNotesToExcerpt}
                className="px-2 py-1 bg-blue-500 text-white rounded text-xs hover:bg-blue-600 transition-colors"
                disabled={!essayContent || generatingEssay !== null}
              >
                加入笔记
              </button>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(essayContent);
                  alert('范文已复制到剪贴板');
                }}
                className="px-2 py-1 bg-green-500 text-white rounded text-xs hover:bg-green-600 transition-colors"
                disabled={!essayContent || generatingEssay !== null}
              >
                复制范文
              </button>
              <button
                onClick={() => setEssayModalOpen(false)}
                className="px-2 py-1 bg-gray-500 text-white rounded text-xs hover:bg-gray-600 transition-colors"
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}