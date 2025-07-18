import React from 'react';
import { 
  AlertTriangle, 
  CheckCircle, 
  Info, 
  Calendar, 
  DollarSign, 
  Users, 
  Building,
  Flag,
  TrendingUp,
  AlertCircle
} from 'lucide-react';
import { AIAnalysis } from '../types';

interface AnalysisResultsProps {
  analysis: AIAnalysis;
}

const AnalysisResults: React.FC<AnalysisResultsProps> = ({ analysis }) => {
  const getWrapperScoreColor = (score: number) => {
    if (score >= 70) return 'text-red-600 dark:text-red-400';
    if (score >= 40) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-green-600 dark:text-green-400';
  };

  const getWrapperScoreBackground = (score: number) => {
    if (score >= 70) return 'bg-red-100 dark:bg-red-900/20';
    if (score >= 40) return 'bg-yellow-100 dark:bg-yellow-900/20';
    return 'bg-green-100 dark:bg-green-900/20';
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'high':
        return <AlertTriangle className="w-4 h-4 text-red-500" />;
      case 'medium':
        return <AlertCircle className="w-4 h-4 text-yellow-500" />;
      default:
        return <Info className="w-4 h-4 text-blue-500" />;
    }
  };

  const getUrgencyColor = (urgency: string) => {
    switch (urgency) {
      case 'critical':
        return 'text-red-600 dark:text-red-400';
      case 'high':
        return 'text-orange-600 dark:text-orange-400';
      case 'medium':
        return 'text-yellow-600 dark:text-yellow-400';
      default:
        return 'text-green-600 dark:text-green-400';
    }
  };

  return (
    <div className="space-y-6">
      {/* Wrapper Score */}
      <div className={`p-6 rounded-lg ${getWrapperScoreBackground(analysis.wrapperScore)}`}>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold mb-1">Wrapper Contract Likelihood</h3>
            <p className="text-sm text-muted-foreground">
              Based on AI analysis of contract documents
            </p>
          </div>
          <div className={`text-5xl font-bold ${getWrapperScoreColor(analysis.wrapperScore)}`}>
            {analysis.wrapperScore}%
          </div>
        </div>
      </div>

      {/* Summary */}
      <div className="bg-card p-6 rounded-lg border border-border">
        <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <Info className="w-5 h-5" />
          Analysis Summary
        </h3>
        <p className="text-muted-foreground whitespace-pre-wrap">{analysis.summary}</p>
        <div className="mt-3 inline-flex items-center gap-2 px-3 py-1 bg-muted rounded-full text-sm">
          <span className="font-medium">Contract Type:</span>
          <span>{analysis.contractType}</span>
        </div>
      </div>

      {/* Red Flags */}
      {analysis.redFlags.length > 0 && (
        <div className="bg-card p-6 rounded-lg border border-border">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Flag className="w-5 h-5 text-red-500" />
            Red Flags Identified
          </h3>
          <div className="space-y-3">
            {analysis.redFlags.map((flag, index) => (
              <div key={index} className="flex gap-3 p-3 bg-muted rounded-lg">
                {getSeverityIcon(flag.severity)}
                <div className="flex-1">
                  <p className="font-medium">{flag.flag}</p>
                  <p className="text-sm text-muted-foreground mt-1">{flag.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Incumbent Information */}
      {analysis.incumbentInfo.vendor && (
        <div className="bg-card p-6 rounded-lg border border-border">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Building className="w-5 h-5" />
            Incumbent Information
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Current Vendor</p>
              <p className="mt-1">{analysis.incumbentInfo.vendor}</p>
            </div>
            {analysis.incumbentInfo.contractNumber && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">Contract Number</p>
                <p className="mt-1">{analysis.incumbentInfo.contractNumber}</p>
              </div>
            )}
            {analysis.incumbentInfo.expirationDate && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">Expiration Date</p>
                <p className="mt-1">{new Date(analysis.incumbentInfo.expirationDate).toLocaleDateString()}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Recommended Action */}
      <div className="bg-blue-50 dark:bg-blue-900/20 p-6 rounded-lg border border-blue-200 dark:border-blue-800">
        <h3 className="text-lg font-semibold mb-3 flex items-center gap-2 text-blue-800 dark:text-blue-300">
          <TrendingUp className="w-5 h-5" />
          Recommended Action
        </h3>
        <p className="text-blue-700 dark:text-blue-200">{analysis.recommendedAction}</p>
      </div>

      {/* Key Information Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Key Dates */}
        <div className="bg-card p-6 rounded-lg border border-border">
          <h4 className="font-semibold mb-4 flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Key Dates
          </h4>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Current Deadline</span>
              <span className="font-medium">
                {new Date(analysis.keyDates.currentDeadline).toLocaleDateString()}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Contract Start</span>
              <span className="font-medium">
                {new Date(analysis.keyDates.contractStart).toLocaleDateString()}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Urgency Level</span>
              <span className={`font-medium capitalize ${getUrgencyColor(analysis.keyDates.urgencyLevel)}`}>
                {analysis.keyDates.urgencyLevel}
              </span>
            </div>
          </div>
        </div>

        {/* Value & Competition */}
        <div className="bg-card p-6 rounded-lg border border-border">
          <h4 className="font-semibold mb-4 flex items-center gap-2">
            <DollarSign className="w-5 h-5" />
            Value & Competition
          </h4>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Estimated Value</span>
              <span className="font-medium">{analysis.estimatedValue}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Competition Level</span>
              <span className="font-medium capitalize">{analysis.competitionLevel}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {analysis.competitionNotes}
            </p>
          </div>
        </div>
      </div>

      {/* Analysis Timestamp */}
      <div className="text-center text-sm text-muted-foreground">
        Analysis completed on {new Date(analysis.analyzedAt).toLocaleString()}
      </div>
    </div>
  );
};

export default AnalysisResults;