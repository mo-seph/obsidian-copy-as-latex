import { App, Editor, Modal, Notice, Plugin, PluginSettingTab, Setting, EditorPosition, FileSystemAdapter, TextComponent } from 'obsidian';
import {fromMarkdown} from 'mdast-util-from-markdown'



import { Code, Heading, Link, List, Node, Parent } from 'mdast-util-from-markdown/lib';
import { Literal } from 'mdast';
import {ASTtoString,ConversionSettings, preprocessAST,citeCommand, findAll, findCitations, citationType, remarkSetup as parserSetup} from './convert'
import * as path from 'path';
import { BibtexConverter } from './bibtex';
import CopyAsLatexSettingTab, { CopyAsLatexPluginSettings, DEFAULT_SETTINGS } from './settings';

export default class CopyAsLatexPlugin extends Plugin {
	settings: CopyAsLatexPluginSettings; 
	bibtex: BibtexConverter = new BibtexConverter()
	remarkSetup = parserSetup

	async onload() {
		console.log('loading Copy as Latex');
		await this.loadSettings();
		this.addCommand({
			id: 'copy-as-latex',
			name: 'Copy as Latex',
			editorCallback: (editor, _) => this.markdownToLatex(editor)
		});
		this.addCommand({
			id: 'latex-citations',
			name: 'Copy Missing Citations',
			editorCallback: (editor, _) => this.copyMissingCitations(editor)
		});
		this.addSettingTab(new CopyAsLatexSettingTab(this.app, this));
	}

	markdownToLatex(editor:Editor) {
		let text = editor.getSelection();
		if(text.length == 0 && this.settings.copyWhole) text = editor.getRange({line:0,ch:0},{line:(editor.lastLine()+1),ch:0})
		if( this.settings.logOutput ) {console.log(text); }
		const ast:Node = fromMarkdown(text, this.remarkSetup);
		if( this.settings.logOutput ) {console.log(ast);}
		preprocessAST(ast,this.settings)
		if( this.settings.logOutput ) {console.log("New AST:",ast);}
		const result = ASTtoString(ast,this.settings)
		if( this.settings.logOutput ) {console.log(result);}
		navigator.clipboard.writeText(result)
		return true;
	}

	async copyMissingCitations(editor:Editor) {
		let text = editor.getSelection();
		if(text.length == 0 && this.settings.copyWhole) text = editor.getRange({line:0,ch:0},{line:(editor.lastLine()+1),ch:0})
		const ast:Node = fromMarkdown(text, this.remarkSetup);
		const keysInDoc = findCitations(ast,this.settings)
		console.log("Citations in document",keysInDoc)
		const myBibFile = this.resolveLibraryPath(this.settings.bibtexFile)
		console.log("Bib file:",myBibFile)
		const myBib = await FileSystemAdapter.readLocalFile(myBibFile) 
		//console.log("Got bibliography",myBib)
		// Decode file as UTF-8.
		const dataView = new DataView(myBib);
		const decoder = new TextDecoder('utf8');
		const value = decoder.decode(dataView);
		//console.log("Got bibliography",value)
		const sourceBibliography = this.bibtex.parseBibtex(value)
		//console.log("Source bibliography keys",Object.keys(sourceBibliography))

		const destBibliography:Record<string,string> = 
			this.bibtex.parseBibtex(await navigator.clipboard.readText())
		console.log("Destination bibliography keys",Object.keys(destBibliography))

		for( const k in destBibliography) {
			console.log("Citation found in target:",k)
			keysInDoc.delete(k)
		} 

		console.log("Keys in document missing from target: ",keysInDoc)
		const toAdd:string[] = [];
		const found:string[] = []
		const missing:string[] = [];

		[...keysInDoc].forEach((k) => {
			if( sourceBibliography[k]) {
				found.push(k)
				toAdd.push(sourceBibliography[k])
			} else {
				missing.push(k)
			}
		} )
		console.log("Found keys: ",found)
		console.log("Missing keys: ",missing)
		const final = toAdd.join("\n")
		console.log("Final:",final)
		navigator.clipboard.writeText(final)
		//forEach((k:string,v:string)=> keysInDoc.delete(k))
		//const missingKeys = keysInDoc.
	}

	 /**
   * Resolve a provided library path, allowing for relative paths rooted at
   * the vault directory.
   * From https://github.com/hans/obsidian-citation-plugin/blob/master/src/main.ts
   */
	  resolveLibraryPath(rawPath: string): string {
		const vaultRoot =
		  this.app.vault.adapter instanceof FileSystemAdapter
			? this.app.vault.adapter.getBasePath()
			: '/';
		return path.resolve(vaultRoot, rawPath);
	  }

	onunload() {
		console.log('unloading plugin');
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
		// Templates added in later versions (e.g. intext) get their defaults if the saved settings lack them
		this.settings.citationTemplates = Object.assign({}, DEFAULT_SETTINGS.citationTemplates, this.settings.citationTemplates);
		// Copy the template list so that editing it never changes the defaults
		this.settings.codeBlockTemplates = (this.settings.codeBlockTemplates || []).map((t) => Object.assign({}, t));
		this.settings.namedCitations = (this.settings.namedCitations || []).map((t) => Object.assign({}, t));
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}


