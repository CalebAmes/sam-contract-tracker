import React, { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Calendar,
  Building,
  FileText,
  Hash,
  Tag,
  Eye,
  Clock,
  Activity,
  StopCircle,
  Archive,
  ArchiveRestore,
} from "lucide-react";
import { Contract, AnalysisStatus, ContractPriority } from "../types";
import StatusBadge from "../components/StatusBadge";
import AnalyzeButton from "../components/AnalyzeButton";
import ContractFlags from "../components/ContractFlags";
import ContractNotes from "../components/ContractNotes";
import ContractPriorityComponent from "../components/ContractPriority";
import ContractStatusSelector from "../components/ContractStatusSelector";
import AnalysisModal from "../components/AnalysisModal";
import AnalysisResults from "../components/AnalysisResults";
import AnalysisVersionSelector from "../components/AnalysisVersionSelector";
import AttachmentList from "../components/AttachmentList";
import LoadingOverlay from "../components/LoadingOverlay";
import { API_CONFIG } from "../config/api";
// @ts-ignore
import DOMPurify from "dompurify";

const ContractView: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [contract, setContract] = useState<Contract | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"details" | "analysis">("details");
  const [fetchingAttachments, setFetchingAttachments] = useState(false);
  const [showAnalysisModal, setShowAnalysisModal] = useState(false);
  const [selectedVersion, setSelectedVersion] = useState<number | undefined>(
    undefined
  );
  const [versionAnalysis, setVersionAnalysis] = useState<any>(null);
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);
  const [showUnarchiveConfirm, setShowUnarchiveConfirm] = useState(false);
  const [navigation, setNavigation] = useState<{
    previousId: string | null;
    nextId: string | null;
    currentIndex: number;
    totalContracts: number;
  } | null>(null);

  const fetchContract = useCallback(async () => {
    if (!id) return;

    try {
      setLoading(true);
      setError(null);

      const response = await fetch(API_CONFIG.endpoints.contract(id));

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
  }, [id]);

  const fetchNavigation = useCallback(async () => {
    if (!id) return;

    try {
      const response = await fetch(API_CONFIG.endpoints.contract(id) + '/navigation');
      
      if (response.ok) {
        const data = await response.json();
        setNavigation(data);
      } else {
        console.error('Failed to fetch navigation data');
      }
    } catch (err) {
      console.error('Error fetching navigation:', err);
    }
  }, [id]);

  useEffect(() => {
    if (id) {
      fetchContract();
      fetchNavigation();
    }
  }, [id, fetchContract, fetchNavigation]);

  useEffect(() => {
    // Check if we should open analysis modal from URL parameter
    if (searchParams.get("openAnalysis") === "true" && contract) {
      setShowAnalysisModal(true);
      // Clean up URL parameter
      const newSearchParams = new URLSearchParams(searchParams);
      newSearchParams.delete("openAnalysis");
      navigate(`/contracts/${id}`, { replace: true });
    }
  }, [searchParams, contract, id, navigate]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return; // Don't navigate when typing in form fields
      }

      if (e.key === 'ArrowLeft' && navigation?.previousId) {
        navigate(`/contracts/${navigation.previousId}`);
      } else if (e.key === 'ArrowRight' && navigation?.nextId) {
        navigate(`/contracts/${navigation.nextId}`);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [navigation, navigate]);

  const handleOpenAnalysisModal = () => {
    setShowAnalysisModal(true);
  };

  const handleCloseAnalysisModal = () => {
    setShowAnalysisModal(false);
  };

  const handleAnalysisComplete = async () => {
    // Refresh contract data after analysis
    await fetchContract();
    setShowAnalysisModal(false);
    // Reset version selection to show latest
    setSelectedVersion(undefined);
    setVersionAnalysis(null);
  };

  const handleVersionChange = async (version: number) => {
    if (!id) return;

    try {
      const response = await fetch(
        `${API_CONFIG.baseUrl}/api/contracts/${id}/analysis/${version}`
      );
      if (response.ok) {
        const data = await response.json();
        setVersionAnalysis(data.analysis);
        setSelectedVersion(version);
      }
    } catch (error) {
      console.error("Error fetching analysis version:", error);
    }
  };

  const handleArchive = async () => {
    if (!id) return;

    try {
      const response = await fetch(
        `${API_CONFIG.baseUrl}/api/contracts/${id}/archive`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to archive contract: ${response.status}`);
      }

      // Update contract state
      setContract((prev) =>
        prev
          ? {
              ...prev,
              isArchived: true,
              archivedAt: new Date().toISOString(),
            }
          : null
      );

      setShowArchiveConfirm(false);
    } catch (error) {
      console.error("Error archiving contract:", error);
    }
  };

  const handleUnarchive = async () => {
    if (!id) return;

    try {
      const response = await fetch(
        `${API_CONFIG.baseUrl}/api/contracts/${id}/unarchive`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to unarchive contract: ${response.status}`);
      }

      // Update contract state
      setContract((prev) =>
        prev
          ? {
              ...prev,
              isArchived: false,
              archivedAt: undefined,
            }
          : null
      );

      setShowUnarchiveConfirm(false);
    } catch (error) {
      console.error("Error unarchiving contract:", error);
    }
  };

  const handleFetchAttachments = async () => {
    if (!id) return;

    try {
      setFetchingAttachments(true);

      const response = await fetch(
        `${API_CONFIG.baseUrl}/api/contracts/${id}/fetch-attachments`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch attachments: ${response.status}`);
      }

      const data = await response.json();

      // Update the contract with the new attachments
      if (data.contract) {
        setContract(data.contract);
      }

      console.log(`Fetched ${data.attachments.length} attachments`);
    } catch (error) {
      console.error("Error fetching attachments:", error);
      // TODO: Show error message to user
    } finally {
      setFetchingAttachments(false);
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

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate("/contracts")}
            className="inline-flex items-center gap-2 px-3 py-1 text-sm border border-border rounded-lg hover:bg-muted"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Contracts
          </button>
        </div>
        <LoadingOverlay message="Loading contract details..." className="h-96" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate("/contracts")}
            className="inline-flex items-center gap-2 px-3 py-1 text-sm border border-border rounded-lg hover:bg-muted"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Contracts
          </button>
        </div>
        <div className="flex items-center justify-center h-96 text-red-600 dark:text-red-400">
          <div className="text-center">
            <FileText className="w-16 h-16 mx-auto mb-4 opacity-50" />
            <p className="text-lg mb-2">Error loading contract</p>
            <p className="text-sm">{error}</p>
            <button
              onClick={fetchContract}
              className="mt-4 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!contract) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate("/contracts")}
            className="inline-flex items-center gap-2 px-3 py-1 text-sm border border-border rounded-lg hover:bg-muted"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Contracts
          </button>
        </div>
        <div className="text-center py-12">
          <p className="text-lg text-muted-foreground">Contract not found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Back Button and Navigation */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/contracts")}
            className="inline-flex items-center gap-2 px-3 py-1 text-sm border border-border rounded-lg hover:bg-muted"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Contracts
          </button>
          
          {navigation && (
            <div className="flex items-center gap-2">
              <div className="h-6 w-px bg-border" />
              
              <button
                onClick={() => navigation.previousId && navigate(`/contracts/${navigation.previousId}`)}
                disabled={!navigation.previousId}
                className={`p-1.5 rounded-lg transition-colors ${
                  navigation.previousId
                    ? 'hover:bg-muted text-foreground'
                    : 'text-muted-foreground cursor-not-allowed opacity-50'
                }`}
                title={navigation.previousId ? 'Previous contract (←)' : 'No previous contract'}
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              
              <span className="text-sm text-muted-foreground px-2">
                {navigation.currentIndex} of {navigation.totalContracts}
              </span>
              
              <button
                onClick={() => navigation.nextId && navigate(`/contracts/${navigation.nextId}`)}
                disabled={!navigation.nextId}
                className={`p-1.5 rounded-lg transition-colors ${
                  navigation.nextId
                    ? 'hover:bg-muted text-foreground'
                    : 'text-muted-foreground cursor-not-allowed opacity-50'
                }`}
                title={navigation.nextId ? 'Next contract (→)' : 'No next contract'}
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          <StatusBadge status={contract.status} type="contract" />
          <StatusBadge
            status={contract.analysisStatus || AnalysisStatus.PENDING}
            type="analysis"
          />
        </div>
      </div>

      {/* Contract Title and Actions */}
      <div className="bg-card p-6 rounded-lg shadow-sm border border-border">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <h1 className="text-3xl font-bold mb-3">{contract.title}</h1>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              {contract.solicitationNumber && (
                <div className="flex items-center gap-1">
                  <Hash className="w-4 h-4" />
                  {contract.solicitationNumber}
                </div>
              )}
              {contract.viewCount !== undefined && contract.viewCount > 0 && (
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
              analysisStatus={contract.analysisStatus || AnalysisStatus.PENDING}
              onOpenAnalysisModal={handleOpenAnalysisModal}
            />
            <a
              href={contract.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 border border-border rounded-lg hover:bg-muted"
            >
              <ExternalLink className="w-4 h-4" />
              View on SAM.gov
            </a>
          </div>
        </div>
      </div>

      {/* Top Level Tabs */}
      <div className="bg-card rounded-lg shadow-sm border border-border">
        <div className="flex border-b border-border">
          <button
            onClick={() => setActiveTab("details")}
            className={`px-6 py-3 font-medium transition-colors ${
              activeTab === "details"
                ? "border-b-2 border-blue-500 text-blue-600 dark:text-blue-400"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Contract Details
          </button>
          <button
            onClick={() => setActiveTab("analysis")}
            className={`px-6 py-3 font-medium transition-colors flex items-center gap-2 ${
              activeTab === "analysis"
                ? "border-b-2 border-blue-500 text-blue-600 dark:text-blue-400"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            AI Analysis
            {contract.analysisStatus === AnalysisStatus.COMPLETED &&
              (versionAnalysis || contract.aiAnalysis) && (
                <span
                  className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                    (versionAnalysis || contract.aiAnalysis).wrapperScore >= 70
                      ? "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300"
                      : (versionAnalysis || contract.aiAnalysis).wrapperScore >=
                        40
                      ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300"
                      : "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                  }`}
                >
                  {(versionAnalysis || contract.aiAnalysis).wrapperScore}%
                </span>
              )}
          </button>
        </div>

        <div className="p-6">
          {activeTab === "details" ? (
            <div className="space-y-6">
              {/* Main Content Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left Column - Lifecycle Management (Priority) */}
                <div className="lg:col-span-2 space-y-6">
                  {/* Contract Management - Status and Priority */}
                  <div className="bg-card p-6 rounded-lg shadow-sm border border-border">
                    <h2 className="text-xl font-semibold mb-4">
                      Contract Management
                    </h2>
                    <div className="space-y-4">
                      <ContractStatusSelector
                        contractId={contract.id}
                        status={contract.status}
                        onStatusUpdate={(status) =>
                          setContract((prev) =>
                            prev ? { ...prev, status } : null
                          )
                        }
                      />
                      <ContractPriorityComponent
                        contractId={contract.id}
                        priority={contract.priority || ContractPriority.MEDIUM}
                        onPriorityUpdate={(priority: ContractPriority) =>
                          setContract((prev) =>
                            prev ? { ...prev, priority } : null
                          )
                        }
                      />

                      {/* Archive/Unarchive */}
                      <div className="pt-4 border-t border-border">
                        <label className="block text-sm font-medium mb-2">
                          Archive Status
                        </label>
                        {contract.isArchived ? (
                          <div className="space-y-2">
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Archive className="w-4 h-4" />
                              <span>
                                Archived{" "}
                                {contract.archivedAt
                                  ? `on ${new Date(
                                      contract.archivedAt
                                    ).toLocaleDateString()}`
                                  : ""}
                              </span>
                            </div>
                            <button
                              onClick={() => setShowUnarchiveConfirm(true)}
                              className="inline-flex items-center gap-2 px-3 py-1.5 text-sm bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
                            >
                              <ArchiveRestore className="w-4 h-4" />
                              Unarchive Contract
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setShowArchiveConfirm(true)}
                            className="inline-flex items-center gap-2 px-3 py-1.5 text-sm bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
                          >
                            <Archive className="w-4 h-4" />
                            Archive Contract
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Contract Flags */}
                  <div className="bg-card p-6 rounded-lg shadow-sm border border-border">
                    <ContractFlags
                      contractId={contract.id}
                      flags={contract.flags || []}
                      onFlagsUpdate={(flags) =>
                        setContract((prev) =>
                          prev ? { ...prev, flags } : null
                        )
                      }
                    />
                  </div>

                  {/* Internal Notes */}
                  <div className="bg-card p-6 rounded-lg shadow-sm border border-border">
                    <ContractNotes contractId={contract.id} />
                  </div>

                  {/* Description */}
                  <div className="bg-card p-6 rounded-lg shadow-sm border border-border">
                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                      <FileText className="w-4 h-4" />
                      Description
                    </h3>
                    <div className="bg-muted p-4 rounded-lg max-h-96 overflow-y-auto">
                      {contract.description ? (
                        <div
                          className="text-muted-foreground text-sm prose prose-sm dark:prose-invert max-w-none"
                          dangerouslySetInnerHTML={{
                            __html: DOMPurify.sanitize(contract.description, {
                              ALLOWED_TAGS: [
                                "p",
                                "br",
                                "strong",
                                "em",
                                "u",
                                "a",
                                "ul",
                                "ol",
                                "li",
                                "h1",
                                "h2",
                                "h3",
                                "h4",
                                "h5",
                                "h6",
                                "blockquote",
                                "pre",
                                "code",
                              ],
                              ALLOWED_ATTR: ["href", "target", "rel"],
                            }),
                          }}
                        />
                      ) : (
                        <p className="text-muted-foreground text-sm">
                          No description available
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right Column - Contract Details */}
                <div className="space-y-6">
                  {/* Key Information */}
                  <div className="bg-card p-6 rounded-lg shadow-sm border border-border">
                    <h3 className="text-lg font-semibold mb-4">
                      Contract Details
                    </h3>
                    <div className="space-y-4">
                      <div>
                        <h4 className="font-medium mb-2 flex items-center gap-2">
                          <Building className="w-4 h-4" />
                          Organization
                        </h4>
                        <p className="text-muted-foreground text-sm">
                          {contract.organizationId || "Unknown"}
                        </p>
                      </div>

                      <div>
                        <h4 className="font-medium mb-2 flex items-center gap-2">
                          <Calendar className="w-4 h-4" />
                          Posted Date
                        </h4>
                        <p className="text-muted-foreground text-sm">
                          {formatDate(contract.postedDate)}
                        </p>
                      </div>

                      <div>
                        <h4 className="font-medium mb-2 flex items-center gap-2">
                          <Calendar className="w-4 h-4" />
                          Deadline
                        </h4>
                        <div className="space-y-1">
                          <p className="text-muted-foreground text-sm">
                            {formatDate(contract.deadline)}
                          </p>
                          <div className="text-sm">
                            {formatDeadline(contract.deadline)}
                          </div>
                        </div>
                      </div>

                      {contract.classificationCode && (
                        <div>
                          <h4 className="font-medium mb-2 flex items-center gap-2">
                            <Tag className="w-4 h-4" />
                            Classification
                          </h4>
                          <p className="text-muted-foreground text-sm">
                            {contract.classificationCode}
                          </p>
                        </div>
                      )}

                      {contract.setAside && (
                        <div>
                          <h4 className="font-medium mb-2">Set Aside</h4>
                          <p className="text-muted-foreground text-sm">
                            {contract.setAside}
                          </p>
                        </div>
                      )}

                      {contract.naicsCodes && contract.naicsCodes.length > 0 && (
                        <div>
                          <h4 className="font-medium mb-2">NAICS Codes</h4>
                          <div className="flex flex-wrap gap-1">
                            {contract.naicsCodes.map((code, index) => (
                              <span
                                key={index}
                                className="px-2 py-1 bg-muted text-muted-foreground rounded text-xs"
                              >
                                {code}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {contract.fetchMethod && (
                        <div>
                          <h4 className="font-medium mb-2 flex items-center gap-2">
                            <Activity className="w-4 h-4" />
                            Fetch Method
                          </h4>
                          <p className="text-muted-foreground text-sm capitalize">
                            {contract.fetchMethod}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Attachments Section */}
              <AttachmentList
                attachments={contract.attachments}
                onFetchAttachments={handleFetchAttachments}
                fetchingAttachments={fetchingAttachments}
              />
            </div>
          ) : (
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
                    onOpenAnalysisModal={handleOpenAnalysisModal}
                  />
                </div>
              ) : contract.analysisStatus === AnalysisStatus.IN_PROGRESS ? (
                <div className="text-center py-12 text-muted-foreground">
                  <LoadingOverlay 
                    message="AI is analyzing this contract for wrapper indicators..." 
                    className="mb-4"
                  />
                  <button
                    onClick={async () => {
                      try {
                        await fetch(
                          `${API_CONFIG.baseUrl}/api/contracts/${contract.id}/analysis-status`,
                          {
                            method: "PUT",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                              analysisStatus: AnalysisStatus.FAILED,
                            }),
                          }
                        );
                        setContract((prev) =>
                          prev
                            ? { ...prev, analysisStatus: AnalysisStatus.FAILED }
                            : null
                        );
                      } catch (error) {
                        console.error("Failed to stop analysis:", error);
                      }
                    }}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
                  >
                    <StopCircle className="w-4 h-4" />
                    Stop Analysis
                  </button>
                </div>
              ) : contract.analysisStatus === AnalysisStatus.COMPLETED &&
                (versionAnalysis || contract.aiAnalysis) ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold">Analysis Results</h3>
                    <AnalysisVersionSelector
                      contractId={contract.id}
                      currentVersion={selectedVersion}
                      onVersionChange={handleVersionChange}
                    />
                  </div>
                  <AnalysisResults
                    analysis={versionAnalysis || contract.aiAnalysis}
                    contractId={contract.id}
                  />
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
                    onOpenAnalysisModal={handleOpenAnalysisModal}
                  />
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Timestamps */}
      <div className="bg-card p-4 rounded-lg shadow-sm border border-border">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-muted-foreground">
          <div>
            <strong>Created:</strong> {formatDate(contract.createdAt)}
          </div>
          <div>
            <strong>Updated:</strong> {formatDate(contract.updatedAt)}
          </div>
          {contract.lastViewedAt && (
            <div>
              <strong>Last Viewed:</strong> {formatDate(contract.lastViewedAt)}
            </div>
          )}
        </div>
      </div>

      {/* Analysis Modal */}
      {contract && (
        <AnalysisModal
          contract={contract}
          isOpen={showAnalysisModal}
          onClose={handleCloseAnalysisModal}
          onAnalysisComplete={handleAnalysisComplete}
        />
      )}

      {/* Archive Confirmation Modal */}
      {showArchiveConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-card rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Archive Contract</h3>
            <p className="text-muted-foreground mb-6">
              Are you sure you want to archive this contract? This will hide it
              from the main contract list but preserve all data and notes.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowArchiveConfirm(false)}
                className="px-4 py-2 text-sm border border-border rounded-lg hover:bg-muted"
              >
                Cancel
              </button>
              <button
                onClick={handleArchive}
                className="px-4 py-2 text-sm bg-gray-500 text-white rounded-lg hover:bg-gray-600"
              >
                Archive
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Unarchive Confirmation Modal */}
      {showUnarchiveConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-card rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Unarchive Contract</h3>
            <p className="text-muted-foreground mb-6">
              Are you sure you want to unarchive this contract? This will
              restore it to the main contract list.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowUnarchiveConfirm(false)}
                className="px-4 py-2 text-sm border border-border rounded-lg hover:bg-muted"
              >
                Cancel
              </button>
              <button
                onClick={handleUnarchive}
                className="px-4 py-2 text-sm bg-green-500 text-white rounded-lg hover:bg-green-600"
              >
                Unarchive
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ContractView;
