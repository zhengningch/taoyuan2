"use client";
import React, { useState } from 'react';
import Image from 'next/image';
import { supabase } from '@/lib/supabase';

import { PetData, saveUserPet } from '@/lib/pet';

interface PetSelectionModalProps {
  userId: string;
  onComplete: (petData: PetData) => void;
}

const PetSelectionModal: React.FC<PetSelectionModalProps> = ({ userId, onComplete }) => {
  const [step, setStep] = useState(1); // 1: 选择宠物, 2: 设置称呼, 3: 设置宠物名字, 4: 选择性格
  const [selectedPet, setSelectedPet] = useState('');
  const [userNickname, setUserNickname] = useState('');
  const [petName, setPetName] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [customTag, setCustomTag] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const pets = [
    { type: 'cat', name: '小猫', defaultName: '桃桃', defaultNickname: '主人' },
    { type: 'dog', name: '小狗', defaultName: '源源', defaultNickname: '小主' },
    { type: 'panda', name: '熊猫', defaultName: '学学', defaultNickname: '朋友' },
    { type: 'squirrel', name: '松鼠', defaultName: '境境', defaultNickname: '伙伴' }
  ];

  const predefinedTags = ['傲娇', '可爱', '博学', '活泼', '温柔', '调皮', '聪明', '忠诚'];

  const handlePetSelect = (petType: string) => {
    setSelectedPet(petType);
    const pet = pets.find(p => p.type === petType);
    const defaultName = pet?.defaultName || '';
    const defaultNickname = pet?.defaultNickname || '';
    setPetName(defaultName);
    setUserNickname(defaultNickname);
    setStep(2);
  };

  const handleNicknameNext = () => {
    if (userNickname.trim()) {
      setStep(3);
    } else {
      alert('请输入宠物对你的称呼');
    }
  };

  const handlePetNameNext = () => {
    if (petName.trim()) {
      setStep(4);
    } else {
      alert('请输入宠物的名字');
    }
  };

  const handleTagToggle = (tag: string) => {
    if (selectedTags.includes(tag)) {
      setSelectedTags(selectedTags.filter(t => t !== tag));
    } else if (selectedTags.length < 3) {
      setSelectedTags([...selectedTags, tag]);
    }
  };

  const handleAddCustomTag = () => {
    if (customTag.trim() && customTag.length <= 15 && selectedTags.length < 3 && !selectedTags.includes(customTag.trim())) {
      setSelectedTags([...selectedTags, customTag.trim()]);
      setCustomTag('');
    }
  };

  const handleFinish = async () => {
    if (selectedTags.length === 0) {
      alert('请至少选择一个性格标签');
      return;
    }

    setIsLoading(true);
    try {
      // 保存到数据库
      const petData = {
        user_id: userId,
        pet_type: selectedPet as 'cat' | 'dog' | 'panda' | 'squirrel',
        personality: selectedTags,
        user_nickname: userNickname.trim(),
        pet_name: petName.trim()
      };

      const savedPetData = await saveUserPet(petData);
      if (!savedPetData) {
        alert('保存失败，请重试');
        return;
      }

      onComplete(savedPetData);
    } catch (error) {
      console.error('保存宠物数据时出错:', error);
      alert('保存失败，请重试');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl p-8 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        {step === 1 ? (
          <div className="text-center">
            <h2 className="text-2xl font-bold mb-4 text-gray-800">欢迎来到桃源</h2>
            <p className="text-gray-600 mb-8">这是你的小动物，请你选择一个，注意，选择之后他就会一直跟着你哦</p>
            
            <div className="grid grid-cols-2 gap-6">
              {pets.map((pet) => (
                <button
                  key={pet.type}
                  onClick={() => handlePetSelect(pet.type)}
                  className="flex flex-col items-center p-6 border-2 border-gray-200 rounded-xl hover:border-red-500 hover:bg-red-50 transition-all duration-200"
                >
                  <Image
                    src={`/animals/${pet.type}/logo.png`}
                    alt={pet.name}
                    width={120}
                    height={120}
                    className="mb-4"
                  />
                  <span className="text-lg font-medium text-gray-700">{pet.name}</span>
                </button>
              ))}
            </div>
          </div>
        ) : step === 2 ? (
          <div className="text-center">
            <h2 className="text-2xl font-bold mb-4 text-gray-800">设置称呼</h2>
            <p className="text-gray-600 mb-6">你希望{pets.find(p => p.type === selectedPet)?.name}叫你什么？</p>
            
            <div className="mb-6">
              <input
                type="text"
                value={userNickname}
                onChange={(e) => setUserNickname(e.target.value)}
                placeholder="例如：主人、小主、朋友等"
                maxLength={10}
                className="px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-red-500 text-center text-lg w-64"
              />
            </div>
            
            <div className="flex gap-4 justify-center">
              <button
                onClick={() => setStep(1)}
                className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                返回
              </button>
              <button
                onClick={handleNicknameNext}
                className="px-6 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
              >
                下一步
              </button>
            </div>
          </div>
        ) : step === 3 ? (
          <div className="text-center">
            <h2 className="text-2xl font-bold mb-4 text-gray-800">设置宠物名字</h2>
            <p className="text-gray-600 mb-6">给你的{pets.find(p => p.type === selectedPet)?.name}起个名字吧</p>
            
            <div className="mb-6">
              <input
                type="text"
                value={petName}
                onChange={(e) => setPetName(e.target.value)}
                placeholder="输入宠物的名字"
                maxLength={10}
                className="px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-red-500 text-center text-lg w-64"
              />
              <p className="text-sm text-gray-500 mt-2">默认名字：{pets.find(p => p.type === selectedPet)?.defaultName}</p>
            </div>
            
            <div className="flex gap-4 justify-center">
              <button
                onClick={() => setStep(2)}
                className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                返回
              </button>
              <button
                onClick={handlePetNameNext}
                className="px-6 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
              >
                下一步
              </button>
            </div>
          </div>
        ) : (
          <div className="text-center">
            <h2 className="text-2xl font-bold mb-4 text-gray-800">设置{petName}的性格</h2>
            <p className="text-gray-600 mb-6">选择1-3个标签来描述你的小伙伴</p>
            
            <div className="mb-6">
              <h3 className="text-lg font-medium mb-4 text-gray-700">预设标签</h3>
              <div className="flex flex-wrap gap-3 justify-center">
                {predefinedTags.map((tag) => (
                  <button
                    key={tag}
                    onClick={() => handleTagToggle(tag)}
                    disabled={selectedTags.length >= 3 && !selectedTags.includes(tag)}
                    className={`px-4 py-2 rounded-full border transition-all duration-200 ${
                      selectedTags.includes(tag)
                        ? 'bg-red-500 text-white border-red-500'
                        : selectedTags.length >= 3
                        ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                        : 'bg-white text-gray-700 border-gray-300 hover:border-red-500 hover:bg-red-50'
                    }`}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>
            
            <div className="mb-6">
              <h3 className="text-lg font-medium mb-4 text-gray-700">自定义标签</h3>
              <div className="flex gap-2 justify-center">
                <input
                  type="text"
                  value={customTag}
                  onChange={(e) => setCustomTag(e.target.value)}
                  placeholder="输入自定义标签（最多15字）"
                  maxLength={15}
                  disabled={selectedTags.length >= 3}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-red-500 disabled:bg-gray-100"
                />
                <button
                  onClick={handleAddCustomTag}
                  disabled={!customTag.trim() || selectedTags.length >= 3 || selectedTags.includes(customTag.trim())}
                  className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                >
                  添加
                </button>
              </div>
            </div>
            
            <div className="mb-6">
              <h3 className="text-lg font-medium mb-2 text-gray-700">已选择的标签</h3>
              <div className="flex flex-wrap gap-2 justify-center">
                {selectedTags.map((tag) => (
                  <span
                    key={tag}
                    className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-sm flex items-center gap-1"
                  >
                    {tag}
                    <button
                      onClick={() => setSelectedTags(selectedTags.filter(t => t !== tag))}
                      className="text-red-500 hover:text-red-700 ml-1"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            </div>
            
            <div className="flex gap-4 justify-center">
              <button
                onClick={() => setStep(3)}
                className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                返回
              </button>
              <button
                onClick={handleFinish}
                disabled={selectedTags.length === 0 || isLoading}
                className="px-6 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
              >
                {isLoading ? '保存中...' : '完成'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PetSelectionModal;