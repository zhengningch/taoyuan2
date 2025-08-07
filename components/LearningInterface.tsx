'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { getUserPet } from '@/lib/pet';
import { ChevronLeft, ChevronRight, CheckCircle, Play, Pause } from 'lucide-react';

interface Question {
  question: string;
  options: string[];
  answer: string;
}

interface SentenceData {
  sentence: string;
  translation: string;
  annotation: string;
  keyPoints: string;
  isImportant: boolean;
  punctuationExercise?: string;
  questions?: Question[];
  examAnalysis?: string;
}

interface ScenarioContent {
  reading_guide: string;
  video_url?: string;
  image_url?: string;
  sentences: SentenceData[];
}

interface LearningProgress {
  current_sentence: number;
  completed_sentences: number[];
  is_completed: boolean;
  completion_time?: string;
  skin_drawn?: boolean;
}

interface LearningInterfaceProps {
  scenarioId: string;
  userId: string;
  onBack: () => void;
  onRestart?: () => void;
}

export default function LearningInterface({ scenarioId, userId, onBack }: LearningInterfaceProps) {
  const [content, setContent] = useState<ScenarioContent | null>(null);
  const [progress, setProgress] = useState<LearningProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentPhase, setCurrentPhase] = useState<'guide' | 'learning' | 'completed'>('guide');
  const [currentSentence, setCurrentSentence] = useState(0);
  const [userPunctuation, setUserPunctuation] = useState('');
  const [punctuationMarks, setPunctuationMarks] = useState<number[]>([]);
  const [punctuationSubmitted, setPunctuationSubmitted] = useState(false);
  const [punctuationResults, setPunctuationResults] = useState<{[key: number]: boolean}>({});
  const [selectedAnswers, setSelectedAnswers] = useState<{[key: number]: string}>({});
  const [showAnswers, setShowAnswers] = useState<{[key: number]: boolean | 'wrong' | 'correct' | 'final'}>({});
  const [firstAttemptWrong, setFirstAttemptWrong] = useState<{[key: number]: boolean}>({});
  const [attemptCount, setAttemptCount] = useState<{[key: number]: number}>({});
  const [showTranslation, setShowTranslation] = useState(false);
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const [petType, setPetType] = useState<string>('');
  const [showDrawResult, setShowDrawResult] = useState<{ success: boolean; skinNumber?: number } | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  useEffect(() => {
    fetchContent();
    fetchProgress();
    fetchUserPet();
  }, [scenarioId, userId]);

  const fetchUserPet = async () => {
     try {
       const pet = await getUserPet(userId);
       if (pet) {
         setPetType(pet.pet_type);
       }
     } catch (error) {
       console.error('获取宠物信息失败:', error);
     }
   };

  const drawPetSkin = async () => {
    if (!petType || isDrawing) return;
    
    setIsDrawing(true);
    try {
      const response = await fetch('/api/draw-pet-skin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, petType, scenarioId })
      });
      
      const result = await response.json();
      setShowDrawResult(result);
      
      // 如果抽取成功，更新本地进度状态
      if (result.success && progress) {
        setProgress({ ...progress, skin_drawn: true });
      }
      
      // 3秒后隐藏抽取结果
      setTimeout(() => {
        setShowDrawResult(null);
      }, 3000);
    } catch (error) {
      console.error('抽取皮肤失败:', error);
      setShowDrawResult({ success: false });
    } finally {
      setIsDrawing(false);
    }
  };

  // 检查所有题目是否答对，如果是则自动显示翻译
  useEffect(() => {
    if (!content || !content.sentences[currentSentence]) return;
    
    const currentSentenceData = content.sentences[currentSentence];
    if (!currentSentenceData.questions || currentSentenceData.questions.length === 0) return;
    
    const allQuestionsAnswered = currentSentenceData.questions.every((_, index) => 
      (showAnswers[index] === true || showAnswers[index] === 'correct' || showAnswers[index] === 'final') && selectedAnswers[index] === currentSentenceData.questions![index].answer
    );
    
    if (allQuestionsAnswered && !showTranslation) {
      setShowTranslation(true);
    }
  }, [showAnswers, selectedAnswers, currentSentence, content, showTranslation]);

  // 切换句子时重置状态
  useEffect(() => {
    setPunctuationSubmitted(false);
    setUserPunctuation('');
    setPunctuationMarks([]);
    setPunctuationResults({});
    setSelectedAnswers({});
    setShowAnswers({});
    setFirstAttemptWrong({});
    setAttemptCount({});
    setShowTranslation(false);
  }, [currentSentence]);

  const fetchContent = async () => {
    try {
      const { data, error } = await supabase
        .from('scenario_content')
        .select('*')
        .eq('scenario_id', scenarioId)
        .single();

      if (error) throw error;
      setContent(data);
    } catch (error) {
      console.error('获取学习内容失败:', error);
    }
  };

  const fetchProgress = async () => {
    try {
      const { data, error } = await supabase
        .from('learning_progress')
        .select('current_sentence, completed_sentences, is_completed, completion_time, skin_drawn')
        .eq('scenario_id', scenarioId)
        .eq('user_id', userId)
        .single();

      if (error) throw error;
      setProgress(data);
      setCurrentSentence(data.current_sentence - 1);
      
      if (data.is_completed) {
        setCurrentPhase('completed');
      }
    } catch (error) {
      console.error('获取学习进度失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateProgress = async (newProgress: Partial<LearningProgress>) => {
    try {
      const { error } = await supabase
        .from('learning_progress')
        .update(newProgress)
        .eq('scenario_id', scenarioId)
        .eq('user_id', userId);

      if (error) throw error;
      
      setProgress(prev => prev ? { ...prev, ...newProgress } : null);
    } catch (error) {
      console.error('更新进度失败:', error);
    }
  };

  const startLearning = () => {
    setCurrentPhase('learning');
  };

  const restartLearning = async () => {
    try {
      // 重置学习进度
      const resetProgress = {
        current_sentence: 1,
        completed_sentences: [],
        is_completed: false,
        completion_time: undefined
      };
      
      await updateProgress(resetProgress);
      
      // 同时重置learning_scenarios表的status为ready
      try {
        const { error } = await supabase
          .from('learning_scenarios')
          .update({ status: 'ready' })
          .eq('id', scenarioId)
          .eq('user_id', userId);
        
        if (error) {
          console.error('重置学习情境状态失败:', error);
        }
      } catch (error) {
        console.error('重置学习情境状态失败:', error);
      }
      
      // 重置界面状态
      setCurrentSentence(0);
      setCurrentPhase('guide');
      setSelectedAnswers({});
      setShowAnswers({});
      setShowTranslation(false);
      setUserPunctuation('');
      setPunctuationMarks([]);
    } catch (error) {
      console.error('重新学习失败:', error);
    }
  };

  const togglePunctuationMark = (position: number) => {
    setPunctuationMarks(prev => {
      if (prev.includes(position)) {
        return prev.filter(p => p !== position);
      } else {
        return [...prev, position].sort((a, b) => a - b);
      }
    });
  };

  const checkPunctuation = () => {
    const currentSentenceData = content?.sentences[currentSentence];
    if (!currentSentenceData) return;

    // 从正确答案中提取标点位置
    const correctSentence = currentSentenceData.sentence;
    const exerciseSentence = currentSentenceData.punctuationExercise || '';
    const correctPositions: number[] = [];
    
    let exerciseIndex = 0;
    for (let i = 0; i < correctSentence.length; i++) {
      const char = correctSentence[i];
      if (char === exerciseSentence[exerciseIndex]) {
        exerciseIndex++;
      } else if ('，。；：？！'.includes(char)) {
        correctPositions.push(exerciseIndex);
      }
    }
    
    // 计算每个位置的判断结果
    const results: {[key: number]: boolean} = {};
    const exerciseLength = exerciseSentence.length;
    
    for (let i = 1; i < exerciseLength; i++) {
      const shouldHavePunctuation = correctPositions.includes(i);
      const userMarked = punctuationMarks.includes(i);
      results[i] = shouldHavePunctuation === userMarked;
    }
    
    setPunctuationResults(results);
    
    // 标记句读练习已提交
    setPunctuationSubmitted(true);
    
    // 显示题目
    setShowAnswers({});
    setSelectedAnswers({});
  };

  const selectAnswer = (questionIndex: number, answer: string) => {
    setSelectedAnswers(prev => ({ ...prev, [questionIndex]: answer }));
    
    // 如果是第一次答错后的重新选择，自动提交
    if (showAnswers[questionIndex] === 'wrong') {
      setTimeout(() => {
        submitAnswer(questionIndex);
      }, 20);
    }
  };

  const submitAnswer = async (questionIndex: number) => {
    const currentSentenceData = content?.sentences[currentSentence];
    const question = currentSentenceData?.questions?.[questionIndex];
    if (!question) return;

    const userAnswer = selectedAnswers[questionIndex];
    const isCorrect = userAnswer === question.answer;
    const currentAttempt = (attemptCount[questionIndex] || 0) + 1;
    
    // 更新尝试次数
    setAttemptCount(prev => ({ ...prev, [questionIndex]: currentAttempt }));
    
    if (isCorrect) {
      // 答对了，显示正确状态（绿色）
      setShowAnswers(prev => ({ ...prev, [questionIndex]: 'correct' as any }));
    } else {
      if (currentAttempt === 1) {
        // 第一次答错：记入mistake，标记第一次答错，显示错误状态但不显示正确答案
        setFirstAttemptWrong(prev => ({ ...prev, [questionIndex]: true }));
        await collectMistake(currentSentenceData, question);
        
        // 显示错误状态，但不显示正确答案，用户可以重新选择
        setShowAnswers(prev => ({ ...prev, [questionIndex]: 'wrong' as any }));
      } else {
        // 第二次答错：显示正确答案，不再记入mistake
        setShowAnswers(prev => ({ ...prev, [questionIndex]: 'final' as any }));
      }
    }
  };

  const collectMistake = async (sentenceData: SentenceData, question: Question) => {
    try {
      // 解析考点中的字 - 只收集与当前题目相关的考点
      const keyPointPattern = /\d+、([^：]+)：([^；]+)/g;
      let match;
      const mistakes = [];
      
      // 从题目中提取关键字，只收集相关的考点
      const questionText = question.question;
      
      while ((match = keyPointPattern.exec(sentenceData.keyPoints)) !== null) {
        const fullWord = match[1].trim();
        // 只取顿号后面的第一个字
        const word = fullWord.charAt(0);
        const meaning = match[2].trim();
        
        // 检查这个考点是否与当前题目相关
        if (word && questionText.includes(word)) {
          // 查询词典信息
          let dictionaryInfo = null;
          try {
            const response = await fetch('/api/query-dictionary', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ word })
            });
            if (response.ok) {
              dictionaryInfo = await response.json();
            }
          } catch (error) {
            console.error('查询词典失败:', error);
          }
          
          mistakes.push({
            word,
            sentence: sentenceData.sentence,
            meaning,
            dictionaryInfo,
            sourceScenarioId: scenarioId
          });
        }
      }
      
      // 批量添加到复习卡片
      for (const mistake of mistakes) {
        await addToReviewCards(mistake);
      }
    } catch (error) {
      console.error('收集错题失败:', error);
    }
  };
  
  const addToReviewCards = async (mistake: any) => {
    try {
      // 检查是否已存在
      const { data: existing } = await supabase
        .from('review_cards')
        .select('id, mistake_count')
        .eq('user_id', userId)
        .eq('word', mistake.word)
        .eq('source_scenario_id', mistake.sourceScenarioId)
        .single();
      
      if (existing) {
        // 如果已存在，增加错误次数
        await supabase
          .from('review_cards')
          .update({ mistake_count: existing.mistake_count + 1 })
          .eq('id', existing.id);
      } else {
        // 生成图片
        let imageUrl = '';
        try {
          console.log('正在为字词生成图片:', mistake.word);
          const imageResponse = await fetch('/api/generate-review-image', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              word: mistake.word,
              sentence: mistake.sentence,
              meaning: mistake.meaning,
              dictionaryInfo: mistake.dictionaryInfo
            })
          });
          
          if (imageResponse.ok) {
            const imageResult = await imageResponse.json();
            if (imageResult.success && imageResult.imageUrl) {
              imageUrl = imageResult.imageUrl;
              console.log('图片生成成功:', mistake.word);
            }
          } else {
            console.error('图片生成失败:', await imageResponse.text());
          }
        } catch (error) {
          console.error('图片生成过程出错:', error);
        }
        
        // 如果不存在，创建新记录
        await supabase
          .from('review_cards')
          .insert({
            user_id: userId,
            word: mistake.word,
            explanation: mistake.meaning,
            sentence: mistake.sentence,
            meaning: mistake.meaning,
            dictionary_info: mistake.dictionaryInfo,
            source_scenario_id: mistake.sourceScenarioId,
            image_url: imageUrl,
            mistake_count: 1
          });
      }
    } catch (error) {
      console.error('添加复习卡片失败:', error);
    }
  };

  const completeSentence = async () => {
    if (!progress || !content) return;

    const newCompletedSentences = [...progress.completed_sentences, currentSentence + 1];
    const isLastSentence = currentSentence >= content.sentences.length - 1;
    
    if (isLastSentence) {
      // 如果是最后一个句子，自动显示翻译和考情分析
      setShowTranslation(true);
      
      // 完成所有学习
      await updateProgress({
        completed_sentences: newCompletedSentences,
        is_completed: true,
        completion_time: new Date().toISOString()
      });
      
      // 同时更新learning_scenarios表的status为completed
      try {
        const { error } = await supabase
          .from('learning_scenarios')
          .update({ status: 'completed' })
          .eq('id', scenarioId)
          .eq('user_id', userId);
        
        if (error) {
          console.error('更新学习情境状态失败:', error);
        }
      } catch (error) {
        console.error('更新学习情境状态失败:', error);
      }
      
      setCurrentPhase('completed');
    } else {
      // 继续下一句
      const nextSentence = currentSentence + 1;
      await updateProgress({
        current_sentence: nextSentence + 1,
        completed_sentences: newCompletedSentences
      });
      setCurrentSentence(nextSentence);
      setUserPunctuation('');
      setPunctuationMarks([]);
      setSelectedAnswers({});
      setShowAnswers({});
      setShowTranslation(false);
    }
  };

  const showTranslationAndComplete = () => {
    setShowTranslation(true);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!content || !progress) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600">加载学习内容失败</p>
        <button
          onClick={onBack}
          className="mt-4 px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
        >
          返回
        </button>
      </div>
    );
  }

  if (currentPhase === 'guide') {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="flex items-center mb-6">
          <button
            onClick={onBack}
            className="flex items-center text-blue-600 hover:text-blue-800"
          >
            <ChevronLeft className="h-5 w-5 mr-1" />
            返回
          </button>
        </div>

        <div className="bg-white rounded-lg shadow-lg p-8">
          <h1 className="text-2xl font-bold text-gray-800 mb-6">阅前指南</h1>
          
          <div className="prose max-w-none mb-8">
            <p className="text-gray-700 leading-relaxed text-lg">
              {content.reading_guide}
            </p>
          </div>

          {content.video_url && (
            <div className="mb-8">
              <h2 className="text-lg font-semibold text-gray-800 mb-4">学习视频</h2>
              <div className="relative bg-gray-100 rounded-lg overflow-hidden">
                <video
                  src={content.video_url}
                  autoPlay
                  loop
                  muted
                  className="w-full h-96 object-cover"
                  onPlay={() => setIsVideoPlaying(true)}
                  onPause={() => setIsVideoPlaying(false)}
                >
                  您的浏览器不支持视频播放。
                </video>
              </div>
            </div>
          )}

          <div className="text-center">
            <button
              onClick={startLearning}
              className="px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
            >
              进入桃源
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (currentPhase === 'completed') {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-white rounded-lg shadow-lg p-8 text-center">
          <CheckCircle className="h-16 w-16 text-green-600 mx-auto mb-4" />
          <h1 className="text-3xl font-bold text-gray-800 mb-4">恭喜你，完成学习！</h1>
          
          {petType && (
            <div className="mb-6">
              <img
                src={`/animals/${petType}/bowu/0.mp4`}
                alt="学习完成纪念"
                className="w-64 h-64 mx-auto rounded-lg shadow-md object-cover"
                onError={(e) => {
                  // 如果0.gif不存在，回退到原来的image_url
                  const target = e.target as HTMLImageElement;
                  if (content.image_url) {
                    target.src = content.image_url;
                  }
                }}
              />
            </div>
          )}
          
          <p className="text-gray-600 mb-8">你已经完成了这个学习情境的所有内容</p>
          
          <div className="flex gap-4 justify-center">
            <button
              onClick={drawPetSkin}
              disabled={isDrawing || !petType || progress?.skin_drawn}
              className={`px-6 py-3 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed ${
                progress?.skin_drawn 
                  ? 'bg-gray-500' 
                  : 'bg-purple-600 hover:bg-purple-700'
              }`}
            >
              {isDrawing 
                ? '抽取中...' 
                : progress?.skin_drawn 
                  ? '已抽取皮肤' 
                  : '抽取博物皮肤'
              }
            </button>
            <button
              onClick={restartLearning}
              className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              重新学习
            </button>
            <button
              onClick={onBack}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              返回学习模块
            </button>
          </div>
          
          {/* 抽取结果提示 */}
          {showDrawResult && (
            <div className="mt-6 p-4 bg-white rounded-lg shadow-lg border-2 border-gray-200 text-center">
              {showDrawResult.success ? (
                <>
                  <div className="text-4xl mb-2">🎉</div>
                  <h3 className="text-lg font-bold text-green-600 mb-1">恭喜获得皮肤！</h3>
                  <p className="text-gray-600">{showDrawResult.skinNumber}</p>
                </>
              ) : (
                <>
                  <div className="text-4xl mb-2">😔</div>
                  <h3 className="text-lg font-bold text-gray-600 mb-1">很遗憾</h3>
                  <p className="text-gray-600">
                    {(showDrawResult as any).message || '这次没有抽中皮肤，继续努力吧！'}
                  </p>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  // 学习阶段
  const currentSentenceData = content.sentences[currentSentence];
  const isCompleted = progress.completed_sentences.includes(currentSentence + 1);
  const allQuestionsAnswered = currentSentenceData.questions?.every((_, index) => 
    showAnswers[index] && selectedAnswers[index] === currentSentenceData.questions![index].answer
  ) ?? true;

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={onBack}
          className="flex items-center text-blue-600 hover:text-blue-800"
        >
          <ChevronLeft className="h-5 w-5 mr-1" />
          返回
        </button>
        
        <div className="text-sm text-gray-600">
          第 {currentSentence + 1} 句 / 共 {content.sentences.length} 句
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-lg p-8">
        {!currentSentenceData.isImportant ? (
          // 非重要句：直接显示内容
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-3">句子</h3>
              <p className="text-xl text-gray-800 leading-relaxed border-l-4 border-blue-500 pl-4">
                {currentSentenceData.sentence}
              </p>
            </div>
            
            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-3">翻译</h3>
              <p className="text-gray-700 leading-relaxed">
                {currentSentenceData.translation}
              </p>
            </div>
            
            {currentSentenceData.annotation !== '无' && (
              <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-3">注解</h3>
                <p className="text-gray-700 leading-relaxed">
                  {currentSentenceData.annotation}
                </p>
              </div>
            )}
            
            {currentSentenceData.keyPoints !== '无' && (
              <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-3">考点</h3>
                <p className="text-gray-700 leading-relaxed">
                  {currentSentenceData.keyPoints}
                </p>
              </div>
            )}
          </div>
        ) : (
          // 重要句：交互模式
          <div className="space-y-6">
            {/* 句读练习 */}
            {currentSentenceData.punctuationExercise && (
              <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-3">断句练习</h3>
                <p className="text-gray-600 mb-3">{punctuationSubmitted ? '判断结果：' : '请点击需要加标点的位置：'}</p>
                <div className="bg-gray-50 p-4 rounded-lg mb-4">
                   <div className="flex flex-wrap items-center text-2xl leading-relaxed">
                     {(currentSentenceData.punctuationExercise || '').split('').map((char, index) => (
                       <span key={index} className="inline-flex items-center">
                         <span className="mx-1">{char}</span>
                         {index < (currentSentenceData.punctuationExercise || '').length - 1 && (
                           <button
                             onClick={() => !punctuationSubmitted && togglePunctuationMark(index + 1)}
                             disabled={punctuationSubmitted}
                             className={`w-6 h-6 mx-1 text-sm rounded border-2 transition-colors ${
                               punctuationSubmitted
                                 ? (punctuationResults[index + 1] !== undefined
                                     ? (punctuationResults[index + 1] ? 'bg-green-500 text-white border-green-500' : 'bg-red-500 text-white border-red-500')
                                     : 'bg-gray-300 text-gray-500 border-gray-300')
                                 : (punctuationMarks.includes(index + 1)
                                     ? 'bg-blue-500 text-white border-blue-500'
                                     : 'bg-white text-gray-400 border-gray-300 hover:border-blue-300')
                             }`}
                           >
                             {punctuationSubmitted
                               ? (punctuationMarks.includes(index + 1) ? '/' : (punctuationResults[index + 1] === false ? '×' : ''))
                               : (punctuationMarks.includes(index + 1) ? '/' : '+')}
                           </button>
                         )}
                       </span>
                     ))}
                   </div>
                 </div>
                {!punctuationSubmitted && (
                  <button
                    onClick={checkPunctuation}
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                  >
                    提交
                  </button>
                )}
              </div>
            )}
            
            {/* 显示正确句子 */}
            {(punctuationSubmitted || !currentSentenceData.punctuationExercise) && (
              <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-3">句子</h3>
                <p className="text-xl text-gray-800 leading-relaxed border-l-4 border-blue-500 pl-4">
                  {currentSentenceData.sentence}
                </p>
              </div>
            )}
            
            {/* 注解 */}
            {(punctuationSubmitted || !currentSentenceData.punctuationExercise) && currentSentenceData.annotation !== '无' && (
              <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-3">注解</h3>
                <p className="text-gray-700 leading-relaxed">
                  {currentSentenceData.annotation}
                </p>
              </div>
            )}
            
            {/* 考题 */}
            {(punctuationSubmitted || !currentSentenceData.punctuationExercise) && currentSentenceData.questions && (
              <div className="space-y-4">
                {currentSentenceData.questions.map((question, index) => (
                  <div key={index} className="border border-gray-200 rounded-lg p-4">
                    <h4 className="font-medium text-gray-800 mb-3">{question.question}</h4>
                    <div className="space-y-2">
                      {question.options.map((option, optionIndex) => {
                        const optionLetter = String.fromCharCode(65 + optionIndex); // A, B, C, D
                        const isSelected = selectedAnswers[index] === optionLetter;
                        const isCorrect = question.answer === optionLetter;
                        const showResult = showAnswers[index];
                        const isFirstAttemptWrong = showResult === 'wrong';
                        const isAnswerCorrect = showResult === 'correct';
                        const showFinalResult = showResult === 'final';
                        const isDisabled = isAnswerCorrect || showFinalResult;
                        
                        return (
                          <button
                            key={optionIndex}
                            onClick={() => selectAnswer(index, optionLetter)}
                            disabled={isDisabled}
                            className={`w-full text-left p-3 rounded border transition-colors ${
                              showFinalResult
                                ? isCorrect
                                  ? 'bg-green-100 border-green-500 text-green-800'
                                  : isSelected
                                  ? 'bg-red-100 border-red-500 text-red-800'
                                  : 'bg-gray-100 border-gray-300 text-gray-700'
                                : isAnswerCorrect
                                ? isSelected
                                  ? 'bg-green-100 border-green-500 text-green-800'
                                  : 'bg-gray-100 border-gray-300 text-gray-700'
                                : isFirstAttemptWrong && isSelected
                                ? 'bg-red-100 border-red-500 text-red-800'
                                : isSelected
                                ? 'bg-blue-100 border-blue-500 text-gray-900'
                                : 'bg-white border-gray-300 hover:bg-gray-50 text-gray-900'
                            }`}
                          >
                            {optionLetter}. {option}
                          </button>
                        );
                      })}
                    </div>
                    
                    {selectedAnswers[index] && !showAnswers[index] && (
                      <button
                        onClick={() => submitAnswer(index)}
                        className="mt-3 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                      >
                        提交答案
                      </button>
                    )}
                    
                    {/* 第一次答错后的重新选择提示 */}
                    {showAnswers[index] === 'wrong' && (
                      <div className="mt-3 text-sm text-red-600">
                        答案错误，请重新选择
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
            
            {/* 翻译 */}
            {showTranslation && (
              <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-3">翻译</h3>
                <p className="text-gray-700 leading-relaxed">
                  {currentSentenceData.translation}
                </p>
                
                {/* 考情分析 */}
                {currentSentenceData.examAnalysis && (
                  <div className="mt-6">
                    <h3 className="text-lg font-semibold text-gray-800 mb-3">考情分析</h3>
                    <p className="text-gray-700 leading-relaxed whitespace-pre-line">
                      {currentSentenceData.examAnalysis}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
        
        {/* 操作按钮 */}
        <div className="flex justify-between items-center mt-8 pt-6 border-t border-gray-200">
          <button
            onClick={() => setCurrentSentence(Math.max(0, currentSentence - 1))}
            disabled={currentSentence === 0}
            className="flex items-center px-4 py-2 text-gray-600 hover:text-gray-800 disabled:opacity-50"
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            上一句
          </button>
          
          <div className="flex gap-3">
            {(!currentSentenceData.isImportant || (allQuestionsAnswered && showTranslation)) && (
              <button
                onClick={completeSentence}
                className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                {currentSentence >= content.sentences.length - 1 ? '完成学习' : '下一句'}
              </button>
            )}
          </div>
          
          <button
            onClick={() => setCurrentSentence(Math.min(content.sentences.length - 1, currentSentence + 1))}
            disabled={currentSentence >= content.sentences.length - 1}
            className="flex items-center px-4 py-2 text-gray-600 hover:text-gray-800 disabled:opacity-50"
          >
            下一句
            <ChevronRight className="h-4 w-4 ml-1" />
          </button>
        </div>
      </div>
    </div>
  );
}