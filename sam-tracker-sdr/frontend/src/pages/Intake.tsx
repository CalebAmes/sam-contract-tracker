import { useEffect, useState } from "react";
import { DataTable, DataTableColumn } from "../components/data-table";
import { PageHeader } from "../components/PageHeader";
import { fetchIntakeOpportunities } from "../lib/api";

export interface IntakeOpportunity {
  id: string;
  solicitationNumber: string;
  title: string;
  agency: string;
  naics?: string;
  postedDate?: string;
  responseDate?: string;
  status: string;
}

export function Intake() {
  const [rows, setRows] = useState<IntakeOpportunity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchIntakeOpportunities()
      .then(setRows)
      .catch((error) => {
        console.error("Unable to load intake opportunities", error);
      })
      .finally(() => setLoading(false));
  }, []);

  const columns: DataTableColumn<IntakeOpportunity>[] = [
    { id: "solicitationNumber", label: "Solicitation" },
    { id: "title", label: "Title" },
    { id: "agency", label: "Agency" },
    { id: "naics", label: "NAICS" },
    { id: "status", label: "Status" },
  ];

  return (
    <section className="flex h-full flex-col gap-6">
      <PageHeader
        title="Intake"
        description="Monitor opportunities sourced by the SDR team. Actions remain disabled in the skeleton build."
      />

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading intake data…</p>
      ) : (
        <DataTable<IntakeOpportunity>
          columns={columns}
          data={rows}
          emptyState={<span>Opportunities will appear here once intake is wired up.</span>}
        />
      )}
    </section>
  );
}
