---
status: accepted
decision-makers: Ana Reyes, Tom Brandt
---

# Record decisions in MADR

## Context and Problem Statement

The parcel tracking service is built by two teams in two offices. Decisions are taken in calls and message threads, and
six months later nobody can say why the service uses one database and not another. How do we keep the reasons?

## Decision Drivers

* New team members must find the reasons without asking around.
* Writing a record must take minutes, not hours.

## Considered Options

* Markdown Architectural Decision Records (MADR) in the repository
* Pages in the team wiki
* No written records

## Decision Outcome

Chosen option: "MADR in the repository", because the records are reviewed in the same pull requests as the code they
explain, and the template is short.

### Consequences

* Good, because a change and its reason are reviewed together.
* Bad, because people who do not read the repository need a link to the folder.
