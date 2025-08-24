import React, { useEffect, useState } from "react";
import { FileText, Download } from "lucide-react";
import { Attachment } from "../types";
import { API_CONFIG } from "../config/api";

interface AttachmentListProps {
  attachments: Attachment[];
  onFetchAttachments?: () => void;
  fetchingAttachments?: boolean;
  solicitationId?: string;
  onPrepareChat?: () => void;
  refreshSignal?: number;
}

const AttachmentList: React.FC<AttachmentListProps> = ({
  attachments,
  onFetchAttachments,
  fetchingAttachments = false,
  solicitationId,
  onPrepareChat,
  refreshSignal,
}) => {
  const [cachedCount, setCachedCount] = useState<number | null>(null);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    let mounted = true;
    const check = async () => {
      if (!solicitationId) {
        setCachedCount(null);
        return;
      }
      try {
        setChecking(true);
        const r = await fetch(
          API_CONFIG.endpoints.solicitationStatus(solicitationId)
        );
        if (!mounted) return;
        if (r.ok) {
          const data = await r.json();
          setCachedCount(data.count || 0);
        } else {
          setCachedCount(null);
        }
      } catch {
        if (mounted) setCachedCount(null);
      } finally {
        if (mounted) setChecking(false);
      }
    };
    check();
    return () => {
      mounted = false;
    };
  }, [solicitationId, refreshSignal]);
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const getFileIcon = (filename: string) => {
    // For now, we'll use FileText for all files
    // Could be enhanced with different icons for different file types
    return <FileText className="w-5 h-5 text-muted-foreground" />;
  };

  const handleDownload = (url: string) => {
    window.open(url, "_blank");
  };

  return (
    <div className="bg-card rounded-lg shadow-sm border border-border">
      <div className="flex items-center justify-between p-6 border-b border-border">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <FileText className="w-5 h-5" />
          Attachments ({attachments.length})
        </h3>
        <div className="flex items-center gap-3">
          {typeof cachedCount === "number" && (
            <span
              className={`inline-flex items-center gap-2 px-3 py-1.5 text-xs rounded-full border ${
                cachedCount > 0
                  ? "border-green-500/30 text-green-300 bg-green-500/10"
                  : "border-yellow-500/30 text-yellow-300 bg-yellow-500/10"
              }`}
            >
              {checking
                ? "Checking…"
                : cachedCount > 0
                ? "Saved & processed"
                : "Not prepared"}
            </span>
          )}
          {cachedCount === 0 && onPrepareChat && (
            <button
              onClick={onPrepareChat}
              className="px-3 py-1.5 text-xs rounded-lg border border-border bg-blue-500/10 hover:bg-blue-500/20 text-blue-200"
            >
              Prepare Chat
            </button>
          )}
          {attachments.length === 0 && onFetchAttachments && (
            <button
              onClick={onFetchAttachments}
              disabled={fetchingAttachments}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {fetchingAttachments ? "Fetching..." : "Fetch Attachments"}
            </button>
          )}
        </div>
      </div>

      <div className="p-6">
        {attachments.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <FileText className="w-16 h-16 mx-auto mb-4 opacity-50" />
            <p className="text-lg mb-2">No attachments</p>
            <p>This contract has no attachments available</p>
          </div>
        ) : (
          <div className="space-y-3">
            {attachments.map((attachment) => (
              <div
                key={attachment.id}
                className="flex items-center gap-4 p-4 border border-border rounded-lg hover:bg-muted/50 transition-colors"
              >
                {getFileIcon(attachment.name)}

                <div className="flex-1 min-w-0">
                  <h5 className="font-medium truncate">{attachment.name}</h5>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span>{attachment.type}</span>
                    {attachment.size && (
                      <span>{formatFileSize(attachment.size)}</span>
                    )}
                  </div>
                </div>

                <button
                  onClick={() => handleDownload(attachment.url)}
                  className="inline-flex items-center gap-2 px-3 py-1.5 text-sm bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                  title="Download file"
                >
                  <Download className="w-4 h-4" />
                  Download
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AttachmentList;
