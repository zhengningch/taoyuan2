'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

interface DictionaryEntry {
  字: string;
  解释: string;
}

interface DictionaryProps {
  userId: string;
}

export default function Dictionary({ userId }: DictionaryProps) {
  const [entries, setEntries] = useState<DictionaryEntry[]>([]);
  const [filteredEntries, setFilteredEntries] = useState<DictionaryEntry[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchType, setSearchType] = useState<'all' | 'word' | 'explanation'>('all');
  const [loading, setLoading] = useState(true);
  const [addingToReview, setAddingToReview] = useState<string | null>(null);

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    loadDictionary();
  }, []);

  useEffect(() => {
    if (searchTerm.trim() === '') {
      setFilteredEntries(entries);
    } else {
      const filtered = entries.filter(entry => {
        switch (searchType) {
          case 'word':
            return entry.字.includes(searchTerm);
          case 'explanation':
            return entry.解释.includes(searchTerm);
          case 'all':
          default:
            return entry.字.includes(searchTerm) || entry.解释.includes(searchTerm);
        }
      });
      setFilteredEntries(filtered);
    }
  }, [searchTerm, searchType, entries]);

  const loadDictionary = async () => {
    try {
      const response = await fetch('/data/dictionary.json');
      const data = await response.json();
      setEntries(data);
      setFilteredEntries(data);
    } catch (error) {
      console.error('加载词典失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const addToReviewBook = async (entry: DictionaryEntry) => {
    setAddingToReview(entry.字);
    try {
      const { error } = await supabase
        .from('review_cards')
        .insert({
          user_id: userId,
          word: entry.字,
          explanation: entry.解释,
          created_at: new Date().toISOString()
        });

      if (error) {
        console.error('添加到复习本失败:', error);
        alert('添加失败，请重试');
      } else {
        alert('已添加到复习本！');
      }
    } catch (error) {
      console.error('添加到复习本失败:', error);
      alert('添加失败，请重试');
    } finally {
      setAddingToReview(null);
    }
  };

  const formatExplanation = (explanation: string) => {
    // 简单的格式化，保留换行符
    return explanation.split('\n').map((line, index) => (
      <div key={index} className="mb-1">
        {line}
      </div>
    ));
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-lg text-gray-600">加载词典中...</div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* 搜索框 */}
      <div className="mb-6">
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setSearchType('all')}
            className={`px-3 py-1 rounded text-sm ${
              searchType === 'all' ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-700'
            }`}
          >
            全部
          </button>
          <button
            onClick={() => setSearchType('word')}
            className={`px-3 py-1 rounded text-sm ${
              searchType === 'word' ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-700'
            }`}
          >
            字
          </button>
          <button
            onClick={() => setSearchType('explanation')}
            className={`px-3 py-1 rounded text-sm ${
              searchType === 'explanation' ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-700'
            }`}
          >
            解释
          </button>
        </div>
        <div className="relative">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="搜索汉字或解释..."
            className="w-full px-4 py-3 text-lg border-2 border-gray-300 rounded-lg focus:outline-none focus:border-red-500 text-gray-900 bg-white"
          />
          <div className="absolute right-3 top-3 text-gray-400">
            🔍
          </div>
        </div>
        <div className="mt-2 text-sm text-gray-600">
          本字典来自《古汉语常用字字典》（王力）。共找到 {filteredEntries.length} 个词条
        </div>
      </div>

      {/* 词条列表 */}
      <div className="space-y-4">
        {filteredEntries.map((entry, index) => (
          <div key={index} className="bg-white rounded-lg shadow-md border border-gray-200 p-6">
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-2xl font-bold text-red-600">{entry.字}</h3>
              <button
                onClick={() => addToReviewBook(entry)}
                disabled={addingToReview === entry.字}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {addingToReview === entry.字 ? '添加中...' : '加入复习本'}
              </button>
            </div>
            <div className="text-gray-800 leading-relaxed">
              {formatExplanation(entry.解释)}
            </div>
          </div>
        ))}
      </div>

      {filteredEntries.length === 0 && searchTerm && (
        <div className="text-center py-12">
          <div className="text-gray-500 text-lg">未找到相关词条</div>
          <div className="text-gray-400 text-sm mt-2">请尝试其他关键词</div>
        </div>
      )}
    </div>
  );
}