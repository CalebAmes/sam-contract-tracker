import { useEffect, useMemo, useState } from "react";
import { ColumnDef } from "@tanstack/react-table";
import { Clock, Eye, EyeOff, Mail } from "lucide-react";

import {
  DataTable,
  createSelectableColumn,
  sortableHeader,
} from "../components/data-table";
import { PageHeader } from "../components/PageHeader";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
// (Card removed for a leaner toolbar-style token UI)
import {
  deleteAllScoringEntities,
  fetchScoringSummary,
} from "../lib/api";

const TOKEN_EXPIRATION_MINUTES = 30;

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
  status: "pending" | "ready" | "queued";
  stale: boolean;
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

  const loadEntities = () =>
    fetchScoringSummary()
      .then(setRows)
      .catch((error) => {
        console.error("Unable to load scoring summary", error);
      })
      .finally(() => setLoading(false));

  useEffect(() => {
    loadEntities();
  }, []);

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

  const tokenExpired = tokenAge ? tokenAge.minutes >= TOKEN_EXPIRATION_MINUTES : false;

  const handleClear = async () => {
    if (clearing) {
      return;
    }
    if (!window.confirm("This will delete all cached scoring entities. Continue?")) {
      return;
    }
    setClearing(true);
    try {
      await deleteAllScoringEntities();
      setRows([]);
    } catch (error) {
      console.error("Unable to clear scoring entities", error);
    } finally {
      setClearing(false);
    }
  };

  const columns = useMemo<ColumnDef<ScoringEntity>[]>(() => {
    const base: ColumnDef<ScoringEntity>[] = [
      {
        accessorKey: "entityName",
        header: ({ column }) => sortableHeader("Entity", column),
        cell: ({ row }) => (
          <div className="flex flex-col">
            <span className="font-medium">{row.original.entityName}</span>
            {row.original.uei ? (
              <span className="text-xs text-muted-foreground">UEI {row.original.uei}</span>
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
            className={row.original.stale ? "text-amber-400" : "text-muted-foreground"}
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
                <span className="text-xs text-muted-foreground">{entity.contactPhone}</span>
              ) : null}
            </div>
          );
        },
      },
      {
        accessorKey: "status",
        header: ({ column }) => sortableHeader("Status", column),
        cell: ({ row }) => row.original.status,
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
              {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
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
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs uppercase tracking-wide text-muted-foreground">
        <span>
          Total entities queued: {loading ? "—" : rows.length.toLocaleString()}
        </span>
        <span>
          Needs rescore: {loading ? "—" : rows.filter((entity) => entity.stale).length}
        </span>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading scoring results…</p>
      ) : (
        <DataTable<ScoringEntity>
          columns={columns}
          data={rows}
          searchKey="entityName"
          searchPlaceholder="Filter entities..."
          initialPageSize={50}
          pageSizeOptions={[25, 50, 100, 200]}
        />
      )}
    </section>
  );
}
