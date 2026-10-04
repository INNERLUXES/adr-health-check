# Secure defaults

The default run is the safe run. Nothing in the first section needs a flag, and none of it can be switched off. The rest of the document is about what the tool cannot do for you: where the records come from, where a report goes, and who may change the configuration.

## How the tool behaves by default

- **Reads, never follows.** The tool lists the folder once and reads the records in it. It follows no symbolic link, reads no subfolder, follows no link out of the folder, fetches no web address, refuses an argument that looks like an address, and starts no program ([decision 2](decisions/0002-never-follow-a-link-out-of-the-folder.md)).
- **Two layouts from the first run.** Without a configuration, Nygard's format and MADR apply, the layout of each record is detected from its headings, and every rule is on.
- **Unknown keys are errors.** A key in the configuration that the tool does not know stops the run, with its line and a suggestion, so a typo cannot leave a default in place unnoticed. A key named twice stops the run. Removing an entry that is not on a list, adding one that is already there, an alias shared by two sections, and a set with no layout stop the run too.
- **Fail closed on what it cannot read.** An input that cannot be read stops the run with exit code `2` and no verdict: a missing folder, a record over its limit, a binary file, UTF-16, bytes that are not UTF-8, too many entries, too many lines.
- **Empty is not found.** A section whose every heading has nothing under it, or nothing but placeholders, counts as empty, and is reported.
- **No regular expression from the input.** No pattern is built from a record or the configuration. The file-name spec is a spec, read character by character.
- **No prototype tricks.** Records, layouts and sections are kept in arrays and maps, JSON objects are built with own properties, and an id is a letter followed by letters and digits.
- **Clean output.** Text from the input, file names included, has control characters, line separators and direction controls removed and its length capped before it reaches a report or an error message. Markdown cells escape pipes, backslashes, square brackets, backticks, asterisks, underscores, line breaks and `<`, `>` and `&`, and a cell that starts with `=`, `+`, `-`, `@`, a tab or a carriage return gets a leading apostrophe.
- **The same folder gives the same report.** The tool reads no clock, no time zone, no locale and no random number ([decision 1](decisions/0001-read-no-clock-and-keep-dates-out-of-the-repository.md)). Records are taken in the order of their names by code units, and case is changed for the letters A to Z only.
- **No dependencies.** Node 22 or newer and nothing else.

## Rules that make the check stricter

- **`"failOn": "notice"`.** Every finding fails the run, missing recommended sections and gaps in the numbers included.
- **`"layouts": { "madr": { "requireStatus": true } }`.** A MADR record with no status is a finding.
- **`"rules": { "staleProposed": { "after": 1 } }`.** A proposed record fails as soon as one later record is accepted.
- **`"rules": { "supersededLink": { "statuses": ["superseded", "deprecated"] } }`.** A deprecated record must name its replacement too.
- **A required section.** Set `level` to `required` on a section your records must always have, such as Confirmation in MADR.

## Running it in a pipeline

```yaml
permissions:
  contents: read
steps:
  - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
  - uses: actions/setup-node@820762786026740c76f36085b0efc47a31fe5020 # v7.0.0
    with:
      node-version: 22
  - name: Decision record health
    run: npx --yes github:INNERLUXES/adr-health-check docs/decisions --format markdown >> "$GITHUB_STEP_SUMMARY"
```

- Give the job read access to the contents and nothing more. The tool needs no secret.
- Pin every action to a full commit, as above, and pin the tool to a release commit or a tag you have read, because `npx` runs what it downloads.
- Do not hide the exit code with a trailing `|| true`.
- Records can name people, systems and plans. Post the report only where the people who may read the records read it.

## Protecting the configuration

The configuration decides which sections are required, which status words are known, when a proposed record is stale and what fails the run. Keep it in the repository, in its own path, and put the path in `CODEOWNERS` with the people who own the architecture; require their review in branch protection. Review a change that sets a section or a rule to off, adds a status word, raises `after`, or lowers `failOn` like a change to code: each of them can let a weak folder pass.

## SSDF

The repository is checked against NIST SP 800-218 (SSDF) in its own pipeline and before every release, with `ssdf-repo-check` pinned to its release commit. The evidence it looks for is in these files:

| Practice | Evidence in this repository |
| --- | --- |
| PO.1 Define security requirements | CONTRIBUTING.md, docs/secure-defaults.md |
| PO.2 Roles and responsibilities | .github/CODEOWNERS |
| PO.3 Toolchain | .github/workflows/ci.yml, codeql.yml, release.yml |
| PO.4 Criteria for security checks | CodeQL with the security-extended queries, the SSDF gate in ci.yml and release.yml |
| PO.5 Secure environments | a `permissions:` block in every workflow, actions pinned to commits |
| PS.1 Protect the code | .gitignore for keys and `.env`, `npm run check` for committed secrets |
| PS.2 Integrity of releases | SHA-256 checksums and a build provenance attestation in release.yml |
| PS.3 Archive and provenance | a CycloneDX SBOM and the CHANGELOG with every release |
| PW.1 Design for security | docs/threat-model.md |
| PW.2 Review the design | docs/decisions |
| PW.4 Reuse secure components | no runtime dependencies, a lock file, Dependabot |
| PW.5 Secure coding | CONTRIBUTING.md, `npm run check` |
| PW.6 Build settings | `npm ci` from the lock file |
| PW.7 Code review | the pull request template and CODEOWNERS |
| PW.8 Testing | `npm test` on Linux, Windows and macOS with Node 22 and 24, `npm run test:coverage`, hostile input tests |
| PW.9 Secure defaults | this document |
| RV.1 Find vulnerabilities | SECURITY.md, Dependabot |
| RV.2 Respond to vulnerabilities | SECURITY.md |
