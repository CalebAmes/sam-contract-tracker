import React, { useState } from "react";
import {
  Archive,
  ArchiveRestore,
  MoreVertical,
  Edit,
  Trash2,
  ExternalLink,
  Eye,
  EyeOff,
} from "lucide-react";
import { Contract, ContractStatus } from "../types";

interface ContractActionsProps {
  contract: Contract;
  onContractUpdate: (updates: Partial<Contract>) => void;
  onContractDelete?: (contractId: string) => void;
  showAll?: boolean;
}

const ContractActions: React.FC<ContractActionsProps> = ({
  contract,
  onContractUpdate,
  onContractDelete,
  showAll = false,
}) => {
  const [showMenu, setShowMenu] = useState(false);
  const [loading, setLoading] = useState<string | null>(null);

  const handleArchive = async () => {
    setLoading("archive");

    try {
      const endpoint = contract.isArchived ? "unarchive" : "archive";
      const response = await fetch(
        `http://spicymini:3001/api/contracts/${contract.id}/${endpoint}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to ${endpoint} contract: ${response.status}`);
      }

      onContractUpdate({
        isArchived: !contract.isArchived,
        archivedAt: contract.isArchived ? undefined : new Date().toISOString(),
      });
    } catch (error) {
      console.error("Error archiving contract:", error);
    } finally {
      setLoading(null);
      setShowMenu(false);
    }
  };

  const handleStatusChange = async (newStatus: ContractStatus) => {
    setLoading("status");

    try {
      const response = await fetch(
        `http://spicymini:3001/api/contracts/${contract.id}/status`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ status: newStatus }),
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to update status: ${response.status}`);
      }

      onContractUpdate({ status: newStatus });
    } catch (error) {
      console.error("Error updating status:", error);
    } finally {
      setLoading(null);
      setShowMenu(false);
    }
  };

  const handleDelete = async () => {
    if (
      !window.confirm(
        "Are you sure you want to delete this contract? This action cannot be undone."
      )
    ) {
      return;
    }

    setLoading("delete");

    try {
      const response = await fetch(
        `http://spicymini:3001/api/contracts/${contract.id}`,
        {
          method: "DELETE",
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to delete contract: ${response.status}`);
      }

      if (onContractDelete) {
        onContractDelete(contract.id);
      }
    } catch (error) {
      console.error("Error deleting contract:", error);
    } finally {
      setLoading(null);
      setShowMenu(false);
    }
  };

  const statusOptions = [
    { value: ContractStatus.NEW, label: "New" },
    { value: ContractStatus.INVESTIGATING, label: "Investigating" },
    { value: ContractStatus.INTERESTED, label: "Interested" },
    { value: ContractStatus.DISMISSED, label: "Dismissed" },
    { value: ContractStatus.APPLIED, label: "Applied" },
  ];

  if (showAll) {
    return (
      <div className="relative">
        <button
          onClick={() => setShowMenu(!showMenu)}
          className="p-2 hover:bg-muted rounded-lg transition-colors"
          disabled={loading !== null}
        >
          <MoreVertical className="w-4 h-4" />
        </button>

        {showMenu && (
          <div className="absolute right-0 top-full mt-1 w-48 bg-card border border-border rounded-lg shadow-lg z-10">
            <div className="p-1">
              {/* Status changes */}
              <div className="px-2 py-1 text-xs font-medium text-muted-foreground">
                Change Status
              </div>
              {statusOptions.map((status) => (
                <button
                  key={status.value}
                  onClick={() => handleStatusChange(status.value)}
                  disabled={
                    loading !== null || contract.status === status.value
                  }
                  className={`w-full flex items-center gap-2 px-2 py-1 text-sm rounded hover:bg-muted transition-colors text-left disabled:opacity-50 ${
                    contract.status === status.value ? "bg-muted" : ""
                  }`}
                >
                  <div className="w-2 h-2 rounded-full bg-current"></div>
                  {status.label}
                  {contract.status === status.value && (
                    <span className="ml-auto text-xs text-muted-foreground">
                      (current)
                    </span>
                  )}
                </button>
              ))}

              <div className="border-t border-border my-1"></div>

              {/* Archive/Unarchive */}
              <button
                onClick={handleArchive}
                disabled={loading !== null}
                className="w-full flex items-center gap-2 px-2 py-1 text-sm rounded hover:bg-muted transition-colors text-left"
              >
                {loading === "archive" ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b border-current"></div>
                ) : contract.isArchived ? (
                  <ArchiveRestore className="w-4 h-4" />
                ) : (
                  <Archive className="w-4 h-4" />
                )}
                {contract.isArchived ? "Unarchive" : "Archive"}
              </button>

              {/* External link */}
              <a
                href={contract.url}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full flex items-center gap-2 px-2 py-1 text-sm rounded hover:bg-muted transition-colors text-left"
              >
                <ExternalLink className="w-4 h-4" />
                View on SAM.gov
              </a>

              {/* Delete */}
              {onContractDelete && (
                <>
                  <div className="border-t border-border my-1"></div>
                  <button
                    onClick={handleDelete}
                    disabled={loading !== null}
                    className="w-full flex items-center gap-2 px-2 py-1 text-sm rounded hover:bg-muted transition-colors text-left text-red-600 dark:text-red-400"
                  >
                    {loading === "delete" ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-b border-current"></div>
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                    Delete Contract
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  // Simplified view - just archive/unarchive
  return (
    <button
      onClick={handleArchive}
      disabled={loading !== null}
      className="inline-flex items-center gap-1 px-3 py-1 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-800 disabled:opacity-50"
      title={contract.isArchived ? "Unarchive contract" : "Archive contract"}
    >
      {loading === "archive" ? (
        <div className="animate-spin rounded-full h-4 w-4 border-b border-current"></div>
      ) : contract.isArchived ? (
        <ArchiveRestore className="w-4 h-4" />
      ) : (
        <Archive className="w-4 h-4" />
      )}
      {contract.isArchived ? "Unarchive" : "Archive"}
    </button>
  );
};

export default ContractActions;
