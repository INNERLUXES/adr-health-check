// The pages and sentences the tool and its documents rest on. Each sentence comes from a page that is saved in
// research/sources with a first line that says where it comes from, and test/data.test.js compares this file with the
// saved text. Change a sentence here only after saving the new page text and updating docs/rules-and-sources.md. The code
// in src/ uses these constants and never writes a quoted sentence of its own.
//
// The address of the post by Michael Nygard holds the date it was published, and no file of this repository holds a
// date (docs/decisions/0001), so that page is named by its title and its host only: url is null and ref says where it is.

export const SOURCES = [
  { id: 'nygard', file: 'nygard-documenting-architecture-decisions.txt', url: null, ref: 'Documenting Architecture Decisions, by Michael Nygard, on the Cognitect blog at www.cognitect.com', host: 'www.cognitect.com', label: 'Michael Nygard: Documenting Architecture Decisions (Cognitect blog, www.cognitect.com)' },
  { id: 'madr', file: 'madr-about.txt', url: 'https://adr.github.io/madr/', label: 'About MADR: Markdown Architectural Decision Records' },
  { id: 'madrTemplate', file: 'madr-template.txt', url: 'https://raw.githubusercontent.com/adr/madr/develop/template/adr-template.md', label: 'The MADR template file adr-template.md' },
  { id: 'adrHome', file: 'adr-github-io-home.txt', url: 'https://adr.github.io/', label: 'Architectural Decision Records, the home page of the adr organization' },
  { id: 'commonmark', file: 'commonmark-headings-and-blocks.txt', url: 'https://spec.commonmark.org/0.31.2/', label: 'CommonMark Spec 0.31.2: ATX headings, setext headings, indented and fenced code blocks, block quotes' },
  { id: 'commonmarkLinks', file: 'commonmark-links.txt', url: 'https://spec.commonmark.org/0.31.2/#links', label: 'CommonMark Spec 0.31.2: link reference definitions and links' },
  { id: 'rfc8259', file: 'rfc8259-json-objects.txt', url: 'https://www.rfc-editor.org/rfc/rfc8259', label: 'RFC 8259, The JSON Data Interchange Format' }
];

export const source = (id) => SOURCES.find((s) => s.id === id);

// Where a page is: its address, or, for the page whose address holds a date, its title and host.
export const pageOf = (id) => {
  const s = source(id);
  return s.url ?? s.ref;
};

// Sentences quoted in the reports and the documents. Every text is on its saved page word for word (test/data.test.js
// compares them, with runs of white space read as one space), and holds no year.
export const FACTS = {
  nyShortFile: { source: 'nygard', section: 'Decision', text: 'An architecture decision record is a short text file in a format similar to an Alexandrian pattern.' },
  nyNumbered: { source: 'nygard', section: 'Decision', text: 'ADRs will be numbered sequentially and monotonically. Numbers will not be reused.' },
  nySuperseded: { source: 'nygard', section: 'Decision', text: 'If a decision is reversed, we will keep the old one around, but mark it as superseded.' },
  nyFewParts: { source: 'nygard', section: 'Decision', text: 'We will use a format with just a few parts, so each document is easy to digest.' },
  nyTitle: { source: 'nygard', section: 'Decision', text: 'These documents have names that are short noun phrases.' },
  nyContext: { source: 'nygard', section: 'Decision', text: 'This section describes the forces at play, including technological, political, social, and project local.' },
  nyDecision: { source: 'nygard', section: 'Decision', text: 'This section describes our response to these forces.' },
  nyStatus: { source: 'nygard', section: 'Decision', text: 'A decision may be "proposed" if the project stakeholders haven\'t agreed with it yet, or "accepted" once it is agreed.' },
  nyReplacement: { source: 'nygard', section: 'Decision', text: 'If a later ADR changes or reverses a decision, it may be marked as "deprecated" or "superseded" with a reference to its replacement.' },
  nyConsequences: { source: 'nygard', section: 'Decision', text: 'This section describes the resulting context, after applying the decision.' },
  nyUpToDate: { source: 'nygard', section: 'Context', text: 'Documents that assist the team itself can have value, but only if they are kept up to date.' },
  madrStreamlined: { source: 'madr', section: 'Markdown Architectural Decision Records', text: 'MADR is a streamlined template for recording architectural significant decisions in a structured manner.' },
  madrPlaceholders: { source: 'madr', section: 'Example', text: 'The latest release of the full template (with placeholders and some guidance how to use) can be found at the releases page.' },
  madrNext: { source: 'madr', section: 'Manual approach', text: 'Copy docs/decisions/adr-template.md to docs/decisions/NNNN-title-with-dashes.md, where NNNN indicates the next number in sequence.' },
  madrPattern: { source: 'madr', section: 'Manual approach', text: 'The filenames are following the pattern NNNN-title-with-dashes.md (ADR-0005), where' },
  madrConsecutive: { source: 'madr', section: 'Manual approach', text: "NNNN is a consecutive number and we assume that there won't be more than 9,999 ADRs in one repository." },
  madrLowercase: { source: 'madr', section: 'Manual approach', text: 'The title is stored using dashes and lowercase, because [adr-tools] also does that.' },
  madrSuffix: { source: 'madr', section: 'Manual approach', text: 'The suffix is .md, because it is a Markdown file.' },
  madrCategories: { source: 'madr', section: 'Usage of categories', text: 'As a consequence, numbers of ADRs are no longer unique throughout the repository, but locally within a category only.' },
  tplStatus: { source: 'madrTemplate', section: 'These are optional metadata elements.', text: 'status: "{proposed | rejected | accepted | deprecated | ... | superseded by ADR-0123}"' },
  tplOptionalMeta: { source: 'madrTemplate', section: 'These are optional metadata elements.', text: 'These are optional metadata elements. Feel free to remove any of them.' },
  tplOptional: { source: 'madrTemplate', section: 'Decision Drivers', text: 'This is an optional element. Feel free to remove.' },
  tplContext: { source: 'madrTemplate', section: 'Context and Problem Statement', text: '## Context and Problem Statement' },
  tplDrivers: { source: 'madrTemplate', section: 'Decision Drivers', text: '## Decision Drivers' },
  tplOptions: { source: 'madrTemplate', section: 'Considered Options', text: '## Considered Options' },
  tplOutcome: { source: 'madrTemplate', section: 'Decision Outcome', text: '## Decision Outcome' },
  tplConsequences: { source: 'madrTemplate', section: 'Consequences', text: '### Consequences' },
  tplConfirmation: { source: 'madrTemplate', section: 'Confirmation', text: '### Confirmation' },
  tplProsCons: { source: 'madrTemplate', section: 'Pros and Cons of the Options', text: '## Pros and Cons of the Options' },
  tplMore: { source: 'madrTemplate', section: 'More Information', text: '## More Information' },
  tplLinks: { source: 'madrTemplate', section: 'More Information', text: 'Links to other decisions and resources might appear here as well.' },
  homeRecord: { source: 'adrHome', section: 'Motivation and Definitions', text: 'An Architectural Decision Record (ADR) captures a single AD and its rationale;' },
  homeLog: { source: 'adrHome', section: 'Motivation and Definitions', text: 'The collection of ADRs created and maintained in a project constitute its decision log.' },
  atxOpening: { source: 'commonmark', section: '4.2 ATX headings', text: 'The opening sequence of # characters must be followed by spaces or tabs, or by the end of line.' },
  atxLevel: { source: 'commonmark', section: '4.2 ATX headings', text: 'The heading level is equal to the number of # characters in the opening sequence.' },
  setextUnderline: { source: 'commonmark', section: '4.3 Setext headings', text: 'A setext heading underline is a sequence of = characters or a sequence of - characters, with no more than 3 spaces of indentation and any number of trailing spaces or tabs.' },
  fenceLiteral: { source: 'commonmark', section: '4.5 Fenced code blocks', text: 'The content of a code fence is treated as literal text, not parsed as inlines.' },
  linkParts: { source: 'commonmarkLinks', section: '6.3 Links', text: 'A link contains link text (the visible text), a link destination (the URI that is the link destination), and optionally a link title.' },
  linkInline: { source: 'commonmarkLinks', section: '6.3 Links', text: 'An inline link consists of a link text followed immediately by a left parenthesis (, an optional link destination, an optional link title, and a right parenthesis ).' },
  linkPointy: { source: 'commonmarkLinks', section: '6.3 Links', text: 'a sequence of zero or more characters between an opening < and a closing > that contains no line endings or unescaped < or > characters, or' },
  linkDefinitions: { source: 'commonmarkLinks', section: '4.7 Link reference definitions', text: 'Link reference definitions can come either before or after the links that use them.' },
  jsonUnpredictable: { source: 'rfc8259', section: '4. Objects', text: 'When the names within an object are not unique, the behavior of software that receives such an object is unpredictable.' }
};

// The page of a quoted sentence.
export const factPage = (key) => pageOf(FACTS[key].source);

// The levels of a finding, from the lowest. A finding fails the run when its level is the fail level or above.
export const LEVELS = ['notice', 'warning', 'error'];

// The levels of a section of a layout. An optional section is never reported missing, but it counts when the layout of
// a record is detected and is checked for text like any other.
export const SECTION_LEVELS = ['required', 'recommended', 'optional', 'off'];

// The sentence every report ends with, before the result.
export const NOTICE = 'This report checks the structure of the records, their status, their numbers, their names and their links only. It does not judge whether a decision is right.';
