import React from 'react';
import { ContractStatus, AnalysisStatus } from '../types';

interface StatusBadgeProps {
  status: ContractStatus | AnalysisStatus;
  type?: 'contract' | 'analysis';
  size?: 'sm' | 'md' | 'lg';
}

const StatusBadge: React.FC<StatusBadgeProps> = ({ 
  status, 
  type = 'contract', 
  size = 'md' 
}) => {
  const getStatusConfig = () => {
    if (type === 'analysis') {
      switch (status as AnalysisStatus) {
        case AnalysisStatus.PENDING:
          return {
            label: 'Pending',
            classes: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200'
          };
        case AnalysisStatus.IN_PROGRESS:
          return {
            label: 'Analyzing',
            classes: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
          };
        case AnalysisStatus.COMPLETED:
          return {
            label: 'Analyzed',
            classes: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
          };
        case AnalysisStatus.FAILED:
          return {
            label: 'Failed',
            classes: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
          };
        default:
          return {
            label: 'Unknown',
            classes: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200'
          };
      }
    } else {
      switch (status as ContractStatus) {
        case ContractStatus.NEW:
          return {
            label: 'New',
            classes: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
          };
        case ContractStatus.INTERESTED:
          return {
            label: 'Interested',
            classes: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
          };
        case ContractStatus.PRE_BID:
          return {
            label: 'Pre-Bid',
            classes: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
          };
        case ContractStatus.SUBMITTED:
          return {
            label: 'Submitted',
            classes: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200'
          };
        case ContractStatus.AWARDED:
          return {
            label: 'Awarded',
            classes: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200'
          };
        case ContractStatus.LOST:
          return {
            label: 'Lost',
            classes: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200'
          };
        case ContractStatus.DISCARDED:
          return {
            label: 'Discarded',
            classes: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
          };
        case ContractStatus.CASE_STUDY:
          return {
            label: 'Case Study',
            classes: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200'
          };
        default:
          return {
            label: 'Unknown',
            classes: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200'
          };
      }
    }
  };

  const getSizeClasses = () => {
    switch (size) {
      case 'sm':
        return 'px-2 py-1 text-xs';
      case 'lg':
        return 'px-4 py-2 text-sm';
      default:
        return 'px-3 py-1 text-sm';
    }
  };

  const config = getStatusConfig();

  return (
    <span
      className={`inline-flex items-center rounded-full font-medium ${config.classes} ${getSizeClasses()}`}
    >
      {config.label}
    </span>
  );
};

export default StatusBadge;