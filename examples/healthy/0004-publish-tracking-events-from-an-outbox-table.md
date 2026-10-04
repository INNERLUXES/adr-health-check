---
status: accepted
---

# Publish tracking events from an outbox table

## Context and Problem Statement

[ADR-0003](0003-publish-tracking-events-through-a-queue.md) loses an event when the service stops between the database
commit and the write to the queue. How do we publish every event exactly once to the queue?

## Considered Options

* An outbox table written in the same transaction as the event, read by a relay
* Two-phase commit between the database and the queue

## Decision Outcome

Chosen option: "An outbox table", because the event and its outbox row are committed together in the database chosen
in [ADR-0002](0002-store-shipments-in-postgresql.md), and the relay retries until the queue confirms.

### Consequences

* Good, because no event is lost when the service stops.
* Bad, because a shop can receive an event twice and must ignore the repeat by its event id.

### Confirmation

The relay has a test that stops it after the queue write and before the outbox row is marked sent, and checks that the
event is sent again with the same event id.
