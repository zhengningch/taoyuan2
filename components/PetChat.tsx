"use client";
import React, { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import ReactMarkdown from 'react-markdown';

interface PetChatProps {
  petType: string;
  personality: string[];
  userNickname?: string;
  petName?: string;
  userId?: string;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

const PetChat: React.FC<PetChatProps> = ({ petType, personality, userNickname, petName, userId }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [equippedSkin, setEquippedSkin] = useState<number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const petNames = {
    cat: '小猫',
    dog: '小狗', 
    panda: '熊猫',
    squirrel: '松鼠'
  };

  // 获取宠物图片路径
  const getPetImageSrc = () => {
    if (equippedSkin) {
      return `/animals/${petType}/bowu/${equippedSkin}-1.png`;
    }
    return `/animals/${petType}/logo.png`;
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // 监听装扮状态变化
  useEffect(() => {
    if (userId) {
      const checkEquippedSkin = () => {
        const savedEquippedSkin = localStorage.getItem(`equippedSkin_${userId}`);
        setEquippedSkin(savedEquippedSkin ? parseInt(savedEquippedSkin) : null);
      };
      
      checkEquippedSkin();
      
      // 监听localStorage变化
      const handleStorageChange = (e: StorageEvent) => {
        if (e.key === `equippedSkin_${userId}`) {
          setEquippedSkin(e.newValue ? parseInt(e.newValue) : null);
        }
      };
      
      window.addEventListener('storage', handleStorageChange);
      
      // 定期检查装扮状态（用于同一页面内的变化）
      const interval = setInterval(checkEquippedSkin, 1000);
      
      return () => {
        window.removeEventListener('storage', handleStorageChange);
        clearInterval(interval);
      };
    }
  }, [userId]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
    
    // 添加欢迎消息（仅在首次打开且没有消息时）
    if (isOpen && messages.length === 0 && userNickname && petName) {
      const welcomeMessage: Message = {
        role: 'assistant',
        content: `你好呀，${userNickname}，我是${petName}，有什么可以帮助你的嘛？`,
        timestamp: new Date()
      };
      setMessages([welcomeMessage]);
    }
  }, [isOpen, messages.length, userNickname, petName]);

  // Listen for askAI events from text selection
  useEffect(() => {
    const handleAskAI = async (event: CustomEvent) => {
      const { question } = event.detail;
      setIsOpen(true);
      
      // 自动发送消息
      const userMessage: Message = {
        role: 'user',
        content: question,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, userMessage]);
      setIsLoading(true);

      // 创建助手消息占位符
      const assistantMessage: Message = {
        role: 'assistant',
        content: '',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, assistantMessage]);

      try {
        const conversationHistory = [
          {
            role: 'system',
            content: `你是一个${personality.join('、')}的${petNames[petType as keyof typeof petNames]}，你的名字是${petName || petNames[petType as keyof typeof petNames]}，你称呼用户为${userNickname || '同学'}。现在你在当用户的高中语文老师，请你根据你的性格，回答用户的疑问。请用简洁明了的语言回答，不要太长。记住要用你的名字和对用户的称呼来交流。`
          },
          ...messages.map(msg => ({ role: msg.role, content: msg.content })),
          { role: 'user', content: userMessage.content }
        ];

        // 使用真实的 AI API
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messages: conversationHistory
          })
        });

        if (!response.ok) {
          throw new Error(`网络请求失败: ${response.status}`);
        }

        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error('无法读取响应');
        }

        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.trim() && line.startsWith('data: ')) {
              const data = line.slice(6).trim();
              if (data === '[DONE]') {
                break;
              }
              try {
                const parsed = JSON.parse(data);
                if (parsed.choices?.[0]?.delta?.content) {
                  const content = parsed.choices[0].delta.content;
                  assistantMessage.content += content;
                  setMessages(prev => {
                    const newMessages = [...prev];
                    newMessages[newMessages.length - 1] = { ...assistantMessage };
                    return newMessages;
                  });
                  // 添加小延迟实现打字机效果
                  await new Promise(resolve => setTimeout(resolve, 30));
                }
              } catch (e) {
                console.warn('解析响应数据失败:', e);
              }
            }
          }
        }
        
      } catch (error) {
        console.error('发送消息失败:', error);
        // 移除空的助手消息
        setMessages(prev => prev.slice(0, -1));
        
        const errorMessage: Message = {
          role: 'assistant',
          content: '抱歉，我现在有点累了，请稍后再试试吧~ 🐾',
          timestamp: new Date()
        };
        setMessages(prev => [...prev, errorMessage]);
      } finally {
        setIsLoading(false);
      }
    };

    document.addEventListener('askAI', handleAskAI as unknown as EventListener);
    return () => {
      document.removeEventListener('askAI', handleAskAI as unknown as EventListener);
    };
  }, [personality, petType, petName, userNickname, messages]);

  const sendMessage = async () => {
    if (!inputValue.trim() || isLoading) return;

    const userMessage: Message = {
      role: 'user',
      content: inputValue.trim(),
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);

    // 创建助手消息占位符
    const assistantMessage: Message = {
      role: 'assistant',
      content: '',
      timestamp: new Date()
    };
    setMessages(prev => [...prev, assistantMessage]);

    try {
      const conversationHistory = [
        {
          role: 'system',
          content: `你是一个${personality.join('、')}的${petNames[petType as keyof typeof petNames]}，你的名字是${petName || petNames[petType as keyof typeof petNames]}，你称呼用户为${userNickname || '同学'}。现在你在当用户的高中语文老师，请你根据你的性格，回答用户的疑问。请用简洁明了的语言回答，不要太长。记住要用你的名字和对用户的称呼来交流。`
        },
        ...messages.map(msg => ({ role: msg.role, content: msg.content })),
        { role: 'user', content: userMessage.content }
      ];

      // 使用真实的 AI API
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: conversationHistory
        })
      });

      if (!response.ok) {
        throw new Error(`网络请求失败: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('无法读取响应');
      }

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.trim() && line.startsWith('data: ')) {
            const data = line.slice(6).trim();
            if (data === '[DONE]') {
              break;
            }
            try {
              const parsed = JSON.parse(data);
              if (parsed.choices?.[0]?.delta?.content) {
                const content = parsed.choices[0].delta.content;
                assistantMessage.content += content;
                setMessages(prev => {
                  const newMessages = [...prev];
                  newMessages[newMessages.length - 1] = { ...assistantMessage };
                  return newMessages;
                });
                // 添加小延迟实现打字机效果
                await new Promise(resolve => setTimeout(resolve, 30));
              }
            } catch (e) {
              console.warn('解析响应数据失败:', e);
            }
          }
        }
      }
      
    } catch (error) {
      console.error('发送消息失败:', error);
      // 移除空的助手消息
      setMessages(prev => prev.slice(0, -1));
      
      const errorMessage: Message = {
        role: 'assistant',
        content: '抱歉，我现在有点累了，请稍后再试试吧~ 🐾',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <>
      {/* 右下角宠物logo */}
      <div className="fixed bottom-6 right-6 z-40">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="w-32 h-32 bg-white rounded-full shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-110 flex items-center justify-center"
        >
          <Image
            src={getPetImageSrc()}
            alt={petNames[petType as keyof typeof petNames]}
            width={96}
            height={96}
            className="rounded-full"
          />
        </button>
      </div>

      {/* 聊天窗口 */}
      {isOpen && (
        <div className="fixed bottom-24 right-6 w-96 h-96 bg-white rounded-2xl shadow-2xl z-50 flex flex-col border border-gray-200">
          {/* 头部 */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-red-50 rounded-t-2xl">
            <div className="flex items-center gap-3">
              <Image
                src={getPetImageSrc()}
                alt={petNames[petType as keyof typeof petNames]}
                width={32}
                height={32}
                className="rounded-full"
              />
              <div>
                <h3 className="font-medium text-gray-800">{petNames[petType as keyof typeof petNames]}</h3>
                <p className="text-xs text-gray-500">{personality.join('、')}</p>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-gray-400 hover:text-gray-600 text-xl font-bold"
            >
              ×
            </button>
          </div>

          {/* 消息区域 */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.length === 0 && (
              <div className="text-center text-gray-500 text-sm mt-8">
                <p>你好！我是你的{petNames[petType as keyof typeof petNames]}老师</p>
                <p>有什么语文问题可以问我哦~</p>
              </div>
            )}
            {messages.map((message, index) => (
              <div
                key={index}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] p-3 rounded-2xl ${
                    message.role === 'user'
                      ? 'bg-red-500 text-white'
                      : 'bg-gray-100 text-gray-800'
                  }`}
                >
                  {message.role === 'assistant' ? (
                    <div className="prose prose-sm max-w-none text-sm">
                      <ReactMarkdown>{message.content}</ReactMarkdown>
                    </div>
                  ) : (
                    <p className="text-sm">{message.content}</p>
                  )}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-gray-100 text-gray-800 p-3 rounded-2xl">
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* 输入区域 */}
          <div className="p-4 border-t border-gray-200">
            <div className="flex gap-2">
              <input
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="输入你的问题..."
                disabled={isLoading}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-red-500 disabled:bg-gray-100 text-sm text-gray-900 bg-white"
              />
              <button
                onClick={sendMessage}
                disabled={!inputValue.trim() || isLoading}
                className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors text-sm"
              >
                发送
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default PetChat;