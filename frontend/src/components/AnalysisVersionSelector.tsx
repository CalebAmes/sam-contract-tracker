import React, { useState, useEffect } from 'react';
import { ChevronDown, Clock, FileText, History } from 'lucide-react';

interface AnalysisVersion {
  version: number;
  analyzedAt: string;
  documentCount: number;
  wrapperScore?: number;
}

interface AnalysisVersionSelectorProps {
  contractId: string;
  currentVersion?: number;
  onVersionChange: (version: number) => void;
}

const AnalysisVersionSelector: React.FC<AnalysisVersionSelectorProps> = ({
  contractId,
  currentVersion,
  onVersionChange
}) => {
  const [versions, setVersions] = useState<AnalysisVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    fetchVersions();
  }, [contractId]);

  const fetchVersions = async () => {
    try {
      setLoading(true);
      const response = await fetch(`http://localhost:3001/api/contracts/${contractId}/analysis-history`);
      if (response.ok) {
        const data = await response.json();
        setVersions(data.history || []);
      }
    } catch (error) {
      console.error('Error fetching analysis versions:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffHours < 1) {
      return 'Just now';
    } else if (diffHours < 24) {
      return `${diffHours}h ago`;
    } else if (diffDays < 7) {
      return `${diffDays}d ago`;
    } else {
      return formatDate(dateString);
    }
  };

  const selectedVersion = versions.find(v => v.version === currentVersion) || versions[0];

  if (loading) {
    return (
      <div className="animate-pulse">
        <div className="h-10 bg-muted rounded-lg w-48"></div>
      </div>
    );
  }

  if (versions.length === 0) {
    return null;
  }

  if (versions.length === 1) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-muted/50 rounded-lg">
        <History className="w-4 h-4 text-muted-foreground" />
        <span className="text-sm font-medium">Version 1</span>
        <span className="text-xs text-muted-foreground">
          • {selectedVersion?.documentCount || 0} docs
        </span>
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 bg-muted/50 hover:bg-muted rounded-lg border border-transparent hover:border-border transition-colors"
      >
        <History className="w-4 h-4 text-muted-foreground" />
        <span className="text-sm font-medium">
          Version {selectedVersion?.version || 1}
        </span>
        <span className="text-xs text-muted-foreground">
          • {selectedVersion?.documentCount || 0} docs
          {selectedVersion?.wrapperScore !== undefined && (
            <> • {selectedVersion.wrapperScore}% wrapper</>
          )}
        </span>
        <ChevronDown className="w-4 h-4 text-muted-foreground" />
      </button>

      {isOpen && (
        <>
          <div 
            className="fixed inset-0 z-10" 
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute top-full right-0 z-20 mt-1 w-80 bg-card border border-border rounded-lg shadow-lg">
            <div className="p-2 border-b border-border">
              <h4 className="text-sm font-medium text-muted-foreground">Analysis History</h4>
            </div>
            <div className="max-h-60 overflow-y-auto">
              {versions.map((version) => (
                <button
                  key={version.version}
                  onClick={() => {
                    onVersionChange(version.version);
                    setIsOpen(false);
                  }}
                  className={`w-full p-3 text-left hover:bg-muted/50 transition-colors ${
                    version.version === currentVersion ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">
                        Version {version.version}
                      </span>
                      {version.version === versions[0].version && (
                        <span className="text-xs px-2 py-1 bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300 rounded-full">
                          Current
                        </span>
                      )}
                      {version.wrapperScore !== undefined && (
                        <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                          version.wrapperScore >= 70 
                            ? 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300' 
                            : version.wrapperScore >= 40
                            ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300'
                            : 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
                        }`}>
                          {version.wrapperScore}%
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {getRelativeTime(version.analyzedAt)}
                    </div>
                  </div>
                  <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <FileText className="w-3 h-3" />
                      {version.documentCount} document{version.documentCount !== 1 ? 's' : ''}
                    </div>
                    <div className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatDate(version.analyzedAt)}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default AnalysisVersionSelector;