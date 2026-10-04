// The built-in configuration: the two layouts the tool knows, the status words, the placeholders, the file-name spec,
// the files of a folder that are not records, and the level of every rule. Each layout section names the sentences of
// the saved pages it comes from (keys of FACTS in src/data.js). docs/inputs.md describes every key, and --print-defaults
// writes all of this out as a configuration file.

// Michael Nygard's format: a title, then Status, Context, Decision and Consequences. The status is read by the status
// rules, so it is not a section here; requireStatus makes a record of this layout with no status a finding.
// MADR: Context and Problem Statement, Considered Options and Decision Outcome, with optional parts; the template marks
// Decision Drivers, Consequences, Confirmation, Pros and Cons of the Options and More Information as optional, and its
// status is optional metadata.
export const DEFAULT_LAYOUTS = [
  {
    id: 'nygard',
    title: 'Nygard',
    requireStatus: true,
    basis: ['nyFewParts'],
    sections: [
      { id: 'context', title: 'Context', aliases: ['Context'], level: 'required', basis: ['nyContext'] },
      { id: 'decision', title: 'Decision', aliases: ['Decision'], level: 'required', basis: ['nyDecision'] },
      { id: 'consequences', title: 'Consequences', aliases: ['Consequences'], level: 'required', basis: ['nyConsequences'] }
    ]
  },
  {
    id: 'madr',
    title: 'MADR',
    requireStatus: false,
    basis: ['madrStreamlined', 'tplOptionalMeta'],
    sections: [
      { id: 'contextAndProblem', title: 'Context and Problem Statement', aliases: ['Context and Problem Statement'], level: 'required', basis: ['tplContext'] },
      { id: 'decisionDrivers', title: 'Decision Drivers', aliases: ['Decision Drivers'], level: 'optional', basis: ['tplDrivers', 'tplOptional'] },
      { id: 'consideredOptions', title: 'Considered Options', aliases: ['Considered Options'], level: 'required', basis: ['tplOptions'] },
      { id: 'decisionOutcome', title: 'Decision Outcome', aliases: ['Decision Outcome'], level: 'required', basis: ['tplOutcome'] },
      { id: 'consequences', title: 'Consequences', aliases: ['Consequences'], level: 'recommended', basis: ['tplConsequences', 'tplOptional'] },
      { id: 'confirmation', title: 'Confirmation', aliases: ['Confirmation'], level: 'optional', basis: ['tplConfirmation', 'tplOptional'] },
      { id: 'prosAndCons', title: 'Pros and Cons of the Options', aliases: ['Pros and Cons of the Options'], level: 'optional', basis: ['tplProsCons', 'tplOptional'] },
      { id: 'moreInformation', title: 'More Information', aliases: ['More Information'], level: 'optional', basis: ['tplMore', 'tplOptional'] }
    ]
  }
];

// The status words: the five of the MADR template, which are also the words of Nygard's post.
export const DEFAULT_STATUSES = ['proposed', 'accepted', 'rejected', 'deprecated', 'superseded'];

// The headings of a section that holds the status, in every layout.
export const DEFAULT_STATUS_HEADINGS = ['Status'];

// Phrases that mark a part of a record as not written yet. Written in capitals, a phrase is found with case.
export const DEFAULT_PLACEHOLDERS = ['TBD', 'TBA', 'TODO', 'FIXME', 'to be decided', 'to be determined', 'to be defined', 'to be confirmed', 'to be written', 'lorem ipsum'];

// The files of a folder that are never read as records: an index and the templates of MADR and adr-tools. Compared
// without case.
export const DEFAULT_IGNORE_FILES = ['README.md', 'index.md', 'template.md', 'adr-template.md'];

// The spec of a file name, NNNN-title-with-dashes.md by default: an optional fixed prefix, exactly `digits` digits, the
// separator, then words of lowercase letters and digits joined by the separator, then the extension.
export const DEFAULT_FILE_NAME = { prefix: '', digits: 4, separator: '-', lowercase: true, extension: '.md' };

export const DEFAULT_RULES = {
  missingTitle: { level: 'error' },
  unknownLayout: { level: 'error' },
  missingSection: { required: 'error', recommended: 'notice' },
  emptySection: { level: 'warning' },
  placeholder: { level: 'warning' },
  missingStatus: { level: 'error' },
  unknownStatus: { level: 'error' },
  staleProposed: { level: 'warning', after: 3, pending: 'proposed', decided: ['accepted'] },
  supersededLink: { level: 'error', statuses: ['superseded'] },
  brokenLink: { level: 'error' },
  duplicateNumber: { level: 'error' },
  duplicateTitle: { level: 'warning' },
  numberingGap: { level: 'notice' },
  fileName: { level: 'warning' }
};

export const DEFAULT_FAIL_ON = 'warning';

// Text in curly braces, as the MADR template writes the parts to fill in ("{short title, ...}"), counts as a placeholder.
export const DEFAULT_TEMPLATE_BRACES = true;
