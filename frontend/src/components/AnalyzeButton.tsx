import React, { useState } from 'react';
import { Brain, Loader2 } from 'lucide-react';
import { AnalysisStatus } from '../types';

interface AnalyzeButtonProps {
  contractId: string;
  analysisStatus: AnalysisStatus;
  onOpenAnalysisModal?: (contractId: string) => void;
  variant?: 'primary' | 'secondary' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
}

const AnalyzeButton: React.FC<AnalyzeButtonProps> = ({
  contractId,
  analysisStatus,
  onOpenAnalysisModal,
  variant = 'primary',
  size = 'md',
  disabled = false
}) => {
  const handleAnalyze = () => {
    if (disabled || analysisStatus === AnalysisStatus.IN_PROGRESS) {
      return;
    }

    // Open the analysis modal instead of making direct API call
    if (onOpenAnalysisModal) {
      onOpenAnalysisModal(contractId);
    }
  };

  const getButtonContent = () => {
    if (analysisStatus === AnalysisStatus.IN_PROGRESS) {
      return (
        <>
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>Analyzing...</span>
        </>
      );
    }

    if (analysisStatus === AnalysisStatus.COMPLETED) {
      return (
        <>
          <Brain className="w-4 h-4" />
          <span>Re-analyze</span>
        </>
      );
    }

    return (
      <>
        <Brain className="w-4 h-4" />
        <span>Analyze</span>
      </>
    );
  };

  const getVariantClasses = () => {
    const baseClasses = 'inline-flex items-center gap-2 font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2';
    
    switch (variant) {
      case 'secondary':
        return `${baseClasses} bg-gray-100 text-gray-900 hover:bg-gray-200 focus:ring-gray-500 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700`;
      case 'outline':
        return `${baseClasses} border border-gray-300 text-gray-700 hover:bg-gray-50 focus:ring-gray-500 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800`;
      default:
        return `${baseClasses} bg-blue-500 text-white hover:bg-blue-600 focus:ring-blue-500 disabled:bg-gray-400 disabled:cursor-not-allowed`;
    }
  };

  const getSizeClasses = () => {
    switch (size) {
      case 'sm':
        return 'px-3 py-1.5 text-sm';
      case 'lg':
        return 'px-6 py-3 text-lg';
      default:
        return 'px-4 py-2 text-sm';
    }
  };

  const isDisabled = disabled || analysisStatus === AnalysisStatus.IN_PROGRESS;

  return (
    <button
      onClick={handleAnalyze}
      disabled={isDisabled}
      className={`${getVariantClasses()} ${getSizeClasses()} ${
        isDisabled ? 'opacity-50 cursor-not-allowed' : ''
      }`}
    >
      {getButtonContent()}
    </button>
  );
};

export default AnalyzeButton;