'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import DictionaryModal from './DictionaryModal';

interface TextSelectionMenuProps {
  userId: string;
}

export default function TextSelectionMenu({ userId }: TextSelectionMenuProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [selection, setSelection] = useState('');
  const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0 });
  const [dictionaryModalOpen, setDictionaryModalOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleMouseUp = () => {
      const selectedText = window.getSelection()?.toString().trim();
      
      if (selectedText && selectedText.length > 0) {
        const range = window.getSelection()?.getRangeAt(0);
        if (range) {
          const rect = range.getBoundingClientRect();
          setMenuPosition({
            x: rect.left + rect.width / 2,
            y: rect.top - 10
          });
          setSelection(selectedText);
          setIsVisible(true);
        }
      } else {
        setIsVisible(false);
      }
    };

    const handleMouseDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsVisible(false);
      }
    };

    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('mousedown', handleMouseDown);

    return () => {
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('mousedown', handleMouseDown);
    };
  }, []);

  // Handle excerpt creation
  const addToExcerpts = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    console.log('Adding excerpt:', selection);
    
    // 显示加载状态
    const button = e.target as HTMLButtonElement;
    const originalText = button.textContent;
    button.textContent = '保存中...';
    button.disabled = true;
    
    try {
      const { error } = await supabase
        .from('excerpts')
        .insert({
          user_id: userId,
          content: selection,
          source_url: window.location.href
        });

      if (error) {
        console.error('Error adding excerpt:', error);
        alert(`摘抄失败：${error.message || '未知错误'}\n\n请检查网络连接或稍后重试。`);
      } else {
        // 显示成功消息
        alert('✅ 摘抄已成功保存到摘抄本！');
        
        // 触发自定义事件通知其他组件刷新
        const event = new CustomEvent('excerptAdded', { detail: { content: selection } });
        document.dispatchEvent(event);
      }
    } catch (error) {
      console.error('Error adding excerpt:', error);
      alert(`摘抄失败：网络错误\n\n${error instanceof Error ? error.message : '请检查网络连接后重试'}`);
    } finally {
      // 恢复按钮状态
      button.textContent = originalText;
      button.disabled = false;
    }
    
    setIsVisible(false);
  };

  // Handle AI question button
  const handleAskAI = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    console.log('Asking AI about:', selection);
    
    // 添加"请你为我解释："前缀
    const formattedQuestion = `请你为我解释：${selection}`;
    
    // Set input value in the AI chat and open it
    // Since we can't directly control the chat component, we'll use a custom event
    const event = new CustomEvent('askAI', { detail: { question: formattedQuestion } });
    document.dispatchEvent(event);
    
    // Hide menu
    setIsVisible(false);
  };

  // Handle dictionary lookup
  const handleDictionaryLookup = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    console.log('Looking up dictionary for:', selection);
    
    // 打开词典弹窗而不是跳转页面
    setDictionaryModalOpen(true);
    setIsVisible(false);
  };

  return (
    <>
      {isVisible && (
        <div
          ref={menuRef}
          className="fixed z-[1000] bg-white rounded-lg shadow-lg p-2 flex gap-2"
          style={{ left: `${menuPosition.x}px`, top: `${menuPosition.y}px`, transform: 'translateX(-50%)' }}
        >
          <button 
            className="px-3 py-1 bg-green-500 text-white rounded text-sm hover:bg-green-600 transition-colors"
            onClick={addToExcerpts}
          >
            摘抄
          </button>
          <button 
            className="px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600 transition-colors"
            onClick={handleAskAI}
          >
            提问AI
          </button>
          {selection.length <= 3 && (
            <button 
              className="px-3 py-1 bg-gray-500 text-white rounded text-sm hover:bg-gray-600 transition-colors"
              onClick={handleDictionaryLookup}
            >
              查找词典
            </button>
          )}
        </div>
      )}

      {/* 词典弹窗 */}
      <DictionaryModal
        isOpen={dictionaryModalOpen}
        onClose={() => setDictionaryModalOpen(false)}
        searchQuery={selection}
        userId={userId}
      />
    </>
  );
}