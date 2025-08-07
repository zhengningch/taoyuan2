'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { supabase } from '@/lib/supabase';

interface LevelIndicatorProps {
  userId: string;
}

interface UserStats {
  scenarioCount: number;
  reviewCardCount: number;
}

const LEVELS = [
  { name: '童生', minScore: 0, maxScore: 9 },
  { name: '秀才', minScore: 10, maxScore: 19 },
  { name: '举人', minScore: 20, maxScore: 29 },
  { name: '贡生', minScore: 30, maxScore: 39 },
  { name: '进士', minScore: 40, maxScore: 49 },
  { name: '状元', minScore: 50, maxScore: Infinity }
];

export default function LevelIndicator({ userId }: LevelIndicatorProps) {
  const [stats, setStats] = useState<UserStats>({
    scenarioCount: 0,
    reviewCardCount: 0
  });
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUserStats();
  }, [userId]);

  const fetchUserStats = async () => {
    try {
      // 获取已完成的学习情境数量
      const { data: scenarios, error: scenarioError } = await supabase
        .from('learning_progress')
        .select('scenario_id')
        .eq('user_id', userId)
        .eq('is_completed', true);

      if (scenarioError) throw scenarioError;

      // 获取复习卡牌数量
      const { data: reviewCards, error: reviewError } = await supabase
        .from('review_cards')
        .select('id')
        .eq('user_id', userId);

      if (reviewError) throw reviewError;

      setStats({
        scenarioCount: scenarios?.length || 0,
        reviewCardCount: reviewCards?.length || 0
      });
    } catch (error) {
      console.error('获取用户统计数据失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const getTotalScore = () => {
    return stats.scenarioCount + stats.reviewCardCount;
  };

  const getCurrentLevel = () => {
    const totalScore = getTotalScore();
    return LEVELS.find(level => totalScore >= level.minScore && totalScore <= level.maxScore) || LEVELS[0];
  };

  const getNextLevel = () => {
    const currentLevel = getCurrentLevel();
    const currentIndex = LEVELS.findIndex(level => level.name === currentLevel.name);
    return currentIndex < LEVELS.length - 1 ? LEVELS[currentIndex + 1] : null;
  };

  const getLevelImageIndex = () => {
    const currentLevel = getCurrentLevel();
    return LEVELS.findIndex(level => level.name === currentLevel.name) + 1;
  };

  const getProgressImageIndex = () => {
    return getLevelImageIndex();
  };

  const getRemainingToNextLevel = () => {
    const nextLevel = getNextLevel();
    if (!nextLevel) return 0;
    return nextLevel.minScore - getTotalScore();
  };

  const handlePetPraise = () => {
    const currentLevel = getCurrentLevel();
    const nextLevel = getNextLevel();
    const remaining = getRemainingToNextLevel();
    
    let message = `这是系统提醒我的学习情况，请你夸夸我：你已经学了${stats.scenarioCount}个情境，收藏了${stats.reviewCardCount}个复习卡牌，目前已经到${currentLevel.name}`;
    
    if (nextLevel && remaining > 0) {
      message += `，还差${remaining}次学习，就可以到${nextLevel.name}。`;
    } else {
      message += `，已经达到最高等级！`;
    }

    // 触发宠物聊天
    const event = new CustomEvent('askAI', {
      detail: { question: message }
    });
    document.dispatchEvent(event);
    setShowModal(false);
  };

  if (loading) {
    return (
      <div className="w-[100px] h-[50px] bg-gray-200 animate-pulse rounded"></div>
    );
  }

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className="hover:scale-105 transition-transform duration-200"
      >
        <Image
          src={`/level/${getLevelImageIndex()}.png`}
          alt="等级指示器"
          width={80}
          height={50}
          className="object-contain"
        />
      </button>

      {/* 等级详情弹窗 */}
      {showModal && (
        <div className="fixed inset-0 bg-transparent flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-8 max-w-lg w-full mx-4 shadow-2xl border-2 border-gray-200">
            <div className="text-center">
              <h3 className="text-xl font-bold text-gray-800 mb-4">学习等级</h3>
              
              <div className="mb-4">
                <p className="text-gray-700 mb-2">
                  你已经学了<span className="font-semibold text-blue-600">{stats.scenarioCount}</span>个情境，
                  收藏了<span className="font-semibold text-green-600">{stats.reviewCardCount}</span>个复习卡牌，
                  目前已经到<span className="font-semibold text-red-600">{getCurrentLevel().name}</span>
                  {getNextLevel() && getRemainingToNextLevel() > 0 && (
                    <>
                      ，还差<span className="font-semibold text-orange-600">{getRemainingToNextLevel()}</span>次学习，
                      就可以到<span className="font-semibold text-purple-600">{getNextLevel()?.name}</span>。
                    </>
                  )}
                  {!getNextLevel() && (
                    <span className="text-yellow-600">，已经达到最高等级！</span>
                  )}
                </p>
              </div>

              {/* 等级进度图 */}
              <div className="mb-6">
                <Image
                  src={`/level/jindu/${getProgressImageIndex()}.PNG`}
                  alt="等级进度"
                  width={400}
                  height={150}
                  className="mx-auto object-contain"
                />
              </div>

              {/* 按钮组 */}
              <div className="flex gap-3 justify-center">
                <button
                  onClick={handlePetPraise}
                  className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                >
                  宠物夸夸
                </button>
                <button
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors"
                >
                  关闭
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}