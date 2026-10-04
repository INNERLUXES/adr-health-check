# Security

## Reporting a problem

Write to info@innerluxes.dev with the subject line "adr-health-check security", or use private vulnerability reporting on this repository. Please do not open a public issue for a vulnerability.

Include a small made-up folder of records and configuration that show the problem, the command you ran, what you expected and what happened. Use made-up names, never real records of a real company, and never a real key, token or password, even a revoked one.

## Scope

In scope:

- an input that makes the tool read a file outside the folder of records, follow a symbolic link, read a subfolder, or follow a link out of the folder
- an input that makes the tool open a network connection, fetch a web address, run a program, load a module or evaluate any part of a file
- an input that makes the tool write a file other than the one `--out` names, or write the report into the folder of records or over the configuration
- an input that makes the tool hang, take very long or use unbounded memory, such as a folder with very many entries, a very large file, a very long line, lists or block quotes nested very deep, openers that are never closed, or JSON nested very deep
- binary, UTF-16 or invalid UTF-8 input that the tool reads as if it were text
- an input that the tool fails to read and passes over without an error, such as an unknown key or a key named twice in the configuration
- a run that passes although a required section is missing or empty, or a rule that runs or does not run against docs/method.md
- text from a record or a file name that breaks a Markdown table, makes a link, is read as a formula when a table is pasted into a spreadsheet, rewrites the terminal through control or direction characters, or is shown unescaped in a report
- a name such as `__proto__` that changes how objects behave inside the tool
- a report that changes with the clock, the time zone or the locale of the machine
- a sentence in src/data.js that differs from the saved page in research/sources

Out of scope: whether a decision is right, whether the records describe the system as it is, who may change the configuration in your repository, and where your pipeline keeps the reports.

Read [docs/threat-model.md](docs/threat-model.md) for the rest.
