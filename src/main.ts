import { App, Editor, Modal, Notice, Plugin, PluginSettingTab, Setting } from 'obsidian';
import {fromMarkdown} from 'mdast-util-from-markdown'

import { syntax } from 'micromark-extension-wiki-link'
import * as wikiLink from 'mdast-util-wiki-link'
import {gfm} from 'micromark-extension-gfm'
import {gfmFromMarkdown, gfmToMarkdown} from 'mdast-util-gfm'

import { Code, Heading, Link, List, Node, Parent } from 'mdast-util-from-markdown/lib';
import { Literal } from 'mdast';
//import { clipboard } from 'electron'

const electron = require('electron')
const clipboard = electron.clipboard;

interface MyPluginSettings {
	mySetting: string;
}

const DEFAULT_SETTINGS: MyPluginSettings = {
	mySetting: 'default'
}


export default class MyPlugin extends Plugin {
	settings: MyPluginSettings; 

	async onload() {
		//console.log('loading Copy as Latex');
		await this.loadSettings();
		this.addCommand({
			id: 'copy-as-latex',
			name: 'Copy as Latex',
			editorCallback: (editor, _) => this.markdownToLatex(editor)
		});
		//this.addSettingTab(new SampleSettingTab(this.app, this));
	}

	/*
	onunload() {
		console.log('unloading plugin');
	}
	*/

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	markdownToLatex(editor:Editor) {
		let text = editor.getSelection();
		//console.log(text);
		const ast:Node = fromMarkdown(text, {
			extensions: [syntax(),gfm()],
			mdastExtensions: [wikiLink.fromMarkdown(),gfmFromMarkdown()]
		});
		//console.log(ast);
		const result = this.ASTtoString(ast)
		console.log(result)
		clipboard.writeText(result)
		return true;
	}

	ASTtoString(input:Node,indent:number=0) : string {
		var t = input.type;
		type Convert = (a:Node) => string
		const defaultC : Convert = (a:Node) => {return (a as Literal).value};
		const wrapper = (jn:string,aft:string,ind=0) => (a:Node) => {return (
			(a as Parent).children.map((c) => this.ASTtoString(c,ind)).join(jn)) + aft};
		const heading = (a:Node) => {
			const h = a as Heading
			var sec = "section"
			if( h.depth == 2 ) sec = "subsection"
			if( h.depth == 3 ) sec = "subsubsection"
			return "\\" + sec + "{" + this.ASTtoString((a as Parent).children[0]) + "}\n"
		}

		const list = (a:Node) => {
			const h = a as List
			var sec = h.ordered ? "enumerate" : "itemize"
			return "\t".repeat(indent) + "\\begin{" + sec + "}\n" + 
				wrapper("","",indent+1)(a) +
				"\t".repeat(indent) + "\\end{" + sec + "}\n"
		}
		const internalLink = (a:Node) => {
			const h = a as wikiLink
			const url:string = h.value
			if(url.startsWith("@") ) { return "\\cite{" + url.substring(1) + "}" }
			if(url.startsWith("^") ) { return "\\ref{" + url.substring(1) + "}" }
			return url 
		}
		const externalLink = (a:Node) => {
			const l = a as Link
			console.log("Got a link!")
			console.log(a)
			return "\\url{" + l.url + "}"
		}
		
		const code = (a:Node) => {
			const cd = a as Code
			return `\\begin{lstlisting}[language=${cd.lang}]
${cd.value}
\\end{lstlisting}
`
		}

		const transforms : { [key:string] : Convert } = {
			'root': wrapper("\n",""),
			'paragraph': wrapper("","\n"),
			'emphasis': (a:Node) => {return "\\emph{" + wrapper("","")(a) + "}"},
			'strong': (a:Node) => {return "\\textbf{" + wrapper("","")(a) + "}"},
			'delete': (a:Node) => {return "\\st{" + wrapper("","")(a) + "}"},
			'footnote': (a:Node) => {return "\\footnote{" + wrapper("","")(a) + "}"},
			'list' : list,
			'listItem': (a:Node) => {return "\t".repeat(indent) + "\\item " + wrapper("","",indent)(a) },
			'heading': heading,
			'wikiLink': internalLink,
			'link': externalLink,
			'code': code
		}
		const f:Convert = transforms[input.type] || defaultC
		const trans = f(input)
		return   trans
	}
}

/*
class SampleSettingTab extends PluginSettingTab {
	plugin: MyPlugin;

	constructor(app: App, plugin: MyPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		let {containerEl} = this;

		containerEl.empty();

		containerEl.createEl('h2', {text: 'Settings for my awesome plugin.'});

		new Setting(containerEl)
			.setName('Setting #1')
			.setDesc('It\'s a secret')
			.addText(text => text
				.setPlaceholder('Enter your secret')
				.setValue(this.plugin.settings.mySetting)
				.onChange(async (value) => {
					console.log('Secret: ' + value);
					this.plugin.settings.mySetting = value;
					await this.plugin.saveSettings();
				}));
	}
}
*/