import React from 'react';
import { CheckCircle, Brain, Trash2, ExternalLink, Calendar, Building } from 'lucide-react';

interface Contract {
  id: string;
  title: string;
  url: string;
  description: string;
  postedDate: string;
  deadline: string;
  status: string;
  aiScore: number;
  attachments: any[];
  createdAt: string;
  updatedAt: string;
}

interface ContractTableProps {
  contracts: Contract[];
  onStatusChange: (contractId: string, newStatus: string) => void;
  loading?: boolean;
}

export default function ContractTable({ contracts, onStatusChange, loading }: ContractTableProps) {
  if (loading) {
    return (
      <div className="bg-card p-6 rounded-lg shadow-sm border border-border">
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-muted rounded w-1/4"></div>
          <div className="space-y-3">
            <div className="h-4 bg-muted rounded"></div>
            <div className="h-4 bg-muted rounded"></div>
            <div className="h-4 bg-muted rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  if (contracts.length === 0) {
    return (
      <div className="bg-card p-6 rounded-lg shadow-sm border border-border">
        <div className="text-center py-12 text-muted-foreground">
          <Building className="w-16 h-16 mx-auto mb-4 opacity-50" />
          <p className="text-lg mb-2">No contracts found</p>
          <p>Try a different SAM.gov search URL</p>
        </div>
      </div>
    );
  }

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString();
    } catch {
      return dateString;
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 70) return 'text-green-600 dark:text-green-400';
    if (score >= 40) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-red-600 dark:text-red-400';
  };

  return (
    <div className="bg-card rounded-lg shadow-sm border border-border overflow-hidden">
      <div className="p-4 border-b border-border">
        <h3 className="text-lg font-semibold font-heading">
          Contract Opportunities ({contracts.length})
        </h3>
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-muted">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-medium">Title</th>
              <th className="px-4 py-3 text-left text-sm font-medium">Posted</th>
              <th className="px-4 py-3 text-left text-sm font-medium">Deadline</th>
              <th className="px-4 py-3 text-center text-sm font-medium">Score</th>
              <th className="px-4 py-3 text-center text-sm font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {contracts.map((contract) => (
              <tr key={contract.id} className="hover:bg-muted/50">
                <td className="px-4 py-4">
                  <div className="space-y-1">
                    <div className="flex items-start gap-2">
                      <h4 className="font-medium text-sm leading-tight">{contract.title}</h4>
                      <a
                        href={contract.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-500 hover:text-blue-600 flex-shrink-0"
                      >
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {contract.description}
                    </p>
                    {contract.attachments.length > 0 && (
                      <div className="text-xs text-blue-600 dark:text-blue-400">
                        📎 {contract.attachments.length} attachment{contract.attachments.length !== 1 ? 's' : ''}
                      </div>
                    )}
                  </div>
                </td>
                <td className="px-4 py-4">
                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    <Calendar className="w-3 h-3" />
                    {formatDate(contract.postedDate)}
                  </div>
                </td>
                <td className="px-4 py-4">
                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    <Calendar className="w-3 h-3" />
                    {formatDate(contract.deadline)}
                  </div>
                </td>
                <td className="px-4 py-4 text-center">
                  <span className={`text-sm font-medium ${getScoreColor(contract.aiScore)}`}>
                    {contract.aiScore}%
                  </span>
                </td>
                <td className="px-4 py-4">
                  <div className="flex items-center justify-center gap-1">
                    <button
                      onClick={() => onStatusChange(contract.id, 'pre-bid')}
                      className="flex items-center gap-1 px-2 py-1 text-xs bg-green-100 hover:bg-green-200 dark:bg-green-900 dark:hover:bg-green-800 text-green-700 dark:text-green-300 rounded transition-colors"
                      title="Move to Pre-Bid"
                    >
                      <CheckCircle className="w-3 h-3" />
                      Pre-Bid
                    </button>
                    <button
                      onClick={() => onStatusChange(contract.id, 'case-study')}
                      className="flex items-center gap-1 px-2 py-1 text-xs bg-blue-100 hover:bg-blue-200 dark:bg-blue-900 dark:hover:bg-blue-800 text-blue-700 dark:text-blue-300 rounded transition-colors"
                      title="Mark as Case Study"
                    >
                      <Brain className="w-3 h-3" />
                      Study
                    </button>
                    <button
                      onClick={() => onStatusChange(contract.id, 'discarded')}
                      className="flex items-center gap-1 px-2 py-1 text-xs bg-red-100 hover:bg-red-200 dark:bg-red-900 dark:hover:bg-red-800 text-red-700 dark:text-red-300 rounded transition-colors"
                      title="Discard"
                    >
                      <Trash2 className="w-3 h-3" />
                      Discard
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}