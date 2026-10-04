# Inputs

The tool reads two inputs: the folder of records named on the command line, and an optional configuration file given with `--config`. This document describes both.

## The folder of records

Give the folder that holds the records, such as `docs/decisions` or `doc/adr`. The tool lists it once and reads the records directly in it ([method.md](method.md#which-files-are-read)): every regular file whose name ends with the extension of the file-name spec, other than the files on the list `ignoreFiles`. Subfolders are not read, and symbolic links are not followed ([decision 2](decisions/0002-never-follow-a-link-out-of-the-folder.md)). To check the categories of a large MADR project, which keeps records in subfolders, run the tool once for each subfolder; the MADR page says of such a layout that "numbers of ADRs are no longer unique throughout the repository, but locally within a category only."

Each record is UTF-8 text in Markdown, in Michael Nygard's format, in MADR, or in a layout of your own that the configuration adds. A record may start with front matter.

A record in Nygard's format:

```markdown
# 2. Use a message queue for orders

## Status

Accepted

## Context

Orders reach the warehouse through a nightly batch file.

## Decision

We will send each order through a message queue as soon as it is paid.

## Consequences

The warehouse sees orders within minutes, and the team runs one more system.
```

A record in MADR:

```markdown
---
status: superseded by ADR-0004
---

# Publish tracking events through a queue

## Context and Problem Statement

How do events leave the service?

## Considered Options

* A queue after the commit
* Polling

## Decision Outcome

Chosen option: "A queue after the commit", because shops get events within seconds.

### Consequences

* Bad, because an event is lost when the service stops before the write.
```

## The configuration file

Without a configuration file, the defaults apply. `--print-defaults` prints them as a configuration file, with `"useDefaultLayouts": false` so the file stands on its own. A configuration file changes the defaults entry by entry: a key that is not given keeps its default.

The file is JSON, read with a strict reader: no comments, no trailing comma, no key named twice in one object. RFC 8259 says: "When the names within an object are not unique, the behavior of software that receives such an object is unpredictable." Every key the tool does not know is an error with its line and the nearest known key, so a typo cannot leave a default in place unnoticed.

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

### Top-level keys

| Key | Value | Default |
| --- | --- | --- |
| `name` | a name for the configuration, shown in the report | none |
| `layout` | `detect`, or the id of a layout to read every record as | `detect` |
| `useDefaultLayouts` | `false` to start from no layout, so `layouts` holds the whole set | `true` |
| `layouts` | an object from the id of a layout to its keys (below) | Nygard and MADR |
| `statusHeadings` | a list (below) of the headings of the status section | `Status` |
| `statuses` | a list of status words: lowercase letters a to z and hyphens | proposed, accepted, rejected, deprecated, superseded |
| `placeholders` | a list of placeholder phrases | TBD, TBA, TODO, FIXME, to be decided, to be determined, to be defined, to be confirmed, to be written, lorem ipsum |
| `templateBraces` | `false` to not read text in curly braces as a placeholder | `true` |
| `ignoreFiles` | a list of file names in the folder that are not records, compared without case | README.md, index.md, template.md, adr-template.md |
| `fileName` | the spec of a file name (below) | NNNN-title-with-dashes.md |
| `rules` | the levels and the settings of the rules (below) | see below |
| `failOn` | the lowest level that fails the run: `notice`, `warning` or `error` | `warning` |

### Lists

`statusHeadings`, `statuses`, `placeholders` and `ignoreFiles` are each an object with up to three keys, applied in this order:

- `statusHeadings.replace`, `statuses.replace`, `placeholders.replace`, `ignoreFiles.replace`: a list that replaces the default list;
- `statusHeadings.add`, `statuses.add`, `placeholders.add`, `ignoreFiles.add`: entries to add; an entry that is already there is an error;
- `statusHeadings.remove`, `statuses.remove`, `placeholders.remove`, `ignoreFiles.remove`: entries to take out; an entry that is not there is an error.

Entries are compared without case and with runs of spaces read as one. An empty list of statuses or of status headings is refused. A list holds at most 500 entries of at most 120 characters each.

### Layouts

`layouts` maps the id of a layout (a letter followed by letters and digits, at most 40 characters) to its keys. An id that is a default layout (`nygard`, `madr`) changes it; any other id adds a layout, which needs `title` and `sections`.

| Key | Value |
| --- | --- |
| `title` | the name of the layout in reports |
| `requireStatus` | `true` when a record of this layout must have a status (`missing-status`); `true` for Nygard and `false` for MADR by default |
| `sections` | an object from the id of a section to its keys (below) |

The sections of a layout: an id that is already a section of the layout changes it; any other id adds a section, which needs `title`, `aliases` and `level`.

| Key | Value |
| --- | --- |
| `title` | the name of the section in reports |
| `aliases` | a list of headings that match the section; a heading matches when it is the alias once numbering, case, markup and punctuation are left out ([method.md](method.md#matching-a-heading-to-a-section-and-finding-the-layout)) |
| `level` | `required` (missing is a finding at `rules.missingSection.required`), `recommended` (at `rules.missingSection.recommended`), `optional` (never reported missing, but counts for the layout and is checked for text) or `off` (not looked at) |

An alias shared by two sections of one layout, an alias that is also a status heading, an alias with no letter or digit, a set with no layout that has a section other than off, and a `layout` that names no such layout are refused. At most 20 layouts and 100 sections each.

```json
{
  "layouts": {
    "nygard": { "sections": { "decision": { "aliases": ["Decision", "Resolution"] } } },
    "madr": {
      "requireStatus": true,
      "sections": { "confirmation": { "level": "recommended" } }
    }
  }
}
```

### File name

| Key | Value | Default |
| --- | --- | --- |
| `fileName.prefix` | a fixed start of every name: at most 20 letters, hyphens or underscores, or empty | empty |
| `fileName.digits` | the exact number of digits of the number, 1 to 9 | `4` |
| `fileName.separator` | `-`, `_` or `.` | `-` |
| `fileName.lowercase` | `true` when the words after the number are lowercase only | `true` |
| `fileName.extension` | a dot followed by 1 to 10 letters or digits; the files with it are the records | `.md` |

Nygard's post keeps records as `doc/arch/adr-NNN.md`; for names such as `adr-001-deploy-on-rails.md`, set `{ "prefix": "adr-", "digits": 3 }`. There is no key for a regular expression: the spec is read character by character.

### Rules

Every rule has a `level`: `notice`, `warning`, `error`, or `off` to not run it. `missingSection` has two levels instead.

| Key | Settings | Default |
| --- | --- | --- |
| `rules.missingTitle` | `rules.missingTitle.level` | `error` |
| `rules.unknownLayout` | `rules.unknownLayout.level` | `error` |
| `rules.missingSection` | `rules.missingSection.required`, `rules.missingSection.recommended` | `error`, `notice` |
| `rules.emptySection` | `rules.emptySection.level` | `warning` |
| `rules.placeholder` | `rules.placeholder.level` | `warning` |
| `rules.missingStatus` | `rules.missingStatus.level` | `error` |
| `rules.unknownStatus` | `rules.unknownStatus.level` | `error` |
| `rules.staleProposed` | `rules.staleProposed.level`; `rules.staleProposed.after`, the number of later decided records that makes a pending record stale, 1 to 100,000; `rules.staleProposed.pending`, the pending status word; `rules.staleProposed.decided`, the decided status words | `warning`, `3`, `proposed`, `accepted` |
| `rules.supersededLink` | `rules.supersededLink.level`; `rules.supersededLink.statuses`, the status words that must name their replacement | `error`, `superseded` |
| `rules.brokenLink` | `rules.brokenLink.level` | `error` |
| `rules.duplicateNumber` | `rules.duplicateNumber.level` | `error` |
| `rules.duplicateTitle` | `rules.duplicateTitle.level` | `warning` |
| `rules.numberingGap` | `rules.numberingGap.level` | `notice` |
| `rules.fileName` | `rules.fileName.level` | `warning` |

The status words that `staleProposed` and `supersededLink` name must be status words of the configuration, and `pending` may not also be `decided`; a rule that is off is not held to this.
