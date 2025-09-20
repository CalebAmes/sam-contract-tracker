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
  profile: {
    summary: Record<string, any> | null;
    businessInformation: Record<string, any> | null;
    financialInformation: Record<string, any> | null;
    updatedAt: string;
  } | null;
  pointsOfContact: Array<{
    id: string;
    type?: string | null;
    name?: string | null;
    title?: string | null;
    email?: string | null;
    phone?: string | null;
    address?: Record<string, any> | null;
  }>;
  socioEconomic: Array<{
    id: string;
    category?: string | null;
    code?: string | null;
    description?: string | null;
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
  const profile = detail.profile ?? null;
  const summary = (profile?.summary ?? {}) as Record<string, any>;
  const businessInfo = (profile?.businessInformation ?? {}) as Record<string, any>;
  const financialInfo = (profile?.financialInformation ?? {}) as Record<string, any>;
  const pointsOfContact = detail.pointsOfContact ?? [];
  const socioEconomic = detail.socioEconomic ?? [];
  const primaryPoc = pointsOfContact[0];

  const toDisplay = (value: any): string | null => {
    if (value === null || value === undefined) return null;
    if (typeof value === "string") {
      const trimmed = value.trim();
      return trimmed.length ? trimmed : null;
    }
    if (typeof value === "boolean") return value ? "Yes" : "No";
    if (typeof value === "number") return value.toString();
    if (Array.isArray(value)) {
      const parts = value
        .map((entry) => toDisplay(entry))
        .filter((part): part is string => Boolean(part));
      return parts.length ? parts.join(", ") : null;
    }
    try {
      return JSON.stringify(value);
    } catch (_error) {
      return String(value);
    }
  };

  const formatAddressLines = (
    address?: Record<string, any> | null
  ): string[] => {
    if (!address || typeof address !== "object") {
      return [];
    }
    const lines: string[] = [];
    const line1 = [address.address1, address.address2]
      .map((part: any) => toDisplay(part))
      .filter(Boolean)
      .join(" ")
      .trim();
    if (line1.length) {
      lines.push(line1);
    }
    const city = toDisplay(address.addressCity);
    const state = toDisplay(address.addressState);
    const postal = [
      toDisplay(address.addressZip),
      toDisplay(address.addressZipPlus4),
    ]
      .filter(Boolean)
      .join("-");
    const localityParts = [city, state].filter(Boolean).join(", ");
    const localityLine = [localityParts, postal]
      .filter(Boolean)
      .join(" ")
      .trim();
    if (localityLine.length) {
      lines.push(localityLine);
    }
    const country = toDisplay(address.country);
    if (country) {
      lines.push(country);
    }
    return lines;
  };

  const summaryFacts = (
    [
      ["SAM Status", summary.status ?? entity.status],
      ["Expiration Date", summary.expirationDate],
      ["Activation Date", businessInfo?.registrationDates?.activationDate],
      [
        "Initial Registration",
        businessInfo?.registrationDates?.initialRegistrationDate,
      ],
      [
        "Submission Date",
        summary.submittedDate ?? businessInfo?.registrationDates?.submissionDate,
      ],
      ["Purpose of Registration", summary.purposeOfRegistration],
      ["CAGE Code", summary.cageCode],
      ["Has Exclusions", summary.hasExclusions],
      ["SBA Size Protest", summary.sbaSizeProtest],
      ["Entity Start Date", businessInfo?.entityDates?.entityStartDate],
      ["Fiscal Year End", businessInfo?.entityDates?.fiscalYearEndCloseDate],
      ["Primary NAICS", entity.primaryNaics],
      ["Awards (12 mo)", entity.awardsLastYear],
    ] as Array<[string, any]>
  )
    .map(([label, value]) => {
      const display = toDisplay(value);
      return display ? { label, value: display } : null;
    })
    .filter((fact): fact is { label: string; value: string } => Boolean(fact));

  const businessFacts = (
    [
      ["Doing Business As", businessInfo.doingBusinessAs],
      ["Division Name", businessInfo.divisionName],
      ["State of Incorporation", businessInfo.stateOfIncorporation],
      ["Country of Incorporation", businessInfo.countryOfIncorporation],
      ["Congressional District", businessInfo.congressionalDistrict],
      ["Immediate Owner", businessInfo.immediateOwner?.legalBusinessName],
      ["Highest Level Owner", businessInfo.highestLevelOwner?.legalBusinessName],
      ["Website", businessInfo.url],
    ] as Array<[string, any]>
  )
    .map(([label, value]) => {
      const display = toDisplay(value);
      return display ? { label, value: display } : null;
    })
    .filter((fact): fact is { label: string; value: string } => Boolean(fact));

  const financialFacts = (
    [
      ["Accepts Credit Cards", financialInfo.acceptsCreditCardPayments],
      ["Debt Subject To Offset", financialInfo.debtSubjectToOffset],
      [
        "Financial Accounts",
        Array.isArray(financialInfo.financialAccounts)
          ? `${financialInfo.financialAccounts.length} account(s)`
          : undefined,
      ],
    ] as Array<[string, any]>
  )
    .map(([label, value]) => {
      const display = toDisplay(value);
      return display ? { label, value: display } : null;
    })
    .filter((fact): fact is { label: string; value: string } => Boolean(fact));

  const website = entity.website ?? businessInfo.url ?? undefined;
  const physicalAddress =
    summary.physicalAddress ?? businessInfo.physicalAddress ?? null;
  const mailingAddress =
    summary.mailingAddress ?? businessInfo.mailingAddress ?? null;
  const physicalLines = formatAddressLines(physicalAddress);
  const mailingLines = formatAddressLines(mailingAddress);

  const socioByCategory = socioEconomic.reduce(
    (acc, entry) => {
      const category = toDisplay(entry.category) ?? "Other";
      const label = toDisplay(entry.description) ?? toDisplay(entry.code);
      if (!label) {
        return acc;
      }
      if (!acc.has(category)) {
        acc.set(category, new Set<string>());
      }
      acc.get(category)!.add(label);
      return acc;
    },
    new Map<string, Set<string>>()
  );

  const socioSections = Array.from(socioByCategory.entries()).map(
    ([category, values]) => ({
      category,
      values: Array.from(values),
    })
  );

  const renderAddress = (lines: string[]) => {
    if (lines.length === 0) {
      return <p className="text-sm text-muted-foreground">—</p>;
    }
    return (
      <div className="text-sm">
        {lines.map((line, index) => (
          <span key={`${line}-${index}`} className="block">
            {line}
          </span>
        ))}
      </div>
    );
  };

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
          {summaryFacts.length ? (
            <dl className="mt-2 space-y-1 text-sm">
              {summaryFacts.map((fact) => (
                <div key={fact.label} className="flex items-start justify-between gap-4">
                  <dt className="text-muted-foreground">{fact.label}</dt>
                  <dd className="text-right text-foreground">{fact.value}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">
              Summary information will populate after enrichment.
            </p>
          )}
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
