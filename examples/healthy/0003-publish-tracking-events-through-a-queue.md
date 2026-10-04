---
status: "superseded by ADR-0004"
---

# Publish tracking events through a queue

## Context and Problem Statement

The shop of a sender wants to show tracking events as they happen. How do events leave the service?

## Considered Options

* Write each event to a message queue after the database commit
* Let shops poll the API

## Decision Outcome

Chosen option: "Write each event to a message queue after the database commit", because shops get events within
seconds.

### Consequences

* Bad, because an event is lost when the service stops between the commit and the write to the queue.

This decision is replaced by [ADR-0004](0004-publish-tracking-events-from-an-outbox-table.md).
