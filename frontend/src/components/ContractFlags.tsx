import React, { useState } from "react";
import { X, Plus, Tag, AlertTriangle, CheckCircle, Clock } from "lucide-react";
import {
  ContractFlag,
  DisqualifyingFlag,
  StrategicFlag,
  PostAwardFlag,
} from "../types";
import { API_CONFIG } from "../config/api";

interface ContractFlagsProps {
  contractId: string;
  flags: ContractFlag[];
  onFlagsUpdate: (flags: ContractFlag[]) => void;
  editable?: boolean;
}

const ContractFlags: React.FC<ContractFlagsProps> = ({
  contractId,
  flags,
  onFlagsUpdate,
  editable = true,
}) => {
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [saving, setSaving] = useState(false);

  const flagConfig = {
    disqualifying: {
      color:
        "bg-red-100 text-red-800 border-red-200 dark:bg-red-900 dark:text-red-300 dark:border-red-700",
      icon: AlertTriangle,
      label: "Disqualifying",
      flags: [
        {
          value: DisqualifyingFlag.NOT_FIT_TECH_STACK,
          label: "Not Fit - Tech Stack",
        },
        {
          value: DisqualifyingFlag.NOT_FIT_COMPLIANCE,
          label: "Not Fit - Compliance",
        },
        {
          value: DisqualifyingFlag.NOT_FIT_TIMELINE,
          label: "Not Fit - Timeline",
        },
        {
          value: DisqualifyingFlag.NOT_FIT_TOO_COMPLEX,
          label: "Not Fit - Too Complex",
        },
        {
          value: DisqualifyingFlag.REQUIRES_PARTNER,
          label: "Requires Partner",
        },
        {
          value: DisqualifyingFlag.NO_BUDGET_CEILING,
          label: "No Budget Ceiling",
        },
      ],
    },
    strategic: {
      color:
        "bg-green-100 text-green-800 border-green-200 dark:bg-green-900 dark:text-green-300 dark:border-green-700",
      icon: CheckCircle,
      label: "Strategic",
      flags: [
        { value: StrategicFlag.STRONG_FIT, label: "Strong Fit" },
        { value: StrategicFlag.REPEAT_BUYER, label: "Repeat Buyer" },
        { value: StrategicFlag.GREAT_CASE_STUDY, label: "Great Case Study" },
        { value: StrategicFlag.AGENCY_BREAK_INTO, label: "Agency Break Into" },
        { value: StrategicFlag.NO_INCUMBENT, label: "No Incumbent" },
        { value: StrategicFlag.LOW_COMPETITION, label: "Low Competition" },
      ],
    },
    postAward: {
      color:
        "bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-900 dark:text-gray-300 dark:border-gray-700",
      icon: Clock,
      label: "Post-Award",
      flags: [
        { value: PostAwardFlag.BID_SUBMITTED, label: "Bid Submitted" },
        { value: PostAwardFlag.AWARDED, label: "Awarded" },
        { value: PostAwardFlag.LOST_COMPETITIVE, label: "Lost - Competitive" },
        {
          value: PostAwardFlag.LOST_DISQUALIFIED,
          label: "Lost - Disqualified",
        },
        { value: PostAwardFlag.FOLLOW_UP_LATER, label: "Follow Up Later" },
        { value: PostAwardFlag.FEEDBACK_RECEIVED, label: "Feedback Received" },
      ],
    },
  };

  const getFlagCategory = (flag: ContractFlag): keyof typeof flagConfig => {
    if (Object.values(DisqualifyingFlag).includes(flag as DisqualifyingFlag)) {
      return "disqualifying";
    }
    if (Object.values(StrategicFlag).includes(flag as StrategicFlag)) {
      return "strategic";
    }
    return "postAward";
  };

  const getFlagLabel = (flag: ContractFlag): string => {
    const category = getFlagCategory(flag);
    // @ts-ignore
    const flagInfo = flagConfig[category].flags.find(
      (f: any) => f.value === flag
    );
    return flagInfo?.label || flag;
  };

  const handleAddFlag = async (flag: ContractFlag) => {
    if (flags.includes(flag)) {
      setShowAddMenu(false);
      return;
    }

    const newFlags = [...flags, flag];
    setSaving(true);

    try {
      const response = await fetch(
        `${API_CONFIG.baseUrl}/api/contracts/${contractId}/flags`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ flags: newFlags }),
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to update flags: ${response.status}`);
      }

      onFlagsUpdate(newFlags);
    } catch (error) {
      console.error("Error updating flags:", error);
    } finally {
      setSaving(false);
      setShowAddMenu(false);
    }
  };

  const handleRemoveFlag = async (flagToRemove: ContractFlag) => {
    const newFlags = flags.filter((flag) => flag !== flagToRemove);
    setSaving(true);

    try {
      const response = await fetch(
        `${API_CONFIG.baseUrl}/api/contracts/${contractId}/flags`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ flags: newFlags }),
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to update flags: ${response.status}`);
      }

      onFlagsUpdate(newFlags);
    } catch (error) {
      console.error("Error updating flags:", error);
    } finally {
      setSaving(false);
    }
  };

  const renderFlagsByCategory = () => {
    const categorizedFlags = flags.reduce((acc, flag) => {
      const category = getFlagCategory(flag);
      if (!acc[category]) acc[category] = [];
      acc[category].push(flag);
      return acc;
    }, {} as Record<keyof typeof flagConfig, ContractFlag[]>);

    return Object.entries(flagConfig)
      .map(([category, config]) => {
        const categoryFlags =
          categorizedFlags[category as keyof typeof flagConfig] || [];
        if (categoryFlags.length === 0) return null;

        const Icon = config.icon;

        return (
          <div key={category} className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Icon className="w-4 h-4" />
              {config.label}
            </div>
            <div className="flex flex-wrap gap-2">
              {categoryFlags.map((flag) => (
                <div
                  key={flag}
                  className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs border ${config.color}`}
                >
                  <span>{getFlagLabel(flag)}</span>
                  {editable && (
                    <button
                      onClick={() => handleRemoveFlag(flag)}
                      disabled={saving}
                      className="p-0.5 hover:bg-black/10 rounded-full transition-colors"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })
      .filter(Boolean);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="font-semibold flex items-center gap-2">
          <Tag className="w-4 h-4" />
          Contract Flags
        </h4>
        {editable && (
          <div className="relative">
            <button
              onClick={() => setShowAddMenu(!showAddMenu)}
              disabled={saving}
              className="inline-flex items-center gap-1 px-3 py-1 text-sm bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
            >
              <Plus className="w-4 h-4" />
              Add Flag
            </button>

            {showAddMenu && (
              <div className="absolute right-0 top-full mt-2 w-64 bg-card border border-border rounded-lg shadow-lg z-10">
                <div className="p-2 max-h-96 overflow-y-auto">
                  {Object.entries(flagConfig).map(([category, config]) => {
                    const Icon = config.icon;
                    return (
                      <div key={category} className="mb-4">
                        <div className="flex items-center gap-2 px-2 py-1 text-sm font-medium text-muted-foreground">
                          <Icon className="w-4 h-4" />
                          {config.label}
                        </div>
                        <div className="space-y-1">
                          {config.flags.map((flagOption) => (
                            <button
                              key={flagOption.value}
                              onClick={() => handleAddFlag(flagOption.value)}
                              disabled={
                                flags.includes(flagOption.value) || saving
                              }
                              className={`w-full text-left px-2 py-1 text-sm rounded hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed ${
                                flags.includes(flagOption.value)
                                  ? "bg-muted"
                                  : ""
                              }`}
                            >
                              {flagOption.label}
                              {flags.includes(flagOption.value) && (
                                <span className="ml-2 text-xs text-muted-foreground">
                                  (already added)
                                </span>
                              )}
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {flags.length === 0 ? (
        <p className="text-muted-foreground text-sm">No flags set</p>
      ) : (
        <div className="space-y-4">{renderFlagsByCategory()}</div>
      )}
    </div>
  );
};

export default ContractFlags;
