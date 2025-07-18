import React, { useState } from "react";
import { Flag, ChevronDown, Check } from "lucide-react";
import { ContractPriority as Priority } from "../types";

interface ContractPriorityProps {
  contractId: string;
  priority: Priority;
  onPriorityUpdate: (priority: Priority) => void;
  editable?: boolean;
}

const ContractPriority: React.FC<ContractPriorityProps> = ({
  contractId,
  priority,
  onPriorityUpdate,
  editable = true,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [updating, setUpdating] = useState(false);

  const priorityConfig = {
    [Priority.LOW]: {
      label: "Low",
      color:
        "bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-900 dark:text-gray-300 dark:border-gray-700",
      buttonColor: "hover:bg-gray-50 dark:hover:bg-gray-800",
    },
    [Priority.MEDIUM]: {
      label: "Medium",
      color:
        "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900 dark:text-blue-300 dark:border-blue-700",
      buttonColor: "hover:bg-blue-50 dark:hover:bg-blue-800",
    },
    [Priority.HIGH]: {
      label: "High",
      color:
        "bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900 dark:text-yellow-300 dark:border-yellow-700",
      buttonColor: "hover:bg-yellow-50 dark:hover:bg-yellow-800",
    },
    [Priority.CRITICAL]: {
      label: "Critical",
      color:
        "bg-red-100 text-red-800 border-red-200 dark:bg-red-900 dark:text-red-300 dark:border-red-700",
      buttonColor: "hover:bg-red-50 dark:hover:bg-red-800",
    },
  };

  const handlePriorityChange = async (newPriority: Priority) => {
    if (newPriority === priority) {
      setIsOpen(false);
      return;
    }

    setUpdating(true);

    try {
      const response = await fetch(
        `http://spicymini:3001/api/contracts/${contractId}/priority`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ priority: newPriority }),
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to update priority: ${response.status}`);
      }

      onPriorityUpdate(newPriority);
    } catch (error) {
      console.error("Error updating priority:", error);
    } finally {
      setUpdating(false);
      setIsOpen(false);
    }
  };

  const currentConfig = priorityConfig[priority];

  if (!editable) {
    return (
      <div className="flex items-center gap-2">
        <Flag className="w-4 h-4 text-muted-foreground" />
        <span
          className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs border ${currentConfig.color}`}
        >
          {currentConfig.label}
        </span>
      </div>
    );
  }

  return (
    <div>
      <label className="block text-sm font-medium mb-2">Priority</label>
      <div className="flex items-center gap-2">
        <Flag className="w-4 h-4 text-muted-foreground" />
        <div className="relative">
          <button
            onClick={() => setIsOpen(!isOpen)}
            disabled={updating}
            className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs border transition-colors ${currentConfig.color} ${currentConfig.buttonColor} disabled:opacity-50`}
          >
            {updating ? (
              <>
                <div className="animate-spin rounded-full h-3 w-3 border-b border-current"></div>
                Updating...
              </>
            ) : (
              <>
                {currentConfig.label}
                <ChevronDown className="w-3 h-3" />
              </>
            )}
          </button>

          {isOpen && !updating && (
            <div className="absolute left-0 top-full mt-1 w-32 bg-card border border-border rounded-lg shadow-lg z-10">
              <div className="p-1">
                {Object.entries(priorityConfig).map(
                  ([priorityValue, config]) => (
                    <button
                      key={priorityValue}
                      onClick={() =>
                        handlePriorityChange(priorityValue as Priority)
                      }
                      className={`w-full flex items-center justify-between px-2 py-1 text-sm rounded hover:bg-muted transition-colors ${
                        priority === priorityValue ? "bg-muted" : ""
                      }`}
                    >
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs border ${config.color}`}
                      >
                        {config.label}
                      </span>
                      {priority === priorityValue && (
                        <Check className="w-3 h-3 text-green-500" />
                      )}
                    </button>
                  )
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ContractPriority;
