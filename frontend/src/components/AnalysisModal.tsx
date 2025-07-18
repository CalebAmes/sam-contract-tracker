import React, { useState, useEffect, useRef } from 'react';
import { X, Brain, AlertCircle, CheckCircle, Clock, FileText, Upload, Loader2, FileCheck, AlertTriangle } from 'lucide-react';
import { Contract, AnalysisStatus } from '../types';
import DocumentUpload from './DocumentUpload';

interface UploadedFile {
  id: string;
  file: File;
  name: string;
  size: number;
  type: string;
  status: 'pending' | 'uploading' | 'success' | 'error';
  progress: number;
  error?: string;
}

interface AnalysisModalProps {
  contract: Contract;
  isOpen: boolean;
  onClose: () => void;
  onAnalysisComplete: (contractId: string) => void;
}

const AnalysisModal: React.FC<AnalysisModalProps> = ({
  contract,
  isOpen,
  onClose,
  onAnalysisComplete
}) => {
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [analysisStatus, setAnalysisStatus] = useState<AnalysisStatus>(AnalysisStatus.PENDING);
  const [analysisStep, setAnalysisStep] = useState('');
  const [showResults, setShowResults] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
  const [error, setError] = useState<string | null>(null);
  const pollingInterval = useRef<NodeJS.Timeout | null>(null);
  const startTime = useRef<number>(0);
  const [elapsedTime, setElapsedTime] = useState(0);

  useEffect(() => {
    if (isOpen) {
      // Reset state when modal opens
      setUploadedFiles([]);
      setAnalysisStatus(contract.analysisStatus || AnalysisStatus.PENDING);
      setAnalysisStep('');
      setShowResults(false);
      setError(null);
      setUploadProgress({});
      setElapsedTime(0);
      startTime.current = 0;
    }
  }, [isOpen, contract.analysisStatus]);

  useEffect(() => {
    // Update elapsed time during analysis
    let timer: NodeJS.Timeout | null = null;
    if (analysisStatus === AnalysisStatus.IN_PROGRESS && startTime.current > 0) {
      timer = setInterval(() => {
        setElapsedTime(Math.floor((Date.now() - startTime.current) / 1000));
      }, 100);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [analysisStatus]);

  const handleFilesUploaded = (files: UploadedFile[]) => {
    setUploadedFiles(files);
  };

  const handleRemoveFile = (fileId: string) => {
    setUploadedFiles(prev => prev.filter(f => f.id !== fileId));
    setUploadProgress(prev => {
      const newProgress = { ...prev };
      delete newProgress[fileId];
      return newProgress;
    });
  };

  const hasValidDocuments = () => {
    return (
      contract.attachments.length > 0 || 
      uploadedFiles.some(f => f.status === 'success')
    );
  };

  const pollAnalysisStatus = async () => {
    try {
      const response = await fetch(`http://localhost:3001/api/contracts/${contract.id}`);
      if (!response.ok) throw new Error('Failed to fetch status');
      
      const data = await response.json();
      const updatedContract = data.contract;
      
      if (updatedContract.analysisStatus === AnalysisStatus.COMPLETED) {
        setAnalysisStatus(AnalysisStatus.COMPLETED);
        setAnalysisStep('Analysis complete!');
        setShowResults(true);
        if (pollingInterval.current) {
          clearInterval(pollingInterval.current);
          pollingInterval.current = null;
        }
        onAnalysisComplete(contract.id);
      } else if (updatedContract.analysisStatus === AnalysisStatus.FAILED) {
        setAnalysisStatus(AnalysisStatus.FAILED);
        setAnalysisStep('Analysis failed');
        setError('The analysis process encountered an error. Please try again.');
        if (pollingInterval.current) {
          clearInterval(pollingInterval.current);
          pollingInterval.current = null;
        }
      } else {
        // Update analysis step based on elapsed time
        const elapsed = Math.floor((Date.now() - startTime.current) / 1000);
        if (elapsed < 3) {
          setAnalysisStep('Initializing analysis engine...');
        } else if (elapsed < 6) {
          setAnalysisStep('Processing uploaded documents...');
        } else if (elapsed < 10) {
          setAnalysisStep('Extracting contract information...');
        } else if (elapsed < 14) {
          setAnalysisStep('Analyzing wrapper indicators...');
        } else if (elapsed < 18) {
          setAnalysisStep('Evaluating contract requirements...');
        } else {
          setAnalysisStep('Finalizing analysis results...');
        }
      }
    } catch (error) {
      console.error('Error polling status:', error);
    }
  };

  const startAnalysis = async () => {
    if (!hasValidDocuments()) {
      return;
    }

    setAnalysisStatus(AnalysisStatus.IN_PROGRESS);
    setAnalysisStep('Preparing documents for analysis...');
    setError(null);
    startTime.current = Date.now();

    try {
      // Start the analysis process
      const response = await fetch(`http://localhost:3001/api/contracts/${contract.id}/analyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          uploadedFiles: uploadedFiles
            .filter(f => f.status === 'success')
            .map(f => ({ id: f.id, name: f.name, type: f.type }))
        })
      });

      if (!response.ok) {
        throw new Error(`Analysis failed: ${response.status}`);
      }

      // Start polling for real status updates
      pollingInterval.current = setInterval(pollAnalysisStatus, 1000);

    } catch (error) {
      console.error('Analysis error:', error);
      setAnalysisStatus(AnalysisStatus.FAILED);
      setAnalysisStep('Failed to start analysis');
      setError(error instanceof Error ? error.message : 'An unexpected error occurred');
    }
  };

  const getDocumentCount = () => {
    const attachmentCount = contract.attachments.length;
    const uploadedCount = uploadedFiles.filter(f => f.status === 'success').length;
    return attachmentCount + uploadedCount;
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
  };

  const renderContent = () => {
    if (analysisStatus === AnalysisStatus.IN_PROGRESS) {
      return (
        <div className="space-y-6">
          <div className="text-center">
            <div className="relative w-20 h-20 mx-auto mb-4">
              <div className="absolute inset-0 bg-blue-100 rounded-full animate-pulse"></div>
              <div className="absolute inset-0 flex items-center justify-center">
                <Brain className="w-10 h-10 text-blue-600" />
              </div>
              <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-blue-600 animate-spin"></div>
            </div>
            <h3 className="text-lg font-semibold mb-2">Analyzing Contract</h3>
            <p className="text-muted-foreground">{analysisStep}</p>
          </div>

          <div className="space-y-4">
            <div className="bg-muted/50 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Processing Documents</span>
                <span className="text-xs text-muted-foreground">{getDocumentCount()} files</span>
              </div>
              <div className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                <div className="flex-1 bg-gray-200 rounded-full h-1.5">
                  <div className="bg-blue-500 h-1.5 rounded-full animate-pulse" style={{ width: '60%' }}></div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-center gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4" />
                <span>Elapsed: {formatTime(elapsedTime)}</span>
              </div>
              <div className="flex items-center gap-2">
                <FileCheck className="w-4 h-4" />
                <span>Est. 15-30 seconds</span>
              </div>
            </div>
          </div>

          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
            <p className="text-sm text-blue-800 dark:text-blue-200">
              <strong>Tip:</strong> Our AI is analyzing your documents for wrapper contract indicators, 
              compliance requirements, and incumbent information. This usually takes 15-30 seconds depending 
              on document complexity.
            </p>
          </div>
        </div>
      );
    }

    if (analysisStatus === AnalysisStatus.COMPLETED && showResults) {
      return (
        <div className="space-y-6">
          <div className="text-center">
            <div className="w-16 h-16 mx-auto mb-4 bg-green-100 rounded-full flex items-center justify-center">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Analysis Complete!</h3>
            <p className="text-muted-foreground">
              Your contract has been analyzed successfully.
            </p>
          </div>

          <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
            <h4 className="font-medium mb-2 text-green-800 dark:text-green-200">Analysis Summary</h4>
            <div className="space-y-1 text-sm text-green-700 dark:text-green-300">
              <p>• Documents processed: {getDocumentCount()}</p>
              <p>• Analysis completed in: {formatTime(elapsedTime)}</p>
              <p>• Results available in the Analysis tab</p>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
            >
              View Results
            </button>
          </div>
        </div>
      );
    }

    if (analysisStatus === AnalysisStatus.FAILED) {
      return (
        <div className="space-y-6">
          <div className="text-center">
            <div className="w-16 h-16 mx-auto mb-4 bg-red-100 rounded-full flex items-center justify-center">
              <AlertTriangle className="w-8 h-8 text-red-600" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Analysis Failed</h3>
            <p className="text-muted-foreground">{error || 'An unexpected error occurred during analysis.'}</p>
          </div>

          <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4">
            <p className="text-sm text-red-800 dark:text-red-200">
              This could be due to document processing issues or temporary service unavailability. 
              Please ensure your documents are valid PDFs, Word documents, or text files and try again.
            </p>
          </div>

          <div className="flex justify-center">
            <button
              onClick={() => {
                setAnalysisStatus(AnalysisStatus.PENDING);
                setAnalysisStep('');
                setError(null);
                setElapsedTime(0);
              }}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
            >
              Try Again
            </button>
          </div>
        </div>
      );
    }

    // Default: Document upload and analysis setup
    return (
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-semibold mb-2">AI Contract Analysis</h3>
          <p className="text-muted-foreground mb-4">
            Our AI will analyze your contract documents to identify wrapper contract indicators, 
            evaluate compliance requirements, and provide actionable recommendations.
          </p>
        </div>

        {/* Existing Attachments */}
        {contract.attachments.length > 0 && (
          <div>
            <h4 className="font-medium mb-3 flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Existing Attachments ({contract.attachments.length})
            </h4>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {contract.attachments.map((attachment) => (
                <div
                  key={attachment.id}
                  className="flex items-center gap-3 p-3 bg-muted rounded-lg"
                >
                  <FileText className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{attachment.name}</p>
                    <p className="text-xs text-muted-foreground">{attachment.type}</p>
                  </div>
                  <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Document Upload */}
        <div>
          <h4 className="font-medium mb-3 flex items-center gap-2">
            <Upload className="w-4 h-4" />
            Upload Additional Documents
          </h4>
          <DocumentUpload
            contractId={contract.id}
            onFilesUploaded={handleFilesUploaded}
            onRemoveFile={handleRemoveFile}
            uploadedFiles={uploadedFiles}
            disabled={analysisStatus === AnalysisStatus.IN_PROGRESS}
          />
        </div>

        {/* Analysis Info */}
        <div className="bg-muted/50 rounded-lg p-4">
          <h5 className="font-medium text-sm mb-2">What happens during analysis?</h5>
          <ul className="space-y-1 text-sm text-muted-foreground">
            <li>• Extract and process contract text</li>
            <li>• Identify wrapper contract indicators</li>
            <li>• Analyze compliance requirements</li>
            <li>• Detect incumbent vendor information</li>
            <li>• Generate actionable recommendations</li>
          </ul>
        </div>

        {/* Analysis Button */}
        <div className="flex justify-between items-center pt-4 border-t">
          <div className="text-sm text-muted-foreground">
            {!hasValidDocuments() ? (
              <span className="text-red-500 flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                At least one document is required for analysis
              </span>
            ) : (
              <span className="text-green-600 dark:text-green-400 flex items-center gap-2">
                <CheckCircle className="w-4 h-4" />
                Ready to analyze {getDocumentCount()} document{getDocumentCount() !== 1 ? 's' : ''}
              </span>
            )}
          </div>
          <button
            onClick={startAnalysis}
            disabled={!hasValidDocuments() || analysisStatus === AnalysisStatus.IN_PROGRESS}
            className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <Brain className="w-4 h-4" />
            Start AI Analysis
          </button>
        </div>
      </div>
    );
  };

  useEffect(() => {
    // Cleanup polling on unmount
    return () => {
      if (pollingInterval.current) {
        clearInterval(pollingInterval.current);
      }
    };
  }, []);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-card rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
              <Brain className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold">AI Contract Analysis</h2>
              <p className="text-sm text-muted-foreground">Powered by Gemini AI</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={analysisStatus === AnalysisStatus.IN_PROGRESS}
            className="p-2 hover:bg-muted rounded-lg transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="mb-4 pb-4 border-b">
            <h3 className="font-medium text-sm text-muted-foreground mb-1">Contract</h3>
            <p className="text-sm font-medium">{contract.title}</p>
            <p className="text-xs text-muted-foreground mt-1">ID: {contract.solicitationNumber || contract.id}</p>
          </div>
          
          {renderContent()}
        </div>
      </div>
    </div>
  );
};

export default AnalysisModal;