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

export type citeType = "basic" | "autocite" | "parencite"

export interface ConversionSettings {
	inlineDelimiter:string;
	mintedListings: boolean;
	citeType: citeType
	citeTemplate:string;
	experimentalCitations:boolean;
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
		'inlineCode': inlineCode
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
	return v
};
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
		if( settings.experimentalCitations ) {
			const pre = (h as any).pre ? (h as any).pre : null
			const post = (h as any).post ? (h as any).post : null
			const id = url.substring(1)
			let citation = settings.citeTemplate
			citation = citation.replace(/{{id}}/,id)
			citation = citation.replace(/{{([^}]?)pre([^{]?)}}/,pre ? `$1${pre}$2` : "")
			citation = citation.replace(/{{([^}]?)post([^{]?)}}/,post ? `$1${post}$2` : "")
			return citation
		}
		else {
			if(settings.citeType == "basic") return "\\cite{" + url.substring(1) + "}" ;
			else if(settings.citeType == "autocite") return "\\autocite{" + url.substring(1) + "}" 
			else if(settings.citeType == "parencite") return "\\parencite{" + url.substring(1) + "}" 
		}
	}
	if(url.startsWith("^") ) { return "\\ref{" + url.substring(1) + "}" }
	return url 
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
				(input[1] as any).pre = m[2]
			}
		}
		if( input[2] && input[2].type === "text") {
			const i = (input[2] as Literal)
			const m = i.value.match(postCiteMatch)
			if(m) {
				//console.log(`Post match: '${m[1]}':'${m[2]}'`)
				i.value = m[2];
				(input[1] as any).post = m[1]
			}
		}
	}
}
