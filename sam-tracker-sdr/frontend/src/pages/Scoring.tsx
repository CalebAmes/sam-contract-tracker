import { useEffect, useState } from "react";
import { DataTable, DataTableColumn } from "../components/data-table";
import { PageHeader } from "../components/PageHeader";
import { fetchScoringSummary } from "../lib/api";

export interface Scorecard {
  id: string;
  opportunityId: string;
  reviewer: string;
  technicalFit: number;
  contractViability: number;
  competitiveness: number;
  summary?: string;
  createdAt: string;
}

export function Scoring() {
  const [rows, setRows] = useState<Scorecard[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchScoringSummary()
      .then(setRows)
      .catch((error) => {
        console.error("Unable to load scoring summary", error);
      })
      .finally(() => setLoading(false));
  }, []);

  const columns: DataTableColumn<Scorecard>[] = [
    { id: "opportunityId", label: "Opportunity" },
    { id: "reviewer", label: "Reviewer" },
    {
      id: "technicalFit",
      label: "Technical Fit",
      render: (row) => row.technicalFit?.toFixed?.(1) ?? row.technicalFit,
    },
    {
      id: "contractViability",
      label: "Contract Viability",
      render: (row) =>
        row.contractViability?.toFixed?.(1) ?? row.contractViability,
    },
    {
      id: "competitiveness",
      label: "Competitiveness",
      render: (row) => row.competitiveness?.toFixed?.(1) ?? row.competitiveness,
    },
  ];

  return (
    <section className="flex h-full flex-col gap-6">
      <PageHeader
        title="Scoring"
        description="Placeholder scorecards capturing reviewer assessments. Editing remains disabled until persistence is ready."
      />

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading scoring results…</p>
      ) : (
        <DataTable<Scorecard>
          columns={columns}
          data={rows}
          emptyState={
            <span>Scorecards will surface once the SDR workflow is connected.</span>
          }
        />
      )}
    </section>
  );
}
