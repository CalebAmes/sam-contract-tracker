import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { fetchScoringColumns } from "../lib/api";

export interface ScoreMetric {
  id: string;
  label: string;
  description: string;
}

export function ScoringColumns() {
  const [metrics, setMetrics] = useState<ScoreMetric[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchScoringColumns()
      .then(setMetrics)
      .catch((error) => {
        console.error("Unable to load scoring metrics", error);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading scoring metrics…</p>;
  }

  return (
    <section className="space-y-4">
      <header className="space-y-2">
        <h2 className="text-2xl font-semibold tracking-tight">Scoring Columns</h2>
        <p className="text-sm text-muted-foreground">
          Document the metrics the SDR team uses to evaluate opportunities. This scaffolding mirrors the primary application while remaining implementation-free.
        </p>
      </header>
      <div className="grid gap-4 md:grid-cols-2">
        {metrics.map((metric) => (
          <Card key={metric.id}>
            <CardHeader>
              <CardTitle>{metric.label}</CardTitle>
              <CardDescription>{metric.id}</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{metric.description}</p>
            </CardContent>
          </Card>
        ))}
        {metrics.length === 0 && (
          <Card>
            <CardHeader>
              <CardTitle>No metrics defined</CardTitle>
              <CardDescription>Populate this view once the SDR workflow is connected.</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                This skeleton is ready for live scoring definitions. Add them via the backend repository once persistence is implemented.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </section>
  );
}
