# 1. Read no clock, and keep dates out of the repository

## Status

Accepted

## Context

A record that stays proposed for a long time is a common sign of a decision log that has stopped working: the decision was taken in practice, or dropped, and the record was never updated. The obvious way to find such records is to compare a date in each record with today. Michael Nygard's post says that a decision may be proposed while the stakeholders have not agreed with it, and accepted once they have, but his format has no date, and the MADR template marks its date as optional metadata: "These are optional metadata elements. Feel free to remove any of them."

Reading the clock would make the same folder give a different report on a different day, so a pipeline that passed yesterday could fail today with no change to the repository. Dates in the records would also be the only part of a record the tool trusts without being able to check it: a date is easy to get wrong when a record is copied from another. And this repository keeps no date in any of its files: not in the licence, not in the changelog, not in the examples, not in the saved pages.

## Decision

1. The tool reads no clock, no time zone and no locale. The same folder gives the same report on every machine and every day.
2. The age of a proposed record is its place in the numbered sequence. Nygard writes that "ADRs will be numbered sequentially and monotonically. Numbers will not be reused.", so a record numbered n was written before every record numbered above n. `stale-proposed` reports a record whose status is the pending word (proposed) when at least a set number of records with a greater number have a decided status (accepted by default). The number, three by default, and the words are the configuration's to change.
3. A date in the front matter of a record is not read. A date written in a record is text like any other.
4. No file of this repository holds a date or a number that reads like a year. The address of Nygard's post holds the date it was published, so the post is named by its title and its host, and the saved page has the date under its title cut and marked `[...]`. `npm run check` fails on any number that reads like a year.

## Consequences

- A team that writes many records a week reaches the limit of three later records quickly, and a team that writes one a quarter slowly. The limit is set in the configuration, and the report says how many later records were decided.
- A proposed record that is the last one in the folder is never stale, however long it has waited. This is the price of rule 1, and docs/limits.md says so.
- Records numbered out of order, or renumbered, move the measure. `duplicate-number` and `numbering-gap` point at the first, and `file-name` at a name with no number.
- The README, the documents and the saved pages can be read in any year without being out of date about a date.
