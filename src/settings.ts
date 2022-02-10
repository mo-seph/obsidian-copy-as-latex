/* No settings provided yet... */

import { App, PluginSettingTab, Setting, TextComponent } from "obsidian";
import { citationType, citeCommand, ConversionSettings } from "./convert";
import CopyAsLatexPlugin from "./main";

export interface CopyAsLatexPluginSettings extends ConversionSettings {
	logOutput: boolean;
	copyWhole: boolean;
	bibtexFile: string;
}

export const DEFAULT_SETTINGS: CopyAsLatexPluginSettings = {
	logOutput: false,
	copyWhole: true,
	inlineDelimiter:"",
	mintedListings: false,
	citeCommand : 'autocite',
	bibtexFile: "",
	citationTemplates: {
		"bare" : "\\citep{#id}",
		"surrounded" : "\\cite[#pre][#post]{#id}}",
		"pre" : "\\cite[#pre]{#id}}" ,
		"post" : "\\cite[#post]{#id}}",
		"paren" : "\\citet{#id}"
	}
}

export const citationExplanations : Record<citationType,string> = {
	"bare" : "Bare citation: `... is clearly shown [[@foo]].`",
	"paren" : "Parenthetical: `Author ([[@ref]]) says...`",
	"pre" : "Pre-text: `some people (e.g. [[@ref]]) say ...`" ,
	"post" : "Post-text: `... from the book ([[@ref]] p.29)`",
	"surrounded" : "Pre and post: `can find examples (e.g. [[@ref]] p.29)`",
}


const citationSets : Record<string,Record<citationType,string>> = {
	"Default" : {
		"bare" : "\\cite{#id}",
		"surrounded" : "\\cite[#pre][#post]{#id}",
		"pre" : "\\cite[#pre][]{#id}" ,
		"post" : "\\cite[#post]{#id}",
		"paren" : "\\cite{#id}"	
	},
	"Autocite" : {
		"bare" : "\\autocite{#id}",
		"surrounded" : "\\autocite[#pre][#post]{#id}",
		"pre" : "\\autocite[#pre][]{#id}" ,
		"post" : "\\autocite[#post]{#id}",
		"paren" : "\\citeyear{#id}"	
	},
	"Natbib" : {
		"bare" : "\\citep{#id}",
		"surrounded" : "\\cite[#pre][#post]{#id}",
		"pre" : "\\cite[#pre][]{#id}" ,
		"post" : "\\cite[#post]{#id}",
		"paren" : "\\citet{#id}"	
	},
	"Brute-Force" : {
		"bare" : "\\cite{#id}",
		"surrounded" : "(#pre \\cite{#id} #post)",
		"pre" : "(#pre \\cite{#id}})" ,
		"post" : "(\\cite{#id}} #post)",
		"paren" : "(\\cite{#id})"	
	},
	"Testing" : {
		"bare" : "\\cite{#id} BARE",
		"surrounded" : "(#pre \\cite{#id} #post) SURR",
		"pre" : "(#pre \\cite{#id}}) PRE" ,
		"post" : "(\\cite{#id}} #post) POST",
		"paren" : "\\cite{#id} PAREN"	
	}
}


export default class CopyAsLatexSettingTab extends PluginSettingTab {
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
		const options : Record<citeCommand,string>  = {
			"basic":"Basic - \\cite{@foo}",
			"autocite":"Autocite - \\autocite{@foo}",
			"parencite":"Paren Cite - \\parencite{@foo}",
            "extended":"Extended Citations - commands below"
		}
		new Setting(containerEl)
		.setName('Citation Command')
		.setDesc('What command to use for citations?')
		.addDropdown(dropdown => dropdown
			.addOptions(options)
			.setValue(this.plugin.settings.citeCommand)
			.onChange(async (value:citeCommand) => {
				this.plugin.settings.citeCommand = value;
				await this.plugin.saveSettings();
			}));	

  /*
		new Setting(containerEl)
		.setName('Extended Citation parsing')
		.setDesc('Tries to do some clever parsing of text for complex citations. Overrides citation type above')
		.addToggle(toggle => toggle
			.setValue(this.plugin.settings.extendedCitations)
			.onChange(async (value) => {
				this.plugin.settings.extendedCitations = value;
				await this.plugin.saveSettings();
			}));
            */
 
		const textFields : Record<string,TextComponent> = {}
		const citationSet = new Setting(containerEl)
			.setName('Extended Citation Templates')
			.setDesc('Templates for new citation technique; they make available {{id}}, {{pre}}, {{post}} tags')
			.addDropdown(dropdown => {
				for( const k in citationSets ) { dropdown.addOption(k,k)}
				dropdown
				.setValue("Default")
				.onChange(async (value:string) => {
					const templs = citationSets[value]
					this.plugin.settings.citationTemplates = templs;
					for( const k in templs) {
						textFields[k].setValue( templs[k as citationType] )
					}
					await this.plugin.saveSettings();
				})
		});
		for( const k in citationExplanations ) {
			const typ = k as citationType
			new Setting(containerEl)
			.setName(k + ' Citation')
			.setDesc(citationExplanations[typ])
			.addText(text => {text
				.setValue(this.plugin.settings.citationTemplates[typ])
				.onChange(async (value) => {
					this.plugin.settings.citationTemplates[typ] = value;
					await this.plugin.saveSettings();
				})
				textFields[typ] = text
			});	
		}
	
		new Setting(containerEl)
		.setName('BibTex file Copy Citations')
		.setDesc('! Set a bibtex file here relative to Vault root, and then you can copy citations from it if they are missing in a target bibliography on the clipboard')
		.addText(text => text
			.setValue(this.plugin.settings.bibtexFile)
			.onChange(async (value) => {
				this.plugin.settings.bibtexFile = value;
				await this.plugin.saveSettings();
			}))
	}
}