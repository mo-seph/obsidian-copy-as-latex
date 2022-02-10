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
- [X] External links
- [X] Automatic external links (except Obsidian is more generous than the GFM parser)
- [ ] Footnotes (It only makes sense to use inline foonotes, which Obsidian supports, but not the GFM parser)
- [ ] Highlight (again, not in GFM)
- [X] Special characters: `& % $ # _ { } ~ ^ \` 

Complex features:
- [X] code blocks - carries through the language into a def for the `listings` package.
- [X] citations - currently looks at internal links starting with an `@`, and transforms into `\cite{...}` (or `\autocite{}` depending on settings)
- [X] Cross-references - looks at internal links starting with `^`, transforms into `\ref{...}`
- [X] And turns block ids into `\label{}` elements
- [~] bibliographies - it would be great to have a way to pull references out of a `.bib` file (experimental)
- [ ] images - it should be possible to turn image links into something that connects to the filename
- [ ] captions


## How to use
Make sure your latex file includes the `soul` and `listings` packages, and off you go.

## Citations
Citations quickly get complex - see discussion here: https://github.com/mo-seph/obsidian-copy-as-latex/issues/4. To find an accomodation between Obsidian and Latex, the Extended Citation Parsing section parses parentheses to get information surrounding refs. `here is a (e.g. [[@example]] p.22)` would give a citation with `e.g.` as the `pre` part and `p.22` as the `post` part. There are then a series of templates depending on which of these are present: `bare` means neither, `pre`,`post`,`surrounded` is one or the other or both, and `paren` is for when pre and post are there but both blank, e.g. `([[@ref]])`. This means that different points can be set up, for e.g. `\citep` versus `\citet`, e.g.:

```
"bare" : "\\citep{#id}",
"surrounded" : "\\cite[#pre][#post]{#id}}",
"pre" : "\\cite[#pre]{#id}}" ,
"post" : "\\cite[#post]{#id}}",
"paren" : "\\citet{#id}"	
```



This may change, but it currently grabs `pre` and `post` - the bits before and after the link, without spaces. These is then templated into the right form for `\cite` or `\autocite` with a user definable template, where `{{[pre]}}` means "use the value for `pre`, and if it is there, keep the square brackets; if it is not, get rid of them - so with `\autocite{{(pre)}}{{[post]}}{{{id}}}` and ` (e.g. [[@author2021Paper]] p.22)`, it produces `\autocite(e.g.)[p.22]{author2021Paper}`

## Copy Citations
This is a command that lets you copy the citations that are missing from a bibliography (e.g. I've just added some text to my Overleaf, need to update the `.bib` file too)
To use it:
	- Set your main bibliography file in the config (source)
	- Copy the current bibliography of your paper to the clipboard (target)
	- Run `Copy Missing Citations` from the command pallette. It will look for all the citation keys in the Markdown doc, and any that are present in the source and missing from the target will be copied to the clipboard.

# Development

## Changelog

### 1.9
- Citation templates for various styles
- Copy missing citations command

### 1.8
- Escape special characters

## License

This code is released under the MIT License