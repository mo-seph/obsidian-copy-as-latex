import { App, Editor, Modal, Notice, Plugin, PluginSettingTab, Setting } from 'obsidian';
import {fromMarkdown} from 'mdast-util-from-markdown'

// @ts-ignore - not sure how to build a proper typescript def yet
import { syntax } from 'micromark-extension-wiki-link'
// @ts-ignore - not sure how to build a proper typescript def yet
import * as wikiLink from 'mdast-util-wiki-link'
import {gfm} from 'micromark-extension-gfm'
import {gfmFromMarkdown, gfmToMarkdown} from 'mdast-util-gfm'

import { Code, Heading, InlineCode, Link, List, Node, Parent } from 'mdast-util-from-markdown/lib';
import { AlignType, Image, Literal, Table } from 'mdast';

export type citeCommand = "basic" | "autocite" | "parencite" | "extended"
// How citations are written in the markdown source:
// - "wikilink": Obsidian internal links, e.g. [[@key]]
// - "pandoc": pandoc/citeproc syntax, e.g. [@key, p.3; @other] or @key in running text
export type citationSyntax = "wikilink" | "pandoc"
export type citationType = "bare" | "surrounded" | "pre" | "post" | "paren" | "intext"
// Which latex environment holds table cells
export type tableEnvironment = "tabular" | "tabulary"

export interface ConversionSettings {
	inlineDelimiter:string;
	mintedListings: boolean;
	citeCommand: citeCommand
	citationSyntax: citationSyntax
	citationTemplates:Record<citationType,string>;
	tableEnvironment: tableEnvironment;
	tableFloat: boolean;
	labelSections: boolean;
}
// Conversions go from a Node with a certain amount of indentation to a string
type Convert = (a:Node,settings:ConversionSettings,indent:number) => string

// A block id at the end of a line, e.g. `some text ^my-id`; the `^` must follow whitespace or start the text
const labelMatch = /(^|\s)\^([a-zA-Z0-9_:-]+)\s*$/
/* Match: 
 * - some stuff
 * '(' followed by any amount of stuff that is not '(', to get everything inside the last paren
 */
const preCiteMatch = /^(.*)\(([^(]*)$/s
const postCiteMatch = /^([^)]*)\)(.*)$/s
/*
 * Overall function to carry out the conversion
 */
export function ASTtoString(input:Node,settings:ConversionSettings,indent:number=0) : string {
	var t = input.type;


	const transforms : { [key:string] : Convert } = {
		'root': wrapper("\n",""),
		'paragraph': wrapper("","\n"),
		'emphasis': (a:Node) => {return "\\emph{" + wrapper("","")(a,settings) + "}"},
		'strong': (a:Node) => {return "\\textbf{" + wrapper("","")(a,settings) + "}"},
		'delete': (a:Node) => {return "\\st{" + wrapper("","")(a,settings) + "}"},
		'footnote': (a:Node) => {return "\\footnote{" + wrapper("","")(a,settings) + "}"},
		'list' : list,
		'table': table,
		'tableRow': tableRow,
		'tableCell': wrapper("",""),
		'blockquote': blockquote,
		'image': figure,
		'listItem': (a:Node) => {return "\t".repeat(indent) + "\\item " + wrapper("","")(a,settings,indent) },
		'heading': heading,
		'wikiLink': internalLink,
		'link': externalLink,
		'code': codeBlock,
		'inlineCode': inlineCode,
		'inlineMath': inlineMath,
		'math': displayMath,
	}
	const f:Convert = transforms[input.type] || defaultC
	const trans = f(input,settings,indent)
	return   trans
}

/*
 * Individual functions to convert elements
 */

const defaultC : Convert = (a:Node,settings:ConversionSettings,indent:number=0) => {
	const v = (a as Literal).value
	if( !v ) return ""
	// A trailing block id (`some text ^id`) becomes a label after the text
	const lm = labelMatch.exec(v)
	if( lm ) return textToLatex(v.substring(0,lm.index),a.type,settings) + `\\label{${lm[2]}}`
	return textToLatex(v,a.type,settings)
};

// Escape a run of text, pulling out pandoc citations first if that syntax is on
function textToLatex(v:string,nodeType:string,settings:ConversionSettings) : string {
	if( nodeType === "text" && settings.citationSyntax === "pandoc" ) {
		return parsePandocCitations(v)
			.map((seg) => typeof seg === "string" ? escapeLatex(seg) : pandocCitation(seg,settings))
			.join("")
	}
	return escapeLatex(v)
}

function escapeLatex(input:string) : string {
	var v = input
	if( input === null || input === undefined ) return "";
	// Characters that need escaping in free text:
	// & % $ # _ { } ~ ^ \
	// \& \% \$ \# \_ \{ \}
	v = v.replace(/\\/g,"\\textbackslash")
	v = v.replace(/([{}])/g,"\\$1")
	v = v.replace(/\\textbackslash/g,"\\textbackslash{}")
	v = v.replace(/([&%$#_])/g,"\\$1")
	v = v.replace(/~/g,"\\textasciitilde{}")
	v = v.replace(/\^/g,"\\textasciicircum{}")

	return v
}

const wrapper = (jn:string,aft:string) => (a:Node,settings:ConversionSettings,indent:number=0) => {return (
	(a as Parent).children.map((c) => ASTtoString(c,settings,indent)).join(jn)) + aft};
const heading = (a:Node,settings:ConversionSettings,indent:number=0) => {
	const h = a as Heading
	var sec = "section"
	if( h.depth == 2 ) sec = "subsection"
	if( h.depth == 3 ) sec = "subsubsection"
	// An explicit `## Heading ^id` label wins; otherwise sections can be labelled from their text,
	// which is what [[#Heading]] links refer to
	const explicit = (a as any).label
	const slug = slugify(plainText(a))
	const label = explicit ? explicit : (settings.labelSections && slug) ? "sec:" + slug : null
	return "\\" + sec + "{" + wrapper("","")(a,settings) + "}" + (label ? `\\label{${label}}` : "") + "\n"
}

// Turn heading text into a short label: its first two words, lower-cased, so
// "Related Work in Robotics" -> "related-work". Used for both \label and [[#Heading]] references.
export function slugify(text:string) : string {
	const words = text.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 0)
	return words.slice(0,2).join("-")
}

// The plain text of a node and its children
function plainText(n:Node) : string {
	if( (n as any).children ) return (n as Parent).children.map(plainText).join("")
	return (n as Literal).value || ""
}

const list = (a:Node,settings:ConversionSettings,indent:number=0) => {
	const h = a as List
	var sec = h.ordered ? "enumerate" : "itemize"
	return "\t".repeat(indent) + "\\begin{" + sec + "}\n" + 
		wrapper("","")(a,settings,indent+1) +
		"\t".repeat(indent) + "\\end{" + sec + "}\n"
}

/*
 * Tables: GFM tables become booktabs tables, with column alignment from the `:---:`
 * markers, the first row as the header, and optionally a `table` float around them.
 */
const columnSpec = (align:AlignType[],env:tableEnvironment) : string => {
	const spec = align.map((al) => al === "right" ? "r" : al === "center" ? "c" : "l").join("")
	// tabulary uses upper case letters for its auto-width columns
	return env === "tabulary" ? spec.toUpperCase() : spec
}

const table = (a:Node,settings:ConversionSettings,indent:number=0) => {
	const t = a as Table
	const env : tableEnvironment = settings.tableEnvironment === "tabulary" ? "tabulary" : "tabular"
	const spec = columnSpec(t.align || [],env)
	const rows = t.children.map((r) => ASTtoString(r,settings,indent))
	const header = rows[0]
	const body = rows.slice(1)
	const begin = env === "tabulary" ? `\\begin{tabulary}{\\linewidth}{${spec}}` : `\\begin{tabular}{${spec}}`
	const lines = [begin, "\\toprule", header]
	if( body.length > 0 ) lines.push("\\midrule", ...body)
	lines.push("\\bottomrule", `\\end{${env}}`)
	const label = (a as any).label ? `\\label{${(a as any).label}}` : null
	if( !settings.tableFloat ) return lines.join("\n") + (label ? "\n" + label : "") + "\n"
	// The caption goes above the table, as is conventional, and is left empty to fill in
	return ["\\begin{table}[htbp]", "\\centering", "\\caption{}", ...(label ? [label] : []), ...lines, "\\end{table}"].join("\n") + "\n"
}

// Images (![caption](file.png) or Obsidian's ![[file.png|caption]]) become figure floats
const figure = (a:Node,settings:ConversionSettings,indent:number=0) => {
	const img = a as Image
	const lines = [
		"\\begin{figure}[htbp]",
		"\\centering",
		`\\includegraphics[width=\\linewidth]{${img.url}}`,
		`\\caption{${escapeLatex(img.alt || "")}}`,
	]
	if( (a as any).label ) lines.push(`\\label{${(a as any).label}}`)
	lines.push("\\end{figure}")
	return lines.join("\n") + "\n"
}

const blockquote = (a:Node,settings:ConversionSettings,indent:number=0) => {
	return "\\begin{quote}\n" + wrapper("\n","")(a,settings,indent) + "\\end{quote}\n"
}

const tableRow = (a:Node,settings:ConversionSettings,indent:number=0) => {
	return (a as Parent).children.map((c) => ASTtoString(c,settings,indent)).join(" & ") + " \\\\"
}
const internalLink = (a:Node,settings:ConversionSettings,indent:number=0) => {
	const h = a as wikiLink
	const url:string = h.value
	if(url.startsWith("@") ) { 
		if( settings.citeCommand === "extended" ) {
			return extendedCitation(h,settings);
		}
		else {
			if(settings.citeCommand == "basic") return "\\cite{" + url.substring(1) + "}" ;
			else if(settings.citeCommand == "autocite") return "\\autocite{" + url.substring(1) + "}" 
			else if(settings.citeCommand == "parencite") return "\\parencite{" + url.substring(1) + "}" 
		}
	}
	// Block references: [[^id]], [[#^id]] or [[Note#^id]] become \ref{id}
	const hash = url.indexOf("#")
	const target = hash >= 0 ? url.substring(hash+1) : url
	if( target.startsWith("^") ) { return "\\ref{" + target.substring(1) + "}" }
	// Heading references: [[#Heading]] or [[Note#Heading]] refer to the section's slug label
	if( hash >= 0 && slugify(target).length > 0 ) { return "\\ref{sec:" + slugify(target) + "}" }
	// Any other link: the text Obsidian would show for it
	const alias = h.data && h.data.alias
	return escapeLatex(alias || url)
}

//For internal links that start with '@'
const extendedCitation = (h:wikiLink,settings:ConversionSettings) =>  {
	const pre = "pre" in h ? (h as any).pre : null
	const post = "post" in h ? (h as any).post : null
	const id = h.value.substring(1)
	var citeText = '\\cite{{{id}}}'
	
	// Bare citation, e.g. `go see [[@ref]] for some stuff`
	if( ( pre === null ) && (post === null) ) {
		citeText = settings.citationTemplates["bare"];
	} 
	// Surrounded citation, e.g. `a bit thing (e.g. [[@ref]] p.37)`
	else if( pre && post ) {
		citeText = settings.citationTemplates["surrounded"];
	}
	// Pre citation `something large (e.g. [[@ref]])`
	else if( pre ) {
		citeText = settings.citationTemplates["pre"];
	}
	// Post citation `some things from the book ([[@ref]], p.37)
	else if( post ) {
		citeText = settings.citationTemplates["post"];
	}
	// Paren citation => citet `some things from Author ([[@ref]])
	else {
		citeText = settings.citationTemplates["paren"];
	}
	
	return fillTemplate(citeText,id,pre,post)
}

// Substitute #id, #pre and #post into one of the citation templates
function fillTemplate(template:string,id:string,pre:string|null,post:string|null) : string {
	return (template || "\\cite{#id}")
		.replace(/#id/g,id || "")
		.replace(/#pre/g,pre || "")
		.replace(/#post/g,post || "")
}

/*
 * Pandoc-style citations, e.g. `[@key, p.149]`, `[see @key1; @key2, ch. 2]` or `@key` in running text.
 * See https://pandoc.org/MANUAL.html#citation-syntax
 */
export interface PandocCitationItem {
	key: string;
	prefix: string;          // text before the key, e.g. "see" in [see @key]
	suffix: string;          // text after the key, e.g. "p.149" in [@key, p.149]
	suppressAuthor: boolean; // [-@key]
}
export interface PandocCitation {
	items: PandocCitationItem[];
	inText: boolean;         // `@key` written in running text rather than in brackets
}
// A piece of text is either literal text or a citation
export type PandocSegment = string | PandocCitation

// A citation key starts with a letter, digit or underscore, and may contain
// internal punctuation as long as each punctuation character is followed by another alphanumeric
const pandocKeyBody = "[A-Za-z0-9_](?:[A-Za-z0-9_]|[:.#$%&\\-+?<>~/](?=[A-Za-z0-9_]))*"
// Either a key as above, or anything at all in braces: @{odd key}
const pandocKey = `(?:\\{([^}]+)\\}|(${pandocKeyBody}))`
// One item inside brackets: prefix, optional '-', '@', key, suffix.
// The '@' must not directly follow a word character, so email addresses are left alone.
const pandocItemMatch = new RegExp(`^([\\s\\S]*?)(^|[^\\w@])(-?)@${pandocKey}([\\s\\S]*)$`)
// A key in running text
const pandocInTextMatch = new RegExp(`^(-?)@${pandocKey}`)
// A locator in brackets straight after an in-text key: `@key [p. 33]`
const pandocLocatorMatch = /^\s*\[([^\[\]]*)\]/

// Parse the content of a [...] group as semicolon-separated citation items.
// Returns null unless every item contains a key - otherwise the bracket is not a citation.
function parsePandocItems(content:string) : PandocCitationItem[] | null {
	const items : PandocCitationItem[] = []
	for( const part of content.split(";") ) {
		const m = pandocItemMatch.exec(part)
		if( !m ) return null
		items.push({
			prefix: (m[1] + m[2]).trim(),
			suppressAuthor: m[3] === "-",
			key: m[4] !== undefined ? m[4] : m[5],
			suffix: m[6].replace(/^\s*,/,"").trim(),
		})
	}
	return items
}

// Split a piece of text into literal strings and pandoc citations
export function parsePandocCitations(text:string) : PandocSegment[] {
	const segments : PandocSegment[] = []
	let literal = ""
	const flush = () => { if( literal.length > 0 ) { segments.push(literal); literal = "" } }
	let i = 0
	while( i < text.length ) {
		const ch = text[i]
		const prev = i > 0 ? text[i-1] : ""
		// Bracketed citation(s): [@a, p.3; see @b]
		if( ch === "[" ) {
			const close = text.indexOf("]",i+1)
			const content = close >= 0 ? text.substring(i+1,close) : null
			const items = ( content !== null && content.indexOf("[") < 0 ) ? parsePandocItems(content) : null
			if( items ) {
				flush()
				segments.push({items, inText:false})
				i = close + 1
				continue
			}
		}
		// In-text citation: @a or -@a, optionally followed by a locator in brackets
		else if( (ch === "@" || (ch === "-" && text[i+1] === "@")) && !/[\w@]/.test(prev) ) {
			const m = pandocInTextMatch.exec(text.substring(i))
			if( m ) {
				let end = i + m[0].length
				let suffix = ""
				const loc = pandocLocatorMatch.exec(text.substring(end))
				// A following bracket is a locator unless it is itself a citation
				if( loc && !parsePandocItems(loc[1]) ) {
					suffix = loc[1].trim()
					end += loc[0].length
				}
				flush()
				segments.push({
					items: [{ key: m[2] !== undefined ? m[2] : m[3], prefix:"", suffix:suffix, suppressAuthor: m[1] === "-" }],
					inText: true
				})
				i = end
				continue
			}
		}
		literal += ch
		i++
	}
	flush()
	return segments
}

// The optional arguments for a biblatex/natbib style command: [pre][post], [pre][] or [post]
function citeOptions(item:PandocCitationItem) : string {
	const pre = escapeLatex(item.prefix), post = escapeLatex(item.suffix)
	if( pre && post ) return `[${pre}][${post}]`
	if( pre ) return `[${pre}][]`
	if( post ) return `[${post}]`
	return ""
}

// Turn a parsed pandoc citation into latex, following the Citation Command setting
const pandocCitation = (c:PandocCitation,settings:ConversionSettings) : string => {
	if( settings.citeCommand === "extended" ) return pandocTemplatedCitation(c,settings)
	const commands : Record<string,string> = { basic:"cite", autocite:"autocite", parencite:"parencite" }
	const cmd = commands[settings.citeCommand] || "cite"
	// Plain \cite has no starred, textual or multi-argument forms; the biblatex commands do
	const biblatex = settings.citeCommand !== "basic"
	const items = c.items
	const keys = items.map(i => i.key).join(",")
	const star = (biblatex && items[0].suppressAuthor) ? "*" : ""
	// `@key` in running text => \textcite{key}
	if( c.inText ) {
		const textCmd = !biblatex ? "cite" : (items[0].suppressAuthor ? cmd + "*" : "textcite")
		return `\\${textCmd}${citeOptions(items[0])}{${keys}}`
	}
	const affixed = items.some(i => i.prefix.length > 0 || i.suffix.length > 0)
	// [@a; @b] => \autocite{a,b}
	if( !affixed ) return `\\${cmd}${star}{${keys}}`
	// [@a, p.3] => \autocite[p.3]{a}
	if( items.length == 1 ) return `\\${cmd}${star}${citeOptions(items[0])}{${keys}}`
	// [@a, p.3; @b] => \autocites[p.3]{a}{b} ...
	if( biblatex ) return `\\${cmd}s${star}` + items.map(i => `${citeOptions(i)}{${i.key}}`).join("")
	// ... or one \cite per item when there is no multi-cite command
	return items.map(i => `\\${cmd}${citeOptions(i)}{${i.key}}`).join("; ")
}

// Pandoc citation rendered with the Extended Citation Templates
function pandocTemplatedCitation(c:PandocCitation,settings:ConversionSettings) : string {
	const templates = settings.citationTemplates
	const items = c.items
	if( c.inText ) {
		const i = items[0]
		return fillTemplate(templates["intext"] || "\\textcite{#id}", i.key, escapeLatex(i.prefix), escapeLatex(i.suffix))
	}
	const affixed = items.some(i => i.prefix.length > 0 || i.suffix.length > 0)
	// No prefixes or suffixes anywhere: all the keys go into one bare citation
	if( !affixed ) return fillTemplate(templates["bare"], items.map(i => i.key).join(","), "", "")
	// Otherwise each item gets its own template, chosen by what surrounds it
	return items.map(i => {
		const typ : citationType = (i.prefix && i.suffix) ? "surrounded" : i.prefix ? "pre" : i.suffix ? "post" : "bare"
		return fillTemplate(templates[typ], i.key, escapeLatex(i.prefix), escapeLatex(i.suffix))
	}).join("; ")
}


// External links: \url{url} for a bare link, \href{url}{text} when the link has its own text
const externalLink = (a:Node,settings:ConversionSettings,indent:number=0) => {
	const l = a as Link
	const text = plainText(a)
	if( text.length === 0 || text === l.url ) return "\\url{" + l.url + "}"
	return "\\href{" + l.url + "}{" + wrapper("","")(a,settings,indent) + "}"
}

const codeBlock = (a:Node,settings:ConversionSettings,indent:number=0) => {
	const cd = a as Code
	if( settings.mintedListings ) {
		return `\\begin{minted}{${cd.lang}}
${cd.value}
\\end{minted}
`
	}
	return `\\begin{lstlisting}[language=${cd.lang}]
${cd.value}
\\end{lstlisting}
`
}

const inlineCode = (a:Node,settings:ConversionSettings,indent:number=0) => {
	const cd = a as InlineCode
	if( settings.inlineDelimiter && settings.inlineDelimiter.length > 0 ) {
		const d = settings.inlineDelimiter
		return `\\lstinline${d}${cd.value}${d}`
	}
	return `\\lstinline{${cd.value}}`
}

// Make sure not to escape anything in the math block
// (and add back in the dollar signs)
const inlineMath = (a:Node,settings:ConversionSettings,indent:number=0) => {
	const v = (a as Literal).value
	// This is a wierd hack - the mdast parser doesn't differentiate between block
	// and inline, so we have to guess by the difference between the length of the
	// value string and the amount of characters it covers in the source
	const difference = a.position.end.offset - a.position.start.offset - v.length
	if( difference > 2 ) return `$$${v}$$`
	else return `$${v}$`
}

const displayMath = (a:Node,settings:ConversionSettings,indent:number=0) => {
	const v = (a as Literal).value
	return `$$\n${v}\n$$`
}

export function findAll(input:Node,cond:{(i:Node): boolean}):Node[] {
	const r:Node[] = cond(input) ? [input] : []
	if( (input as any ).children )
		(input as Parent ).children.forEach(n => r.push(...findAll(n,cond)))
	return r
}

export function findCitations(ast:Node,settings?:ConversionSettings):Set<string> {
	const citationElements = findAll(ast,(n:Node) => {
		if( (n.type as string) != 'wikiLink') return false
		return (n as Literal).value.startsWith("@") 
	})
	const keyList = citationElements.map((n) => (n as Literal).value.replace("@",""))
	const keys = new Set<string>(keyList)
	// With pandoc syntax, citations also hide inside ordinary text nodes
	if( settings && settings.citationSyntax === "pandoc" ) {
		findAll(ast,(n:Node) => n.type === "text").forEach((n) => {
			parsePandocCitations((n as Literal).value).forEach((seg) => {
				if( typeof seg !== "string" ) seg.items.forEach((i) => keys.add(i.key))
			})
		})
	}
	return keys
}

/*
 * Tidy up the AST before conversion:
 * - Obsidian image embeds (![[file.png|caption]]) arrive as plain text, so turn them into image nodes
 * - block ids (^id) after tables, figures and headings are attached to those nodes as labels
 * - with Extended Citations, the text around [[@citations]] is parsed for parentheses
 */
export function preprocessAST(input:any,settings?:ConversionSettings) {
	// instanceof was being funny - should be input instanceof Parent
	if( (input as any).children )  {
		expandEmbeds(input as Parent)
		;(input as Parent).children.forEach((c:any) => { if( c.children ) expandEmbeds(c) })
		hoistLabels(input as Parent)
		if( !settings || settings.citeCommand === "extended" ) {
			const children = (input as Parent).children
			children.forEach( (e,i) => {
				const v = [null,e,null]
				if(i > 0 ) v[0] = children[i-1]
				if(i < children.length - 1 ) v[2] = children[i+1]
				modifyAST(v)
			})
		}
		(input as Parent).children.forEach(c => preprocessAST(c,settings))
	}

}

// Obsidian image embeds: ![[file.png]] or ![[file.png|caption]] (the wiki-link parser leaves these as text)
const embedMatch = /!\[\[([^\]|]+)(?:\|([^\]]*))?\]\]/g
const imageFile = /\.(png|jpe?g|gif|svg|pdf|webp|bmp|tiff?)$/i

function expandEmbeds(parent:Parent) {
	const out:any[] = []
	let changed = false
	for( const child of parent.children as any[] ) {
		if( child.type !== "text" || child.value.indexOf("![[") < 0 ) { out.push(child); continue }
		const v:string = child.value
		let last = 0
		for( const m of v.matchAll(embedMatch) ) {
			if( !imageFile.test(m[1].trim()) ) continue
			changed = true
			if( m.index > last ) out.push({type:"text", value: v.substring(last,m.index)})
			const alias = (m[2] || "").trim()
			// Obsidian uses the alias for a display size (|300 or |300x200), which is not a caption
			out.push({type:"image", url: m[1].trim(), alt: /^\d+(x\d+)?$/.test(alias) ? "" : alias, title: null})
			last = m.index + m[0].length
		}
		if( last < v.length ) out.push({type:"text", value: v.substring(last)})
	}
	if( changed ) parent.children = out
}

// A text node that is nothing but a block id
const idOnly = /^\s*\^([a-zA-Z0-9_:-]+)\s*$/
const isLabelParagraph = (n:any) => n && n.type === "paragraph" && n.children.length === 1
	&& n.children[0].type === "text" && idOnly.test(n.children[0].value)

function hoistLabels(parent:Parent) {
	const children = parent.children as any[]
	let i = 0
	while( i < children.length ) {
		const node = children[i]
		const next = children[i+1]
		// A block id written as a last one-cell row of a table (no blank line before it)
		if( node.type === "table" && node.children.length > 1 ) {
			const cells = node.children[node.children.length-1].children
			const first = cells[0]
			if( first && first.children.length === 1 && first.children[0].type === "text"
				&& idOnly.test(first.children[0].value)
				&& cells.slice(1).every((c:any) => c.children.length === 0) ) {
				node.label = idOnly.exec(first.children[0].value)[1]
				node.children.pop()
			}
		}
		// `## Heading ^id`
		if( node.type === "heading" && node.children.length > 0 ) {
			const last = node.children[node.children.length-1]
			const m = last.type === "text" ? labelMatch.exec(last.value) : null
			if( m ) { node.label = m[2]; last.value = last.value.substring(0,m.index) }
		}
		// A block id in its own paragraph after a table
		if( node.type === "table" && isLabelParagraph(next) ) {
			node.label = idOnly.exec(next.children[0].value)[1]
			children.splice(i+1,1)
		}
		if( node.type === "paragraph" ) {
			const kids = node.children
			// `![[fig.png]] ^id`: the image and its block id are the whole paragraph
			if( kids.length === 2 && kids[0].type === "image" && kids[1].type === "text" && idOnly.test(kids[1].value) ) {
				kids[0].label = idOnly.exec(kids[1].value)[1]
				kids.pop()
			}
			// A paragraph holding just an image: a block id in the next paragraph labels it,
			// and the figure then stands on its own rather than inside a paragraph
			if( kids.length === 1 && kids[0].type === "image" ) {
				if( isLabelParagraph(next) ) {
					kids[0].label = idOnly.exec(next.children[0].value)[1]
					children.splice(i+1,1)
				}
				children[i] = kids[0]
			}
		}
		// A block id straight after an inline image: ![[fig.png]] ^id
		if( node.type === "image" && next && next.type === "text" && idOnly.test(next.value) ) {
			node.label = idOnly.exec(next.value)[1]
			children.splice(i+1,1)
		}
		i++
	}
}


export function modifyAST(input:Node[]) {
	// For some reason, the type system is being hinky here - doesn't think wikiLink is part of type
	if( input[1] && (input[1].type as string === "wikiLink" ) ) {
		//console.log(`Working with: '${input[0] ? (input[0] as any).value : "<none>"}' : "${(input[1] as any).value}" : "${input[2] ? (input[2] as any).value : "<none>"}"`)
		if( input[0] && input[0].type === "text") {
			const i = (input[0] as Literal)
			const m = i.value.match(preCiteMatch)
			if(m) {
				//console.log(`Pre match: '${m[1]}':'${m[2]}'`)
				i.value = m[1];
				(input[1] as any).pre = m[2].trim()
			}
		}
		if( input[2] && input[2].type === "text") {
			const i = (input[2] as Literal)
			const m = i.value.match(postCiteMatch)
			if(m) {
				//console.log(`Post match: '${m[1]}':'${m[2]}'`)
				i.value = m[2];
				(input[1] as any).post = m[1].trim()
			}
		}
	}
}
