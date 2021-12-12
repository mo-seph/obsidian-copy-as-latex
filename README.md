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

Complex features:
- [X] code blocks - carries through the language into a def for the `listings` package.
- [X] citations - currently looks at internal links starting with an `@`, and transforms into `\cite{...}` (or `\autocite{}` depending on settings)
- [X] Cross-references - looks at internal links starting with `^`, transforms into `\ref{...}`
- [ ] (but it doesn't turn block ids into `\label{}` yet)
- [ ] bibliographies - it would be great to have a way to pull references out of a `.bib` file
- [ ] images - it should be possible to turn image links into something that connects to the filename
- [ ] captions

## How to use
Make sure your latex file includes the `soul` and `listings` packages, and off you go.

## License

This code is released under the MIT License