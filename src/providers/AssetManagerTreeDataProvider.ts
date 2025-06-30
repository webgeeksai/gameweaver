import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { promisify } from 'util';

const readdir = promisify(fs.readdir);
const stat = promisify(fs.stat);
const access = promisify(fs.access);

export class AssetManagerTreeDataProvider implements vscode.TreeDataProvider<AssetItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<AssetItem | undefined | null | void> = new vscode.EventEmitter<AssetItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<AssetItem | undefined | null | void> = this._onDidChangeTreeData.event;
    private watchers: vscode.FileSystemWatcher[] = [];
    private assetUsageMap: Map<string, string[]> = new Map();

    constructor(private context: vscode.ExtensionContext) {
        this.setupFileWatchers();
        this.registerCommands();
    }

    refresh(): void {
        this._onDidChangeTreeData.fire();
        this.updateAssetUsage();
    }

    private setupFileWatchers(): void {
        // Watch for changes in assets directories
        const assetsWatcher = vscode.workspace.createFileSystemWatcher('**/assets/**/*');
        const gdlWatcher = vscode.workspace.createFileSystemWatcher('**/*.gdl');
        
        this.watchers = [assetsWatcher, gdlWatcher];
        
        this.context.subscriptions.push(
            assetsWatcher.onDidCreate(() => this.refresh()),
            assetsWatcher.onDidDelete(() => this.refresh()),
            assetsWatcher.onDidChange(() => this.refresh()),
            gdlWatcher.onDidCreate(() => this.updateAssetUsage()),
            gdlWatcher.onDidChange(() => this.updateAssetUsage()),
            gdlWatcher.onDidDelete(() => this.updateAssetUsage())
        );
    }

    private registerCommands(): void {
        this.context.subscriptions.push(
            vscode.commands.registerCommand('gameVibe.createAssetFolder', () => this.createAssetFolder()),
            vscode.commands.registerCommand('gameVibe.importAsset', (item?: AssetItem) => this.importAsset(item)),
            vscode.commands.registerCommand('gameVibe.deleteAsset', (item?: AssetItem) => this.deleteAsset(item)),
            vscode.commands.registerCommand('gameVibe.renameAsset', (item?: AssetItem) => this.renameAsset(item)),
            vscode.commands.registerCommand('gameVibe.showAssetUsage', (item?: AssetItem) => this.showAssetUsage(item)),
            vscode.commands.registerCommand('gameVibe.optimizeAssets', () => this.optimizeAssets())
        );
    }

    getTreeItem(element: AssetItem): vscode.TreeItem {
        return element;
    }

    async getChildren(element?: AssetItem): Promise<AssetItem[]> {
        if (!element) {
            // Root level - return asset categories and status info
            const categories = [
                new AssetItem('Images', vscode.TreeItemCollapsibleState.Collapsed, 'category', 'images'),
                new AssetItem('Sounds', vscode.TreeItemCollapsibleState.Collapsed, 'category', 'sounds'),
                new AssetItem('Fonts', vscode.TreeItemCollapsibleState.Collapsed, 'category', 'fonts'),
                new AssetItem('Data', vscode.TreeItemCollapsibleState.Collapsed, 'category', 'data')
            ];
            
            // Add asset counts to category labels
            for (const category of categories) {
                const files = await this.getAssetFiles(category.assetType!);
                category.label = `${category.assetType?.charAt(0).toUpperCase()}${category.assetType?.slice(1)} (${files.length})`;
                category.description = `${files.length} assets`;
            }
            
            return categories;
        } else if (element.contextValue === 'category') {
            // Category level - return files in asset directories
            return await this.getAssetFiles(element.assetType!);
        }
        return [];
    }

    private async getAssetFiles(assetType: string): Promise<AssetItem[]> {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) {
            return [];
        }

        const assets: AssetItem[] = [];
        const extensions = this.getExtensionsForAssetType(assetType);

        for (const folder of workspaceFolders) {
            const assetsPath = path.join(folder.uri.fsPath, 'assets', assetType);
            
            try {
                await access(assetsPath, fs.constants.F_OK);
                const files = await readdir(assetsPath);
                
                for (const file of files) {
                    const ext = path.extname(file).toLowerCase();
                    if (extensions.includes(ext)) {
                        const filePath = path.join(assetsPath, file);
                        const fileStats = await stat(filePath);
                        const usage = this.assetUsageMap.get(file) || [];
                        
                        const item = new AssetItem(
                            file,
                            vscode.TreeItemCollapsibleState.None,
                            'asset',
                            assetType,
                            filePath
                        );
                        
                        // Add metadata
                        item.fileSize = fileStats.size;
                        item.lastModified = fileStats.mtime;
                        item.usageCount = usage.length;
                        item.description = this.formatFileSize(fileStats.size);
                        
                        // Add warning for unused assets
                        if (usage.length === 0) {
                            item.description += ' (unused)';
                        }
                        
                        // Update tooltip with metadata
                        item.updateTooltip();
                        
                        assets.push(item);
                    }
                }
            } catch (error) {
                // Directory doesn't exist - create it
                if (!fs.existsSync(assetsPath)) {
                    fs.mkdirSync(assetsPath, { recursive: true });
                }
            }
        }

        return assets.sort((a, b) => a.label.localeCompare(b.label));
    }

    private getExtensionsForAssetType(assetType: string): string[] {
        switch (assetType) {
            case 'images':
                return ['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.svg', '.webp'];
            case 'sounds':
                return ['.mp3', '.wav', '.ogg', '.m4a', '.flac'];
            case 'fonts':
                return ['.ttf', '.otf', '.woff', '.woff2', '.eot'];
            case 'data':
                return ['.json', '.xml', '.csv', '.txt', '.yaml', '.yml'];
            default:
                return [];
        }
    }

    private formatFileSize(bytes: number): string {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    }

    private async updateAssetUsage(): Promise<void> {
        this.assetUsageMap.clear();
        
        const gdlFiles = await vscode.workspace.findFiles('**/*.gdl');
        
        for (const file of gdlFiles) {
            try {
                const content = await vscode.workspace.fs.readFile(file);
                const text = Buffer.from(content).toString('utf8');
                
                // Find texture references
                const textureMatches = text.matchAll(/texture:\s*["']([^"']+)["']/g);
                for (const match of textureMatches) {
                    const filename = path.basename(match[1]);
                    const usage = this.assetUsageMap.get(filename) || [];
                    usage.push(file.fsPath);
                    this.assetUsageMap.set(filename, usage);
                }
                
                // Find audio references
                const audioMatches = text.matchAll(/(?:sound|music|audio):\s*["']([^"']+)["']/g);
                for (const match of audioMatches) {
                    const filename = path.basename(match[1]);
                    const usage = this.assetUsageMap.get(filename) || [];
                    usage.push(file.fsPath);
                    this.assetUsageMap.set(filename, usage);
                }
            } catch (error) {
                console.error(`Error reading GDL file ${file.fsPath}: ${error}`);
            }
        }
    }

    private async createAssetFolder(): Promise<void> {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            vscode.window.showErrorMessage('No workspace folder open');
            return;
        }

        const assetsPath = path.join(workspaceFolder.uri.fsPath, 'assets');
        const folders = ['images', 'sounds', 'fonts', 'data'];
        
        for (const folder of folders) {
            const folderPath = path.join(assetsPath, folder);
            if (!fs.existsSync(folderPath)) {
                fs.mkdirSync(folderPath, { recursive: true });
            }
        }
        
        vscode.window.showInformationMessage('Asset folders created successfully!');
        this.refresh();
    }

    private async importAsset(item?: AssetItem): Promise<void> {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            vscode.window.showErrorMessage('No workspace folder open');
            return;
        }

        const assetType = item?.assetType || await vscode.window.showQuickPick(
            ['images', 'sounds', 'fonts', 'data'],
            { placeHolder: 'Select asset type' }
        );
        
        if (!assetType) return;

        const fileUris = await vscode.window.showOpenDialog({
            canSelectMany: true,
            filters: this.getFiltersForAssetType(assetType),
            openLabel: 'Import'
        });

        if (fileUris && fileUris.length > 0) {
            const targetDir = path.join(workspaceFolder.uri.fsPath, 'assets', assetType);
            if (!fs.existsSync(targetDir)) {
                fs.mkdirSync(targetDir, { recursive: true });
            }

            for (const fileUri of fileUris) {
                const filename = path.basename(fileUri.fsPath);
                const targetPath = path.join(targetDir, filename);
                fs.copyFileSync(fileUri.fsPath, targetPath);
            }

            vscode.window.showInformationMessage(`Imported ${fileUris.length} asset(s)`);
            this.refresh();
        }
    }

    private async deleteAsset(item?: AssetItem): Promise<void> {
        if (!item || !item.filePath) return;

        const choice = await vscode.window.showWarningMessage(
            `Delete ${item.label}?`,
            { modal: true },
            'Delete'
        );

        if (choice === 'Delete') {
            fs.unlinkSync(item.filePath);
            vscode.window.showInformationMessage(`Deleted ${item.label}`);
            this.refresh();
        }
    }

    private async renameAsset(item?: AssetItem): Promise<void> {
        if (!item || !item.filePath) return;

        const newName = await vscode.window.showInputBox({
            prompt: 'Enter new name',
            value: item.label,
            validateInput: (value) => {
                if (!value) return 'Name cannot be empty';
                if (!/^[a-zA-Z0-9._-]+$/.test(value)) return 'Invalid characters in name';
                return null;
            }
        });

        if (newName && newName !== item.label) {
            const newPath = path.join(path.dirname(item.filePath), newName);
            fs.renameSync(item.filePath, newPath);
            vscode.window.showInformationMessage(`Renamed to ${newName}`);
            this.refresh();
        }
    }

    private async showAssetUsage(item?: AssetItem): Promise<void> {
        if (!item || !item.filePath) return;

        const usage = this.assetUsageMap.get(item.label) || [];
        
        if (usage.length === 0) {
            vscode.window.showInformationMessage(`${item.label} is not used in any GDL files`);
            return;
        }

        const items = usage.map(filePath => ({
            label: path.basename(filePath),
            description: path.dirname(filePath),
            uri: vscode.Uri.file(filePath)
        }));

        const selected = await vscode.window.showQuickPick(items, {
            placeHolder: `${item.label} is used in ${usage.length} file(s)`
        });

        if (selected) {
            vscode.window.showTextDocument(selected.uri);
        }
    }

    private async optimizeAssets(): Promise<void> {
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'Optimizing assets...',
            cancellable: false
        }, async (progress) => {
            progress.report({ increment: 25, message: 'Analyzing asset usage...' });
            await this.updateAssetUsage();
            
            progress.report({ increment: 50, message: 'Finding unused assets...' });
            const allAssets: AssetItem[] = [];
            for (const assetType of ['images', 'sounds', 'fonts', 'data']) {
                const assets = await this.getAssetFiles(assetType);
                allAssets.push(...assets);
            }
            
            const unusedAssets = allAssets.filter(asset => !this.assetUsageMap.has(asset.label));
            
            progress.report({ increment: 75, message: 'Generating report...' });
            
            if (unusedAssets.length === 0) {
                vscode.window.showInformationMessage('All assets are being used!');
            } else {
                const choice = await vscode.window.showWarningMessage(
                    `Found ${unusedAssets.length} unused assets. View report?`,
                    'View Report', 'Delete Unused'
                );
                
                if (choice === 'View Report') {
                    this.showOptimizationReport(unusedAssets);
                } else if (choice === 'Delete Unused') {
                    for (const asset of unusedAssets) {
                        if (asset.filePath) {
                            fs.unlinkSync(asset.filePath);
                        }
                    }
                    vscode.window.showInformationMessage(`Deleted ${unusedAssets.length} unused assets`);
                    this.refresh();
                }
            }
            
            progress.report({ increment: 100, message: 'Complete' });
        });
    }

    private async showOptimizationReport(unusedAssets: AssetItem[]): Promise<void> {
        const report = [
            '# Asset Optimization Report',
            '',
            `Generated: ${new Date().toISOString()}`,
            '',
            '## Unused Assets',
            '',
            ...unusedAssets.map(asset => `- ${asset.label} (${asset.description})`),
            '',
            '## Recommendations',
            '',
            '- Remove unused assets to reduce bundle size',
            '- Consider using asset compression for large files',
            '- Organize assets by feature/scene for better maintainability'
        ].join('\n');

        const doc = await vscode.workspace.openTextDocument({
            content: report,
            language: 'markdown'
        });
        
        await vscode.window.showTextDocument(doc);
    }

    private getFiltersForAssetType(assetType: string): { [name: string]: string[] } {
        switch (assetType) {
            case 'images':
                return { 'Images': ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'svg', 'webp'] };
            case 'sounds':
                return { 'Audio': ['mp3', 'wav', 'ogg', 'm4a', 'flac'] };
            case 'fonts':
                return { 'Fonts': ['ttf', 'otf', 'woff', 'woff2', 'eot'] };
            case 'data':
                return { 'Data': ['json', 'xml', 'csv', 'txt', 'yaml', 'yml'] };
            default:
                return { 'All Files': ['*'] };
        }
    }

    dispose(): void {
        this.watchers.forEach(watcher => watcher.dispose());
    }
}

class AssetItem extends vscode.TreeItem {
    public fileSize?: number;
    public lastModified?: Date;
    public usageCount?: number;

    constructor(
        public label: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly contextValue: string,
        public readonly assetType?: string,
        public readonly filePath?: string
    ) {
        super(label, collapsibleState);

        if (contextValue === 'category') {
            this.iconPath = new vscode.ThemeIcon('folder');
            this.tooltip = `${this.assetType} assets`;
        } else if (contextValue === 'asset') {
            this.iconPath = this.getIconForAssetType(assetType!);
            this.resourceUri = filePath ? vscode.Uri.file(filePath) : undefined;
            this.command = {
                command: 'vscode.open',
                title: 'Open Asset',
                arguments: [this.resourceUri]
            };
            
            // Context menu
            this.contextValue = 'asset';
            this.tooltip = `Asset: ${this.label}`;
        }
    }

    updateTooltip(): void {
        if (this.contextValue === 'asset') {
            const parts = [`Asset: ${this.label}`];
            if (this.fileSize !== undefined) {
                parts.push(`Size: ${this.formatFileSize(this.fileSize)}`);
            }
            if (this.usageCount !== undefined) {
                parts.push(`Used in: ${this.usageCount} file(s)`);
            }
            if (this.lastModified) {
                parts.push(`Modified: ${this.lastModified.toLocaleDateString()}`);
            }
            this.tooltip = parts.join('\n');
        }
    }

    private formatFileSize(bytes: number): string {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    }

    private getIconForAssetType(assetType: string): vscode.ThemeIcon {
        switch (assetType) {
            case 'images':
                return new vscode.ThemeIcon('file-media');
            case 'sounds':
                return new vscode.ThemeIcon('file-media');
            case 'fonts':
                return new vscode.ThemeIcon('symbol-text');
            case 'data':
                return new vscode.ThemeIcon('file-code');
            default:
                return new vscode.ThemeIcon('file');
        }
    }
}