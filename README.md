# adr-health-check

Checks the health of a folder of architecture decision records (ADRs) written in Markdown, in Michael Nygard's format or in MADR. It reads every record, finds its layout, its title, its status and its links, and reports what keeps the decision log from being read: sections that are missing or empty, placeholders, a status that is missing or unknown, records left proposed while later records were accepted, superseded records that do not name their replacement, links to files that are not there, numbers and titles used twice, gaps in the numbers, and file names that do not follow the spec. Each finding has its file, line and column, and the tool exits with a code a pipeline can act on.

The home page of the adr organization says: "An Architectural Decision Record (ADR) captures a single AD and its rationale;" and "The collection of ADRs created and maintained in a project constitute its decision log." Michael Nygard's post, Documenting Architecture Decisions, says: "ADRs will be numbered sequentially and monotonically. Numbers will not be reused." A log like that is only useful while it is kept in order, and this tool checks the order on every change.

- **Two layouts, detected per record.** Nygard (Context, Decision, Consequences, and a status) and MADR (Context and Problem Statement, Considered Options, Decision Outcome, with optional parts), matched by whole headings with an exact rule. Both can be changed, and layouts of your own added.
- **Staleness without a clock.** The tool reads no date. A proposed record is stale when at least three records later in the numbered sequence were accepted; the number and the words are yours to change.
- **Links checked, never followed.** Relative links between records are resolved against one listing of the folder. No link out of the folder is followed, no symbolic link is followed, no web address is fetched.
- **File names by a simple spec.** NNNN-title-with-dashes.md by default: a prefix, a number of digits, a separator, lowercase words. No regular expression.
- **Everything explained.** `--explain` shows the rule, the reasons, the sentences of the saved pages behind each finding, and where a rule is the tool's own choice.
- Reports as text, Markdown and JSON, with an exit code for a pipeline: `0` no finding at or above the fail level, `1` a finding at or above it, `2` usage or input error.
- Plain JavaScript, no dependencies.

```
npm test
```

```
tests 156
pass 153
fail 0
skipped 3
```

These are the summary lines that `npm test` prints at the end on Windows. The skipped tests are the ones that need a symbolic link or a device (a symbolic link in the folder, the folder named through a symbolic link, and `/dev/zero` named as the configuration); they are guarded with `process.platform`, run on Linux and macOS, and none of them asserts a line or a column. `npm run test:coverage` runs the same tests with coverage; their time limits are four times wider when coverage is on.

## Quick start

Requires Node 22 or newer. There is nothing to install.

```
git clone https://github.com/INNERLUXES/adr-health-check.git
cd adr-health-check
node bin/adr-health-check.js examples/troubled --config examples/config.json
```

Or without a clone, on your own records:

```
npx --yes github:INNERLUXES/adr-health-check docs/decisions
```

`examples/` holds two made-up folders. `examples/healthy` is the decision log of a parcel tracking service in MADR: five records with their status in the front matter, one superseded by the next, linked to each other. `examples/troubled` is the decision log of an order platform in Nygard's format, with one problem of each kind: a proposed record that four later records passed by, a superseded record that names no replacement, a status that is not a status word, an empty Consequences section, two records with one number and one title, a gap, a broken link, a link out of the folder, a placeholder, a record with no title and a short file name, and notes from a meeting that follow no layout. `examples/config.json` adds a status word and counts rejected records as decided.

## Usage

```
adr-health-check <folder> [--config <file>] [options]
```

```
--config <file>           a configuration file (JSON) that changes the layouts, the status words, the placeholders,
                          the file-name spec or the rules (default: the built-in configuration; --print-defaults
                          shows it)
--format <name>           text, markdown or json (default: text)
--explain                 show the rule, the reasons and the sentences behind each finding
--fail-on <level>         the lowest level of a finding that fails the run: notice, warning, error (default: failOn of
                          the configuration, else warning)
--out <file>              write the report to this file instead of the screen
--print-defaults          print the built-in configuration as a configuration file and exit
--help                    show the usage
--version                 show the version
```

Paths in the report are relative to the folder you run the command in, with forward slashes on every system, followed by the line and the column of the finding. A column counts characters from 1 in the line as written, a tab as one.

The report of the troubled example starts with what was read and the counts, then the findings, then every record with its layout, its status and the sections that are missing or empty:

```
adr-health-check: examples/troubled
folder: examples/troubled (9 records, 1 other file, 0 subfolders, 0 symbolic links)
config: examples/config.json (Order platform review rules): layouts Nygard (3 sections, status required), MADR (8 sections), detected per record; statuses proposed, accepted, rejected, deprecated, superseded, draft; file names NNNN-title-with-dashes.md
rules: missing-title (error); unknown-layout (error); missing-section (required error, recommended notice); empty-section (warning); placeholder (warning); missing-status (error); unknown-status (error); stale-proposed (warning); superseded-link (error); broken-link (error); duplicate-number (error); duplicate-title (error); numbering-gap (notice); file-name (warning)
records: 9: 8 Nygard, 1 with no layout; 1 proposed, 5 accepted, 1 superseded, 1 with another status, 1 with no status
links: 2 relative links to the folder checked, 1 broken; 1 leaving the folder not followed; 0 web addresses not fetched
findings: 13 (8 error, 4 warning, 1 notice); fail level warning

Findings (13)

  ERROR    superseded-link   examples/troubled/0003-deploy-on-virtual-machines.md:5:1
           the record is superseded, but its status names no record that replaces it

  ERROR    unknown-status    examples/troubled/0004-cache-prices-in-memory.md:5:1
           the status "approved" is not one of proposed, accepted, rejected, deprecated, superseded and draft

  ERROR    duplicate-title   examples/troubled/0005-cache-prices-in-memory.md:1:3
           the title "5. Cache prices in memory" is the title of 2 records: 0004-cache-prices-in-memory.md and 0005-cache-prices-in-memory.md

  ERROR    duplicate-number  examples/troubled/0005-use-feature-flags.md
           the number 5 is used by 2 records: 0005-cache-prices-in-memory.md and 0005-use-feature-flags.md

  ERROR    missing-section   examples/troubled/0007-move-search-to-a-separate-service.md
           required section Consequences of the Nygard layout is missing

  ERROR    broken-link       examples/troubled/0007-move-search-to-a-separate-service.md:14:96
           the link 0010-search-index.md points to 0010-search-index.md, which is not in the folder

  ERROR    unknown-layout    examples/troubled/0009-notes-from-the-planning-meeting.md
           no heading of the record matches a section of Nygard and MADR, so its sections are not checked

  ERROR    missing-title     examples/troubled/08-Rename-Customer-Tables.md:1:4
           the record has no title: its first heading "Status" is a level 2 heading

  WARNING  stale-proposed    examples/troubled/0002-use-a-message-queue-for-orders.md:5:1
           the record is still proposed while 4 later records are accepted or rejected: 0005-cache-prices-in-memory.md, 0005-use-feature-flags.md, 0007-move-search-to-a-separate-service.md and 1 more

  WARNING  empty-section     examples/troubled/0004-cache-prices-in-memory.md:15:4
           the heading "Consequences" holds nothing but TBD

  WARNING  placeholder       examples/troubled/0007-move-search-to-a-separate-service.md:15:21
           placeholder TODO in "Decision": The rollout plan is TODO. The operations handbook of the company is in [the handbook](../....

  WARNING  file-name         examples/troubled/08-Rename-Customer-Tables.md
           the file name 08-Rename-Customer-Tables.md does not follow NNNN-title-with-dashes.md: the number has 2 digits, not 4

  NOTICE   numbering-gap     examples/troubled
           no record has the number 6, between 0005-cache-prices-in-memory.md and 0007-move-search-to-a-separate-service.md

Records (9)

  number  file                                       layout  status      sections missing or empty
  1       0001-record-architecture-decisions.md      nygard  accepted    none
  2       0002-use-a-message-queue-for-orders.md     nygard  proposed    none
  3       0003-deploy-on-virtual-machines.md         nygard  superseded  none
  4       0004-cache-prices-in-memory.md             nygard  approved    Consequences empty
  5       0005-cache-prices-in-memory.md             nygard  accepted    none
  5       0005-use-feature-flags.md                  nygard  accepted    none
  7       0007-move-search-to-a-separate-service.md  nygard  accepted    Consequences missing
  9       0009-notes-from-the-planning-meeting.md    -       -           -
  8       08-Rename-Customer-Tables.md               nygard  accepted    none

note: 1 link leaves the folder and was not followed: examples/troubled/0007-move-search-to-a-separate-service.md:15 ../../handbook/README.md
note: not read as records: README.md

This report checks the structure of the records, their status, their numbers, their names and their links only. It does not judge whether a decision is right.

RESULT: FAIL - 12 findings at or above warning
```

With `--explain`, each finding also shows the rule, the reasons, the sentences it rests on and, where there is one, the tool's own choice:

```
  WARNING  stale-proposed    examples/troubled/0002-use-a-message-queue-for-orders.md:5:1
           the record is still proposed while 4 later records are accepted or rejected: 0005-cache-prices-in-memory.md, 0005-use-feature-flags.md, 0007-move-search-to-a-separate-service.md and 1 more
           rule: a record with the status proposed and a number n, when at least 3 records with a number greater than n have the status accepted or rejected
           why: its number is 2, and 4 records with a greater number have the status accepted or rejected
           why: the limit is 3: the tool reads no date, so the place in the numbered sequence measures how long a decision has waited
           basis: "A decision may be "proposed" if the project stakeholders haven't agreed with it yet, or "accepted" once it is agreed." (Decision, Documenting Architecture Decisions, by Michael Nygard, on the Cognitect blog at www.cognitect.com)
           basis: "ADRs will be numbered sequentially and monotonically. Numbers will not be reused." (Decision, Documenting Architecture Decisions, by Michael Nygard, on the Cognitect blog at www.cognitect.com)
           the tool's own choice: the number of later decided records that makes a pending record stale is the tool's own; the tool reads no clock and no date, so the place of a record in the numbered sequence is the only measure of its age
```

The healthy example passes:

```
adr-health-check: examples/healthy
folder: examples/healthy (5 records, 1 other file, 0 subfolders, 0 symbolic links)
config: examples/config.json (Order platform review rules): layouts Nygard (3 sections, status required), MADR (8 sections), detected per record; statuses proposed, accepted, rejected, deprecated, superseded, draft; file names NNNN-title-with-dashes.md
rules: missing-title (error); unknown-layout (error); missing-section (required error, recommended notice); empty-section (warning); placeholder (warning); missing-status (error); unknown-status (error); stale-proposed (warning); superseded-link (error); broken-link (error); duplicate-number (error); duplicate-title (error); numbering-gap (notice); file-name (warning)
records: 5: 5 MADR; 1 proposed, 3 accepted, 1 superseded
links: 3 relative links to the folder checked, 0 broken; 0 leaving the folder not followed; 0 web addresses not fetched
findings: 0; fail level warning

Findings (0)

  none

Records (5)

  number  file                                                  layout  status      sections missing or empty
  1       0001-record-decisions-in-madr.md                      madr    accepted    none
  2       0002-store-shipments-in-postgresql.md                 madr    accepted    none
  3       0003-publish-tracking-events-through-a-queue.md       madr    superseded  none
  4       0004-publish-tracking-events-from-an-outbox-table.md  madr    accepted    none
  5       0005-serve-label-images-from-object-storage.md        madr    proposed    none

note: not read as records: README.md

This report checks the structure of the records, their status, their numbers, their names and their links only. It does not judge whether a decision is right.

RESULT: PASS - no finding at or above warning
```

## What it checks

| Rule | Key | Default level | Finds |
| --- | --- | --- | --- |
| `missing-title` | `rules.missingTitle` | error | a record whose first heading is not a level 1 heading and whose front matter has no title |
| `unknown-layout` | `rules.unknownLayout` | error | a record in which no heading matches a section of any layout |
| `missing-section` | `rules.missingSection` | error (required), notice (recommended) | a section of the layout of a record that no heading matches |
| `empty-section` | `rules.emptySection` | warning | a heading with no text under it, or nothing but placeholders |
| `placeholder` | `rules.placeholder` | warning | TBD, TODO, FIXME and other listed phrases, and text in curly braces as the MADR template writes the parts to fill in |
| `missing-status` | `rules.missingStatus` | error | a record of a layout that needs a status (Nygard) with no status |
| `unknown-status` | `rules.unknownStatus` | error | a status that is not one of the status words, or given twice in the front matter |
| `stale-proposed` | `rules.staleProposed` | warning | a proposed record when at least three records with a greater number are accepted |
| `superseded-link` | `rules.supersededLink` | error | a superseded record whose status names no other record of the folder, by a link or by an ADR number |
| `broken-link` | `rules.brokenLink` | error | a relative link to a name in the folder that no file of the folder has |
| `duplicate-number` | `rules.duplicateNumber` | error | two records whose file names give the same number |
| `duplicate-title` | `rules.duplicateTitle` | warning | two records with the same title, once a leading "ADR 9:" is left out |
| `numbering-gap` | `rules.numberingGap` | notice | a run of numbers between the lowest and the highest that no record has |
| `file-name` | `rules.fileName` | warning | a file name that does not follow the spec |

[docs/method.md](docs/method.md) says exactly what each rule looks at and what it cannot see, and [docs/rules-and-sources.md](docs/rules-and-sources.md) gives the sentences of the saved pages each rule and each section rests on.

## Layouts

The records are the Markdown files directly in the folder, other than README.md, index.md, template.md and adr-template.md. Each record is read as one of the layouts:

| Layout | Required | Recommended | Optional | Status |
| --- | --- | --- | --- | --- |
| Nygard | Context, Decision, Consequences | | | required |
| MADR | Context and Problem Statement, Considered Options, Decision Outcome | Consequences | Decision Drivers, Confirmation, Pros and Cons of the Options, More Information | optional |

A heading matches a section when it is one of the aliases of the section once numbering, case, markup and punctuation are left out: the whole heading, so `Decision Outcome` is not Nygard's `Decision`. The layout of a record is the layout with the most sections matched by its headings; on a tie the first one, Nygard, with a note; with no match, `unknown-layout`. Set `"layout": "madr"` to read every record as one layout. The title is the first heading when it is at level 1, else the `title` key of the front matter.

## Status and staleness

The status is read from the `status` key of the front matter (MADR), else from the first text under a `Status` heading (Nygard), else from a `Status:` line before the first section (older MADR). Its first word is the status word: `Superseded by [ADR 4](0004-x.md)` is `superseded`. The status words are proposed, accepted, rejected, deprecated and superseded.

The tool reads no clock and no date ([decision 1](docs/decisions/0001-read-no-clock-and-keep-dates-out-of-the-repository.md)). The age of a proposed record is its place in the numbered sequence: a record numbered n is stale when at least `after` (3) records with a number greater than n have a decided status (accepted). Records with the same number, and records with no number, do not count.

## Links

Inline links, images and link reference definitions are found in every piece of text outside code, block quotes included. A destination that is a single name is checked against the files of the folder, listed once; nothing is opened to check it. A link to a parent folder, a subfolder or an absolute path is counted in a note and never followed; every spelling of `..` (`..%2F`, `..\`) is caught. A web address is counted and never fetched. A symbolic link in the folder is never followed, and a link to one is broken ([decision 2](docs/decisions/0002-never-follow-a-link-out-of-the-folder.md)). A superseded record must name its replacement in its status, by a link or by an ADR number such as ADR-0005.

## File names

The default spec is NNNN-title-with-dashes.md, as the MADR page writes it: exactly four digits, a hyphen, then words of lowercase letters a to z and digits joined by hyphens, then `.md`. The spec has five keys: `prefix`, `digits`, `separator`, `lowercase` and `extension`; for Nygard's `adr-NNN.md`, set `{ "prefix": "adr-", "digits": 3 }`. It is read character by character, never as a regular expression. The number of a record, for the duplicate, gap and staleness rules, is the digits after the prefix.

## The configuration file

```json
{
  "name": "Order platform review rules",
  "statuses": { "add": ["draft"] },
  "rules": {
    "staleProposed": { "after": 3, "decided": ["accepted", "rejected"] },
    "duplicateTitle": { "level": "error" }
  },
  "failOn": "warning"
}
```

A configuration changes the defaults entry by entry: layouts and their sections, the status words, the status headings, the placeholders, the ignored files, the file-name spec, the level and the settings of every rule, and the fail level. Lists take `replace`, `add` and `remove`. A key the tool does not know is an error with its line and a suggestion, and a key named twice is refused. [docs/inputs.md](docs/inputs.md) describes every key, and `--print-defaults` writes the whole default configuration out.

## Formats

- `text`: for a terminal: what was read, the counts, the findings with their file, line and column, every record with its layout, status and missing or empty sections, the notes, the notice and the result. With `--explain` also the rule, the reasons, the sentences and the tool's own choice behind each finding.
- `markdown`: the same for a pull request, a ticket or a job summary, with the findings and the records as tables. Pipes, square brackets, backticks, asterisks, underscores, line breaks and angle brackets from the records are escaped, and a cell that starts with `=`, `+`, `-` or `@` gets a leading apostrophe.
- `json`: the whole report: the folder, the configuration, the totals, every record with its sections, every finding with its line and column, the verdict, the notes and the notice.

## Exit codes

`0`: no finding at or above the fail level. `1`: at least one finding at or above it. `2`: a usage or input error: no folder or two, an unknown option, an option given twice, a URL in place of a path, a folder that cannot be read or holds too many entries, a record over its limit, a binary, UTF-16 or invalid UTF-8 record, or a configuration with an unknown key, a key named twice, an alias shared by two sections or an entry removed that is not on its list. With exit code `2` the tool gives no verdict and prints the problems on standard error.

## Limits

The tool reads structure, not meaning: a folder with no finding can still hold poor decisions. A section under a heading none of its aliases knows is reported missing, the last proposed record is never stale, records in subfolders are not read, links that leave the folder and anchors are not checked, and a link is found within one line. [docs/limits.md](docs/limits.md) lists these, with the size limits: 5,000 entries in the folder, 1 MB for a record and 32 MB for all of them, 16 levels of nesting, 500 findings listed per rule. [docs/threat-model.md](docs/threat-model.md) lists the risks of reading records written by many hands and their controls, and [docs/secure-defaults.md](docs/secure-defaults.md) the defaults and how to run the tool in a pipeline.

## Architecture

Plain ES modules in `src/`, with no dependencies.

| File | Job |
| --- | --- |
| `src/cli.js` | the command line, the usage and the exit codes |
| `src/check.js` | lists the folder, reads every record, runs the rules and builds the report |
| `src/files.js` | the one listing of the folder, the bounded reading of the files with no link followed, and the one write of `--out` |
| `src/frontmatter.js` | the front matter of a record, with its lines kept |
| `src/markdown.js` | the block structure of a record: headings, code blocks, block quotes, lists, tables, paragraphs, with lines and columns |
| `src/inline.js`, `src/links.js` | the parts of a line that are not the author's wording, phrases, and links with what each one points at |
| `src/sections.js` | the normal form of a heading, the matching to sections and the detection of the layout |
| `src/names.js` | the file-name spec, the numbers and the titles |
| `src/config.js`, `src/defaults.js` | the configuration file over the defaults, and the default layouts and lists |
| `src/rules.js` | the fourteen rules and the verdict |
| `src/json.js` | the strict JSON reader |
| `src/report.js`, `src/text.js`, `src/size.js` | the reports, the cleaning of text from the input, number formats |
| `src/data.js` | the sentences the tool rests on, compared with the saved pages in `research/sources` |
| `tools/check.mjs`, `tools/example.mjs` | the repository checks, and the examples with their real output |

## Where the facts come from

| Fact | Source |
| --- | --- |
| The parts of a record, numbering, superseded records, proposed and accepted | Documenting Architecture Decisions, by Michael Nygard, on the Cognitect blog (www.cognitect.com); named by its title and host because its address holds a date |
| The MADR headings, the optional parts, the status words, the parts in curly braces | The MADR template, https://raw.githubusercontent.com/adr/madr/develop/template/adr-template.md |
| What MADR is, the file names NNNN-title-with-dashes.md, categories | About MADR, https://adr.github.io/madr/ |
| What an ADR and a decision log are | Architectural Decision Records, https://adr.github.io/ |
| Headings, code blocks, block quotes, links and link reference definitions | CommonMark Spec 0.31.2, https://spec.commonmark.org/0.31.2/ |
| Repeated names in a JSON object | RFC 8259, https://www.rfc-editor.org/rfc/rfc8259 |

## Background

Decision records are where a team keeps the reasons for its architecture, so that the people who join later can follow them. How such reviews and records fit into a wider engagement is described on the page [Software Consulting Services](https://innerluxes.dev/software-development/consulting).

## License

MIT
