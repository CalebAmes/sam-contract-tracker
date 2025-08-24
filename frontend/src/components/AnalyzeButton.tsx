import React from "react";
import { Brain, Loader2 } from "lucide-react";
import { AnalysisStatus } from "../types";
import { Button } from "./ui/button";

interface AnalyzeButtonProps {
  contractId: string;
  analysisStatus: AnalysisStatus;
  onOpenAnalysisModal?: (contractId: string) => void;
  size?: "sm" | "md" | "lg";
  disabled?: boolean;
}

const AnalyzeButton: React.FC<AnalyzeButtonProps> = ({
  contractId,
  analysisStatus,
  onOpenAnalysisModal,
  size = "md",
  disabled = false,
}) => {
  const handleAnalyze = () => {
    if (disabled || analysisStatus === AnalysisStatus.IN_PROGRESS) return;
    if (onOpenAnalysisModal) onOpenAnalysisModal(contractId);
  };

  const content = () => {
    if (analysisStatus === AnalysisStatus.IN_PROGRESS) {
      return (
        <>
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>Analyzing...</span>
        </>
      );
    }
    if (analysisStatus === AnalysisStatus.COMPLETED) {
      return (
        <>
          <Brain className="w-4 h-4" />
          <span>Re-analyze</span>
        </>
      );
    }
    return (
      <>
        <Brain className="w-4 h-4" />
        <span>Analyze</span>
      </>
    );
  };

  const sizeMap = {
    sm: "sm",
    md: "default",
    lg: "lg",
  } as const;

  return (
    <Button
      onClick={handleAnalyze}
      disabled={disabled || analysisStatus === AnalysisStatus.IN_PROGRESS}
      variant="ai"
      size={sizeMap[size]}
      className={`disabled:opacity-50 disabled:cursor-not-allowed ${
        size === "md" ? "px-4 py-2" : ""
      }`}
    >
      {content()}
    </Button>
  );
};

export default AnalyzeButton;
