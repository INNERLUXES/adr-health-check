# Threat model

## What the tool touches

- It lists the folder named on the command line once, reads the records directly in it, and reads the configuration file named with `--config`. Nothing else is opened.
- It writes the report to the screen, or to the one file `--out` names, which may not be inside the folder of records or be the configuration. It writes nothing else.
- It opens no network connection, follows no link and no symbolic link out of the folder, evaluates nothing it reads and starts no program.

## What the input may hold

A folder of decision records lives in a repository that many people change. In a pipeline that checks every pull request, the records are written by whoever opened the pull request, and so is the configuration.

Through the inputs, a person can try to:

- make the tool read a file outside the folder: a link to `../../.env` or `/etc/passwd`, the same written as `..%2F` or with a backslash, a symbolic link in the folder named like a record that points at a key file, a symbolic link to the parent folder, a file swapped for a link between the listing and the read;
- make the tool fetch something: a link to a web address, an image on another host, a `file:` address;
- make a weak folder pass: a heading that matches an alias but holds nothing, a section with nothing but a placeholder, a status hidden in markup, a superseded record that points at itself, a front matter key given twice;
- move the verdict through the configuration: a key named twice, an unknown key that looks like a known one, a rule set to off, a section set to off, an alias shared by two sections;
- exhaust the memory or the time: thousands of entries, a record of gigabytes, a line of megabytes, lists or block quotes nested thousands deep, link openers, backticks and curly braces that are never closed, JSON nested a million deep;
- slip in something that is not text: a binary file named `.md`, a file in UTF-16, bytes that are not UTF-8;
- rewrite the terminal or break a report: control characters, ANSI escapes, direction controls and line separators in a file name, a title or a heading, and pipes, brackets and angle brackets that a Markdown table would render;
- run a formula: a heading that starts with `=`, `+`, `-` or `@`, which a spreadsheet would run when a Markdown table of the report is pasted into it;
- change how objects behave: a file name, a title, a status, a layout id or a section id such as `__proto__`, `constructor` or `toString`;
- make the tool overwrite its input or add to the folder: `--out` pointed at the configuration or into the folder of records;
- make the report change from day to day: a date in the front matter.

## What could go wrong, and what stops it

| Risk | Control |
| --- | --- |
| A link makes the tool read a file outside the folder | Links are resolved as text against the one listing of the folder; nothing is opened to resolve a link. Escapes are read first and a backslash is a separator, so every spelling of `..` is caught; such a link is counted in a note and never followed. A test writes seven spellings next to a real file outside the folder |
| A symbolic link in the folder points outside it | The listing does not follow entries; a symbolic link is never read as a record, and a link to one is reported as broken with the reason. Each record is opened with `O_NOFOLLOW` where the system has it, and its type is taken from the open handle, so a file swapped for a link after the listing is refused |
| The tool fetches a web address | No module of the network is imported; a web address is counted, never fetched; a URL given on the command line is refused. A test checks the imports of src |
| A heading with nothing under it passes as a section | A section whose every heading is empty, or holds nothing but placeholders, is empty, not found, and `empty-section` reports every such heading |
| A key named twice or an unknown key moves the verdict | The JSON reader refuses a repeated key; an unknown key stops the run with its line and a suggestion; removing an entry that is not on a list, a shared alias and a set with no layout are refused; a status given twice in the front matter is a finding |
| The memory or the time is exhausted | The folder listing stops at 5,000 entries; every file has a size limit checked on the open handle before it is read; lines and nesting are capped; links, code spans and curly braces are found with positions that only move forward, so openers that are never closed cost one pass; findings are capped per rule. Tests check the time, with limits that widen under coverage only |
| A pattern from the input is slow | No regular expression is built from a record or the configuration; the file-name spec is read character by character, and phrases are found with indexOf; a test looks for `new RegExp` in src |
| A binary or UTF-16 file is read as text | A null byte, a UTF-16 byte order mark or bytes that are not valid UTF-8 stop the run with exit code `2` |
| Text from the input rewrites the terminal or breaks a Markdown table | Every text, file names included, goes through `safeText`, which removes control, line separator and direction characters and caps the length; Markdown cells escape the characters a table, a link or HTML needs. A test puts ANSI escapes and direction controls in a file name, a title and a link |
| A cell is run as a formula | A Markdown cell that starts with `=`, `+`, `-`, `@`, a tab or a carriage return gets a leading apostrophe |
| `__proto__` changes how objects behave | Records, layouts and sections are kept in arrays and maps; the JSON reader defines own properties; an id must be a letter followed by letters and digits. A test uses `__proto__`, `constructor` and `toString` as file names, titles, statuses and ids |
| A device or a pipe hangs the tool | A device, a pipe or a socket in the folder is passed over; a configuration file that is not a regular file is refused |
| A report overwrites an input, or the tool leaves files behind | Only `--out` writes, and a path that is the configuration or inside the folder of records is refused; there is no cache or temporary file. A test checks that a run leaves the folder as it was |
| The report changes with the clock | The tool reads no clock, no time zone and no locale; the age of a proposed record is its place in the numbered sequence ([decision 1](decisions/0001-read-no-clock-and-keep-dates-out-of-the-repository.md)) |

## Out of scope

Whether a decision is right, whether the records describe the system as it is, who may change the configuration in your repository, and where your pipeline keeps the reports.
