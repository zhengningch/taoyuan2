'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';


interface DictionaryEntry {
  字: string;
  解释: string;
}

interface DictionaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  searchQuery: string;
  userId?: string;
}

export default function DictionaryModal({ isOpen, onClose, searchQuery, userId }: DictionaryModalProps) {
  const [entries, setEntries] = useState<DictionaryEntry[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && searchQuery) {
      loadDictionaryEntries();
    }
  }, [isOpen, searchQuery]);

  const loadDictionaryEntries = async () => {
    setLoading(true);
    try {
      const response = await fetch('/data/dictionary.json');
      const data: DictionaryEntry[] = await response.json();
      
      // Filter entries that match the search query by character only
      const filtered = data.filter(entry => 
        entry.字.includes(searchQuery)
      );
      
      setEntries(filtered);
    } catch (error) {
      console.error('Error loading dictionary:', error);
    } finally {
      setLoading(false);
    }
  };

  const addToReviewCards = async (entry: DictionaryEntry) => {
    if (!userId) {
      alert('请先登录');
      return;
    }

    try {
      // Check if already exists
      const { data: existing } = await supabase
        .from('review_cards')
        .select('id')
        .eq('user_id', userId)
        .eq('word', entry.字)
        .single();

      if (existing) {
        alert('该词条已在复习本中');
        return;
      }

      // 生成图片
      let imageUrl = '';
      try {
        console.log('正在为字词生成图片:', entry.字);
        const imageResponse = await fetch('/api/generate-review-image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            word: entry.字,
            sentence: '',
            meaning: entry.解释,
            dictionaryInfo: { explanation: entry.解释 }
          })
        });
        
        if (imageResponse.ok) {
          const imageResult = await imageResponse.json();
          if (imageResult.success && imageResult.imageUrl) {
            imageUrl = imageResult.imageUrl;
            console.log('图片生成成功:', entry.字);
          }
        } else {
          console.error('图片生成失败:', await imageResponse.text());
        }
      } catch (error) {
        console.error('图片生成过程出错:', error);
      }

      const { error } = await supabase
        .from('review_cards')
        .insert({
          user_id: userId,
          word: entry.字,
          explanation: entry.解释,
          image_url: imageUrl
        });

      if (error) {
        console.error('Error adding to review cards:', error);
        alert('添加到复习本失败：' + error.message);
      } else {
        alert('已添加到复习本');
      }
    } catch (error) {
      console.error('Error adding to review cards:', error);
      alert('添加到复习本失败');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed top-4 right-4 z-50">
      <div className="bg-white rounded-lg p-4 max-w-sm w-72 shadow-lg border border-gray-200 max-h-96 overflow-hidden">
        {/* Header */}
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-lg font-bold text-gray-800">
            查找: "{searchQuery}"
          </h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded"
          >
            <span className="text-xl">&times;</span>
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto max-h-64">
          {loading ? (
            <div className="flex justify-center py-4">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
            </div>
          ) : entries.length > 0 ? (
            <div className="space-y-3">
              {entries.map((entry, index) => (
                <div key={index} className="border border-gray-200 rounded-lg p-3">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <h3 className="text-base font-semibold text-blue-600 mb-1">
                        {entry.字}
                      </h3>
                      <p className="text-gray-700 text-sm leading-relaxed mb-2">
                        {entry.解释}
                      </p>
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <button
                      onClick={() => addToReviewCards(entry)}
                      className="px-2 py-1 bg-green-500 text-white rounded text-xs hover:bg-green-600 transition-colors"
                    >
                      加入复习本
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-6 text-gray-500 text-sm">
              未找到相关词条
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="mt-4 flex justify-end">
          <button
            onClick={onClose}
            className="px-3 py-1 bg-gray-500 text-white rounded text-sm hover:bg-gray-600 transition-colors"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  );
}