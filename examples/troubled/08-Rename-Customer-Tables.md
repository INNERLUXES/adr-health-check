## Status

Accepted

## Context

The customer tables carry the names of a shop system that was replaced, and new team members read them wrong.

## Decision

We will rename the customer tables to the names the shop uses, with a view under each old name for one release.

## Consequences

Reports that read the old names keep working for one release and are then moved to the new names.
