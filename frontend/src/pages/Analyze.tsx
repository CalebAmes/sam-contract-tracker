import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Brain,
  AlertCircle,
  CheckCircle,
  ExternalLink,
  Calendar,
  Building,
  FileText,
  Target,
} from "lucide-react";
import { API_CONFIG } from "../config/api";

interface ContractAnalysis {
  contract: {
    id: string;
    title: string;
    url: string;
    description: string;
    organization: string;
    postedDate: string;
    deadline: string;
    attachments: Array<{
      id: string;
      name: string;
      url: string;
      type: string;
    }>;
  };
  analysis: {
    wrapperScore: number;
    indicators: Array<{
      type: string;
      found: boolean;
      evidence: string[];
      confidence: number;
    }>;
    summary: string;
    recommendation: "pursue" | "investigate" | "avoid";
    analyzedAt: string;
  };
}

export default function Analyze() {
  const navigate = useNavigate();
  const [contractUrl, setContractUrl] = useState("");
  const [isValidUrl, setIsValidUrl] = useState<boolean | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<ContractAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fetchMethod, setFetchMethod] = useState<"api" | "client">("client");

  const validateSamUrl = (url: string) => {
    if (!url) {
      setIsValidUrl(null);
      return;
    }

    try {
      const urlObj = new URL(url);
      const isValid =
        (urlObj.hostname === "sam.gov" || urlObj.hostname === "www.sam.gov") &&
        url.includes("/opp/");
      setIsValidUrl(isValid);
    } catch {
      setIsValidUrl(false);
    }
  };

  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const url = e.target.value;
    setContractUrl(url);
    validateSamUrl(url);
    setError(null);
    setAnalysis(null);
  };

  const handleAnalyze = async () => {
    if (!isValidUrl || !contractUrl) return;

    setIsAnalyzing(true);
    setError(null);

    // Extract opportunity ID from URL
    const oppIdMatch = contractUrl.match(/\/opp\/([^/?]+)/);
    if (!oppIdMatch) {
      setError("Could not extract opportunity ID from URL");
      setIsAnalyzing(false);
      return;
    }

    const opportunityId = oppIdMatch[1];
    console.log("Frontend: Extracted opportunity ID:", opportunityId);

    try {
      let endpoint: string;
      let methodName: string;

      if (fetchMethod === "client") {
        endpoint = API_CONFIG.endpoints.fetchContractClient;
        methodName = "Client API";
      } else {
        endpoint = `${API_CONFIG.baseUrl}/api/fetch-contract`;
        methodName = "Official API";
      }

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          opportunityId: opportunityId,
        }),
      });

      console.log(`Frontend: ${methodName} response status:`, response.status);

      if (!response.ok) {
        setError(`${methodName} error: ${response.status}`);
      } else {
        const data = await response.json();
        if (fetchMethod === "client" && data.contract) {
          // Handle client API response with parsed contract data
          console.log("Client API contract data:", data.contract);
          console.log("Metadata:", data.metadata);
          console.log("Attachments:", data.attachments);

          // Transform the contract data to match the expected analysis format
          const analysisData: ContractAnalysis = {
            contract: {
              id: data.contract.id,
              title: data.contract.title,
              url: data.contract.url,
              description: data.contract.description,
              organization:
                data.metadata?.organizationId || "Unknown Organization",
              postedDate: data.contract.postedDate,
              deadline: data.contract.deadline,
              attachments: data.attachments || [],
            },
            analysis: {
              wrapperScore: data.contract.aiScore || 0,
              indicators: [],
              summary:
                "Analysis pending - contract fetched successfully from client API",
              recommendation: "investigate" as const,
              analyzedAt: new Date().toISOString(),
            },
          };

          setAnalysis(analysisData);
          setError(null);

          // Show success message briefly then redirect to contract view
          setTimeout(() => {
            navigate(`/contracts/${opportunityId}`);
          }, 2000);
        } else {
          setError(
            `Contract fetched successfully (${methodName}) - Redirecting to contract view...`
          );

          // Redirect to contract view after success
          setTimeout(() => {
            navigate(`/contracts/${opportunityId}`);
          }, 2000);
        }
      }
    } catch (err) {
      console.error("Frontend: Request failed:", err);
      setError("Failed to connect to API");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 70) return "text-red-600 dark:text-red-400";
    if (score >= 40) return "text-yellow-600 dark:text-yellow-400";
    return "text-green-600 dark:text-green-400";
  };

  const getScoreBgColor = (score: number) => {
    if (score >= 70) return "bg-red-500";
    if (score >= 40) return "bg-yellow-500";
    return "bg-green-500";
  };

  const getRecommendationColor = (recommendation: string) => {
    switch (recommendation) {
      case "pursue":
        return "text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/20";
      case "investigate":
        return "text-yellow-600 dark:text-yellow-400 bg-yellow-100 dark:bg-yellow-900/20";
      case "avoid":
        return "text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/20";
      default:
        return "text-muted-foreground bg-muted";
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold font-heading mb-2">
          Analyze Contract
        </h2>
        <p className="text-muted-foreground">
          Analyze a single SAM.gov contract for wrapper indicators and
          opportunity assessment
        </p>
      </div>

      {/* URL Input */}
      <div className="bg-card p-6 rounded-lg shadow-sm border border-border">
        <h3 className="text-lg font-semibold font-heading mb-4">
          Contract URL
        </h3>
        <div className="space-y-4">
          <div>
            <label
              htmlFor="contract-url"
              className="block text-sm font-medium mb-2"
            >
              SAM.gov Contract URL
            </label>
            <div className="relative">
              <input
                type="url"
                id="contract-url"
                value={contractUrl}
                onChange={handleUrlChange}
                placeholder="https://sam.gov/opp/[opportunity-id]/view"
                className={`w-full px-3 py-2 pr-10 border rounded-lg bg-input text-foreground focus:ring-2 focus:ring-blue-500 transition-colors ${
                  isValidUrl === false
                    ? "border-red-500 focus:border-red-500"
                    : isValidUrl === true
                    ? "border-green-500 focus:border-green-500"
                    : "border-border focus:border-blue-500"
                }`}
              />
              <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                {isValidUrl === true && (
                  <CheckCircle className="w-5 h-5 text-green-500" />
                )}
                {isValidUrl === false && (
                  <AlertCircle className="w-5 h-5 text-red-500" />
                )}
              </div>
            </div>
            {isValidUrl === false && (
              <p className="text-sm text-red-600 mt-1">
                Please enter a valid SAM.gov contract URL (must include /opp/)
              </p>
            )}
            {isValidUrl === true && (
              <p className="text-sm text-green-600 mt-1">
                Valid SAM.gov contract URL detected
              </p>
            )}
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-3">
                API Method
              </label>
              <div className="flex items-center gap-3">
                <span className="text-sm">Client API</span>
                <div className="relative">
                  <input
                    type="checkbox"
                    checked={fetchMethod === "api"}
                    onChange={(e) =>
                      setFetchMethod(e.target.checked ? "api" : "client")
                    }
                    className="sr-only"
                  />
                  <div
                    className={`w-11 h-6 rounded-full cursor-pointer transition-colors ${
                      fetchMethod === "api"
                        ? "bg-blue-500"
                        : "bg-gray-300 dark:bg-gray-600"
                    }`}
                    onClick={() =>
                      setFetchMethod(fetchMethod === "api" ? "client" : "api")
                    }
                  >
                    <div
                      className={`w-5 h-5 bg-white rounded-full shadow-md transform transition-transform ${
                        fetchMethod === "api"
                          ? "translate-x-5"
                          : "translate-x-0.5"
                      } mt-0.5`}
                    />
                  </div>
                </div>
                <span className="text-sm">Public API</span>
              </div>
            </div>

            {fetchMethod === "client" && (
              <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  <strong>Client API Mode:</strong> Uses the same API that
                  SAM.gov's website uses internally. Requires session tokens but
                  may be more reliable than the public API.
                </p>
              </div>
            )}

            {fetchMethod === "api" && (
              <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                <p className="text-sm text-green-800 dark:text-green-200">
                  <strong>Public API Mode:</strong> Uses the documented SAM.gov
                  API with API keys. Subject to rate limits but provides
                  structured data.
                </p>
              </div>
            )}

            <button
              onClick={handleAnalyze}
              disabled={!isValidUrl || isAnalyzing}
              className="bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-medium py-3 px-6 rounded-lg transition-colors flex items-center gap-2"
            >
              <Brain className="w-4 h-4" />
              {isAnalyzing
                ? "Analyzing Contract..."
                : `Analyze Contract (${
                    fetchMethod === "api" ? "Public API" : "Client API"
                  })`}
            </button>
          </div>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4 rounded-lg">
          <div className="flex items-center gap-2 text-red-700 dark:text-red-400">
            <AlertCircle className="w-5 h-5" />
            <span className="font-medium">Error</span>
          </div>
          <p className="text-red-600 dark:text-red-300 mt-1">{error}</p>
        </div>
      )}

      {/* Analysis Results */}
      {analysis && (
        <div className="space-y-6">
          {/* Contract Information */}
          <div className="bg-card p-6 rounded-lg shadow-sm border border-border">
            <h3 className="text-lg font-semibold font-heading mb-4">
              Contract Information
            </h3>
            <div className="space-y-4">
              <div>
                <div className="flex items-start gap-2">
                  <h4 className="font-medium text-lg leading-tight">
                    {analysis.contract.title}
                  </h4>
                  <a
                    href={analysis.contract.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-500 hover:text-blue-600 flex-shrink-0"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Building className="w-4 h-4" />
                  <span>{analysis.contract.organization}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Calendar className="w-4 h-4" />
                  <span>
                    Posted:{" "}
                    {new Date(
                      analysis.contract.postedDate
                    ).toLocaleDateString()}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Calendar className="w-4 h-4" />
                  <span>
                    Deadline:{" "}
                    {new Date(analysis.contract.deadline).toLocaleDateString()}
                  </span>
                </div>
              </div>

              <div>
                <h5 className="font-medium mb-2">Description</h5>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {analysis.contract.description}
                </p>
              </div>

              {analysis.contract.attachments.length > 0 && (
                <div>
                  <h5 className="font-medium mb-2">Attachments</h5>
                  <div className="space-y-2">
                    {analysis.contract.attachments.map((attachment) => (
                      <div
                        key={attachment.id}
                        className="flex items-center gap-2 text-sm"
                      >
                        <FileText className="w-4 h-4 text-muted-foreground" />
                        <a
                          href={attachment.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-500 hover:text-blue-600"
                        >
                          {attachment.name}
                        </a>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Analysis Results */}
          <div className="bg-card p-6 rounded-lg shadow-sm border border-border">
            <h3 className="text-lg font-semibold font-heading mb-4">
              Wrapper Analysis
            </h3>

            {/* Wrapper Score */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium">Wrapper Score</span>
                <span
                  className={`text-2xl font-bold ${getScoreColor(
                    analysis.analysis.wrapperScore
                  )}`}
                >
                  {analysis.analysis.wrapperScore}%
                </span>
              </div>
              <div className="w-full bg-muted rounded-full h-3">
                <div
                  className={`h-3 rounded-full transition-all duration-300 ${getScoreBgColor(
                    analysis.analysis.wrapperScore
                  )}`}
                  style={{ width: `${analysis.analysis.wrapperScore}%` }}
                ></div>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Higher scores indicate higher likelihood of being a wrapper
                contract
              </p>
            </div>

            {/* Recommendation */}
            <div className="mb-6">
              <div className="flex items-center gap-2">
                <Target className="w-5 h-5" />
                <span className="font-medium">Recommendation:</span>
                <span
                  className={`px-2 py-1 rounded-full text-sm font-medium ${getRecommendationColor(
                    analysis.analysis.recommendation
                  )}`}
                >
                  {analysis.analysis.recommendation.toUpperCase()}
                </span>
              </div>
            </div>

            {/* Summary */}
            <div className="mb-6">
              <h4 className="font-medium mb-2">Analysis Summary</h4>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {analysis.analysis.summary}
              </p>
            </div>

            {/* Indicators */}
            <div>
              <h4 className="font-medium mb-3">Detected Indicators</h4>
              <div className="space-y-3">
                {analysis.analysis.indicators.map((indicator, index) => (
                  <div
                    key={index}
                    className={`p-3 rounded-lg border ${
                      indicator.found
                        ? "bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800"
                        : "bg-muted border-border"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-sm">
                        {indicator.type
                          .replace(/_/g, " ")
                          .replace(/\b\w/g, (l) => l.toUpperCase())}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">
                          {Math.round(indicator.confidence * 100)}% confidence
                        </span>
                        {indicator.found ? (
                          <CheckCircle className="w-4 h-4 text-green-500" />
                        ) : (
                          <div className="w-4 h-4 rounded-full border-2 border-muted-foreground/30"></div>
                        )}
                      </div>
                    </div>
                    {indicator.found && indicator.evidence.length > 0 && (
                      <div className="text-xs text-muted-foreground">
                        Evidence: {indicator.evidence.join(", ")}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-4 text-xs text-muted-foreground">
              Analysis completed on{" "}
              {new Date(analysis.analysis.analyzedAt).toLocaleString()}
            </div>
          </div>
        </div>
      )}

      {/* Placeholder when no analysis */}
      {!analysis && !isAnalyzing && !error && (
        <div className="bg-card p-6 rounded-lg shadow-sm border border-border">
          <div className="text-center py-12 text-muted-foreground">
            <Brain className="w-16 h-16 mx-auto mb-4 opacity-50" />
            <p className="text-lg mb-2">Ready to analyze</p>
            <p>Enter a SAM.gov contract URL above to get started</p>
          </div>
        </div>
      )}
    </div>
  );
}
