import { App, Editor, Modal, Notice, Plugin, PluginSettingTab, Setting, EditorPosition, FileSystemAdapter } from 'obsidian';
import {fromMarkdown} from 'mdast-util-from-markdown'

// @ts-ignore - not sure how to build a proper typescript def yet
import { syntax } from 'micromark-extension-wiki-link'
// @ts-ignore - not sure how to build a proper typescript def yet
import * as wikiLink from 'mdast-util-wiki-link'
import {gfm} from 'micromark-extension-gfm'
import {gfmFromMarkdown, gfmToMarkdown} from 'mdast-util-gfm'
import {math} from 'micromark-extension-math'
import {mathFromMarkdown, mathToMarkdown} from 'mdast-util-math'


import { Code, Heading, Link, List, Node, Parent } from 'mdast-util-from-markdown/lib';
import { Literal } from 'mdast';
import {ASTtoString,ConversionSettings, preprocessAST,citeType, findAll, findCitations} from './convert'
import * as path from 'path';
import { BibtexConverter } from './bibtex';

export default class CopyAsLatexPlugin extends Plugin {
	settings: CopyAsLatexPluginSettings; 
	bibtex: BibtexConverter = new BibtexConverter()
	remarkSetup = {
		extensions: [syntax(),gfm(),math()],
		mdastExtensions: [wikiLink.fromMarkdown(),gfmFromMarkdown(),mathFromMarkdown()]
	}

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
		if( this.settings.experimentalCitations ) preprocessAST(ast)
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
		const keysInDoc = findCitations(ast)
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
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}


/* No settings provided yet... */

export interface CopyAsLatexPluginSettings extends ConversionSettings {
	logOutput: boolean;
	copyWhole: boolean;
	bibtexFile: string;
}

const DEFAULT_SETTINGS: CopyAsLatexPluginSettings = {
	logOutput: false,
	copyWhole: true,
	inlineDelimiter:"",
	mintedListings: false,
	experimentalCitations:false,
	citeType : 'autocite',
	citeTemplate:"\\cite{{[pre]}}{{[post]}}{{{id}}}",
	bibtexFile: ""
}

class CopyAsLatexSettingTab extends PluginSettingTab {
	plugin: CopyAsLatexPlugin;

	constructor(app: App, plugin: CopyAsLatexPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		let {containerEl} = this;

		containerEl.empty();

		containerEl.createEl('h2', {text: 'Settings for Copy as Latex'});

		new Setting(containerEl)
		.setName('Log Output')
		.setDesc('Should the plugin log output to the Console - mostly just for debugging')
		.addToggle(toggle => toggle
			.setValue(this.plugin.settings.logOutput)
			.onChange(async (value) => {
				this.plugin.settings.logOutput = value;
				await this.plugin.saveSettings();
			}));
		const options : Record<citeType,string>  = {
			"basic":"Basic - \\cite{@foo}",
			"autocite":"Autocite - \\autocite{@foo}",
			"parencite":"Paren Cite - \\parencite{@foo}",
		}
		new Setting(containerEl)
		.setName('Citation type')
		.setDesc('What command to use for citations?')
		.addDropdown(dropdown => dropdown
			.addOptions(options)
			.setValue(this.plugin.settings.citeType)
			.onChange(async (value:citeType) => {
				this.plugin.settings.citeType = value;
				await this.plugin.saveSettings();
			}));	
		new Setting(containerEl)
		.setName('Minted Output')
		.setDesc('Use the minted package for code listings? (Note: - not used for inline code at the moment)')
		.addToggle(toggle => toggle
			.setValue(this.plugin.settings.mintedListings)
			.onChange(async (value) => {
				this.plugin.settings.mintedListings = value;
				await this.plugin.saveSettings();
			}));		
		new Setting(containerEl)
		.setName('Inline delimiters')
		.setDesc('What delimiters to use for inline lstlistings? Default is curly braces ')
		.addText(text => text
			.setValue(this.plugin.settings.inlineDelimiter)
			.onChange(async (value) => {
				this.plugin.settings.inlineDelimiter = value;
				await this.plugin.saveSettings();
			}));
		new Setting(containerEl)
		.setName('Copy whole note')
		.setDesc('If nothing is selected, should the plugin copy the whole note as latex?')
		.addToggle(toggle => toggle
			.setValue(this.plugin.settings.copyWhole)
			.onChange(async (value) => {
				this.plugin.settings.copyWhole = value;
				await this.plugin.saveSettings();
			}));
		new Setting(containerEl)
		.setName('Experimental Citation parsing')
		.setDesc('! Danger - may not work - tries to do some clever parsing of text for complex citations. Overrides citation type above')
		.addToggle(toggle => toggle
			.setValue(this.plugin.settings.experimentalCitations)
			.onChange(async (value) => {
				this.plugin.settings.experimentalCitations = value;
				await this.plugin.saveSettings();
			}));
		new Setting(containerEl)
		.setName('Experimental Citation template')
		.setDesc('! Template for experimental citations.')
		.addText(text => text
			.setValue(this.plugin.settings.citeTemplate)
			.onChange(async (value) => {
				this.plugin.settings.citeTemplate = value;
				await this.plugin.saveSettings();
			}));
		containerEl.createDiv({text:'Example citation templates would be: \n"\\cite{{[pre]}}{{[post]}}{{{id}}}" for natbib, \n"\\autocite{{(pre)}}{{[post]}}{{{id}}}" '})
		new Setting(containerEl)
		.setName('Experimental BibTex file Copy Citations')
		.setDesc('! Set a bibtex file here relative to Vault root, and then you can copy citations from it if they are missing in a target bibliography on the clipboard')
		.addText(text => text
			.setValue(this.plugin.settings.bibtexFile)
			.onChange(async (value) => {
				this.plugin.settings.bibtexFile = value;
				await this.plugin.saveSettings();
			}))
	}
}