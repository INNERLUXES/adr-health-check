---
status: accepted
decision-makers: Tom Brandt
---

# Store shipments in PostgreSQL

## Context and Problem Statement

Each shipment has a sender, a receiver, up to forty tracking events and a label. Support staff search shipments by any
of these. Which database holds them?

## Considered Options

* PostgreSQL
* A document database

## Decision Outcome

Chosen option: "PostgreSQL", because the team runs it already, and the searches of the support staff are joins over a
few tables.

### Consequences

* Good, because backups, monitoring and access rules are already in place.
* Bad, because the free-text notes of a shipment need a search index of their own later.

## Pros and Cons of the Options

### PostgreSQL

* Good, because the team knows it.
* Neutral, because tracking events are stored as rows, one per event.

### A document database

* Good, because a shipment is one document.
* Bad, because nobody on the team has run one in production.
