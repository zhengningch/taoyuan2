"use client";  // 标记为客户端组件，以使用React钩子
import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { VideoBackground } from '@/components/VideoBackground';  // 导入视频背景组件
import PetSelectionModal from '@/components/PetSelectionModal';
import PetChat from '@/components/PetChat';
import Dictionary from '@/components/Dictionary';
import ReviewCards from '@/components/ReviewCards';
import ExcerptManager from '@/components/ExcerptManager';
import TextSelectionMenu from '@/components/TextSelectionMenu';
import LearningModule from '@/components/LearningModule';
import Museum from '@/components/Museum';
import LevelIndicator from '@/components/LevelIndicator';
import { getUserPet, PetData } from '@/lib/pet';
import { supabase } from '@/lib/supabase';

// 主界面组件
// 显示视频背景加半透明蒙版，顶部导航和模板切换
export default function Dashboard() {
  const [selectedTab, setSelectedTab] = useState('学习');  // 当前选中的模板
  const [user, setUser] = useState<any>(null);
  const [petData, setPetData] = useState<PetData | null>(null);
  const [showPetSelection, setShowPetSelection] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // 模板列表和对应图片映射
  const tabs = ['学习', '复习', '摘抄', '词典', '博物'] as const;
  const tabImages: Record<typeof tabs[number], string> = {
    '学习': '/page/xuexi.PNG',
    '复习': '/page/fuxi.PNG', 
    '摘抄': '/page/zhaichao.PNG',
    '词典': '/page/cidian.PNG',
    '博物': '/page/bowu.PNG'
  };

  // 检查用户认证和宠物数据
  useEffect(() => {
    const checkUserAndPet = async () => {
      try {
        // 获取当前用户
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          // 如果没有用户，重定向到登录页面
          window.location.href = '/login';
          return;
        }
        setUser(user);

        // 检查用户是否已选择宠物
        const userPet = await getUserPet(user.id);
        if (userPet) {
          setPetData(userPet);
        } else {
          // 如果没有宠物数据，显示选择弹窗
          setShowPetSelection(true);
        }
      } catch (error) {
        console.error('Error checking user and pet:', error);
      } finally {
        setIsLoading(false);
      }
    };

    checkUserAndPet();
  }, []);

  // 处理宠物选择完成
  const handlePetSelectionComplete = (newPetData: PetData) => {
    setPetData(newPetData);
    setShowPetSelection(false);
  };

  // 如果正在加载，显示加载界面
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-amber-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-500 mx-auto mb-4"></div>
          <p className="text-gray-600">加载中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden">
      <VideoBackground />  {/* 背景视频，循环播放，速度减慢 */}
      {/* 全屏淡米色半透明容器 */}
       <div className="absolute inset-0 z-10 bg-amber-50/80 flex flex-col">
          {/* 顶部导航 */}
          <header className="flex justify-between items-center p-4 shrink-0 border-b border-gray-300">
            <div className="flex space-x-4 mx-auto">  {/* 中间模板选择 */}
              {tabs.map((tab) => (
                <button
                  key={tab}
                  onClick={() => setSelectedTab(tab)}
                  className={`p-2 rounded-lg transition ${selectedTab === tab ? 'bg-red-800/20 border-2 border-red-800' : 'bg-white/10 hover:bg-white/20'}`}
                >
                  <Image
                    src={tabImages[tab]}
                    alt={tab}
                    width={60}
                    height={60}
                    className="object-contain"
                  />
                </button>
              ))}
            </div>
            <div className="flex items-center gap-4 ml-auto">
              {user && <LevelIndicator userId={user.id} />}
              <Image
                src="/name.png"  // 右上方标题图片
                alt="桃源名称"
                width={150}
                height={50}
              />
            </div>
         </header>
         {/* 主要内容区域 */}
         <main className="flex-grow p-8 overflow-y-auto">
           {selectedTab === '学习' && user && <LearningModule userId={user.id} />}
           {selectedTab === '复习' && user && <ReviewCards userId={user.id} />}
            {selectedTab === '摘抄' && user && <ExcerptManager userId={user.id} />}
            {selectedTab === '词典' && user && <Dictionary userId={user.id} />}
           {selectedTab === '博物' && user && <Museum userId={user.id} />}
         </main>
       </div>

       {/* 宠物选择弹窗 */}
       {showPetSelection && user && (
         <PetSelectionModal
           userId={user.id}
           onComplete={handlePetSelectionComplete}
         />
       )}

       {/* 宠物聊天组件 */}
       {petData && user && (
         <PetChat
           petType={petData.pet_type}
           personality={petData.personality}
           userNickname={petData.user_nickname}
           petName={petData.pet_name}
           userId={user.id}
         />
       )}

       {/* 全站文本选择菜单 */}
       {user && <TextSelectionMenu userId={user.id} />}
    </div>
  );
}