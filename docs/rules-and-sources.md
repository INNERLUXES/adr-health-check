# Rules and sources

Every sentence the tool quotes, in a report or in these documents, comes from a page that was opened and saved as plain text in `research/sources`, with a first line that says where it comes from. `src/data.js` holds the sentences, and `test/data.test.js` compares each one with the saved page, word for word, with runs of white space read as one space. It also checks that every sentence these documents put in double quotes is on a saved page.

## The saved pages

| File | Page | What is saved |
| --- | --- | --- |
| `nygard-documenting-architecture-decisions.txt` | Documenting Architecture Decisions, by Michael Nygard, on the Cognitect blog at www.cognitect.com | the text of the post: its context, the decision with the five parts of the format, its status, its consequences and the experience report |
| `madr-about.txt` | About MADR, https://adr.github.io/madr/ | the home page of the MADR project: what MADR is, the example, how to create a new record with the file-name pattern, categories and the licence |
| `madr-template.txt` | The MADR template file, https://raw.githubusercontent.com/adr/madr/develop/template/adr-template.md | the whole template, with its front matter, its headings and its parts in curly braces |
| `adr-github-io-home.txt` | Architectural Decision Records, https://adr.github.io/ | the definitions of an architectural decision, a record and a decision log, and the list of background information |
| `commonmark-headings-and-blocks.txt` | CommonMark Spec 0.31.2, https://spec.commonmark.org/0.31.2/ | the prose of sections 4.2 ATX headings, 4.3 Setext headings, 4.4 Indented code blocks, 4.5 Fenced code blocks and 5.1 Block quotes, without the numbered examples |
| `commonmark-links.txt` | CommonMark Spec 0.31.2, https://spec.commonmark.org/0.31.2/#links | the opening prose of sections 4.7 Link reference definitions and 6.3 Links, without the numbered examples |
| `rfc8259-json-objects.txt` | RFC 8259, The JSON Data Interchange Format, https://www.rfc-editor.org/rfc/rfc8259 | section 4, objects and repeated names |

Notes on the pages:

- **The post of Michael Nygard is named by its title and its host only.** Its address on www.cognitect.com holds the date it was published, as numbers in the path, and no file of this repository holds a date or a number that reads like a year ([decision 1](decisions/0001-read-no-clock-and-keep-dates-out-of-the-repository.md)). `npm run check` would refuse the address. So the first line of the saved page, `src/data.js` and the reports name the post by its title and host: search the Cognitect blog for its title, Documenting Architecture Decisions, to find it. The date under the title is cut from the saved page and marked `[...]`. The page says that its publisher "has waived all copyright and related or neighboring rights to" the post.
- **The MADR pages.** The News section of the About page is a list of dated releases and articles, and the section that renders the full template repeats `madr-template.txt`; both are cut and marked `[...]`. The template is saved from the development branch that the About page points to; the same file was found on the main branch.
- **The home page of the adr organization.** The dated list of articles is cut, and three years inside the list of background information are marked `[...]`.
- **The two CommonMark files** are saved as prose. The numbered examples hold Markdown and HTML that the tests of this repository cover in their own way.
- Typographic quotes, apostrophes, dashes and the ellipsis are saved as their nearest ASCII characters; the first lines of each saved page say so.

## The rules

| Rule | Key | Sentences | Method |
| --- | --- | --- | --- |
| `missing-title` | `rules.missingTitle` | `nyTitle` | [missing-title](method.md#missing-title) |
| `unknown-layout` | `rules.unknownLayout` | `nyFewParts`, `madrStreamlined` | [unknown-layout](method.md#unknown-layout) |
| `missing-section` | `rules.missingSection` | `nyFewParts`, `madrStreamlined` | [missing-section](method.md#missing-section) |
| `empty-section` | `rules.emptySection` | `nyUpToDate` | [empty-section](method.md#empty-section) |
| `placeholder` | `rules.placeholder` | `madrPlaceholders` | [placeholder](method.md#placeholder) |
| `missing-status` | `rules.missingStatus` | `nyStatus` | [missing-status](method.md#missing-status) |
| `unknown-status` | `rules.unknownStatus` | `nyStatus`, `tplStatus` | [unknown-status](method.md#unknown-status) |
| `stale-proposed` | `rules.staleProposed` | `nyStatus`, `nyNumbered` | [stale-proposed](method.md#stale-proposed) |
| `superseded-link` | `rules.supersededLink` | `nyReplacement`, `nySuperseded` | [superseded-link](method.md#superseded-link) |
| `broken-link` | `rules.brokenLink` | `tplLinks`, `linkInline` | [broken-link](method.md#broken-link) |
| `duplicate-number` | `rules.duplicateNumber` | `nyNumbered`, `madrConsecutive` | [duplicate-number](method.md#duplicate-number) |
| `duplicate-title` | `rules.duplicateTitle` | `nyTitle` | [duplicate-title](method.md#duplicate-title) |
| `numbering-gap` | `rules.numberingGap` | `nyNumbered`, `madrNext` | [numbering-gap](method.md#numbering-gap) |
| `file-name` | `rules.fileName` | `madrPattern`, `madrLowercase` | [file-name](method.md#file-name) |

`--explain` prints the sentences of each rule under its findings, with the section and the page. The sentences say why a rule is worth running; none of the pages defines the rule itself. Where a rule rests on a choice of the tool, `--explain` says so after the sentences:

- `unknown-layout`: a record must match at least one section of a layout before its sections can be checked.
- `empty-section`: a heading with nothing under it says that a part of the record was never written.
- `placeholder`: the list of placeholders is the tool's own. Text in curly braces counts because the MADR template writes the parts to fill in that way, and its About page calls the template the one "with placeholders and some guidance how to use".
- `stale-proposed`: the number of later decided records that makes a pending record stale (three) is the tool's own. The tool reads no clock and no date, so the place of a record in the numbered sequence is the only measure of its age.
- `duplicate-title`: two records with one title make a link or a mention by title ambiguous.

## The default layouts

Where each section of the two default layouts comes from. Nygard's post lists the parts of his format (Title, Context, Decision, Status, Consequences); the title and the status are read by their own rules, so the layout holds three sections. The MADR template marks some of its parts as optional with a comment; the tool gives those parts the level `optional`, so they count when a layout is detected and are checked for text, but are never reported missing. Consequences, which the template marks optional too, is `recommended`, so a missing one is a notice.

| Section | Title | Level | Sentences |
| --- | --- | --- | --- |
| `nygard.context` | Context | required | `nyContext` |
| `nygard.decision` | Decision | required | `nyDecision` |
| `nygard.consequences` | Consequences | required | `nyConsequences` |
| `madr.contextAndProblem` | Context and Problem Statement | required | `tplContext` |
| `madr.decisionDrivers` | Decision Drivers | optional | `tplDrivers`, `tplOptional` |
| `madr.consideredOptions` | Considered Options | required | `tplOptions` |
| `madr.decisionOutcome` | Decision Outcome | required | `tplOutcome` |
| `madr.consequences` | Consequences | recommended | `tplConsequences`, `tplOptional` |
| `madr.confirmation` | Confirmation | optional | `tplConfirmation`, `tplOptional` |
| `madr.prosAndCons` | Pros and Cons of the Options | optional | `tplProsCons`, `tplOptional` |
| `madr.moreInformation` | More Information | optional | `tplMore`, `tplOptional` |

The status words (proposed, accepted, rejected, deprecated, superseded) are the words of the MADR template's status line, `tplStatus`, and the words of Nygard's status part, `nyStatus` and `nyReplacement`.

## Every quoted sentence

| Key | Used by | Page | Section | Sentence |
| --- | --- | --- | --- | --- |
| `nyShortFile` | the documents | nygard-documenting-architecture-decisions.txt | Decision | An architecture decision record is a short text file in a format similar to an Alexandrian pattern. |
| `nyNumbered` | `stale-proposed`, `duplicate-number`, `numbering-gap` | nygard-documenting-architecture-decisions.txt | Decision | ADRs will be numbered sequentially and monotonically. Numbers will not be reused. |
| `nySuperseded` | `superseded-link` | nygard-documenting-architecture-decisions.txt | Decision | If a decision is reversed, we will keep the old one around, but mark it as superseded. |
| `nyFewParts` | `unknown-layout`, `missing-section`, layout `nygard` | nygard-documenting-architecture-decisions.txt | Decision | We will use a format with just a few parts, so each document is easy to digest. |
| `nyTitle` | `missing-title`, `duplicate-title` | nygard-documenting-architecture-decisions.txt | Decision | These documents have names that are short noun phrases. |
| `nyContext` | `nygard.context` | nygard-documenting-architecture-decisions.txt | Decision | This section describes the forces at play, including technological, political, social, and project local. |
| `nyDecision` | `nygard.decision` | nygard-documenting-architecture-decisions.txt | Decision | This section describes our response to these forces. |
| `nyStatus` | `missing-status`, `unknown-status`, `stale-proposed` | nygard-documenting-architecture-decisions.txt | Decision | A decision may be "proposed" if the project stakeholders haven't agreed with it yet, or "accepted" once it is agreed. |
| `nyReplacement` | `superseded-link` | nygard-documenting-architecture-decisions.txt | Decision | If a later ADR changes or reverses a decision, it may be marked as "deprecated" or "superseded" with a reference to its replacement. |
| `nyConsequences` | `nygard.consequences` | nygard-documenting-architecture-decisions.txt | Decision | This section describes the resulting context, after applying the decision. |
| `nyUpToDate` | `empty-section` | nygard-documenting-architecture-decisions.txt | Context | Documents that assist the team itself can have value, but only if they are kept up to date. |
| `madrStreamlined` | `unknown-layout`, `missing-section`, layout `madr` | madr-about.txt | Markdown Architectural Decision Records | MADR is a streamlined template for recording architectural significant decisions in a structured manner. |
| `madrPlaceholders` | `placeholder` | madr-about.txt | Example | The latest release of the full template (with placeholders and some guidance how to use) can be found at the releases page. |
| `madrNext` | `numbering-gap` | madr-about.txt | Manual approach | Copy docs/decisions/adr-template.md to docs/decisions/NNNN-title-with-dashes.md, where NNNN indicates the next number in sequence. |
| `madrPattern` | `file-name` | madr-about.txt | Manual approach | The filenames are following the pattern NNNN-title-with-dashes.md (ADR-0005), where |
| `madrConsecutive` | `duplicate-number` | madr-about.txt | Manual approach | NNNN is a consecutive number and we assume that there won't be more than 9,999 ADRs in one repository. |
| `madrLowercase` | `file-name` | madr-about.txt | Manual approach | The title is stored using dashes and lowercase, because [adr-tools] also does that. |
| `madrSuffix` | the documents | madr-about.txt | Manual approach | The suffix is .md, because it is a Markdown file. |
| `madrCategories` | the documents | madr-about.txt | Usage of categories | As a consequence, numbers of ADRs are no longer unique throughout the repository, but locally within a category only. |
| `tplStatus` | `unknown-status` | madr-template.txt | These are optional metadata elements. | `status: "{proposed \| rejected \| accepted \| deprecated \| ... \| superseded by ADR-0123}"` |
| `tplOptionalMeta` | layout `madr` | madr-template.txt | These are optional metadata elements. | These are optional metadata elements. Feel free to remove any of them. |
| `tplOptional` | `madr.decisionDrivers`, `madr.consequences`, `madr.confirmation`, `madr.prosAndCons`, `madr.moreInformation` | madr-template.txt | Decision Drivers | This is an optional element. Feel free to remove. |
| `tplContext` | `madr.contextAndProblem` | madr-template.txt | Context and Problem Statement | ## Context and Problem Statement |
| `tplDrivers` | `madr.decisionDrivers` | madr-template.txt | Decision Drivers | ## Decision Drivers |
| `tplOptions` | `madr.consideredOptions` | madr-template.txt | Considered Options | ## Considered Options |
| `tplOutcome` | `madr.decisionOutcome` | madr-template.txt | Decision Outcome | ## Decision Outcome |
| `tplConsequences` | `madr.consequences` | madr-template.txt | Consequences | ### Consequences |
| `tplConfirmation` | `madr.confirmation` | madr-template.txt | Confirmation | ### Confirmation |
| `tplProsCons` | `madr.prosAndCons` | madr-template.txt | Pros and Cons of the Options | ## Pros and Cons of the Options |
| `tplMore` | `madr.moreInformation` | madr-template.txt | More Information | ## More Information |
| `tplLinks` | `broken-link` | madr-template.txt | More Information | Links to other decisions and resources might appear here as well. |
| `homeRecord` | the documents | adr-github-io-home.txt | Motivation and Definitions | An Architectural Decision Record (ADR) captures a single AD and its rationale; |
| `homeLog` | the documents | adr-github-io-home.txt | Motivation and Definitions | The collection of ADRs created and maintained in a project constitute its decision log. |
| `atxOpening` | the documents | commonmark-headings-and-blocks.txt | 4.2 ATX headings | The opening sequence of # characters must be followed by spaces or tabs, or by the end of line. |
| `atxLevel` | the documents | commonmark-headings-and-blocks.txt | 4.2 ATX headings | The heading level is equal to the number of # characters in the opening sequence. |
| `setextUnderline` | the documents | commonmark-headings-and-blocks.txt | 4.3 Setext headings | A setext heading underline is a sequence of = characters or a sequence of - characters, with no more than 3 spaces of indentation and any number of trailing spaces or tabs. |
| `fenceLiteral` | the documents | commonmark-headings-and-blocks.txt | 4.5 Fenced code blocks | The content of a code fence is treated as literal text, not parsed as inlines. |
| `linkParts` | the documents | commonmark-links.txt | 6.3 Links | A link contains link text (the visible text), a link destination (the URI that is the link destination), and optionally a link title. |
| `linkInline` | `broken-link` | commonmark-links.txt | 6.3 Links | An inline link consists of a link text followed immediately by a left parenthesis (, an optional link destination, an optional link title, and a right parenthesis ). |
| `linkPointy` | the documents | commonmark-links.txt | 6.3 Links | a sequence of zero or more characters between an opening < and a closing > that contains no line endings or unescaped < or > characters, or |
| `linkDefinitions` | the documents | commonmark-links.txt | 4.7 Link reference definitions | Link reference definitions can come either before or after the links that use them. |
| `jsonUnpredictable` | the documents | rfc8259-json-objects.txt | 4. Objects | When the names within an object are not unique, the behavior of software that receives such an object is unpredictable. |
