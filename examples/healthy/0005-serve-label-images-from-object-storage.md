---
status: proposed
---

# Serve label images from object storage

## Context and Problem Statement

Label images are stored in the database today, and they make up most of its size. Should they move to object storage?

## Considered Options

* Object storage with links that expire after 15 minutes
* Keep the images in the database

## Decision Outcome

Chosen option: "Object storage with links that expire after 15 minutes", because the database shrinks and the images
are served without passing through the service.

### Consequences

* Good, because backups of the database get smaller and faster.
* Bad, because a label is only reachable while its link is valid.

## More Information

The storage bucket is described on the internal page `docs/storage.md` of the infrastructure repository.
