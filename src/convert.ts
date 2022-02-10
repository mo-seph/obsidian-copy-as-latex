import { App, Editor, Modal, Notice, Plugin, PluginSettingTab, Setting } from 'obsidian';
import {fromMarkdown} from 'mdast-util-from-markdown'

// @ts-ignore - not sure how to build a proper typescript def yet
import { syntax } from 'micromark-extension-wiki-link'
// @ts-ignore - not sure how to build a proper typescript def yet
import * as wikiLink from 'mdast-util-wiki-link'
import {gfm} from 'micromark-extension-gfm'
import {gfmFromMarkdown, gfmToMarkdown} from 'mdast-util-gfm'

import { Code, Heading, InlineCode, Link, List, Node, Parent } from 'mdast-util-from-markdown/lib';
import { Literal } from 'mdast';

export type citeCommand = "basic" | "autocite" | "parencite" | "extended"
export type citationType = "bare" | "surrounded" | "pre" | "post" | "paren"

export interface ConversionSettings {
	inlineDelimiter:string;
	mintedListings: boolean;
	citeCommand: citeCommand
	citationTemplates:Record<citationType,string>;
}
// Conversions go from a Node with a certain amount of indentation to a string
type Convert = (a:Node,settings:ConversionSettings,indent:number) => string

const labelMatch = /\^([a-zA-Z0-9-_:]*)\s*$/
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

	const lm = labelMatch.exec(v)
	if( lm && lm.length > 0 ) return `\\label{${lm[1]}}`
	if( !v ) return ""
	return escapeLatex(v)
};

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
	return "\\" + sec + "{" + ASTtoString((a as Parent).children[0],settings) + "}\n"
}

const list = (a:Node,settings:ConversionSettings,indent:number=0) => {
	const h = a as List
	var sec = h.ordered ? "enumerate" : "itemize"
	return "\t".repeat(indent) + "\\begin{" + sec + "}\n" + 
		wrapper("","")(a,settings,indent+1) +
		"\t".repeat(indent) + "\\end{" + sec + "}\n"
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
	if(url.startsWith("^") ) { return "\\ref{" + url.substring(1) + "}" }
	return url 
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
	
	//let citation = settings.citeTemplate
	citeText = citeText.replace(/#id/,id || "")
	citeText = citeText.replace(/#pre/,pre || "")
	citeText = citeText.replace(/#post/,post || "")
	//console.log("From",h)
	//console.log("Got: ",citeText)
	return citeText	 || ""
}

const externalLink = (a:Node,settings:ConversionSettings,indent:number=0) => {
	const l = a as Link
	return "\\url{" + l.url + "}"
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

export function findCitations(ast:Node):Set<string> {
	const citationElements = findAll(ast,(n:Node) => {
		if( (n.type as string) != 'wikiLink') return false
		return (n as Literal).value.startsWith("@") 
	})
	const keyList = citationElements.map((n) => (n as Literal).value.replace("@",""))
	return new Set<string>(keyList)
}

export function preprocessAST(input:any) {
	// instanceof was being funny - should be input instanceof Parent
	if( (input as any).children )  {
		const children = (input as Parent).children
		children.forEach( (e,i) => {
			const v = [null,e,null]
			if(i > 0 ) v[0] = children[i-1]
			if(i < children.length - 1 ) v[2] = children[i+1]
			modifyAST(v)
		})
		children.forEach(c => preprocessAST(c))
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
