import React, { useState, useEffect } from "react";
import {
  X,
  ExternalLink,
  Calendar,
  Building,
  FileText,
  Hash,
  Tag,
  Eye,
  Clock,
  Activity,
  Download,
  Save,
  CheckCircle,
} from "lucide-react";

interface ContractPreviewModalProps {
  opportunityId: string;
  isOpen: boolean;
  onClose: () => void;
  onSave?: (contractData: any) => void;
}

const ContractPreviewModal: React.FC<ContractPreviewModalProps> = ({
  opportunityId,
  isOpen,
  onClose,
  onSave,
}) => {
  const [contract, setContract] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [activeTab, setActiveTab] = useState<"details" | "attachments">(
    "details"
  );

  useEffect(() => {
    if (isOpen && opportunityId) {
      fetchPreview();
    }
  }, [isOpen, opportunityId]);

  const fetchPreview = async () => {
    try {
      setLoading(true);
      setError(null);
      setSaved(false);

      const response = await fetch(
        `http://spicymini:3001/api/preview-contract-client`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            opportunityId: opportunityId,
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch contract preview: ${response.status}`);
      }

      const data = await response.json();
      setContract(data.contract);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to fetch contract preview"
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!contract) return;

    try {
      setSaving(true);
      setError(null);

      const response = await fetch(
        `http://spicymini:3001/api/fetch-contract-client`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            opportunityId: opportunityId,
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to save contract: ${response.status}`);
      }

      const data = await response.json();
      setSaved(true);

      if (onSave) {
        onSave(data.contract);
      }

      console.log(`Contract ${opportunityId} saved successfully`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save contract");
    } finally {
      setSaving(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatDeadline = (dateString: string) => {
    const deadline = new Date(dateString);
    const now = new Date();
    const diffTime = deadline.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return (
        <span className="text-red-600 dark:text-red-400">
          Expired {Math.abs(diffDays)} days ago
        </span>
      );
    } else if (diffDays === 0) {
      return <span className="text-red-600 dark:text-red-400">Due Today</span>;
    } else if (diffDays <= 7) {
      return (
        <span className="text-yellow-600 dark:text-yellow-400">
          Due in {diffDays} days
        </span>
      );
    } else {
      return (
        <span className="text-green-600 dark:text-green-400">
          Due in {diffDays} days
        </span>
      );
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const handleDownload = (url: string) => {
    window.open(url, "_blank");
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-card rounded-lg shadow-xl w-full max-w-6xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div className="flex items-center gap-4">
            <h2 className="text-2xl font-bold font-heading">
              Contract Preview
            </h2>
            <div className="flex items-center gap-2">
              <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded text-sm">
                Preview Mode
              </span>
              {saved && (
                <span className="px-2 py-1 bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 rounded text-sm flex items-center gap-1">
                  <CheckCircle className="w-3 h-3" />
                  Saved
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!saved && (
              <button
                onClick={handleSave}
                disabled={saving || !contract}
                className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Save className="w-4 h-4" />
                {saving ? "Saving..." : "Save to Database"}
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 hover:bg-muted rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden flex flex-col min-h-0">
          {loading ? (
            <div className="flex items-center justify-center h-96">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-96 text-red-600 dark:text-red-400">
              <div className="text-center">
                <FileText className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <p className="text-lg mb-2">Error loading contract</p>
                <p className="text-sm mb-4">{error}</p>
                <button
                  onClick={fetchPreview}
                  className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
                >
                  Try Again
                </button>
              </div>
            </div>
          ) : contract ? (
            <div className="flex flex-col h-full min-h-0">
              {/* Tabs */}
              <div className="flex border-b border-border flex-shrink-0">
                <button
                  onClick={() => setActiveTab("details")}
                  className={`px-6 py-3 font-medium transition-colors ${
                    activeTab === "details"
                      ? "border-b-2 border-blue-500 text-blue-600 dark:text-blue-400"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Details
                </button>
                <button
                  onClick={() => setActiveTab("attachments")}
                  className={`px-6 py-3 font-medium transition-colors ${
                    activeTab === "attachments"
                      ? "border-b-2 border-blue-500 text-blue-600 dark:text-blue-400"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Attachments ({contract.attachments?.length || 0})
                </button>
              </div>

              {/* Tab Content */}
              <div className="flex-1 overflow-y-auto p-6 min-h-0">
                {activeTab === "details" && (
                  <div className="space-y-6">
                    {/* Title and Actions */}
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <h3 className="text-2xl font-bold mb-2">
                          {contract.title}
                        </h3>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          {contract.solicitationNumber && (
                            <div className="flex items-center gap-1">
                              <Hash className="w-4 h-4" />
                              {contract.solicitationNumber}
                            </div>
                          )}
                          {contract.fetchDurationMs && (
                            <div className="flex items-center gap-1">
                              <Clock className="w-4 h-4" />
                              {contract.fetchDurationMs}ms
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <a
                          href={contract.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-800"
                        >
                          <ExternalLink className="w-4 h-4" />
                          View on SAM.gov
                        </a>
                      </div>
                    </div>

                    {/* Key Information Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-4">
                        <div>
                          <h4 className="font-semibold mb-2 flex items-center gap-2">
                            <Building className="w-4 h-4" />
                            Organization
                          </h4>
                          <p className="text-muted-foreground">
                            {contract.organizationId || "Unknown"}
                          </p>
                        </div>

                        <div>
                          <h4 className="font-semibold mb-2 flex items-center gap-2">
                            <Calendar className="w-4 h-4" />
                            Posted Date
                          </h4>
                          <p className="text-muted-foreground">
                            {formatDate(contract.postedDate)}
                          </p>
                        </div>

                        <div>
                          <h4 className="font-semibold mb-2 flex items-center gap-2">
                            <Calendar className="w-4 h-4" />
                            Deadline
                          </h4>
                          <div className="flex items-center gap-2">
                            <span className="text-muted-foreground">
                              {formatDate(contract.deadline)}
                            </span>
                            <span className="text-sm">
                              ({formatDeadline(contract.deadline)})
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-4">
                        {contract.classificationCode && (
                          <div>
                            <h4 className="font-semibold mb-2 flex items-center gap-2">
                              <Tag className="w-4 h-4" />
                              Classification
                            </h4>
                            <p className="text-muted-foreground">
                              {contract.classificationCode}
                            </p>
                          </div>
                        )}

                        {contract.setAside && (
                          <div>
                            <h4 className="font-semibold mb-2">Set Aside</h4>
                            <p className="text-muted-foreground">
                              {contract.setAside}
                            </p>
                          </div>
                        )}

                        {contract.naicsCodes && contract.naicsCodes.length > 0 && (
                          <div>
                            <h4 className="font-semibold mb-2">NAICS Codes</h4>
                            <div className="flex flex-wrap gap-1">
                              {contract.naicsCodes.map(
                                (code: string, index: number) => (
                                  <span
                                    key={index}
                                    className="px-2 py-1 bg-muted text-muted-foreground rounded text-sm"
                                  >
                                    {code}
                                  </span>
                                )
                              )}
                            </div>
                          </div>
                        )}

                        {contract.fetchMethod && (
                          <div>
                            <h4 className="font-semibold mb-2 flex items-center gap-2">
                              <Activity className="w-4 h-4" />
                              Fetch Method
                            </h4>
                            <p className="text-muted-foreground capitalize">
                              {contract.fetchMethod}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Description */}
                    <div>
                      <h4 className="font-semibold mb-2 flex items-center gap-2">
                        <FileText className="w-4 h-4" />
                        Description
                      </h4>
                      <div className="bg-muted p-4 rounded-lg max-h-96 overflow-y-auto">
                        <div
                          className="text-muted-foreground prose prose-sm max-w-none dark:prose-invert [&_p]:mb-4 [&_ul]:mb-4 [&_ol]:mb-4 [&_li]:mb-2 [&_br]:mb-2"
                          dangerouslySetInnerHTML={{
                            __html:
                              contract.description ||
                              "No description available",
                          }}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === "attachments" && (
                  <div className="space-y-4">
                    {!contract.attachments ||
                    contract.attachments.length === 0 ? (
                      <div className="text-center py-12 text-muted-foreground">
                        <FileText className="w-16 h-16 mx-auto mb-4 opacity-50" />
                        <p className="text-lg mb-2">No attachments</p>
                        <p>This contract has no attachments available</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {contract.attachments.map((attachment: any) => (
                          <div
                            key={attachment.id}
                            className="flex items-center gap-4 p-4 border border-border rounded-lg hover:bg-muted/50 transition-colors"
                          >
                            <FileText className="w-5 h-5 text-muted-foreground" />

                            <div className="flex-1 min-w-0">
                              <h5 className="font-medium truncate">
                                {attachment.name}
                              </h5>
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
                )}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default ContractPreviewModal;
