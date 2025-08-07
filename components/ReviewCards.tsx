'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { X, Trash2, User, BookOpen, Plus, Edit, Check } from 'lucide-react';

interface ReviewCard {
  id: string;
  word: string;
  explanation: string;
  sentence?: string;
  meaning?: string;
  dictionary_info?: any;
  source_scenario_id?: string;
  mistake_count?: number;
  image_url?: string;
  created_at: string;
}

interface Persona {
  id: string;
  nickname: string;
  identity: string;
  tags: string[];
  is_default?: boolean;
  created_at?: string;
}

interface ExamContent {
  context: string;
  questions: {
    question: string;
    options?: {
      A: string;
      B: string;
      C: string;
      D: string;
    };
    answer: string;
  }[];
  rawContent: string;
}

interface ReviewCardsProps {
  userId: string;
}

export default function ReviewCards({ userId }: ReviewCardsProps) {
  const [cards, setCards] = useState<ReviewCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCard, setSelectedCard] = useState<ReviewCard | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [deletingCard, setDeletingCard] = useState<string | null>(null);
  
  // 人设管理相关状态
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [showPersonaModal, setShowPersonaModal] = useState(false);
  const [editingPersona, setEditingPersona] = useState<Persona | null>(null);
  const [newPersona, setNewPersona] = useState({ nickname: '', identity: '', tags: [] as string[] });
  const [customTag, setCustomTag] = useState('');
  
  // 考试相关状态
  const [selectedCards, setSelectedCards] = useState<string[]>([]);
  const [showExamModal, setShowExamModal] = useState(false);
  const [showExamContent, setShowExamContent] = useState(false);
  const [examContent, setExamContent] = useState<ExamContent | null>(null);
  const [selectedPersona, setSelectedPersona] = useState<Persona | null>(null);
  const [generatingExam, setGeneratingExam] = useState(false);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState<{[key: number]: string}>({});
  const [showResults, setShowResults] = useState(false);
  const [questionResults, setQuestionResults] = useState<{[key: number]: boolean}>({});
  const [showQuestionResult, setShowQuestionResult] = useState(false);

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    loadReviewCards();
    loadPersonas();
  }, [userId]);

  const loadPersonas = async () => {
    try {
      const { data, error } = await supabase
        .from('personas')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('加载人设失败:', error);
      } else {
        setPersonas(data || []);
      }
    } catch (error) {
      console.error('加载人设失败:', error);
    }
  };

  const loadReviewCards = async () => {
    try {
      const { data, error } = await supabase
        .from('review_cards')
        .select('*')
        .eq('user_id', userId)
        .order('mistake_count', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) {
        console.error('加载复习卡片失败:', error);
      } else {
        const cards = data || [];
        setCards(cards);
        
        // 检查并生成缺失的图片
        await generateMissingImages(cards);
      }
    } catch (error) {
      console.error('加载复习卡片失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateMissingImages = async (cards: ReviewCard[]) => {
    const cardsWithoutImages = cards.filter(card => !card.image_url);
    
    if (cardsWithoutImages.length === 0) return;
    
    console.log(`发现 ${cardsWithoutImages.length} 个卡片缺少图片，开始生成...`);
    
    for (const card of cardsWithoutImages) {
      try {
        const response = await fetch('/api/generate-review-image', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            word: card.word,
            sentence: card.sentence || '',
            meaning: card.meaning || card.explanation || '',
            dictionary_info: card.dictionary_info || {}
          }),
        });

        if (response.ok) {
          const result = await response.json();
          if (result.success && result.imageUrl) {
            // 更新数据库中的图片URL
            const { error: updateError } = await supabase
              .from('review_cards')
              .update({ image_url: result.imageUrl })
              .eq('id', card.id)
              .eq('user_id', userId);

            if (!updateError) {
              // 更新本地状态
              setCards(prevCards => 
                prevCards.map(c => 
                  c.id === card.id ? { ...c, image_url: result.imageUrl } : c
                )
              );
              console.log(`为卡片 "${card.word}" 生成图片成功`);
            } else {
              console.error(`更新卡片 "${card.word}" 图片URL失败:`, updateError);
            }
          } else {
            console.error(`为卡片 "${card.word}" 生成图片失败:`, result.error);
          }
        } else {
          console.error(`为卡片 "${card.word}" 生成图片请求失败:`, response.statusText);
        }
      } catch (error) {
        console.error(`为卡片 "${card.word}" 生成图片时发生错误:`, error);
      }
      
      // 添加延迟避免API请求过于频繁
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  };

  // 人设管理函数
  const savePersona = async () => {
    if (!newPersona.nickname || !newPersona.identity) {
      alert('请填写昵称和身份');
      return;
    }

    try {
      if (editingPersona) {
        // 更新现有人设
        const { error } = await supabase
          .from('personas')
          .update({
            nickname: newPersona.nickname,
            identity: newPersona.identity,
            tags: newPersona.tags
          })
          .eq('id', editingPersona.id)
          .eq('user_id', userId);

        if (error) {
          console.error('更新人设失败:', error);
          alert('更新失败，请重试');
        } else {
          await loadPersonas();
          resetPersonaForm();
        }
      } else {
        // 创建新人设
        const { error } = await supabase
          .from('personas')
          .insert({
            user_id: userId,
            nickname: newPersona.nickname,
            identity: newPersona.identity,
            tags: newPersona.tags
          });

        if (error) {
          console.error('保存人设失败:', error);
          alert('保存失败，请重试');
        } else {
          await loadPersonas();
          resetPersonaForm();
        }
      }
    } catch (error) {
      console.error('保存人设失败:', error);
      alert('保存失败，请重试');
    }
  };

  const deletePersona = async (personaId: string) => {
    if (!confirm('确定要删除这个人设吗？')) return;

    try {
      const { error } = await supabase
        .from('personas')
        .delete()
        .eq('id', personaId)
        .eq('user_id', userId);

      if (error) {
        console.error('删除人设失败:', error);
        alert('删除失败，请重试');
      } else {
        await loadPersonas();
      }
    } catch (error) {
      console.error('删除人设失败:', error);
      alert('删除失败，请重试');
    }
  };

  const editPersona = (persona: Persona) => {
    setEditingPersona(persona);
    setNewPersona({
      nickname: persona.nickname,
      identity: persona.identity,
      tags: [...persona.tags]
    });
  };

  const resetPersonaForm = () => {
    setEditingPersona(null);
    setNewPersona({ nickname: '', identity: '', tags: [] });
    setCustomTag('');
  };

  const addTag = (tag: string) => {
    if (newPersona.tags.length < 2 && !newPersona.tags.includes(tag)) {
      setNewPersona(prev => ({ ...prev, tags: [...prev.tags, tag] }));
    }
  };

  const removeTag = (tag: string) => {
    setNewPersona(prev => ({ ...prev, tags: prev.tags.filter(t => t !== tag) }));
  };

  const deleteCard = async (cardId: string) => {
    setDeletingCard(cardId);
    try {
      const { error } = await supabase
        .from('review_cards')
        .delete()
        .eq('id', cardId)
        .eq('user_id', userId);

      if (error) {
        console.error('删除卡片失败:', error);
        alert('删除失败，请重试');
      } else {
        setCards(cards.filter(card => card.id !== cardId));
        if (selectedCard?.id === cardId) {
          setSelectedCard(null);
          setShowModal(false);
        }
      }
    } catch (error) {
      console.error('删除卡片失败:', error);
      alert('删除失败，请重试');
    } finally {
      setDeletingCard(null);
    }
  };

  const openCardDetail = (card: ReviewCard) => {
    setSelectedCard(card);
    setShowModal(true);
  };

  const closeModal = () => {
    setSelectedCard(null);
    setShowModal(false);
  };

  // 考试相关函数
  const toggleCardSelection = (cardId: string) => {
    setSelectedCards(prev => {
      if (prev.includes(cardId)) {
        return prev.filter(id => id !== cardId);
      } else if (prev.length < 2) {
        return [...prev, cardId];
      }
      return prev;
    });
  };

  const startExam = () => {
    if (selectedCards.length === 0) {
      alert('请至少选择一个卡片');
      return;
    }
    setShowExamModal(true);
  };

  const generateExam = async () => {
    setGeneratingExam(true);
    try {
      // 获取选中卡片的词典信息
      const selectedCardData = cards.filter(card => selectedCards.includes(card.id));
      const dictionary_info = selectedCardData.map(card => ({
        word: card.word,
        dictionary_info: card.dictionary_info,
        meaning: card.meaning,
        sentence: card.sentence
      }));

      const response = await fetch('/api/generate-exam', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          dictionary_info,
          persona: selectedPersona // 可以为null
        }),
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          setExamContent(result.content);
          setShowExamModal(false);
          setShowExamContent(true);
          setCurrentQuestionIndex(0);
          setUserAnswers([]);
          setShowResults(false);
        } else {
          alert('生成考试失败: ' + result.error);
        }
      } else {
        alert('生成考试失败，请重试');
      }
    } catch (error) {
      console.error('生成考试失败:', error);
      alert('生成考试失败，请重试');
    } finally {
      setGeneratingExam(false);
    }
  };

  const submitAnswer = (answer: string) => {
    if (!examContent) return;
    
    const correctAnswer = examContent.questions[currentQuestionIndex]?.answer;
    const isCorrect = answer === correctAnswer;
    
    setUserAnswers(prev => ({
      ...prev,
      [currentQuestionIndex]: answer
    }));
    
    setQuestionResults(prev => ({
      ...prev,
      [currentQuestionIndex]: isCorrect
    }));
    
    setShowQuestionResult(true);
    
    if (isCorrect) {
      // 正确答案，2秒后自动进入下一题
      setTimeout(() => {
        setShowQuestionResult(false);
        if (currentQuestionIndex < examContent.questions.length - 1) {
          setCurrentQuestionIndex(currentQuestionIndex + 1);
        } else {
          setShowResults(true);
        }
      }, 2000);
    }
  };

  const resetExam = () => {
    setSelectedCards([]);
    setShowExamModal(false);
    setShowExamContent(false);
    setExamContent(null);
    setSelectedPersona(null);
    setCurrentQuestionIndex(0);
    setUserAnswers({});
    setShowResults(false);
    setQuestionResults({});
    setShowQuestionResult(false);
  };

  const formatText = (text: string) => {
    return text.split('\n').map((line, index) => (
      <div key={index} className="mb-1">
        {line}
      </div>
    ));
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (cards.length === 0) {
    return (
      <div className="max-w-6xl mx-auto p-6">
        <h1 className="text-3xl font-bold text-gray-800 mb-8 text-center">复习模块</h1>
        <div className="text-center py-12">
          <div className="text-6xl mb-4">📚</div>
          <div className="text-xl text-gray-600 mb-2">复习本是空的</div>
          <div className="text-gray-500">答错题目后会自动收集到这里！</div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      {/* 头部按钮 */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-800">复习模块</h1>
        <div className="flex gap-3">
          <button
            onClick={() => setShowPersonaModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
          >
            <User className="h-4 w-4" />
            管理人设
          </button>
          <button
            onClick={startExam}
            disabled={selectedCards.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            <BookOpen className="h-4 w-4" />
            生成考试 {selectedCards.length > 0 && `(${selectedCards.length})`}
          </button>
        </div>
      </div>
      
      {/* 字卡网格 */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
        {cards.map((card) => {
          const isSelected = selectedCards.includes(card.id);
          return (
          <div
            key={card.id}
            className={`relative w-40 h-40 bg-white border-2 rounded-lg shadow-md hover:shadow-lg transition-all duration-200 cursor-pointer overflow-hidden ${
              isSelected ? 'border-green-500 ring-2 ring-green-200' : 'border-gray-200 hover:border-red-300'
            }`}
            onClick={() => openCardDetail(card)}
          >
            {/* 选择复选框 */}
            <div 
              className="absolute top-2 left-2 z-10"
              onClick={(e) => {
                e.stopPropagation();
                toggleCardSelection(card.id);
              }}
            >
              <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                isSelected ? 'bg-green-500 border-green-500' : 'bg-white border-gray-300 hover:border-green-400'
              }`}>
                {isSelected && <Check className="h-3 w-3 text-white" />}
              </div>
            </div>
            {/* 图片背景 */}
            {card.image_url ? (
              <div className="w-full h-full relative">
                <img 
                  src={card.image_url} 
                  alt={`${card.word}的学习图片`} 
                  className="w-full h-full object-cover"
                />
                {/* 字词显示在底部 */}
                <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-60 text-white p-2">
                  <div className="text-lg font-bold text-center">
                    {card.word}
                  </div>
                </div>
              </div>
            ) : (
              /* 无图片时的显示 */
              <div className="w-full h-full flex items-center justify-center">
                <div className="text-2xl font-bold text-gray-800">
                  {card.word}
                </div>
              </div>
            )}
          </div>
          );
        })}
      </div>

      {/* 统计信息 */}
      <div className="mt-8 text-center text-sm text-gray-500">
        <p>共 {cards.length} 个错题字词</p>
      </div>

      {/* 人设管理弹窗 */}
      {showPersonaModal && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-scroll" style={{scrollbarWidth: 'thin', scrollbarColor: '#d1d5db #f3f4f6', scrollbarGutter: 'stable'}}>
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-800">管理人设</h2>
                <button
                  onClick={() => {
                    setShowPersonaModal(false);
                    resetPersonaForm();
                  }}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              {/* 人设表单 */}
              <div className="mb-6 p-4 border rounded-lg bg-gray-50">
                <h3 className="text-lg font-semibold mb-4">
                  {editingPersona ? '编辑人设' : '创建新人设'}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      昵称
                    </label>
                    <div className="space-y-2">
                      <div className="flex flex-wrap gap-2">
                        {['小明', '小红', '阿强', '雅琪', '志华', '美玲', '建国', '秀英'].map((name) => (
                          <button
                            key={name}
                            onClick={() => setNewPersona({...newPersona, nickname: name})}
                            className={`px-3 py-1 rounded-full text-sm transition-colors ${
                              newPersona.nickname === name
                                ? 'bg-blue-500 text-white'
                                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                            }`}
                          >
                            {name}
                          </button>
                        ))}
                      </div>
                      <input
                        type="text"
                        value={newPersona.nickname}
                        onChange={(e) => setNewPersona({...newPersona, nickname: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="或自定义昵称"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      身份
                    </label>
                    <div className="space-y-2">
                      <div className="flex flex-wrap gap-2">
                        {['学者', '商人', '武士', '农夫', '医者', '诗人', '官员', '工匠'].map((identity) => (
                          <button
                            key={identity}
                            onClick={() => setNewPersona({...newPersona, identity: identity})}
                            className={`px-3 py-1 rounded-full text-sm transition-colors ${
                              newPersona.identity === identity
                                ? 'bg-blue-500 text-white'
                                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                            }`}
                          >
                            {identity}
                          </button>
                        ))}
                      </div>
                      <input
                        type="text"
                        value={newPersona.identity}
                        onChange={(e) => setNewPersona({...newPersona, identity: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="或自定义身份"
                      />
                    </div>
                  </div>
                </div>
                
                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    标签 (最多选择2个)
                  </label>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {['勇敢', '智慧', '善良', '坚强', '聪明', '温柔', '正义', '机智'].map((tag) => (
                      <button
                        key={tag}
                        onClick={() => addTag(tag)}
                        disabled={newPersona.tags.length >= 2 && !newPersona.tags.includes(tag)}
                        className={`px-3 py-1 rounded-full text-sm transition-colors ${
                          newPersona.tags.includes(tag)
                            ? 'bg-blue-500 text-white'
                            : 'bg-gray-200 text-gray-700 hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed'
                        }`}
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-2 mb-2">
                    <input
                      type="text"
                      value={customTag}
                      onChange={(e) => setCustomTag(e.target.value)}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="自定义标签"
                      onKeyPress={(e) => {
                        if (e.key === 'Enter' && customTag.trim() && newPersona.tags.length < 2) {
                          addTag(customTag.trim());
                          setCustomTag('');
                        }
                      }}
                    />
                    <button
                      onClick={() => {
                        if (customTag.trim() && newPersona.tags.length < 2) {
                          addTag(customTag.trim());
                          setCustomTag('');
                        }
                      }}
                      disabled={!customTag.trim() || newPersona.tags.length >= 2}
                      className="px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 disabled:bg-gray-400 disabled:cursor-not-allowed"
                    >
                      添加
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {newPersona.tags.map((tag) => (
                      <span
                        key={tag}
                        className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm"
                      >
                        {tag}
                        <button
                          onClick={() => removeTag(tag)}
                          className="text-blue-600 hover:text-blue-800"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                </div>

                <div className="mt-4 flex gap-2">
                  <button
                    onClick={savePersona}
                    disabled={!newPersona.nickname || !newPersona.identity}
                    className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed"
                  >
                    {editingPersona ? '更新' : '保存'}
                  </button>
                  <button
                    onClick={resetPersonaForm}
                    className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400"
                  >
                    重置
                  </button>
                </div>
              </div>

              {/* 人设列表 */}
              <div>
                <h3 className="text-lg font-semibold mb-4">已保存的人设</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {personas.map((persona) => (
                    <div key={persona.id} className="border rounded-lg p-4 bg-white">
                      <div className="flex justify-between items-start mb-2">
                        <h4 className="font-semibold text-gray-800">{persona.nickname}</h4>
                        <div className="flex gap-1">
                          <button
                            onClick={() => editPersona(persona)}
                            className="text-blue-500 hover:text-blue-700"
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => deletePersona(persona.id)}
                            className="text-red-500 hover:text-red-700"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                      <p className="text-gray-600 text-sm mb-2">{persona.identity}</p>
                      <div className="flex flex-wrap gap-1">
                        {persona.tags.map((tag) => (
                          <span
                            key={tag}
                            className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                      <div className="mt-2 text-xs text-gray-500">
                        输出: 一个名叫{persona.nickname}、{persona.tags.join('、')}的{persona.identity}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 考试人设选择弹窗 */}
      {showExamModal && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col">
            <div className="p-6 flex-1 overflow-y-scroll" style={{
              scrollbarWidth: 'thin',
              scrollbarColor: '#d1d5db #f3f4f6',
              scrollbarGutter: 'stable'
            }}>
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-800">选择人设开始考试</h2>
                <button
                  onClick={() => setShowExamModal(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              <div className="mb-6">
                <p className="text-gray-600 mb-4">
                  已选择 {selectedCards.length} 个字卡进行考试
                </p>
                <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-blue-800 text-sm">
                    💡 <strong>提示：</strong>人设是可选的！你可以选择创建一个有趣的角色来增加考试的趣味性，也可以直接跳过人设选择进入考试。
                  </p>
                </div>
                
                {/* 快速创建人设 */}
                <div className="mb-6 p-4 border rounded-lg bg-gray-50">
                  <h3 className="text-lg font-semibold mb-4">快速创建人设（可选）</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        昵称
                      </label>
                      <div className="space-y-2">
                        <div className="flex flex-wrap gap-2">
                          {['小明', '小红', '阿强', '雅琪', '志华', '美玲', '建国', '秀英'].map((name) => (
                            <button
                              key={name}
                              onClick={() => setNewPersona({...newPersona, nickname: name})}
                              className={`px-3 py-1 rounded-full text-sm transition-colors ${
                                newPersona.nickname === name
                                  ? 'bg-blue-500 text-white'
                                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                              }`}
                            >
                              {name}
                            </button>
                          ))}
                        </div>
                        <input
                          type="text"
                          value={newPersona.nickname}
                          onChange={(e) => setNewPersona({...newPersona, nickname: e.target.value})}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="或自定义昵称"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        身份
                      </label>
                      <div className="space-y-2">
                        <div className="flex flex-wrap gap-2">
                          {['学者', '商人', '武士', '农夫', '医者', '诗人', '官员', '工匠'].map((identity) => (
                            <button
                              key={identity}
                              onClick={() => setNewPersona({...newPersona, identity: identity})}
                              className={`px-3 py-1 rounded-full text-sm transition-colors ${
                                newPersona.identity === identity
                                  ? 'bg-blue-500 text-white'
                                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                              }`}
                            >
                              {identity}
                            </button>
                          ))}
                        </div>
                        <input
                          type="text"
                          value={newPersona.identity}
                          onChange={(e) => setNewPersona({...newPersona, identity: e.target.value})}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="或自定义身份"
                        />
                      </div>
                    </div>
                  </div>
                  
                  <div className="mt-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      标签 (最多选择2个)
                    </label>
                    <div className="flex flex-wrap gap-2 mb-2">
                      {['勇敢', '智慧', '善良', '坚强', '聪明', '温柔', '正义', '机智'].map((tag) => (
                        <button
                          key={tag}
                          onClick={() => addTag(tag)}
                          disabled={newPersona.tags.length >= 2 && !newPersona.tags.includes(tag)}
                          className={`px-3 py-1 rounded-full text-sm transition-colors ${
                            newPersona.tags.includes(tag)
                              ? 'bg-blue-500 text-white'
                              : 'bg-gray-200 text-gray-700 hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed'
                          }`}
                        >
                          {tag}
                        </button>
                      ))}
                    </div>
                    <div className="flex gap-2 mb-2">
                      <input
                        type="text"
                        value={customTag}
                        onChange={(e) => setCustomTag(e.target.value)}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="自定义标签"
                        onKeyPress={(e) => {
                          if (e.key === 'Enter' && customTag.trim() && newPersona.tags.length < 2) {
                            addTag(customTag.trim());
                            setCustomTag('');
                          }
                        }}
                      />
                      <button
                        onClick={() => {
                          if (customTag.trim() && newPersona.tags.length < 2) {
                            addTag(customTag.trim());
                            setCustomTag('');
                          }
                        }}
                        disabled={!customTag.trim() || newPersona.tags.length >= 2}
                        className="px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 disabled:bg-gray-400 disabled:cursor-not-allowed"
                      >
                        添加
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {newPersona.tags.map((tag) => (
                        <span
                          key={tag}
                          className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm"
                        >
                          {tag}
                          <button
                            onClick={() => removeTag(tag)}
                            className="text-blue-600 hover:text-blue-800"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>

                  <button
                    onClick={savePersona}
                    disabled={!newPersona.nickname || !newPersona.identity}
                    className="mt-4 px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed"
                  >
                    创建并使用
                  </button>
                </div>

                {/* 选择已有人设 */}
                <div>
                  <h3 className="text-lg font-semibold mb-4">选择已有人设</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-60 overflow-y-auto">
                    {personas.map((persona) => (
                      <div
                        key={persona.id}
                        onClick={() => setSelectedPersona(persona)}
                        className={`border rounded-lg p-4 cursor-pointer transition-colors ${
                          selectedPersona?.id === persona.id
                            ? 'border-green-500 bg-green-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <h4 className="font-semibold text-gray-800">{persona.nickname}</h4>
                        <p className="text-gray-600 text-sm mb-2">{persona.identity}</p>
                        <div className="flex flex-wrap gap-1">
                          {persona.tags.map((tag) => (
                            <span
                              key={tag}
                              className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                        <div className="mt-2 text-xs text-gray-500">
                          输出: 一个名叫{persona.nickname}、{persona.tags.join('、')}的{persona.identity}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <div className="p-6 pt-0 border-t border-gray-200">
              <div className="flex justify-between">
                <button
                  onClick={() => {
                    setSelectedPersona(null);
                    generateExam();
                  }}
                  disabled={generatingExam}
                  className="px-4 py-2 bg-orange-500 text-white rounded-md hover:bg-orange-600 disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  {generatingExam ? '生成中...' : '跳过人设直接考试'}
                </button>
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowExamModal(false)}
                    className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400"
                  >
                    取消
                  </button>
                  <button
                    onClick={generateExam}
                    disabled={!selectedPersona || generatingExam}
                    className="px-6 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 disabled:bg-gray-400 disabled:cursor-not-allowed"
                  >
                    {generatingExam ? '生成中...' : '进入桃源'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 考试内容弹窗 */}
      {showExamContent && examContent && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-scroll" style={{scrollbarWidth: 'thin', scrollbarColor: '#d1d5db #f3f4f6', scrollbarGutter: 'stable'}}>
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-800">文言文考试</h2>
                <button
                  onClick={() => {
                    setShowExamContent(false);
                    resetExam();
                  }}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              {!showResults ? (
                <div>
                  {/* 文言文情境 */}
                  <div className="mb-8 p-6 bg-gradient-to-r from-amber-50 to-orange-50 rounded-lg border border-amber-200">
                    <h3 className="text-xl font-bold text-amber-800 mb-4">文言文情境</h3>
                    <div className="text-gray-800 leading-relaxed text-lg">
                      {examContent.context}
                    </div>
                  </div>

                  {/* 当前题目 */}
                  <div className="mb-6">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-xl font-bold text-gray-800">
                        选择题 {currentQuestionIndex + 1} / {examContent.questions.length}
                      </h3>
                      <div className="text-sm text-gray-500">
                        已完成 {Object.keys(userAnswers).length} / {examContent.questions.length}
                      </div>
                    </div>
                    
                    <div className="p-6 border rounded-lg bg-gray-50">
                      <div className="text-lg text-gray-800 mb-4">
                        {examContent.questions[currentQuestionIndex]?.question}
                      </div>
                      
                      {/* 选项 */}
                      <div className="space-y-3">
                        {['A', 'B', 'C', 'D'].map((option) => {
                          const currentQuestion = examContent.questions[currentQuestionIndex];
                          const optionText = currentQuestion?.options ? 
                            `${option}. ${currentQuestion.options[option as keyof typeof currentQuestion.options]}` : 
                            `${option}. 选项${option}`;
                          const userAnswer = userAnswers[currentQuestionIndex];
                          const correctAnswer = examContent.questions[currentQuestionIndex]?.answer;
                          const isSelected = userAnswer === option;
                          const isCorrect = option === correctAnswer;
                          const hasAnswered = userAnswer !== undefined;
                          const showResult = showQuestionResult && hasAnswered;
                          
                          let buttonClass = 'w-full text-left p-4 border rounded-lg transition-colors ';
                          
                          if (showResult) {
                            if (isSelected && isCorrect) {
                              buttonClass += 'border-green-500 bg-green-100 text-green-800';
                            } else if (isSelected && !isCorrect) {
                              buttonClass += 'border-red-500 bg-red-100 text-red-800';
                            } else if (!isSelected && isCorrect) {
                              buttonClass += 'border-green-500 bg-green-50 text-green-700';
                            } else {
                              buttonClass += 'border-gray-300 bg-gray-50 text-gray-600';
                            }
                          } else if (isSelected) {
                            buttonClass += 'border-blue-500 bg-blue-50';
                          } else {
                            buttonClass += 'border-gray-300 hover:border-gray-400 hover:bg-gray-50';
                          }
                          
                          const isDisabled = hasAnswered && showResult && questionResults[currentQuestionIndex];
                          
                          return (
                            <button
                              key={option}
                              onClick={() => submitAnswer(option)}
                              disabled={isDisabled}
                              className={buttonClass + (isDisabled ? ' cursor-not-allowed' : '')}
                            >
                              <div className="flex justify-between items-center">
                                <span>{optionText}</span>
                                {showResult && (
                                  <span className="ml-2">
                                    {isSelected && isCorrect && '✓ 正确'}
                                    {isSelected && !isCorrect && '✗ 错误'}
                                    {!isSelected && isCorrect && '✓ 正确答案'}
                                  </span>
                                )}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                      
                      {/* 答题结果提示 */}
                      {showQuestionResult && userAnswers[currentQuestionIndex] && (
                        <div className={`mt-4 p-4 rounded-lg text-center ${
                          questionResults[currentQuestionIndex] 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {questionResults[currentQuestionIndex] ? (
                            <div>
                              <div className="text-lg font-semibold mb-2">🎉 回答正确！</div>
                              <div className="text-sm">2秒后自动进入下一题...</div>
                            </div>
                          ) : (
                            <div>
                              <div className="text-lg font-semibold mb-2">❌ 回答错误</div>
                              <div className="text-sm mb-3">请重新选择正确答案</div>
                              <button
                                onClick={() => {
                                  setShowQuestionResult(false);
                                  setUserAnswers(prev => {
                                    const newAnswers = {...prev};
                                    delete newAnswers[currentQuestionIndex];
                                    return newAnswers;
                                  });
                                }}
                                className="px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600"
                              >
                                重新选择
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 导航按钮 */}
                  {!showQuestionResult && (
                    <div className="flex justify-between">
                      <button
                        onClick={() => setCurrentQuestionIndex(Math.max(0, currentQuestionIndex - 1))}
                        disabled={currentQuestionIndex === 0}
                        className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        上一题
                      </button>
                      
                      <div className="flex gap-2">
                        {currentQuestionIndex < examContent.questions.length - 1 ? (
                          <button
                            onClick={() => setCurrentQuestionIndex(currentQuestionIndex + 1)}
                            className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
                          >
                            下一题
                          </button>
                        ) : (
                          <button
                            onClick={() => setShowResults(true)}
                            disabled={Object.keys(userAnswers).length < examContent.questions.length}
                            className="px-6 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 disabled:bg-gray-400 disabled:cursor-not-allowed"
                          >
                            查看结果
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                /* 考试结果 */
                <div>
                  <div className="text-center mb-8">
                    <h3 className="text-2xl font-bold text-gray-800 mb-4">考试完成！</h3>
                    <div className="text-6xl mb-4">
                      {Object.values(userAnswers).filter((answer, index) => 
                        answer === examContent.questions[index]?.answer
                      ).length === examContent.questions.length ? '🎉' : '📚'}
                    </div>
                    <p className="text-xl text-gray-600">
                      正确率: {Object.values(userAnswers).filter((answer, index) => 
                        answer === examContent.questions[index]?.answer
                      ).length} / {examContent.questions.length}
                    </p>
                  </div>

                  {/* 题目回顾 */}
                  <div className="space-y-6">
                    {examContent.questions.map((question, index) => {
                      const userAnswer = userAnswers[index];
                      const isCorrect = userAnswer === question.answer;
                      
                      return (
                        <div key={index} className="p-4 border rounded-lg">
                          <div className="flex justify-between items-start mb-2">
                            <h4 className="font-semibold text-gray-800">题目 {index + 1}</h4>
                            <span className={`px-2 py-1 rounded text-sm ${
                              isCorrect ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                            }`}>
                              {isCorrect ? '正确' : '错误'}
                            </span>
                          </div>
                          <p className="text-gray-700 mb-2">{question.question}</p>
                          <div className="text-sm">
                            <span className="text-gray-600">你的答案: </span>
                            <span className={isCorrect ? 'text-green-600' : 'text-red-600'}>
                              {userAnswer}
                            </span>
                            {!isCorrect && (
                              <>
                                <span className="text-gray-600 ml-4">正确答案: </span>
                                <span className="text-green-600">{question.answer}</span>
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="mt-8 text-center">
                    <button
                      onClick={() => {
                        setShowExamContent(false);
                        resetExam();
                      }}
                      className="px-6 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
                    >
                      完成考试
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 详细信息弹窗 */}
      {showModal && selectedCard && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            {/* 弹窗头部 */}
            <div className="bg-gradient-to-r from-red-500 to-pink-500 text-white p-6 rounded-t-xl">
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold">字词详情</h2>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => deleteCard(selectedCard.id)}
                    disabled={deletingCard === selectedCard.id}
                    className="p-2 bg-white bg-opacity-20 rounded-lg hover:bg-opacity-30 transition-colors disabled:opacity-50"
                  >
                    <Trash2 className="h-5 w-5" />
                  </button>
                  <button
                    onClick={closeModal}
                    className="p-2 bg-white bg-opacity-20 rounded-lg hover:bg-opacity-30 transition-colors"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>
            </div>

            {/* 弹窗内容 */}
            <div className="p-6 space-y-6">
              {/* 字词 */}
              <div className="text-center">
                <div className="text-6xl font-bold text-red-600 mb-2">
                  {selectedCard.word}
                </div>
                {selectedCard.mistake_count && selectedCard.mistake_count > 1 && (
                  <div className="text-sm text-red-500">
                    错误次数：{selectedCard.mistake_count}
                  </div>
                )}
              </div>

              {/* 所在句子 */}
              {selectedCard.sentence && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-800 mb-3">所在句子</h3>
                  <div className="bg-blue-50 rounded-lg p-4 text-gray-800 leading-relaxed border-l-4 border-blue-500">
                    {selectedCard.sentence}
                  </div>
                </div>
              )}

              {/* 字义 */}
              {selectedCard.meaning && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-800 mb-3">字义</h3>
                  <div className="bg-gray-50 rounded-lg p-4 text-gray-800 leading-relaxed">
                    {formatText(selectedCard.meaning)}
                  </div>
                </div>
              )}

              {/* 词典信息 */}
              {selectedCard.dictionary_info && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-800 mb-3">词典释义</h3>
                  <div className="bg-green-50 rounded-lg p-4 text-gray-800 leading-relaxed border-l-4 border-green-500">
                    {formatText(selectedCard.dictionary_info.explanation || selectedCard.dictionary_info.meaning || '暂无释义')}
                    {selectedCard.dictionary_info.source && (
                      <div className="mt-2 text-sm text-gray-600">
                        来源：{selectedCard.dictionary_info.source}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* 原始解释（兼容旧数据） */}
              {selectedCard.explanation && !selectedCard.meaning && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-800 mb-3">解释</h3>
                  <div className="bg-gray-50 rounded-lg p-4 text-gray-800 leading-relaxed">
                    {formatText(selectedCard.explanation)}
                  </div>
                </div>
              )}

              {/* 添加时间 */}
              <div className="text-center text-sm text-gray-500 pt-4 border-t border-gray-200">
                添加时间：{new Date(selectedCard.created_at).toLocaleString('zh-CN')}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}