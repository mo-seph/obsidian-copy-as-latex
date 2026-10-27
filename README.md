# Copy as Latex

Designed for when you want to do most of your writing in a nice Obsidian environment, with lots of citations from a nicely managed set of references etc. Lighterweight than Pandoc, doesn't assume you're writing a whole document. The aim is to be:
- simple
- quick

## Example
```markdown
# Main Heading
Some text, of which _some_ is italic, and there is an $x=7$ equation and a [[@author2021Paper]] citation and a [https://link.com](https://link.com).

## Another heading

### SubSub Heading


Here is a list:
- item 1
- item 2
- item 3
	- subitem 3.1
	- subitem 3.2

1. First numbered item
2. Second numbered item
```
becomes:
```latex
\section{Main Heading}

Some text, of which \emph{some} is italic, and there is an $x=7$ equation and a \cite{author2021Paper} citation and a \url{https://link.com}.

\subsection{Another heading}

\subsubsection{SubSub Heading}

Here is a list:

\begin{itemize}
	\item item 1
	\item item 2
	\item item 3
	\begin{itemize}
		\item subitem 3.1
		\item subitem 3.2
	\end{itemize}
\end{itemize}

\begin{enumerate}
	\item First numbered item
	\item Second numbered item
\end{enumerate}
```

## Features
This relies on https://github.com/syntax-tree/mdast-util-from-markdown, and https://github.com/syntax-tree/mdast-util-gfm for the parsing. This doesn't quite match Obsidian's feature set, but most key things are there.
Text features:
- [X] lists - does `itemize` and `enumerate`, and nesting seems OK so far.
- [X] headings
- [X] bold
- [X] italic
- [X] External links - `\url{...}` for a bare link, `\href{url}{text}` when the link has its own text
- [X] Automatic external links (except Obsidian is more generous than the GFM parser)
- [ ] Footnotes (It only makes sense to use inline foonotes, which Obsidian supports, but not the GFM parser)
- [ ] Highlight (again, not in GFM)
- [X] Special characters: `& % $ # _ { } ~ ^ \` 
- [X] Block quotes - `\begin{quote}` ... `\end{quote}`

Complex features:
- [X] code blocks - carries through the language into a def for the `listings` package; tagged blocks can have their own templates (see Code blocks and admonitions below)
- [X] admonitions - ```` ```ad-theorem ```` and friends, through the same templates
- [X] citations - either internal links starting with an `@` (`[[@key]]`) or pandoc-style `[@key, p.3; @other]`, transformed into `\cite{...}`, `\autocite{...}` or user templates depending on settings (see Citations below)
- [X] Cross-references - `[[#^id]]`, `[[Note#^id]]` and `[[#Heading]]` links become `\ref{...}`; block ids (`^id`) and headings become `\label{...}` (see Cross-references below)
- [X] tables - markdown tables become booktabs `tabular` or `tabulary` tables, optionally in a `table` float (see Tables below)
- [~] bibliographies - it would be great to have a way to pull references out of a `.bib` file (experimental)
- [X] images - `![[file.png|caption]]` and `![caption](file.png)` become `figure` floats with `\includegraphics` (see Figures below)
- [~] captions - figure captions come from the image's alias/alt text; table captions are left empty to fill in


## How to use
Make sure your latex file includes the `soul`, `listings`, `booktabs`, `graphicx` and `hyperref` packages (plus `tabulary` or `minted` if you turn those options on), and off you go.

## Citations
Citations quickly get complex - see discussion here: https://github.com/mo-seph/obsidian-copy-as-latex/issues/4. There are two parts to the setup: the **Citation syntax** setting says how citations are written in your notes (wiki links or pandoc), and the **Citation Command** setting says what LaTeX to produce (`\cite`, `\autocite`, `\parencite`, or the extended templates described below).

### Wiki-link citations: `[[@citekey]]`
The default. Any internal link starting with `@` is a citation. With the `Extended Citations` command, the text around the link is parsed for parentheses to get information surrounding refs: `here is a (e.g. [[@example]] p.22)` would give a citation with `e.g.` as the `pre` part and `p.22` as the `post` part. There are then a series of templates depending on which of these are present: `bare` means neither, `pre`,`post`,`surrounded` is one or the other or both, and `paren` is for when pre and post are there but both blank, e.g. `([[@ref]])`.

### Pandoc citations: `[@citekey, p.3; @other]`
Set *Citation syntax* to **Pandoc** to write citations the way [pandoc](https://pandoc.org/MANUAL.html#citation-syntax) and plugins like Pandoc Reference List expect them: one or more `@citekey`s inside square brackets, separated by semicolons, with optional text before and after each key. Wiki-link citations are still converted in this mode, so notes that mix the two are fine.

For example, with the `Autocite` command, `[@harding1991WhoseScience, p.149]` becomes `\autocite[p.149]{harding1991WhoseScience}` and `[@cave2020WhitenessAI; @katz2020ArtificialWhiteness]` becomes `\autocite{cave2020WhitenessAI,katz2020ArtificialWhiteness}`.

The full set of forms, and what each Citation Command does with them (Paren Cite is the same as Autocite with `\parencite`):

| Markdown | Basic | Autocite | Extended template used |
|---|---|---|---|
| `[@foo]` | `\cite{foo}` | `\autocite{foo}` | `bare` |
| `[@foo, p.3]` | `\cite[p.3]{foo}` | `\autocite[p.3]{foo}` | `post` |
| `[see @foo]` | `\cite[see][]{foo}` | `\autocite[see][]{foo}` | `pre` |
| `[see @foo, p.3]` | `\cite[see][p.3]{foo}` | `\autocite[see][p.3]{foo}` | `surrounded` |
| `[@foo; @bar]` | `\cite{foo,bar}` | `\autocite{foo,bar}` | `bare`, with `foo,bar` as the id |
| `[@foo, p.3; @bar]` | `\cite[p.3]{foo}; \cite{bar}` | `\autocites[p.3]{foo}{bar}` | one template per key, joined with `; ` |
| `@foo says` | `\cite{foo} says` | `\textcite{foo} says` | `intext` |
| `@foo [p.3] says` | `\cite[p.3]{foo} says` | `\textcite[p.3]{foo} says` | `intext` (put `#post` in the template to show the locator) |
| `[-@foo]` | `\cite{foo}` | `\autocite*{foo}` | `bare` |

Details:
- Keys follow pandoc's rules: they start with a letter, digit or `_`, may contain `:.#$%&-+?<>~/` as long as each one is followed by another letter or digit (so `[@doe:2020].` gives the key `doe:2020`), and `@{anything at all}` works for odd keys. An `@` straight after a word character, as in an email address, is left alone.
- Keys are separated by `;` as in pandoc, and a comma directly before the next `@` also works (`[@foo, @bar]`, or `[@foo, p.3, @bar]`). A bracket is only a citation if every part contains an `@key`; otherwise it is left as text.
- Text before and after the key (the prefix and suffix) is escaped for LaTeX like any other text, so `[@foo, ch. 5 & 6]` gives `\autocite[ch. 5 \& 6]{foo}`. The key itself is never escaped.
- Plain `\cite` has no multi-argument or author-in-text forms, so with the `Basic` command several keys with affixes become separate `\cite` commands and `@foo` becomes `\cite{foo}`. Choose `Extended Citations` with the `Natbib` templates to get `\citep`/`\citet` instead.
- `Copy Missing Citations` collects pandoc keys as well as wiki-link ones when this syntax is selected.

### Extended citation templates
With the `Extended Citations` command, each kind of citation is rendered with a template that can use `#id`, `#pre` and `#post`. This means that different points can be set up, for e.g. `\citep` versus `\citet`. The Natbib preset, for example, is:

```
"bare" : "\\citep{#id}",
"surrounded" : "\\cite[#pre][#post]{#id}",
"pre" : "\\cite[#pre][]{#id}" ,
"post" : "\\cite[#post]{#id}",
"paren" : "\\citet{#id}",
"intext" : "\\citet{#id}"
```

There are presets (Default, Autocite, Natbib, Brute-Force) in the settings, and each template can be edited individually. `paren` is only produced by wiki-link citations, and `intext` only by pandoc ones.

## Tables
Markdown tables are converted to [booktabs](https://ctan.org/pkg/booktabs) tables, so include `\usepackage{booktabs}` in your document. Column alignment comes from the `:---:` markers (unmarked columns are left-aligned), the first row is the header, and cell contents are converted like any other text, so emphasis, inline code, math and citations work inside cells.

```markdown
| Name | Value | Note   |
|:-----|------:|:------:|
| *a*  | 1 & 2 | [@foo] |
| b    | 3     |        |
```
becomes
```latex
\begin{table}[htbp]
\centering
\caption{}
\begin{tabular}{lrc}
\toprule
Name & Value & Note \\
\midrule
\emph{a} & 1 \& 2 & \cite{foo} \\
b & 3 &  \\
\bottomrule
\end{tabular}
\end{table}
```

Two settings control this:
- *Table environment*: `tabular` (the default) gives each column its natural width. `tabulary` spreads the columns over the line width and wraps long cells, which is usually what you want for tables with much text; it needs `\usepackage{tabulary}` and produces `\begin{tabulary}{\linewidth}{LRC}`.
- *Wrap tables in a float*: on by default. Wraps the table in a `table` float with `\centering` and an empty `\caption{}` above it for you to fill in (add a `\label{}` after the caption if you need one). Turn it off to get a bare `tabular`.

Column widths, multi-line cells and merged cells can't be expressed in markdown, so those are left for tweaking in LaTeX.

## Code blocks and admonitions
Fenced code blocks become `lstlisting` environments (or `minted`, with that setting on) carrying the language tag. Blocks with other tags can have their own output through the *Code block templates* settings: each entry pairs a tag (the word after the backticks) with free-text LaTeX, where
- `#1` is the block's content converted from markdown, so emphasis, maths, lists and citations inside it come through;
- `#raw` is the content exactly as typed, for code;
- `#title` is the title of an Obsidian [admonition](https://github.com/javalent/admonitions) (tags starting `ad-`), whose leading `title:`, `collapse:`, `icon:` and `color:` lines are removed from the content. `[#title]` produces the optional argument only when there is a title, so `\begin{theorem}[#title]` doesn't leave an empty bracket.

The default set has one template, `ad-theorem` to `\begin{theorem}[#title]` / `#1` / `\end{theorem}`:

````markdown
```ad-theorem
title: Pythagoras
For a right triangle, $a^2 + b^2 = c^2$, as shown in [@euclid].
```
````
```latex
\begin{theorem}[Pythagoras]
For a right triangle, $a^2 + b^2 = c^2$, as shown in \cite{euclid}.
\end{theorem}
```

Tags are matched ignoring case, and a template for a language tag overrides the listing, e.g. `python` with `\begin{minted}[linenos]{python}` / `#raw` / `\end{minted}`. Callouts (`> [!note]`) are not covered: they come through as block quotes.

## Figures
Images become `figure` floats, so include `\usepackage{graphicx}`. Both Obsidian embeds and standard markdown images work, and the alias or alt text becomes the caption (an alias that is just a size, like `![[plot.png|300]]`, is ignored). The path is copied as written, so set `\graphicspath` or edit it in LaTeX.

```markdown
![[plot.png|Accuracy against training time]]
```
```latex
\begin{figure}[htbp]
\centering
\includegraphics[width=\linewidth]{plot.png}
\caption{Accuracy against training time}
\end{figure}
```
Embeds of notes rather than images (`![[Other note]]`) are left as they are.

## Cross-references
Labels come from Obsidian block ids (`^id` at the end of a block) and from headings; references come from Obsidian's own link forms, so everything stays clickable in Obsidian. Every reference becomes `\ref{...}`, so write the word "Table" or "Section" yourself (or search-and-replace `\ref` with `\cref` or `\autoref` on the LaTeX side).

| Markdown | LaTeX |
|---|---|
| `## Related Work` | `\subsection{Related Work}\label{sec:related-work}` |
| `## Related Work ^my-id` | `\subsection{Related Work}\label{my-id}` |
| `[[#Related Work]]` or `[[Paper#Related Work]]` | `\ref{sec:related-work}` |
| `[[#^tbl-results]]`, `[[Paper#^tbl-results]]` or `[[^tbl-results]]` | `\ref{tbl-results}` |
| `Table [[#^tbl-results|1]]` | `Table \ref{tbl-results}` (the alias is dropped, so put the number there to read well in Obsidian) |
| `Some text ^para-id` | `Some text\label{para-id}` |

Section labels are made from the first two words of the heading, lower-cased and joined with `-`, so `## Related Work in Robotics` gives `sec:related-work`; the same rule is applied to `[[#Heading]]` links, so they always match. If two headings share their first two words, give one of them an explicit `^id`. Turn off *Label sections* in the settings if you don't want every heading labelled; explicit `^id` labels and `[[#^id]]` references work regardless.

### Sections
```markdown
## Related Work

The method is described in [[#Method]].

## Method
```
```latex
\subsection{Related Work}\label{sec:related-work}

The method is described in \ref{sec:method}.

\subsection{Method}\label{sec:method}
```

### Tables
Put the block id on its own line after the table (Obsidian wants a blank line in between; the id directly on the next line works too). The label goes inside the float, after the caption, which is where LaTeX needs it.
```markdown
| Model | Score |
|-------|------:|
| Ours  |  0.91 |

^tbl-results

Results are in Table [[#^tbl-results|1]].
```
```latex
\begin{table}[htbp]
\centering
\caption{}
\label{tbl-results}
\begin{tabular}{lr}
\toprule
Model & Score \\
\midrule
Ours & 0.91 \\
\bottomrule
\end{tabular}
\end{table}

Results are in Table \ref{tbl-results}.
```

### Figures
The block id goes at the end of the embed's line, as for any single-line block (its own paragraph after the image works too).
```markdown
![[architecture.png|The system architecture]] ^fig-arch

The pipeline is shown in Figure [[#^fig-arch|2]].
```
```latex
\begin{figure}[htbp]
\centering
\includegraphics[width=\linewidth]{architecture.png}
\caption{The system architecture}
\label{fig-arch}
\end{figure}

The pipeline is shown in Figure \ref{fig-arch}.
```

## Copy Citations
This is a command that lets you copy the citations that are missing from a bibliography (e.g. I've just added some text to my Overleaf, need to update the `.bib` file too)
To use it:
	- Set your main bibliography file in the config (source)
	- Copy the current bibliography of your paper to the clipboard (target)
	- Run `Copy Missing Citations` from the command pallette. It will look for all the citation keys in the Markdown doc, and any that are present in the source and missing from the target will be copied to the clipboard.

# Development

## Developing locally
Build with `npm run build`, or `npm run dev` to rebuild on every change. Obsidian loads plugins from `<vault>/.obsidian/plugins/<plugin id>/`, so the simplest live setup is to symlink this folder in and reload the plugin (or Obsidian) after each build:

```
ln -s /path/to/obsidian-copy-as-latex /path/to/vault/.obsidian/plugins/copy-as-latex
```

`main.js` (the build) and `data.json` (your settings, once Obsidian has saved them) are gitignored.

## Changelog

### 1.10
- Pandoc citation syntax (`[@key, p.3; @other]`, `@key` in text) as an alternative to `[[@key]]` wiki links - see the Citation syntax setting
- `intext` citation template for author-in-text citations
- Default extended templates fixed (stray closing braces)
- Tables: markdown tables become booktabs tables (`tabular` or `tabulary`), optionally wrapped in a `table` float
- Figures: `![[embeds]]` and markdown images become `figure` floats, with the alias/alt text as the caption
- Cross-references: `[[#^id]]`, `[[Note#^id]]` and `[[#Heading]]` links become `\ref{}`, headings get `sec:` labels (optional), block ids after tables and figures go inside the float, and `^id` no longer swallows the text before it
- Block quotes become `quote` environments
- External links with their own text become `\href{url}{text}` rather than `\url{url}`
- Pandoc citations accept `[@foo, @bar]` as well as `[@foo; @bar]` (issue #21)
- Code block templates: fenced blocks with a chosen tag (e.g. ```` ```ad-theorem ````) render through a user template with `#1`, `#raw` and `#title`
- Wiki-link aliases use Obsidian's `|`, so citation keys with colons (`[[@doe:2020]]`) work and `[[Note|alias]]` shows the alias


### 1.9
- Citation templates for various styles
- Copy missing citations command

### 1.8
- Escape special characters

## License

This code is released under the MIT License