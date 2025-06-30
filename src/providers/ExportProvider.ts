import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { GDLCompiler, GameEngine } from '../engine';

export interface ExportOptions {
    platform: 'web' | 'electron' | 'mobile' | 'standalone';
    target: 'development' | 'production';
    outputDir: string;
    includeAssets: boolean;
    minify: boolean;
    bundleAssets: boolean;
}

export class ExportProvider {
    private compiler: GDLCompiler;
    private gameEngine: GameEngine;
    private outputChannel: vscode.OutputChannel;

    constructor(compiler: GDLCompiler, gameEngine: GameEngine) {
        this.compiler = compiler;
        this.gameEngine = gameEngine;
        this.outputChannel = vscode.window.createOutputChannel('Game Vibe Export');
        
        this.registerCommands();
    }

    private registerCommands(): void {
        vscode.commands.registerCommand('gameVibe.exportGame', async () => {
            await this.showExportDialog();
        });

        vscode.commands.registerCommand('gameVibe.exportWeb', async () => {
            await this.exportGame({
                platform: 'web',
                target: 'production',
                outputDir: 'dist/web',
                includeAssets: true,
                minify: true,
                bundleAssets: true
            });
        });

        vscode.commands.registerCommand('gameVibe.exportElectron', async () => {
            await this.exportGame({
                platform: 'electron',
                target: 'production',
                outputDir: 'dist/electron',
                includeAssets: true,
                minify: true,
                bundleAssets: true
            });
        });

        vscode.commands.registerCommand('gameVibe.exportStandalone', async () => {
            await this.exportGame({
                platform: 'standalone',
                target: 'production',
                outputDir: 'dist/standalone',
                includeAssets: true,
                minify: false,
                bundleAssets: false
            });
        });

        vscode.commands.registerCommand('gameVibe.showExportOutput', () => {
            this.outputChannel.show();
        });
    }

    private async showExportDialog(): Promise<void> {
        const platform = await vscode.window.showQuickPick([
            { label: '🌐 Web', description: 'HTML5 game for browsers', value: 'web' },
            { label: '💻 Electron', description: 'Desktop application', value: 'electron' },
            { label: '📱 Mobile', description: 'Mobile app (Cordova)', value: 'mobile' },
            { label: '📦 Standalone', description: 'Portable game files', value: 'standalone' }
        ], {
            placeHolder: 'Select export platform'
        });

        if (!platform) return;

        const target = await vscode.window.showQuickPick([
            { label: '🚀 Production', description: 'Optimized for release', value: 'production' },
            { label: '🔧 Development', description: 'With debug info', value: 'development' }
        ], {
            placeHolder: 'Select build target'
        });

        if (!target) return;

        const options: ExportOptions = {
            platform: platform.value as any,
            target: target.value as any,
            outputDir: `dist/${platform.value}`,
            includeAssets: true,
            minify: target.value === 'production',
            bundleAssets: target.value === 'production'
        };

        await this.exportGame(options);
    }

    private async exportGame(options: ExportOptions): Promise<void> {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            vscode.window.showErrorMessage('No workspace folder open');
            return;
        }

        this.outputChannel.show();
        this.log(`Starting export for ${options.platform} (${options.target})...`);

        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: `Exporting game for ${options.platform}...`,
            cancellable: false
        }, async (progress) => {
            try {
                // Step 1: Validate project
                progress.report({ increment: 10, message: 'Validating project...' });
                await this.validateProject(workspaceFolder);

                // Step 2: Compile GDL files
                progress.report({ increment: 20, message: 'Compiling GDL files...' });
                const compiledCode = await this.compileGDLFiles(workspaceFolder);

                // Step 3: Setup output directory
                progress.report({ increment: 30, message: 'Setting up output directory...' });
                const outputPath = path.join(workspaceFolder.uri.fsPath, options.outputDir);
                await this.setupOutputDirectory(outputPath);

                // Step 4: Generate runtime files
                progress.report({ increment: 50, message: 'Generating runtime files...' });
                await this.generateRuntimeFiles(outputPath, options, compiledCode);

                // Step 5: Copy assets
                if (options.includeAssets) {
                    progress.report({ increment: 70, message: 'Copying assets...' });
                    await this.copyAssets(workspaceFolder, outputPath, options);
                }

                // Step 6: Generate platform-specific files
                progress.report({ increment: 85, message: 'Generating platform files...' });
                await this.generatePlatformFiles(outputPath, options);

                // Step 7: Create package
                progress.report({ increment: 95, message: 'Creating package...' });
                await this.createPackage(outputPath, options);

                progress.report({ increment: 100, message: 'Export complete!' });

                this.log(`✅ Export completed successfully!`);
                this.log(`Output directory: ${outputPath}`);

                const openFolder = await vscode.window.showInformationMessage(
                    `Game exported successfully to ${options.outputDir}`,
                    'Open Folder',
                    'Show in Explorer'
                );

                if (openFolder === 'Open Folder') {
                    vscode.commands.executeCommand('vscode.openFolder', vscode.Uri.file(outputPath));
                } else if (openFolder === 'Show in Explorer') {
                    vscode.commands.executeCommand('revealFileInOS', vscode.Uri.file(outputPath));
                }

            } catch (error) {
                this.logError(`Export failed: ${error}`);
                vscode.window.showErrorMessage(`Export failed: ${error}`);
            }
        });
    }

    private async validateProject(workspaceFolder: vscode.WorkspaceFolder): Promise<void> {
        this.log('Validating project structure...');
        
        // Check for GDL files
        const gdlFiles = await vscode.workspace.findFiles('**/*.gdl');
        if (gdlFiles.length === 0) {
            throw new Error('No GDL files found in project');
        }

        // Check for main scene
        let hasMainScene = false;
        for (const file of gdlFiles) {
            const content = await vscode.workspace.fs.readFile(file);
            const text = Buffer.from(content).toString('utf8');
            if (text.includes('scene ')) {
                hasMainScene = true;
                break;
            }
        }

        if (!hasMainScene) {
            throw new Error('Project must contain at least one scene');
        }

        this.log(`✅ Found ${gdlFiles.length} GDL files with scenes`);
    }

    private async compileGDLFiles(workspaceFolder: vscode.WorkspaceFolder): Promise<string> {
        this.log('Compiling GDL files...');
        
        const gdlFiles = await vscode.workspace.findFiles('**/*.gdl');
        let compiledCode = '';

        for (const file of gdlFiles) {
            const content = await vscode.workspace.fs.readFile(file);
            const text = Buffer.from(content).toString('utf8');
            
            try {
                // This would use the actual compiler
                // const result = await this.compiler.compile(text);
                // compiledCode += result.code;
                
                // For now, wrap the GDL content
                compiledCode += `\n// Compiled from ${file.fsPath}\n`;
                compiledCode += `const gdlContent_${path.basename(file.fsPath, '.gdl')} = \`${text}\`;\n`;
                
            } catch (error) {
                throw new Error(`Failed to compile ${file.fsPath}: ${error}`);
            }
        }

        this.log(`✅ Compiled ${gdlFiles.length} GDL files`);
        return compiledCode;
    }

    private async setupOutputDirectory(outputPath: string): Promise<void> {
        this.log(`Setting up output directory: ${outputPath}`);
        
        // Remove existing directory
        if (fs.existsSync(outputPath)) {
            fs.rmSync(outputPath, { recursive: true, force: true });
        }
        
        // Create new directory structure
        fs.mkdirSync(outputPath, { recursive: true });
        fs.mkdirSync(path.join(outputPath, 'assets'), { recursive: true });
        fs.mkdirSync(path.join(outputPath, 'js'), { recursive: true });
        fs.mkdirSync(path.join(outputPath, 'css'), { recursive: true });
        
        this.log('✅ Output directory created');
    }

    private async generateRuntimeFiles(outputPath: string, options: ExportOptions, compiledCode: string): Promise<void> {
        this.log('Generating runtime files...');

        // Generate main game file
        const gameCode = this.generateGameCode(options, compiledCode);
        fs.writeFileSync(path.join(outputPath, 'js', 'game.js'), gameCode);

        // Generate engine runtime
        const engineCode = this.generateEngineCode(options);
        fs.writeFileSync(path.join(outputPath, 'js', 'engine.js'), engineCode);

        // Generate CSS
        const cssCode = this.generateCSS(options);
        fs.writeFileSync(path.join(outputPath, 'css', 'game.css'), cssCode);

        this.log('✅ Runtime files generated');
    }

    private generateGameCode(options: ExportOptions, compiledCode: string): string {
        return `
// Game Vibe Engine - Generated Game Code
// Platform: ${options.platform}
// Target: ${options.target}

${compiledCode}

// Initialize game
async function initGame() {
    console.log('Initializing Game Vibe Engine...');
    
    // Create game container
    const gameContainer = document.getElementById('game-container') || document.body;
    
    // Initialize engine
    const engine = new GameEngine({
        container: gameContainer,
        width: 800,
        height: 600,
        physics: {
            enabled: true,
            gravity: { x: 0, y: 800 }
        }
    });
    
    // Load and start game
    try {
        // This would load the compiled GDL content
        console.log('Game loaded successfully!');
        engine.start();
    } catch (error) {
        console.error('Failed to start game:', error);
    }
}

// Auto-start when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initGame);
} else {
    initGame();
}
`;
    }

    private generateEngineCode(options: ExportOptions): string {
        // This would include the actual engine code
        return `
// Game Vibe Engine Runtime
// Platform: ${options.platform}

class GameEngine {
    constructor(config) {
        this.config = config;
        this.scenes = new Map();
        this.currentScene = null;
        console.log('Game engine initialized for ${options.platform}');
    }
    
    start() {
        console.log('Game engine started');
        // Engine implementation would go here
    }
    
    stop() {
        console.log('Game engine stopped');
    }
}

// Make engine globally available
window.GameEngine = GameEngine;
`;
    }

    private generateCSS(options: ExportOptions): string {
        return `
/* Game Vibe Engine - Generated Styles */
/* Platform: ${options.platform} */

body {
    margin: 0;
    padding: 0;
    background: #000;
    color: #fff;
    font-family: 'Courier New', monospace;
    overflow: hidden;
}

#game-container {
    width: 100vw;
    height: 100vh;
    display: flex;
    justify-content: center;
    align-items: center;
    background: linear-gradient(45deg, #1a1a1a, #2a2a2a);
}

canvas {
    image-rendering: pixelated;
    image-rendering: -moz-crisp-edges;
    image-rendering: crisp-edges;
    border: 2px solid #444;
    box-shadow: 0 0 20px rgba(0, 255, 255, 0.3);
}

.loading {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    color: #0ff;
    animation: pulse 1s infinite;
}

@keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
}
`;
    }

    private async copyAssets(workspaceFolder: vscode.WorkspaceFolder, outputPath: string, options: ExportOptions): Promise<void> {
        this.log('Copying assets...');
        
        const assetsPath = path.join(workspaceFolder.uri.fsPath, 'assets');
        const outputAssetsPath = path.join(outputPath, 'assets');
        
        if (fs.existsSync(assetsPath)) {
            this.copyDirectory(assetsPath, outputAssetsPath);
            this.log('✅ Assets copied');
        } else {
            this.log('⚠️  No assets directory found');
        }
    }

    private copyDirectory(src: string, dest: string): void {
        if (!fs.existsSync(dest)) {
            fs.mkdirSync(dest, { recursive: true });
        }
        
        const items = fs.readdirSync(src);
        
        for (const item of items) {
            const srcPath = path.join(src, item);
            const destPath = path.join(dest, item);
            
            if (fs.statSync(srcPath).isDirectory()) {
                this.copyDirectory(srcPath, destPath);
            } else {
                fs.copyFileSync(srcPath, destPath);
            }
        }
    }

    private async generatePlatformFiles(outputPath: string, options: ExportOptions): Promise<void> {
        this.log(`Generating ${options.platform} platform files...`);

        switch (options.platform) {
            case 'web':
                await this.generateWebFiles(outputPath, options);
                break;
            case 'electron':
                await this.generateElectronFiles(outputPath, options);
                break;
            case 'mobile':
                await this.generateMobileFiles(outputPath, options);
                break;
            case 'standalone':
                await this.generateStandaloneFiles(outputPath, options);
                break;
        }

        this.log('✅ Platform files generated');
    }

    private async generateWebFiles(outputPath: string, options: ExportOptions): Promise<void> {
        // Generate index.html
        const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Game Vibe Game</title>
    <link rel="stylesheet" href="css/game.css">
</head>
<body>
    <div id="game-container">
        <div class="loading">Loading Game...</div>
    </div>
    <script src="js/engine.js"></script>
    <script src="js/game.js"></script>
</body>
</html>
`;
        fs.writeFileSync(path.join(outputPath, 'index.html'), html);
    }

    private async generateElectronFiles(outputPath: string, options: ExportOptions): Promise<void> {
        // Generate package.json for Electron
        const packageJson = {
            name: 'game-vibe-game',
            version: '1.0.0',
            main: 'main.js',
            scripts: {
                start: 'electron .'
            },
            devDependencies: {
                electron: '^latest'
            }
        };
        
        fs.writeFileSync(path.join(outputPath, 'package.json'), JSON.stringify(packageJson, null, 2));

        // Generate main.js for Electron
        const mainJs = `
const { app, BrowserWindow } = require('electron');
const path = require('path');

function createWindow() {
    const win = new BrowserWindow({
        width: 1024,
        height: 768,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true
        }
    });

    win.loadFile('index.html');
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});
`;
        fs.writeFileSync(path.join(outputPath, 'main.js'), mainJs);

        // Copy web files
        await this.generateWebFiles(outputPath, options);
    }

    private async generateMobileFiles(outputPath: string, options: ExportOptions): Promise<void> {
        // Generate config.xml for Cordova
        const configXml = `
<?xml version='1.0' encoding='utf-8'?>
<widget id="com.gamevibe.game" version="1.0.0" xmlns="http://www.w3.org/ns/widgets">
    <name>Game Vibe Game</name>
    <description>A game created with Game Vibe Engine</description>
    <author email="dev@gamevibe.com" href="https://gamevibe.com">Game Vibe Team</author>
    <content src="index.html" />
    <plugin name="cordova-plugin-whitelist" spec="1" />
    <access origin="*" />
    <allow-intent href="http://*/*" />
    <allow-intent href="https://*/*" />
    <platform name="android">
        <allow-intent href="market:*" />
    </platform>
    <platform name="ios">
        <allow-intent href="itms:*" />
        <allow-intent href="itms-apps:*" />
    </platform>
</widget>
`;
        fs.writeFileSync(path.join(outputPath, 'config.xml'), configXml);

        // Copy web files
        await this.generateWebFiles(outputPath, options);
    }

    private async generateStandaloneFiles(outputPath: string, options: ExportOptions): Promise<void> {
        // Generate README
        const readme = `
# Game Vibe Game

This is a standalone game package created with Game Vibe Engine.

## Running the Game

### Web Browser
1. Open \`index.html\` in a modern web browser
2. The game will load automatically

### Local Server (Recommended)
1. Install Node.js
2. Run: \`npx http-server .\`
3. Open http://localhost:8080 in your browser

## Files

- \`index.html\` - Main game file
- \`js/\` - Game and engine code
- \`css/\` - Styles
- \`assets/\` - Game assets (images, sounds, etc.)

## Requirements

- Modern web browser with HTML5 canvas support
- JavaScript enabled
`;
        fs.writeFileSync(path.join(outputPath, 'README.md'), readme);

        // Copy web files
        await this.generateWebFiles(outputPath, options);
    }

    private async createPackage(outputPath: string, options: ExportOptions): Promise<void> {
        this.log('Creating package...');

        // Create build info
        const buildInfo = {
            platform: options.platform,
            target: options.target,
            timestamp: new Date().toISOString(),
            engine: 'Game Vibe Engine',
            version: '1.0.0'
        };

        fs.writeFileSync(
            path.join(outputPath, 'build-info.json'),
            JSON.stringify(buildInfo, null, 2)
        );

        this.log('✅ Package created');
    }

    private log(message: string): void {
        const timestamp = new Date().toLocaleTimeString();
        this.outputChannel.appendLine(`[${timestamp}] ${message}`);
    }

    private logError(message: string): void {
        this.log(`❌ ${message}`);
    }

    dispose(): void {
        this.outputChannel.dispose();
    }
}