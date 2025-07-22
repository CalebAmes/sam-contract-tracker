import React, { useState } from 'react';
import { Calendar, Filter, X } from 'lucide-react';
import { ContractStatus, AnalysisStatus, ContractPriority } from '../types';

interface ContractFiltersProps {
  onFiltersChange: (filters: any) => void;
  currentFilters?: any;
}

const formatStatusLabel = (status: string): string => {
  // Handle special cases
  if (status === 'case-study') return 'Case Study';
  if (status === 'pre-bid') return 'Pre-Bid';
  
  // Default: capitalize first letter and replace hyphens/underscores with spaces
  return status
    .split(/[-_]/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

const ContractFilters: React.FC<ContractFiltersProps> = ({ 
  onFiltersChange, 
  currentFilters = {} 
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [filters, setFilters] = useState({
    status: currentFilters.status || '',
    analysisStatus: currentFilters.analysisStatus || '',
    priority: currentFilters.priority || '',
    wrapperScoreMin: currentFilters.wrapperScoreMin || '',
    wrapperScoreMax: currentFilters.wrapperScoreMax || '',
    deadlineFrom: currentFilters.deadlineFrom || '',
    deadlineTo: currentFilters.deadlineTo || '',
    postedFrom: currentFilters.postedFrom || '',
    postedTo: currentFilters.postedTo || '',
  });

  const [activeFiltersCount, setActiveFiltersCount] = useState(
    Object.values(currentFilters || {}).filter(v => v).length
  );

  const handleFilterChange = (filterName: string, value: string) => {
    const newFilters = { ...filters, [filterName]: value };
    setFilters(newFilters);
    
    // Clean empty values
    const cleanedFilters = Object.entries(newFilters).reduce((acc, [key, val]) => {
      if (val) acc[key] = val;
      return acc;
    }, {} as any);
    
    setActiveFiltersCount(Object.keys(cleanedFilters).length);
    onFiltersChange(cleanedFilters);
  };

  const clearFilters = () => {
    const emptyFilters = {
      status: '',
      analysisStatus: '',
      priority: '',
      wrapperScoreMin: '',
      wrapperScoreMax: '',
      deadlineFrom: '',
      deadlineTo: '',
      postedFrom: '',
      postedTo: '',
    };
    setFilters(emptyFilters);
    setActiveFiltersCount(0);
    onFiltersChange({});
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={`inline-flex items-center gap-2 px-4 py-2 border rounded-lg transition-colors ${
          activeFiltersCount > 0
            ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300'
            : 'border-border hover:bg-muted'
        }`}
      >
        <Filter className="w-4 h-4" />
        <span>Filters</span>
        {activeFiltersCount > 0 && (
          <span className="px-2 py-0.5 text-xs font-medium bg-blue-500 text-white rounded-full">
            {activeFiltersCount}
          </span>
        )}
      </button>

      {isExpanded && (
        <div className="absolute top-full mt-2 right-0 w-96 bg-card rounded-lg shadow-lg border border-border z-50">
          <div className="p-4 border-b border-border">
            <div className="flex items-center justify-between">
              <h3 className="font-medium">Filter Contracts</h3>
              <button
                onClick={() => setIsExpanded(false)}
                className="p-1 hover:bg-muted rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="p-4 space-y-4 max-h-96 overflow-y-auto">
            {/* Status Filters */}
            <div>
              <label className="block text-sm font-medium mb-1">Contract Status</label>
              <select
                value={filters.status}
                onChange={(e) => handleFilterChange('status', e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground"
              >
                <option value="">All Statuses</option>
                {Object.values(ContractStatus).map(status => (
                  <option key={status} value={status}>
                    {formatStatusLabel(status)}
                  </option>
                ))}
              </select>
            </div>

            {/* Analysis Status */}
            <div>
              <label className="block text-sm font-medium mb-1">Analysis Status</label>
              <select
                value={filters.analysisStatus}
                onChange={(e) => handleFilterChange('analysisStatus', e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground"
              >
                <option value="">All Analysis States</option>
                {Object.values(AnalysisStatus).map(status => (
                  <option key={status} value={status}>
                    {status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' ')}
                  </option>
                ))}
              </select>
            </div>

            {/* Priority */}
            <div>
              <label className="block text-sm font-medium mb-1">Priority</label>
              <select
                value={filters.priority}
                onChange={(e) => handleFilterChange('priority', e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground"
              >
                <option value="">All Priorities</option>
                {Object.values(ContractPriority).map(priority => (
                  <option key={priority} value={priority}>
                    {priority.charAt(0).toUpperCase() + priority.slice(1)}
                  </option>
                ))}
              </select>
            </div>

            {/* Wrapper Score Range */}
            <div>
              <label className="block text-sm font-medium mb-1">Wrapper Score Range</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  placeholder="Min"
                  min="0"
                  max="100"
                  value={filters.wrapperScoreMin}
                  onChange={(e) => handleFilterChange('wrapperScoreMin', e.target.value)}
                  className="flex-1 px-3 py-2 border border-border rounded-lg bg-background text-foreground"
                />
                <span className="self-center">-</span>
                <input
                  type="number"
                  placeholder="Max"
                  min="0"
                  max="100"
                  value={filters.wrapperScoreMax}
                  onChange={(e) => handleFilterChange('wrapperScoreMax', e.target.value)}
                  className="flex-1 px-3 py-2 border border-border rounded-lg bg-background text-foreground"
                />
              </div>
            </div>

            {/* Deadline Date Range */}
            <div>
              <label className="block text-sm font-medium mb-1">
                <Calendar className="w-4 h-4 inline mr-1" />
                Deadline Range
              </label>
              <div className="space-y-2">
                <input
                  type="date"
                  value={filters.deadlineFrom}
                  onChange={(e) => handleFilterChange('deadlineFrom', e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground"
                />
                <input
                  type="date"
                  value={filters.deadlineTo}
                  onChange={(e) => handleFilterChange('deadlineTo', e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground"
                />
              </div>
            </div>

            {/* Posted Date Range */}
            <div>
              <label className="block text-sm font-medium mb-1">
                <Calendar className="w-4 h-4 inline mr-1" />
                Posted Date Range
              </label>
              <div className="space-y-2">
                <input
                  type="date"
                  value={filters.postedFrom}
                  onChange={(e) => handleFilterChange('postedFrom', e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground"
                />
                <input
                  type="date"
                  value={filters.postedTo}
                  onChange={(e) => handleFilterChange('postedTo', e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground"
                />
              </div>
            </div>
          </div>

          <div className="p-4 border-t border-border">
            <button
              onClick={clearFilters}
              className="w-full px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
            >
              Clear All Filters
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ContractFilters;