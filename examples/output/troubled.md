## adr-health-check: FAIL - 12 findings at or above warning

- Folder: examples/troubled (9 records, 1 other file, 0 subfolders, 0 symbolic links)
- Config: examples/config.json (Order platform review rules): layouts Nygard (3 sections, status required), MADR (8 sections), detected per record; statuses proposed, accepted, rejected, deprecated, superseded, draft; file names NNNN-title-with-dashes.md
- Rules: missing-title (error); unknown-layout (error); missing-section (required error, recommended notice); empty-section (warning); placeholder (warning); missing-status (error); unknown-status (error); stale-proposed (warning); superseded-link (error); broken-link (error); duplicate-number (error); duplicate-title (error); numbering-gap (notice); file-name (warning)
- Records: 9: 8 Nygard, 1 with no layout; 1 proposed, 5 accepted, 1 superseded, 1 with another status, 1 with no status
- Links: 2 relative links to the folder checked, 1 broken; 1 leaving the folder not followed; 0 web addresses not fetched
- Findings: 13 (8 error, 4 warning, 1 notice); fail level warning

### Findings

| Level | Rule | Found | Where |
| --- | --- | --- | --- |
| **error** | superseded-link | the record is superseded, but its status names no record that replaces it | examples/troubled/0003-deploy-on-virtual-machines.md:5:1 |
| **error** | unknown-status | the status "approved" is not one of proposed, accepted, rejected, deprecated, superseded and draft | examples/troubled/0004-cache-prices-in-memory.md:5:1 |
| **error** | duplicate-title | the title "5. Cache prices in memory" is the title of 2 records: 0004-cache-prices-in-memory.md and 0005-cache-prices-in-memory.md | examples/troubled/0005-cache-prices-in-memory.md:1:3 |
| **error** | duplicate-number | the number 5 is used by 2 records: 0005-cache-prices-in-memory.md and 0005-use-feature-flags.md | examples/troubled/0005-use-feature-flags.md |
| **error** | missing-section | required section Consequences of the Nygard layout is missing | examples/troubled/0007-move-search-to-a-separate-service.md |
| **error** | broken-link | the link 0010-search-index.md points to 0010-search-index.md, which is not in the folder | examples/troubled/0007-move-search-to-a-separate-service.md:14:96 |
| **error** | unknown-layout | no heading of the record matches a section of Nygard and MADR, so its sections are not checked | examples/troubled/0009-notes-from-the-planning-meeting.md |
| **error** | missing-title | the record has no title: its first heading "Status" is a level 2 heading | examples/troubled/08-Rename-Customer-Tables.md:1:4 |
| warning | stale-proposed | the record is still proposed while 4 later records are accepted or rejected: 0005-cache-prices-in-memory.md, 0005-use-feature-flags.md, 0007-move-search-to-a-separate-service.md and 1 more | examples/troubled/0002-use-a-message-queue-for-orders.md:5:1 |
| warning | empty-section | the heading "Consequences" holds nothing but TBD | examples/troubled/0004-cache-prices-in-memory.md:15:4 |
| warning | placeholder | placeholder TODO in "Decision": The rollout plan is TODO. The operations handbook of the company is in \[the handbook\](../.... | examples/troubled/0007-move-search-to-a-separate-service.md:15:21 |
| warning | file-name | the file name 08-Rename-Customer-Tables.md does not follow NNNN-title-with-dashes.md: the number has 2 digits, not 4 | examples/troubled/08-Rename-Customer-Tables.md |
| notice | numbering-gap | no record has the number 6, between 0005-cache-prices-in-memory.md and 0007-move-search-to-a-separate-service.md | examples/troubled |

#### superseded-link: examples/troubled/0003-deploy-on-virtual-machines.md:5:1

- Rule: a record with the status superseded whose status holds neither a relative link to another record of the folder nor an ADR number ("ADR-0005", "ADR 5") of another record of the folder
- Why: the status is read from the section "Status": "Superseded"
- Why: the status of a replaced record links to the record that replaces it, or names its number, such as ADR-0005
- Basis: "If a later ADR changes or reverses a decision, it may be marked as "deprecated" or "superseded" with a reference to its replacement." (Decision, Documenting Architecture Decisions, by Michael Nygard, on the Cognitect blog at www.cognitect.com)
- Basis: "If a decision is reversed, we will keep the old one around, but mark it as superseded." (Decision, Documenting Architecture Decisions, by Michael Nygard, on the Cognitect blog at www.cognitect.com)

#### unknown-status: examples/troubled/0004-cache-prices-in-memory.md:5:1

- Rule: a status whose first word is not one of proposed, accepted, rejected, deprecated, superseded and draft, or a status given more than once in the front matter
- Why: the status is read from the section "Status": "Approved"
- Why: its first word is "approved"
- Basis: "A decision may be "proposed" if the project stakeholders haven't agreed with it yet, or "accepted" once it is agreed." (Decision, Documenting Architecture Decisions, by Michael Nygard, on the Cognitect blog at www.cognitect.com)
- Basis: "status: "{proposed \| rejected \| accepted \| deprecated \| ... \| superseded by ADR-0123}"" (These are optional metadata elements., https://raw.githubusercontent.com/adr/madr/develop/template/adr-template.md)

#### duplicate-title: examples/troubled/0005-cache-prices-in-memory.md:1:3

- Rule: two or more records whose titles are the same once a leading "ADR 9:" or "9." is left out, case is ignored and punctuation is read as a space
- Why: titles are compared once a leading "ADR 9:" or "9." is left out, case is ignored and punctuation is read as a space
- Basis: "These documents have names that are short noun phrases." (Decision, Documenting Architecture Decisions, by Michael Nygard, on the Cognitect blog at www.cognitect.com)
- The tool's own choice: two records with one title make a link or a mention by title ambiguous

#### duplicate-number: examples/troubled/0005-use-feature-flags.md

- Rule: two or more records whose file names give the same number (the digits after the prefix "", or at the start of the name)
- Why: the number of a record is read from its file name
- Why: a link or a mention by number such as ADR-0005 cannot tell these records apart
- Basis: "ADRs will be numbered sequentially and monotonically. Numbers will not be reused." (Decision, Documenting Architecture Decisions, by Michael Nygard, on the Cognitect blog at www.cognitect.com)
- Basis: "NNNN is a consecutive number and we assume that there won't be more than 9,999 ADRs in one repository." (Manual approach, https://adr.github.io/madr/)

#### missing-section: examples/troubled/0007-move-search-to-a-separate-service.md

- Rule: a section of the layout of a record at level required (finding at error) or recommended (finding at notice) for which no heading matches one of its aliases
- Why: no heading matches one of its aliases: Consequences
- Why: the record is read as Nygard because 2 headings of it match sections of that layout
- Why: the layout has this section because of "This section describes the resulting context, after applying the decision."
- Basis: "We will use a format with just a few parts, so each document is easy to digest." (Decision, Documenting Architecture Decisions, by Michael Nygard, on the Cognitect blog at www.cognitect.com)
- Basis: "MADR is a streamlined template for recording architectural significant decisions in a structured manner." (Markdown Architectural Decision Records, https://adr.github.io/madr/)

#### broken-link: examples/troubled/0007-move-search-to-a-separate-service.md:14:96

- Rule: an inline link, an image or a link reference definition outside code whose destination is a relative path to a name in the folder, and no regular file of the folder has that name; links that leave the folder are never followed, and web addresses are never fetched
- Why: the destination is a relative path to a name in the folder examples/troubled
- Why: the folder was listed once; the link is resolved against that list, and nothing is opened
- Basis: "Links to other decisions and resources might appear here as well." (More Information, https://raw.githubusercontent.com/adr/madr/develop/template/adr-template.md)
- Basis: "An inline link consists of a link text followed immediately by a left parenthesis (, an optional link destination, an optional link title, and a right parenthesis )." (6.3 Links, https://spec.commonmark.org/0.31.2/#links)

#### unknown-layout: examples/troubled/0009-notes-from-the-planning-meeting.md

- Rule: a record in which no heading matches a section of any layout (Nygard, MADR)
- Why: the headings of the record are "Notes from the planning meeting", "Attendees" and "Plan"
- Why: a layout is chosen by the number of its sections that the headings match; here every layout matches none
- Basis: "We will use a format with just a few parts, so each document is easy to digest." (Decision, Documenting Architecture Decisions, by Michael Nygard, on the Cognitect blog at www.cognitect.com)
- Basis: "MADR is a streamlined template for recording architectural significant decisions in a structured manner." (Markdown Architectural Decision Records, https://adr.github.io/madr/)
- The tool's own choice: a record must match at least one section of a layout before its sections can be checked

#### missing-title: examples/troubled/08-Rename-Customer-Tables.md:1:4

- Rule: a record whose first heading is not a level 1 heading and whose front matter has no title
- Why: the title is the first heading of the record when it is a level 1 heading, or the title key of its front matter
- Basis: "These documents have names that are short noun phrases." (Decision, Documenting Architecture Decisions, by Michael Nygard, on the Cognitect blog at www.cognitect.com)

#### stale-proposed: examples/troubled/0002-use-a-message-queue-for-orders.md:5:1

- Rule: a record with the status proposed and a number n, when at least 3 records with a number greater than n have the status accepted or rejected
- Why: its number is 2, and 4 records with a greater number have the status accepted or rejected
- Why: the limit is 3: the tool reads no date, so the place in the numbered sequence measures how long a decision has waited
- Basis: "A decision may be "proposed" if the project stakeholders haven't agreed with it yet, or "accepted" once it is agreed." (Decision, Documenting Architecture Decisions, by Michael Nygard, on the Cognitect blog at www.cognitect.com)
- Basis: "ADRs will be numbered sequentially and monotonically. Numbers will not be reused." (Decision, Documenting Architecture Decisions, by Michael Nygard, on the Cognitect blog at www.cognitect.com)
- The tool's own choice: the number of later decided records that makes a pending record stale is the tool's own; the tool reads no clock and no date, so the place of a record in the numbered sequence is the only measure of its age

#### empty-section: examples/troubled/0004-cache-prices-in-memory.md:15:4

- Rule: a heading other than the title under which, down to the next heading at its level or above, there is no paragraph, list, table, code block or block quote, or where every piece of text is nothing but placeholders
- Why: the heading matches the section Consequences of the Nygard layout
- Why: every piece of text under it is a placeholder once the placeholders are taken out
- Basis: "Documents that assist the team itself can have value, but only if they are kept up to date." (Context, Documenting Architecture Decisions, by Michael Nygard, on the Cognitect blog at www.cognitect.com)
- The tool's own choice: a heading with nothing under it says that a part of the record was never written

#### placeholder: examples/troubled/0007-move-search-to-a-separate-service.md:15:21

- Rule: a placeholder of the list (10 phrases), or text in curly braces as the MADR template writes the parts to fill in, in a heading or in text of any section, outside code, quotes and links
- Why: TODO is on the list of placeholders; the text around it is not written yet
- Basis: "The latest release of the full template (with placeholders and some guidance how to use) can be found at the releases page." (Example, https://adr.github.io/madr/)
- The tool's own choice: the list of placeholders is the tool's own

#### file-name: examples/troubled/08-Rename-Customer-Tables.md

- Rule: a record whose file name does not follow NNNN-title-with-dashes.md: exactly 4 digits, the separator "-", words of lowercase letters a to z and digits joined by "-", and the extension .md
- Why: the spec of a file name is NNNN-title-with-dashes.md
- Basis: "The filenames are following the pattern NNNN-title-with-dashes.md (ADR-0005), where" (Manual approach, https://adr.github.io/madr/)
- Basis: "The title is stored using dashes and lowercase, because \[adr-tools\] also does that." (Manual approach, https://adr.github.io/madr/)

#### numbering-gap: examples/troubled

- Rule: a run of whole numbers between the lowest and the highest record number that no record has
- Why: the numbers of the records run from 1 to 9
- Why: a missing number can be a record that was deleted, renamed or never added
- Basis: "ADRs will be numbered sequentially and monotonically. Numbers will not be reused." (Decision, Documenting Architecture Decisions, by Michael Nygard, on the Cognitect blog at www.cognitect.com)
- Basis: "Copy docs/decisions/adr-template.md to docs/decisions/NNNN-title-with-dashes.md, where NNNN indicates the next number in sequence." (Manual approach, https://adr.github.io/madr/)

### Records

| Number | File | Layout | Status | Sections missing or empty |
| --- | --- | --- | --- | --- |
| 1 | examples/troubled/0001-record-architecture-decisions.md | nygard | accepted | none |
| 2 | examples/troubled/0002-use-a-message-queue-for-orders.md | nygard | proposed | none |
| 3 | examples/troubled/0003-deploy-on-virtual-machines.md | nygard | superseded | none |
| 4 | examples/troubled/0004-cache-prices-in-memory.md | nygard | approved | Consequences empty |
| 5 | examples/troubled/0005-cache-prices-in-memory.md | nygard | accepted | none |
| 5 | examples/troubled/0005-use-feature-flags.md | nygard | accepted | none |
| 7 | examples/troubled/0007-move-search-to-a-separate-service.md | nygard | accepted | Consequences missing |
| 9 | examples/troubled/0009-notes-from-the-planning-meeting.md | - | '- | '- |
| 8 | examples/troubled/08-Rename-Customer-Tables.md | nygard | accepted | none |

### Notes

- 1 link leaves the folder and was not followed: examples/troubled/0007-move-search-to-a-separate-service.md:15 ../../handbook/README.md
- not read as records: README.md

This report checks the structure of the records, their status, their numbers, their names and their links only. It does not judge whether a decision is right.
