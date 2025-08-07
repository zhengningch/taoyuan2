'use client';

import { useState } from 'react';
import LearningGrid from '@/components/LearningGrid';
import LearningScenarioCreator from '@/components/LearningScenarioCreator';
import LearningInterface from '@/components/LearningInterface';

type ViewMode = 'grid' | 'learning';

interface LearningModuleProps {
  userId: string;
}

export default function LearningModule({ userId }: LearningModuleProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [selectedScenarioId, setSelectedScenarioId] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const handleCreateScenario = () => {
    setShowCreateModal(true);
  };

  const handleScenarioCreated = () => {
    setShowCreateModal(false);
  };

  const handleStartLearning = (scenarioId: string) => {
    setSelectedScenarioId(scenarioId);
    setViewMode('learning');
  };

  const handleBackToGrid = () => {
    setViewMode('grid');
    setSelectedScenarioId(null);
  };

  const handleCloseCreateModal = () => {
    setShowCreateModal(false);
  };

  return (
    <div className="h-full">
      {viewMode === 'grid' && (
        <LearningGrid
          userId={userId}
          onCreateScenario={handleCreateScenario}
          onStartLearning={handleStartLearning}
        />
      )}
      
      {viewMode === 'learning' && selectedScenarioId && (
        <LearningInterface
          scenarioId={selectedScenarioId}
          userId={userId}
          onBack={handleBackToGrid}
        />
      )}
      
      {/* 创建学习情境弹窗 */}
      {showCreateModal && (
        <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50">
          <div className="bg-white rounded-lg shadow-2xl border max-w-6xl max-h-[90vh] overflow-y-auto">
            <LearningScenarioCreator
              userId={userId}
              onScenarioCreated={handleScenarioCreated}
              onCancel={handleCloseCreateModal}
            />
          </div>
        </div>
      )}
    </div>
  );
}