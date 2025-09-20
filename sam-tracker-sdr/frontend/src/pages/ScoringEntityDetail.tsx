import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { DataTable, createSelectableColumn, sortableHeader } from "../components/data-table";
import { PageHeader } from "../components/PageHeader";
import { Button } from "../components/ui/button";
import { fetchScoringEntityDetail } from "../lib/api";
import type { ColumnDef } from "@tanstack/react-table";

interface EntityDetailResponse {
  entity: {
    id: string;
    entityName: string;
    uei: string;
    primaryNaics: string;
    recentAwardDate: string;
    awardsLastYear: number;
    contactEmail?: string;
    contactPhone?: string;
    website?: string;
    status: string;
    stale: boolean;
  };
  awards: Array<{
    id: string;
    solicitationNumber: string;
    title: string;
    agency: string;
    naics: string;
    awardDate?: string;
    modifiedDate?: string;
    awardAmount?: string;
    value?: string;
    setAside?: string;
    placeCity?: string;
    placeState?: string;
    placeCountry?: string;
    contactName?: string;
    contactEmail?: string;
  }>;
}

function formatDate(value?: string) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function ScoringEntityDetail() {
  const { entityId } = useParams();
  const navigate = useNavigate();
  const [detail, setDetail] = useState<EntityDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!entityId) {
      return;
    }
    let active = true;
    (async () => {
      try {
        const data = await fetchScoringEntityDetail(entityId);
        if (!active) return;
        setDetail(data);
        setError(null);
      } catch (err) {
        console.error("Unable to load entity detail", err);
        if (active) setError("Unable to load entity detail");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [entityId]);

  const columns = useMemo<ColumnDef<EntityDetailResponse["awards"][number]>[]>(() => {
    const base: ColumnDef<EntityDetailResponse["awards"][number]>[] = [
      {
        accessorKey: "title",
        header: ({ column }) => sortableHeader("Award", column),
        cell: ({ row }) => (
          <div className="flex flex-col">
            <span className="font-medium text-sm">{row.original.title}</span>
            <span className="text-xs text-muted-foreground">
              {row.original.solicitationNumber}
            </span>
          </div>
        ),
      },
      {
        accessorKey: "naics",
        header: ({ column }) => sortableHeader("NAICS", column),
        cell: ({ row }) => row.original.naics,
      },
      {
        accessorKey: "awardAmount",
        header: ({ column }) => sortableHeader("Amount", column),
        cell: ({ row }) => row.original.awardAmount ?? row.original.value ?? "—",
      },
      {
        accessorKey: "setAside",
        header: ({ column }) => sortableHeader("Set Aside", column),
        cell: ({ row }) => row.original.setAside ?? "—",
      },
      {
        accessorKey: "awardDate",
        header: ({ column }) => sortableHeader("Award Date", column),
        cell: ({ row }) => formatDate(row.original.awardDate ?? row.original.modifiedDate),
      },
      {
        id: "location",
        header: "Location",
        cell: ({ row }) => {
          const parts = [row.original.placeCity, row.original.placeState, row.original.placeCountry]
            .filter(Boolean)
            .join(", ");
          return parts || "—";
        },
      },
      {
        id: "contact",
        header: "POC",
        cell: ({ row }) => (
          <div className="flex flex-col">
            <span>{row.original.contactName ?? "—"}</span>
            <span className="text-xs text-muted-foreground">
              {row.original.contactEmail ?? ""}
            </span>
          </div>
        ),
      },
    ];
    const selectable = createSelectableColumn<EntityDetailResponse["awards"][number]>();
    return selectable ? [selectable, ...base] : base;
  }, []);

  if (loading) {
    return (
      <section className="space-y-4">
        <PageHeader title="Entity" description="Loading entity detail..." />
        <p className="text-sm text-muted-foreground">Fetching entity detail…</p>
      </section>
    );
  }

  if (error || !detail) {
    return (
      <section className="space-y-4">
        <PageHeader title="Entity" description="Unable to load entity." />
        <p className="text-sm text-red-400">{error ?? "Entity not found."}</p>
        <Button variant="outline" onClick={() => navigate(-1)}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back
        </Button>
      </section>
    );
  }

  const entity = detail.entity;

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between">
        <PageHeader
          title={entity.entityName}
          description={`UEI ${entity.uei || "Unknown"}`}
        />
        <Button variant="ghost" onClick={() => navigate(-1)}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-lg border border-border/60 bg-card/60 p-4">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Summary
          </h3>
          <div className="mt-2 space-y-1 text-sm">
            <div>Primary NAICS: {entity.primaryNaics || "Unknown"}</div>
            <div>Awards (12 mo): {entity.awardsLastYear}</div>
            <div>Status: {entity.status}</div>
            <div>Needs rescore: {entity.stale ? "Yes" : "No"}</div>
          </div>
        </div>
        <div className="rounded-lg border border-border/60 bg-card/60 p-4">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Contact
          </h3>
          <div className="mt-2 space-y-1 text-sm">
            <div>{entity.contactEmail ?? "—"}</div>
            <div>{entity.contactPhone ?? ""}</div>
            {entity.website ? (
              <a
                href={entity.website}
                target="_blank"
                rel="noreferrer"
                className="text-primary"
              >
                {entity.website}
              </a>
            ) : null}
          </div>
        </div>
        <div className="rounded-lg border border-border/60 bg-card/60 p-4">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Recent Award
          </h3>
          <div className="mt-2 space-y-1 text-sm">
            <div>
              {entity.recentAwardDate ? formatDate(entity.recentAwardDate) : "None in last 12 months"}
            </div>
          </div>
        </div>
      </div>

      <DataTable<EntityDetailResponse["awards"][number]>
        columns={columns}
        data={detail.awards}
        searchKey="title"
        searchPlaceholder="Filter awards..."
        initialPageSize={25}
        pageSizeOptions={[25, 50, 100]}
      />
    </section>
  );
}
