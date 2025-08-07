'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { supabase } from '@/lib/supabase';
import { getUserPet } from '@/lib/pet';

interface MuseumProps {
  userId: string;
}

interface UnlockedSkin {
  id: string;
  user_id: string;
  pet_type: string;
  skin_number: number;
  unlocked_at: string;
}

export default function Museum({ userId }: MuseumProps) {
  const [petType, setPetType] = useState<string>('');
  const [unlockedSkins, setUnlockedSkins] = useState<UnlockedSkin[]>([]);
  const [loading, setLoading] = useState(true);
  const [showGif, setShowGif] = useState<number | null>(null);
  const [equippedSkin, setEquippedSkin] = useState<number | null>(null);

  useEffect(() => {
    fetchPetAndSkins();
    // 加载已装扮的皮肤状态
    const savedEquippedSkin = localStorage.getItem(`equippedSkin_${userId}`);
    if (savedEquippedSkin) {
      setEquippedSkin(parseInt(savedEquippedSkin));
    }
  }, [userId]);

  const fetchPetAndSkins = async () => {
    try {
      // 获取用户宠物类型
      const userPet = await getUserPet(userId);
      if (userPet) {
        setPetType(userPet.pet_type);
      }

      // 获取已解锁的皮肤
      const { data: skins, error } = await supabase
        .from('unlocked_skins')
        .select('*')
        .eq('user_id', userId);

      if (error) throw error;
      setUnlockedSkins(skins || []);
    } catch (error) {
      console.error('获取博物数据失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const isUnlocked = (skinNumber: number) => {
    return unlockedSkins.some(skin => skin.skin_number === skinNumber);
  };

  const handleSkinClick = (skinNumber: number) => {
    if (isUnlocked(skinNumber)) {
      setShowGif(skinNumber);
    } else {
      alert('主人，你还没有解锁呢～');
    }
  };

  const handleEquipSkin = (skinNumber: number) => {
    setEquippedSkin(skinNumber);
    // 将装扮状态保存到localStorage
    localStorage.setItem(`equippedSkin_${userId}`, skinNumber.toString());
    alert('装扮成功！');
  };

  const handleUnequipSkin = () => {
    setEquippedSkin(null);
    // 从localStorage移除装扮状态
    localStorage.removeItem(`equippedSkin_${userId}`);
    alert('已脱下皮肤！');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-500"></div>
      </div>
    );
  }

  if (!petType) {
    return (
      <div className="max-w-6xl mx-auto p-6">
        <h1 className="text-3xl font-bold text-gray-800 mb-8 text-center">博物馆</h1>
        <div className="text-center py-12">
          <div className="text-6xl mb-4">🏛️</div>
          <div className="text-xl text-gray-600 mb-2">请先选择宠物</div>
          <div className="text-gray-500">选择宠物后即可查看博物收藏！</div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6">      
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
        {[1, 2, 3, 4, 5, 6, 7, 8].map((skinNumber) => {
          const unlocked = isUnlocked(skinNumber);
          const imageSrc = unlocked 
            ? `/animals/${petType}/bowu/${skinNumber}-1.png`
            : `/animals/${petType}/bowu/${skinNumber}.png`;
          
          return (
            <div
              key={skinNumber}
              className="bg-white rounded-lg shadow-lg p-4 cursor-pointer hover:shadow-xl transition-shadow"
              onClick={() => handleSkinClick(skinNumber)}
            >
              <div className="aspect-square relative mb-3">
                <Image
                  src={imageSrc}
                  alt={`皮肤 ${skinNumber}`}
                  fill
                  className="object-cover rounded-lg"
                  onError={(e) => {
                    // 如果图片加载失败，显示默认图片
                    const target = e.target as HTMLImageElement;
                    target.src = `/animals/${petType}/bowu/${skinNumber}.png`;
                  }}
                />
                {!unlocked && (
                  <div className="absolute top-2 right-2">
                    <div className="bg-white rounded-full p-1 shadow-md">
                      <div className="text-gray-600 text-lg">🔒</div>
                    </div>
                  </div>
                )}
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-gray-700">
                  {skinNumber >= 1 && skinNumber <= 4 ? '稀有（20%概率获得）' :
                   skinNumber >= 5 && skinNumber <= 6 ? '史诗（10%概率获得）' :
                   skinNumber === 7 ? '传说（5%概率获得）' :
                   skinNumber === 8 ? '无双（1%概率获得）' : '未知稀有度'}
                </p>
                <p className="text-xs text-gray-400">
                  {unlocked ? '已解锁' : '未解锁'}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* GIF 弹窗 */}
      {showGif && (
        <div className="fixed inset-0 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-2xl border border-gray-200">
            <div className="text-center">
              <h3 className="text-xl font-bold text-gray-800 mb-4">皮肤 {showGif}</h3>
              <div className="mb-4">
                <Image
                  src={`/animals/${petType}/bowu/${showGif}.mp4`}
                  alt={`皮肤 ${showGif} 动画`}
                  width={300}
                  height={300}
                  className="mx-auto rounded-lg"
                  unoptimized
                />
              </div>
              <div className="flex gap-2 justify-center">
                {equippedSkin === showGif ? (
                  <button
                    onClick={handleUnequipSkin}
                    className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                  >
                    脱下皮肤
                  </button>
                ) : (
                  <button
                    onClick={() => handleEquipSkin(showGif)}
                    className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                    disabled={equippedSkin !== null && equippedSkin !== showGif}
                  >
                    装扮宠物
                  </button>
                )}
                <button
                  onClick={() => setShowGif(null)}
                  className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors"
                >
                  关闭
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}