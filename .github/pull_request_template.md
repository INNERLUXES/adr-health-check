## What changes

<!-- One or two sentences. -->

## Checks

- [ ] `npm test`, `npm run test:coverage`, `npm run check` and `npm run example` pass, and the files under `examples/output` are the ones `npm run example` wrote
- [ ] A change to a rule, a layout, the status reading or the file-name spec is described in docs/method.md or docs/inputs.md, says what it can and cannot see, and has a test with the records written inline and a near miss on each side
- [ ] The tool still reads no clock and no date: the age of a proposed record is its place in the numbered sequence
- [ ] Links are still resolved against the one listing of the folder: nothing outside the folder is opened, no symbolic link is followed, no web address is fetched
- [ ] No pattern is built from the configuration or a record; the file-name spec stays a spec, not a regular expression
- [ ] A change to a quoted sentence follows the saved page: the new page text is saved in research/sources, `src/data.js` and docs/rules-and-sources.md match it, and nothing was added from memory
- [ ] Text from the input goes through `safeText` before it reaches a report, a note or an error message
- [ ] The tool still opens no network connection, runs no program and writes nothing but the report `--out` names
- [ ] Work stays bounded: the limits of docs/limits.md hold, and a hostile test has a time check that widens under coverage through `NODE_V8_COVERAGE`
- [ ] A test that depends on the operating system (a link, a device) is guarded with `process.platform`, asserts no line or column of its own, and builds its paths with `resolve()` from forward-slash names
- [ ] No real person, team or email address in fixtures or examples, no date, and no number that reads like a year anywhere
- [ ] The commit messages of this pull request follow Conventional Commits
