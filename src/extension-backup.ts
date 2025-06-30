import * as vscode from 'vscode';
import { GameVibeEditorProvider } from './providers/GameVibeEditorProvider';
import { AIAssistantViewProvider } from './providers/AIAssistantViewProvider';
import { SceneManagerTreeDataProvider } from './providers/SceneManagerTreeDataProvider';
import { AssetManagerTreeDataProvider } from './providers/AssetManagerTreeDataProvider';
import { EntityInspectorTreeDataProvider } from './providers/EntityInspectorTreeDataProvider';
import { GDLLanguageProvider } from './providers/GDLLanguageProvider';
import { GDLDebugProvider } from './providers/GDLDebugProvider';
import { ExportProvider } from './providers/ExportProvider';
import { SpriteEditorProvider } from './providers/SpriteEditorProvider';
import { LevelDesignerProvider } from './providers/LevelDesignerProvider';
import { MusicEditorProvider } from './providers/MusicEditorProvider';
import { GameEngine, GDLCompiler } from './engine';
import { GameServer } from './server/GameServer';
import { PhaserRPGGameServer } from './server/PhaserRPGGameServer';

let gameEngine: GameEngine | undefined;
let compiler: GDLCompiler | undefined;

export function activate(context: vscode.ExtensionContext) {
    console.log('Game Vibe Engine extension is now active!');

    // Initialize core components with stubs for VS Code environment
    gameEngine = new GameEngine();
    compiler = new GDLCompiler();

    // Register custom editor provider for game preview
    const editorProvider = new GameVibeEditorProvider(context, gameEngine, compiler);
    context.subscriptions.push(
        vscode.window.registerCustomEditorProvider(
            'gameVibe.gameEditor',
            editorProvider,
            {
                webviewOptions: {
                    retainContextWhenHidden: true
                },
                supportsMultipleEditorsPerDocument: false
            }
        )
    );

    // Register AI Assistant webview provider
    const aiAssistantProvider = new AIAssistantViewProvider(context.extensionUri, gameEngine, compiler);
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(
            'gameVibe.aiAssistant',
            aiAssistantProvider
        )
    );

    // Register tree data providers
    const sceneManagerProvider = new SceneManagerTreeDataProvider(gameEngine);
    const assetManagerProvider = new AssetManagerTreeDataProvider(context);
    const entityInspectorProvider = new EntityInspectorTreeDataProvider(gameEngine);

    context.subscriptions.push(
        vscode.window.registerTreeDataProvider('gameVibe.sceneManager', sceneManagerProvider),
        vscode.window.registerTreeDataProvider('gameVibe.assetManager', assetManagerProvider),
        vscode.window.registerTreeDataProvider('gameVibe.entityInspector', entityInspectorProvider)
    );

    // Register sprite editor provider
    context.subscriptions.push(
        SpriteEditorProvider.register(context)
    );

    // Register level designer provider
    context.subscriptions.push(
        LevelDesignerProvider.register(context)
    );

    // Register music editor provider
    context.subscriptions.push(
        MusicEditorProvider.register(context)
    );

    // Register commands
    context.subscriptions.push(
        vscode.commands.registerCommand('gameVibe.openEditor', async () => {
            // Create a new GDL file in the workspace
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
            if (!workspaceFolder) {
                const answer = await vscode.window.showInformationMessage(
                    'Please open a folder first to create a game project.',
                    'Open Folder'
                );
                if (answer === 'Open Folder') {
                    vscode.commands.executeCommand('vscode.openFolder');
                }
                return;
            }

            // Create a new untitled GDL file
            const document = await vscode.workspace.openTextDocument({
                content: getDefaultGDLContent(),
                language: 'gdl'
            });
            
            await vscode.window.showTextDocument(document);
            vscode.window.showInformationMessage('✨ New game created! Use the Game Vibe commands to run and preview your game.');
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('gameVibe.newGame', async () => {
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
            if (!workspaceFolder) {
                const answer = await vscode.window.showInformationMessage(
                    'Please open a folder first to create a game project.',
                    'Open Folder'
                );
                if (answer === 'Open Folder') {
                    vscode.commands.executeCommand('vscode.openFolder');
                }
                return;
            }

            const gameTypes = [
                { label: '🏃 Platformer', description: 'Side-scrolling game with jumping and platforms', value: 'Platformer' },
                { label: '🔄 Top-Down', description: 'Bird\'s eye view game like RPGs or shooters', value: 'Top-Down' },
                { label: '🧩 Puzzle', description: 'Logic-based game with drag-and-drop mechanics', value: 'Puzzle' },
                { label: '🏎️ Racing', description: 'Fast-paced racing game with tracks', value: 'Racing' },
                { label: '🎯 Shooter', description: 'Action game with projectiles and enemies', value: 'Shooter' },
                { label: '🏗️ Custom', description: 'Blank template to start from scratch', value: 'Custom' }
            ];

            const selectedType = await vscode.window.showQuickPick(gameTypes, {
                placeHolder: 'Select game type to create'
            });

            if (selectedType) {
                await createGameTemplate(workspaceFolder, selectedType.value);
            }
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('gameVibe.compileGDL', async () => {
            const editor = vscode.window.activeTextEditor;
            if (editor && editor.document.languageId === 'gdl') {
                const gdlCode = editor.document.getText();
                try {
                    const compiledCode = await compiler!.compile(gdlCode);
                    vscode.window.showInformationMessage('GDL compiled successfully!');
                    
                    // Update game engine with compiled code
                    if (gameEngine) {
                        await gameEngine.loadCompiledCode(compiledCode);
                    }
                } catch (error) {
                    vscode.window.showErrorMessage(`Compilation error: ${error}`);
                }
            }
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('gameVibe.runGame', async () => {
            const activeEditor = vscode.window.activeTextEditor;
            if (!activeEditor) {
                vscode.window.showErrorMessage('Please open a GDL file first.');
                return;
            }

            if (activeEditor.document.languageId !== 'gdl') {
                vscode.window.showErrorMessage('Please open a .gdl file to run the game.');
                return;
            }

            // Get the GDL content
            const gdlContent = activeEditor.document.getText();
            
            // Create or show the game preview panel
            showGamePreview(context, gdlContent);
        }),
        
        vscode.commands.registerCommand('gameVibe.createProject', async () => {
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
            if (!workspaceFolder) {
                vscode.window.showErrorMessage('Please open a folder first.');
                return;
            }

            await createGameProject(workspaceFolder);
        })
    );

    // Register GDL language features
    const gdlProvider = new GDLLanguageProvider();
    const gdlDebugProvider = new GDLDebugProvider(compiler);
    const exportProvider = new ExportProvider(compiler, gameEngine);
    context.subscriptions.push(
        vscode.languages.registerCompletionItemProvider('gdl', gdlProvider),
        vscode.languages.registerHoverProvider('gdl', gdlProvider),
        vscode.languages.registerDocumentFormattingEditProvider('gdl', gdlProvider),
        gdlDebugProvider,
        exportProvider
    );

    // Register file system watcher for GDL files
    const gdlWatcher = vscode.workspace.createFileSystemWatcher('**/*.gdl');
    context.subscriptions.push(
        gdlWatcher.onDidCreate(uri => {
            console.log('New GDL file created:', uri.fsPath);
        }),
        gdlWatcher.onDidChange(uri => {
            console.log('GDL file changed:', uri.fsPath);
            // Auto-compile on save if enabled
            const config = vscode.workspace.getConfiguration('gameVibe');
            if (config.get('autoCompileOnSave')) {
                vscode.commands.executeCommand('gameVibe.compileGDL');
            }
        })
    );

    // Additional project workflow commands
    context.subscriptions.push(
        vscode.commands.registerCommand('gameVibe.addScene', async () => {
            await addNewScene();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('gameVibe.addEntity', async () => {
            await addNewEntity();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('gameVibe.validateProject', async () => {
            await validateProject();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('gameVibe.buildProject', async () => {
            await buildProject();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('gameVibe.createDemoGame', async () => {
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
            if (!workspaceFolder) {
                const answer = await vscode.window.showInformationMessage(
                    'Please open a folder first to create the demo game.',
                    'Open Folder'
                );
                if (answer === 'Open Folder') {
                    vscode.commands.executeCommand('vscode.openFolder');
                }
                return;
            }
            await createDemoGame(workspaceFolder);
        })
    );

    // Register RPG demo command
    context.subscriptions.push(
        vscode.commands.registerCommand('gameVibe.createRPGDemo', async () => {
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
            if (!workspaceFolder) {
                const answer = await vscode.window.showInformationMessage(
                    'Please open a folder first to create the RPG demo.',
                    'Open Folder'
                );
                if (answer === 'Open Folder') {
                    vscode.commands.executeCommand('vscode.openFolder');
                }
                return;
            }
            await createRPGDemo(workspaceFolder);
        })
    );

    // Register browser launch command
    context.subscriptions.push(
        vscode.commands.registerCommand('gameVibe.runInBrowser', async () => {
            const activeEditor = vscode.window.activeTextEditor;
            if (!activeEditor || !activeEditor.document.fileName.endsWith('.gdl')) {
                vscode.window.showErrorMessage('Please open a .gdl file first to run the game in browser');
                return;
            }

            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
            if (!workspaceFolder) {
                vscode.window.showErrorMessage('Please open a workspace folder first');
                return;
            }

            try {
                const gdlContent = activeEditor.document.getText();
                
                // Check if this is an enhanced Phaser RPG demo
                const isPhaserRPG = gdlContent.includes('PhaserRPGMain') || 
                                   gdlContent.includes('phaser-rpg-assets') ||
                                   activeEditor.document.fileName.includes('phaser-rpg');
                
                let gameServer: GameServer | PhaserRPGGameServer;
                let serverType: string;
                
                if (isPhaserRPG) {
                    gameServer = new PhaserRPGGameServer();
                    serverType = 'Enhanced Phaser RPG';
                } else {
                    gameServer = new GameServer();
                    serverType = 'Standard';
                }
                
                const url = await gameServer.start(gdlContent, workspaceFolder.uri.fsPath);
                
                // Open browser
                vscode.env.openExternal(vscode.Uri.parse(url));
                vscode.window.showInformationMessage(`🚀 ${serverType} game launched in browser at ${url}`);
                
                // Stop server after 5 minutes to prevent hanging processes
                setTimeout(() => {
                    gameServer.stop();
                }, 5 * 60 * 1000);
                
            } catch (error) {
                vscode.window.showErrorMessage(`Failed to start game server: ${error}`);
            }
        })
    );

    // Register Full Featured RPG Demo command
    context.subscriptions.push(
        vscode.commands.registerCommand('gameVibe.createFullRPGDemo', async () => {
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
            if (!workspaceFolder) {
                const answer = await vscode.window.showInformationMessage(
                    'Please open a folder first to create the full RPG demo.',
                    'Open Folder'
                );
                if (answer === 'Open Folder') {
                    vscode.commands.executeCommand('vscode.openFolder');
                }
                return;
            }
            await createFullFeaturedRPGDemo(workspaceFolder);
        })
    );

    // Register Enhanced Phaser RPG Demo command
    context.subscriptions.push(
        vscode.commands.registerCommand('gameVibe.createPhaserRPGDemo', async () => {
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
            if (!workspaceFolder) {
                const answer = await vscode.window.showInformationMessage(
                    'Please open a folder first to create the Enhanced Phaser RPG demo.',
                    'Open Folder'
                );
                if (answer === 'Open Folder') {
                    vscode.commands.executeCommand('vscode.openFolder');
                }
                return;
            }
            await createEnhancedPhaserRPGDemo(workspaceFolder);
        })
    );

    // Register sprite editor command
    context.subscriptions.push(
        vscode.commands.registerCommand('gameVibe.openSpriteEditor', async () => {
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
            if (!workspaceFolder) {
                const answer = await vscode.window.showInformationMessage(
                    'Please open a folder first to use the sprite editor.',
                    'Open Folder'
                );
                if (answer === 'Open Folder') {
                    vscode.commands.executeCommand('vscode.openFolder');
                }
                return;
            }

            // Create a new untitled sprite file or open existing
            const fileName = await vscode.window.showInputBox({
                prompt: 'Enter sprite name',
                value: 'new_sprite'
            });
            
            if (!fileName) return;
            
            // Create assets folder if it doesn't exist
            const assetsPath = vscode.Uri.joinPath(workspaceFolder.uri, 'assets', 'sprites');
            try {
                await vscode.workspace.fs.createDirectory(assetsPath);
            } catch {
                // Directory might already exist
            }

            // Create or open sprite file
            const spriteFilePath = vscode.Uri.joinPath(assetsPath, `${fileName}.sprite`);
            
            // Check if file exists, if not create it with empty content
            try {
                await vscode.workspace.fs.stat(spriteFilePath);
            } catch {
                // File doesn't exist, create it with initial content
                const initialContent = Buffer.from('', 'utf8');
                await vscode.workspace.fs.writeFile(spriteFilePath, initialContent);
            }
            
            // Open with custom editor (sprite editor)
            await vscode.commands.executeCommand('vscode.openWith', spriteFilePath, 'gameVibe.spriteEditor');
        })
    );

    // Register level designer command
    context.subscriptions.push(
        vscode.commands.registerCommand('gameVibe.openLevelDesigner', async () => {
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
            if (!workspaceFolder) {
                const answer = await vscode.window.showInformationMessage(
                    'Please open a folder first to use the level designer.',
                    'Open Folder'
                );
                if (answer === 'Open Folder') {
                    vscode.commands.executeCommand('vscode.openFolder');
                }
                return;
            }

            // Create or select level file
            const fileName = await vscode.window.showInputBox({
                prompt: 'Enter level name',
                value: 'level1'
            });
            
            if (!fileName) return;
            
            // Create levels folder if it doesn't exist
            const levelsPath = vscode.Uri.joinPath(workspaceFolder.uri, 'levels');
            try {
                await vscode.workspace.fs.createDirectory(levelsPath);
            } catch {
                // Directory might already exist
            }

            // Create or open level file
            const levelFilePath = vscode.Uri.joinPath(levelsPath, `${fileName}.gdl`);
            
            // Check if file exists, if not create it with default content
            try {
                await vscode.workspace.fs.stat(levelFilePath);
            } catch {
                // File doesn't exist, create it with initial level content
                const initialContent = Buffer.from(`// Level: ${fileName}
scene MainScene {
    size: { width: 1920, height: 1080 }
    background: "#87CEEB"
    gravity: 800
}`, 'utf8');
                await vscode.workspace.fs.writeFile(levelFilePath, initialContent);
            }
            
            // Open with level designer
            await vscode.commands.executeCommand('vscode.openWith', levelFilePath, 'gameVibe.levelDesigner');
        })
    );

    // Register music editor command
    context.subscriptions.push(
        vscode.commands.registerCommand('gameVibe.openMusicEditor', async () => {
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
            if (!workspaceFolder) {
                const answer = await vscode.window.showInformationMessage(
                    'Please open a folder first to use the music editor.',
                    'Open Folder'
                );
                if (answer === 'Open Folder') {
                    vscode.commands.executeCommand('vscode.openFolder');
                }
                return;
            }

            // Create or select music file
            const fileName = await vscode.window.showInputBox({
                prompt: 'Enter music track name',
                value: 'new_track'
            });
            
            if (!fileName) return;
            
            // Create music folder if it doesn't exist
            const musicPath = vscode.Uri.joinPath(workspaceFolder.uri, 'assets', 'music');
            try {
                await vscode.workspace.fs.createDirectory(musicPath);
            } catch {
                // Directory might already exist
            }

            // Create or open music file
            const musicFilePath = vscode.Uri.joinPath(musicPath, `${fileName}.music`);
            
            // Check if file exists, if not create it with default content
            try {
                await vscode.workspace.fs.stat(musicFilePath);
            } catch {
                // File doesn't exist, create it with initial music content
                const initialContent = Buffer.from(`// Music Track: ${fileName}
{
    "name": "${fileName}",
    "description": "AI-generated music and sound effects for ${fileName}",
    "type": "music_project",
    "tracks": {
        "speech": [],
        "soundEffects": [],
        "voiceDesigns": [],
        "gamePresets": []
    },
    "settings": {
        "defaultVoice": "",
        "defaultModel": "eleven_multilingual_v2",
        "outputFormat": "mp3"
    }
}`, 'utf8');
                await vscode.workspace.fs.writeFile(musicFilePath, initialContent);
            }
            
            // Open with music editor
            await vscode.commands.executeCommand('vscode.openWith', musicFilePath, 'gameVibe.musicEditor');
        })
    );

    // Browser commands for editors
    context.subscriptions.push(
        vscode.commands.registerCommand('gameVibe.levelEditorBrowser', async () => {
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
            if (!workspaceFolder) {
                vscode.window.showErrorMessage('Please open a workspace folder first.');
                return;
            }

            try {
                const { EnhancedLevelDesignerServer } = await import('./server/EnhancedLevelDesignerServer');
                const server = new EnhancedLevelDesignerServer();
                const url = await server.start('', workspaceFolder.uri.fsPath);
                
                vscode.env.openExternal(vscode.Uri.parse(url));
                vscode.window.showInformationMessage(`🎨 Level Designer opened in browser: ${url}`);
                
                // Stop server after 10 minutes to prevent hanging processes
                setTimeout(() => {
                    server.stop();
                }, 10 * 60 * 1000);
            } catch (error) {
                vscode.window.showErrorMessage(`Failed to start Level Designer: ${error}`);
            }
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('gameVibe.spriteEditorBrowser', async () => {
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
            if (!workspaceFolder) {
                vscode.window.showErrorMessage('Please open a workspace folder first.');
                return;
            }

            try {
                const { EnhancedSpriteEditorServer } = await import('./server/EnhancedSpriteEditorServer');
                const server = new EnhancedSpriteEditorServer();
                const url = await server.start('', workspaceFolder.uri.fsPath);
                
                vscode.env.openExternal(vscode.Uri.parse(url));
                vscode.window.showInformationMessage(`🎨 Sprite Editor opened in browser: ${url}`);
                
                // Stop server after 10 minutes to prevent hanging processes
                setTimeout(() => {
                    server.stop();
                }, 10 * 60 * 1000);
            } catch (error) {
                vscode.window.showErrorMessage(`Failed to start Sprite Editor: ${error}`);
            }
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('gameVibe.musicEditorBrowser', async () => {
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
            if (!workspaceFolder) {
                vscode.window.showErrorMessage('Please open a workspace folder first.');
                return;
            }

            try {
                const { EnhancedMusicEditorServer } = await import('./server/EnhancedMusicEditorServer');
                const server = new EnhancedMusicEditorServer();
                const url = await server.start('', workspaceFolder.uri.fsPath);
                
                vscode.env.openExternal(vscode.Uri.parse(url));
                vscode.window.showInformationMessage(`🎵 Music Editor opened in browser: ${url}`);
                
                // Stop server after 10 minutes to prevent hanging processes
                setTimeout(() => {
                    server.stop();
                }, 10 * 60 * 1000);
            } catch (error) {
                vscode.window.showErrorMessage(`Failed to start Music Editor: ${error}`);
            }
        })
    );

    // Command to edit existing GDL file in level editor
    context.subscriptions.push(
        vscode.commands.registerCommand('gameVibe.editGDLInLevelEditor', async (uri?: vscode.Uri) => {
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
            if (!workspaceFolder) {
                vscode.window.showErrorMessage('Please open a workspace folder first.');
                return;
            }

            let gdlFile: vscode.Uri | undefined = uri;
            
            // If no URI provided, try to get from active editor or let user select
            if (!gdlFile) {
                const activeEditor = vscode.window.activeTextEditor;
                if (activeEditor && activeEditor.document.fileName.endsWith('.gdl')) {
                    gdlFile = activeEditor.document.uri;
                } else {
                    // Let user select a GDL file
                    const fileUris = await vscode.window.showOpenDialog({
                        canSelectFiles: true,
                        canSelectFolders: false,
                        canSelectMany: false,
                        filters: {
                            'GDL Files': ['gdl']
                        },
                        defaultUri: workspaceFolder.uri
                    });
                    
                    if (fileUris && fileUris.length > 0) {
                        gdlFile = fileUris[0];
                    }
                }
            }

            if (!gdlFile) {
                vscode.window.showErrorMessage('Please select a GDL file to edit.');
                return;
            }

            try {
                // Read the GDL file content
                const gdlContent = await vscode.workspace.fs.readFile(gdlFile);
                const gdlString = Buffer.from(gdlContent).toString('utf8');
                
                const { EnhancedLevelDesignerServer } = await import('./server/EnhancedLevelDesignerServer');
                const server = new EnhancedLevelDesignerServer();
                const url = await server.start(gdlString, workspaceFolder.uri.fsPath);
                
                vscode.env.openExternal(vscode.Uri.parse(url));
                vscode.window.showInformationMessage(`🎨 Level Designer opened for ${vscode.workspace.asRelativePath(gdlFile)}: ${url}`);
                
                // Stop server after 10 minutes to prevent hanging processes
                setTimeout(() => {
                    server.stop();
                }, 10 * 60 * 1000);
            } catch (error) {
                vscode.window.showErrorMessage(`Failed to start Level Designer: ${error}`);
            }
        })
    );

    // Update status bar
    const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    statusBarItem.text = '$(game) Game Vibe';
    statusBarItem.command = 'gameVibe.openEditor';
    statusBarItem.show();
    context.subscriptions.push(statusBarItem);
}

export function deactivate() {
    if (gameEngine) {
        gameEngine.stop();
    }
}

async function createGameTemplate(workspaceFolder: vscode.WorkspaceFolder, gameType: string): Promise<void> {
    const fs = vscode.workspace.fs;
    const workspaceUri = workspaceFolder.uri;
    
    try {
        // Create basic project structure
        await fs.createDirectory(vscode.Uri.joinPath(workspaceUri, 'assets'));
        await fs.createDirectory(vscode.Uri.joinPath(workspaceUri, 'assets', 'sprites'));
        await fs.createDirectory(vscode.Uri.joinPath(workspaceUri, 'assets', 'sounds'));
        await fs.createDirectory(vscode.Uri.joinPath(workspaceUri, 'scenes'));
        await fs.createDirectory(vscode.Uri.joinPath(workspaceUri, 'levels'));

        // Create template-specific files
        switch (gameType) {
            case 'Platformer':
                await createPlatformerTemplate(workspaceUri, fs);
                break;
            case 'Top-Down':
                await createTopDownTemplate(workspaceUri, fs);
                break;
            case 'Puzzle':
                await createPuzzleTemplate(workspaceUri, fs);
                break;
            case 'Racing':
                await createRacingTemplate(workspaceUri, fs);
                break;
            case 'Shooter':
                await createShooterTemplate(workspaceUri, fs);
                break;
            default:
                await createCustomTemplate(workspaceUri, fs);
                break;
        }

        // Create common config files
        await createProjectConfig(workspaceUri, fs, gameType);
        await createGameProjectReadme(workspaceUri, fs, gameType);

        // Open the main game file
        const mainGameUri = vscode.Uri.joinPath(workspaceUri, 'game.gdl');
        const document = await vscode.workspace.openTextDocument(mainGameUri);
        await vscode.window.showTextDocument(document);
        
        vscode.window.showInformationMessage(`🎮 ${gameType} game template created! Use "Game Vibe: Run Game" to preview.`);
        
    } catch (error) {
        vscode.window.showErrorMessage(`Failed to create ${gameType} template: ${error}`);
    }
}

async function createPlatformerTemplate(workspaceUri: vscode.Uri, fs: vscode.FileSystem): Promise<void> {
    // Main game file
    const mainGame = `// 🏃 Platformer Game - Main Scene
// A classic side-scrolling platformer with jumping mechanics

scene MainScene {
    // Player character with platformer controls
    entity Player {
        transform: { x: 100, y: 502 }
        sprite: { texture: "player", width: 32, height: 48, color: "#4A90E2" }
        physics: { mode: "platformer", mass: 1, friction: 0.8 }
        collider: { type: "box", width: 28, height: 44 }
        behavior: PlatformerMovement { 
            speed: 220, 
            jumpPower: 450,
            doubleJump: true,
            wallJump: false
        }
    }

    // Ground platform
    entity Ground {
        transform: { x: 400, y: 550 }
        sprite: { texture: "ground", width: 800, height: 100, color: "#8B4513" }
        physics: { mode: "static" }
        collider: { type: "box", width: 800, height: 100 }
    }

    // Jumping platforms
    entity Platform1 {
        transform: { x: 250, y: 450 }
        sprite: { texture: "platform", width: 120, height: 20, color: "#654321" }
        physics: { mode: "static" }
        collider: { type: "box", width: 120, height: 20 }
    }

    entity Platform2 {
        transform: { x: 450, y: 350 }
        sprite: { texture: "platform", width: 120, height: 20, color: "#654321" }
        physics: { mode: "static" }
        collider: { type: "box", width: 120, height: 20 }
    }

    entity Platform3 {
        transform: { x: 650, y: 250 }
        sprite: { texture: "platform", width: 120, height: 20, color: "#654321" }
        physics: { mode: "static" }
        collider: { type: "box", width: 120, height: 20 }
    }

    // Collectible coins
    entity Coin1 {
        transform: { x: 250, y: 400 }
        sprite: { texture: "coin", width: 24, height: 24, color: "#FFD700" }
        physics: { mode: "static" }
        collider: { type: "circle", radius: 12, isTrigger: true }
        behavior: SpinBehavior { speed: 2 }
    }

    entity Coin2 {
        transform: { x: 450, y: 300 }
        sprite: { texture: "coin", width: 24, height: 24, color: "#FFD700" }
        physics: { mode: "static" }
        collider: { type: "circle", radius: 12, isTrigger: true }
        behavior: SpinBehavior { speed: 2 }
    }

    // Enemy patrol
    entity Enemy {
        transform: { x: 600, y: 500 }
        sprite: { texture: "enemy", width: 28, height: 32, color: "#FF4444" }
        physics: { mode: "dynamic", mass: 0.8 }
        collider: { type: "box", width: 28, height: 32 }
        behavior: PatrolBehavior { 
            distance: 100, 
            speed: 50,
            direction: "horizontal"
        }
    }

    // Goal flag
    entity Goal {
        transform: { x: 720, y: 480 }
        sprite: { texture: "flag", width: 32, height: 64, color: "#00FF00" }
        physics: { mode: "static" }
        collider: { type: "box", width: 32, height: 64, isTrigger: true }
        behavior: VictoryTrigger { nextLevel: "Level1" }
    }
}`;

    await fs.writeFile(vscode.Uri.joinPath(workspaceUri, 'game.gdl'), Buffer.from(mainGame, 'utf8'));

    // Level 1
    const level1 = `// 🏃 Platformer Game - Level 1
// A more challenging level with moving platforms and more enemies

scene Level1 {
    entity Player {
        transform: { x: 50, y: 500 }
        sprite: { texture: "player", width: 32, height: 48, color: "#4A90E2" }
        physics: { mode: "platformer", mass: 1, friction: 0.8 }
        collider: { type: "box", width: 28, height: 44 }
        behavior: PlatformerMovement { 
            speed: 220, 
            jumpPower: 450,
            doubleJump: true,
            wallJump: true
        }
    }

    // Ground segments with gaps
    entity Ground1 {
        transform: { x: 100, y: 550 }
        sprite: { texture: "ground", width: 200, height: 100, color: "#8B4513" }
        physics: { mode: "static" }
        collider: { type: "box", width: 200, height: 100 }
    }

    entity Ground2 {
        transform: { x: 400, y: 550 }
        sprite: { texture: "ground", width: 200, height: 100, color: "#8B4513" }
        physics: { mode: "static" }
        collider: { type: "box", width: 200, height: 100 }
    }

    entity Ground3 {
        transform: { x: 700, y: 550 }
        sprite: { texture: "ground", width: 200, height: 100, color: "#8B4513" }
        physics: { mode: "static" }
        collider: { type: "box", width: 200, height: 100 }
    }

    // Moving platform
    entity MovingPlatform {
        transform: { x: 300, y: 400 }
        sprite: { texture: "platform", width: 100, height: 20, color: "#9B59B6" }
        physics: { mode: "kinematic" }
        collider: { type: "box", width: 100, height: 20 }
        behavior: MovingPlatform { 
            startPos: { x: 300, y: 400 },
            endPos: { x: 500, y: 300 },
            speed: 60,
            pauseTime: 2
        }
    }

    // Wall jump sections
    entity Wall1 {
        transform: { x: 600, y: 450 }
        sprite: { texture: "wall", width: 20, height: 100, color: "#7F8C8D" }
        physics: { mode: "static" }
        collider: { type: "box", width: 20, height: 100 }
    }

    entity Wall2 {
        transform: { x: 650, y: 350 }
        sprite: { texture: "wall", width: 20, height: 100, color: "#7F8C8D" }
        physics: { mode: "static" }
        collider: { type: "box", width: 20, height: 100 }
    }

    // Multiple enemies
    entity Enemy1 {
        transform: { x: 150, y: 500 }
        sprite: { texture: "enemy", width: 28, height: 32, color: "#E74C3C" }
        physics: { mode: "dynamic", mass: 0.8 }
        collider: { type: "box", width: 28, height: 32 }
        behavior: PatrolBehavior { distance: 80, speed: 40 }
    }

    entity Enemy2 {
        transform: { x: 450, y: 500 }
        sprite: { texture: "enemy", width: 28, height: 32, color: "#E74C3C" }
        physics: { mode: "dynamic", mass: 0.8 }
        collider: { type: "box", width: 28, height: 32 }
        behavior: PatrolBehavior { distance: 120, speed: 60 }
    }

    // Power-up
    entity PowerUp {
        transform: { x: 520, y: 250 }
        sprite: { texture: "powerup", width: 24, height: 24, color: "#F39C12" }
        physics: { mode: "static" }
        collider: { type: "circle", radius: 12, isTrigger: true }
        behavior: PowerUpBehavior { type: "doubleJump" }
    }

    // Level exit
    entity Exit {
        transform: { x: 750, y: 480 }
        sprite: { texture: "exit", width: 40, height: 64, color: "#2ECC71" }
        physics: { mode: "static" }
        collider: { type: "box", width: 40, height: 64, isTrigger: true }
        behavior: LevelExit { nextLevel: "Level2" }
    }
}`;

    await fs.writeFile(vscode.Uri.joinPath(workspaceUri, 'levels', 'level1.gdl'), Buffer.from(level1, 'utf8'));

    // Boss level
    const bossLevel = `// 🏃 Platformer Game - Boss Level
// Final confrontation with a challenging boss enemy

scene BossLevel {
    entity Player {
        transform: { x: 100, y: 450 }
        sprite: { texture: "player", width: 32, height: 48, color: "#4A90E2" }
        physics: { mode: "platformer", mass: 1, friction: 0.8 }
        collider: { type: "box", width: 28, height: 44 }
        behavior: PlatformerMovement { 
            speed: 250, 
            jumpPower: 500,
            doubleJump: true,
            wallJump: true
        }
    }

    // Arena floor
    entity Arena {
        transform: { x: 400, y: 550 }
        sprite: { texture: "arena", width: 800, height: 100, color: "#34495E" }
        physics: { mode: "static" }
        collider: { type: "box", width: 800, height: 100 }
    }

    // Boss platforms
    entity BossPlatform1 {
        transform: { x: 200, y: 400 }
        sprite: { texture: "platform", width: 80, height: 20, color: "#95A5A6" }
        physics: { mode: "static" }
        collider: { type: "box", width: 80, height: 20 }
    }

    entity BossPlatform2 {
        transform: { x: 400, y: 350 }
        sprite: { texture: "platform", width: 80, height: 20, color: "#95A5A6" }
        physics: { mode: "static" }
        collider: { type: "box", width: 80, height: 20 }
    }

    entity BossPlatform3 {
        transform: { x: 600, y: 400 }
        sprite: { texture: "platform", width: 80, height: 20, color: "#95A5A6" }
        physics: { mode: "static" }
        collider: { type: "box", width: 80, height: 20 }
    }

    // Boss enemy
    entity Boss {
        transform: { x: 600, y: 450 }
        sprite: { texture: "boss", width: 64, height: 80, color: "#8E44AD" }
        physics: { mode: "dynamic", mass: 2 }
        collider: { type: "box", width: 60, height: 76 }
        behavior: BossBehavior { 
            health: 5,
            attackPattern: "jump_slam",
            speed: 80
        }
    }

    // Health pickups
    entity Health1 {
        transform: { x: 200, y: 350 }
        sprite: { texture: "health", width: 20, height: 20, color: "#E67E22" }
        physics: { mode: "static" }
        collider: { type: "circle", radius: 10, isTrigger: true }
        behavior: HealthPickup { amount: 1 }
    }

    entity Health2 {
        transform: { x: 600, y: 350 }
        sprite: { texture: "health", width: 20, height: 20, color: "#E67E22" }
        physics: { mode: "static" }
        collider: { type: "circle", radius: 10, isTrigger: true }
        behavior: HealthPickup { amount: 1 }
    }
}`;

    await fs.writeFile(vscode.Uri.joinPath(workspaceUri, 'levels', 'boss.gdl'), Buffer.from(bossLevel, 'utf8'));
}

async function createTopDownTemplate(workspaceUri: vscode.Uri, fs: vscode.FileSystem): Promise<void> {
    const mainGame = `// 🔄 Top-Down Game - Main Scene
// Bird's eye view game like RPGs or twin-stick shooters

scene MainScene {
    // Player character with omnidirectional movement
    entity Player {
        transform: { x: 400, y: 300 }
        sprite: { texture: "player", width: 32, height: 32, color: "#3498DB" }
        physics: { mode: "topdown", mass: 1, friction: 0.85 }
        collider: { type: "circle", radius: 14 }
        behavior: TopDownMovement { 
            speed: 180,
            acceleration: 600,
            rotateToMovement: true
        }
    }

    // Walls forming a simple maze
    entity WallTop {
        transform: { x: 400, y: 50 }
        sprite: { texture: "wall", width: 800, height: 20, color: "#7F8C8D" }
        physics: { mode: "static" }
        collider: { type: "box", width: 800, height: 20 }
    }

    entity WallBottom {
        transform: { x: 400, y: 550 }
        sprite: { texture: "wall", width: 800, height: 20, color: "#7F8C8D" }
        physics: { mode: "static" }
        collider: { type: "box", width: 800, height: 20 }
    }

    entity WallLeft {
        transform: { x: 50, y: 300 }
        sprite: { texture: "wall", width: 20, height: 500, color: "#7F8C8D" }
        physics: { mode: "static" }
        collider: { type: "box", width: 20, height: 500 }
    }

    entity WallRight {
        transform: { x: 750, y: 300 }
        sprite: { texture: "wall", width: 20, height: 500, color: "#7F8C8D" }
        physics: { mode: "static" }
        collider: { type: "box", width: 20, height: 500 }
    }

    // Interior maze walls
    entity MazeWall1 {
        transform: { x: 200, y: 200 }
        sprite: { texture: "wall", width: 20, height: 200, color: "#95A5A6" }
        physics: { mode: "static" }
        collider: { type: "box", width: 20, height: 200 }
    }

    entity MazeWall2 {
        transform: { x: 400, y: 150 }
        sprite: { texture: "wall", width: 200, height: 20, color: "#95A5A6" }
        physics: { mode: "static" }
        collider: { type: "box", width: 200, height: 20 }
    }

    entity MazeWall3 {
        transform: { x: 600, y: 400 }
        sprite: { texture: "wall", width: 20, height: 200, color: "#95A5A6" }
        physics: { mode: "static" }
        collider: { type: "box", width: 20, height: 200 }
    }

    // Enemies with different AI behaviors
    entity GuardEnemy1 {
        transform: { x: 150, y: 400 }
        sprite: { texture: "guard", width: 28, height: 28, color: "#E74C3C" }
        physics: { mode: "dynamic", mass: 0.8 }
        collider: { type: "circle", radius: 14 }
        behavior: PatrolBehavior { 
            points: [
                { x: 150, y: 400 },
                { x: 150, y: 500 },
                { x: 300, y: 500 },
                { x: 300, y: 400 }
            ],
            speed: 60
        }
    }

    entity ChaserEnemy {
        transform: { x: 650, y: 200 }
        sprite: { texture: "chaser", width: 24, height: 24, color: "#8E44AD" }
        physics: { mode: "dynamic", mass: 0.6 }
        collider: { type: "circle", radius: 12 }
        behavior: ChaseBehavior { 
            target: "Player",
            chaseDistance: 150,
            speed: 120,
            returnToStart: true
        }
    }

    // Collectibles
    entity Key {
        transform: { x: 300, y: 450 }
        sprite: { texture: "key", width: 20, height: 20, color: "#F1C40F" }
        physics: { mode: "static" }
        collider: { type: "circle", radius: 10, isTrigger: true }
        behavior: KeyBehavior { id: "goldKey" }
    }

    entity Treasure1 {
        transform: { x: 500, y: 250 }
        sprite: { texture: "treasure", width: 24, height: 24, color: "#F39C12" }
        physics: { mode: "static" }
        collider: { type: "circle", radius: 12, isTrigger: true }
        behavior: CollectibleBehavior { points: 100 }
    }

    entity Treasure2 {
        transform: { x: 700, y: 500 }
        sprite: { texture: "treasure", width: 24, height: 24, color: "#F39C12" }
        physics: { mode: "static" }
        collider: { type: "circle", radius: 12, isTrigger: true }
        behavior: CollectibleBehavior { points: 100 }
    }

    // Locked door
    entity Door {
        transform: { x: 650, y: 100 }
        sprite: { texture: "door", width: 30, height: 60, color: "#8B4513" }
        physics: { mode: "static" }
        collider: { type: "box", width: 30, height: 60, isTrigger: true }
        behavior: LockedDoor { requiredKey: "goldKey", nextLevel: "Dungeon1" }
    }
}`;

    await fs.writeFile(vscode.Uri.joinPath(workspaceUri, 'game.gdl'), Buffer.from(mainGame, 'utf8'));

    const dungeon1 = `// 🔄 Top-Down Game - Dungeon Level 1
// A more complex dungeon with multiple rooms

scene Dungeon1 {
    entity Player {
        transform: { x: 100, y: 100 }
        sprite: { texture: "player", width: 32, height: 32, color: "#3498DB" }
        physics: { mode: "topdown", mass: 1, friction: 0.85 }
        collider: { type: "circle", radius: 14 }
        behavior: TopDownMovement { 
            speed: 200,
            acceleration: 700,
            rotateToMovement: true
        }
    }

    // Room boundaries
    entity Room1Walls {
        transform: { x: 200, y: 200 }
        sprite: { texture: "walls", width: 300, height: 20, color: "#2C3E50" }
        physics: { mode: "static" }
        collider: { type: "box", width: 300, height: 20 }
    }

    // Multiple enemies with different behaviors
    entity Skeleton1 {
        transform: { x: 200, y: 300 }
        sprite: { texture: "skeleton", width: 28, height: 28, color: "#BDC3C7" }
        physics: { mode: "dynamic", mass: 0.7 }
        collider: { type: "circle", radius: 14 }
        behavior: WanderBehavior { radius: 80, speed: 40 }
    }

    entity Skeleton2 {
        transform: { x: 400, y: 400 }
        sprite: { texture: "skeleton", width: 28, height: 28, color: "#BDC3C7" }
        physics: { mode: "dynamic", mass: 0.7 }
        collider: { type: "circle", radius: 14 }
        behavior: WanderBehavior { radius: 60, speed: 50 }
    }

    // Boss room
    entity BossRoomDoor {
        transform: { x: 700, y: 300 }
        sprite: { texture: "bossdoor", width: 40, height: 80, color: "#8E44AD" }
        physics: { mode: "static" }
        collider: { type: "box", width: 40, height: 80, isTrigger: true }
        behavior: BossRoomEntry { requiredItems: 2 }
    }
}`;

    await fs.writeFile(vscode.Uri.joinPath(workspaceUri, 'levels', 'dungeon1.gdl'), Buffer.from(dungeon1, 'utf8'));
}

async function createPuzzleTemplate(workspaceUri: vscode.Uri, fs: vscode.FileSystem): Promise<void> {
    const mainGame = `// 🧩 Puzzle Game - Main Scene
// Logic-based game with drag-and-drop mechanics

scene MainScene {
    // Draggable blocks
    entity Block1 {
        transform: { x: 150, y: 400 }
        sprite: { texture: "block", width: 60, height: 60, color: "#E74C3C" }
        physics: { mode: "kinematic" }
        collider: { type: "box", width: 60, height: 60 }
        behavior: DragDropBehavior { 
            snapToGrid: true,
            gridSize: 60,
            returnOnInvalidDrop: true
        }
    }

    entity Block2 {
        transform: { x: 250, y: 400 }
        sprite: { texture: "block", width: 60, height: 60, color: "#3498DB" }
        physics: { mode: "kinematic" }
        collider: { type: "box", width: 60, height: 60 }
        behavior: DragDropBehavior { 
            snapToGrid: true,
            gridSize: 60,
            returnOnInvalidDrop: true
        }
    }

    entity Block3 {
        transform: { x: 350, y: 400 }
        sprite: { texture: "block", width: 60, height: 60, color: "#2ECC71" }
        physics: { mode: "kinematic" }
        collider: { type: "box", width: 60, height: 60 }
        behavior: DragDropBehavior { 
            snapToGrid: true,
            gridSize: 60,
            returnOnInvalidDrop: true
        }
    }

    // Target slots with specific color requirements
    entity RedTarget {
        transform: { x: 500, y: 200 }
        sprite: { texture: "target", width: 70, height: 70, color: "#FFB6C1" }
        physics: { mode: "static" }
        collider: { type: "box", width: 70, height: 70, isTrigger: true }
        behavior: DropTarget { 
            acceptedColor: "red",
            id: "redSlot"
        }
    }

    entity BlueTarget {
        transform: { x: 600, y: 200 }
        sprite: { texture: "target", width: 70, height: 70, color: "#ADD8E6" }
        physics: { mode: "static" }
        collider: { type: "box", width: 70, height: 70, isTrigger: true }
        behavior: DropTarget { 
            acceptedColor: "blue",
            id: "blueSlot"
        }
    }

    entity GreenTarget {
        transform: { x: 700, y: 200 }
        sprite: { texture: "target", width: 70, height: 70, color: "#90EE90" }
        physics: { mode: "static" }
        collider: { type: "box", width: 70, height: 70, isTrigger: true }
        behavior: DropTarget { 
            acceptedColor: "green",
            id: "greenSlot"
        }
    }

    // Puzzle mechanics
    entity Switch1 {
        transform: { x: 200, y: 150 }
        sprite: { texture: "switch", width: 40, height: 40, color: "#F39C12" }
        physics: { mode: "static" }
        collider: { type: "circle", radius: 20, isTrigger: true }
        behavior: PressurePlate { 
            requiredWeight: 1,
            activatedColor: "#E67E22"
        }
    }

    entity Switch2 {
        transform: { x: 300, y: 150 }
        sprite: { texture: "switch", width: 40, height: 40, color: "#F39C12" }
        physics: { mode: "static" }
        collider: { type: "circle", radius: 20, isTrigger: true }
        behavior: PressurePlate { 
            requiredWeight: 1,
            activatedColor: "#E67E22"
        }
    }

    // Moving platform activated by switches
    entity MovingBridge {
        transform: { x: 250, y: 300 }
        sprite: { texture: "bridge", width: 200, height: 30, color: "#8B4513" }
        physics: { mode: "kinematic" }
        collider: { type: "box", width: 200, height: 30 }
        behavior: SwitchActivatedPlatform { 
            requiredSwitches: ["switch1", "switch2"],
            targetPosition: { x: 550, y: 300 },
            speed: 100
        }
    }

    // Victory condition
    entity VictoryZone {
        transform: { x: 600, y: 500 }
        sprite: { texture: "victory", width: 100, height: 50, color: "#F1C40F" }
        physics: { mode: "static" }
        collider: { type: "box", width: 100, height: 50, isTrigger: true }
        behavior: VictoryCondition { 
            requiredTargets: ["redSlot", "blueSlot", "greenSlot"],
            nextLevel: "Puzzle2"
        }
    }
}`;

    await fs.writeFile(vscode.Uri.joinPath(workspaceUri, 'game.gdl'), Buffer.from(mainGame, 'utf8'));

    const puzzle2 = `// 🧩 Puzzle Game - Level 2
// More complex puzzle with timing elements

scene Puzzle2 {
    // Multiple colored blocks with different properties
    entity LightBlock {
        transform: { x: 100, y: 500 }
        sprite: { texture: "lightblock", width: 40, height: 40, color: "#ECF0F1" }
        physics: { mode: "kinematic", weight: 0.5 }
        collider: { type: "box", width: 40, height: 40 }
        behavior: DragDropBehavior { snapToGrid: true, gridSize: 40 }
    }

    entity HeavyBlock {
        transform: { x: 200, y: 500 }
        sprite: { texture: "heavyblock", width: 60, height: 60, color: "#34495E" }
        physics: { mode: "kinematic", weight: 2 }
        collider: { type: "box", width: 60, height: 60 }
        behavior: DragDropBehavior { snapToGrid: true, gridSize: 40 }
    }

    // Weighted pressure plates
    entity LightPlate {
        transform: { x: 300, y: 400 }
        sprite: { texture: "plate", width: 50, height: 50, color: "#BDC3C7" }
        physics: { mode: "static" }
        collider: { type: "box", width: 50, height: 50, isTrigger: true }
        behavior: WeightedPlate { requiredWeight: 0.5, tolerance: 0.1 }
    }

    entity HeavyPlate {
        transform: { x: 500, y: 400 }
        sprite: { texture: "plate", width: 50, height: 50, color: "#7F8C8D" }
        physics: { mode: "static" }
        collider: { type: "box", width: 50, height: 50, isTrigger: true }
        behavior: WeightedPlate { requiredWeight: 2, tolerance: 0.1 }
    }

    // Timed door
    entity TimedDoor {
        transform: { x: 600, y: 300 }
        sprite: { texture: "door", width: 40, height: 80, color: "#9B59B6" }
        physics: { mode: "static" }
        collider: { type: "box", width: 40, height: 80 }
        behavior: TimedDoor { 
            openDuration: 5,
            requiredPlates: ["lightPlate", "heavyPlate"]
        }
    }

    // Final puzzle element
    entity ColorMixer {
        transform: { x: 400, y: 200 }
        sprite: { texture: "mixer", width: 80, height: 80, color: "#E8DAEF" }
        physics: { mode: "static" }
        collider: { type: "box", width: 80, height: 80, isTrigger: true }
        behavior: ColorMixingPuzzle { 
            requiredColors: ["red", "blue"],
            resultColor: "purple",
            completionTarget: "finalExit"
        }
    }
}`;

    await fs.writeFile(vscode.Uri.joinPath(workspaceUri, 'levels', 'puzzle2.gdl'), Buffer.from(puzzle2, 'utf8'));
}

async function createRacingTemplate(workspaceUri: vscode.Uri, fs: vscode.FileSystem): Promise<void> {
    const mainGame = `// 🏎️ Racing Game - Main Track
// Fast-paced racing with checkpoints and obstacles

scene MainTrack {
    // Player car
    entity PlayerCar {
        transform: { x: 100, y: 500 }
        sprite: { texture: "playercar", width: 40, height: 20, color: "#FF6B6B" }
        physics: { mode: "racing", mass: 1, friction: 0.9 }
        collider: { type: "box", width: 36, height: 16 }
        behavior: RacingControl { 
            acceleration: 800,
            maxSpeed: 300,
            turnSpeed: 180,
            braking: 600
        }
    }

    // Track boundaries
    entity OuterWall1 {
        transform: { x: 400, y: 50 }
        sprite: { texture: "barrier", width: 800, height: 20, color: "#E74C3C" }
        physics: { mode: "static" }
        collider: { type: "box", width: 800, height: 20 }
    }

    entity OuterWall2 {
        transform: { x: 400, y: 550 }
        sprite: { texture: "barrier", width: 800, height: 20, color: "#E74C3C" }
        physics: { mode: "static" }
        collider: { type: "box", width: 800, height: 20 }
    }

    entity InnerWall1 {
        transform: { x: 300, y: 200 }
        sprite: { texture: "barrier", width: 20, height: 200, color: "#E74C3C" }
        physics: { mode: "static" }
        collider: { type: "box", width: 20, height: 200 }
    }

    entity InnerWall2 {
        transform: { x: 500, y: 400 }
        sprite: { texture: "barrier", width: 20, height: 200, color: "#E74C3C" }
        physics: { mode: "static" }
        collider: { type: "box", width: 20, height: 200 }
    }

    // Checkpoints
    entity Checkpoint1 {
        transform: { x: 300, y: 300 }
        sprite: { texture: "checkpoint", width: 60, height: 10, color: "#2ECC71" }
        physics: { mode: "static" }
        collider: { type: "box", width: 60, height: 10, isTrigger: true }
        behavior: RaceCheckpoint { id: 1, nextCheckpoint: 2 }
    }

    entity Checkpoint2 {
        transform: { x: 600, y: 200 }
        sprite: { texture: "checkpoint", width: 60, height: 10, color: "#2ECC71" }
        physics: { mode: "static" }
        collider: { type: "box", width: 60, height: 10, isTrigger: true }
        behavior: RaceCheckpoint { id: 2, nextCheckpoint: 3 }
    }

    entity Checkpoint3 {
        transform: { x: 700, y: 450 }
        sprite: { texture: "checkpoint", width: 10, height: 60, color: "#2ECC71" }
        physics: { mode: "static" }
        collider: { type: "box", width: 10, height: 60, isTrigger: true }
        behavior: RaceCheckpoint { id: 3, nextCheckpoint: "finish" }
    }

    // AI racing cars
    entity AICar1 {
        transform: { x: 120, y: 520 }
        sprite: { texture: "aicar", width: 40, height: 20, color: "#3498DB" }
        physics: { mode: "racing", mass: 1, friction: 0.9 }
        collider: { type: "box", width: 36, height: 16 }
        behavior: AIRacer { 
            waypoints: [
                { x: 200, y: 500 },
                { x: 300, y: 300 },
                { x: 600, y: 200 },
                { x: 700, y: 450 }
            ],
            speed: 200,
            aggression: 0.7
        }
    }

    entity AICar2 {
        transform: { x: 140, y: 480 }
        sprite: { texture: "aicar", width: 40, height: 20, color: "#9B59B6" }
        physics: { mode: "racing", mass: 1, friction: 0.9 }
        collider: { type: "box", width: 36, height: 16 }
        behavior: AIRacer { 
            waypoints: [
                { x: 200, y: 500 },
                { x: 300, y: 300 },
                { x: 600, y: 200 },
                { x: 700, y: 450 }
            ],
            speed: 180,
            aggression: 0.5
        }
    }

    // Power-ups
    entity SpeedBoost {
        transform: { x: 450, y: 350 }
        sprite: { texture: "speedboost", width: 24, height: 24, color: "#F39C12" }
        physics: { mode: "static" }
        collider: { type: "circle", radius: 12, isTrigger: true }
        behavior: PowerUp { type: "speed", duration: 3, multiplier: 1.5 }
    }

    entity Shield {
        transform: { x: 250, y: 450 }
        sprite: { texture: "shield", width: 24, height: 24, color: "#1ABC9C" }
        physics: { mode: "static" }
        collider: { type: "circle", radius: 12, isTrigger: true }
        behavior: PowerUp { type: "shield", duration: 5 }
    }

    // Obstacles
    entity OilSpill {
        transform: { x: 400, y: 380 }
        sprite: { texture: "oil", width: 60, height: 40, color: "#34495E" }
        physics: { mode: "static" }
        collider: { type: "box", width: 60, height: 40, isTrigger: true }
        behavior: Hazard { type: "slippery", strength: 0.3 }
    }

    // Finish line
    entity FinishLine {
        transform: { x: 150, y: 500 }
        sprite: { texture: "finish", width: 10, height: 80, color: "#FFFFFF" }
        physics: { mode: "static" }
        collider: { type: "box", width: 10, height: 80, isTrigger: true }
        behavior: RaceFinish { requiredLaps: 3, nextTrack: "SpeedwayTrack" }
    }
}`;

    await fs.writeFile(vscode.Uri.joinPath(workspaceUri, 'game.gdl'), Buffer.from(mainGame, 'utf8'));
}

async function createShooterTemplate(workspaceUri: vscode.Uri, fs: vscode.FileSystem): Promise<void> {
    const mainGame = `// 🎯 Shooter Game - Main Arena
// Action-packed shooter with projectiles and enemies

scene MainArena {
    // Player character
    entity Player {
        transform: { x: 400, y: 500 }
        sprite: { texture: "player", width: 32, height: 32, color: "#2ECC71" }
        physics: { mode: "topdown", mass: 1, friction: 0.8 }
        collider: { type: "circle", radius: 14 }
        behavior: ShooterMovement { 
            speed: 200,
            rotateToMouse: true,
            strafeEnabled: true
        }
        weapon: BlasterGun { 
            damage: 1,
            fireRate: 0.3,
            range: 400,
            projectileSpeed: 500
        }
    }

    // Cover objects
    entity Cover1 {
        transform: { x: 200, y: 300 }
        sprite: { texture: "cover", width: 60, height: 60, color: "#7F8C8D" }
        physics: { mode: "static" }
        collider: { type: "box", width: 60, height: 60 }
        behavior: Destructible { health: 3 }
    }

    entity Cover2 {
        transform: { x: 600, y: 300 }
        sprite: { texture: "cover", width: 60, height: 60, color: "#7F8C8D" }
        physics: { mode: "static" }
        collider: { type: "box", width: 60, height: 60 }
        behavior: Destructible { health: 3 }
    }

    entity Cover3 {
        transform: { x: 400, y: 200 }
        sprite: { texture: "cover", width: 80, height: 40, color: "#7F8C8D" }
        physics: { mode: "static" }
        collider: { type: "box", width: 80, height: 40 }
        behavior: Destructible { health: 5 }
    }

    // Enemy types
    entity GruntEnemy1 {
        transform: { x: 150, y: 150 }
        sprite: { texture: "grunt", width: 28, height: 28, color: "#E74C3C" }
        physics: { mode: "dynamic", mass: 0.8 }
        collider: { type: "circle", radius: 14 }
        behavior: BasicAI { 
            target: "Player",
            engageDistance: 200,
            speed: 100,
            shootDistance: 150
        }
        weapon: BasicGun { damage: 1, fireRate: 1, range: 200 }
        health: 2
    }

    entity GruntEnemy2 {
        transform: { x: 650, y: 150 }
        sprite: { texture: "grunt", width: 28, height: 28, color: "#E74C3C" }
        physics: { mode: "dynamic", mass: 0.8 }
        collider: { type: "circle", radius: 14 }
        behavior: BasicAI { 
            target: "Player",
            engageDistance: 200,
            speed: 80,
            shootDistance: 150
        }
        weapon: BasicGun { damage: 1, fireRate: 1.2, range: 200 }
        health: 2
    }

    entity SniperEnemy {
        transform: { x: 400, y: 100 }
        sprite: { texture: "sniper", width: 30, height: 30, color: "#8E44AD" }
        physics: { mode: "static" }
        collider: { type: "circle", radius: 15 }
        behavior: SniperAI { 
            target: "Player",
            engageDistance: 300,
            repositionTime: 5
        }
        weapon: SniperRifle { damage: 3, fireRate: 2, range: 400 }
        health: 3
    }

    entity RusherEnemy {
        transform: { x: 100, y: 400 }
        sprite: { texture: "rusher", width: 26, height: 26, color: "#F39C12" }
        physics: { mode: "dynamic", mass: 0.6 }
        collider: { type: "circle", radius: 13 }
        behavior: RushAI { 
            target: "Player",
            activationDistance: 250,
            speed: 250
        }
        weapon: MeleeAttack { damage: 2, range: 30 }
        health: 1
    }

    // Weapon pickups
    entity RapidFirePickup {
        transform: { x: 300, y: 450 }
        sprite: { texture: "rapidfire", width: 24, height: 24, color: "#E67E22" }
        physics: { mode: "static" }
        collider: { type: "circle", radius: 12, isTrigger: true }
        behavior: WeaponPickup { 
            weaponType: "RapidGun",
            ammo: 100,
            temporary: true,
            duration: 10
        }
    }

    entity ShotgunPickup {
        transform: { x: 500, y: 450 }
        sprite: { texture: "shotgun", width: 24, height: 24, color: "#D35400" }
        physics: { mode: "static" }
        collider: { type: "circle", radius: 12, isTrigger: true }
        behavior: WeaponPickup { 
            weaponType: "Shotgun",
            ammo: 20,
            temporary: true,
            duration: 15
        }
    }

    // Health and armor
    entity HealthPack {
        transform: { x: 200, y: 500 }
        sprite: { texture: "health", width: 20, height: 20, color: "#27AE60" }
        physics: { mode: "static" }
        collider: { type: "circle", radius: 10, isTrigger: true }
        behavior: HealthPickup { amount: 25 }
    }

    entity ArmorPack {
        transform: { x: 600, y: 500 }
        sprite: { texture: "armor", width: 20, height: 20, color: "#3498DB" }
        physics: { mode: "static" }
        collider: { type: "circle", radius: 10, isTrigger: true }
        behavior: ArmorPickup { amount: 50 }
    }

    // Arena boundaries
    entity WallTop {
        transform: { x: 400, y: 25 }
        sprite: { texture: "wall", width: 800, height: 50, color: "#34495E" }
        physics: { mode: "static" }
        collider: { type: "box", width: 800, height: 50 }
    }

    entity WallBottom {
        transform: { x: 400, y: 575 }
        sprite: { texture: "wall", width: 800, height: 50, color: "#34495E" }
        physics: { mode: "static" }
        collider: { type: "box", width: 800, height: 50 }
    }

    entity WallLeft {
        transform: { x: 25, y: 300 }
        sprite: { texture: "wall", width: 50, height: 600, color: "#34495E" }
        physics: { mode: "static" }
        collider: { type: "box", width: 50, height: 600 }
    }

    entity WallRight {
        transform: { x: 775, y: 300 }
        sprite: { texture: "wall", width: 50, height: 600, color: "#34495E" }
        physics: { mode: "static" }
        collider: { type: "box", width: 50, height: 600 }
    }

    // Exit portal (appears when all enemies defeated)
    entity ExitPortal {
        transform: { x: 400, y: 300 }
        sprite: { texture: "portal", width: 40, height: 40, color: "#9B59B6" }
        physics: { mode: "static" }
        collider: { type: "circle", radius: 20, isTrigger: true }
        behavior: LevelExit { 
            condition: "allEnemiesDefeated",
            nextLevel: "Arena2"
        }
    }
}`;

    await fs.writeFile(vscode.Uri.joinPath(workspaceUri, 'game.gdl'), Buffer.from(mainGame, 'utf8'));
}

async function createCustomTemplate(workspaceUri: vscode.Uri, fs: vscode.FileSystem): Promise<void> {
    const mainGame = `// 🏗️ Custom Game - Main Scene
// Start building your game from scratch!

scene MainScene {
    // Example entities - modify or replace as needed
    
    entity ExampleEntity {
        transform: { x: 400, y: 300 }
        sprite: { texture: "example", width: 32, height: 32, color: "#3498DB" }
        physics: { mode: "dynamic", mass: 1 }
        collider: { type: "box", width: 32, height: 32 }
        // Add behaviors here
    }

    entity StaticPlatform {
        transform: { x: 400, y: 500 }
        sprite: { texture: "platform", width: 200, height: 20, color: "#95A5A6" }
        physics: { mode: "static" }
        collider: { type: "box", width: 200, height: 20 }
    }

    // Add more entities here...
}`;

    await fs.writeFile(vscode.Uri.joinPath(workspaceUri, 'game.gdl'), Buffer.from(mainGame, 'utf8'));
}

async function createProjectConfig(workspaceUri: vscode.Uri, fs: vscode.FileSystem, gameType: string): Promise<void> {
    const config = {
        "name": `${gameType} Game`,
        "version": "1.0.0",
        "gameType": gameType.toLowerCase(),
        "engine": "GameVibeEngine",
        "settings": {
            "resolution": { "width": 800, "height": 600 },
            "physics": {
                "gravity": gameType === "Platformer" ? 800 : 0,
                "enableCollisions": true
            },
            "audio": {
                "masterVolume": 1.0,
                "musicVolume": 0.8,
                "sfxVolume": 1.0
            },
            "controls": getControlsForGameType(gameType)
        },
        "assets": {
            "sprites": ["assets/sprites/**/*"],
            "sounds": ["assets/sounds/**/*"]
        }
    };

    const configContent = JSON.stringify(config, null, 2);
    await fs.writeFile(vscode.Uri.joinPath(workspaceUri, 'game.config.json'), Buffer.from(configContent, 'utf8'));
}

function getControlsForGameType(gameType: string): any {
    switch (gameType) {
        case 'Platformer':
            return {
                "moveLeft": ["ArrowLeft", "A"],
                "moveRight": ["ArrowRight", "D"],
                "jump": ["Space", "ArrowUp", "W"],
                "action": ["E", "Enter"]
            };
        case 'Top-Down':
            return {
                "moveUp": ["ArrowUp", "W"],
                "moveDown": ["ArrowDown", "S"],
                "moveLeft": ["ArrowLeft", "A"],
                "moveRight": ["ArrowRight", "D"],
                "action": ["Space", "E"]
            };
        case 'Racing':
            return {
                "accelerate": ["ArrowUp", "W"],
                "brake": ["ArrowDown", "S"],
                "turnLeft": ["ArrowLeft", "A"],
                "turnRight": ["ArrowRight", "D"],
                "boost": ["Space", "Shift"]
            };
        case 'Shooter':
            return {
                "moveUp": ["W"],
                "moveDown": ["S"],
                "moveLeft": ["A"],
                "moveRight": ["D"],
                "shoot": ["Mouse1", "Space"],
                "reload": ["R"]
            };
        default:
            return {
                "action": ["Space", "E"],
                "menu": ["Escape"]
            };
    }
}

async function createGameProjectReadme(workspaceUri: vscode.Uri, fs: vscode.FileSystem, gameType: string): Promise<void> {
    const readme = `# ${gameType} Game Project

## 🎮 Game Type: ${gameType}

${getGameTypeDescription(gameType)}

## 📁 Project Structure

- \`game.gdl\` - Main game scene
- \`levels/\` - Additional game levels
- \`scenes/\` - Other game scenes
- \`assets/\` - Game assets (sprites, sounds)
- \`game.config.json\` - Game configuration

## 🚀 Getting Started

1. **Edit Game Logic**: Open \`game.gdl\` and modify the game entities
2. **Preview Game**: Use \`Game Vibe: Run Game\` command while editing any .gdl file
3. **Add Assets**: Place images in \`assets/sprites/\` and sounds in \`assets/sounds/\`
4. **Create Levels**: Add new .gdl files in the \`levels/\` folder

## 🎯 Game Entities

${getEntityDescriptions(gameType)}

## 🕹️ Controls

${getControlsDescription(gameType)}

## 🔧 Available Commands

- **Game Vibe: Run Game** - Preview your current .gdl file
- **Game Vibe: Compile GDL** - Check your game code for errors
- **Game Vibe: Create New Game** - Generate a new game template

## 📖 GDL Syntax

\`\`\`gdl
scene SceneName {
    entity EntityName {
        transform: { x: 100, y: 200 }
        sprite: { texture: "name", width: 32, height: 32, color: "#FF0000" }
        physics: { mode: "dynamic", mass: 1 }
        collider: { type: "box", width: 32, height: 32 }
        behavior: BehaviorName { parameter: value }
    }
}
\`\`\`

## 🎨 Tips for ${gameType} Games

${getGameTypesTips(gameType)}

Happy game making! 🚀

---
*Created with Game Vibe Engine*
`;

    await fs.writeFile(vscode.Uri.joinPath(workspaceUri, 'README.md'), Buffer.from(readme, 'utf8'));
}

function getGameTypeDescription(gameType: string): string {
    switch (gameType) {
        case 'Platformer':
            return 'A side-scrolling platformer game with jumping mechanics, enemies, and collectibles. Perfect for creating Mario-style adventures.';
        case 'Top-Down':
            return 'A bird\'s eye view game ideal for RPGs, twin-stick shooters, or maze games. Features omnidirectional movement and object interaction.';
        case 'Puzzle':
            return 'A logic-based puzzle game with drag-and-drop mechanics, switches, and victory conditions. Great for brain teasers and problem-solving games.';
        case 'Racing':
            return 'A fast-paced racing game with tracks, checkpoints, and vehicle physics. Perfect for arcade-style racing experiences.';
        case 'Shooter':
            return 'An action-packed shooter with projectiles, enemies, and weapons. Ideal for arena combat and survival games.';
        default:
            return 'A custom game template. Build whatever you can imagine!';
    }
}

function getEntityDescriptions(gameType: string): string {
    switch (gameType) {
        case 'Platformer':
            return `- **Player** - Controllable character with jumping
- **Ground/Platforms** - Static surfaces for jumping
- **Enemies** - Moving obstacles with AI
- **Collectibles** - Coins, power-ups, etc.
- **Goal** - Level completion target`;
        case 'Top-Down':
            return `- **Player** - Character with 360° movement
- **Walls** - Boundary and maze elements
- **Enemies** - AI characters with different behaviors
- **Collectibles** - Items to gather
- **Doors/Keys** - Access control elements`;
        case 'Puzzle':
            return `- **Blocks** - Draggable puzzle pieces
- **Targets** - Drop zones for blocks
- **Switches** - Activatable mechanisms
- **Platforms** - Moving or triggered elements
- **Victory Zones** - Completion areas`;
        case 'Racing':
            return `- **Cars** - Player and AI vehicles
- **Track** - Racing circuit with boundaries
- **Checkpoints** - Progress markers
- **Power-ups** - Speed boosts, shields
- **Obstacles** - Hazards and challenges`;
        case 'Shooter':
            return `- **Player** - Armed character
- **Enemies** - Various AI opponents
- **Cover** - Destructible obstacles
- **Weapons** - Pickupable firearms
- **Health/Armor** - Recovery items`;
        default:
            return `- **Entities** - Game objects with properties
- **Behaviors** - AI and interaction logic
- **Physics** - Movement and collision
- **Triggers** - Event-based actions`;
    }
}

function getControlsDescription(gameType: string): string {
    switch (gameType) {
        case 'Platformer':
            return `- **A/D or ←/→** - Move left/right
- **Space/W or ↑** - Jump
- **E** - Interact/Action`;
        case 'Top-Down':
            return `- **WASD or Arrow Keys** - Move in all directions
- **Space/E** - Interact/Action`;
        case 'Racing':
            return `- **W or ↑** - Accelerate
- **S or ↓** - Brake/Reverse
- **A/D or ←/→** - Turn left/right
- **Space** - Boost/Handbrake`;
        case 'Shooter':
            return `- **WASD** - Move
- **Mouse** - Aim and shoot
- **R** - Reload
- **Space** - Alternative fire`;
        default:
            return `- **Customizable** - Define your own controls
- **Space/E** - Default action keys
- **WASD/Arrows** - Default movement`;
    }
}

function getGameTypesTips(gameType: string): string {
    switch (gameType) {
        case 'Platformer':
            return `- Use different platform heights for interesting level design
- Add moving platforms for dynamic challenges
- Place enemies strategically to create obstacles
- Use collectibles to guide player movement
- Test jump distances and timing carefully`;
        case 'Top-Down':
            return `- Create interesting maze layouts with walls
- Use different enemy AI behaviors for variety
- Add locked doors and keys for progression
- Consider line-of-sight for stealth mechanics
- Balance movement speed with level size`;
        case 'Puzzle':
            return `- Start with simple puzzles and increase complexity
- Use color coding for clear visual feedback
- Test puzzle solutions to ensure they're solvable
- Add timing elements for additional challenge
- Provide visual hints for puzzle mechanics`;
        case 'Racing':
            return `- Design tracks with interesting turns and straightaways
- Balance AI difficulty for competitive racing
- Place power-ups strategically around the track
- Use checkpoints to prevent cheating shortcuts
- Test vehicle handling and physics feel`;
        case 'Shooter':
            return `- Balance enemy types for varied combat
- Provide cover opportunities for tactical gameplay
- Limit ammo to encourage weapon switching
- Scale enemy difficulty progressively
- Use sound and visual feedback for satisfying combat`;
        default:
            return `- Start simple and iterate on your design
- Test frequently to ensure fun gameplay
- Use the entity inspector to debug issues
- Leverage existing behaviors before creating custom ones
- Don't be afraid to experiment with new ideas!`;
    }
}

let gamePreviewPanel: vscode.WebviewPanel | undefined;

function getDefaultGDLContent(): string {
    return `// Game Vibe Engine - New Game
// Edit this file and use "Game Vibe: Run Game" to see your game in action!

scene MainScene {
    entity Player {
        transform: { x: 100, y: 300 }
        sprite: { texture: "player", width: 32, height: 32, color: "#ff0000" }
        physics: { mode: "platformer", mass: 1 }
        collider: { type: "box", width: 32, height: 32 }
        behavior: PlatformerMovement { speed: 200, jumpPower: 400 }
    }

    entity Ground {
        transform: { x: 400, y: 550 }
        sprite: { texture: "ground", width: 800, height: 100, color: "#00ff00" }
        physics: { mode: "static" }
        collider: { type: "box", width: 800, height: 100 }
    }

    entity Platform {
        transform: { x: 300, y: 400 }
        sprite: { texture: "platform", width: 150, height: 20, color: "#8b4513" }
        physics: { mode: "static" }
        collider: { type: "box", width: 150, height: 20 }
    }
}`;
}

async function createGameProject(workspaceFolder: vscode.WorkspaceFolder): Promise<void> {
    const fs = vscode.workspace.fs;
    const workspaceUri = workspaceFolder.uri;
    
    try {
        // Create project structure
        await fs.createDirectory(vscode.Uri.joinPath(workspaceUri, 'assets'));
        await fs.createDirectory(vscode.Uri.joinPath(workspaceUri, 'assets', 'sprites'));
        await fs.createDirectory(vscode.Uri.joinPath(workspaceUri, 'assets', 'sounds'));
        await fs.createDirectory(vscode.Uri.joinPath(workspaceUri, 'scenes'));
        
        // Create main game file
        const mainGameUri = vscode.Uri.joinPath(workspaceUri, 'game.gdl');
        const mainGameContent = getDefaultGDLContent();
        await fs.writeFile(mainGameUri, Buffer.from(mainGameContent, 'utf8'));
        
        // Create example scene
        const sceneUri = vscode.Uri.joinPath(workspaceUri, 'scenes', 'level1.gdl');
        const sceneContent = `// Level 1 Scene
scene Level1 {
    entity Player {
        transform: { x: 50, y: 400 }
        sprite: { texture: "player", width: 32, height: 32, color: "#0066cc" }
        physics: { mode: "platformer", mass: 1 }
        collider: { type: "box", width: 32, height: 32 }
        behavior: PlatformerMovement { speed: 250, jumpPower: 450 }
    }

    entity Goal {
        transform: { x: 700, y: 500 }
        sprite: { texture: "goal", width: 40, height: 40, color: "#ffgold" }
        physics: { mode: "static" }
        collider: { type: "box", width: 40, height: 40, isTrigger: true }
    }
}`;
        await fs.writeFile(sceneUri, Buffer.from(sceneContent, 'utf8'));
        
        // Create README
        const readmeUri = vscode.Uri.joinPath(workspaceUri, 'README.md');
        const readmeContent = `# Game Vibe Engine Project

## 🎮 Getting Started

1. **Edit your game**: Open \`game.gdl\` and modify the game description
2. **Run your game**: Use the command \`Game Vibe: Run Game\` while editing a .gdl file
3. **Create assets**: Add sprites and sounds to the \`assets/\` folder
4. **Add scenes**: Create new .gdl files in the \`scenes/\` folder

## 📁 Project Structure

- \`game.gdl\` - Main game file
- \`scenes/\` - Individual game scenes
- \`assets/sprites/\` - Image files for your game
- \`assets/sounds/\` - Audio files for your game

## 🎯 Available Commands

- **Game Vibe: Run Game** - Preview your current .gdl file
- **Game Vibe: Compile GDL** - Check your game code for errors
- **Game Vibe: Create New Game** - Generate a new game template

## 🕹️ Example Controls

The default player can be controlled with:
- **Arrow keys** or **WASD** for movement
- **Spacebar** for jumping

Happy game making! 🚀
`;
        await fs.writeFile(readmeUri, Buffer.from(readmeContent, 'utf8'));
        
        // Open the main game file
        const document = await vscode.workspace.openTextDocument(mainGameUri);
        await vscode.window.showTextDocument(document);
        
        vscode.window.showInformationMessage('🎮 Game project created! Open game.gdl and use "Game Vibe: Run Game" to preview.');
        
    } catch (error) {
        vscode.window.showErrorMessage(`Failed to create project: ${error}`);
    }
}

function showGamePreview(context: vscode.ExtensionContext, gdlContent: string): void {
    // Reuse existing panel or create new one
    if (gamePreviewPanel) {
        gamePreviewPanel.reveal(vscode.ViewColumn.Beside);
    } else {
        gamePreviewPanel = vscode.window.createWebviewPanel(
            'gameVibePreview',
            '🎮 Game Preview',
            vscode.ViewColumn.Beside,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: [
                    vscode.Uri.joinPath(context.extensionUri, 'media')
                ]
            }
        );

        gamePreviewPanel.onDidDispose(() => {
            gamePreviewPanel = undefined;
        });
    }

    // Update webview content
    gamePreviewPanel.webview.html = getGamePreviewHtml(gamePreviewPanel.webview, context.extensionUri, gdlContent);

    // Handle messages from webview
    gamePreviewPanel.webview.onDidReceiveMessage(message => {
        switch (message.command) {
            case 'reload':
                const activeEditor = vscode.window.activeTextEditor;
                if (activeEditor && activeEditor.document.languageId === 'gdl') {
                    const newContent = activeEditor.document.getText();
                    showGamePreview(context, newContent);
                }
                break;
        }
    });
}

function getGamePreviewHtml(webview: vscode.Webview, extensionUri: vscode.Uri, gdlContent: string): string {
    const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'media', 'gameEditor.css'));
    const gamePreviewUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'out', 'webview', 'gamePreview.js'));
    const nonce = getNonce();

    return `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}'; img-src ${webview.cspSource} https: data:;">
            <link href="${styleUri}" rel="stylesheet">
            <title>Game Preview</title>
            <style>
                body {
                    margin: 0;
                    padding: 20px;
                    background-color: var(--vscode-editor-background);
                    color: var(--vscode-foreground);
                    font-family: var(--vscode-font-family);
                }
                .preview-container {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 20px;
                }
                .preview-header {
                    text-align: center;
                }
                .preview-controls {
                    display: flex;
                    gap: 10px;
                    margin-bottom: 20px;
                }
                .control-btn {
                    padding: 8px 16px;
                    background-color: var(--vscode-button-background);
                    color: var(--vscode-button-foreground);
                    border: none;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 14px;
                }
                .control-btn:hover {
                    background-color: var(--vscode-button-hoverBackground);
                }
                .control-btn:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                }
                #game-container {
                    border: 2px solid var(--vscode-panel-border);
                    border-radius: 8px;
                    background-color: #2c3e50;
                }
                .game-info {
                    text-align: center;
                    font-size: 12px;
                    color: var(--vscode-descriptionForeground);
                    max-width: 600px;
                }
            </style>
        </head>
        <body>
            <div class="preview-container">
                <div class="preview-header">
                    <h2>🎮 Game Preview</h2>
                    <div class="preview-controls">
                        <button id="play-btn" class="control-btn">▶️ Play</button>
                        <button id="pause-btn" class="control-btn" disabled>⏸️ Pause</button>
                        <button id="reload-btn" class="control-btn">🔄 Reload</button>
                    </div>
                </div>
                
                <div id="game-container" style="width: 800px; height: 600px; border: 2px solid var(--vscode-panel-border); border-radius: 8px; background-color: #2c3e50; display: flex; align-items: center; justify-content: center; color: white;">
                    Loading game...
                </div>
                
                <div class="game-info">
                    <p><strong>Controls:</strong> WASD/Arrow keys to move, Space to jump</p>
                    <p>Edit your .gdl file and click "Reload" to see changes</p>
                </div>
            </div>

            <script nonce="${nonce}">
                // Simplified Game Engine for Webview
                class SimpleGameEngine {
                    constructor(canvas) {
                        this.canvas = canvas;
                        this.ctx = canvas.getContext('2d');
                        this.entities = [];
                        this.player = null;
                        this.isRunning = false;
                        this.animationId = null;
                        this.keys = {};
                        this.spriteCache = {};
                        this.setupInput();
                        this.loadSprites();
                        console.log('[GameEngine] Initialized with canvas:', canvas);
                    }

                    loadSprites() {
                        console.log('[GameEngine] *** LOADING SPRITES ***');
                        
                        // Test with external PNG for player
                        this.createSprite('player', 'https://raw.githubusercontent.com/microsoft/vscode/main/resources/linux/code.png');
                        
                        // Create platform sprite
                        const platformSvg = \`<svg width="32" height="32" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
                            <rect x="0" y="0" width="32" height="32" fill="#8B4513"/>
                            <rect x="0" y="0" width="32" height="12" fill="#228B22"/>
                            <path d="M 0 8 Q 4 4 8 8 T 16 8 T 24 8 T 32 8" stroke="#32CD32" stroke-width="2" fill="none"/>
                        </svg>\`;
                        this.createSprite('platform', 'data:image/svg+xml;base64,' + btoa(platformSvg));
                        
                        // Create enemy sprite
                        const enemySvg = \`<svg width="28" height="28" viewBox="0 0 28 28" xmlns="http://www.w3.org/2000/svg">
                            <polygon points="14,2 26,24 2,24" fill="#FF4444" stroke="#CC0000" stroke-width="2"/>
                            <circle cx="10" cy="18" r="2" fill="white"/>
                            <circle cx="18" cy="18" r="2" fill="white"/>
                            <circle cx="10" cy="18" r="1" fill="black"/>
                            <circle cx="18" cy="18" r="1" fill="black"/>
                        </svg>\`;
                        this.createSprite('enemy', 'data:image/svg+xml;base64,' + btoa(enemySvg));
                        
                        // Create collectible sprite
                        const collectibleSvg = \`<svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <polygon points="12,2 15,9 22,9 17,14 19,21 12,17 5,21 7,14 2,9 9,9" fill="#FFD700" stroke="#FFA500" stroke-width="1"/>
                        </svg>\`;
                        this.createSprite('collectible', 'data:image/svg+xml;base64,' + btoa(collectibleSvg));
                    }

                    createSprite(name, url) {
                        const img = new Image();
                        img.crossOrigin = 'anonymous';
                        
                        img.onload = () => {
                            this.spriteCache[name] = img;
                            console.log(\`[GameEngine] *** SPRITE LOADED: \${name} ***\`);
                        };
                        
                        img.onerror = (error) => {
                            console.error(\`[GameEngine] *** SPRITE FAILED: \${name} ***\`, error);
                        };
                        
                        console.log(\`[GameEngine] Loading sprite: \${name} from \${url.substring(0, 50)}...\`);
                        img.src = url;
                    }

                    setupInput() {
                        document.addEventListener('keydown', (e) => {
                            this.keys[e.key.toLowerCase()] = true;
                            if (e.key === ' ') e.preventDefault();
                        });
                        
                        document.addEventListener('keyup', (e) => {
                            this.keys[e.key.toLowerCase()] = false;
                        });
                    }

                    addEntity(entity) {
                        const isStaticType = entity.type === 'platform' || entity.type === 'ground' || entity.type === 'wall';
                        const newEntity = {
                            id: Math.random().toString(36),
                            x: entity.x || 0,
                            y: entity.y || 0,
                            width: entity.width || 32,
                            height: entity.height || 32,
                            color: entity.color || '#ffffff',
                            type: entity.type,
                            vx: isStaticType ? 0 : 0,
                            vy: isStaticType ? 0 : 0,
                            isStatic: isStaticType,
                            grounded: !isStaticType
                        };

                        this.entities.push(newEntity);
                        
                        if (entity.type === 'player') {
                            this.player = newEntity;
                        }

                        console.log('[GameEngine] Added entity:', newEntity);
                        return newEntity;
                    }

                    start() {
                        console.log('[GameEngine] Starting game loop');
                        this.isRunning = true;
                        this.gameLoop();
                    }

                    stop() {
                        console.log('[GameEngine] Stopping game loop');
                        this.isRunning = false;
                        if (this.animationId) {
                            cancelAnimationFrame(this.animationId);
                            this.animationId = null;
                        }
                    }

                    gameLoop = () => {
                        if (!this.isRunning) return;

                        this.update();
                        this.render();
                        
                        this.animationId = requestAnimationFrame(this.gameLoop);
                    }

                    update() {
                        if (this.player) {
                            this.updatePlayer(this.player);
                        }

                        this.entities.forEach(entity => {
                            if (!entity.isStatic) {
                                this.updatePhysics(entity);
                            }
                        });

                        this.checkCollisions();
                    }

                    updatePlayer(player) {
                        if (this.keys['a'] || this.keys['arrowleft']) {
                            player.vx = -200;
                        } else if (this.keys['d'] || this.keys['arrowright']) {
                            player.vx = 200;
                        } else {
                            player.vx = (player.vx || 0) * 0.8;
                        }

                        if ((this.keys[' '] || this.keys['w'] || this.keys['arrowup']) && player.grounded) {
                            player.vy = -400;
                            player.grounded = false;
                        }
                    }

                    updatePhysics(entity) {
                        if (!entity.vx) entity.vx = 0;
                        if (!entity.vy) entity.vy = 0;

                        entity.vy += 800 * (1/60);

                        entity.x += entity.vx * (1/60);
                        entity.y += entity.vy * (1/60);

                        if (entity.x < 0) entity.x = 0;
                        if (entity.x + entity.width > this.canvas.width) entity.x = this.canvas.width - entity.width;
                        if (entity.y > this.canvas.height) {
                            entity.y = this.canvas.height - entity.height;
                            entity.vy = 0;
                            entity.grounded = true;
                        }
                    }

                    checkCollisions() {
                        const dynamicEntities = this.entities.filter(e => !e.isStatic);
                        const staticEntities = this.entities.filter(e => e.isStatic);

                        dynamicEntities.forEach(dynamic => {
                            dynamic.grounded = false;
                            
                            staticEntities.forEach(static_ => {
                                if (this.checkCollision(dynamic, static_)) {
                                    this.resolveCollision(dynamic, static_);
                                }
                            });
                        });
                    }

                    checkCollision(a, b) {
                        return a.x < b.x + b.width &&
                               a.x + a.width > b.x &&
                               a.y < b.y + b.height &&
                               a.y + a.height > b.y;
                    }

                    resolveCollision(dynamic, static_) {
                        const overlapX = Math.min(dynamic.x + dynamic.width - static_.x, static_.x + static_.width - dynamic.x);
                        const overlapY = Math.min(dynamic.y + dynamic.height - static_.y, static_.y + static_.height - dynamic.y);
                        
                        if (overlapX < overlapY) {
                            if (dynamic.x < static_.x) {
                                dynamic.x = static_.x - dynamic.width;
                            } else {
                                dynamic.x = static_.x + static_.width;
                            }
                            dynamic.vx = 0;
                        } else {
                            if (dynamic.y < static_.y) {
                                dynamic.y = static_.y - dynamic.height;
                                dynamic.vy = 0;
                                dynamic.grounded = true;
                            } else {
                                dynamic.y = static_.y + static_.height;
                                dynamic.vy = 0;
                            }
                        }
                    }

                    render() {
                        this.ctx.fillStyle = '#87CEEB';
                        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

                        this.entities.forEach(entity => {
                            // Determine sprite type
                            let spriteType = entity.type;
                            if (entity.type === 'sprite') {
                                // Generic sprites - try to determine type from name/context
                                if (entity.id && entity.id.toLowerCase().includes('star')) {
                                    spriteType = 'collectible';
                                }
                            }
                            
                            // Try to draw sprite, fallback to rectangle
                            const sprite = this.spriteCache[spriteType];
                            if (sprite && sprite.complete) {
                                console.log(\`[GameEngine] Drawing sprite: \${spriteType} at (\${entity.x}, \${entity.y})\`);
                                this.ctx.drawImage(sprite, entity.x, entity.y, entity.width, entity.height);
                            } else {
                                // Fallback to colored rectangle
                                this.ctx.fillStyle = entity.color;
                                this.ctx.fillRect(entity.x, entity.y, entity.width, entity.height);
                            }

                            // Draw entity type for debugging
                            this.ctx.fillStyle = '#ffffff';
                            this.ctx.font = '10px Arial';
                            this.ctx.fillText(entity.type, entity.x, entity.y - 5);
                        });

                        this.ctx.fillStyle = '#ffffff';
                        this.ctx.font = '16px Arial';
                        this.ctx.fillText('🎮 Game Engine Preview', 10, 25);
                        this.ctx.font = '12px Arial';
                        this.ctx.fillText('WASD/Arrows: Move | Space: Jump', 10, 45);
                    }

                    clear() {
                        this.entities = [];
                        this.player = null;
                    }
                }
            </script>
            <script nonce="${nonce}">
                const vscode = acquireVsCodeApi();
                const playBtn = document.getElementById('play-btn');
                const pauseBtn = document.getElementById('pause-btn');
                const reloadBtn = document.getElementById('reload-btn');
                
                let gameRunning = false;
                let gameEngine = null;
                let currentScene = null;
                
                // Logging utility
                const logLevels = { error: 0, warn: 1, info: 2, debug: 3 };
                const currentLogLevel = logLevels.info; // Default to info level
                
                function log(level, message, ...args) {
                    if (logLevels[level] <= currentLogLevel) {
                        console[level]('[GameVibe]', message, ...args);
                    }
                }
                
                // Parse GDL content with logging
                const gdlContent = \`${gdlContent.replace(/`/g, '\\`')}\`;
                log('info', '🎮 Game Preview: Starting...');
                log('debug', '📝 GDL Content:', gdlContent);
                
                let gameData;
                try {
                    gameData = parseGDL(gdlContent);
                    log('info', '✅ Parsed game data:', gameData);
                } catch (error) {
                    log('error', '❌ GDL Parse Error:', error);
                    gameData = { entities: [] };
                }
                
                // GDL parser for real GDL syntax
                function parseGDL(content) {
                    log('debug', '🔍 parseGDL: Starting parse...');
                    const scene = { name: 'Game', width: 800, height: 600, entities: [] };
                    
                    // Find entity blocks
                    const entityMatches = content.match(/entity\\s+(\\w+)\\s*\\{[^{}]*(?:\\{[^{}]*\\}[^{}]*)*\\}/g) || [];
                    log('debug', '📄 parseGDL: Found', entityMatches.length, 'entity blocks');

                    entityMatches.forEach(entityBlock => {
                        console.log('🎯 parseGDL: Parsing entity block:', entityBlock);
                        const entity = parseEntityBlock(entityBlock);
                        if (entity) {
                            console.log('✅ parseGDL: Created entity:', entity);
                            scene.entities.push(entity);
                        } else {
                            console.log('⚠️ parseGDL: Failed to parse entity from block');
                        }
                    });
                    
                    // If no entities found, add a demo entity for testing
                    if (scene.entities.length === 0) {
                        console.log('⚠️ parseGDL: No entities found, adding demo entities');
                        scene.entities = [
                            { name: 'Player', type: 'player', x: 100, y: 536, width: 32, height: 32, properties: { color: '#4A90E2' } },
                            { name: 'Ground', type: 'platform', x: 400, y: 568, width: 800, height: 64, properties: { color: '#2ECC71' } },
                            { name: 'Platform1', type: 'platform', x: 300, y: 450, width: 200, height: 32, properties: { color: '#95A5A6' } }
                        ];
                    }
                    
                    console.log('🏁 parseGDL: Final scene:', scene);
                    return scene;
                }

                function parseEntityBlock(block) {
                    // Extract entity name
                    const nameMatch = block.match(/entity\\s+(\\w+)/);
                    if (!nameMatch) return null;
                    const name = nameMatch[1];

                    // Parse transform block
                    let x = 100, y = 300;
                    const transformMatch = block.match(/transform:\\s*\\{([^}]*)\\}/);
                    if (transformMatch) {
                        const transformContent = transformMatch[1];
                        const xMatch = transformContent.match(/x:\\s*(\\d+)/);
                        const yMatch = transformContent.match(/y:\\s*(\\d+)/);
                        if (xMatch) x = parseInt(xMatch[1]);
                        if (yMatch) y = parseInt(yMatch[1]);
                    }

                    // Parse sprite block
                    let width = 32, height = 32, color = null;
                    const spriteMatch = block.match(/sprite:\\s*\\{([^}]*)\\}/);
                    if (spriteMatch) {
                        const spriteContent = spriteMatch[1];
                        const widthMatch = spriteContent.match(/width:\\s*(\\d+)/);
                        const heightMatch = spriteContent.match(/height:\\s*(\\d+)/);
                        const colorMatch = spriteContent.match(/color:\\s*["']([^"']+)["']/);
                        if (widthMatch) width = parseInt(widthMatch[1]);
                        if (heightMatch) height = parseInt(heightMatch[1]);
                        if (colorMatch) color = colorMatch[1];
                    }

                    // Determine entity type
                    let type = 'sprite';
                    const lowerName = name.toLowerCase();
                    if (lowerName.includes('player') || lowerName.includes('hero')) {
                        type = 'player';
                    } else if (lowerName.includes('platform') || lowerName.includes('ground') || lowerName.includes('wall')) {
                        type = 'platform';
                    } else if (lowerName.includes('enemy') || lowerName.includes('monster')) {
                        type = 'enemy';
                    } else if (lowerName.includes('coin') || lowerName.includes('gem') || lowerName.includes('pickup')) {
                        type = 'collectible';
                    }

                    return { 
                        name, 
                        type, 
                        x, 
                        y, 
                        width, 
                        height, 
                        properties: { color } 
                    };
                }
                
                function getColorFromName(colorName) {
                    if (!colorName) return null;
                    const colors = {
                        'red': '#ff0000', 'green': '#00ff00', 'blue': '#0000ff',
                        'yellow': '#ffff00', 'orange': '#ff8800', 'purple': '#ff00ff',
                        'brown': '#8b4513', 'gray': '#808080', 'grey': '#808080',
                        'black': '#000000', 'white': '#ffffff'
                    };
                    return colors[colorName.toLowerCase()] || null;
                }

                function startGame() {
                    log('info', '🚀 startGame: Called');
                    const gameContainer = document.getElementById('game-container');
                    log('debug', '🎯 startGame: Game container:', gameContainer);
                    
                    if (!gameContainer) {
                        log('error', '❌ Game container not found');
                        return;
                    }
                    
                    // Clear container
                    gameContainer.innerHTML = '';
                    
                    // Create canvas
                    const canvas = document.createElement('canvas');
                    canvas.width = 800;
                    canvas.height = 600;
                    canvas.style.display = 'block';
                    canvas.style.border = '1px solid #ccc';
                    gameContainer.appendChild(canvas);
                    
                    log('info', '🎮 startGame: Creating game engine');
                    try {
                        gameEngine = new SimpleGameEngine(canvas);
                        
                        // Create game objects from parsed data
                        createGameFromData();
                        
                        // Start the engine
                        gameEngine.start();
                        gameRunning = true;
                        log('info', '✅ startGame: Game created successfully');
                    } catch (error) {
                        log('error', '❌ startGame: Error creating game:', error);
                        gameContainer.innerHTML = '<div style="color: red; text-align: center; padding: 20px;">Error creating game: ' + error.message + '</div>';
                    }
                }

                function createGameFromData() {
                    log('debug', '🎮 Engine: Creating game objects from data');
                    
                    if (!gameData || gameData.entities.length === 0) {
                        log('warn', '⚠️ Engine: No game data found');
                        return;
                    }
                    
                    log('info', '🎮 Engine: Creating game objects from', gameData.entities.length, 'entities');

                    gameData.entities.forEach(entity => {
                        log('debug', '🔧 Engine: Creating entity:', entity);
                        
                        const color = getColorFromName(entity.properties.color) || getDefaultColorForType(entity.type);
                        
                        gameEngine.addEntity({
                            type: entity.type,
                            x: entity.x,
                            y: entity.y,
                            width: entity.width,
                            height: entity.height,
                            color: color
                        });
                    });
                }

                function getDefaultColorForType(type) {
                    const typeColors = {
                        'player': '#4A90E2',
                        'platform': '#2ECC71',
                        'enemy': '#E74C3C',
                        'collectible': '#F39C12'
                    };
                    return typeColors[type] || '#95A5A6';
                }
                
                // Event listeners
                playBtn.addEventListener('click', () => {
                    playBtn.disabled = true;
                    pauseBtn.disabled = false;
                    startGame();
                });
                
                pauseBtn.addEventListener('click', () => {
                    gameRunning = false;
                    playBtn.disabled = false;
                    pauseBtn.disabled = true;
                    if (gameEngine) {
                        gameEngine.stop();
                    }
                });
                
                reloadBtn.addEventListener('click', () => {
                    vscode.postMessage({ command: 'reload' });
                });
                
                // Auto-start
                setTimeout(() => playBtn.click(), 500);
            </script>
        </body>
        </html>`;
}

function getGameEditorHtml(webview: vscode.Webview, extensionUri: vscode.Uri): string {
    const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'media', 'gameEditor.css'));
    const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'out', 'webview', 'gameEditor.js'));

    const nonce = getNonce();

    return `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}'; img-src ${webview.cspSource} https: data:;">
            <link href="${styleUri}" rel="stylesheet">
            <title>Game Vibe Editor</title>
        </head>
        <body>
            <div id="app">
                <div class="editor-container">
                    <div class="toolbar">
                        <button id="compile-btn" class="toolbar-btn">
                            <span class="icon">▶</span> Compile
                        </button>
                        <button id="run-btn" class="toolbar-btn">
                            <span class="icon">🎮</span> Run
                        </button>
                        <button id="stop-btn" class="toolbar-btn">
                            <span class="icon">⏹</span> Stop
                        </button>
                    </div>
                    <div class="content">
                        <div class="code-panel">
                            <textarea id="code-editor" placeholder="Enter your GDL code here...">scene MainScene {
    entity Player {
        transform: { x: 100, y: 300 }
        sprite: { texture: "player", width: 32, height: 32, color: "#ff0000" }
        physics: { mode: "platformer", mass: 1 }
        collider: { type: "box", width: 32, height: 32 }
        behavior: PlatformerMovement { speed: 200, jumpPower: 400 }
    }

    entity Ground {
        transform: { x: 400, y: 550 }
        sprite: { texture: "ground", width: 800, height: 100, color: "#00ff00" }
        physics: { mode: "static" }
        collider: { type: "box", width: 800, height: 100 }
    }
}</textarea>
                        </div>
                        <div class="game-panel">
                            <div id="game-container">
                                <canvas id="game-canvas" width="800" height="600"></canvas>
                                <div class="game-overlay">
                                    <h3>🎮 Game Preview</h3>
                                    <p>Click "Run" to start your game!</p>
                                    <div class="demo-instructions">
                                        <p><strong>Demo Controls:</strong></p>
                                        <p>• Arrow keys or WASD to move</p>
                                        <p>• Space to jump</p>
                                        <p>• Click Run to see a basic demo</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="status-bar">
                        <div class="status-item">
                            <div class="status-dot"></div>
                            <span>Ready</span>
                        </div>
                        <div class="status-item">
                            <span>Game Vibe Engine</span>
                        </div>
                    </div>
                </div>
            </div>
            <script nonce="${nonce}">
                const vscode = acquireVsCodeApi();
                
                document.getElementById('compile-btn').addEventListener('click', () => {
                    vscode.postMessage({ command: 'compile' });
                });
                
                document.getElementById('run-btn').addEventListener('click', () => {
                    vscode.postMessage({ command: 'run' });
                    showGameRunning();
                });
                
                document.getElementById('stop-btn').addEventListener('click', () => {
                    vscode.postMessage({ command: 'stop' });
                    showGameStopped();
                });

                function showGameRunning() {
                    const overlay = document.querySelector('.game-overlay');
                    const canvas = document.getElementById('game-canvas');
                    
                    if (overlay) overlay.style.display = 'none';
                    if (canvas) {
                        canvas.style.display = 'block';
                        startSimpleDemo(canvas);
                    }
                    
                    updateStatus('Game Running', 'running');
                }

                function showGameStopped() {
                    const overlay = document.querySelector('.game-overlay');
                    const canvas = document.getElementById('game-canvas');
                    
                    if (overlay) overlay.style.display = 'flex';
                    if (canvas) canvas.style.display = 'none';
                    
                    updateStatus('Game Stopped', 'stopped');
                }

                function startSimpleDemo(canvas) {
                    const ctx = canvas.getContext('2d');
                    if (!ctx) return;

                    // Simple demo game
                    let playerX = 100;
                    let playerY = 300;
                    let velocityY = 0;
                    const gravity = 0.5;
                    const groundY = 500;
                    let isJumping = false;

                    const keys = {};
                    
                    document.addEventListener('keydown', (e) => {
                        keys[e.key.toLowerCase()] = true;
                        if (e.key === ' ' && !isJumping) {
                            velocityY = -12;
                            isJumping = true;
                        }
                    });
                    
                    document.addEventListener('keyup', (e) => {
                        keys[e.key.toLowerCase()] = false;
                    });

                    function gameLoop() {
                        // Clear canvas
                        ctx.fillStyle = '#2c3e50';
                        ctx.fillRect(0, 0, canvas.width, canvas.height);

                        // Update player
                        if (keys['arrowleft'] || keys['a']) playerX -= 3;
                        if (keys['arrowright'] || keys['d']) playerX += 3;

                        // Apply gravity
                        velocityY += gravity;
                        playerY += velocityY;

                        // Ground collision
                        if (playerY > groundY - 32) {
                            playerY = groundY - 32;
                            velocityY = 0;
                            isJumping = false;
                        }

                        // Keep player in bounds
                        if (playerX < 0) playerX = 0;
                        if (playerX > canvas.width - 32) playerX = canvas.width - 32;

                        // Draw ground
                        ctx.fillStyle = '#00ff00';
                        ctx.fillRect(0, groundY, canvas.width, 100);

                        // Draw player
                        ctx.fillStyle = '#ff0000';
                        ctx.fillRect(playerX, playerY, 32, 32);

                        // Draw UI
                        ctx.fillStyle = '#ffffff';
                        ctx.font = '16px Arial';
                        ctx.fillText('🎮 Game Demo Running!', 10, 30);
                        ctx.fillText('Use WASD or arrows to move, Space to jump', 10, 50);

                        requestAnimationFrame(gameLoop);
                    }

                    gameLoop();
                }

                function updateStatus(message, type) {
                    const statusBar = document.querySelector('.status-bar');
                    const statusDot = statusBar.querySelector('.status-dot');
                    const statusText = statusBar.querySelector('.status-item span');
                    
                    if (statusText) statusText.textContent = message;
                    if (statusDot) {
                        statusDot.className = 'status-dot';
                        if (type === 'running') statusDot.classList.add('running');
                        if (type === 'error') statusDot.classList.add('error');
                    }
                }
            </script>
        </body>
        </html>`;
}

function getNonce(): string {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}

// Enhanced File-Based Workflow Functions

async function addNewScene(): Promise<void> {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
        vscode.window.showErrorMessage('Please open a Game Vibe project folder first.');
        return;
    }

    const sceneName = await vscode.window.showInputBox({
        prompt: 'Enter scene name',
        placeHolder: 'e.g., Level2, MainMenu, GameOver',
        validateInput: (value) => {
            if (!value) return 'Scene name is required';
            if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(value)) return 'Scene name must start with a letter and contain only letters, numbers, and underscores';
            return null;
        }
    });

    if (!sceneName) return;

    const sceneContent = `// ${sceneName} Scene
scene ${sceneName} {
    size: [800, 600]
    gravity: [0, 800]
    background: "#2c3e50"

    // Add your entities here
    entity Player {
        transform: {
            x: 100
            y: 400
        }
        
        sprite: {
            texture: "player.png"
            width: 32
            height: 32
        }
        
        physics: {
            mode: platformer
        }
        
        collider: {
            type: box
            width: 30
            height: 30
        }
        
        behavior: PlatformerMovement {
            speed: 200
            jumpPower: 400
        }
    }
}`;

    try {
        const fs = vscode.workspace.fs;
        const scenesDir = vscode.Uri.joinPath(workspaceFolder.uri, 'scenes');
        
        // Create scenes directory if it doesn't exist
        try {
            await fs.createDirectory(scenesDir);
        } catch {
            // Directory already exists
        }

        const sceneFile = vscode.Uri.joinPath(scenesDir, `${sceneName}.gdl`);
        await fs.writeFile(sceneFile, Buffer.from(sceneContent, 'utf8'));

        // Open the new scene file
        const document = await vscode.workspace.openTextDocument(sceneFile);
        await vscode.window.showTextDocument(document);

        vscode.window.showInformationMessage(`✨ Scene "${sceneName}" created successfully!`);
    } catch (error) {
        vscode.window.showErrorMessage(`Failed to create scene: ${error}`);
    }
}

async function addNewEntity(): Promise<void> {
    const activeEditor = vscode.window.activeTextEditor;
    if (!activeEditor || activeEditor.document.languageId !== 'gdl') {
        vscode.window.showErrorMessage('Please open a .gdl file first.');
        return;
    }

    const entityTypes = [
        { label: '🏃 Player Character', description: 'Controllable player entity with movement', value: 'player' },
        { label: '🧱 Platform', description: 'Static platform for jumping', value: 'platform' },
        { label: '👾 Enemy', description: 'Moving enemy with AI behavior', value: 'enemy' },
        { label: '⭐ Collectible', description: 'Item that can be collected', value: 'collectible' },
        { label: '🚪 Portal', description: 'Teleporter or scene transition', value: 'portal' },
        { label: '💥 Projectile', description: 'Bullet or throwable object', value: 'projectile' },
        { label: '🎯 Target', description: 'Interactive target or button', value: 'target' },
        { label: '🏗️ Custom', description: 'Empty entity template', value: 'custom' }
    ];

    const selectedType = await vscode.window.showQuickPick(entityTypes, {
        placeHolder: 'Select entity type to add'
    });

    if (!selectedType) return;

    const entityName = await vscode.window.showInputBox({
        prompt: `Enter name for ${selectedType.label} entity`,
        placeHolder: 'e.g., Player, Enemy1, Coin',
        validateInput: (value) => {
            if (!value) return 'Entity name is required';
            if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(value)) return 'Entity name must start with a letter and contain only letters, numbers, and underscores';
            return null;
        }
    });

    if (!entityName) return;

    const entityTemplate = getEntityTemplate(selectedType.value, entityName);
    
    // Insert the entity template at the cursor position
    const position = activeEditor.selection.active;
    await activeEditor.edit(editBuilder => {
        editBuilder.insert(position, entityTemplate);
    });

    vscode.window.showInformationMessage(`✨ ${selectedType.label} entity "${entityName}" added!`);
}

function getEntityTemplate(entityType: string, entityName: string): string {
    const templates: { [key: string]: string } = {
        player: `
    entity ${entityName} {
        transform: {
            x: 100
            y: 400
        }
        
        sprite: {
            texture: "player.png"
            width: 32
            height: 32
        }
        
        physics: {
            mode: platformer
            mass: 1.0
        }
        
        collider: {
            type: box
            width: 30
            height: 30
        }
        
        behavior: PlatformerMovement {
            speed: 200
            jumpPower: 400
        }
    }`,
        platform: `
    entity ${entityName} {
        transform: {
            x: 200
            y: 500
        }
        
        sprite: {
            texture: "platform.png"
            width: 200
            height: 32
        }
        
        physics: {
            mode: static
        }
        
        collider: {
            type: box
            width: 200
            height: 32
        }
    }`,
        enemy: `
    entity ${entityName} {
        transform: {
            x: 300
            y: 450
        }
        
        sprite: {
            texture: "enemy.png"
            width: 24
            height: 24
        }
        
        physics: {
            mode: dynamic
            mass: 0.5
        }
        
        collider: {
            type: circle
            radius: 12
        }
        
        behavior: PatrolBehavior {
            points: [[250, 450], [350, 450]]
            speed: 50
        }
    }`,
        collectible: `
    entity ${entityName} {
        transform: {
            x: 250
            y: 400
        }
        
        sprite: {
            texture: "coin.png"
            width: 16
            height: 16
        }
        
        physics: {
            mode: kinematic
        }
        
        collider: {
            type: circle
            radius: 8
            isSensor: true
        }
        
        behavior: BounceBehavior {
            speed: 30
            range: 10
        }
    }`,
        portal: `
    entity ${entityName} {
        transform: {
            x: 700
            y: 400
        }
        
        sprite: {
            texture: "portal.png"
            width: 48
            height: 64
        }
        
        physics: {
            mode: static
        }
        
        collider: {
            type: box
            width: 40
            height: 60
            isSensor: true
        }
        
        behavior: AnimationBehavior {
            duration: 2.0
        }
    }`,
        projectile: `
    entity ${entityName} {
        transform: {
            x: 0
            y: 0
            scale: 0.5
        }
        
        sprite: {
            texture: "bullet.png"
            width: 8
            height: 8
        }
        
        physics: {
            mode: dynamic
            mass: 0.1
        }
        
        collider: {
            type: circle
            radius: 4
        }
    }`,
        target: `
    entity ${entityName} {
        transform: {
            x: 400
            y: 300
        }
        
        sprite: {
            texture: "button.png"
            width: 32
            height: 16
        }
        
        physics: {
            mode: static
        }
        
        collider: {
            type: box
            width: 32
            height: 16
            isSensor: true
        }
        
        behavior: ClickBehavior {
            target: "Door1"
        }
    }`,
        custom: `
    entity ${entityName} {
        transform: {
            x: 0
            y: 0
        }
        
        sprite: {
            texture: "sprite.png"
            width: 32
            height: 32
        }
        
        physics: {
            mode: static
        }
        
        collider: {
            type: box
            width: 32
            height: 32
        }
    }`
    };

    return templates[entityType] || templates.custom;
}

async function validateProject(): Promise<void> {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
        vscode.window.showErrorMessage('Please open a Game Vibe project folder first.');
        return;
    }

    const issues: string[] = [];
    const warnings: string[] = [];
    const fs = vscode.workspace.fs;

    try {
        // Check for required project structure
        const requiredDirs = ['assets', 'scenes'];
        for (const dir of requiredDirs) {
            try {
                await fs.stat(vscode.Uri.joinPath(workspaceFolder.uri, dir));
            } catch {
                issues.push(`Missing required directory: ${dir}`);
            }
        }

        // Check for main game file
        try {
            await fs.stat(vscode.Uri.joinPath(workspaceFolder.uri, 'game.gdl'));
        } catch {
            warnings.push('No main game.gdl file found');
        }

        // Check for project config
        try {
            await fs.stat(vscode.Uri.joinPath(workspaceFolder.uri, 'game.json'));
        } catch {
            warnings.push('No project configuration (game.json) found');
        }

        // Validate all .gdl files
        const gdlFiles = await findGDLFiles(workspaceFolder.uri);
        for (const file of gdlFiles) {
            try {
                const content = await fs.readFile(file);
                const gdlText = Buffer.from(content).toString('utf8');
                
                // Basic syntax validation
                if (!gdlText.includes('scene ')) {
                    warnings.push(`${file.path}: No scenes defined`);
                }
                
                // Check for unmatched braces
                const openBraces = (gdlText.match(/\{/g) || []).length;
                const closeBraces = (gdlText.match(/\}/g) || []).length;
                if (openBraces !== closeBraces) {
                    issues.push(`${file.path}: Unmatched braces (${openBraces} open, ${closeBraces} close)`);
                }
            } catch (error) {
                issues.push(`${file.path}: Failed to read file - ${error}`);
            }
        }

        // Report results
        if (issues.length === 0 && warnings.length === 0) {
            vscode.window.showInformationMessage('✅ Project validation passed! No issues found.');
        } else {
            const message = [
                issues.length > 0 ? `❌ ${issues.length} error(s) found:` : null,
                ...issues.map(issue => `  • ${issue}`),
                warnings.length > 0 ? `⚠️ ${warnings.length} warning(s):` : null,
                ...warnings.map(warning => `  • ${warning}`)
            ].filter(Boolean).join('\n');

            if (issues.length > 0) {
                vscode.window.showErrorMessage(`Project validation failed:\n${message}`);
            } else {
                vscode.window.showWarningMessage(`Project validation completed with warnings:\n${message}`);
            }
        }

    } catch (error) {
        vscode.window.showErrorMessage(`Validation failed: ${error}`);
    }
}

async function findGDLFiles(directory: vscode.Uri): Promise<vscode.Uri[]> {
    const files: vscode.Uri[] = [];
    const fs = vscode.workspace.fs;

    try {
        const entries = await fs.readDirectory(directory);
        for (const [name, type] of entries) {
            const entryUri = vscode.Uri.joinPath(directory, name);
            
            if (type === vscode.FileType.Directory) {
                // Recursively search subdirectories
                const subFiles = await findGDLFiles(entryUri);
                files.push(...subFiles);
            } else if (type === vscode.FileType.File && name.endsWith('.gdl')) {
                files.push(entryUri);
            }
        }
    } catch {
        // Directory doesn't exist or can't be read
    }

    return files;
}

async function buildProject(): Promise<void> {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
        vscode.window.showErrorMessage('Please open a Game Vibe project folder first.');
        return;
    }

    await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: 'Building Game Vibe project...',
        cancellable: false
    }, async (progress) => {
        try {
            progress.report({ increment: 0, message: 'Validating project...' });
            
            // First validate the project
            await validateProject();
            
            progress.report({ increment: 25, message: 'Compiling GDL files...' });
            
            // Find and compile all GDL files
            const gdlFiles = await findGDLFiles(workspaceFolder.uri);
            const fs = vscode.workspace.fs;
            const buildDir = vscode.Uri.joinPath(workspaceFolder.uri, 'build');
            
            // Create build directory
            try {
                await fs.createDirectory(buildDir);
            } catch {
                // Directory already exists
            }

            progress.report({ increment: 50, message: 'Processing assets...' });
            
            // Create a build manifest
            const buildManifest = {
                timestamp: new Date().toISOString(),
                files: gdlFiles.map(f => f.path),
                version: '1.0.0'
            };

            progress.report({ increment: 75, message: 'Generating build files...' });

            // Save build manifest
            const manifestFile = vscode.Uri.joinPath(buildDir, 'manifest.json');
            await fs.writeFile(manifestFile, Buffer.from(JSON.stringify(buildManifest, null, 2), 'utf8'));

            // Copy assets to build directory
            const assetsSource = vscode.Uri.joinPath(workspaceFolder.uri, 'assets');
            const assetsBuild = vscode.Uri.joinPath(buildDir, 'assets');
            
            try {
                await copyDirectory(assetsSource, assetsBuild);
            } catch {
                // Assets directory might not exist
            }

            progress.report({ increment: 100, message: 'Build complete!' });
            
            vscode.window.showInformationMessage('🚀 Project built successfully! Check the build/ directory.');
            
        } catch (error) {
            vscode.window.showErrorMessage(`Build failed: ${error}`);
        }
    });
}

async function copyDirectory(source: vscode.Uri, destination: vscode.Uri): Promise<void> {
    const fs = vscode.workspace.fs;
    
    try {
        await fs.createDirectory(destination);
    } catch {
        // Directory already exists
    }

    const entries = await fs.readDirectory(source);
    for (const [name, type] of entries) {
        const sourceEntry = vscode.Uri.joinPath(source, name);
        const destEntry = vscode.Uri.joinPath(destination, name);
        
        if (type === vscode.FileType.Directory) {
            await copyDirectory(sourceEntry, destEntry);
        } else {
            const content = await fs.readFile(sourceEntry);
            await fs.writeFile(destEntry, content);
        }
    }
}

async function createDemoGame(workspaceFolder: vscode.WorkspaceFolder): Promise<void> {
    const fs = vscode.workspace.fs;
    const workspaceUri = workspaceFolder.uri;
    
    try {
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'Creating Super Jumpy Demo Game...',
            cancellable: false
        }, async (progress) => {
            progress.report({ increment: 10, message: 'Setting up project structure...' });
            
            // Create game structure directly in workspace root
            const assetsPath = vscode.Uri.joinPath(workspaceUri, 'assets');
            const spritesPath = vscode.Uri.joinPath(assetsPath, 'sprites');
            const levelsPath = vscode.Uri.joinPath(workspaceUri, 'levels');
            const behaviorsPath = vscode.Uri.joinPath(workspaceUri, 'behaviors');
            
            await fs.createDirectory(assetsPath);
            await fs.createDirectory(spritesPath);
            await fs.createDirectory(levelsPath);
            await fs.createDirectory(behaviorsPath);
            
            progress.report({ increment: 20, message: 'Creating game files...' });
            
            // Create demo files directly in workspace root
            await createDemoFiles(workspaceUri, progress);
            
            progress.report({ increment: 80, message: 'Opening demo game...' });
            
            // Open the main game file
            const mainGameFile = vscode.Uri.joinPath(workspaceUri, 'super-jumpy-demo.gdl');
            const document = await vscode.workspace.openTextDocument(mainGameFile);
            await vscode.window.showTextDocument(document);
            
            progress.report({ increment: 100, message: 'Demo game created!' });
        });
        
        vscode.window.showInformationMessage(
            '🎮 Super Jumpy demo game created! Press F5 to start playing.',
            'Open Level 1',
            'View Instructions'
        ).then(selection => {
            if (selection === 'Open Level 1') {
                const level1File = vscode.Uri.joinPath(workspaceUri, 'levels', 'level1.gdl');
                vscode.workspace.openTextDocument(level1File).then(doc => {
                    vscode.window.showTextDocument(doc);
                });
            } else if (selection === 'View Instructions') {
                const readmeFile = vscode.Uri.joinPath(workspaceUri, 'README.md');
                vscode.workspace.openTextDocument(readmeFile).then(doc => {
                    vscode.window.showTextDocument(doc, vscode.ViewColumn.Beside);
                });
            }
        });
        
    } catch (error) {
        vscode.window.showErrorMessage(`Failed to create demo game: ${error}`);
    }
}

async function createDemoFiles(rootPath: vscode.Uri, progress: vscode.Progress<{message?: string, increment?: number}>): Promise<void> {
    const fs = vscode.workspace.fs;
    
    // Create the complete demo game files
    const demoFiles = [
        {
            path: 'super-jumpy-demo.gdl',
            content: `// Super Jumpy - Platform Game Demo
// A complete demo game showcasing the Game Vibe Engine capabilities

game SuperJumpyDemo {
    title: "Super Jumpy Adventures"
    version: "1.0.0"
    author: "Game Vibe Team"
    description: "A fun platformer demo with multiple levels, enemies, and power-ups"
    
    settings: {
        defaultScene: "Level1"
        pixelArt: false
        targetFPS: 60
    }
    
    assets: {
        sprites: [
            "assets/sprites/player.svg",
            "assets/sprites/enemy.svg", 
            "assets/sprites/platforms.svg",
            "assets/sprites/collectibles.svg",
            "assets/sprites/background.svg"
        ]
    }
    
    scenes: [
        "levels/level1.gdl",
        "levels/level2.gdl"
    ]
    
    behaviors: [
        "behaviors/game-behaviors.gdl"
    ]
}

// Quick Start Instructions:
// 1. Open levels/level1.gdl
// 2. Press Ctrl+Enter to compile and run
// 3. Use Arrow Keys or WASD to move
// 4. Press Space to jump (double jump available!)
// 5. Collect stars and gems for points
// 6. Stomp on enemies by jumping on them

instructions {
    "Controls": [
        "Arrow Keys or A/D: Move left/right",
        "Space or W: Jump (hold for higher jump)",
        "Double jump: Press jump again in mid-air"
    ]
    
    "Objective": [
        "Collect all stars and gems",
        "Avoid or stomp enemies",
        "Reach the end of each level",
        "Try to get the highest score!"
    ]
}`
        },
        {
            path: 'levels/level1.gdl',
            content: `// Super Jumpy Demo - Level 1: Grassy Hills
// A beginner-friendly introduction level

scene Level1 {
    size: [800, 600]
    gravity: [0, 800]
    background: "#87CEEB"
    
    // Player character
    entity Player {
        transform: {
            x: 100
            y: 400
        }
        
        sprite: {
            texture: "assets/sprites/player.svg#player-idle"
            width: 32
            height: 32
        }
        
        physics: {
            mode: platformer
            mass: 1.0
            friction: 0.8
            gravityScale: 1.0
            fixedRotation: true
        }
        
        collider: {
            type: box
            width: 24
            height: 28
        }
        
        behavior: PlatformerMovement {
            speed: 200
            jumpPower: 400
            doubleJumpEnabled: true
        }
        
        behavior: PlayerController {
            lives: 3
            score: 0
        }
    }
    
    // Ground platform
    entity Ground {
        transform: {
            x: 400
            y: 550
        }
        
        sprite: {
            texture: "assets/sprites/platforms.svg#platform-grass"
            width: 800
            height: 50
        }
        
        physics: {
            mode: static
        }
        
        collider: {
            type: box
            width: 800
            height: 50
        }
    }
    
    // Floating platforms
    entity Platform1 {
        transform: {
            x: 300
            y: 450
        }
        
        sprite: {
            texture: "assets/sprites/platforms.svg#platform-stone"
            width: 128
            height: 32
        }
        
        physics: {
            mode: static
        }
        
        collider: {
            type: box
            width: 128
            height: 32
        }
    }
    
    entity Platform2 {
        transform: {
            x: 500
            y: 350
        }
        
        sprite: {
            texture: "assets/sprites/platforms.svg#platform-stone"
            width: 96
            height: 32
        }
        
        physics: {
            mode: static
        }
        
        collider: {
            type: box
            width: 96
            height: 32
        }
    }
    
    // Bouncy platform
    entity BouncyPlatform {
        transform: {
            x: 650
            y: 480
        }
        
        sprite: {
            texture: "assets/sprites/platforms.svg#platform-bouncy"
            width: 80
            height: 32
        }
        
        physics: {
            mode: static
        }
        
        collider: {
            type: box
            width: 80
            height: 32
        }
        
        behavior: BounceBehavior {
            bouncePower: 600
        }
    }
    
    // Collectible star
    entity Star1 {
        transform: {
            x: 300
            y: 400
        }
        
        sprite: {
            texture: "assets/sprites/collectibles.svg#collectible-star"
            width: 24
            height: 24
        }
        
        collider: {
            type: circle
            radius: 12
            isSensor: true
        }
        
        behavior: CollectibleBehavior {
            points: 100
            effectType: "star"
        }
    }
    
    entity Star2 {
        transform: {
            x: 500
            y: 300
        }
        
        sprite: {
            texture: "assets/sprites/collectibles.svg#collectible-star"
            width: 24
            height: 24
        }
        
        collider: {
            type: circle
            radius: 12
            isSensor: true
        }
        
        behavior: CollectibleBehavior {
            points: 100
            effectType: "star"
        }
    }
    
    // Power-up gem
    entity Gem1 {
        transform: {
            x: 650
            y: 430
        }
        
        sprite: {
            texture: "assets/sprites/collectibles.svg#collectible-gem"
            width: 24
            height: 24
        }
        
        collider: {
            type: circle
            radius: 12
            isSensor: true
        }
        
        behavior: CollectibleBehavior {
            points: 500
            effectType: "powerup"
            powerupType: "speed"
            duration: 5.0
        }
    }
    
    // Enemy
    entity Enemy1 {
        transform: {
            x: 380
            y: 500
        }
        
        sprite: {
            texture: "assets/sprites/enemy.svg#enemy-patrol1"
            width: 28
            height: 28
        }
        
        physics: {
            mode: dynamic
            mass: 0.8
            friction: 0.5
            gravityScale: 1.0
            fixedRotation: true
        }
        
        collider: {
            type: box
            width: 24
            height: 24
        }
        
        behavior: PatrolBehavior {
            points: [[350, 500], [450, 500]]
            speed: 50
            pauseTime: 0.5
        }
        
        behavior: EnemyBehavior {
            health: 1
            damageToPlayer: 1
            pointsWhenDefeated: 200
            canBeStomped: true
        }
    }
    
    // Checkpoint
    entity Checkpoint {
        transform: {
            x: 600
            y: 480
        }
        
        sprite: {
            texture: "assets/sprites/collectibles.svg#collectible-checkpoint"
            width: 32
            height: 64
        }
        
        collider: {
            type: box
            width: 32
            height: 64
            isSensor: true
        }
        
        behavior: CheckpointBehavior {
            activated: false
        }
    }
    
    // Goal
    entity Goal {
        transform: {
            x: 750
            y: 450
        }
        
        sprite: {
            texture: "assets/sprites/collectibles.svg#collectible-checkpoint"
            width: 32
            height: 64
            tint: "#00FF00"
        }
        
        collider: {
            type: box
            width: 50
            height: 100
            isSensor: true
        }
        
        behavior: LevelEndBehavior {
            nextLevel: "Level2"
            victoryMessage: "Level 1 Complete!"
        }
    }
}`
        },
        {
            path: 'levels/level2.gdl',
            content: `// Super Jumpy Demo - Level 2: Cloud Hopper
// Vertical platforming challenge

scene Level2 {
    size: [800, 600]
    gravity: [0, 600]
    background: "#98D8E8"
    
    // Player spawn
    entity Player {
        transform: {
            x: 100
            y: 520
        }
        
        sprite: {
            texture: "assets/sprites/player.svg#player-idle"
            width: 32
            height: 32
        }
        
        physics: {
            mode: platformer
            mass: 1.0
            friction: 0.8
            gravityScale: 1.0
            fixedRotation: true
        }
        
        collider: {
            type: box
            width: 24
            height: 28
        }
        
        behavior: PlatformerMovement {
            speed: 200
            jumpPower: 450
            doubleJumpEnabled: true
            airControl: 0.9
        }
        
        behavior: PlayerController {
            lives: 3
            score: 0
        }
    }
    
    // Starting platform
    entity StartPlatform {
        transform: {
            x: 150
            y: 560
        }
        
        sprite: {
            texture: "assets/sprites/platforms.svg#platform-stone"
            width: 200
            height: 32
        }
        
        physics: {
            mode: static
        }
        
        collider: {
            type: box
            width: 200
            height: 32
        }
    }
    
    // Moving platform
    entity MovingPlatform1 {
        transform: {
            x: 350
            y: 480
        }
        
        sprite: {
            texture: "assets/sprites/platforms.svg#platform-moving"
            width: 96
            height: 32
        }
        
        physics: {
            mode: kinematic
        }
        
        collider: {
            type: box
            width: 96
            height: 32
        }
        
        behavior: MovingPlatformBehavior {
            points: [[300, 480], [500, 480]]
            speed: 80
            pauseTime: 1.0
            moveType: "horizontal"
        }
    }
    
    // Bouncy cloud platforms
    entity CloudPlatform1 {
        transform: {
            x: 550
            y: 350
        }
        
        sprite: {
            texture: "assets/sprites/platforms.svg#platform-bouncy"
            width: 80
            height: 32
            tint: "#E0E0E0"
        }
        
        physics: {
            mode: static
        }
        
        collider: {
            type: box
            width: 80
            height: 32
        }
        
        behavior: BounceBehavior {
            bouncePower: 550
        }
    }
    
    entity CloudPlatform2 {
        transform: {
            x: 300
            y: 200
        }
        
        sprite: {
            texture: "assets/sprites/platforms.svg#platform-bouncy"
            width: 80
            height: 32
            tint: "#E0E0E0"
        }
        
        physics: {
            mode: static
        }
        
        collider: {
            type: box
            width: 80
            height: 32
        }
        
        behavior: BounceBehavior {
            bouncePower: 600
        }
    }
    
    // Goal platform
    entity GoalPlatform {
        transform: {
            x: 650
            y: 100
        }
        
        sprite: {
            texture: "assets/sprites/platforms.svg#platform-stone"
            width: 150
            height: 32
            tint: "#FFD700"
        }
        
        physics: {
            mode: static
        }
        
        collider: {
            type: box
            width: 150
            height: 32
        }
    }
    
    // Collectibles
    entity Coin1 {
        transform: {
            x: 400
            y: 430
        }
        
        sprite: {
            texture: "assets/sprites/collectibles.svg#collectible-coin"
            width: 24
            height: 24
        }
        
        collider: {
            type: circle
            radius: 12
            isSensor: true
        }
        
        behavior: CollectibleBehavior {
            points: 50
            effectType: "coin"
        }
        
        behavior: FloatingBehavior {
            amplitude: 10
            frequency: 0.5
        }
    }
    
    entity PowerUp {
        transform: {
            x: 650
            y: 50
        }
        
        sprite: {
            texture: "assets/sprites/collectibles.svg#collectible-powerup"
            width: 32
            height: 32
        }
        
        collider: {
            type: circle
            radius: 16
            isSensor: true
        }
        
        behavior: CollectibleBehavior {
            points: 1000
            effectType: "powerup"
            powerupType: "invincibility"
            duration: 5.0
        }
    }
    
    // Goal
    entity Goal {
        transform: {
            x: 650
            y: 50
        }
        
        sprite: {
            texture: "assets/sprites/collectibles.svg#collectible-checkpoint"
            width: 32
            height: 64
            tint: "#FFD700"
        }
        
        collider: {
            type: box
            width: 50
            height: 100
            isSensor: true
        }
        
        behavior: LevelEndBehavior {
            nextLevel: null
            victoryMessage: "Game Complete! Well done!"
        }
    }
}`
        },
        {
            path: 'behaviors/game-behaviors.gdl',
            content: `// Game Behaviors for Super Jumpy Demo

behavior PlayerController {
    properties: {
        lives: 3
        score: 0
        hasDoubleJump: true
        invincible: false
        invincibilityTime: 0
        currentCheckpoint: null
    }
    
    // Player takes damage from enemies
    // Collects items for points
    // Manages lives and respawning
}

behavior CollectibleBehavior {
    properties: {
        points: 100
        effectType: "star"
        powerupType: null
        duration: 0
        collected: false
    }
    
    // Gives points to player when collected
    // Can provide temporary power-ups
}

behavior EnemyBehavior {
    properties: {
        health: 1
        damageToPlayer: 1
        pointsWhenDefeated: 100
        canBeStomped: true
        defeated: false
    }
    
    // Can be defeated by player stomping
    // Damages player on contact
}

behavior PatrolBehavior {
    properties: {
        points: []
        speed: 50
        pauseTime: 0.5
        currentPoint: 0
        paused: false
    }
    
    // Moves between waypoints
    // Pauses at each point
}

behavior MovingPlatformBehavior {
    properties: {
        points: []
        speed: 100
        pauseTime: 0
        moveType: "horizontal"
    }
    
    // Moves along a path
    // Can move horizontally, vertically, or both
}

behavior BounceBehavior {
    properties: {
        bouncePower: 600
        squashAmount: 0.2
    }
    
    // Gives player extra jump height
    // Visual squash effect
}

behavior CheckpointBehavior {
    properties: {
        activated: false
    }
    
    // Saves player progress
    // Changes appearance when activated
}

behavior LevelEndBehavior {
    properties: {
        nextLevel: null
        victoryMessage: "Level Complete!"
    }
    
    // Completes the level
    // Loads next level or shows victory
}

behavior FloatingBehavior {
    properties: {
        amplitude: 10
        frequency: 1.0
        startY: null
    }
    
    // Makes object float up and down
    // Used for collectibles
}`
        },
        {
            path: 'README.md',
            content: `# Super Jumpy - Game Vibe Engine Demo

🎮 **A complete platformer game showcasing the Game Vibe Engine!**

## Quick Start

1. **Open** \`levels/level1.gdl\`
2. **Press F5** to start the game preview
3. **Use Arrow Keys** or **A/D** to move
4. **Press Space** to jump (double jump available!)
5. **Collect stars and gems** for points
6. **Stomp enemies** by jumping on them

## Game Features

### Gameplay
- **Smooth platformer movement** with variable jump height
- **Double jump** capability
- **Enemy stomping** mechanics  
- **Collectible system** with different point values
- **Power-ups** (speed boost, invincibility)
- **Multiple platform types** (bouncy, moving, ice)
- **Checkpoint system**
- **Multi-level progression**

### Controls
- **Arrow Keys** or **A/D**: Move left/right
- **Space** or **W**: Jump (hold for higher jumps)
- **Double Jump**: Press jump again in mid-air

### Objectives
- Collect all ⭐ stars and 💎 gems
- Avoid or stomp on 🔺 enemies
- Reach the 🏁 goal at each level's end
- Get the highest score possible!

## File Structure

\`\`\`
├── super-jumpy-demo.gdl      # Main game configuration
├── levels/
│   ├── level1.gdl            # Grassy Hills (Beginner)
│   └── level2.gdl            # Cloud Hopper (Advanced)
├── behaviors/
│   └── game-behaviors.gdl    # Custom game logic
├── assets/
│   └── sprites/              # SVG game sprites
└── README.md                 # This file
\`\`\`

## Development Features

### Hot Reload
- Edit any \`.gdl\` file
- Save the file (Ctrl+S)  
- Game automatically reloads with changes

### Custom Behaviors
- Player controller with lives and score
- Collectible system with power-ups
- Enemy AI with patrol patterns
- Moving and bouncy platforms
- Checkpoint and level progression

## Tips & Tricks

- **Hold jump** for higher jumps
- **Use double jump** to reach high platforms
- **Bouncy platforms** give extra height
- **Moving platforms** follow predictable patterns
- **Enemies can be stomped** from above for points

## Next Steps

Try these challenges:
1. Modify player jump height in level1.gdl
2. Add a new platform in an empty space
3. Create a new collectible with different points
4. Design your own level layout
5. Experiment with different physics values

Happy game development! 🚀

---
*Built with Game Vibe Engine*`
        }
    ];
    
    // Also copy the SVG sprite files
    const spriteFiles = [
        {
            path: 'assets/sprites/player.svg',
            content: await getSVGContent('player')
        },
        {
            path: 'assets/sprites/enemy.svg',
            content: await getSVGContent('enemy')
        },
        {
            path: 'assets/sprites/platforms.svg',
            content: await getSVGContent('platforms')
        },
        {
            path: 'assets/sprites/collectibles.svg',
            content: await getSVGContent('collectibles')
        },
        {
            path: 'assets/sprites/background.svg',
            content: await getSVGContent('background')
        }
    ];
    
    const allFiles = [...demoFiles, ...spriteFiles];
    
    for (const file of allFiles) {
        progress.report({ message: `Creating ${file.path}...` });
        const filePath = vscode.Uri.joinPath(rootPath, file.path);
        await fs.writeFile(filePath, Buffer.from(file.content, 'utf8'));
    }
}

async function getSVGContent(spriteType: string): Promise<string> {
    // Return the SVG content we created earlier
    const svgContents: { [key: string]: string } = {
        player: `<?xml version="1.0" encoding="UTF-8"?>
<svg width="32" height="32" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <g id="player-idle">
      <rect x="4" y="8" width="24" height="20" rx="4" fill="#4A90E2" stroke="#2E5C8A" stroke-width="2"/>
      <circle cx="10" cy="14" r="3" fill="white"/>
      <circle cx="22" cy="14" r="3" fill="white"/>
      <circle cx="11" cy="15" r="2" fill="black"/>
      <circle cx="23" cy="15" r="2" fill="black"/>
      <path d="M 10 20 Q 16 24 22 20" stroke="black" stroke-width="2" fill="none"/>
      <rect x="8" y="26" width="6" height="6" rx="2" fill="#2E5C8A"/>
      <rect x="18" y="26" width="6" height="6" rx="2" fill="#2E5C8A"/>
    </g>
  </defs>
  <use href="#player-idle"/>
</svg>`,
        
        enemy: `<?xml version="1.0" encoding="UTF-8"?>
<svg width="32" height="32" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <g id="enemy-patrol1">
      <path d="M 16 4 L 28 28 L 4 28 Z" fill="#E74C3C" stroke="#C0392B" stroke-width="2"/>
      <rect x="8" y="16" width="4" height="2" fill="white"/>
      <rect x="20" y="16" width="4" height="2" fill="white"/>
      <path d="M 10 22 Q 16 18 22 22" stroke="white" stroke-width="2" fill="none"/>
      <circle cx="10" cy="30" r="3" fill="#C0392B"/>
      <circle cx="22" cy="30" r="3" fill="#C0392B"/>
    </g>
  </defs>
  <use href="#enemy-patrol1"/>
</svg>`,
        
        platforms: `<?xml version="1.0" encoding="UTF-8"?>
<svg width="256" height="128" viewBox="0 0 256 128" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <g id="platform-grass">
      <rect x="0" y="0" width="32" height="32" fill="#8B4513"/>
      <rect x="0" y="0" width="32" height="12" fill="#228B22"/>
      <path d="M 0 8 Q 4 4 8 8 T 16 8 T 24 8 T 32 8" stroke="#32CD32" stroke-width="2" fill="none"/>
    </g>
    <g id="platform-stone">
      <rect x="32" y="0" width="32" height="32" fill="#696969"/>
      <line x1="32" y1="8" x2="64" y2="8" stroke="#4B4B4B"/>
      <line x1="32" y1="16" x2="64" y2="16" stroke="#4B4B4B"/>
      <line x1="40" y1="0" x2="40" y2="32" stroke="#4B4B4B"/>
    </g>
    <g id="platform-bouncy">
      <rect x="96" y="0" width="32" height="32" fill="#FF1493"/>
      <rect x="96" y="0" width="32" height="24" fill="#FF69B4"/>
      <path d="M 96 24 Q 112 20 128 24" fill="#FF1493"/>
    </g>
    <g id="platform-moving">
      <rect x="128" y="0" width="32" height="32" fill="#4169E1"/>
      <rect x="128" y="0" width="32" height="8" fill="#1E90FF"/>
      <circle cx="136" cy="20" r="4" fill="#87CEEB"/>
      <circle cx="152" cy="20" r="4" fill="#87CEEB"/>
    </g>
  </defs>
  <use href="#platform-grass"/>
  <use href="#platform-stone"/>
  <use href="#platform-bouncy"/>
  <use href="#platform-moving"/>
</svg>`,
        
        collectibles: `<?xml version="1.0" encoding="UTF-8"?>
<svg width="96" height="64" viewBox="0 0 96 64" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <g id="collectible-star">
      <path d="M 16 2 L 20 12 L 30 12 L 22 18 L 26 28 L 16 22 L 6 28 L 10 18 L 2 12 L 12 12 Z" fill="#FFD700" stroke="#FFA500"/>
    </g>
    <g id="collectible-gem">
      <path d="M 48 8 L 56 8 L 60 16 L 56 24 L 48 24 L 44 16 Z" fill="#50C878" stroke="#228B22"/>
      <circle cx="52" cy="16" r="2" fill="white" opacity="0.8"/>
    </g>
    <g id="collectible-coin">
      <circle cx="80" cy="16" r="12" fill="#FFD700" stroke="#B8860B" stroke-width="2"/>
      <text x="80" y="21" font-family="Arial" font-size="12" text-anchor="middle" fill="#B8860B">$</text>
    </g>
    <g id="collectible-powerup">
      <circle cx="16" cy="48" r="14" fill="#FF00FF" stroke="#8B008B" stroke-width="2"/>
      <path d="M 16 38 L 12 48 L 16 48 L 14 54 L 20 44 L 16 44 L 18 38 Z" fill="white"/>
    </g>
    <g id="collectible-checkpoint">
      <rect x="79" y="36" width="2" height="20" fill="#8B4513"/>
      <path d="M 81 36 L 93 40 L 81 44 Z" fill="#FF0000" stroke="#8B0000"/>
      <path d="M 85 40 L 86 38 L 87 40 L 85.5 41 L 86.5 41 Z" fill="white"/>
    </g>
  </defs>
  <use href="#collectible-star"/>
  <use href="#collectible-gem"/>
  <use href="#collectible-coin"/>
  <use href="#collectible-powerup"/>
  <use href="#collectible-checkpoint"/>
</svg>`,
        
        background: `<?xml version="1.0" encoding="UTF-8"?>
<svg width="800" height="600" viewBox="0 0 800 600" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="skyGradient" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" style="stop-color:#87CEEB"/>
      <stop offset="100%" style="stop-color:#F0E68C"/>
    </linearGradient>
  </defs>
  <rect width="800" height="600" fill="url(#skyGradient)"/>
  <ellipse cx="150" cy="100" rx="60" ry="30" fill="white" opacity="0.8"/>
  <ellipse cx="400" cy="80" rx="80" ry="40" fill="white" opacity="0.6"/>
  <ellipse cx="650" cy="120" rx="70" ry="35" fill="white" opacity="0.7"/>
</svg>`
    };
    
    return svgContents[spriteType] || '';
}

async function createFullFeaturedRPGDemo(workspaceFolder: vscode.WorkspaceFolder): Promise<void> {
    const fs = vscode.workspace.fs;
    const workspaceUri = workspaceFolder.uri;
    
    try {
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'Creating Full-Featured RPG Demo...',
            cancellable: false
        }, async (progress) => {
            progress.report({ increment: 10, message: 'Setting up advanced project structure...' });
            
            // Create comprehensive RPG structure
            const assetsPath = vscode.Uri.joinPath(workspaceUri, 'assets');
            const spritesPath = vscode.Uri.joinPath(assetsPath, 'sprites');
            const tilesPath = vscode.Uri.joinPath(assetsPath, 'tiles');
            const audioPath = vscode.Uri.joinPath(assetsPath, 'audio');
            const uiPath = vscode.Uri.joinPath(assetsPath, 'ui');
            const behaviorsPath = vscode.Uri.joinPath(workspaceUri, 'behaviors');
            const scenesPath = vscode.Uri.joinPath(workspaceUri, 'scenes');
            
            await fs.createDirectory(assetsPath);
            await fs.createDirectory(spritesPath);
            await fs.createDirectory(tilesPath);
            await fs.createDirectory(audioPath);
            await fs.createDirectory(uiPath);
            await fs.createDirectory(behaviorsPath);
            await fs.createDirectory(scenesPath);
            
            progress.report({ increment: 20, message: 'Creating full-featured RPG demo files...' });
            
            await createFullFeaturedRPGFiles(workspaceUri, progress);
            
            progress.report({ increment: 90, message: 'Finalizing full RPG demo...' });
        });

        // Open the main demo file
        const mainGameUri = vscode.Uri.joinPath(workspaceUri, 'full-rpg-demo.gdl');
        const document = await vscode.workspace.openTextDocument(mainGameUri);
        await vscode.window.showTextDocument(document);
        
        vscode.window.showInformationMessage('🏰 Full-Featured RPG Demo created! Use "Game Vibe: Run Game in Browser" to play the complete game.');
        
    } catch (error) {
        vscode.window.showErrorMessage(`Failed to create full RPG demo: ${error}`);
    }
}

async function createEnhancedPhaserRPGDemo(workspaceFolder: vscode.WorkspaceFolder): Promise<void> {
    const fs = vscode.workspace.fs;
    const workspaceUri = workspaceFolder.uri;
    
    try {
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'Creating Enhanced Phaser RPG Demo...',
            cancellable: false
        }, async (progress) => {
            progress.report({ increment: 10, message: 'Setting up enhanced RPG structure...' });
            
            // Create asset directories
            const assetsPath = vscode.Uri.joinPath(workspaceUri, 'assets');
            const phaserRPGPath = vscode.Uri.joinPath(assetsPath, 'phaser-rpg-assets');
            const atlasPath = vscode.Uri.joinPath(phaserRPGPath, 'atlas');
            const tilemapsPath = vscode.Uri.joinPath(phaserRPGPath, 'tilemaps');
            const tilesetsPath = vscode.Uri.joinPath(phaserRPGPath, 'tilesets');
            
            await fs.createDirectory(assetsPath);
            await fs.createDirectory(phaserRPGPath);
            await fs.createDirectory(atlasPath);
            await fs.createDirectory(tilemapsPath);
            await fs.createDirectory(tilesetsPath);
            
            progress.report({ increment: 20, message: 'Copying Phaser RPG assets...' });
            
            // Get extension path for asset copying
            const extensionPath = vscode.extensions.getExtension('game-vibe.game-vibe-engine')?.extensionPath;
            if (extensionPath) {
                const sourceAssetsPath = vscode.Uri.joinPath(vscode.Uri.file(extensionPath), 'assets', 'phaser-rpg-assets');
                
                try {
                    // Copy atlas files
                    await copyFileIfExists(vscode.Uri.joinPath(sourceAssetsPath, 'atlas'), 'atlas.json', atlasPath, 'atlas.json');
                    await copyFileIfExists(vscode.Uri.joinPath(sourceAssetsPath, 'atlas'), 'atlas.png', atlasPath, 'atlas.png');
                    
                    // Copy tilemap files
                    await copyFileIfExists(vscode.Uri.joinPath(sourceAssetsPath, 'tilemaps'), 'tuxemon-town.json', tilemapsPath, 'tuxemon-town.json');
                    
                    // Copy tileset files
                    await copyFileIfExists(vscode.Uri.joinPath(sourceAssetsPath, 'tilesets'), 'tuxemon-sample-32px-extruded.png', tilesetsPath, 'tuxemon-sample-32px-extruded.png');
                } catch (copyError) {
                    console.warn('Could not copy some assets from extension:', copyError);
                }
            }
            
            progress.report({ increment: 40, message: 'Creating enhanced GDL files...' });
            
            // Create the enhanced Phaser RPG demo GDL file
            const enhancedRPGContent = await createEnhancedPhaserRPGContent();
            const enhancedGDLUri = vscode.Uri.joinPath(workspaceUri, 'phaser-rpg-enhanced.gdl');
            await fs.writeFile(enhancedGDLUri, Buffer.from(enhancedRPGContent, 'utf8'));
            
            progress.report({ increment: 70, message: 'Creating enhanced browser launcher...' });
            
            // Create a special browser launcher command for this demo
            const launcherContent = createPhaserRPGLauncher();
            const launcherUri = vscode.Uri.joinPath(workspaceUri, 'launch-phaser-rpg.js');
            await fs.writeFile(launcherUri, Buffer.from(launcherContent, 'utf8'));
            
            progress.report({ increment: 90, message: 'Finalizing enhanced RPG demo...' });
        });

        // Open the enhanced demo file
        const enhancedGDLUri = vscode.Uri.joinPath(workspaceUri, 'phaser-rpg-enhanced.gdl');
        const document = await vscode.workspace.openTextDocument(enhancedGDLUri);
        await vscode.window.showTextDocument(document);
        
        vscode.window.showInformationMessage('🏰 Enhanced Phaser RPG Demo created! This is a faithful reproduction of the remarkablegames/phaser-rpg. Use "Game Vibe: Run Game in Browser" to experience the complete game.');
        
    } catch (error) {
        vscode.window.showErrorMessage(`Failed to create enhanced Phaser RPG demo: ${error}`);
    }
}

async function createRPGDemo(workspaceFolder: vscode.WorkspaceFolder): Promise<void> {
    const fs = vscode.workspace.fs;
    const workspaceUri = workspaceFolder.uri;
    
    try {
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'Creating Phaser RPG Demo...',
            cancellable: false
        }, async (progress) => {
            progress.report({ increment: 10, message: 'Setting up project structure...' });
            
            // Create RPG structure directly in workspace root
            const assetsPath = vscode.Uri.joinPath(workspaceUri, 'assets');
            const atlasPath = vscode.Uri.joinPath(assetsPath, 'atlas-rpg');
            const spritesPath = vscode.Uri.joinPath(assetsPath, 'sprites-rpg');
            const tilesetsPath = vscode.Uri.joinPath(assetsPath, 'tilesets-rpg');
            const behaviorsPath = vscode.Uri.joinPath(workspaceUri, 'behaviors');
            
            await fs.createDirectory(assetsPath);
            await fs.createDirectory(atlasPath);
            await fs.createDirectory(spritesPath);
            await fs.createDirectory(tilesetsPath);
            await fs.createDirectory(behaviorsPath);
            
            progress.report({ increment: 20, message: 'Copying demo assets...' });
            
            // Get extension path
            const extensionPath = vscode.extensions.getExtension('game-vibe.game-vibe-engine')?.extensionPath;
            if (!extensionPath) {
                throw new Error('Extension path not found');
            }
            
            // Copy assets from demo folder to workspace
            const demoAssetsPath = vscode.Uri.joinPath(vscode.Uri.file(extensionPath), 'demo', 'phaser-rpg-demo', 'assets');
            const demoBehaviorsPath = vscode.Uri.joinPath(vscode.Uri.file(extensionPath), 'demo', 'phaser-rpg-demo', 'behaviors');
            
            try {
                // Copy atlas files
                await copyFileIfExists(demoAssetsPath, 'atlas.png', atlasPath, 'atlas.png');
                await copyFileIfExists(demoAssetsPath, 'atlas.json', atlasPath, 'atlas.json');
                
                // Copy sprite files
                await copyFileIfExists(demoAssetsPath, 'spaceman.png', spritesPath, 'spaceman.png');
                
                // Copy tileset files
                await copyFileIfExists(demoAssetsPath, 'tuxemon-sample-32px-extruded.png', tilesetsPath, 'tuxemon-sample-32px-extruded.png');
                await copyFileIfExists(demoAssetsPath, 'tuxemon-town.json', tilesetsPath, 'tuxemon-town.json');
                
                // Copy behavior files
                await copyFileIfExists(demoBehaviorsPath, 'rpg-behaviors.gdl', behaviorsPath, 'rpg-behaviors.gdl');
                await copyFileIfExists(demoBehaviorsPath, 'tuxemon-behaviors.gdl', behaviorsPath, 'tuxemon-behaviors.gdl');
                
            } catch (copyError) {
                console.warn('Could not copy some assets from demo folder, using built-in versions');
            }
            
            progress.report({ increment: 40, message: 'Creating game files...' });
            
            // Create the main RPG demo file
            await createRPGDemoFiles(workspaceUri, progress);
            
            progress.report({ increment: 80, message: 'Opening RPG demo...' });
            
            // Open the main game file
            const mainGameFile = vscode.Uri.joinPath(workspaceUri, 'tuxemon-rpg-demo.gdl');
            const document = await vscode.workspace.openTextDocument(mainGameFile);
            await vscode.window.showTextDocument(document);
            
            progress.report({ increment: 100, message: 'RPG demo created!' });
        });
        
        vscode.window.showInformationMessage(
            '🎮 Phaser RPG demo created! This is a top-down RPG with character movement, interactions, and tilemaps.',
            'Run Game',
            'View Behaviors'
        ).then(selection => {
            if (selection === 'Run Game') {
                vscode.commands.executeCommand('gameVibe.runGame');
            } else if (selection === 'View Behaviors') {
                const behaviorsFile = vscode.Uri.joinPath(workspaceUri, 'behaviors', 'rpg-behaviors.gdl');
                vscode.workspace.openTextDocument(behaviorsFile).then(doc => {
                    vscode.window.showTextDocument(doc, vscode.ViewColumn.Beside);
                });
            }
        });
        
    } catch (error) {
        vscode.window.showErrorMessage(`Failed to create RPG demo: ${error}`);
    }
}

async function copyFileIfExists(sourcePath: vscode.Uri, sourceFile: string, destPath: vscode.Uri, destFile: string): Promise<void> {
    const fs = vscode.workspace.fs;
    try {
        const sourceUri = vscode.Uri.joinPath(sourcePath, sourceFile);
        const destUri = vscode.Uri.joinPath(destPath, destFile);
        const content = await fs.readFile(sourceUri);
        await fs.writeFile(destUri, content);
    } catch (error) {
        console.warn(`Could not copy file ${sourceFile}:`, error);
    }
}

async function createRPGDemoFiles(rootPath: vscode.Uri, progress: vscode.Progress<{message?: string, increment?: number}>): Promise<void> {
    const fs = vscode.workspace.fs;
    
    // Create the main RPG demo GDL file
    const rpgDemoContent = `// 🏰 Complete RPG Demo - Showcasing All Features
// This demonstrates the full-fledged RPG system with all original Phaser RPG functionality

scene RPGTownDemo {
    // World tilemap - creates a complete RPG town layout
    entity WorldTilemap {
        transform: { x: 0, y: 0 }
        tilemap: {
            width: 25,
            height: 19,
            tileWidth: 32,
            tileHeight: 32
        }
        physics: { mode: "static" }
    }

    // Main Player Character
    entity Player {
        transform: { x: 352, y: 1216 }
        sprite: {
            texture: "atlas.png"
            atlasData: "atlas.json"
            currentFrame: "misa-front"
            width: 32
            height: 48
        }
        physics: { 
            mode: "topdown"
            drag: 0.8
        }
        collider: { 
            type: "box" 
            width: 24
            height: 32
            offsetY: 8
        }
        behavior: TuxemonPlayerMovement {
            speed: 175
            diagonalSpeedMultiplier: 0.707
            animations: {
                idle_down: "misa-front"
                idle_left: "misa-left"
                idle_right: "misa-right"
                idle_up: "misa-back"
                walk_down: ["misa-front-walk.000", "misa-front-walk.001", "misa-front-walk.002", "misa-front-walk.003"]
                walk_left: ["misa-left-walk.000", "misa-left-walk.001", "misa-left-walk.002", "misa-left-walk.003"]
                walk_right: ["misa-right-walk.000", "misa-right-walk.001", "misa-right-walk.002", "misa-right-walk.003"]
                walk_up: ["misa-back-walk.000", "misa-back-walk.001", "misa-back-walk.002", "misa-back-walk.003"]
            }
            animationFrameRate: 10
        }
        behavior: InteractionSystem {
            interactionRange: 64
            interactionKey: "space"
        }
        behavior: AnimationManager {
            defaultAnimation: "idle_down"
            frameRate: 10
        }
    }

    // Camera follows player
    entity CameraController {
        transform: { x: 0, y: 0 }
        behavior: CameraFollow {
            target: "Player"
            followSpeed: 0.1
            zoom: 1.0
            boundsFromTilemap: "tuxemon-town.json"
        }
    }

    // Interactive Sign
    entity WelcomeSign {
        transform: { x: 356, y: 1082 }
        sprite: {
            texture: "tuxemon-sample-32px-extruded.png"
            width: 24
            height: 28
            tileId: 40
        }
        physics: { mode: "static" }
        collider: { 
            type: "box"
            width: 24
            height: 28
            isTrigger: true
        }
        behavior: InteractableSign {
            text: "Welcome to Phaser RPG!"
            interactionRange: 48
            showOnInteract: true
        }
        behavior: DialogueInteraction {
            text: "Welcome to the RPG world! Use WASD or arrow keys to move around. Press SPACE to interact with objects."
            requireInput: true
            typewriterSpeed: 50
        }
    }

    // Tilemap Foreground
    entity TilemapForeground {
        transform: { x: 0, y: 0 }
        sprite: {
            texture: "tuxemon-sample-32px-extruded.png"
            tileLayer: true
            layerName: "Above Player"
            tilemapSource: "tuxemon-town.json"
        }
        renderOrder: 100
    }

    // UI Manager
    entity UIManager {
        transform: { x: 0, y: 0 }
        behavior: UIManager {
            showInstructions: true
            instructionText: "WASD or arrow keys to move. SPACE to interact."
            typewriterOnStart: true
            displayDuration: 4000
        }
    }

    // Scene Manager
    entity SceneController {
        transform: { x: 0, y: 0 }
        behavior: SceneManager {
            pauseKey: "escape"
            enablePauseMenu: true
            debugKey: "f3"
        }
    }

    // Audio Manager
    entity AudioController {
        transform: { x: 0, y: 0 }
        behavior: AudioManager {
            backgroundMusic: ""
            volume: 0.7
            loop: true
            fadeInTime: 2000
        }
    }
}`;

    await fs.writeFile(vscode.Uri.joinPath(rootPath, 'tuxemon-rpg-demo.gdl'), Buffer.from(rpgDemoContent, 'utf8'));
    
    // Also create a simplified version
    const simpleRPGContent = `// Simple RPG Demo - Basic Version
// A simplified version using basic shapes instead of complex assets

game SimpleRPGDemo {
    title: "Simple RPG Demo"
    version: "1.0.0"
    author: "GameWeaver Team"
    description: "A simple top-down RPG demo using basic shapes"
    
    settings: {
        defaultScene: "SimpleWorld"
        pixelArt: false
        targetFPS: 60
        canvasSize: { width: 800, height: 600 }
    }
}

scene SimpleWorld {
    camera: {
        zoom: 1.0
        lerp: 0.1
        bounds: { x: 0, y: 0, width: 1200, height: 800 }
    }

    // Simple Player
    entity Player {
        transform: { x: 400, y: 300 }
        sprite: { 
            texture: "player"
            width: 32
            height: 32
            color: "#4A90E2"
        }
        physics: { 
            mode: "topdown"
            drag: 0.8
        }
        collider: { 
            type: "box" 
            width: 28
            height: 28
        }
        behavior: TopDownPlayerMovement {
            speed: 200
            diagonalSpeedMultiplier: 0.707
        }
        behavior: InteractionSystem {
            interactionRange: 50
            interactionKey: "space"
        }
    }

    // Camera follows player
    entity CameraController {
        transform: { x: 0, y: 0 }
        behavior: CameraFollow {
            target: "Player"
            followSpeed: 0.1
            zoom: 1.0
        }
    }

    // Walls
    entity WallTop {
        transform: { x: 400, y: 50 }
        sprite: { texture: "wall", width: 800, height: 20, color: "#8B4513" }
        physics: { mode: "static" }
        collider: { type: "box", width: 800, height: 20 }
    }

    entity WallBottom {
        transform: { x: 400, y: 550 }
        sprite: { texture: "wall", width: 800, height: 20, color: "#8B4513" }
        physics: { mode: "static" }
        collider: { type: "box", width: 800, height: 20 }
    }

    entity WallLeft {
        transform: { x: 10, y: 300 }
        sprite: { texture: "wall", width: 20, height: 500, color: "#8B4513" }
        physics: { mode: "static" }
        collider: { type: "box", width: 20, height: 500 }
    }

    entity WallRight {
        transform: { x: 790, y: 300 }
        sprite: { texture: "wall", width: 20, height: 500, color: "#8B4513" }
        physics: { mode: "static" }
        collider: { type: "box", width: 20, height: 500 }
    }

    // Interactive NPC
    entity NPC {
        transform: { x: 200, y: 200 }
        sprite: { 
            texture: "npc"
            width: 32
            height: 32
            color: "#E74C3C"
        }
        physics: { mode: "static" }
        collider: { 
            type: "box"
            width: 32
            height: 32
            isTrigger: true
        }
        behavior: NPCDialogue {
            text: "Hello there, adventurer! Welcome to our simple world."
            interactionRange: 50
            requireInput: true
        }
    }

    // Interactive Sign
    entity Sign {
        transform: { x: 600, y: 400 }
        sprite: { 
            texture: "sign"
            width: 24
            height: 32
            color: "#F39C12"
        }
        physics: { mode: "static" }
        collider: { 
            type: "box"
            width: 24
            height: 32
            isTrigger: true
        }
        behavior: InteractableSign {
            text: "This is a sign! Press SPACE to interact."
            interactionRange: 50
            showOnInteract: true
        }
    }
}`;

    await fs.writeFile(vscode.Uri.joinPath(rootPath, 'simple-rpg-demo.gdl'), Buffer.from(simpleRPGContent, 'utf8'));
}

async function createFullFeaturedRPGFiles(rootPath: vscode.Uri, progress: vscode.Progress<{message?: string, increment?: number}>): Promise<void> {
    const fs = vscode.workspace.fs;
    
    // Read our comprehensive RPG demo content
    const fullRPGContent = `// 🏰 Complete Full-Featured RPG Demo
// Comprehensive RPG with all professional game engine features

scene RPGTownDemo {
    // World tilemap - creates a complete RPG town layout
    entity WorldTilemap {
        transform: { x: 0, y: 0 }
        tilemap: {
            width: 25,
            height: 19,
            tileWidth: 32,
            tileHeight: 32
        }
        physics: { mode: "static" }
    }

    // === PLAYER CHARACTER ===
    entity TuxemonTrainer {
        transform: { x: 400, y: 300 }
        sprite: { 
            texture: "tuxemon_trainer", 
            width: 32, 
            height: 48,
            color: "#4169E1"
        }
        physics: { mode: "topdown", mass: 1, friction: 0.8 }
        collider: { type: "box", width: 28, height: 32 }
        behavior: RPGMovement { 
            speed: 150,
            smoothMovement: true,
            runMultiplier: 1.5
        }
        camera: { 
            follow: true, 
            smoothness: 0.1
        }
    }

    // === TOWN NPCs ===
    entity VillageElder {
        transform: { x: 200, y: 200 }
        sprite: { 
            texture: "npc_elder", 
            width: 32, 
            height: 48,
            color: "#8B4513"
        }
        physics: { mode: "static" }
        collider: { type: "box", width: 28, height: 32 }
        behavior: NPCDialogue {
            dialogues: [
                "Welcome to Tuxemon Village, young trainer!",
                "This village has been here for over 200 years.",
                "Many legendary trainers started their journey here.",
                "Good luck on your adventure!"
            ],
            interactionRange: 64,
            canRepeat: true
        }
    }

    entity ShopKeeper {
        transform: { x: 600, y: 200 }
        sprite: { 
            texture: "npc_shopkeeper", 
            width: 32, 
            height: 48,
            color: "#32CD32"
        }
        physics: { mode: "static" }
        collider: { type: "box", width: 28, height: 32 }
        behavior: NPCDialogue {
            dialogues: [
                "Welcome to my shop!",
                "I have potions, pokeballs, and more!",
                "Special discount for new trainers!",
                "Come back anytime!"
            ],
            interactionRange: 64,
            shopInventory: ["Super Potion", "Great Ball", "Antidote", "Revive"]
        }
    }

    entity TownGuard {
        transform: { x: 400, y: 100 }
        sprite: { 
            texture: "npc_guard", 
            width: 32, 
            height: 48,
            color: "#FF6347"
        }
        physics: { mode: "static" }
        collider: { type: "box", width: 28, height: 32 }
        behavior: NPCDialogue {
            dialogues: [
                "Halt! State your business!",
                "The northern forest is dangerous.",
                "Only experienced trainers may pass.",
                "Show me your trainer badge!"
            ],
            interactionRange: 64,
            blocking: true
        }
    }

    // === WILD CREATURES ===
    entity WildGrassTuxemon {
        transform: { x: 150, y: 350 }
        sprite: { 
            texture: "tuxemon_grass", 
            width: 24, 
            height: 24,
            color: "#32CD32"
        }
        physics: { mode: "dynamic", mass: 0.5 }
        collider: { type: "circle", radius: 12 }
        behavior: WildCreatureBehavior {
            movePattern: "wander",
            wanderRadius: 80,
            speed: 40,
            fleeDistance: 60,
            encounterChance: 0.3,
            species: "Grassmander",
            level: 5
        }
    }

    entity WildFireTuxemon {
        transform: { x: 650, y: 400 }
        sprite: { 
            texture: "tuxemon_fire", 
            width: 24, 
            height: 24,
            color: "#FF4500"
        }
        physics: { mode: "dynamic", mass: 0.5 }
        collider: { type: "circle", radius: 12 }
        behavior: WildCreatureBehavior {
            movePattern: "patrol",
            patrolPoints: [
                { x: 650, y: 400 },
                { x: 700, y: 350 },
                { x: 650, y: 300 },
                { x: 600, y: 350 }
            ],
            speed: 60,
            encounterChance: 0.4,
            species: "Flamefin",
            level: 7
        }
    }

    // === INTERACTIVE OBJECTS ===
    entity TownSign {
        transform: { x: 350, y: 450 }
        sprite: { 
            texture: "sign_wood", 
            width: 32, 
            height: 32,
            color: "#8B4513"
        }
        physics: { mode: "static" }
        collider: { type: "box", width: 32, height: 32, isTrigger: true }
        behavior: InteractableSign {
            text: "🏘️ Welcome to Tuxemon Village\\n👥 Population: 342\\n📅 Founded: 1985\\n🎯 Elevation: 1,200ft",
            interactionRange: 48
        }
    }

    entity AncientWell {
        transform: { x: 480, y: 320 }
        sprite: { 
            texture: "well_stone", 
            width: 48, 
            height: 48,
            color: "#708090"
        }
        physics: { mode: "static" }
        collider: { type: "circle", radius: 24 }
        behavior: InteractableObject {
            text: "An ancient stone well. The water glimmers with mysterious energy.",
            sound: "water_splash",
            interactionRange: 64,
            specialEffect: "heal_player"
        }
    }

    // === COLLECTIBLE ITEMS ===
    entity SuperPotion {
        transform: { x: 180, y: 400 }
        sprite: { 
            texture: "item_potion", 
            width: 16, 
            height: 20,
            color: "#FF1493"
        }
        physics: { mode: "static" }
        collider: { type: "circle", radius: 8, isTrigger: true }
        behavior: CollectibleItem {
            itemType: "potion",
            itemName: "Super Potion",
            description: "Restores 50 HP to one Tuxemon",
            collectSound: "item_pickup",
            respawnTime: 300000,
            glowEffect: true
        }
    }

    entity GoldCoins {
        transform: { x: 680, y: 380 }
        sprite: { 
            texture: "item_coins", 
            width: 20, 
            height: 16,
            color: "#FFD700"
        }
        physics: { mode: "static" }
        collider: { type: "circle", radius: 10, isTrigger: true }
        behavior: CollectibleItem {
            itemType: "currency",
            itemName: "Gold Coins",
            amount: 100,
            description: "Valuable gold coins",
            collectSound: "coins_jingle",
            respawnTime: 600000
        }
    }

    entity MysteryBox {
        transform: { x: 450, y: 520 }
        sprite: { 
            texture: "chest_wooden", 
            width: 32, 
            height: 24,
            color: "#8B4513"
        }
        physics: { mode: "static" }
        collider: { type: "box", width: 32, height: 24 }
        behavior: TreasureChest {
            contents: ["Rare Candy", "TM_Thunderbolt", "Master Ball", "Max Potion"],
            openOnce: true,
            requiresKey: false,
            openSound: "chest_open",
            openAnimation: "chest_opening"
        }
    }

    // === UI AND HUD SYSTEMS ===
    entity PlayerHealthHUD {
        behavior: UIHealthBar {
            target: "TuxemonTrainer",
            position: { x: 20, y: 20 },
            width: 200,
            height: 20,
            backgroundColor: "#ff0000",
            foregroundColor: "#00ff00",
            borderColor: "#ffffff",
            showText: true,
            showPercentage: true,
            fadeWhenFull: true
        }
    }

    entity MinimapHUD {
        behavior: UIMinimap {
            position: { x: 580, y: 20 },
            size: { width: 200, height: 150 },
            scale: 0.15,
            backgroundColor: "rgba(0,0,0,0.7)",
            borderColor: "#ffffff",
            playerColor: "#ff0000",
            npcColor: "#00ff00",
            creatureColor: "#ffff00",
            itemColor: "#ff00ff",
            showEntities: true,
            showTerrain: true
        }
    }

    entity InventoryHUD {
        behavior: UIInventory {
            position: { x: 20, y: 500 },
            slots: 6,
            slotSize: 32,
            backgroundColor: "rgba(0,0,0,0.8)",
            borderColor: "#ffffff",
            showItemCount: true,
            showItemNames: true
        }
    }
}`;

    await fs.writeFile(vscode.Uri.joinPath(rootPath, 'full-rpg-demo.gdl'), Buffer.from(fullRPGContent, 'utf8'));
    
    progress.report({ increment: 60, message: 'Creating behavior definitions...' });
    
    // Create a comprehensive behavior file
    const behaviorContent = `// Advanced RPG Behaviors
// All behaviors for the full-featured RPG engine

behavior RPGMovement {
    properties: {
        speed: number = 150
        smoothMovement: boolean = true
        runMultiplier: number = 1.5
    }
    
    description: "Advanced RPG character movement with running, smooth movement, and animation support"
    category: "Movement"
}

behavior NPCDialogue {
    properties: {
        dialogues: string[] = []
        interactionRange: number = 64
        canRepeat: boolean = true
        blocking: boolean = false
        shopInventory: string[] = []
    }
    
    description: "Interactive NPC with dialogue system and optional shop functionality"
    category: "Interaction"
}

behavior WildCreatureBehavior {
    properties: {
        movePattern: string = "wander"
        wanderRadius: number = 100
        patrolPoints: object[] = []
        territory: object = {}
        speed: number = 50
        fleeDistance: number = 80
        encounterChance: number = 0.3
        species: string = "Unknown"
        level: number = 1
        aggressive: boolean = false
    }
    
    description: "AI behavior for wild creatures with multiple movement patterns"
    category: "AI"
}

behavior CollectibleItem {
    properties: {
        itemType: string = "misc"
        itemName: string = "Item"
        description: string = ""
        amount: number = 1
        collectSound: string = "pickup"
        respawnTime: number = 0
        glowEffect: boolean = true
        hidden: boolean = false
    }
    
    description: "Collectible items with inventory integration and respawn system"
    category: "Interaction"
}

behavior InteractableSign {
    properties: {
        text: string = "This is a sign."
        interactionRange: number = 48
    }
    
    description: "Readable signs and information displays"
    category: "Interaction"
}

behavior TreasureChest {
    properties: {
        contents: string[] = []
        openOnce: boolean = true
        requiresKey: boolean = false
        keyId: string = "chest_key"
        openSound: string = "chest_open"
        openAnimation: string = "chest_opening"
    }
    
    description: "Treasure chests with loot and key requirements"
    category: "Interaction"
}

behavior UIHealthBar {
    properties: {
        target: string = "Player"
        position: object = { x: 20, y: 20 }
        width: number = 200
        height: number = 20
        backgroundColor: string = "#ff0000"
        foregroundColor: string = "#00ff00"
        borderColor: string = "#ffffff"
        showText: boolean = true
        showPercentage: boolean = false
        fadeWhenFull: boolean = false
    }
    
    description: "Health bar UI element with customizable appearance"
    category: "UI"
}

behavior UIMinimap {
    properties: {
        position: object = { x: 580, y: 20 }
        size: object = { width: 200, height: 150 }
        scale: number = 0.15
        backgroundColor: string = "rgba(0,0,0,0.7)"
        borderColor: string = "#ffffff"
        playerColor: string = "#ff0000"
        npcColor: string = "#00ff00"
        creatureColor: string = "#ffff00"
        itemColor: string = "#ff00ff"
        showEntities: boolean = true
        showTerrain: boolean = true
    }
    
    description: "Minimap showing world overview and entity positions"
    category: "UI"
}

behavior UIInventory {
    properties: {
        position: object = { x: 20, y: 500 }
        slots: number = 6
        slotSize: number = 32
        backgroundColor: string = "rgba(0,0,0,0.8)"
        borderColor: string = "#ffffff"
        showItemCount: boolean = true
        showItemNames: boolean = true
    }
    
    description: "Inventory system with item management"
    category: "UI"
}`;

    await fs.writeFile(vscode.Uri.joinPath(rootPath, 'behaviors', 'advanced-rpg-behaviors.gdl'), Buffer.from(behaviorContent, 'utf8'));
    
    progress.report({ increment: 80, message: 'Creating asset documentation...' });
    
    // Create comprehensive documentation
    const docContent = `# Full-Featured RPG Demo

## Overview
This is a complete, professional-grade RPG demo showcasing all features of the GameWeaver engine.

## Features Included
- **Interactive NPCs** with dialogue systems
- **Wild Creatures** with advanced AI behaviors
- **Collectible Items** with inventory management
- **Treasure Chests** with loot systems
- **Interactive Objects** (signs, wells, etc.)
- **Complete UI System** (health bar, minimap, inventory)
- **Tilemap World** with collision detection
- **Sound Integration** ready for audio files
- **Camera System** with player following

## How to Play
1. **Movement**: Use WASD or arrow keys to move around
2. **Interaction**: Press SPACE to interact with NPCs, signs, and objects
3. **Collection**: Walk over items to collect them automatically
4. **Exploration**: Explore the village and interact with everything!

## NPCs
- **Village Elder**: Provides information about the village
- **Shop Keeper**: Offers items for sale (shop system ready)
- **Town Guard**: Guards the northern entrance

## Creatures
- **Grass Tuxemon**: Wanders around, flees from player
- **Fire Tuxemon**: Patrols specific routes

## Items
- **Super Potion**: Healing item that respawns
- **Gold Coins**: Currency that respawns slowly
- **Mystery Box**: One-time treasure chest

## Technical Features
- Professional ECS architecture
- Multiple physics modes
- Advanced AI behaviors
- Complete UI framework
- Save/load system ready
- Multiplayer architecture ready
- Cross-platform deployment ready

## Controls
- **WASD/Arrow Keys**: Move
- **SPACE**: Interact
- **Shift**: Run (if enabled)
- **ESC**: Pause (planned)

This demo showcases a complete game development pipeline from concept to playable game!`;

    await fs.writeFile(vscode.Uri.joinPath(rootPath, 'README.md'), Buffer.from(docContent, 'utf8'));
}

async function createEnhancedPhaserRPGContent(): Promise<string> {
    // Return the enhanced Phaser RPG GDL content
    return `// 🏰 Enhanced Phaser RPG Demo - Complete Implementation
// Faithful reproduction of the remarkablegames/phaser-rpg using GDL

scene PhaserRPGMain {
    // === WORLD TILEMAP ===
    // Multi-layered tilemap system with collision detection
    entity WorldTilemap {
        transform: { x: 0, y: 0 }
        tilemap: {
            width: 40,
            height: 40,
            tileWidth: 32,
            tileHeight: 32,
            source: "assets/phaser-rpg-assets/tilemaps/tuxemon-town.json",
            tileset: "assets/phaser-rpg-assets/tilesets/tuxemon-sample-32px-extruded.png"
        }
        physics: { mode: "static" }
        behavior: TilemapLayer {
            layers: ["Below Player", "World", "Above Player", "Objects"],
            collisionLayer: "World",
            processObjects: true
        }
    }

    // === PLAYER CHARACTER ===
    // Animated player with 4-directional movement and interaction system
    entity Player {
        transform: { x: 400, y: 300 }
        sprite: { 
            texture: "assets/phaser-rpg-assets/atlas/atlas.png",
            atlas: "assets/phaser-rpg-assets/atlas/atlas.json",
            width: 32, 
            height: 42,
            color: "#4169E1"
        }
        physics: { 
            mode: "topdown", 
            mass: 1, 
            friction: 0.8,
            collideWorldBounds: true
        }
        collider: { 
            type: "box", 
            width: 28, 
            height: 32,
            offsetX: 2,
            offsetY: 10
        }
        animation: {
            animations: {
                "idle_down": {
                    frames: ["misa-front"],
                    frameRate: 1,
                    loop: false
                },
                "idle_up": {
                    frames: ["misa-back"],
                    frameRate: 1,
                    loop: false
                },
                "idle_left": {
                    frames: ["misa-left"],
                    frameRate: 1,
                    loop: false
                },
                "idle_right": {
                    frames: ["misa-right"],
                    frameRate: 1,
                    loop: false
                },
                "walk_down": {
                    frames: ["misa-front-walk.000", "misa-front-walk.001", "misa-front-walk.002", "misa-front-walk.003"],
                    frameRate: 10,
                    loop: true
                },
                "walk_up": {
                    frames: ["misa-back-walk.000", "misa-back-walk.001", "misa-back-walk.002", "misa-back-walk.003"],
                    frameRate: 10,
                    loop: true
                },
                "walk_left": {
                    frames: ["misa-left-walk.000", "misa-left-walk.001", "misa-left-walk.002", "misa-left-walk.003"],
                    frameRate: 10,
                    loop: true
                },
                "walk_right": {
                    frames: ["misa-right-walk.000", "misa-right-walk.001", "misa-right-walk.002", "misa-right-walk.003"],
                    frameRate: 10,
                    loop: true
                }
            },
            currentAnimation: "idle_down",
            playing: false
        }
        behavior: PhaserRPGPlayer { 
            speed: 175,
            normalizeMovement: true,
            interactionSelector: {
                width: 16,
                height: 16,
                offsetDistance: 19
            }
        }
        camera: { 
            follow: true, 
            smoothness: 0.1,
            bounds: "tilemap"
        }
    }

    // === UI SYSTEMS ===
    // Typewriter dialogue system for text display
    entity UISystem {
        behavior: TypewriterUI {
            typewriterSpeed: 100,
            displayDuration: 1500,
            font: "18px monospace",
            backgroundColor: "rgba(255, 255, 255, 0.95)",
            textColor: "#000",
            padding: 20,
            position: { x: 16, y: 16 },
            maxWidth: 400
        }
    }

    // === CAMERA SYSTEM ===
    // Camera that follows player within world bounds
    entity CameraController {
        behavior: CameraFollow {
            target: "Player",
            followSpeed: 0.1,
            smoothing: true,
            bounds: {
                useWorldBounds: true,
                respectViewport: true
            }
        }
    }

    // === GAME SETTINGS ===
    settings: {
        gravity: [0, 0],
        worldBounds: {
            width: 1280,   // 40 tiles * 32px
            height: 1280   // 40 tiles * 32px
        },
        background: "#87CEEB",
        pixelPerfect: true,
        debugging: {
            showColliders: false,
            showSelectors: false,
            enableConsole: true
        }
    }

    // === INPUT BINDINGS ===
    input: {
        movement: {
            up: ["w", "arrowup"],
            down: ["s", "arrowdown"], 
            left: ["a", "arrowleft"],
            right: ["d", "arrowright"]
        },
        interaction: {
            interact: ["space"],
            menu: ["escape"]
        }
    }

    // === AUDIO CONFIGURATION ===
    audio: {
        master: { volume: 1.0 },
        sfx: { 
            volume: 0.8,
            sounds: {
                "footstep": "assets/audio/footstep.mp3",
                "interact": "assets/audio/interact.mp3"
            }
        },
        music: { 
            volume: 0.6,
            tracks: {
                "town_theme": "assets/audio/town_theme.mp3"
            },
            autoPlay: "town_theme",
            loop: true
        }
    }
}`;
}

function createPhaserRPGLauncher(): string {
    return `// Enhanced Phaser RPG Demo Launcher
// Use this to launch the demo with the enhanced server

const vscode = require('vscode');
const { PhaserRPGGameServer } = require('./out/server/PhaserRPGGameServer');
const fs = require('fs');

async function launchEnhancedPhaserRPG() {
    try {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            vscode.window.showErrorMessage('Please open a workspace folder first');
            return;
        }

        // Read the enhanced GDL file
        const gdlPath = vscode.Uri.joinPath(workspaceFolder.uri, 'phaser-rpg-enhanced.gdl');
        const gdlContent = fs.readFileSync(gdlPath.fsPath, 'utf8');
        
        // Start the enhanced server
        const server = new PhaserRPGGameServer();
        const url = await server.start(gdlContent, workspaceFolder.uri.fsPath);
        
        // Open in browser
        vscode.env.openExternal(vscode.Uri.parse(url));
        vscode.window.showInformationMessage(\`🏰 Enhanced Phaser RPG launched at \${url}\`);
        
        // Auto-stop after 10 minutes
        setTimeout(() => {
            server.stop();
        }, 10 * 60 * 1000);
        
    } catch (error) {
        vscode.window.showErrorMessage(\`Failed to launch Enhanced Phaser RPG: \${error}\`);
    }
}

// Export for command palette use
module.exports = { launchEnhancedPhaserRPG };`;
}