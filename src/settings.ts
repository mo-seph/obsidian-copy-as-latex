import { App, PluginSettingTab, Setting, TextComponent } from "obsidian";
import { citationSyntax, citationType, citeCommand, ConversionSettings, tableEnvironment } from "./convert";
import CopyAsLatexPlugin from "./main";

export interface CopyAsLatexPluginSettings extends ConversionSettings {
	logOutput: boolean;
	copyWhole: boolean;
	bibtexFile: string;
}

// Shown next to each template in the settings, so people know which form it covers
export const citationExplanations : Record<citationType,string> = {
	"bare" : "Bare citation: `... is clearly shown [[@foo]].` or `[@foo]`",
	"paren" : "Parenthetical: `Author ([[@ref]]) says...` (wiki links only)",
	"pre" : "Pre-text: `some people (e.g. [[@ref]]) say ...` or `[e.g. @ref]`" ,
	"post" : "Post-text: `... from the book ([[@ref]] p.29)` or `[@ref, p.29]`",
	"surrounded" : "Pre and post: `can find examples (e.g. [[@ref]] p.29)` or `[e.g. @ref, p.29]`",
	"intext" : "In text (pandoc only): `@ref says ...`. #post holds a locator in brackets: `@ref [p.29] says ...`",
}

// Preset template sets; #id, #pre and #post are substituted
export const citationSets : Record<string,Record<citationType,string>> = {
	"Default" : {
		"bare" : "\\cite{#id}",
		"surrounded" : "\\cite[#pre][#post]{#id}",
		"pre" : "\\cite[#pre][]{#id}" ,
		"post" : "\\cite[#post]{#id}",
		"paren" : "\\cite{#id}",
		"intext" : "\\textcite{#id}",
	},
	"Autocite" : {
		"bare" : "\\autocite{#id}",
		"surrounded" : "\\autocite[#pre][#post]{#id}",
		"pre" : "\\autocite[#pre][]{#id}" ,
		"post" : "\\autocite[#post]{#id}",
		"paren" : "\\citeyear{#id}",
		"intext" : "\\textcite{#id}",
	},
	"Natbib" : {
		"bare" : "\\citep{#id}",
		"surrounded" : "\\cite[#pre][#post]{#id}",
		"pre" : "\\cite[#pre][]{#id}" ,
		"post" : "\\cite[#post]{#id}",
		"paren" : "\\citet{#id}",
		"intext" : "\\citet{#id}",
	},
	"Brute-Force" : {
		"bare" : "\\cite{#id}",
		"surrounded" : "(#pre \\cite{#id} #post)",
		"pre" : "(#pre \\cite{#id}})" ,
		"post" : "(\\cite{#id}} #post)",
		"paren" : "(\\cite{#id})",
		"intext" : "\\cite{#id}",
	},
	"Testing" : {
		"bare" : "\\cite{#id} BARE",
		"surrounded" : "(#pre \\cite{#id} #post) SURR",
		"pre" : "(#pre \\cite{#id}}) PRE" ,
		"post" : "(\\cite{#id}} #post) POST",
		"paren" : "\\cite{#id} PAREN",
		"intext" : "\\cite{#id} INTEXT",
	}
}

export const DEFAULT_SETTINGS: CopyAsLatexPluginSettings = {
	logOutput: false,
	copyWhole: true,
	inlineDelimiter:"",
	mintedListings: false,
	citeCommand : 'autocite',
	citationSyntax: 'wikilink',
	tableEnvironment: 'tabular',
	tableFloat: true,
	labelSections: true,
	bibtexFile: "",
	citationTemplates: Object.assign({}, citationSets["Default"]),
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

		new Setting(containerEl).setName('Tables').setHeading();

		const tableOptions : Record<tableEnvironment,string> = {
			"tabular": "tabular - natural column widths",
			"tabulary": "tabulary - columns wrap to fit the line width",
		}
		new Setting(containerEl)
		.setName('Table environment')
		.setDesc(createFragment((f) => {
			f.appendText('Markdown tables become booktabs tables, so include ')
			f.createEl('code', {text: '\\usepackage{booktabs}'})
			f.appendText(' in your document. tabular gives each column its natural width; tabulary spreads the columns over the line width and wraps long cells, and needs ')
			f.createEl('code', {text: '\\usepackage{tabulary}'})
			f.appendText('.')
		}))
		.addDropdown(dropdown => dropdown
			.addOptions(tableOptions)
			.setValue(this.plugin.settings.tableEnvironment)
			.onChange(async (value:tableEnvironment) => {
				this.plugin.settings.tableEnvironment = value;
				await this.plugin.saveSettings();
			}));
		new Setting(containerEl)
		.setName('Wrap tables in a float')
		.setDesc(createFragment((f) => {
			f.appendText('Put each table inside ')
			f.createEl('code', {text: '\\begin{table}[htbp]'})
			f.appendText(' with ')
			f.createEl('code', {text: '\\centering'})
			f.appendText(' and an empty ')
			f.createEl('code', {text: '\\caption{}'})
			f.appendText(' above it to fill in. Turn off to get just the tabular.')
		}))
		.addToggle(toggle => toggle
			.setValue(this.plugin.settings.tableFloat)
			.onChange(async (value) => {
				this.plugin.settings.tableFloat = value;
				await this.plugin.saveSettings();
			}));

		new Setting(containerEl).setName('Cross-references').setHeading();

		new Setting(containerEl)
		.setName('Label sections')
		.setDesc(createFragment((f) => {
			f.appendText('Give every heading a label made from the first two words of its text, so that links to headings become references: ')
			f.createEl('code', {text: '## Related Work'})
			f.appendText(' becomes ')
			f.createEl('code', {text: '\\section{Related Work}\\label{sec:related-work}'})
			f.appendText(' and ')
			f.createEl('code', {text: '[[#Related Work]]'})
			f.appendText(' becomes ')
			f.createEl('code', {text: '\\ref{sec:related-work}'})
			f.appendText('. Block ids (')
			f.createEl('code', {text: '^id'})
			f.appendText(') always become labels, and ')
			f.createEl('code', {text: '[[#^id]]'})
			f.appendText(' links always become references.')
		}))
		.addToggle(toggle => toggle
			.setValue(this.plugin.settings.labelSections)
			.onChange(async (value) => {
				this.plugin.settings.labelSections = value;
				await this.plugin.saveSettings();
			}));

		new Setting(containerEl).setName('Citations').setHeading();

		const syntaxOptions : Record<citationSyntax,string> = {
			"wikilink": "Wiki links - [[@foo]]",
			"pandoc": "Pandoc - [@foo, p.3; @bar]",
		}
		new Setting(containerEl)
		.setName('Citation syntax')
		.setDesc(createFragment((f) => {
			f.appendText('How citations are written in your notes.')
			const list = f.createEl('ul')
			const wl = list.createEl('li')
			wl.createEl('strong', {text: 'Wiki links: '})
			wl.appendText('internal links starting with @, e.g. ')
			wl.createEl('code', {text: '[[@foo]]'})
			wl.appendText('. With Extended Citations, surrounding parentheses are parsed for pre/post text, e.g. ')
			wl.createEl('code', {text: '(e.g. [[@foo]] p.3)'})
			wl.appendText('.')
			const pd = list.createEl('li')
			pd.createEl('strong', {text: 'Pandoc: '})
			pd.appendText('bracketed citations with optional prefix, suffix and several keys, e.g. ')
			pd.createEl('code', {text: '[@foo, p.149]'})
			pd.appendText(', ')
			pd.createEl('code', {text: '[see @foo; @bar, ch. 2]'})
			pd.appendText(', plus ')
			pd.createEl('code', {text: '@foo'})
			pd.appendText(' in running text. Wiki-link citations are still converted in this mode, so mixed notes are fine.')
		}))
		.addDropdown(dropdown => dropdown
			.addOptions(syntaxOptions)
			.setValue(this.plugin.settings.citationSyntax)
			.onChange(async (value:citationSyntax) => {
				this.plugin.settings.citationSyntax = value;
				await this.plugin.saveSettings();
			}));

		const options : Record<citeCommand,string>  = {
			"basic":"Basic - \\cite{foo}",
			"autocite":"Autocite - \\autocite{foo}",
			"parencite":"Paren Cite - \\parencite{foo}",
            "extended":"Extended Citations - templates below"
		}
		new Setting(containerEl)
		.setName('Citation Command')
		.setDesc(createFragment((f) => {
			f.appendText('What latex command to use for citations? Applies to both citation syntaxes. With pandoc syntax, prefix and suffix become optional arguments (')
			f.createEl('code', {text: '\\autocite[see][p.3]{foo}'})
			f.appendText('), several keys are combined (')
			f.createEl('code', {text: '\\autocite{foo,bar}'})
			f.appendText(', or ')
			f.createEl('code', {text: '\\autocites[p.3]{foo}{bar}'})
			f.appendText(' when they carry prefixes or suffixes), and ')
			f.createEl('code', {text: '@foo'})
			f.appendText(' in text becomes ')
			f.createEl('code', {text: '\\textcite{foo}'})
			f.appendText('. Plain \\cite has no multi-key or in-text forms, so Basic falls back to separate \\cite commands.')
		}))
		.addDropdown(dropdown => dropdown
			.addOptions(options)
			.setValue(this.plugin.settings.citeCommand)
			.onChange(async (value:citeCommand) => {
				this.plugin.settings.citeCommand = value;
				await this.plugin.saveSettings();
			}));	

		const textFields : Record<string,TextComponent> = {}
		const citationSet = new Setting(containerEl)
			.setName('Extended Citation Templates')
			.setDesc('Templates used by Extended Citations; they make available #id, #pre and #post tags. Pick a preset here, or edit the individual templates below.')
			.addDropdown(dropdown => {
				for( const k in citationSets ) { dropdown.addOption(k,k)}
				dropdown
				.setValue("Default")
				.onChange(async (value:string) => {
					// Copy, so that editing a field afterwards doesn't change the preset itself
					const templs = Object.assign({}, citationSets[value])
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
