'use client';

import { useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { Upload, Camera, X, Crop } from 'lucide-react';

interface LearningScenarioCreatorProps {
  userId: string;
  onScenarioCreated: () => void;
  onCancel: () => void;
}

export default function LearningScenarioCreator({ userId, onScenarioCreated, onCancel }: LearningScenarioCreatorProps) {
  const [uploadMethod, setUploadMethod] = useState<'photo' | 'text' | 'random' | null>(null);
  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const [textContent, setTextContent] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingError, setProcessingError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [wordCount, setWordCount] = useState(0);
  const [isRandomMode, setIsRandomMode] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleTextChange = (text: string) => {
    setTextContent(text);
    setWordCount(text.length);
  };

  // 随机选择文言文内容
  const loadRandomText = async () => {
    try {
      const response = await fetch('/data/qingjing.json');
      const data = await response.json();
      const randomIndex = Math.floor(Math.random() * data.length);
      const randomText = data[randomIndex].text;
      handleTextChange(randomText);
    } catch (error) {
      console.error('加载随机文本失败:', error);
      alert('加载随机文本失败，请重试');
    }
  };

  // 处理随机造梦选择
  const handleRandomSelect = async () => {
    setUploadMethod('random');
    setIsRandomMode(true);
    await loadRandomText();
  };

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length > 2) {
      alert('最多只能上传2张图片');
      return;
    }
    setSelectedImages(files);
  };

  const removeImage = (index: number) => {
    setSelectedImages(prev => prev.filter((_, i) => i !== index));
  };

  // 监控处理状态
  const monitorProgress = async (scenarioId: string) => {
    const maxAttempts = 120; // 最多监控2分钟
    let attempts = 0;
    
    const checkProgress = async () => {
      try {
        const { data, error } = await supabase
          .from('learning_scenarios')
          .select('status')
          .eq('id', scenarioId)
          .single();

        if (error) throw error;
        
        if (data.status === 'ready') {
          setIsProcessing(false);
          setProcessingError(null);
          onScenarioCreated();
          return;
        } else if (data.status === 'failed') {
          throw new Error('处理失败，请重试');
        }
        
        attempts++;
        if (attempts < maxAttempts) {
          setTimeout(checkProgress, 1000); // 每秒检查一次
        } else {
          throw new Error('处理超时，请重试');
        }
      } catch (error) {
        console.error('监控状态失败:', error);
        setProcessingError(error instanceof Error ? error.message : '处理失败');
        setIsProcessing(false);
      }
    };
    
    checkProgress();
  };

  const processImages = async () => {
    if (selectedImages.length === 0) return '';

    try {
      // 将图片转换为base64
      const imagePromises = selectedImages.map(file => {
        return new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            const base64 = reader.result as string;
            resolve(base64.split(',')[1]); // 移除data:image/jpeg;base64,前缀
          };
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
      });

      const base64Images = await Promise.all(imagePromises);
      
      // 调用OCR API
      const response = await fetch('/api/ocr', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          images: base64Images
        })
      });

      if (!response.ok) {
        throw new Error('OCR处理失败');
      }

      const result = await response.json();
      return result.text || '';
    } catch (error) {
      console.error('OCR处理错误:', error);
      throw new Error('图片文字识别失败，请重试');
    }
  };

  const createScenario = async () => {
    if (!textContent.trim()) {
      alert('请输入或上传文本内容');
      return;
    }

    if (wordCount > 500) {
      alert('文本内容不能超过500字，请删减后重试');
      return;
    }

    setIsProcessing(true);
    setProcessingError(null);
    
    // 立即关闭弹窗
    onCancel();

    try {
      // 创建学习情境记录
      const { data: scenario, error: scenarioError } = await supabase
        .from('learning_scenarios')
        .insert({
          user_id: userId,
          title: textContent.slice(0, 20) + (textContent.length > 20 ? '...' : ''),
          original_text: textContent,
          status: 'processing',
          progress: 0
        })
        .select()
        .single();

      if (scenarioError) throw scenarioError;

      // 创建学习进度记录
      const { error: progressError } = await supabase
        .from('learning_progress')
        .insert({
          scenario_id: scenario.id,
          user_id: userId,
          current_sentence: 1,
          completed_sentences: [],
          is_completed: false
        });

      if (progressError) throw progressError;

      // 开始后台处理
      const response = await fetch('/api/process-scenario', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          scenarioId: scenario.id,
          text: textContent
        })
      });

      if (!response.ok) {
        throw new Error(`处理请求失败: ${response.status}`);
      }

      // 开始监控进度
      monitorProgress(scenario.id);

    } catch (error) {
      console.error('创建学习情境失败:', error);
      setProcessingError(error instanceof Error ? error.message : '创建失败');
      setIsProcessing(false);
    }
  };

  // 重试处理
  const handleRetry = async () => {
    if (retryCount >= 3) {
      setProcessingError('重试次数过多，请稍后再试');
      return;
    }
    
    setRetryCount(prev => prev + 1);
     await createScenario();
  };

  const handlePhotoUpload = async () => {
    if (selectedImages.length === 0) {
      alert('请先选择图片');
      return;
    }

    setIsProcessing(true);
    try {
      const extractedText = await processImages();
      handleTextChange(extractedText);
      setUploadMethod('text');
    } catch (error) {
      alert(error instanceof Error ? error.message : '处理失败');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="p-6 w-full">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800">创建学习情境</h2>
        <button
          onClick={onCancel}
          className="text-gray-500 hover:text-gray-700"
        >
          <X className="h-6 w-6" />
        </button>
      </div>

        {!uploadMethod && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button
                onClick={() => setUploadMethod('photo')}
                className="p-6 border-2 border-dashed border-blue-300 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors"
              >
                <Camera className="h-12 w-12 text-blue-600 mx-auto mb-3" />
                <h3 className="font-medium text-gray-800 mb-2">照片上传</h3>
                <p className="text-sm text-gray-600">上传1-2张包含文言文的图片</p>
              </button>

              <button
                onClick={() => setUploadMethod('text')}
                className="p-6 border-2 border-dashed border-green-300 rounded-lg hover:border-green-500 hover:bg-green-50 transition-colors"
              >
                <Upload className="h-12 w-12 text-green-600 mx-auto mb-3" />
                <h3 className="font-medium text-gray-800 mb-2">直接上传</h3>
                <p className="text-sm text-gray-600">直接输入或粘贴文言文内容</p>
              </button>

              <button
                onClick={handleRandomSelect}
                className="p-6 border-2 border-dashed border-purple-300 rounded-lg hover:border-purple-500 hover:bg-purple-50 transition-colors"
              >
                <div className="h-12 w-12 text-purple-600 mx-auto mb-3 flex items-center justify-center text-2xl font-bold">✨</div>
                <h3 className="font-medium text-gray-800 mb-2">随机造梦</h3>
                <p className="text-sm text-gray-600">随机选择一篇经典文言文</p>
              </button>
            </div>
          </div>
        )}

        {uploadMethod === 'photo' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-medium">照片上传</h3>
              <button
                onClick={() => setUploadMethod(null)}
                className="text-sm text-blue-600 hover:text-blue-800"
              >
                重新选择
              </button>
            </div>

            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handleImageUpload}
                className="hidden"
              />
              
              {selectedImages.length === 0 ? (
                <div className="text-center">
                  <Camera className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                  <p className="text-gray-600 mb-3">点击选择图片（最多2张）</p>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                  >
                    选择图片
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {selectedImages.map((image, index) => (
                      <div key={index} className="relative">
                        <img
                          src={URL.createObjectURL(image)}
                          alt={`上传图片 ${index + 1}`}
                          className="w-full h-48 object-cover rounded border"
                        />
                        <button
                          onClick={() => removeImage(index)}
                          className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                  
                  <div className="flex gap-3">
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50"
                      disabled={selectedImages.length >= 2}
                    >
                      {selectedImages.length >= 2 ? '已达上限' : '添加图片'}
                    </button>
                    
                    <button
                      onClick={handlePhotoUpload}
                      disabled={isProcessing}
                      className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                    >
                      {isProcessing ? '识别中...' : '开始识别'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {(uploadMethod === 'text' || uploadMethod === 'random') && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-medium">{uploadMethod === 'random' ? '随机造梦' : '文本内容'}</h3>
              <div className="flex gap-2">
                {uploadMethod === 'random' && (
                  <button
                    onClick={loadRandomText}
                    className="text-sm text-purple-600 hover:text-purple-800 px-3 py-1 border border-purple-300 rounded hover:bg-purple-50"
                  >
                    再试一次
                  </button>
                )}
                <button
                  onClick={() => {
                    setUploadMethod(null);
                    setIsRandomMode(false);
                    setTextContent('');
                    setWordCount(0);
                  }}
                  className="text-sm text-blue-600 hover:text-blue-800"
                >
                  重新选择
                </button>
              </div>
            </div>

            <div className="space-y-3">
              <textarea
                value={textContent}
                onChange={(e) => handleTextChange(e.target.value)}
                placeholder="请输入文言文内容..."
                className="w-[600px] h-64 p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
              
              <div className="flex justify-between items-center text-sm">
                <span className={`${wordCount > 500 ? 'text-red-600' : 'text-gray-600'}`}>
                  字数：{wordCount}/500
                </span>
                {wordCount > 500 && (
                  <span className="text-red-600">超出字数限制，请删减内容</span>
                )}
              </div>
            </div>

            {/* 处理状态显示 */}
            {isProcessing && (
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-600 border-t-transparent"></div>
                    <span className="text-sm font-medium text-blue-900">正在创建学习情境...</span>
                  </div>
                  <button
                    onClick={onCancel}
                    className="text-gray-500 hover:text-gray-700 p-1 rounded-full hover:bg-gray-100"
                    title="关闭"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}

            {/* 错误显示 */}
            {processingError && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0">
                    <X className="h-5 w-5 text-red-400" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-sm font-medium text-red-800">处理失败</h3>
                    <p className="text-sm text-red-700 mt-1">{processingError}</p>
                    {retryCount < 3 && (
                      <button
                        onClick={handleRetry}
                        className="mt-2 text-sm bg-red-100 text-red-800 px-3 py-1 rounded hover:bg-red-200"
                      >
                        重试 ({retryCount}/3)
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}

            <div className="flex gap-3 pt-4">
              <button
                onClick={onCancel}
                className="px-6 py-2 border border-gray-300 rounded hover:bg-gray-50"
                disabled={isProcessing}
              >
                取消
              </button>
              
              <button
                onClick={createScenario}
                disabled={isProcessing || !textContent.trim() || wordCount > 500}
                className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {isProcessing ? '处理中...' : '进入桃源'}
              </button>
            </div>
          </div>
        )}
    </div>
  );
}