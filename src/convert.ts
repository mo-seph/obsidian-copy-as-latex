import { App, Editor, Modal, Notice, Plugin, PluginSettingTab, Setting } from 'obsidian';
import {fromMarkdown} from 'mdast-util-from-markdown'

import { syntax } from 'micromark-extension-wiki-link'
import * as wikiLink from 'mdast-util-wiki-link'
import {gfm} from 'micromark-extension-gfm'
import {gfmFromMarkdown, gfmToMarkdown} from 'mdast-util-gfm'

import { Code, Heading, InlineCode, Link, List, Node, Parent } from 'mdast-util-from-markdown/lib';
import { Literal } from 'mdast';

export interface ConversionSettings {
	inlineDelimiter:string;
	mintedListings: boolean;
}
// Conversions go from a Node with a certain amount of indentation to a string
type Convert = (a:Node,settings:ConversionSettings,indent:number) => string


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

const defaultC : Convert = (a:Node,settings:ConversionSettings,indent:number=0) => {return (a as Literal).value};
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
	if(url.startsWith("@") ) { return "\\cite{" + url.substring(1) + "}" }
	if(url.startsWith("^") ) { return "\\ref{" + url.substring(1) + "}" }
	return url 
}
const externalLink = (a:Node,settings:ConversionSettings,indent:number=0) => {
	const l = a as Link
	console.log("Got a link!")
	console.log(a)
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

