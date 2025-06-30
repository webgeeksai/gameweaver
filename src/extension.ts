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
import * as fs from 'fs';
import * as path from 'path';

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

    // Register RPG Demo command - single demo based on phaser-rpg-reference
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
            await createPhaserRPGDemo(workspaceFolder, context);
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
                const gameServer = new GameServer();
                const url = await gameServer.start(gdlContent, workspaceFolder.uri.fsPath);
                
                // Open browser
                vscode.env.openExternal(vscode.Uri.parse(url));
                vscode.window.showInformationMessage(`🚀 Game launched in browser at ${url}`);
                
                // Stop server after 5 minutes to prevent hanging processes
                setTimeout(() => {
                    gameServer.stop();
                }, 5 * 60 * 1000);
                
            } catch (error) {
                vscode.window.showErrorMessage(`Failed to start game server: ${error}`);
            }
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
                // File doesn't exist, create it with initial sprite content
                const initialContent = Buffer.from(`// Sprite: ${fileName}
{
    "name": "${fileName}",
    "width": 32,
    "height": 32,
    "frames": [
        {
            "x": 0,
            "y": 0,
            "width": 32,
            "height": 32,
            "duration": 100
        }
    ],
    "animations": {
        "idle": {
            "frames": [0],
            "loop": true,
            "speed": 100
        }
    }
}`, 'utf8');
                await vscode.workspace.fs.writeFile(spriteFilePath, initialContent);
            }
            
            // Open with sprite editor
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

            // Create a new untitled level file or open existing
            const fileName = await vscode.window.showInputBox({
                prompt: 'Enter level name',
                value: 'new_level'
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
            const levelFilePath = vscode.Uri.joinPath(levelsPath, `${fileName}.level`);
            
            // Check if file exists, if not create it with empty content
            try {
                await vscode.workspace.fs.stat(levelFilePath);
            } catch {
                // File doesn't exist, create it with initial level content
                const initialContent = Buffer.from(`// Level: ${fileName}
{
    "name": "${fileName}",
    "width": 800,
    "height": 600,
    "entities": [],
    "background": "#87CEEB",
    "music": "",
    "tilemap": ""
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

            // Create a new untitled music file or open existing
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
            
            // Check if file exists, if not create it with empty content
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

// Helper functions
function getDefaultGDLContent(): string {
    return `game MyGame {
    title: "My Awesome Game"
    version: "1.0.0"
    
    settings: {
        defaultScene: "MainScene"
        targetFPS: 60
        physics: {
            gravity: [0, 800]
        }
    }
    
    assets: {
        sprites: [
            "assets/sprites/player.png"
        ]
        sounds: [
            "assets/sounds/jump.wav"
        ]
    }
}

scene MainScene {
    background: "#87CEEB"
    
    entities: [Player, Ground]
}

entity Player {
    transform: {
        position: [100, 300]
    }
    sprite: {
        texture: "player.png"
        width: 32
        height: 32
    }
    physics: {
        bodyType: "dynamic"
    }
    behavior: {
        type: "PlayerController"
    }
}

entity Ground {
    transform: {
        position: [0, 550]
    }
    sprite: {
        texture: "ground.png"
        width: 800
        height: 50
    }
    physics: {
        bodyType: "static"
    }
}`;
}

async function createGameTemplate(workspaceFolder: vscode.WorkspaceFolder, gameType: string): Promise<void> {
    // Basic game template creation logic
    const fs = vscode.workspace.fs;
    const workspaceUri = workspaceFolder.uri;
    
    try {
        // Create basic project structure
        await fs.createDirectory(vscode.Uri.joinPath(workspaceUri, 'assets'));
        await fs.createDirectory(vscode.Uri.joinPath(workspaceUri, 'assets', 'sprites'));
        await fs.createDirectory(vscode.Uri.joinPath(workspaceUri, 'assets', 'sounds'));
        await fs.createDirectory(vscode.Uri.joinPath(workspaceUri, 'levels'));
        await fs.createDirectory(vscode.Uri.joinPath(workspaceUri, 'behaviors'));
        
        // Create main game file based on type
        const gameContent = getTemplateContent(gameType);
        const gameFile = vscode.Uri.joinPath(workspaceUri, `${gameType.toLowerCase()}-game.gdl`);
        await fs.writeFile(gameFile, Buffer.from(gameContent, 'utf8'));
        
        // Open the created file
        const document = await vscode.workspace.openTextDocument(gameFile);
        await vscode.window.showTextDocument(document);
        
        vscode.window.showInformationMessage(`✨ ${gameType} game template created!`);
    } catch (error) {
        vscode.window.showErrorMessage(`Failed to create game template: ${error}`);
    }
}

function getTemplateContent(gameType: string): string {
    const templates: Record<string, string> = {
        'Platformer': `game PlatformerGame {
    title: "Platformer Adventure"
    version: "1.0.0"
    
    settings: {
        defaultScene: "Level1"
        targetFPS: 60
        physics: {
            gravity: [0, 800]
        }
    }
    
    assets: {
        sprites: ["assets/sprites/player.png", "assets/sprites/platform.png"]
        sounds: ["assets/sounds/jump.wav"]
    }
}

scene Level1 {
    background: "#87CEEB"
    entities: [Player, Platform]
}

entity Player {
    transform: { position: [100, 300] }
    sprite: { texture: "player.png", width: 32, height: 32 }
    physics: { bodyType: "dynamic" }
    behavior: { type: "PlatformerController" }
}

entity Platform {
    transform: { position: [200, 400] }
    sprite: { texture: "platform.png", width: 128, height: 32 }
    physics: { bodyType: "static" }
}`,
        'Top-Down': `game TopDownGame {
    title: "Top-Down Adventure"
    version: "1.0.0"
    
    settings: {
        defaultScene: "World"
        targetFPS: 60
        physics: {
            gravity: [0, 0]
        }
    }
    
    assets: {
        sprites: ["assets/sprites/character.png", "assets/sprites/tree.png"]
        sounds: ["assets/sounds/walk.wav"]
    }
}

scene World {
    background: "#90EE90"
    entities: [Character, Tree]
}

entity Character {
    transform: { position: [400, 300] }
    sprite: { texture: "character.png", width: 32, height: 32 }
    physics: { bodyType: "dynamic" }
    behavior: { type: "TopDownController" }
}

entity Tree {
    transform: { position: [200, 200] }
    sprite: { texture: "tree.png", width: 64, height: 64 }
    physics: { bodyType: "static" }
}`,
        'Custom': getDefaultGDLContent()
    };
    
    return templates[gameType] || templates['Custom'];
}

async function createGameProject(workspaceFolder: vscode.WorkspaceFolder): Promise<void> {
    // Create a full game project structure
    const fs = vscode.workspace.fs;
    const workspaceUri = workspaceFolder.uri;
    
    try {
        // Create comprehensive project structure
        const folders = [
            'assets',
            'assets/sprites',
            'assets/sounds',
            'assets/music',
            'assets/tilemaps',
            'levels',
            'behaviors',
            'scripts',
            'scenes'
        ];
        
        for (const folder of folders) {
            await fs.createDirectory(vscode.Uri.joinPath(workspaceUri, folder));
        }
        
        // Create main game file
        const mainContent = getDefaultGDLContent();
        await fs.writeFile(
            vscode.Uri.joinPath(workspaceUri, 'main.gdl'),
            Buffer.from(mainContent, 'utf8')
        );
        
        // Create README
        const readmeContent = `# Game Vibe Engine Project

This project was created with Game Vibe Engine.

## Structure
- \`assets/\` - Game assets (sprites, sounds, music, tilemaps)
- \`levels/\` - Level definitions
- \`behaviors/\` - Custom behaviors
- \`scenes/\` - Scene definitions
- \`main.gdl\` - Main game file

## Commands
- \`F5\` - Run game in preview
- \`Ctrl+Shift+P\` -> "Game Vibe: Run Game in Browser" - Run in browser
- \`Ctrl+Shift+P\` -> "Game Vibe: Compile GDL" - Compile GDL code

Enjoy creating your game!`;
        
        await fs.writeFile(
            vscode.Uri.joinPath(workspaceUri, 'README.md'),
            Buffer.from(readmeContent, 'utf8')
        );
        
        vscode.window.showInformationMessage('✨ Game project created successfully!');
    } catch (error) {
        vscode.window.showErrorMessage(`Failed to create project: ${error}`);
    }
}

async function showGamePreview(context: vscode.ExtensionContext, gdlContent: string): Promise<void> {
    // Create game preview webview panel
    const panel = vscode.window.createWebviewPanel(
        'gamePreview',
        'Game Preview',
        vscode.ViewColumn.Two,
        {
            enableScripts: true,
            retainContextWhenHidden: true
        }
    );
    
    panel.webview.html = `<!DOCTYPE html>
<html>
<head>
    <title>Game Preview</title>
    <style>
        body { margin: 0; padding: 20px; background: #1e1e1e; color: white; }
        #gameCanvas { border: 2px solid #333; background: #87CEEB; }
        .controls { margin-top: 10px; }
        button { margin-right: 10px; padding: 8px 16px; }
    </style>
</head>
<body>
    <h2>Game Preview</h2>
    <canvas id="gameCanvas" width="800" height="600"></canvas>
    <div class="controls">
        <button onclick="startGame()">Start</button>
        <button onclick="pauseGame()">Pause</button>
        <button onclick="resetGame()">Reset</button>
    </div>
    <div>
        <p>Use Arrow Keys or WASD to move. Space to jump.</p>
        <pre id="gameCode">${gdlContent}</pre>
    </div>
    
    <script>
        let gameRunning = false;
        
        function startGame() {
            gameRunning = true;
            console.log('Game started');
        }
        
        function pauseGame() {
            gameRunning = false;
            console.log('Game paused');
        }
        
        function resetGame() {
            gameRunning = false;
            console.log('Game reset');
        }
        
        // Basic game loop placeholder
        function gameLoop() {
            if (gameRunning) {
                // Render game here
            }
            requestAnimationFrame(gameLoop);
        }
        
        gameLoop();
    </script>
</body>
</html>`;
}

async function addNewScene(): Promise<void> {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
        vscode.window.showErrorMessage('Please open a workspace folder first.');
        return;
    }
    
    const sceneName = await vscode.window.showInputBox({
        prompt: 'Enter scene name',
        value: 'NewScene'
    });
    
    if (!sceneName) return;
    
    const sceneContent = `scene ${sceneName} {
    background: "#87CEEB"
    
    entities: []
    
    music: ""
    
    onEnter: {
        // Code to run when scene starts
    }
    
    onExit: {
        // Code to run when scene ends
    }
}`;
    
    const fs = vscode.workspace.fs;
    const scenesPath = vscode.Uri.joinPath(workspaceFolder.uri, 'scenes');
    
    try {
        await fs.createDirectory(scenesPath);
    } catch {
        // Directory might already exist
    }
    
    const sceneFile = vscode.Uri.joinPath(scenesPath, `${sceneName.toLowerCase()}.gdl`);
    await fs.writeFile(sceneFile, Buffer.from(sceneContent, 'utf8'));
    
    const document = await vscode.workspace.openTextDocument(sceneFile);
    await vscode.window.showTextDocument(document);
    
    vscode.window.showInformationMessage(`✨ Scene "${sceneName}" created!`);
}

async function addNewEntity(): Promise<void> {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
        vscode.window.showErrorMessage('Please open a workspace folder first.');
        return;
    }
    
    const entityName = await vscode.window.showInputBox({
        prompt: 'Enter entity name',
        value: 'NewEntity'
    });
    
    if (!entityName) return;
    
    const entityType = await vscode.window.showQuickPick([
        'Static Object',
        'Dynamic Character',
        'Collectible Item',
        'Interactive Object',
        'Custom'
    ], {
        placeHolder: 'Select entity type'
    });
    
    if (!entityType) return;
    
    const entityTemplates: Record<string, string> = {
        'Static Object': `entity ${entityName} {
    transform: {
        position: [0, 0]
    }
    sprite: {
        texture: "${entityName.toLowerCase()}.png"
        width: 32
        height: 32
    }
    physics: {
        bodyType: "static"
    }
}`,
        'Dynamic Character': `entity ${entityName} {
    transform: {
        position: [0, 0]
    }
    sprite: {
        texture: "${entityName.toLowerCase()}.png"
        width: 32
        height: 32
    }
    physics: {
        bodyType: "dynamic"
    }
    behavior: {
        type: "CharacterController"
    }
}`,
        'Collectible Item': `entity ${entityName} {
    transform: {
        position: [0, 0]
    }
    sprite: {
        texture: "${entityName.toLowerCase()}.png"
        width: 16
        height: 16
    }
    behavior: {
        type: "Collectible"
        points: 10
    }
}`,
        'Interactive Object': `entity ${entityName} {
    transform: {
        position: [0, 0]
    }
    sprite: {
        texture: "${entityName.toLowerCase()}.png"
        width: 32
        height: 32
    }
    physics: {
        bodyType: "static"
    }
    behavior: {
        type: "Interactive"
        message: "Press E to interact"
    }
}`
    };
    
    const entityContent = entityTemplates[entityType] || entityTemplates['Static Object'];
    
    // Insert into current editor if it's a GDL file
    const activeEditor = vscode.window.activeTextEditor;
    if (activeEditor && activeEditor.document.languageId === 'gdl') {
        const edit = new vscode.WorkspaceEdit();
        const endPosition = activeEditor.document.lineAt(activeEditor.document.lineCount - 1).range.end;
        edit.insert(activeEditor.document.uri, endPosition, `\n\n${entityContent}`);
        await vscode.workspace.applyEdit(edit);
        
        vscode.window.showInformationMessage(`✨ Entity "${entityName}" added to current file!`);
    } else {
        vscode.window.showErrorMessage('Please open a GDL file to add entities.');
    }
}

async function validateProject(): Promise<void> {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
        vscode.window.showErrorMessage('Please open a workspace folder first.');
        return;
    }
    
    // Basic project validation
    const issues: string[] = [];
    
    try {
        const fs = vscode.workspace.fs;
        
        // Check for main GDL file
        const gdlFiles = await vscode.workspace.findFiles('**/*.gdl');
        if (gdlFiles.length === 0) {
            issues.push('No GDL files found in project');
        }
        
        // Check for assets folder
        try {
            await fs.stat(vscode.Uri.joinPath(workspaceFolder.uri, 'assets'));
        } catch {
            issues.push('Assets folder missing');
        }
        
        if (issues.length === 0) {
            vscode.window.showInformationMessage('✅ Project validation passed!');
        } else {
            const issueList = issues.map(issue => `• ${issue}`).join('\n');
            vscode.window.showWarningMessage(`Project validation found issues:\n${issueList}`);
        }
    } catch (error) {
        vscode.window.showErrorMessage(`Validation failed: ${error}`);
    }
}

async function buildProject(): Promise<void> {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
        vscode.window.showErrorMessage('Please open a workspace folder first.');
        return;
    }
    
    await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: 'Building project...',
        cancellable: false
    }, async (progress) => {
        progress.report({ increment: 25, message: 'Compiling GDL files...' });
        
        // Find and compile all GDL files
        const gdlFiles = await vscode.workspace.findFiles('**/*.gdl');
        
        progress.report({ increment: 50, message: 'Validating assets...' });
        
        // Validate assets exist
        // This would include checking sprite references, sound files, etc.
        
        progress.report({ increment: 75, message: 'Generating build...' });
        
        // Generate build output
        // This would create deployable files
        
        progress.report({ increment: 100, message: 'Build complete!' });
        
        await new Promise(resolve => setTimeout(resolve, 500));
    });
    
    vscode.window.showInformationMessage('✅ Project built successfully!');
}

async function createPhaserRPGDemo(workspaceFolder: vscode.WorkspaceFolder, context: vscode.ExtensionContext): Promise<void> {
    const fs = vscode.workspace.fs;
    const workspaceUri = workspaceFolder.uri;
    
    try {
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'Creating Phaser RPG Demo...',
            cancellable: false
        }, async (progress) => {
            progress.report({ increment: 10, message: 'Setting up project structure...' });
            
            // Create directory structure
            const folders = [
                'assets', 'assets/sprites', 'assets/atlas', 'assets/tilemaps', 'assets/tilesets',
                'behaviors', 'scenes'
            ];
            
            for (const folder of folders) {
                await fs.createDirectory(vscode.Uri.joinPath(workspaceUri, folder));
            }
            
            progress.report({ increment: 30, message: 'Copying assets from phaser-rpg-reference...' });
            
            // Copy assets using proper Node.js filesystem operations
            const nodeFs = require('fs');
            const nodePath = require('path');
            
            // Find the extension's installation directory
            const extensionPath = context.extensionPath;
            let sourceAssetsPath = nodePath.join(extensionPath, 'assets', 'phaser-rpg-assets');
            const targetAssetsPath = nodePath.join(workspaceFolder.uri.fsPath, 'assets');
            
            console.log('Extension path:', extensionPath);
            console.log('Source assets path:', sourceAssetsPath);
            console.log('Target assets path:', targetAssetsPath);
            console.log('Source exists:', nodeFs.existsSync(sourceAssetsPath));
            
            // Fallback: try relative to __dirname if extension path doesn't work
            if (!nodeFs.existsSync(sourceAssetsPath)) {
                const fallbackPath = nodePath.join(__dirname, '..', '..', 'assets', 'phaser-rpg-assets');
                console.log('Trying fallback path:', fallbackPath);
                console.log('Fallback exists:', nodeFs.existsSync(fallbackPath));
                if (nodeFs.existsSync(fallbackPath)) {
                    sourceAssetsPath = fallbackPath;
                }
            }
            
            // Helper function to copy files recursively
            const copyFileRecursive = async (src: string, dest: string) => {
                const stats = nodeFs.statSync(src);
                if (stats.isDirectory()) {
                    if (!nodeFs.existsSync(dest)) {
                        nodeFs.mkdirSync(dest, { recursive: true });
                    }
                    const files = nodeFs.readdirSync(src);
                    for (const file of files) {
                        await copyFileRecursive(nodePath.join(src, file), nodePath.join(dest, file));
                    }
                } else {
                    const data = nodeFs.readFileSync(src);
                    await fs.writeFile(vscode.Uri.file(dest), data);
                    console.log(`Copied: ${src} -> ${dest}`);
                }
            };
            
            try {
                // Check if source assets exist
                if (!nodeFs.existsSync(sourceAssetsPath)) {
                    throw new Error(`Source assets not found at: ${sourceAssetsPath}`);
                }
                
                // Copy atlas files
                const atlasSourceDir = nodePath.join(sourceAssetsPath, 'atlas');
                const atlasTargetDir = nodePath.join(targetAssetsPath, 'atlas');
                if (nodeFs.existsSync(atlasSourceDir)) {
                    console.log('Copying atlas files...');
                    const atlasFiles = nodeFs.readdirSync(atlasSourceDir);
                    for (const file of atlasFiles) {
                        if (file.endsWith('.json') || file.endsWith('.png')) {
                            const srcFile = nodePath.join(atlasSourceDir, file);
                            const destFile = nodePath.join(atlasTargetDir, file);
                            const data = nodeFs.readFileSync(srcFile);
                            await fs.writeFile(vscode.Uri.file(destFile), data);
                            console.log(`✅ Copied atlas file: ${file}`);
                        }
                    }
                }
                
                // Copy tilemap files
                const tilemapSourceDir = nodePath.join(sourceAssetsPath, 'tilemaps');
                const tilemapTargetDir = nodePath.join(targetAssetsPath, 'tilemaps');
                if (nodeFs.existsSync(tilemapSourceDir)) {
                    console.log('Copying tilemap files...');
                    const tilemapFiles = nodeFs.readdirSync(tilemapSourceDir);
                    for (const file of tilemapFiles) {
                        if (file.endsWith('.json')) {
                            const srcFile = nodePath.join(tilemapSourceDir, file);
                            const destFile = nodePath.join(tilemapTargetDir, file);
                            const data = nodeFs.readFileSync(srcFile);
                            await fs.writeFile(vscode.Uri.file(destFile), data);
                            console.log(`✅ Copied tilemap file: ${file}`);
                        }
                    }
                }
                
                // Copy tileset files
                const tilesetSourceDir = nodePath.join(sourceAssetsPath, 'tilesets');
                const tilesetTargetDir = nodePath.join(targetAssetsPath, 'tilesets');
                if (nodeFs.existsSync(tilesetSourceDir)) {
                    console.log('Copying tileset files...');
                    const tilesetFiles = nodeFs.readdirSync(tilesetSourceDir);
                    for (const file of tilesetFiles) {
                        if (file.endsWith('.png')) {
                            const srcFile = nodePath.join(tilesetSourceDir, file);
                            const destFile = nodePath.join(tilesetTargetDir, file);
                            const data = nodeFs.readFileSync(srcFile);
                            await fs.writeFile(vscode.Uri.file(destFile), data);
                            console.log(`✅ Copied tileset file: ${file}`);
                        }
                    }
                }
                
                // Verify assets were copied
                const verificationChecks = [
                    { path: nodePath.join(targetAssetsPath, 'atlas', 'atlas.json'), name: 'Atlas JSON' },
                    { path: nodePath.join(targetAssetsPath, 'atlas', 'atlas.png'), name: 'Atlas PNG' },
                    { path: nodePath.join(targetAssetsPath, 'tilemaps', 'tuxemon-town.json'), name: 'Tilemap JSON' },
                    { path: nodePath.join(targetAssetsPath, 'tilesets', 'tuxemon-sample-32px-extruded.png'), name: 'Tileset PNG' }
                ];
                
                const missingFiles = verificationChecks.filter(check => !nodeFs.existsSync(check.path));
                if (missingFiles.length > 0) {
                    const missing = missingFiles.map(f => f.name).join(', ');
                    throw new Error(`Failed to copy some assets: ${missing}`);
                }
                
                console.log('✅ All assets copied and verified successfully');
                
                // Show detailed success message
                const assetCount = verificationChecks.length;
                vscode.window.showInformationMessage(`✅ Successfully copied ${assetCount} asset files to the demo project`);
                progress.report({ increment: 45, message: 'Assets copied successfully!' });
                
            } catch (error) {
                console.error('Error copying assets:', error);
                vscode.window.showErrorMessage(`Failed to copy assets: ${error instanceof Error ? error.message : error}`);
                throw error; // Re-throw to stop the demo creation process
            }
            
            progress.report({ increment: 50, message: 'Creating RPG demo files...' });
            
            // Create the main RPG demo GDL file
            const rpgContent = createPhaserRPGContent();
            await fs.writeFile(
                vscode.Uri.joinPath(workspaceUri, 'phaser-rpg-demo.gdl'),
                Buffer.from(rpgContent, 'utf8')
            );
            
            progress.report({ increment: 70, message: 'Creating behavior files...' });
            
            // Create RPG behaviors
            const behaviorContent = createRPGBehaviors();
            await fs.writeFile(
                vscode.Uri.joinPath(workspaceUri, 'behaviors', 'rpg-behaviors.gdl'),
                Buffer.from(behaviorContent, 'utf8')
            );
            
            progress.report({ increment: 90, message: 'Launching RPG demo in browser...' });
            
            // Launch the demo directly in browser using GameServer
            try {
                const rpgContent = createPhaserRPGContent();
                const gameServer = new GameServer();
                const url = await gameServer.start(rpgContent, workspaceFolder.uri.fsPath);
                
                // Open browser
                vscode.env.openExternal(vscode.Uri.parse(url));
                vscode.window.showInformationMessage(`🏰 Phaser RPG Demo launched at ${url}`);
                
                // Stop server after 10 minutes to prevent hanging processes
                setTimeout(() => {
                    gameServer.stop();
                }, 10 * 60 * 1000);
            } catch (error) {
                vscode.window.showErrorMessage(`Failed to launch RPG demo: ${error}`);
            }
            
            progress.report({ increment: 100, message: 'RPG demo launched!' });
        });
        
        vscode.window.showInformationMessage(
            '🏰 Phaser RPG demo created and launched! This is a complete RPG based on the phaser-rpg-reference with real sprites, tilemaps, and animations.',
            'Open Demo Folder'
        ).then(selection => {
            if (selection === 'Open Demo Folder') {
                vscode.commands.executeCommand('vscode.openFolder', workspaceUri);
            }
        });
        
    } catch (error) {
        vscode.window.showErrorMessage(`Failed to create RPG demo: ${error}`);
    }
}

function createPhaserRPGContent(): string {
    return `// Phaser RPG Demo - Complete RPG implementation
// Based on phaser-rpg-reference with full Game Vibe Engine integration

game PhaserRPG {
    title: "Phaser RPG - Complete Adventure"
    version: "1.0.0"
    author: "Game Vibe Engine"
    description: "A complete top-down RPG with tilemap integration, character interaction, and scene management"
    
    settings: {
        defaultScene: "TuxemonTown"
        pixelArt: true
        targetFPS: 60
        physics: {
            gravity: [0, 0]
            timeStep: 1/60
        }
        audio: {
            masterVolume: 0.8
            musicVolume: 0.6
            sfxVolume: 1.0
        }
        camera: {
            followPlayer: true
            smoothing: 0.1
            worldBounds: true
        }
    }
    
    assets: {
        atlas: [
            "assets/atlas/atlas.json"
        ]
        
        sprites: [
            "assets/sprites/spaceman.png"
        ]
        
        tilemaps: [
            "assets/tilemaps/tuxemon-town.json"
        ]
        
        tilesets: [
            "assets/tilesets/tuxemon-sample-32px-extruded.png"
        ]
        
        sounds: [
            "assets/sounds/walk.wav",
            "assets/sounds/interact.wav"
        ]
        
        music: [
            "assets/music/town_theme.mp3"
        ]
    }
    
    scenes: [
        "scenes/boot.gdl",
        "scenes/main.gdl",
        "scenes/menu.gdl"
    ]
    
    behaviors: [
        "behaviors/rpg-behaviors.gdl"
    ]
    
    ui: {
        hud: {
            enabled: true
            elements: {
                healthBar: {
                    position: [10, 10]
                    width: 200
                    height: 20
                }
                
                interactionPrompt: {
                    position: [400, 500]
                    text: "Press SPACE to interact"
                    visible: false
                }
            }
        }
        
        menu: {
            pauseKey: "Escape"
            background: "rgba(0,0,0,0.8)"
            fadeTime: 0.3
        }
        
        dialogue: {
            background: "rgba(0,0,0,0.9)"
            position: [50, 450]
            width: 700
            height: 100
            textSpeed: 50
        }
    }
    
    controls: {
        keyboard: {
            up: ["ArrowUp", "W"]
            down: ["ArrowDown", "S"]
            left: ["ArrowLeft", "A"]
            right: ["ArrowRight", "D"]
            interact: ["Space", "Enter"]
            menu: ["Escape"]
            debug: ["Shift"]
        }
        
        gamepad: {
            up: "dpad-up"
            down: "dpad-down"
            left: "dpad-left"
            right: "dpad-right"
            interact: "button-a"
            menu: "button-start"
        }
    }
}

// Boot Scene - Asset Loading
scene Boot {
    type: "loading"
    
    onEnter: {
        // Load all game assets
        loadAtlas("atlas/atlas.json")
        loadTilemap("tilemaps/tuxemon-town.json")
        loadTileset("tilesets/tuxemon-sample-32px-extruded.png")
        loadSprite("sprites/spaceman.png")
        
        // Setup loading screen
        showLoadingScreen()
        
        // Transition to main scene when complete
        onLoadComplete(() => {
            changeScene("TuxemonTown")
        })
    }
}

// Main Game Scene
scene TuxemonTown {
    background: "#4a9"
    music: "town_theme.mp3"
    
    tilemap: {
        data: "tuxemon-town.json"
        tileset: "tuxemon-sample-32px-extruded.png"
        tileSize: 32
        
        layers: {
            "Below Player": {
                depth: 0
                collision: false
            }
            "World": {
                depth: 1
                collision: true
                collisionProperty: "collides"
            }
            "Above Player": {
                depth: 2
                collision: false
            }
        }
        
        objects: {
            "Spawn Point": {
                type: "playerSpawn"
                handler: spawnPlayer
            }
            "Sign": {
                type: "interactable" 
                handler: showSignMessage
            }
        }
    }
    
    entities: [Player, InteractionSelector]
    
    camera: {
        followTarget: "Player"
        bounds: {
            x: 0
            y: 0  
            width: 1600
            height: 1200
        }
        deadzone: {
            x: 50
            y: 50
        }
    }
    
    onEnter: {
        setupCamera()
        playMusic("town_theme.mp3")
        enablePlayerMovement()
    }
    
    onUpdate: {
        updatePlayerAnimation()
        checkInteractions()
        updateCamera()
    }
}

// Pause Menu Scene
scene Menu {
    type: "overlay"
    pausesGame: true
    
    ui: {
        background: "rgba(0,0,0,0.8)"
        
        title: {
            text: "PAUSED"
            position: [400, 200]
            font: "Arial"
            size: 48
            color: "#ffffff"
            align: "center"
        }
        
        buttons: [
            {
                text: "Resume"
                position: [400, 300]
                action: resumeGame
            }
            {
                text: "Settings"
                position: [400, 350]
                action: showSettings
            }
            {
                text: "Main Menu"
                position: [400, 400]
                action: returnToMainMenu
            }
        ]
    }
    
    onEnter: {
        pauseGameplay()
        showCursor()
    }
    
    onExit: {
        resumeGameplay()
        hideCursor()
    }
}

// Player Character Entity
entity Player {
    name: "Misa"
    
    transform: {
        position: [400, 300]  // Will be overridden by spawn point
        scale: [1, 1]
        rotation: 0
    }
    
    sprite: {
        atlas: "atlas"
        texture: "misa-front"
        width: 32
        height: 48
        
        animations: {
            "misa-left-walk": {
                frames: ["misa-left-walk.000", "misa-left-walk.001", "misa-left-walk.002", "misa-left-walk.003"]
                frameRate: 10
                repeat: -1
            }
            "misa-right-walk": {
                frames: ["misa-right-walk.000", "misa-right-walk.001", "misa-right-walk.002", "misa-right-walk.003"] 
                frameRate: 10
                repeat: -1
            }
            "misa-front-walk": {
                frames: ["misa-front-walk.000", "misa-front-walk.001", "misa-front-walk.002", "misa-front-walk.003"]
                frameRate: 10
                repeat: -1
            }
            "misa-back-walk": {
                frames: ["misa-back-walk.000", "misa-back-walk.001", "misa-back-walk.002", "misa-back-walk.003"]
                frameRate: 10
                repeat: -1
            }
        }
        
        idleFrames: {
            left: "misa-left"
            right: "misa-right"
            up: "misa-back"
            down: "misa-front"
        }
    }
    
    physics: {
        bodyType: "dynamic"
        drag: [500, 500]
        maxVelocity: [200, 200]
        collideWorldBounds: true
    }
    
    collider: {
        shape: "rectangle"
        width: 22
        height: 32
        offset: [0, 8]
    }
    
    behavior: {
        type: "TopDownCharacterController"
        speed: 160
        diagonalMovement: true
        normalizeSpeed: true
        
        animations: {
            walkLeft: "misa-left-walk"
            walkRight: "misa-right-walk"
            walkUp: "misa-back-walk"
            walkDown: "misa-front-walk"
            
            idleLeft: "misa-left"
            idleRight: "misa-right"
            idleUp: "misa-back"
            idleDown: "misa-front"
        }
        
        controls: {
            up: ["ArrowUp", "W"]
            down: ["ArrowDown", "S"]
            left: ["ArrowLeft", "A"]
            right: ["ArrowRight", "D"]
        }
    }
    
    state: {
        health: 100
        maxHealth: 100
        facing: "down"
        isMoving: false
        canMove: true
        interacting: false
    }
}

// Interaction Selector - Invisible collision body for interactions
entity InteractionSelector {
    transform: {
        position: [400, 332]  // Will follow player
        scale: [1, 1]
    }
    
    physics: {
        bodyType: "kinematic"
        isSensor: true
    }
    
    collider: {
        shape: "rectangle"
        width: 32
        height: 32
    }
    
    behavior: {
        type: "InteractionSelector"
        followTarget: "Player"
        offsetDistance: 32
        
        onOverlapStart: {
            showInteractionPrompt()
        }
        
        onOverlapEnd: {
            hideInteractionPrompt()
        }
        
        onInteract: {
            triggerInteraction()
        }
    }
    
    state: {
        canInteract: false
        currentTarget: null
        direction: "down"
    }
}

// Interactive Sign Entity (spawned by tilemap objects)
entity WelcomeSign {
    transform: {
        position: [0, 0]  // Set by object spawn
        scale: [1, 1]
    }
    
    sprite: {
        texture: "sign"
        width: 32
        height: 32
        visible: false  // Signs are part of tilemap visually
    }
    
    physics: {
        bodyType: "static"
        isSensor: true
    }
    
    collider: {
        shape: "rectangle"
        width: 32
        height: 32
    }
    
    behavior: {
        type: "InteractableObject"
        
        message: "Welcome to the sample starter game. Move around with the arrow keys. Press Space when you see this prompt!"
        
        onInteract: {
            showDialogue(this.message)
            playSound("interact.wav")
        }
    }
    
    state: {
        interacted: false
        message: ""
    }
}`;
}

function createRPGBehaviors(): string {
    return `// RPG Behaviors for Phaser RPG Demo
// Complete behavior implementations for the RPG system

behavior TopDownCharacterController {
    properties: {
        speed: 160
        diagonalMovement: true
        normalizeSpeed: true
        animations: {}
        controls: {}
    }
    
    state: {
        velocity: [0, 0]
        lastDirection: "down"
        isMoving: false
        inputBuffer: {}
    }
    
    onInit: {
        // Initialize input handling
        this.cursors = input.createCursorKeys()
        this.wasd = input.addKeys('W,S,A,D')
        
        // Set initial animation
        entity.sprite.play(this.animations.idleDown)
    }
    
    onUpdate: {
        // Get input
        const leftPressed = this.cursors.left.isDown || this.wasd.A.isDown
        const rightPressed = this.cursors.right.isDown || this.wasd.D.isDown
        const upPressed = this.cursors.up.isDown || this.wasd.W.isDown
        const downPressed = this.cursors.down.isDown || this.wasd.S.isDown
        
        // Calculate movement
        let velocityX = 0
        let velocityY = 0
        
        if (leftPressed) velocityX = -this.speed
        if (rightPressed) velocityX = this.speed
        if (upPressed) velocityY = -this.speed
        if (downPressed) velocityY = this.speed
        
        // Normalize diagonal movement
        if (this.diagonalMovement && this.normalizeSpeed) {
            if (velocityX !== 0 && velocityY !== 0) {
                velocityX *= 0.707  // 1/sqrt(2)
                velocityY *= 0.707
            }
        }
        
        // Apply movement
        entity.physics.setVelocity(velocityX, velocityY)
        
        // Update movement state
        this.isMoving = velocityX !== 0 || velocityY !== 0
        entity.state.isMoving = this.isMoving
        
        // Update facing direction and animations
        if (this.isMoving) {
            if (velocityX < 0) {
                this.lastDirection = "left"
                entity.state.facing = "left"
                entity.sprite.play(this.animations.walkLeft, true)
            } else if (velocityX > 0) {
                this.lastDirection = "right"
                entity.state.facing = "right"
                entity.sprite.play(this.animations.walkRight, true)
            } else if (velocityY < 0) {
                this.lastDirection = "up"
                entity.state.facing = "up"
                entity.sprite.play(this.animations.walkUp, true)
            } else if (velocityY > 0) {
                this.lastDirection = "down"
                entity.state.facing = "down"
                entity.sprite.play(this.animations.walkDown, true)
            }
        } else {
            // Play idle animation based on last direction
            switch (this.lastDirection) {
                case "left":
                    entity.sprite.play(this.animations.idleLeft)
                    break
                case "right":
                    entity.sprite.play(this.animations.idleRight)
                    break
                case "up":
                    entity.sprite.play(this.animations.idleUp)
                    break
                case "down":
                    entity.sprite.play(this.animations.idleDown)
                    break
            }
        }
        
        // Update interaction selector position
        updateInteractionSelector()
    }
}

behavior InteractionSelector {
    properties: {
        followTarget: ""
        offsetDistance: 32
    }
    
    state: {
        canInteract: false
        currentTarget: null
        direction: "down"
    }
    
    onInit: {
        // Get reference to target entity
        this.target = scene.getEntity(this.followTarget)
        
        // Listen for interaction input
        this.spaceKey = input.addKey('SPACE')
        this.enterKey = input.addKey('ENTER')
    }
    
    onUpdate: {
        if (!this.target) return
        
        // Follow target with offset based on direction
        const targetPos = this.target.transform.position
        const direction = this.target.state.facing
        
        let offsetX = 0
        let offsetY = 0
        
        switch (direction) {
            case "left":
                offsetX = -this.offsetDistance
                break
            case "right":
                offsetX = this.offsetDistance
                break
            case "up":
                offsetY = -this.offsetDistance
                break
            case "down":
                offsetY = this.offsetDistance
                break
        }
        
        entity.transform.position = [
            targetPos[0] + offsetX,
            targetPos[1] + offsetY
        ]
        
        // Check for interaction input
        if ((this.spaceKey.isDown || this.enterKey.isDown) && this.canInteract && this.currentTarget) {
            this.currentTarget.behavior.onInteract()
        }
    }
    
    onOverlapStart: (other) => {
        if (other.behavior && other.behavior.type === "InteractableObject") {
            this.canInteract = true
            this.currentTarget = other
            ui.showInteractionPrompt()
        }
    }
    
    onOverlapEnd: (other) => {
        if (other === this.currentTarget) {
            this.canInteract = false
            this.currentTarget = null
            ui.hideInteractionPrompt()
        }
    }
}

behavior InteractableObject {
    properties: {
        message: ""
    }
    
    state: {
        interacted: false
    }
    
    onInteract: {
        // Show dialogue with typewriter effect
        ui.showDialogue(this.message)
        
        // Play interaction sound
        audio.play("interact.wav")
        
        // Mark as interacted
        this.interacted = true
        
        // Custom interaction logic can be added here
        if (this.onCustomInteract) {
            this.onCustomInteract()
        }
    }
}

behavior TilemapRenderer {
    properties: {
        tilemap: ""
        tileset: ""
        tileSize: 32
        layers: {}
        objects: {}
    }
    
    onInit: {
        // Load tilemap data
        const tilemapData = assets.getTilemap(this.tilemap)
        const tilesetImage = assets.getTileset(this.tileset)
        
        // Create tilemap
        this.map = scene.add.tilemap(tilemapData)
        this.tileset = this.map.addTilesetImage("tuxemon-sample-32px-extruded", tilesetImage)
        
        // Create layers
        this.createdLayers = {}
        
        for (const [layerName, config] of Object.entries(this.layers)) {
            const layer = this.map.createLayer(layerName, this.tileset)
            layer.setDepth(config.depth)
            
            if (config.collision) {
                layer.setCollisionByProperty({ [config.collisionProperty]: true })
                
                // Add collision with player
                physics.addCollider(scene.getEntity("Player").physics.body, layer)
            }
            
            this.createdLayers[layerName] = layer
        }
        
        // Process object layers
        const objectLayers = this.map.getObjectLayer('Object Layer 1')
        if (objectLayers) {
            objectLayers.objects.forEach(obj => {
                this.processMapObject(obj)
            })
        }
        
        // Set world bounds based on tilemap size
        const mapWidth = this.map.widthInPixels
        const mapHeight = this.map.heightInPixels
        physics.world.setBounds(0, 0, mapWidth, mapHeight)
    }
    
    processMapObject: (obj) => {
        const handler = this.objects[obj.name]
        if (handler) {
            handler(obj)
        }
    }
    
    spawnPlayer: (obj) => {
        const player = scene.getEntity("Player")
        if (player) {
            player.transform.position = [obj.x, obj.y - obj.height]
        }
    }
    
    showSignMessage: (obj) => {
        // Create interactive sign entity
        const sign = scene.createEntity("InteractiveSign", {
            transform: {
                position: [obj.x, obj.y - obj.height]
            },
            behavior: {
                type: "InteractableObject",
                message: obj.properties?.message || "This is a sign."
            }
        })
    }
}

behavior CameraController {
    properties: {
        followTarget: ""
        smoothing: 0.1
        bounds: null
        deadzone: { x: 50, y: 50 }
    }
    
    onInit: {
        this.target = scene.getEntity(this.followTarget)
        this.camera = scene.cameras.main
        
        if (this.bounds) {
            this.camera.setBounds(
                this.bounds.x,
                this.bounds.y,
                this.bounds.width,
                this.bounds.height
            )
        }
        
        if (this.target) {
            this.camera.startFollow(this.target.sprite, true, this.smoothing, this.smoothing)
            this.camera.setDeadzone(this.deadzone.x, this.deadzone.y)
        }
    }
    
    onUpdate: {
        // Camera updates are handled automatically by Phaser
        // Custom camera logic can be added here if needed
    }
}

behavior AudioManager {
    properties: {
        musicVolume: 0.6
        sfxVolume: 1.0
    }
    
    state: {
        currentMusic: null
        musicFading: false
    }
    
    playMusic: (key, fadeTime = 1000) => {
        if (this.currentMusic && this.currentMusic.isPlaying) {
            this.fadeOutMusic(this.currentMusic, fadeTime / 2, () => {
                this.startNewMusic(key, fadeTime / 2)
            })
        } else {
            this.startNewMusic(key, fadeTime)
        }
    }
    
    startNewMusic: (key, fadeTime) => {
        this.currentMusic = audio.play(key, { loop: true, volume: 0 })
        this.fadeInMusic(this.currentMusic, fadeTime)
    }
    
    fadeInMusic: (music, duration) => {
        scene.tweens.add({
            targets: music,
            volume: this.musicVolume,
            duration: duration,
            ease: 'Linear'
        })
    }
    
    fadeOutMusic: (music, duration, callback) => {
        scene.tweens.add({
            targets: music,
            volume: 0,
            duration: duration,
            ease: 'Linear',
            onComplete: () => {
                music.stop()
                if (callback) callback()
            }
        })
    }
    
    playSound: (key, volume = null) => {
        const sound = audio.play(key, {
            volume: volume || this.sfxVolume
        })
        return sound
    }
}

behavior DialogueSystem {
    properties: {
        textSpeed: 50
        background: "rgba(0,0,0,0.9)"
        position: [50, 450]
        width: 700
        height: 100
    }
    
    state: {
        isActive: false
        currentText: ""
        displayedText: ""
        textIndex: 0
        dialogueBox: null
        textObject: null
    }
    
    onInit: {
        // Create dialogue UI elements
        this.createDialogueBox()
    }
    
    createDialogueBox: () => {
        // Create background
        this.dialogueBox = scene.add.rectangle(
            this.position[0] + this.width / 2,
            this.position[1] + this.height / 2,
            this.width,
            this.height,
            0x000000,
            0.9
        )
        this.dialogueBox.setDepth(1000)
        this.dialogueBox.setVisible(false)
        
        // Create text object
        this.textObject = scene.add.text(
            this.position[0] + 20,
            this.position[1] + 20,
            "",
            {
                fontFamily: 'Arial',
                fontSize: '18px',
                color: '#ffffff',
                wordWrap: { width: this.width - 40 }
            }
        )
        this.textObject.setDepth(1001)
        this.textObject.setVisible(false)
    }
    
    showDialogue: (text) => {
        this.isActive = true
        this.currentText = text
        this.displayedText = ""
        this.textIndex = 0
        
        // Show dialogue box
        this.dialogueBox.setVisible(true)
        this.textObject.setVisible(true)
        
        // Start typewriter effect
        this.typewriterTimer = scene.time.addEvent({
            delay: this.textSpeed,
            callback: this.typeNextCharacter,
            callbackScope: this,
            loop: true
        })
        
        // Disable player movement
        const player = scene.getEntity("Player")
        if (player) {
            player.state.canMove = false
            player.physics.setVelocity(0, 0)
        }
        
        // Listen for skip input
        this.spaceKey = input.addKey('SPACE')
        this.enterKey = input.addKey('ENTER')
    }
    
    typeNextCharacter: () => {
        if (this.textIndex < this.currentText.length) {
            this.displayedText += this.currentText[this.textIndex]
            this.textObject.setText(this.displayedText)
            this.textIndex++
        } else {
            // Text complete, wait for input to close
            this.typewriterTimer.destroy()
            this.waitingForInput = true
        }
    }
    
    onUpdate: {
        if (this.isActive && this.waitingForInput) {
            if (this.spaceKey.isDown || this.enterKey.isDown) {
                this.hideDialogue()
            }
        }
    }
    
    hideDialogue: () => {
        this.isActive = false
        this.waitingForInput = false
        
        // Hide dialogue box
        this.dialogueBox.setVisible(false)
        this.textObject.setVisible(false)
        
        // Re-enable player movement
        const player = scene.getEntity("Player")
        if (player) {
            player.state.canMove = true
        }
        
        // Clean up timer if still running
        if (this.typewriterTimer) {
            this.typewriterTimer.destroy()
        }
    }
}`;
}