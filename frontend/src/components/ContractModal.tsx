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
} from "lucide-react";
import { Contract, AnalysisStatus, ContractPriority } from "../types";
import StatusBadge from "./StatusBadge";
import AnalyzeButton from "./AnalyzeButton";
import ContractFlags from "./ContractFlags";
import ContractNotes from "./ContractNotes";
import ContractPriorityComponent from "./ContractPriority";
import ContractActions from "./ContractActions";

interface ContractModalProps {
  contractId: string;
  isOpen: boolean;
  onClose: () => void;
  onAnalyze?: (contractId: string) => void;
}

const ContractModal: React.FC<ContractModalProps> = ({
  contractId,
  isOpen,
  onClose,
  onAnalyze,
}) => {
  const [contract, setContract] = useState<Contract | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<
    "details" | "attachments" | "analysis" | "lifecycle"
  >("details");

  useEffect(() => {
    if (isOpen && contractId) {
      fetchContract();
    }
  }, [isOpen, contractId]);

  const fetchContract = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(
        `http://localhost:3001/api/contracts/${contractId}`
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch contract: ${response.status}`);
      }

      const data = await response.json();
      setContract(data.contract);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch contract");
    } finally {
      setLoading(false);
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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-card rounded-lg shadow-xl w-full max-w-6xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div className="flex items-center gap-4">
            <h2 className="text-2xl font-bold font-heading">
              Contract Details
            </h2>
            {contract && (
              <div className="flex items-center gap-2">
                <StatusBadge status={contract.status} type="contract" />
                <StatusBadge
                  status={contract.analysisStatus || AnalysisStatus.PENDING}
                  type="analysis"
                />
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-muted rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center h-96">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-96 text-red-600 dark:text-red-400">
              <div className="text-center">
                <FileText className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <p className="text-lg mb-2">Contract not saved yet</p>
                <p className="text-sm mb-4">This contract needs to be saved before viewing details</p>
                <p className="text-sm text-muted-foreground">
                  Click the "Save" button in the search results to save this contract first
                </p>
                <button
                  onClick={onClose}
                  className="mt-4 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
                >
                  Back to Search
                </button>
              </div>
            </div>
          ) : contract ? (
            <div className="h-full flex flex-col">
              {/* Tabs */}
              <div className="flex border-b border-border">
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
                  Attachments ({contract.attachments.length})
                </button>
                <button
                  onClick={() => setActiveTab("analysis")}
                  className={`px-6 py-3 font-medium transition-colors ${
                    activeTab === "analysis"
                      ? "border-b-2 border-blue-500 text-blue-600 dark:text-blue-400"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Analysis
                </button>
                <button
                  onClick={() => setActiveTab("lifecycle")}
                  className={`px-6 py-3 font-medium transition-colors ${
                    activeTab === "lifecycle"
                      ? "border-b-2 border-blue-500 text-blue-600 dark:text-blue-400"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Lifecycle
                </button>
              </div>

              {/* Tab Content */}
              <div className="flex-1 overflow-y-auto p-6">
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
                          {contract.viewCount !== undefined &&
                            contract.viewCount > 0 && (
                              <div className="flex items-center gap-1">
                                <Eye className="w-4 h-4" />
                                {contract.viewCount} views
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
                        <AnalyzeButton
                          contractId={contract.id}
                          analysisStatus={
                            contract.analysisStatus || AnalysisStatus.PENDING
                          }
                          onOpenAnalysisModal={onAnalyze}
                        />
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
                              {contract.naicsCodes.map((code, index) => (
                                <span
                                  key={index}
                                  className="px-2 py-1 bg-muted text-muted-foreground rounded text-sm"
                                >
                                  {code}
                                </span>
                              ))}
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
                      <div className="bg-muted p-4 rounded-lg">
                        <p className="text-muted-foreground whitespace-pre-wrap">
                          {contract.description || "No description available"}
                        </p>
                      </div>
                    </div>

                    {/* Timestamps */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-muted-foreground">
                      <div>
                        <strong>Created:</strong>{" "}
                        {formatDate(contract.createdAt)}
                      </div>
                      <div>
                        <strong>Updated:</strong>{" "}
                        {formatDate(contract.updatedAt)}
                      </div>
                      {contract.lastViewedAt && (
                        <div>
                          <strong>Last Viewed:</strong>{" "}
                          {formatDate(contract.lastViewedAt)}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {activeTab === "attachments" && (
                  <div className="space-y-4">
                    {contract.attachments.length === 0 ? (
                      <div className="text-center py-12 text-muted-foreground">
                        <FileText className="w-16 h-16 mx-auto mb-4 opacity-50" />
                        <p className="text-lg mb-2">No attachments</p>
                        <p>This contract has no attachments available</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {contract.attachments.map((attachment) => (
                          <div
                            key={attachment.id}
                            className="p-4 border border-border rounded-lg hover:bg-muted/50"
                          >
                            <div className="flex items-center gap-3">
                              <FileText className="w-5 h-5 text-muted-foreground" />
                              <div className="flex-1">
                                <h5 className="font-medium">
                                  {attachment.name}
                                </h5>
                                <p className="text-sm text-muted-foreground">
                                  {attachment.type}
                                </p>
                                {attachment.size && (
                                  <p className="text-xs text-muted-foreground">
                                    {(attachment.size / 1024).toFixed(1)} KB
                                  </p>
                                )}
                              </div>
                              <a
                                href={attachment.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-2 text-blue-500 hover:text-blue-600"
                              >
                                <ExternalLink className="w-4 h-4" />
                              </a>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {activeTab === "analysis" && (
                  <div className="space-y-4">
                    {contract.analysisStatus === AnalysisStatus.PENDING ? (
                      <div className="text-center py-12 text-muted-foreground">
                        <Activity className="w-16 h-16 mx-auto mb-4 opacity-50" />
                        <p className="text-lg mb-2">No analysis yet</p>
                        <p className="mb-4">
                          Click the analyze button to start AI analysis
                        </p>
                        <AnalyzeButton
                          contractId={contract.id}
                          analysisStatus={contract.analysisStatus}
                          onOpenAnalysisModal={onAnalyze}
                        />
                      </div>
                    ) : contract.analysisStatus ===
                      AnalysisStatus.IN_PROGRESS ? (
                      <div className="text-center py-12 text-muted-foreground">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
                        <p className="text-lg mb-2">Analysis in progress</p>
                        <p>
                          AI is analyzing this contract for wrapper
                          indicators...
                        </p>
                      </div>
                    ) : contract.analysisStatus === AnalysisStatus.COMPLETED &&
                      contract.aiAnalysis ? (
                      <div className="space-y-6">
                        {/* Analysis results would go here */}
                        <div className="text-center py-12 text-muted-foreground">
                          <Activity className="w-16 h-16 mx-auto mb-4 opacity-50" />
                          <p className="text-lg mb-2">Analysis Complete</p>
                          <p>
                            Analysis results will be displayed here once
                            implemented
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-12 text-muted-foreground">
                        <Activity className="w-16 h-16 mx-auto mb-4 opacity-50" />
                        <p className="text-lg mb-2">Analysis failed</p>
                        <p className="mb-4">
                          There was an error analyzing this contract
                        </p>
                        <AnalyzeButton
                          contractId={contract.id}
                          analysisStatus={
                            contract.analysisStatus || AnalysisStatus.PENDING
                          }
                          onOpenAnalysisModal={onAnalyze}
                        />
                      </div>
                    )}
                  </div>
                )}

                {activeTab === "lifecycle" && (
                  <div className="space-y-6">
                    {/* Priority and Actions */}
                    <div className="flex items-center justify-between">
                      <ContractPriorityComponent
                        contractId={contract.id}
                        priority={contract.priority || ContractPriority.MEDIUM}
                        onPriorityUpdate={(priority) =>
                          setContract((prev) =>
                            prev ? { ...prev, priority } : null
                          )
                        }
                      />
                      <ContractActions
                        contract={contract}
                        onContractUpdate={(updates) =>
                          setContract((prev) =>
                            prev ? { ...prev, ...updates } : null
                          )
                        }
                        showAll={true}
                      />
                    </div>

                    {/* Contract Flags */}
                    <ContractFlags
                      contractId={contract.id}
                      flags={contract.flags || []}
                      onFlagsUpdate={(flags) =>
                        setContract((prev) =>
                          prev ? { ...prev, flags } : null
                        )
                      }
                    />

                    {/* Internal Notes */}
                    <ContractNotes contractId={contract.id} />
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

export default ContractModal;
