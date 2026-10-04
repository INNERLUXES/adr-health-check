# 2. Never follow a link out of the folder

## Status

Accepted

## Context

Records link to each other: a superseded record names its replacement, and Nygard writes that a later record may mark a decision deprecated or superseded "with a reference to its replacement." The MADR template says of its last section: "Links to other decisions and resources might appear here as well." A link that points at a file that was renamed or never added leaves a reader with no way to follow the decision, so checking the links is worth doing.

A folder of records lives in a repository that many people change. A tool that follows links or symbolic links can be made to read files the person who runs it never meant to give it: a link to `../../.env`, a symbolic link named `0005-x.md` that points at a key file, a path that leaves the folder through `%2E%2E/` or a backslash. In a pipeline, whatever the tool reads can end up in a job summary that many people see. A link can also name a web address; fetching it would make the report depend on the network and would send requests to wherever a record points.

## Decision

1. The folder named on the command line is listed once. A symbolic link in it is never followed: not as a record, and not as the target of a link. A subfolder is not read. A device, a pipe or a socket is passed over. Each file is then opened once, with `O_NOFOLLOW` where the system has it, and its type is taken from the open handle, so a file swapped for a link after the listing is refused.
2. A relative link is resolved as text, against the names of that one listing. Nothing is opened to resolve it. Backslash escapes and percent escapes are read first, and a backslash counts as a separator, so every way of writing `..` is seen.
3. A link that leaves the folder, through `..`, from the root of a disk or a site, or into a subfolder, is not followed and not checked. The report counts these links in a note with the first few of them, so a reader can look at them.
4. A web address is never fetched. The report counts them.
5. The folder itself may be a symbolic link to a folder, because the person who runs the tool named it.

## Consequences

- A link from a record to a file in a subfolder, such as an image in `img/`, is not checked. The note names it, and docs/limits.md lists the case.
- A link written as `../decisions/0002-x.md` from inside the folder `decisions` points back into the folder, but is reported as leaving it: the tool does not compare the name of the folder with the path. This keeps the rule simple to state and to test.
- A record kept as a symbolic link is not read, and a link to it is reported as broken with the reason. Keep the records themselves in the folder.
- No report can hold the content of a file outside the folder, and no run sends a request anywhere.
