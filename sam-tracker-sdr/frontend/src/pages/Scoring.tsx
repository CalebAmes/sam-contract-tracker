import { useCallback, useEffect, useMemo, useState } from "react";
import { isAxiosError } from "axios";
import type { ColumnDef, Row } from "@tanstack/react-table";
import {
  Clock,
  Eye,
  EyeOff,
  Loader2,
  Mail,
  Sparkles,
  Square,
  ChevronDown,
  ChevronRight,
  RotateCcw,
} from "lucide-react";
import { Link } from "react-router-dom";

import {
  DataTable,
  createSelectableColumn,
  sortableHeader,
} from "../components/data-table";
import { PageHeader } from "../components/PageHeader";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import {
  deleteAllScoringEntities,
  fetchScoringQueue,
  fetchScoringSummary,
  startScoringScan,
  stopScoringQueue,
  clearScoringFailures,
  resetScoringState,
} from "../lib/api";

const TOKEN_EXPIRATION_MINUTES = 30;

function toErrorMessage(error: unknown, fallback: string): string {
  if (isAxiosError(error)) {
    return (
      (error.response?.data as any)?.error ??
      (error.response?.data as any)?.message ??
      error.message ??
      fallback
    );
  }
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  if (error && typeof error === "object" && "message" in error) {
    return String((error as any).message);
  }
  return fallback;
}

export interface ScoringEntity {
  id: string;
  entityName: string;
  uei: string;
  primaryNaics: string;
  recentAwardDate: string;
  awardsLastYear: number;
  contactEmail?: string;
  contactPhone?: string;
  website?: string;
  status: "pending" | "queued" | "processing" | "ready";
  stale: boolean;
}

interface ScoringJob {
  id: string;
  entityId: string;
  status: "queued" | "processing" | "completed" | "failed";
  createdAt: string;
  startedAt?: string | null;
  completedAt?: string | null;
  entityName?: string;
  entityUei?: string;
  error?: string | null;
}

interface ScoringQueueState {
  activeJob?: ScoringJob;
  queuedJobs: ScoringJob[];
  recentJobs: ScoringJob[];
  failedJobs: ScoringJob[];
  running: boolean;
}

function formatDate(value?: string) {
  if (!value) {
    return "—";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function Scoring() {
  const [rows, setRows] = useState<ScoringEntity[]>([]);
  const [loading, setLoading] = useState(true);
  const [clearing, setClearing] = useState(false);
  const [token, setToken] = useState("");
  const [tokenSavedAt, setTokenSavedAt] = useState<string | null>(null);
  const [showToken, setShowToken] = useState(false);
  const [queueState, setQueueState] = useState<ScoringQueueState | null>(null);
  const [queueError, setQueueError] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [showFailures, setShowFailures] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [clearingFailures, setClearingFailures] = useState(false);

  const loadEntities = useCallback(async (options?: { silent?: boolean }) => {
    if (!options?.silent) {
      setLoading(true);
    }
    try {
      const data = await fetchScoringSummary();
      setRows(data);
    } catch (error) {
      console.error("Unable to load scoring summary", error);
    } finally {
      if (!options?.silent) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    loadEntities();
  }, [loadEntities]);

  useEffect(() => {
    const storedToken = localStorage.getItem("sdr_sam_token");
    const storedTimestamp = localStorage.getItem("sdr_sam_token_saved_at");
    if (storedToken) {
      setToken(storedToken);
    }
    if (storedTimestamp) {
      setTokenSavedAt(storedTimestamp);
    }
  }, []);

  const handleSaveToken = () => {
    localStorage.setItem("sdr_sam_token", token);
    const timestamp = new Date().toISOString();
    localStorage.setItem("sdr_sam_token_saved_at", timestamp);
    setTokenSavedAt(timestamp);
  };

  const handleClearToken = () => {
    if (!token) {
      return;
    }
    if (!window.confirm("Remove the saved SAM.gov token?")) {
      return;
    }
    localStorage.removeItem("sdr_sam_token");
    localStorage.removeItem("sdr_sam_token_saved_at");
    setToken("");
    setTokenSavedAt(null);
  };

  const tokenAge = useMemo(() => {
    if (!tokenSavedAt) {
      return null;
    }
    const saved = new Date(tokenSavedAt).getTime();
    const diffMs = Date.now() - saved;
    if (Number.isNaN(saved) || diffMs < 0) {
      return null;
    }
    const minutes = Math.floor(diffMs / 60000);
    const seconds = Math.floor((diffMs % 60000) / 1000);
    return { minutes, seconds };
  }, [tokenSavedAt]);

  const tokenExpired = tokenAge
    ? tokenAge.minutes >= TOKEN_EXPIRATION_MINUTES
    : false;

  const refreshQueue = useCallback(async () => {
    try {
      const state = await fetchScoringQueue();
      setQueueState(state);
      setQueueError(null);
      const hasActive =
        Boolean(state?.activeJob) || (state?.queuedJobs?.length ?? 0) > 0;
      if (hasActive) {
        await loadEntities({ silent: true });
      }
    } catch (error) {
      console.error("Unable to fetch scoring queue", error);
      setQueueError(toErrorMessage(error, "Unable to load queue status"));
    }
  }, [loadEntities]);

  useEffect(() => {
    let timer: NodeJS.Timeout | undefined;
    let active = true;

    const poll = async () => {
      await refreshQueue();
      if (!active) return;
      timer = setTimeout(poll, 500);
    };

    poll();

    return () => {
      active = false;
      if (timer) clearTimeout(timer);
    };
  }, [refreshQueue]);

  const handleClear = async () => {
    if (clearing) {
      return;
    }
    if (
      !window.confirm("This will delete all cached scoring entities. Continue?")
    ) {
      return;
    }
    setClearing(true);
    try {
      await deleteAllScoringEntities();
      setRows([]);
      await refreshQueue();
    } catch (error) {
      console.error("Unable to clear scoring entities", error);
    } finally {
      setClearing(false);
    }
  };

  const handleStartScan = async () => {
    if (isScanning) {
      return;
    }
    if (!token) {
      setQueueError("Token required to run enrichment");
      return;
    }
    setIsScanning(true);
    setQueueError(null);
    try {
      const staleIds = rows
        .filter((entity) => entity.stale)
        .map((entity) => entity.id);
      await startScoringScan(staleIds.length ? staleIds : undefined, token);
      await loadEntities({ silent: true });
      await refreshQueue();
    } catch (error) {
      console.error("Unable to start scoring scan", error);
      setQueueError(toErrorMessage(error, "Failed to start scan"));
    } finally {
      setIsScanning(false);
    }
  };

  const handleStopScan = async () => {
    if (stopping || !queueState?.running) {
      return;
    }
    setStopping(true);
    try {
      await stopScoringQueue();
      await refreshQueue();
      await loadEntities({ silent: true });
      setQueueError(null);
    } catch (error) {
      console.error("Unable to stop scoring queue", error);
      setQueueError(toErrorMessage(error, "Failed to stop queue"));
    } finally {
      setStopping(false);
    }
  };

  const handleResetQueue = async () => {
    if (resetting) {
      return;
    }
    if (
      !window.confirm(
        "Reset the scoring queue? This will mark every entity as needing a rescan and delete all queued jobs."
      )
    ) {
      return;
    }
    setResetting(true);
    try {
      await resetScoringState();
      await refreshQueue();
      await loadEntities({ silent: true });
      setQueueError(null);
    } catch (error) {
      console.error("Unable to reset scoring state", error);
      setQueueError(toErrorMessage(error, "Failed to reset scoring state"));
    } finally {
      setResetting(false);
    }
  };

  const handleClearFailures = async () => {
    if (clearingFailures) {
      return;
    }
    setClearingFailures(true);
    try {
      await clearScoringFailures();
      await refreshQueue();
      setShowFailures(false);
      setQueueError(null);
    } catch (error) {
      console.error("Unable to clear scoring failures", error);
      setQueueError(toErrorMessage(error, "Failed to clear failures"));
    } finally {
      setClearingFailures(false);
    }
  };

  const columns = useMemo<ColumnDef<ScoringEntity>[]>(() => {
    const statusStyles: Record<
      ScoringEntity["status"],
      { label: string; className: string }
    > = {
      pending: {
        label: "Pending",
        className: "border border-border/60 bg-muted/30 text-muted-foreground",
      },
      queued: {
        label: "Queued",
        className: "border border-amber-500/40 bg-amber-500/10 text-amber-300",
      },
      processing: {
        label: "Processing",
        className: "border border-blue-500/40 bg-blue-500/10 text-blue-200",
      },
      ready: {
        label: "Ready",
        className:
          "border border-emerald-500/40 bg-emerald-500/10 text-emerald-200",
      },
    };

    const base: ColumnDef<ScoringEntity>[] = [
      {
        accessorKey: "entityName",
        header: ({ column }) => sortableHeader("Entity", column),
        cell: ({ row }) => (
          <div className="flex flex-col">
            <Link
              to={`/scoring/entities/${row.original.id}`}
              className="font-medium text-foreground hover:text-primary"
            >
              {row.original.entityName}
            </Link>
            {row.original.uei ? (
              <span className="text-xs text-muted-foreground">
                UEI {row.original.uei}
              </span>
            ) : null}
          </div>
        ),
      },
      {
        accessorKey: "primaryNaics",
        header: ({ column }) => sortableHeader("Primary NAICS", column),
        cell: ({ row }) => row.original.primaryNaics,
      },
      {
        accessorKey: "recentAwardDate",
        header: ({ column }) => sortableHeader("Most Recent Award", column),
        cell: ({ row }) => formatDate(row.original.recentAwardDate),
      },
      {
        accessorKey: "awardsLastYear",
        header: ({ column }) => sortableHeader("Awards (12 mo)", column),
        cell: ({ row }) => row.original.awardsLastYear,
      },
      {
        accessorKey: "stale",
        header: ({ column }) => sortableHeader("Needs Rescore", column),
        cell: ({ row }) => (
          <span
            className={
              row.original.stale ? "text-amber-400" : "text-muted-foreground"
            }
          >
            {row.original.stale ? "Needs rescore" : "Current"}
          </span>
        ),
      },
      {
        accessorKey: "contactEmail",
        header: ({ column }) => sortableHeader("Contact", column),
        cell: ({ row }) => {
          const entity = row.original;
          return (
            <div className="flex flex-col text-sm">
              <span>{entity.contactEmail ?? "—"}</span>
              {entity.contactPhone ? (
                <span className="text-xs text-muted-foreground">
                  {entity.contactPhone}
                </span>
              ) : null}
            </div>
          );
        },
      },
      {
        accessorKey: "status",
        header: ({ column }) => sortableHeader("Status", column),
        cell: ({ row }) => {
          const config = statusStyles[row.original.status];
          return (
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${config.className}`}
            >
              {config.label}
            </span>
          );
        },
      },
      {
        id: "actions",
        header: "Actions",
        enableHiding: false,
        cell: ({ row }) => {
          const entity = row.original;
          return (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2"
              disabled={!entity.contactEmail}
            >
              <Mail className="mr-2 h-4 w-4" /> Email
            </Button>
          );
        },
      },
    ];

    const selectable = createSelectableColumn<ScoringEntity>();
    return selectable ? [selectable, ...base] : base;
  }, []);

  const getRowClassName = useCallback((row: Row<ScoringEntity>) => {
    if (row.original.status === "processing") {
      return "border-blue-500/50 bg-blue-500/10";
    }
    if (row.original.status === "queued") {
      return "border-amber-500/40 bg-amber-500/5";
    }
    return undefined;
  }, []);

  return (
    <section className="flex h-full flex-col gap-6">
      <PageHeader
        title="Scoring"
        description="Entities prioritized for outreach after award analysis. Scores update as the automation pipeline enriches each record."
        actions={
          <Button
            variant="destructive"
            size="sm"
            onClick={handleClear}
            disabled={clearing || loading || rows.length === 0}
          >
            {clearing ? "Clearing…" : "Nuke Entities"}
          </Button>
        }
      />

      <div className="rounded-md border border-border/60 bg-card/60 p-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Input
              id="sam-token"
              type={showToken ? "text" : "password"}
              value={token}
              onChange={(event) => setToken(event.target.value)}
              className="w-80 pr-10"
              placeholder="Paste token"
            />
            <button
              type="button"
              onClick={() => setShowToken((prev) => !prev)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label={showToken ? "Hide token" : "Show token"}
            >
              {showToken ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={handleSaveToken}
            disabled={!token}
          >
            Save
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClearToken}
            disabled={!token}
          >
            Clear
          </Button>

          <span
            className={
              tokenAge
                ? tokenExpired
                  ? "inline-flex items-center gap-1 rounded-full border border-amber-500/50 bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-400"
                  : "inline-flex items-center gap-1 rounded-full border border-border/60 bg-muted/30 px-2 py-0.5 text-xs text-muted-foreground"
                : "text-xs text-muted-foreground"
            }
          >
            {tokenAge ? (
              <>
                <Clock className="h-3.5 w-3.5" />
                <span>
                  Saved {tokenAge.minutes}m {tokenAge.seconds}s ago
                </span>
              </>
            ) : (
              "No token saved"
            )}
          </span>

          <div className="flex-1" />

          <Button
            type="button"
            onClick={handleStartScan}
            disabled={
              isScanning || rows.length === 0 || queueState?.running === true
            }
            className="inline-flex items-center gap-2 rounded-md bg-gradient-to-r from-blue-500 via-purple-500 to-cyan-500 px-4 py-2 text-sm font-semibold text-white shadow-lg transition hover:opacity-90 disabled:opacity-60"
          >
            {isScanning || queueState?.running ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            {queueState?.running
              ? "Processing…"
              : isScanning
              ? "Scanning…"
              : "Run Enrichment"}
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={handleStopScan}
            disabled={stopping || !queueState?.running}
            className="inline-flex items-center gap-2"
          >
            {stopping ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Square className="h-4 w-4" />
            )}
            {stopping ? "Stopping…" : "Stop"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={handleResetQueue}
            disabled={resetting}
            className="inline-flex items-center gap-2"
          >
            {resetting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RotateCcw className="h-4 w-4" />
            )}
            {resetting ? "Resetting…" : "Reset Queue"}
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs uppercase tracking-wide text-muted-foreground">
        <span>
          Total entities queued: {loading ? "—" : rows.length.toLocaleString()}
        </span>
        <span>
          Needs rescore:{" "}
          {loading ? "—" : rows.filter((entity) => entity.stale).length}
        </span>
      </div>

      {queueState ? (
        <div className="flex flex-wrap items-center gap-3 rounded-md border border-border/50 bg-card/50 p-3 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-xs uppercase tracking-wide text-muted-foreground">
              Active
            </span>
            <span className="font-medium">
              {queueState.activeJob?.entityName ?? "Idle"}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground ml-auto">
            <span>Queued {queueState.queuedJobs.length}</span>
            <span>Recent {queueState.recentJobs.length}</span>
            {queueState.failedJobs.length ? (
              <span className="text-red-400">
                Failed {queueState.failedJobs.length}
              </span>
            ) : null}
          </div>
        </div>
      ) : null}

      {queueError ? (
        <div className="rounded-md border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-100">
          <p className="font-semibold text-red-200">Queue Error</p>
          <p className="mt-1 whitespace-pre-wrap text-red-100">{queueError}</p>
        </div>
      ) : null}

      {(queueState?.failedJobs?.length ?? 0) > 0 ? (
        <div className="rounded-md border border-red-500/40 bg-red-500/5 text-sm">
          <div className="flex items-center justify-between px-4 py-3">
            <button
              type="button"
              onClick={() => setShowFailures((prev) => !prev)}
              className="flex items-center gap-2 text-left text-red-200"
            >
              {showFailures ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
              <span className="font-semibold">Recent Failures</span>
            </button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={handleClearFailures}
              disabled={clearingFailures}
              className="text-red-200 hover:text-red-100"
            >
              {clearingFailures ? "Clearing…" : "Clear All"}
            </Button>
          </div>
          {showFailures ? (
            <ul className="border-t border-red-500/20 px-4 py-3 text-red-100">
              {(queueState?.failedJobs ?? []).map((job) => (
                <li
                  key={job.id}
                  className="border-b border-red-500/10 py-2 last:border-b-0"
                >
                  <div className="font-medium text-red-200">
                    {job.entityName ?? job.entityId}
                  </div>
                  {job.error ? (
                    <div className="text-[13px] text-red-100/90">
                      {job.error}
                    </div>
                  ) : null}
                  {job.completedAt ? (
                    <div className="text-[12px] text-red-200/70">
                      Completed {formatDate(job.completedAt)}
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {loading ? (
        <p className="text-sm text-muted-foreground">
          Loading scoring results…
        </p>
      ) : (
        <DataTable<ScoringEntity>
          columns={columns}
          data={rows}
          searchKey="entityName"
          searchPlaceholder="Filter entities..."
          initialPageSize={50}
          pageSizeOptions={[25, 50, 100, 200]}
          getRowClassName={getRowClassName}
        />
      )}
    </section>
  );
}
