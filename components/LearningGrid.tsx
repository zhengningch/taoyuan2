'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Plus, BookOpen, CheckCircle, Trash2 } from 'lucide-react';

interface LearningScenario {
  id: string;
  title?: string;
  status: 'processing' | 'ready' | 'completed';
  progress: number;
  created_at: string;
  image_url?: string;
  is_completed?: boolean;
  poem?: string;
}

interface LearningGridProps {
  userId: string;
  onCreateScenario: () => void;
  onStartLearning: (scenarioId: string) => void;
}

export default function LearningGrid({ userId, onCreateScenario, onStartLearning }: LearningGridProps) {
  const [scenarios, setScenarios] = useState<LearningScenario[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchScenarios();
    
    // 设置定时器，每5秒检查一次处理中的情境
    const interval = setInterval(() => {
      const processingScenarios = scenarios.filter(s => s.status === 'processing');
      if (processingScenarios.length > 0) {
        fetchScenarios();
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [userId, scenarios]);

  const fetchScenarios = async () => {
    try {
      const { data, error } = await supabase
        .from('learning_scenarios')
        .select(`
          *,
          scenario_content(image_url),
          learning_progress(is_completed)
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // 处理数据，将scenario_content中的image_url和learning_progress中的is_completed提取到顶层
      const processedData = data?.map(scenario => ({
        ...scenario,
        image_url: scenario.scenario_content?.[0]?.image_url,
        is_completed: scenario.learning_progress?.[0]?.is_completed || false
      })) || [];
      
      setScenarios(processedData);
    } catch (error) {
      console.error('Error fetching scenarios:', error);
    } finally {
      setLoading(false);
    }
  };

  const deleteScenario = async (scenarioId: string) => {
    try {
      const { error } = await supabase
        .from('learning_scenarios')
        .delete()
        .eq('id', scenarioId)
        .eq('user_id', userId);

      if (error) throw error;
      
      // 重新获取数据
      fetchScenarios();
    } catch (error) {
      console.error('Error deleting scenario:', error);
      alert('删除失败，请重试');
    }
  };

  const getCardStyle = (scenario: LearningScenario) => {
    switch (scenario.status) {
      case 'processing':
        return 'border-transparent border-4 bg-yellow-50';
      case 'ready':
        return 'border-transparent border-4 bg-blue-50 hover:bg-blue-100 cursor-pointer';
      case 'completed':
        return 'border-transparent border-4 bg-green-50 hover:bg-green-100 cursor-pointer';
      default:
        return 'border-transparent border-4 bg-gray-50';
    }
  };

  const getCardIcon = (scenario: LearningScenario) => {
    switch (scenario.status) {
      case 'processing':
        return (
          <div className="flex flex-col items-center justify-center h-full relative">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-600 mb-2"></div>
            <span className="text-2xl font-bold text-yellow-600">{scenario.progress}%</span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (confirm('确定要删除这个处理中的学习情境吗？')) {
                  deleteScenario(scenario.id);
                }
              }}
              className="absolute top-0 right-0 p-1 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
              title="删除"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        );
      case 'ready':
        return (
          <div className="flex items-center justify-center h-full">
            <BookOpen className="h-12 w-12 text-blue-600" />
          </div>
        );
      case 'completed':
        return scenario.is_completed && scenario.image_url ? (
          <div className="w-full h-[90%] overflow-hidden rounded-lg">
            <img 
              src={scenario.image_url} 
              alt="学习情境图片" 
              className="w-full h-full object-cover"
            />
          </div>
        ) : (
          <div className="flex items-center justify-center h-full">
            <CheckCircle className="h-12 w-12 text-green-600" />
          </div>
        );
    }
  };

  const renderEmptyCards = () => {
    const emptyCount = Math.max(0, 3 - scenarios.length);
    return Array.from({ length: emptyCount }, (_, index) => (
      <div
        key={`empty-${index}`}
        className="w-48 h-48 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center bg-transparent hover:border-gray-400 cursor-pointer transition-colors"
        onClick={onCreateScenario}
      >
        <div className="text-gray-400">
          <div className="w-16 h-16 border border-gray-300 rounded"></div>
        </div>
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

  return (
    <div className="max-w-6xl mx-auto p-6">
      
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 justify-items-center">
        {/* 现有的学习情境 */}
        {scenarios.map((scenario) => (
          <div
            key={scenario.id}
            className={`w-48 h-48 border-2 rounded-lg transition-all duration-200 ${getCardStyle(scenario)} relative`}
            onClick={() => scenario.status !== 'processing' && onStartLearning(scenario.id)}
          >
            <div className="h-full p-4 flex flex-col justify-between items-center relative">
              <div className="flex-1 flex items-center justify-center">
                {getCardIcon(scenario)}
              </div>
              {/* 文字固定在内部容器底部 */}
               <div className="w-full mb-2">
                {(scenario.status === 'completed' && scenario.is_completed && scenario.poem) ? (
                  <div className="text-center">
                    <p className="text-sm font-medium text-gray-700 truncate">
                      {scenario.poem.length > 10 ? scenario.poem.substring(0, 10) + '...' : scenario.poem}
                    </p>
                  </div>
                ) : scenario.title && (
                  <div className="text-center">
                    <p className="text-sm font-medium text-gray-700 truncate">
                      {scenario.title.length > 10 ? scenario.title.substring(0, 10) + '...' : scenario.title}
                    </p>
                  </div>
                )}
                {scenario.status === 'processing' && (
                  <div className="text-center">
                    <p className="text-xs text-gray-500">处理中...</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}

        {/* 空白卡牌 */}
        {renderEmptyCards()}

        {/* 新建按钮 */}
        <div
          className="w-48 h-48 border-2 border-dashed border-blue-300 rounded-lg flex items-center justify-center bg-blue-50 hover:bg-blue-100 cursor-pointer transition-colors"
          onClick={onCreateScenario}
        >
          <div className="text-center">
            <Plus className="h-12 w-12 text-blue-600 mx-auto mb-2" />
            <p className="text-blue-600 font-medium">新建学习情境</p>
          </div>
        </div>
      </div>

      {scenarios.length > 0 && (
        <div className="mt-8 text-center text-sm text-gray-500">
          <p>共 {scenarios.length} 个学习情境</p>
        </div>
      )}
    </div>
  );
}