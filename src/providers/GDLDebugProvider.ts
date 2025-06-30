import * as vscode from 'vscode';
import { GDLCompiler } from '../engine';

export class GDLDebugProvider {
    private outputChannel: vscode.OutputChannel;
    private diagnostics: vscode.DiagnosticCollection;
    private compiler: GDLCompiler;

    constructor(compiler: GDLCompiler) {
        this.compiler = compiler;
        this.outputChannel = vscode.window.createOutputChannel('Game Vibe Debug');
        this.diagnostics = vscode.languages.createDiagnosticCollection('gdl-debug');
        
        this.setupEventListeners();
        this.registerCommands();
    }

    private setupEventListeners(): void {
        // Watch for GDL file changes to provide real-time debugging
        vscode.workspace.onDidSaveTextDocument(async (document) => {
            if (document.languageId === 'gdl') {
                await this.validateAndDebugFile(document);
            }
        });

        vscode.workspace.onDidOpenTextDocument(async (document) => {
            if (document.languageId === 'gdl') {
                await this.validateAndDebugFile(document);
            }
        });
    }

    private registerCommands(): void {
        vscode.commands.registerCommand('gameVibe.debugGDL', async () => {
            const activeEditor = vscode.window.activeTextEditor;
            if (activeEditor && activeEditor.document.languageId === 'gdl') {
                await this.debugCurrentFile(activeEditor.document);
            } else {
                vscode.window.showErrorMessage('No active GDL file to debug');
            }
        });

        vscode.commands.registerCommand('gameVibe.showDebugOutput', () => {
            this.outputChannel.show();
        });

        vscode.commands.registerCommand('gameVibe.clearDebugOutput', () => {
            this.outputChannel.clear();
        });

        vscode.commands.registerCommand('gameVibe.validateAllGDL', async () => {
            await this.validateAllGDLFiles();
        });

        vscode.commands.registerCommand('gameVibe.showCompilerAST', async () => {
            await this.showCompilerAST();
        });
    }

    private async validateAndDebugFile(document: vscode.TextDocument): Promise<void> {
        try {
            const diagnostics: vscode.Diagnostic[] = [];
            const content = document.getText();
            
            this.log(`Validating ${document.fileName}...`);

            // Lexical analysis
            const lexResult = this.performLexicalAnalysis(content, document);
            diagnostics.push(...lexResult.diagnostics);

            // Syntax analysis
            if (lexResult.tokens) {
                const parseResult = this.performSyntaxAnalysis(content, document);
                diagnostics.push(...parseResult.diagnostics);

                // Semantic analysis
                if (parseResult.ast) {
                    const semanticResult = this.performSemanticAnalysis(parseResult.ast, document);
                    diagnostics.push(...semanticResult.diagnostics);
                }
            }

            // Update diagnostics
            this.diagnostics.set(document.uri, diagnostics);

            // Log summary
            const errorCount = diagnostics.filter(d => d.severity === vscode.DiagnosticSeverity.Error).length;
            const warningCount = diagnostics.filter(d => d.severity === vscode.DiagnosticSeverity.Warning).length;
            
            if (errorCount === 0 && warningCount === 0) {
                this.log(`✅ ${document.fileName} - No issues found`);
            } else {
                this.log(`❌ ${document.fileName} - ${errorCount} errors, ${warningCount} warnings`);
            }

        } catch (error) {
            this.logError(`Error validating ${document.fileName}: ${error}`);
        }
    }

    private performLexicalAnalysis(content: string, document: vscode.TextDocument): {
        tokens?: any[];
        diagnostics: vscode.Diagnostic[];
    } {
        const diagnostics: vscode.Diagnostic[] = [];
        
        try {
            // Basic lexical validation
            const lines = content.split('\n');
            
            for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
                const line = lines[lineIndex];
                const trimmed = line.trim();
                
                if (trimmed === '' || trimmed.startsWith('//') || trimmed.startsWith('/*')) {
                    continue;
                }

                // Check for unmatched brackets
                const openBrackets = (line.match(/\{/g) || []).length;
                const closeBrackets = (line.match(/\}/g) || []).length;
                
                // Check for invalid characters
                const invalidChars = line.match(/[^\w\s\{\}:;.,"\'\[\]\-\+\*\/\(\)=<>!&|%#]/g);
                if (invalidChars) {
                    const range = new vscode.Range(lineIndex, 0, lineIndex, line.length);
                    diagnostics.push(new vscode.Diagnostic(
                        range,
                        `Invalid characters found: ${invalidChars.join(', ')}`,
                        vscode.DiagnosticSeverity.Error
                    ));
                }

                // Check for malformed property syntax
                if (trimmed.includes(':') && !trimmed.match(/^\s*\w+\s*:\s*/) && !trimmed.includes('{')) {
                    const range = new vscode.Range(lineIndex, 0, lineIndex, line.length);
                    diagnostics.push(new vscode.Diagnostic(
                        range,
                        'Malformed property syntax. Expected: property: value',
                        vscode.DiagnosticSeverity.Error
                    ));
                }
            }

            // Check overall bracket balance
            const totalOpen = (content.match(/\{/g) || []).length;
            const totalClose = (content.match(/\}/g) || []).length;
            
            if (totalOpen !== totalClose) {
                const range = new vscode.Range(0, 0, lines.length - 1, lines[lines.length - 1].length);
                diagnostics.push(new vscode.Diagnostic(
                    range,
                    `Unmatched brackets: ${totalOpen} opening, ${totalClose} closing`,
                    vscode.DiagnosticSeverity.Error
                ));
            }

            return { tokens: [], diagnostics };

        } catch (error) {
            const range = new vscode.Range(0, 0, 0, 0);
            diagnostics.push(new vscode.Diagnostic(
                range,
                `Lexical analysis error: ${error}`,
                vscode.DiagnosticSeverity.Error
            ));
            return { diagnostics };
        }
    }

    private performSyntaxAnalysis(content: string, document: vscode.TextDocument): {
        ast?: any;
        diagnostics: vscode.Diagnostic[];
    } {
        const diagnostics: vscode.Diagnostic[] = [];
        
        try {
            const lines = content.split('\n');
            let inScene = false;
            let inEntity = false;
            let braceLevel = 0;
            let sceneCount = 0;
            
            for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
                const line = lines[lineIndex].trim();
                const range = new vscode.Range(lineIndex, 0, lineIndex, lines[lineIndex].length);
                
                if (line === '' || line.startsWith('//') || line.startsWith('/*')) {
                    continue;
                }

                // Track context
                if (line.startsWith('scene ')) {
                    inScene = true;
                    inEntity = false;
                    sceneCount++;
                    
                    // Validate scene syntax
                    if (!line.match(/^scene\s+\w+\s*\{?$/)) {
                        diagnostics.push(new vscode.Diagnostic(
                            range,
                            'Invalid scene syntax. Expected: scene SceneName {',
                            vscode.DiagnosticSeverity.Error
                        ));
                    }
                } else if (line.startsWith('entity ')) {
                    if (!inScene) {
                        diagnostics.push(new vscode.Diagnostic(
                            range,
                            'Entities must be defined inside a scene',
                            vscode.DiagnosticSeverity.Error
                        ));
                    }
                    inEntity = true;
                    
                    // Validate entity syntax
                    if (!line.match(/^entity\s+\w+\s*\{?$/)) {
                        diagnostics.push(new vscode.Diagnostic(
                            range,
                            'Invalid entity syntax. Expected: entity EntityName {',
                            vscode.DiagnosticSeverity.Error
                        ));
                    }
                }

                // Track braces
                if (line.includes('{')) braceLevel++;
                if (line.includes('}')) {
                    braceLevel--;
                    if (braceLevel === 1) inEntity = false;
                    if (braceLevel === 0) inScene = false;
                }

                // Validate component usage
                const components = ['transform', 'sprite', 'physics', 'collider', 'behavior'];
                const componentMatch = components.find(comp => line.startsWith(comp + ':'));
                
                if (componentMatch && !inEntity) {
                    diagnostics.push(new vscode.Diagnostic(
                        range,
                        `Component '${componentMatch}' can only be used inside entities`,
                        vscode.DiagnosticSeverity.Error
                    ));
                }

                // Validate required properties
                if (inEntity && line.startsWith('sprite:') && braceLevel > 1) {
                    const nextLines = lines.slice(lineIndex + 1, lineIndex + 10);
                    const hasTexture = nextLines.some(l => l.trim().startsWith('texture:'));
                    
                    if (!hasTexture) {
                        diagnostics.push(new vscode.Diagnostic(
                            range,
                            'Sprite component requires a texture property',
                            vscode.DiagnosticSeverity.Warning
                        ));
                    }
                }
            }

            if (sceneCount === 0) {
                const range = new vscode.Range(0, 0, 0, 0);
                diagnostics.push(new vscode.Diagnostic(
                    range,
                    'GDL file must contain at least one scene',
                    vscode.DiagnosticSeverity.Warning
                ));
            }

            return { ast: {}, diagnostics };

        } catch (error) {
            const range = new vscode.Range(0, 0, 0, 0);
            diagnostics.push(new vscode.Diagnostic(
                range,
                `Syntax analysis error: ${error}`,
                vscode.DiagnosticSeverity.Error
            ));
            return { diagnostics };
        }
    }

    private performSemanticAnalysis(ast: any, document: vscode.TextDocument): {
        diagnostics: vscode.Diagnostic[];
    } {
        const diagnostics: vscode.Diagnostic[] = [];
        const content = document.getText();
        const lines = content.split('\n');
        
        try {
            // Check for asset references
            const textureReferences = content.matchAll(/texture:\s*["']([^"']+)["']/g);
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
            
            if (workspaceFolder) {
                for (const match of textureReferences) {
                    const texturePath = match[1];
                    const lineIndex = lines.findIndex(line => line.includes(match[0]));
                    
                    if (lineIndex >= 0) {
                        const range = new vscode.Range(lineIndex, 0, lineIndex, lines[lineIndex].length);
                        
                        // Check if asset exists
                        const assetPath = vscode.Uri.joinPath(workspaceFolder.uri, 'assets', 'images', texturePath);
                        
                        vscode.workspace.fs.stat(assetPath).then(
                            () => {}, // File exists
                            () => {
                                diagnostics.push(new vscode.Diagnostic(
                                    range,
                                    `Asset not found: ${texturePath}`,
                                    vscode.DiagnosticSeverity.Warning
                                ));
                            }
                        );
                    }
                }
            }

            // Check for duplicate entity names within scenes
            const entityNames = new Map<string, number[]>();
            let currentScene = '';
            
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i].trim();
                
                if (line.startsWith('scene ')) {
                    currentScene = line.match(/scene\s+(\w+)/)?.[1] || '';
                    entityNames.clear();
                } else if (line.startsWith('entity ')) {
                    const entityName = line.match(/entity\s+(\w+)/)?.[1];
                    if (entityName) {
                        const existing = entityNames.get(entityName) || [];
                        existing.push(i);
                        entityNames.set(entityName, existing);
                        
                        if (existing.length > 1) {
                            const range = new vscode.Range(i, 0, i, lines[i].length);
                            diagnostics.push(new vscode.Diagnostic(
                                range,
                                `Duplicate entity name '${entityName}' in scene '${currentScene}'`,
                                vscode.DiagnosticSeverity.Error
                            ));
                        }
                    }
                }
            }

            return { diagnostics };

        } catch (error) {
            const range = new vscode.Range(0, 0, 0, 0);
            diagnostics.push(new vscode.Diagnostic(
                range,
                `Semantic analysis error: ${error}`,
                vscode.DiagnosticSeverity.Error
            ));
            return { diagnostics };
        }
    }

    private async debugCurrentFile(document: vscode.TextDocument): Promise<void> {
        this.outputChannel.show();
        this.log(`\n=== Debugging ${document.fileName} ===`);
        
        await this.validateAndDebugFile(document);
        
        // Try to compile
        try {
            const content = document.getText();
            this.log('\n--- Compilation Attempt ---');
            
            // This would use the actual compiler
            // const result = await this.compiler.compile(content);
            this.log('✅ Compilation would proceed (full compiler integration pending)');
            
        } catch (error) {
            this.logError(`Compilation failed: ${error}`);
        }
    }

    private async validateAllGDLFiles(): Promise<void> {
        const gdlFiles = await vscode.workspace.findFiles('**/*.gdl');
        
        this.outputChannel.show();
        this.log(`\n=== Validating ${gdlFiles.length} GDL files ===`);
        
        let totalErrors = 0;
        let totalWarnings = 0;
        
        for (const file of gdlFiles) {
            const document = await vscode.workspace.openTextDocument(file);
            await this.validateAndDebugFile(document);
            
            const diagnostics = this.diagnostics.get(file) || [];
            totalErrors += diagnostics.filter(d => d.severity === vscode.DiagnosticSeverity.Error).length;
            totalWarnings += diagnostics.filter(d => d.severity === vscode.DiagnosticSeverity.Warning).length;
        }
        
        this.log(`\n=== Summary ===`);
        this.log(`Total errors: ${totalErrors}`);
        this.log(`Total warnings: ${totalWarnings}`);
        
        if (totalErrors === 0 && totalWarnings === 0) {
            vscode.window.showInformationMessage('All GDL files are valid!');
        } else {
            vscode.window.showWarningMessage(`Found ${totalErrors} errors and ${totalWarnings} warnings`);
        }
    }

    private async showCompilerAST(): Promise<void> {
        const activeEditor = vscode.window.activeTextEditor;
        if (!activeEditor || activeEditor.document.languageId !== 'gdl') {
            vscode.window.showErrorMessage('No active GDL file');
            return;
        }

        const content = activeEditor.document.getText();
        
        try {
            // This would show the actual AST from the compiler
            const ast = {
                type: 'Program',
                scenes: [
                    {
                        type: 'Scene',
                        name: 'Example',
                        properties: {},
                        entities: []
                    }
                ]
            };
            
            const astContent = JSON.stringify(ast, null, 2);
            
            const doc = await vscode.workspace.openTextDocument({
                content: astContent,
                language: 'json'
            });
            
            await vscode.window.showTextDocument(doc, vscode.ViewColumn.Beside);
            
        } catch (error) {
            this.logError(`Failed to generate AST: ${error}`);
        }
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
        this.diagnostics.dispose();
    }
}