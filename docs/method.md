# Method

This document says exactly how the tool goes from a folder of Markdown files to the findings: which files are read, how a record is read, how its layout, its title, its status and its links are found, what each rule reports, and what each rule can and cannot see. Where the tool makes its own choice, it says so and says why. The sentences quoted here are on the pages saved in `research/sources`; [rules-and-sources.md](rules-and-sources.md) lists them.

## What the check rests on

The home page of the adr organization says: "An Architectural Decision Record (ADR) captures a single AD and its rationale;" and "The collection of ADRs created and maintained in a project constitute its decision log." The tool checks that log as a whole and each record in it.

Two formats are common. Michael Nygard's post, Documenting Architecture Decisions, describes the original one: "We will use a format with just a few parts, so each document is easy to digest." The parts are a title, the context, the decision, the status and the consequences. MADR, the Markdown Architectural Decision Records, is described on its page as follows: "MADR is a streamlined template for recording architectural significant decisions in a structured manner." Its template has the headings Context and Problem Statement, Decision Drivers, Considered Options, Decision Outcome, Consequences, Confirmation, Pros and Cons of the Options and More Information, and marks several of them as optional.

On numbers, Nygard writes: "ADRs will be numbered sequentially and monotonically. Numbers will not be reused." The MADR page gives the file names: "The filenames are following the pattern NNNN-title-with-dashes.md (ADR-0005), where" the number is consecutive and "The title is stored using dashes and lowercase, because [adr-tools] also does that."

## Which files are read

The folder named on the command line is listed once ([decision 2](decisions/0002-never-follow-a-link-out-of-the-folder.md)):

- A regular file whose name ends with the extension of the file-name spec (`.md` by default), compared without case, is a record, unless its name is on the list `ignoreFiles` (by default `README.md`, `index.md`, `template.md` and `adr-template.md`, compared without case). The ignored files are named in a note.
- Every other regular file is not read, but its name counts when a link is resolved, so a link to an image in the folder resolves.
- A symbolic link is never followed. A subfolder is not read. A device, a pipe or a socket is passed over. Each is named in a note.
- A record is opened once, with `O_NOFOLLOW` where the system has it, and its type and size are taken from the open handle. A record over 1 MB, records over 32 MB together, more than 5,000 entries in the folder, a file that holds a null byte, a UTF-16 file and bytes that are not UTF-8 stop the run with exit code `2` and no verdict.

The records are taken in the order of their names by their code units, so the order does not depend on the locale or the file system. The number of a record is read from its file name: the digits right after the prefix of the spec (compared without case), or right at the start of the name, at most nine of them. A record with no number takes no part in the numbered sequence.

## Reading a record

A byte order mark at the start is left out. A line ends at LF, CR LF or a lone CR, so the three give the same report.

**Front matter.** When the first line is `---` and a line `---` or `...` closes it within 200 lines, the lines between are front matter, as the MADR template writes its optional metadata. Only flat `key: value` lines are read; keys are compared in lower case; a value in single or double quotes loses its quotes, and a plain value ends before ` #`. The lines of the front matter are blanked before the Markdown is read, with their line ends kept, so every line and column of the rest of the record is the line and column of the file. The tool reads the keys `status` and `title` and nothing else; a date in the front matter is not read ([decision 1](decisions/0001-read-no-clock-and-keep-dates-out-of-the-repository.md)).

**Markdown.** The reader finds the blocks of a subset of CommonMark: ATX and setext headings, thematic breaks, indented and fenced code blocks, HTML comments, block quotes, lists and paragraphs, and the tables of GitHub Flavored Markdown. CommonMark: "The heading level is equal to the number of # characters in the opening sequence." and "The content of a code fence is treated as literal text, not parsed as inlines.", so a `#` line inside a code block is never a heading, and a link inside one is never checked. Only headings outside lists and block quotes make sections. The text inside a block quote is kept, marked as quoted: its links are checked, its words are not read for placeholders, because a block quote is most often a quotation of another document. Nesting stops at 16 levels of lists and block quotes; the deeper text is read as plain paragraphs, and a note says from which line. A code fence that is never closed makes the rest of its container code, and a note says so.

## The title

The title of a record is its first heading when that heading is a level 1 heading, else the `title` key of its front matter. Nygard: "These documents have names that are short noun phrases."

## Matching a heading to a section, and finding the layout

Each layout has sections, each with a title, a level (`required`, `recommended`, `optional` or `off`) and aliases. A heading and an alias are put in one normal form: the numbering at the start of the heading is left out (`4.2`, `1.`, `A)`, `Section 3:`), markup characters are read as spaces, `&` is read as `and`, letters are put in lower case, and every run of characters that are not letters or digits is read as one space.

A heading matches a section when its normal form is the normal form of one of the aliases: the whole heading, not a part of it. So `Decision Outcome` is the MADR section and not Nygard's `Decision`, and `Context and Problem Statement` is not `Context`. The configuration refuses an alias that two sections of one layout share, or that is also a heading of the status section.

The headings of the status section (`Status` by default) are left out of the layout. The layout of a record is found from its other headings, the title left out:

1. For each layout, count the sections other than those that are off that at least one heading matches. A section is counted once, however many headings match it.
2. The layout with the highest count is the layout of the record.
3. On a tie, the layout that comes first in the configuration wins (Nygard, then MADR, by default), and a note names the record and the layouts of the tie.
4. When every count is 0, the record has no layout: `unknown-layout` reports it, and its sections are not checked.

With `"layout": "madr"` (or the id of any layout) in the configuration, every record is read as that layout, and `unknown-layout` is not run.

A section is **found** when at least one heading matches it and holds text, **empty** when every heading that matches it holds no text or nothing but placeholders, and **missing** when no heading matches it.

## The status

The status of a record is read from the first of these places that has one:

1. the `status` key of the front matter, as MADR writes it;
2. the first paragraph, list item or table row under a heading of the status section, as Nygard writes it; a status heading with nothing under it gives no status;
3. a line that starts with `Status:` (with any `*` or `_` around the word, as in `* **Status**: accepted`) before the first heading other than the title, as older MADR versions write it.

The status word is the first word of the status text, after any markup, quote or bracket, in lower case for the letters A to Z: `Superseded by [ADR 4](0004-x.md)` gives `superseded`, `**Accepted** after review` gives `accepted`. The status words are configured (`statuses`); by default they are the five of the MADR template's status line, which are also the words of Nygard's post.

## The links

Links are found in every piece of text of a record outside code: headings, paragraphs, list items, table cells and block quotes. Three kinds are read, each within one line, outside code spans: inline links `[text](destination)`, images `![alt](destination)`, and link reference definitions `[label]: destination`. CommonMark: "An inline link consists of a link text followed immediately by a left parenthesis (, an optional link destination, an optional link title, and a right parenthesis )." A destination in angle brackets is read to the closing `>`. Where the reader is simpler than CommonMark: any other destination ends at the first `)` or the first space, so a destination with parentheses inside it is cut at the first `)`; a link that runs over two lines is not found; a destination longer than 4,000 characters is not read. Every search runs once over the line, with positions that only move forward.

A destination is then classified as text, with nothing opened:

- with a scheme (`https:`, `mailto:`, `file:`) or starting with `//`: a web address, never fetched, counted;
- starting with `#`: a place in the same record, not checked;
- starting with `/` or `\`, or a drive such as `C:/`: an absolute path, not followed;
- otherwise the part after `#` (the anchor) and after `?` is left out, backslash escapes and percent escapes are read, and the path is resolved with a backslash read as a separator: a path that leaves the folder through `..` is not followed; a path into a subfolder is not followed; a path to the folder itself is not followed; a single name is a file of this folder, and is checked.

Every link that is not followed is counted in a note with the first three of them, with their file and line.

## The rules

### `missing-title`

A record whose first heading is not a level 1 heading and whose front matter has no `title`. The finding points at the first heading, or at the file when there is none.

### `unknown-layout`

A record in which no heading other than the title and the status headings matches a section of any layout. Its sections are not checked; its title, status, links, number and file name still are. Not run when the configuration sets a layout for every record.

### `missing-section`

A section of the layout of a record that is missing: at level `error` for a `required` section and `notice` for a `recommended` one, by default. An `optional` section is never reported missing, and a section that is `off` is not looked at. A section that is there but empty is reported by `empty-section`, not here.

### `empty-section`

A heading other than the title under which, down to the next heading at its level or above, there is no paragraph, list, table, code block or block quote, or where every piece of text is nothing but placeholders once the placeholders are taken out. A heading with headings under it is reported through them: when its subheadings hold text, it is not empty. Every heading is checked, not only the headings of the layout. A placeholder inside an empty section is reported once, through the section.

### `placeholder`

A phrase of the list `placeholders` (`TBD`, `TBA`, `TODO`, `FIXME`, `to be decided`, `to be determined`, `to be defined`, `to be confirmed`, `to be written`, `lorem ipsum`), or text in curly braces that holds a letter or a digit, as the MADR template writes the parts to fill in (`{short title, representative of solved problem and found solution}`). A phrase written in capitals is found with case, so `todo lists` is not a placeholder; a phrase is found only where it starts and ends a word, so `TBDs` is not one either. Code spans, text in double quotes, link destinations, HTML tags and block quotes are never read. With `"templateBraces": false`, curly braces are not read.

### `missing-status`

A record of a layout that needs a status (`requireStatus`: Nygard by default) with no status in any of the three places. The MADR template marks its status as optional metadata, so a MADR record with no status is not reported unless `requireStatus` is set for MADR.

### `unknown-status`

A status whose first word is not one of the status words, a status with no word at all (such as the template's `{proposed | rejected | ...}`), or a `status` key given more than once in the front matter, because then which one holds cannot be told.

### `stale-proposed`

The tool reads no clock and no date. A record numbered n was written before every record with a greater number, so the place of a record in the numbered sequence measures how long its decision has waited. Exactly:

1. Take the records that have a number, in the order of their numbers.
2. A record is pending when its status word is `rules.staleProposed.pending` (`proposed`).
3. For a pending record numbered n, count the records with a number strictly greater than n whose status word is one of `rules.staleProposed.decided` (`accepted`). Records with the same number n do not count, and neither do records with no number.
4. When the count is at least `rules.staleProposed.after` (3), the record is stale. The finding names the first three of the later decided records and the count.

A proposed record that is the last in the folder, or that has only two accepted records after it, is not stale. The limit and the words are the configuration's to change: add `rejected` to `decided` to count every later decision.

### `superseded-link`

A record whose status word is one of `rules.supersededLink.statuses` (`superseded`) and whose status names no other record of the folder. The status names a record when it holds a relative link to a record file of the folder other than itself, or an ADR number such as `ADR-0005`, `ADR 5` or `ADR5` that is the number of a record of the folder other than itself. Every paragraph under the status heading is read, and so is the front matter value. Nygard: "If a decision is reversed, we will keep the old one around, but mark it as superseded." Add `deprecated` to the statuses to hold deprecated records to the same rule.

### `broken-link`

A link whose destination is a single name in the folder (see [The links](#the-links)) when no regular file of the folder has that name. The finding gives the line and the column of the destination, and says when the folder holds a name that differs only in case, or when the name is a symbolic link, which is never followed. A link to a subfolder by its name is not followed. The anchor after `#` is not checked.

### `duplicate-number`

Two or more records whose file names give the same number. One finding for each number, at the second record.

### `duplicate-title`

Two or more records whose titles are the same once a leading `ADR 9:`, `ADR-0009 -` or `9.` is left out, case is ignored and every run of characters that are not letters or digits is read as one space.

### `numbering-gap`

A run of whole numbers between the lowest and the highest record number that no record has, at level `notice`. One finding for each run. Numbers below the lowest number are not looked at, so a folder that starts at 3 has no gap before it.

### `file-name`

A record whose file name does not follow the spec: the prefix (empty by default), exactly `digits` digits (4), the separator (`-`), then words of the letters a to z (lowercase only when `lowercase` is true) and digits joined by the separator, then the extension (`.md`), compared with case. The spec is read character by character; it is not a regular expression, and the configuration cannot give one. The first reason found is given: no number, a number of another length, a missing separator, two separators in a row, an upper-case letter, another character, another extension.

## Levels, order and verdict

Every finding has a level: `notice`, `warning` or `error`, set per rule in the configuration, or `off` to not run the rule. The run fails when a finding is at the fail level (`warning` by default, `failOn` in the configuration, `--fail-on` on the command line) or above. Findings are listed by level, then by file name by code units, then by line and column, then in the order of the rules. A rule lists at most 500 findings; the rest are counted in a note.
