import { App, Editor, Modal, Notice, Plugin, PluginSettingTab, Setting } from 'obsidian';
import {fromMarkdown} from 'mdast-util-from-markdown'

import { syntax } from 'micromark-extension-wiki-link'
import * as wikiLink from 'mdast-util-wiki-link'
import {gfm} from 'micromark-extension-gfm'
import {gfmFromMarkdown, gfmToMarkdown} from 'mdast-util-gfm'

import { Code, Heading, Link, List, Node, Parent } from 'mdast-util-from-markdown/lib';
import { Literal } from 'mdast';
import {ASTtoString} from './convert'


export default class CopyAsLatexPlugin extends Plugin {
	settings: CopyAsLatexPluginSettings; 
	remarkSetup = {
		extensions: [syntax(),gfm()],
		mdastExtensions: [wikiLink.fromMarkdown(),gfmFromMarkdown()]
	}

	async onload() {
		console.log('loading Copy as Latex');
		//await this.loadSettings();
		this.addCommand({
			id: 'copy-as-latex',
			name: 'Copy as Latex',
			editorCallback: (editor, _) => this.markdownToLatex(editor)
		});
		this.addSettingTab(new CopyAsLatexSettingTab(this.app, this));
	}

	markdownToLatex(editor:Editor) {
		let text = editor.getSelection();
		//console.log(text);
		const ast:Node = fromMarkdown(text, this.remarkSetup);
		console.log(ast)
		const result = ASTtoString(ast)
		console.log(result)
		navigator.clipboard.writeText(result)
		return true;
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

interface CopyAsLatexPluginSettings {
	mySetting: string;
}

const DEFAULT_SETTINGS: CopyAsLatexPluginSettings = {
	mySetting: 'default'
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