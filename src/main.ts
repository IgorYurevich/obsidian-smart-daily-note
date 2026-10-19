import {
	Plugin,
	PluginSettingTab,
	App,
	Setting,
	Notice,
	TFile,
} from 'obsidian';

// Описываем, какие настройки будут у плагина
interface PluginSettings {
	rootFolder: string;

	// hierarchy
	quarterFolders: boolean;
	// content
	content: string;
}

const DEFAULT_SETTINGS: PluginSettings = {
	rootFolder: './',
	quarterFolders: false,
	content: '',
};

class SmartDailyNotePluginSettingTab extends PluginSettingTab {
	plugin: SmartDailyNote;

	constructor(app: App, plugin: SmartDailyNote) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty(); // Очищаем контейнер при открытии

		containerEl.createEl('h2', { text: 'Settings' });

		new Setting(containerEl)
			.setName('Root folder')
			.setDesc(
				'Specify the name of the folder where the plugin will create files',
			)
			.addText((text) =>
				text
					.setPlaceholder('For example: my/notes')
					.setValue(this.plugin.settings.rootFolder)
					.onChange(async (value) => {
						this.plugin.settings.rootFolder = value.trim();
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName('Quarter folders style')
			.setDesc('Folders will be created quarterly')
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.quarterFolders)
					.onChange(async (value) => {
						this.plugin.settings.quarterFolders = value;
						await this.plugin.saveSettings();
						new Notice(
							`Quarter folders style: ${value ? 'Enabled' : 'Disabled'}`,
						);
					}),
			);

		new Setting(containerEl)
			.setName('Content')
			.setDesc('Pre content of the file (Markdown supported)')
			.addTextArea((text) =>
				text
					.setValue(this.plugin.settings.content)
					.onChange(async (value) => {
						this.plugin.settings.content = value;
						await this.plugin.saveSettings();
						new Notice('Pre content updated');
					}),
			);
	}
}

export default class SmartDailyNote extends Plugin {
	declare settings: PluginSettings;

	async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			await this.loadData(),
		);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	async onload() {
		await this.loadSettings();

		this.addSettingTab(new SmartDailyNotePluginSettingTab(this.app, this));
		this.addRibbonIcon(
			'dice',
			'Create daily note',
			async (_evt: MouseEvent) => {
				let file = await this.createFile();
				if (!file) {
					return;
				}

				const leaf = this.app.workspace.getLeaf(true);
				await leaf.openFile(file, { state: { mode: 'source' } });
			},
		);
	}

	async createFile(): Promise<TFile | null> {
		const now = new Date();

		const year = now.getFullYear();
		const month = now.getMonth() + 1;
		const date = now.getDate();

		try {
			let filePath = await this._getFilePath(year, month, date);

			let file = this.app.vault.getFileByPath(filePath);
			if (file) {
				new Notice(`File already exists: ${file.path}`);

				return file;
			}

			const newFile = await this.app.vault.create(
				filePath,
				this.settings.content,
			);

			new Notice(`File successfully created: ${newFile.path}`);

			return newFile;
		} catch (error) {
			new Notice('Error creating file. It may already exist.');
			console.error(error);

			return null;
		}
	}

	async _getFolderName(year: number, month: number): Promise<string> {
		let root = this._getRootFolderName();

		let yearFolderName = await this._getYearFolderName(root, year);

		let folderName = '';
		if (this.settings.quarterFolders) {
			let yearQuarterFolderName = await this._getYearQuarterFolderName(
				yearFolderName,
				year,
				month,
			);
			folderName = await this._getYearMonthFolderName(
				yearQuarterFolderName,
				year,
				month,
			);
		} else {
			folderName = await this._getYearMonthFolderName(root, year, month);
		}

		return folderName;
	}

	async _getFilePath(
		year: number,
		month: number,
		date: number,
	): Promise<string> {
		let fileName =
			year + '-' + formatDate(month) + '-' + formatDate(date) + '.md';

		let filePath =
			(await this._getFolderName(year, month)) + '/' + fileName;
		return filePath;
	}

	_getRootFolderName(): string {
		let root = this.settings.rootFolder
			.trim()
			.replace(/^.\//, '')
			.replace(/^\//, '')
			.replace(/\/$/, '');

		return root;
	}

	async _getYearFolderName(root: string, year: number): Promise<string> {
		let yearFolderName = root + '/' + year;
		if (root == '') {
			yearFolderName = `${year}`;
		}

		let yearFolder = this.app.vault.getFolderByPath(yearFolderName);
		if (!yearFolder) {
			console.log('Year folder does not exist, creating it');
			await this.app.vault.createFolder(yearFolderName);
		}

		return yearFolderName;
	}

	async _getYearQuarterFolderName(
		root: string,
		year: number,
		month: number,
	): Promise<string> {
		const quarter = Math.floor((month - 1) / 3) + 1;
		let yearQuarterFolderName = root + '/' + year + '-Q' + quarter;

		let yearQuarterFolder = this.app.vault.getFolderByPath(
			yearQuarterFolderName,
		);
		if (!yearQuarterFolder) {
			console.log('Quarter folder does not exist, creating it');
			await this.app.vault.createFolder(yearQuarterFolderName);
		}

		return yearQuarterFolderName;
	}

	async _getYearMonthFolderName(
		root: string,
		year: number,
		month: number,
	): Promise<string> {
		let yearMonthFolderName = root + '/' + year + '-' + formatDate(month);

		let monthFolder = this.app.vault.getFolderByPath(yearMonthFolderName);
		if (!monthFolder) {
			console.log('Month folder does not exist, creating it');
			await this.app.vault.createFolder(yearMonthFolderName);
		}

		return yearMonthFolderName;
	}
}

const formatDate = (date: number): string => {
	if (date < 10) {
		return `0${date}`;
	}

	return `${date}`;
};
