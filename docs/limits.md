# Limits

The tool checks the structure of a folder of architecture decision records: their sections, their status, their numbers, their names and their links. It does not read what a record means, and a folder with no finding can still hold poor decisions, or decisions that were never written down. Every report ends with a sentence that says so.

## What it cannot see

- **Meaning.** The tool finds headings, status words, numbers and link targets. It cannot tell whether the context is described well, whether the decision follows from it, whether the consequences are honest, or whether two records contradict each other.
- **Sections under other headings.** A section is found by its aliases, and the whole heading must match. A section written under a heading with none of its aliases is reported missing; add the heading to the aliases in the configuration.
- **A record with too few headings to tell its layout.** A record whose only matching heading is `Consequences` matches Nygard and MADR alike and is read as the first layout of the configuration; a note says so. Set `layout` in the configuration when every record follows one layout.
- **Age by the calendar.** The tool reads no clock and no date ([decision 1](decisions/0001-read-no-clock-and-keep-dates-out-of-the-repository.md)). A proposed record is stale only when enough records after it in the numbered sequence were decided. The last record of the folder is never stale, however long it has waited, and a record with no number takes no part in the sequence.
- **Records in subfolders.** Only the records directly in the folder are read. Run the tool once for each subfolder.
- **Links that leave the folder.** A link to a parent folder, a subfolder, an absolute path or a web address is never followed or fetched ([decision 2](decisions/0002-never-follow-a-link-out-of-the-folder.md)); it is counted in a note. A link written as `../decisions/0002-x.md` from inside `decisions` is counted as leaving the folder.
- **Anchors.** The part of a link after `#` is not checked, in the same record or in another.
- **Links over two lines, and parentheses in a destination.** A link is found within one line, and a destination ends at the first `)` or space unless it is written in angle brackets.
- **References by title or by number in prose.** A record that names another by a description is not checked. `superseded-link` reads ADR numbers such as ADR-0005 in the status only.
- **Front matter beyond flat keys.** A list, a nested value or a value over several lines is not read. Only `status` and `title` are used.
- **Symbolic links.** A record kept as a symbolic link is not read, and a link to it is reported broken.
- **Markdown beyond the subset.** HTML blocks other than comments, entity references and the rules for emphasis are not read as CommonMark reads them; they do not change where a heading is.

## Size limits

Past a limit, the input is refused with exit code `2` and no verdict, or, where the limit is on the work and not the input, the report says so in a note.

| What | Limit |
| --- | --- |
| entries in the folder | 5,000 |
| one record | 1 MB, 200,000 lines |
| all records together | 32 MB |
| configuration file | 1 MB; 20 layouts, 100 sections each, 50 aliases each, 500 entries in a list, 120 characters for a title, an alias or an entry |
| JSON of the configuration | nesting 32 deep, 100,000 values, 4,096 characters in a string |
| front matter | 200 lines between the opening and the closing line |
| nesting of lists and block quotes | 16 levels; deeper text is read as plain paragraphs, with a note |
| a link destination | 4,000 characters |
| the number of a record | 9 digits |
| findings of one rule | 500 listed; the rest are counted in a note |
| problems of the input | 20 listed; the rest are counted |

The tests read five hundred records with links between them, a line of three megabytes, lists nested three thousand deep, block quotes with a hundred thousand markers, forty thousand headings, and lines full of link openers, backticks and curly braces that are never closed, each with a time check.
