import { useEffect, useMemo, useState } from "react";
import { ColumnDef } from "@tanstack/react-table";
import { MoreHorizontal } from "lucide-react";

import {
  DataTable,
  createSelectableColumn,
  sortableHeader,
} from "../components/data-table";
import { PageHeader } from "../components/PageHeader";
import { Button } from "../components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../components/ui/dropdown-menu";
import {
  fetchIntakeOpportunities,
  deleteAllIntakeAwards,
  triggerIntakeFetch,
  triggerIntakeFetchLatest,
} from "../lib/api";

export interface IntakeOpportunity {
  id: string;
  solicitationNumber: string;
  title: string;
  agency: string;
  naics: string;
  postedDate?: string;
  awardDate?: string;
  modifiedDate?: string;
  status: string;
  awardeeName?: string;
  awardeeUei?: string;
  awardingOffice?: string;
  value?: string;
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

export function Intake() {
  const [rows, setRows] = useState<IntakeOpportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetching, setFetching] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const loadOpportunities = async () => {
    try {
      const data = await fetchIntakeOpportunities();
      setRows(data);
    } catch (error) {
      console.error("Unable to load intake awards", error);
      setStatusMessage("Failed to load intake awards. Check console for details.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOpportunities();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleFetch = async () => {
    if (fetching) {
      return;
    }
    setFetching(true);
    setStatusMessage(null);
    setLoading(true);
    try {
      const response = await triggerIntakeFetch();
      const data = await fetchIntakeOpportunities();
      setRows(data);

      const created = Number(response?.summary?.created ?? 0);
      const totalStored = Number(response?.summary?.totalStored ?? data.length ?? 0);
      const message =
        typeof response?.message === "string"
          ? response.message
          : "SAM intake fetch completed.";

      setStatusMessage(
        `${message} Added ${created} new awards. ${totalStored} awards stored in the intake queue.`
      );
    } catch (error: any) {
      console.error("Unable to fetch intake awards", error);
      const fallback = "Failed to fetch intake awards. Check console for details.";
      const serverMessage = error?.response?.data?.error || error?.message;
      setStatusMessage(serverMessage ? `${fallback} ${serverMessage}.` : fallback);
    } finally {
      setFetching(false);
      setLoading(false);
    }
  };

  const handleClear = async () => {
    if (clearing) {
      return;
    }
    if (!window.confirm("This will delete all cached awards. Continue?")) {
      return;
    }
    setClearing(true);
    setStatusMessage(null);
    try {
      const response = await deleteAllIntakeAwards();
      setRows([]);
      const message =
        typeof response?.message === "string"
          ? response.message
          : "All intake awards removed.";
      setStatusMessage(message);
    } catch (error) {
      console.error("Unable to clear intake awards", error);
      setStatusMessage("Failed to clear intake awards. Check console for details.");
    } finally {
      setClearing(false);
    }
  };

  const handleFetchLatest = async () => {
    if (fetching) {
      return;
    }
    if (!window.confirm("Fetch only the latest 5 awards?")) {
      return;
    }
    setFetching(true);
    setStatusMessage(null);
    setLoading(true);
    try {
      const response = await triggerIntakeFetchLatest();
      const data = await fetchIntakeOpportunities();
      setRows(data);
      const created = Number(response?.summary?.created ?? 0);
      const totalStored = Number(response?.summary?.totalStored ?? data.length ?? 0);
      const message =
        typeof response?.message === "string"
          ? response.message
          : "Fetched latest awards.";
      setStatusMessage(
        `${message} Added ${created} new awards. ${totalStored} awards stored in the intake queue.`
      );
    } catch (error: any) {
      console.error("Unable to fetch latest awards", error);
      const fallback = "Failed to fetch the latest awards. Check console for details.";
      const serverMessage = error?.response?.data?.error || error?.message;
      setStatusMessage(serverMessage ? `${fallback} ${serverMessage}.` : fallback);
    } finally {
      setFetching(false);
      setLoading(false);
    }
  };

  const columns = useMemo<ColumnDef<IntakeOpportunity>[]>(() => {
    const base: ColumnDef<IntakeOpportunity>[] = [
      {
        accessorKey: "title",
        header: ({ column }) => sortableHeader("Award", column),
        cell: ({ row }) => {
          const opportunity = row.original;
          return (
            <div className="flex flex-col">
              <span className="font-medium text-sm">{opportunity.title}</span>
              <span className="text-xs text-muted-foreground">
                {opportunity.solicitationNumber}
              </span>
            </div>
          );
        },
      },
      {
        accessorKey: "awardeeName",
        header: ({ column }) => sortableHeader("Awardee", column),
        cell: ({ row }) => {
          const opportunity = row.original;
          return (
            <div className="flex flex-col">
              <span className="font-medium">{opportunity.awardeeName ?? "Unknown"}</span>
              {opportunity.awardeeUei ? (
                <span className="text-xs text-muted-foreground">
                  UEI {opportunity.awardeeUei}
                </span>
              ) : null}
            </div>
          );
        },
      },
      {
        accessorKey: "agency",
        header: ({ column }) => sortableHeader("Agency", column),
        cell: ({ row }) => {
          const opportunity = row.original;
          return (
            <div className="flex flex-col">
              <span className="font-medium">{opportunity.agency}</span>
              {opportunity.awardingOffice ? (
                <span className="text-xs text-muted-foreground">
                  {opportunity.awardingOffice}
                </span>
              ) : null}
            </div>
          );
        },
      },
      {
        accessorKey: "naics",
        header: ({ column }) => sortableHeader("NAICS", column),
        cell: ({ row }) => row.original.naics,
      },
      {
        accessorKey: "modifiedDate",
        header: ({ column }) => sortableHeader("Modified", column),
        cell: ({ row }) => formatDate(row.original.modifiedDate),
      },
      {
        accessorKey: "awardDate",
        header: ({ column }) => sortableHeader("Awarded", column),
        cell: ({ row }) => formatDate(row.original.awardDate),
      },
      {
        accessorKey: "value",
        header: ({ column }) => sortableHeader("Value", column),
        cell: ({ row }) => row.original.value ?? "—",
      },
      {
        id: "actions",
        header: "Actions",
        enableHiding: false,
        cell: ({ row }) => {
          const opportunity = row.original;
          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                  <span className="sr-only">Open menu</span>
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Award</DropdownMenuLabel>
                <DropdownMenuItem
                  onClick={() => navigator.clipboard.writeText(opportunity.id)}
                >
                  Copy Award ID
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem disabled>Open in SAM.gov (coming soon)</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          );
        },
      },
    ];

    const selectable = createSelectableColumn<IntakeOpportunity>();
    return selectable ? [selectable, ...base] : base;
  }, []);

  return (
    <section className="flex h-full flex-col gap-6">
      <PageHeader
        title="Intake"
        description="Live contract awards flowing from the SAM.gov feed. These records seed the SDR scoring pipeline."
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="default"
              size="sm"
              onClick={handleFetch}
              disabled={fetching}
            >
              {fetching ? "Fetching…" : "Fetch SAM Awards"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleFetchLatest}
              disabled={fetching}
            >
              Fetch Latest 5
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleClear}
              disabled={clearing || loading || rows.length === 0}
            >
              {clearing ? "Clearing…" : "Nuke Awards"}
            </Button>
          </div>
        }
      />

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs uppercase tracking-wide text-muted-foreground">
        <span>
          Total awards cached: {loading ? "—" : rows.length.toLocaleString()}
        </span>
        <span>
          Last status: {statusMessage ?? "Idle"}
        </span>
      </div>

      {statusMessage && (
        <div className="rounded-lg border border-border bg-card/50 px-4 py-3 text-sm text-muted-foreground">
          {statusMessage}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading intake data…</p>
      ) : (
        <DataTable<IntakeOpportunity>
          columns={columns}
          data={rows}
          searchKey="title"
          searchPlaceholder="Filter awards..."
          initialPageSize={100}
          pageSizeOptions={[25, 50, 100, 200]}
        />
      )}
    </section>
  );
}
