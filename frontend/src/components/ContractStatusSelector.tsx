import React, { useState } from 'react';
import { CircleDot, ChevronDown, Check } from 'lucide-react';
import { ContractStatus } from '../types';

interface ContractStatusSelectorProps {
  contractId: string;
  status: ContractStatus;
  onStatusUpdate: (status: ContractStatus) => void;
  editable?: boolean;
}

const ContractStatusSelector: React.FC<ContractStatusSelectorProps> = ({
  contractId,
  status,
  onStatusUpdate,
  editable = true
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [updating, setUpdating] = useState(false);

  const statusConfig = {
    [ContractStatus.NEW]: {
      label: 'New',
      color: 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900 dark:text-blue-300 dark:border-blue-700',
      buttonColor: 'hover:bg-blue-50 dark:hover:bg-blue-800'
    },
    [ContractStatus.INVESTIGATING]: {
      label: 'Investigating',
      color: 'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900 dark:text-yellow-300 dark:border-yellow-700',
      buttonColor: 'hover:bg-yellow-50 dark:hover:bg-yellow-800'
    },
    [ContractStatus.INTERESTED]: {
      label: 'Interested',
      color: 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900 dark:text-green-300 dark:border-green-700',
      buttonColor: 'hover:bg-green-50 dark:hover:bg-green-800'
    },
    [ContractStatus.DISMISSED]: {
      label: 'Dismissed',
      color: 'bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-900 dark:text-gray-300 dark:border-gray-700',
      buttonColor: 'hover:bg-gray-50 dark:hover:bg-gray-800'
    },
    [ContractStatus.APPLIED]: {
      label: 'Applied',
      color: 'bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900 dark:text-purple-300 dark:border-purple-700',
      buttonColor: 'hover:bg-purple-50 dark:hover:bg-purple-800'
    },
    [ContractStatus.ARCHIVED]: {
      label: 'Archived',
      color: 'bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-900 dark:text-gray-300 dark:border-gray-700',
      buttonColor: 'hover:bg-gray-50 dark:hover:bg-gray-800'
    }
  };

  const handleStatusChange = async (newStatus: ContractStatus) => {
    if (newStatus === status) {
      setIsOpen(false);
      return;
    }

    setUpdating(true);
    
    try {
      const response = await fetch(`http://localhost:3001/api/contracts/${contractId}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!response.ok) {
        throw new Error(`Failed to update status: ${response.status}`);
      }

      onStatusUpdate(newStatus);
    } catch (error) {
      console.error('Error updating status:', error);
    } finally {
      setUpdating(false);
      setIsOpen(false);
    }
  };

  const currentConfig = statusConfig[status];

  if (!editable) {
    return (
      <div className="flex items-center gap-2">
        <CircleDot className="w-4 h-4 text-muted-foreground" />
        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs border ${currentConfig.color}`}>
          {currentConfig.label}
        </span>
      </div>
    );
  }

  return (
    <div>
      <label className="block text-sm font-medium mb-2">Status</label>
      <div className="flex items-center gap-2">
        <CircleDot className="w-4 h-4 text-muted-foreground" />
        <div className="relative">
          <button
            onClick={() => setIsOpen(!isOpen)}
            disabled={updating}
            className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs border transition-colors ${currentConfig.color} ${currentConfig.buttonColor} disabled:opacity-50`}
          >
            {updating ? (
              <>
                <div className="animate-spin rounded-full h-3 w-3 border-b border-current"></div>
                Updating...
              </>
            ) : (
              <>
                {currentConfig.label}
                <ChevronDown className={`w-3 h-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
              </>
            )}
          </button>

          {isOpen && !updating && (
            <div className="absolute left-0 top-full mt-1 w-40 bg-card border border-border rounded-lg shadow-lg z-10">
              <div className="p-1">
                {Object.entries(statusConfig).map(([statusValue, config]) => (
                  <button
                    key={statusValue}
                    onClick={() => handleStatusChange(statusValue as ContractStatus)}
                    className={`w-full flex items-center justify-between px-2 py-1.5 text-sm rounded hover:bg-muted transition-colors ${
                      status === statusValue ? 'bg-muted' : ''
                    }`}
                  >
                    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs border ${config.color}`}>
                      {config.label}
                    </span>
                    {status === statusValue && (
                      <Check className="w-3 h-3 text-green-500" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ContractStatusSelector;