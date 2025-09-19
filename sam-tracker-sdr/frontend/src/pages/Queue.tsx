import { useMemo } from "react";
import { useParams } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { PageHeader } from "../components/PageHeader";

const QUEUE_DESCRIPTIONS: Record<string, string> = {
  "1": "Initial qualification and SDR notes.",
  "2": "Technical discovery and requirement mapping.",
  "3": "Capture team review and competitive positioning.",
  "4": "Proposal readiness and compliance check.",
  "5": "Final approval and handoff to leadership.",
};

export function Queue() {
  const { queueId = "1" } = useParams();

  const description = useMemo(
    () =>
      QUEUE_DESCRIPTIONS[queueId] ??
      "Custom queue placeholder. Define its workflow before go-live.",
    [queueId]
  );

  return (
    <section className="flex h-full flex-col gap-6">
      <PageHeader
        title={`Queue ${queueId}`}
        description="Stage-specific backlog. Populate once automation connects to the SAM intake service."
      />

      <Card className="bg-card/80">
        <CardHeader>
          <CardTitle>{`Queue ${queueId} Overview`}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Use this space to outline entry / exit criteria, contributor roles, and data requirements for the queue. The skeleton intentionally leaves data integrations and state management unimplemented.
          </p>
        </CardContent>
      </Card>
    </section>
  );
}
