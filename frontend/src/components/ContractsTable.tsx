import React, { useState, useEffect } from 'react';
import { 
  Calendar, 
  Building, 
  ExternalLink, 
  Eye, 
  ChevronDown, 
  ChevronUp,
  Search,
  FileText
} from 'lucide-react';
import { Contract, ContractStatus, AnalysisStatus } from '../types';
import StatusBadge from './StatusBadge';
import AnalyzeButton from './AnalyzeButton';

interface ContractsTableProps {
  onContractClick: (contractId: string) => void;
  onOpenAnalysisModal?: (contractId: string) => void;
}

const ContractsTable: React.FC<ContractsTableProps> = ({ 
  onContractClick, 
  onOpenAnalysisModal 
}) => {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<keyof Contract>('createdAt');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  useEffect(() => {
    fetchContracts();
  }, []);

  const fetchContracts = async () => {
    try {
      setLoading(true);
      const response = await fetch('http://localhost:3001/api/contracts');
      
      if (!response.ok) {
        throw new Error(`Failed to fetch contracts: ${response.status}`);
      }
      
      const data = await response.json();
      setContracts(data.contracts || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch contracts');
    } finally {
      setLoading(false);
    }
  };

  const handleSort = (field: keyof Contract) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const sortedAndFilteredContracts = contracts
    .filter(contract => 
      contract.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      contract.organizationId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      contract.description.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .sort((a, b) => {
      let aValue = a[sortField];
      let bValue = b[sortField];
      
      // Handle undefined values
      if (aValue === undefined) aValue = '';
      if (bValue === undefined) bValue = '';
      
      if (typeof aValue === 'string') {
        aValue = aValue.toLowerCase();
      }
      if (typeof bValue === 'string') {
        bValue = bValue.toLowerCase();
      }
      
      if (sortDirection === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });

  const SortIcon = ({ field }: { field: keyof Contract }) => {
    if (sortField !== field) return null;
    return sortDirection === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const formatDeadline = (dateString: string) => {
    const deadline = new Date(dateString);
    const now = new Date();
    const diffTime = deadline.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) {
      return <span className="text-red-600 dark:text-red-400">Expired</span>;
    } else if (diffDays === 0) {
      return <span className="text-red-600 dark:text-red-400">Due Today</span>;
    } else if (diffDays <= 7) {
      return <span className="text-yellow-600 dark:text-yellow-400">{diffDays} days</span>;
    } else {
      return <span className="text-green-600 dark:text-green-400">{diffDays} days</span>;
    }
  };

  if (loading) {
    return (
      <div className="bg-card p-6 rounded-lg shadow-sm border border-border">
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading contracts...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-card p-6 rounded-lg shadow-sm border border-border">
        <div className="text-center py-12 text-red-600 dark:text-red-400">
          <FileText className="w-16 h-16 mx-auto mb-4 opacity-50" />
          <p className="text-lg mb-2">Error loading contracts</p>
          <p className="text-sm">{error}</p>
          <button 
            onClick={fetchContracts}
            className="mt-4 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (contracts.length === 0) {
    return (
      <div className="bg-card p-6 rounded-lg shadow-sm border border-border">
        <div className="text-center py-12 text-muted-foreground">
          <FileText className="w-16 h-16 mx-auto mb-4 opacity-50" />
          <p className="text-lg mb-2">No contracts yet</p>
          <p>Start by analyzing contracts on the Analyze page</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search and controls */}
      <div className="flex items-center gap-4 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search contracts..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-border rounded-lg bg-input text-foreground focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        <div className="text-sm text-muted-foreground">
          {sortedAndFilteredContracts.length} contract{sortedAndFilteredContracts.length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Table */}
      <div className="bg-card rounded-lg shadow-sm border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="text-left p-4 font-medium">
                  <button
                    onClick={() => handleSort('title')}
                    className="flex items-center gap-1 hover:text-blue-500"
                  >
                    Title <SortIcon field="title" />
                  </button>
                </th>
                <th className="text-left p-4 font-medium">
                  <button
                    onClick={() => handleSort('organizationId')}
                    className="flex items-center gap-1 hover:text-blue-500"
                  >
                    Organization <SortIcon field="organizationId" />
                  </button>
                </th>
                <th className="text-left p-4 font-medium">
                  <button
                    onClick={() => handleSort('postedDate')}
                    className="flex items-center gap-1 hover:text-blue-500"
                  >
                    Posted <SortIcon field="postedDate" />
                  </button>
                </th>
                <th className="text-left p-4 font-medium">
                  <button
                    onClick={() => handleSort('deadline')}
                    className="flex items-center gap-1 hover:text-blue-500"
                  >
                    Deadline <SortIcon field="deadline" />
                  </button>
                </th>
                <th className="text-left p-4 font-medium">
                  <button
                    onClick={() => handleSort('status')}
                    className="flex items-center gap-1 hover:text-blue-500"
                  >
                    Status <SortIcon field="status" />
                  </button>
                </th>
                <th className="text-left p-4 font-medium">
                  <button
                    onClick={() => handleSort('analysisStatus')}
                    className="flex items-center gap-1 hover:text-blue-500"
                  >
                    Analysis <SortIcon field="analysisStatus" />
                  </button>
                </th>
                <th className="text-left p-4 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sortedAndFilteredContracts.map((contract) => (
                <tr
                  key={contract.id}
                  className="border-b border-border hover:bg-muted/50 cursor-pointer"
                  onClick={() => onContractClick(contract.id)}
                >
                  <td className="p-4">
                    <div className="space-y-1">
                      <div className="font-medium text-foreground line-clamp-2">
                        {contract.title}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {contract.solicitationNumber && (
                          <span className="mr-2">#{contract.solicitationNumber}</span>
                        )}
                        {contract.viewCount !== undefined && contract.viewCount > 0 && (
                          <span className="inline-flex items-center gap-1">
                            <Eye className="w-3 h-3" />
                            {contract.viewCount}
                          </span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Building className="w-4 h-4" />
                      {contract.organizationId || 'Unknown'}
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Calendar className="w-4 h-4" />
                      {formatDate(contract.postedDate)}
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-2 text-sm">
                      <Calendar className="w-4 h-4 text-muted-foreground" />
                      {formatDeadline(contract.deadline)}
                    </div>
                  </td>
                  <td className="p-4">
                    <StatusBadge status={contract.status} type="contract" size="sm" />
                  </td>
                  <td className="p-4">
                    <StatusBadge 
                      status={contract.analysisStatus || AnalysisStatus.PENDING} 
                      type="analysis" 
                      size="sm" 
                    />
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      <AnalyzeButton
                        contractId={contract.id}
                        analysisStatus={contract.analysisStatus || AnalysisStatus.PENDING}
                        onOpenAnalysisModal={onOpenAnalysisModal}
                        variant="outline"
                        size="sm"
                      />
                      <a
                        href={contract.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="p-1 text-muted-foreground hover:text-blue-500"
                        title="View on SAM.gov"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ContractsTable;