import React, { useState, useEffect } from 'react';
import { ExternalLink, Calendar, Building, Save, Check } from 'lucide-react';

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
  onContractClick: (contractId: string) => void;
  loading?: boolean;
}

export default function ContractTable({ contracts, onStatusChange, onContractClick, loading }: ContractTableProps) {
  const [savedContracts, setSavedContracts] = useState<Set<string>>(new Set());
  const [savingContracts, setSavingContracts] = useState<Set<string>>(new Set());

  // Check which contracts are already saved in the database
  useEffect(() => {
    if (contracts.length > 0) {
      checkSavedContracts();
    }
  }, [contracts]);

  const checkSavedContracts = async () => {
    try {
      const contractIds = contracts.map(c => c.id);
      const response = await fetch('http://localhost:3001/api/contracts/check-in-database', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ contractIds }),
      });

      if (response.ok) {
        const data = await response.json();
        const savedIds = Object.keys(data.results).filter(id => data.results[id]);
        setSavedContracts(new Set(savedIds));
      }
    } catch (error) {
      console.error('Error checking saved contracts:', error);
    }
  };

  const handleSaveContract = async (contract: Contract) => {
    if (savedContracts.has(contract.id) || savingContracts.has(contract.id)) {
      return;
    }

    setSavingContracts(prev => new Set(prev).add(contract.id));

    try {
      // Use the existing client API endpoint to fetch full contract details
      const response = await fetch('http://localhost:3001/api/fetch-contract-client', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          opportunityId: contract.id,
        }),
      });

      if (response.ok) {
        setSavedContracts(prev => new Set(prev).add(contract.id));
        console.log(`Contract ${contract.id} saved successfully`);
      } else {
        console.error('Failed to save contract:', response.status);
      }
    } catch (error) {
      console.error('Error saving contract:', error);
    } finally {
      setSavingContracts(prev => {
        const newSet = new Set(prev);
        newSet.delete(contract.id);
        return newSet;
      });
    }
  };

  const handleRowClick = (contractId: string, event: React.MouseEvent) => {
    // Don't open modal if clicking on buttons or links
    if ((event.target as HTMLElement).closest('button') || (event.target as HTMLElement).closest('a')) {
      return;
    }
    onContractClick(contractId);
  };
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
              <th className="px-4 py-3 text-center text-sm font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {contracts.map((contract) => (
              <tr 
                key={contract.id} 
                className="hover:bg-muted/50 cursor-pointer"
                onClick={(e) => handleRowClick(contract.id, e)}
              >
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
                <td className="px-4 py-4">
                  <div className="flex items-center justify-center gap-1">
                    {/* Save Button */}
                    {savedContracts.has(contract.id) ? (
                      <button
                        className="flex items-center gap-1 px-2 py-1 text-xs bg-green-100 hover:bg-green-200 dark:bg-green-900 dark:hover:bg-green-800 text-green-700 dark:text-green-300 rounded transition-colors"
                        title="Already saved"
                        disabled
                      >
                        <Check className="w-3 h-3" />
                        Saved
                      </button>
                    ) : (
                      <button
                        onClick={() => handleSaveContract(contract)}
                        disabled={savingContracts.has(contract.id)}
                        className="flex items-center gap-1 px-2 py-1 text-xs bg-blue-100 hover:bg-blue-200 dark:bg-blue-900 dark:hover:bg-blue-800 text-blue-700 dark:text-blue-300 rounded transition-colors disabled:opacity-50"
                        title="Save contract"
                      >
                        <Save className="w-3 h-3" />
                        {savingContracts.has(contract.id) ? 'Saving...' : 'Save'}
                      </button>
                    )}
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