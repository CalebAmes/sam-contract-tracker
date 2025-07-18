import React, { useState, useCallback } from 'react';
import { Upload, X, File, AlertCircle, CheckCircle } from 'lucide-react';

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

interface DocumentUploadProps {
  contractId: string;
  onFilesUploaded: (files: UploadedFile[]) => void;
  onRemoveFile: (fileId: string) => void;
  uploadedFiles: UploadedFile[];
  disabled?: boolean;
}

const DocumentUpload: React.FC<DocumentUploadProps> = ({
  contractId,
  onFilesUploaded,
  onRemoveFile,
  uploadedFiles,
  disabled = false
}) => {
  const [dragActive, setDragActive] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const acceptedFileTypes = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain'
  ];

  const maxFileSize = 1024 * 1024 * 1024; // 1GB

  const validateFile = (file: File): string | null => {
    if (!acceptedFileTypes.includes(file.type)) {
      return 'Only PDF, DOC, DOCX, XLSX, and TXT files are allowed';
    }
    if (file.size > maxFileSize) {
      return 'File size must be less than 1GB';
    }
    return null;
  };

  const handleFiles = useCallback(async (files: FileList) => {
    if (disabled) return;

    const validFiles: UploadedFile[] = [];
    const errors: string[] = [];

    Array.from(files).forEach((file) => {
      const error = validateFile(file);
      if (error) {
        errors.push(`${file.name}: ${error}`);
      } else {
        validFiles.push({
          id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          file,
          name: file.name,
          size: file.size,
          type: file.type,
          status: 'pending',
          progress: 0
        });
      }
    });

    if (errors.length > 0) {
      // TODO: Show error notifications
      console.error('File validation errors:', errors);
    }

    if (validFiles.length > 0) {
      await uploadFiles(validFiles);
    }
  }, [disabled, contractId]);

  const uploadFiles = async (files: UploadedFile[]) => {
    setIsUploading(true);
    
    try {
      const uploadPromises = files.map(async (fileData) => {
        const formData = new FormData();
        formData.append('document', fileData.file);
        
        // Update file status to uploading
        const updatedFile = { ...fileData, status: 'uploading' as const };
        onFilesUploaded([...uploadedFiles, updatedFile]);

        try {
          const response = await fetch(`http://localhost:3001/api/contracts/${contractId}/upload-documents`, {
            method: 'POST',
            body: formData,
            // Note: Don't set Content-Type header for FormData, let browser set it
          });

          if (!response.ok) {
            throw new Error(`Upload failed: ${response.status}`);
          }

          const result = await response.json();
          
          return {
            ...fileData,
            status: 'success' as const,
            progress: 100
          };
        } catch (error) {
          return {
            ...fileData,
            status: 'error' as const,
            error: error instanceof Error ? error.message : 'Upload failed'
          };
        }
      });

      const results = await Promise.all(uploadPromises);
      onFilesUploaded([...uploadedFiles, ...results]);
    } catch (error) {
      console.error('Upload error:', error);
    } finally {
      setIsUploading(false);
    }
  };

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  }, [handleFiles]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFiles(e.target.files);
    }
  }, [handleFiles]);

  const getFileIcon = (type: string) => {
    if (type === 'application/pdf') return '📄';
    if (type.includes('word')) return '📝';
    if (type.includes('spreadsheet')) return '📊';
    if (type === 'text/plain') return '📄';
    return '📄';
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getStatusIcon = (status: UploadedFile['status']) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      case 'uploading':
        return <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />;
      default:
        return <File className="w-4 h-4 text-gray-500" />;
    }
  };

  return (
    <div className="space-y-4">
      {/* Upload Area */}
      <div
        className={`relative border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
          dragActive
            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
            : 'border-gray-300 dark:border-gray-600'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:border-gray-400'}`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <input
          type="file"
          multiple
          accept=".pdf,.doc,.docx,.xlsx,.txt"
          onChange={handleInputChange}
          disabled={disabled}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
        />
        
        <div className="space-y-2">
          <Upload className="w-12 h-12 mx-auto text-gray-400" />
          <div>
            <p className="text-lg font-medium">
              {dragActive ? 'Drop files here' : 'Drag & drop files here'}
            </p>
            <p className="text-sm text-muted-foreground">
              or click to select files
            </p>
          </div>
          <p className="text-xs text-muted-foreground">
            Supports PDF, DOC, DOCX, XLSX, TXT files up to 1GB
          </p>
        </div>
      </div>

      {/* Uploaded Files List */}
      {uploadedFiles.length > 0 && (
        <div className="space-y-2">
          <h4 className="font-medium text-sm">Uploaded Documents</h4>
          <div className="space-y-2">
            {uploadedFiles.map((file) => (
              <div
                key={file.id}
                className="flex items-center justify-between p-3 bg-muted rounded-lg"
              >
                <div className="flex items-center gap-3 flex-1">
                  <div className="flex items-center gap-2">
                    {getStatusIcon(file.status)}
                    <span className="text-lg">{getFileIcon(file.type)}</span>
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-sm">{file.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatFileSize(file.size)}
                      {file.status === 'error' && file.error && (
                        <span className="text-red-500 ml-2">- {file.error}</span>
                      )}
                    </p>
                  </div>
                </div>
                
                <button
                  onClick={() => onRemoveFile(file.id)}
                  disabled={disabled || file.status === 'uploading'}
                  className="p-1 text-red-500 hover:text-red-700 disabled:opacity-50"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Upload Status */}
      {isUploading && (
        <div className="text-center py-2">
          <div className="inline-flex items-center gap-2 text-sm text-muted-foreground">
            <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            Uploading documents...
          </div>
        </div>
      )}
    </div>
  );
};

export default DocumentUpload;