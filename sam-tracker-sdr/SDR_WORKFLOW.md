# SAM Tracker SDR Workflow Overview

This document captures the planned flow for the SDR workspace so the team has a reference point before implementing any code. It mirrors the main SAM Tracker architecture while focusing on automation around small business award winners.

## Intake Pipeline

1. Query SAM.gov for recent small business awards and paginate the feed until either:
   - A record collides with one we have already processed, or
   - The result set goes beyond one week in the past.
2. Build a candidate list of entities that have received awards in the current window.
3. Match each entity against locally stored records:
   - Create a new entity record if it does not exist.
   - Update the existing entity when it already lives in our database.
4. Flag all entities identified during this cycle for follow-up scoring.

## Scoring Engine

1. For each entity awaiting review, fetch the awards they have won over the last year and pull detailed opportunity data. This enables NAICS alignment and other qualification checks.
2. Retrieve entity metadata via the SAM API (requires an `xToken`), including contact details and website URL.
3. When an entity’s interim score clears the outreach threshold, attempt to construct contact emails:
   - Generate likely email addresses.
   - Validate each candidate before queuing it for outreach.
4. Produce a final composite score so entities can be ranked for sales development activity.

## Queue 1 – Outreach Prep

1. Pull the highest-scoring entities that have not been contacted yet, biasing toward the most recent award winners.
2. Generate outreach email drafts with support for split testing and tracking parameters.
3. Send initial outreach emails.
4. Mark entities as contacted and advance them to Queue 2 once the send completes.

---

Further queue definitions will be layered on after this foundation ships. No implementation exists yet; this document is meant to keep the team aligned while the skeleton is in place.
