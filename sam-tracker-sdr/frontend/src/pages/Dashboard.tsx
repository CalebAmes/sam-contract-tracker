import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { PageHeader } from "../components/PageHeader";

export function Dashboard() {
  const metrics = [
    { id: "pipeline", label: "Opportunities in Pipeline", value: "0" },
    { id: "reviews", label: "Reviews Completed", value: "0" },
    { id: "set-asides", label: "Set Asides Matched", value: "0" },
  ];

  return (
    <section className="flex h-full flex-col gap-6">
      <PageHeader
        title="Dashboard"
        description="High-level overview of the SDR intake workflow. Metrics are placeholders until data sources are connected."
      />

      <div className="grid gap-4 md:grid-cols-3">
        {metrics.map((metric) => (
          <Card key={metric.id} className="bg-card/80">
            <CardHeader>
              <CardDescription>{metric.label}</CardDescription>
              <CardTitle className="text-3xl font-bold">{metric.value}</CardTitle>
            </CardHeader>
          </Card>
        ))}
      </div>

      <Card className="bg-card/80">
        <CardHeader>
          <CardTitle>Workflow Summary</CardTitle>
          <CardDescription>
            Outline the SDR daily motion, highlight blockers, and track integration work here.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Populate this panel with live metrics, charts, and action items once backend instrumentation is available.
          </p>
        </CardContent>
      </Card>
    </section>
  );
}
