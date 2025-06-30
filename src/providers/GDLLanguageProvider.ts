import * as vscode from 'vscode';

interface GDLCompletionData {
    keywords: string[];
    components: string[];
    behaviors: string[];
    physicsModesValues: string[];
    colliderTypes: string[];
    sceneProperties: string[];
    transformProperties: string[];
    spriteProperties: string[];
    physicsProperties: string[];
    colliderProperties: string[];
    behaviorProperties: string[];
}

export class GDLLanguageProvider implements 
    vscode.CompletionItemProvider,
    vscode.HoverProvider,
    vscode.DocumentFormattingEditProvider {

    private gdlData: GDLCompletionData = {
        keywords: ['scene', 'entity', 'spawn', 'event', 'on', 'when', 'if', 'else'],
        components: ['transform', 'sprite', 'physics', 'collider', 'behavior', 'particle', 'animation', 'audio', 'input'],
        behaviors: [
            'PlatformerMovement', 'TopDownMovement', 'FollowBehavior', 'PatrolBehavior',
            'ChaseBehavior', 'ClickBehavior', 'DragBehavior', 'AnimationBehavior',
            'FadeBehavior', 'FlashBehavior', 'BounceBehavior', 'OrbitBehavior', 'WanderBehavior'
        ],
        physicsModesValues: ['static', 'dynamic', 'kinematic', 'platformer', 'topdown'],
        colliderTypes: ['box', 'circle', 'polygon'],
        sceneProperties: ['size', 'gravity', 'background', 'pixelArt', 'camera'],
        transformProperties: ['x', 'y', 'z', 'scale', 'rotation'],
        spriteProperties: ['texture', 'width', 'height', 'tint', 'alpha', 'visible', 'layer'],
        physicsProperties: ['mode', 'mass', 'friction', 'restitution', 'gravityScale', 'fixedRotation'],
        colliderProperties: ['type', 'width', 'height', 'radius', 'isSensor', 'category', 'mask'],
        behaviorProperties: ['speed', 'jumpPower', 'target', 'points', 'range', 'duration', 'health', 'damage']
    };

    private diagnostics = vscode.languages.createDiagnosticCollection('gdl');

    constructor() {
        // Register for document change events to provide real-time validation
        vscode.workspace.onDidChangeTextDocument(this.onDocumentChange, this);
        vscode.workspace.onDidCloseTextDocument(this.onDocumentClose, this);
    }

    // Completion Provider
    provideCompletionItems(
        document: vscode.TextDocument,
        position: vscode.Position,
        _token: vscode.CancellationToken,
        _context: vscode.CompletionContext
    ): vscode.ProviderResult<vscode.CompletionItem[] | vscode.CompletionList> {
        const line = document.lineAt(position).text;
        const linePrefix = line.substring(0, position.character);
        const lineContext = this.getLineContext(document, position);

        const completions: vscode.CompletionItem[] = [];

        // Context-aware completions
        if (lineContext.inScene) {
            if (linePrefix.match(/^\s*$/)) {
                // Beginning of line in scene - suggest scene properties or entities
                completions.push(
                    ...this.createCompletionItems(this.gdlData.sceneProperties, vscode.CompletionItemKind.Property, 'Scene property'),
                    ...this.createCompletionItems(['entity'], vscode.CompletionItemKind.Keyword, 'Create an entity')
                );
            } else if (linePrefix.includes(':')) {
                // After property name - suggest values
                if (linePrefix.includes('size:')) {
                    completions.push(this.createSnippetCompletion('[800, 600]', 'Array with width and height'));
                } else if (linePrefix.includes('gravity:')) {
                    completions.push(this.createSnippetCompletion('[0, 800]', 'Gravity vector [x, y]'));
                } else if (linePrefix.includes('pixelArt:')) {
                    completions.push(
                        ...this.createCompletionItems(['true', 'false'], vscode.CompletionItemKind.Value, 'Boolean value')
                    );
                }
            }
        } else if (lineContext.inEntity) {
            if (linePrefix.match(/^\s*$/)) {
                // Beginning of line in entity - suggest components
                completions.push(
                    ...this.createCompletionItems(this.gdlData.components, vscode.CompletionItemKind.Property, 'Entity component')
                );
            } else if (linePrefix.includes(':')) {
                // Component property suggestions
                completions.push(...this.getComponentPropertyCompletions(linePrefix));
            }
        } else {
            // Top level - suggest scene or entity
            if (linePrefix.match(/^\s*$/)) {
                completions.push(
                    ...this.createCompletionItems(['scene', 'entity'], vscode.CompletionItemKind.Keyword, 'Top-level declaration')
                );
            }
        }

        // Behavior completions
        if (linePrefix.includes('behavior:') && !linePrefix.includes('{')) {
            completions.push(
                ...this.createCompletionItems(this.gdlData.behaviors, vscode.CompletionItemKind.Class, 'Behavior type')
            );
        }

        // Physics mode completions
        if (linePrefix.includes('mode:') && lineContext.inPhysics) {
            completions.push(
                ...this.createCompletionItems(this.gdlData.physicsModesValues, vscode.CompletionItemKind.EnumMember, 'Physics mode')
            );
        }

        // Collider type completions
        if (linePrefix.includes('type:') && lineContext.inCollider) {
            completions.push(
                ...this.createCompletionItems(this.gdlData.colliderTypes, vscode.CompletionItemKind.EnumMember, 'Collider type')
            );
        }

        return completions;
    }

    // Hover Provider
    provideHover(
        document: vscode.TextDocument,
        position: vscode.Position,
        _token: vscode.CancellationToken
    ): vscode.ProviderResult<vscode.Hover> {
        const range = document.getWordRangeAtPosition(position);
        if (!range) return;

        const word = document.getText(range);
        const documentation = this.getDocumentation(word);
        
        if (documentation) {
            return new vscode.Hover(documentation, range);
        }
    }

    // Document Formatting Provider
    provideDocumentFormattingEdits(
        document: vscode.TextDocument,
        options: vscode.FormattingOptions,
        _token: vscode.CancellationToken
    ): vscode.ProviderResult<vscode.TextEdit[]> {
        const text = document.getText();
        const formatted = this.formatGDL(text, options);
        
        if (formatted !== text) {
            const fullRange = new vscode.Range(
                document.positionAt(0),
                document.positionAt(text.length)
            );
            return [vscode.TextEdit.replace(fullRange, formatted)];
        }
        
        return [];
    }

    // Diagnostic Provider (Validation)
    provideDiagnostics(document: vscode.TextDocument): vscode.Diagnostic[] {
        const diagnostics: vscode.Diagnostic[] = [];
        const lines = document.getText().split('\n');

        let inScene = false;
        let inEntity = false;
        let braceLevel = 0;

        for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
            const line = lines[lineIndex].trim();
            const range = new vscode.Range(lineIndex, 0, lineIndex, lines[lineIndex].length);

            // Track context
            if (line.startsWith('scene ')) {
                inScene = true;
                inEntity = false;
            } else if (line.startsWith('entity ') && inScene) {
                inEntity = true;
            }

            if (line.includes('{')) braceLevel++;
            if (line.includes('}')) {
                braceLevel--;
                if (braceLevel === 1) inEntity = false;
                if (braceLevel === 0) inScene = false;
            }

            // Validate syntax
            if (line && !line.startsWith('//') && !line.startsWith('/*')) {
                // Check for invalid component usage outside entity
                if (!inEntity && this.gdlData.components.some(comp => line.includes(comp + ':'))) {
                    diagnostics.push(new vscode.Diagnostic(
                        range,
                        'Components can only be defined inside entities',
                        vscode.DiagnosticSeverity.Error
                    ));
                }

                // Check for entity outside scene
                if (line.startsWith('entity ') && !inScene) {
                    diagnostics.push(new vscode.Diagnostic(
                        range,
                        'Entities must be defined inside a scene',
                        vscode.DiagnosticSeverity.Error
                    ));
                }

                // Check for invalid physics modes
                if (line.includes('mode:')) {
                    const match = line.match(/mode:\s*"?(\w+)"?/);
                    if (match && !this.gdlData.physicsModesValues.includes(match[1])) {
                        diagnostics.push(new vscode.Diagnostic(
                            range,
                            `Invalid physics mode "${match[1]}". Valid modes: ${this.gdlData.physicsModesValues.join(', ')}`,
                            vscode.DiagnosticSeverity.Error
                        ));
                    }
                }

                // Check for invalid behavior names
                if (line.includes('behavior:')) {
                    const match = line.match(/behavior:\s*(\w+)/);
                    if (match && !this.gdlData.behaviors.includes(match[1])) {
                        diagnostics.push(new vscode.Diagnostic(
                            range,
                            `Unknown behavior "${match[1]}". Did you mean one of: ${this.gdlData.behaviors.join(', ')}?`,
                            vscode.DiagnosticSeverity.Warning
                        ));
                    }
                }
            }
        }

        return diagnostics;
    }

    // Helper Methods
    private getLineContext(document: vscode.TextDocument, position: vscode.Position) {
        const text = document.getText(new vscode.Range(0, 0, position.line, position.character));
        const lines = text.split('\n');
        
        let inScene = false;
        let inEntity = false;
        let inPhysics = false;
        let inCollider = false;
        let braceLevel = 0;

        for (const line of lines) {
            const trimmed = line.trim();
            
            if (trimmed.startsWith('scene ')) {
                inScene = true;
                inEntity = false;
            } else if (trimmed.startsWith('entity ') && inScene) {
                inEntity = true;
            } else if (trimmed.startsWith('physics:')) {
                inPhysics = true;
            } else if (trimmed.startsWith('collider:')) {
                inCollider = true;
            }

            if (trimmed.includes('{')) braceLevel++;
            if (trimmed.includes('}')) {
                braceLevel--;
                if (braceLevel === 1) {
                    inEntity = false;
                    inPhysics = false;
                    inCollider = false;
                }
                if (braceLevel === 0) {
                    inScene = false;
                }
            }
        }

        return { inScene, inEntity, inPhysics, inCollider };
    }

    private getComponentPropertyCompletions(linePrefix: string): vscode.CompletionItem[] {
        const completions: vscode.CompletionItem[] = [];

        if (linePrefix.includes('transform:')) {
            completions.push(...this.createCompletionItems(this.gdlData.transformProperties, vscode.CompletionItemKind.Property, 'Transform property'));
        } else if (linePrefix.includes('sprite:')) {
            completions.push(...this.createCompletionItems(this.gdlData.spriteProperties, vscode.CompletionItemKind.Property, 'Sprite property'));
        } else if (linePrefix.includes('physics:')) {
            completions.push(...this.createCompletionItems(this.gdlData.physicsProperties, vscode.CompletionItemKind.Property, 'Physics property'));
        } else if (linePrefix.includes('collider:')) {
            completions.push(...this.createCompletionItems(this.gdlData.colliderProperties, vscode.CompletionItemKind.Property, 'Collider property'));
        } else if (linePrefix.includes('behavior:')) {
            completions.push(...this.createCompletionItems(this.gdlData.behaviorProperties, vscode.CompletionItemKind.Property, 'Behavior property'));
        }

        return completions;
    }

    private createCompletionItems(
        items: string[],
        kind: vscode.CompletionItemKind,
        detail?: string
    ): vscode.CompletionItem[] {
        return items.map(item => {
            const completion = new vscode.CompletionItem(item, kind);
            completion.detail = detail;
            completion.documentation = this.getDocumentation(item);
            return completion;
        });
    }

    private createSnippetCompletion(snippet: string, description: string): vscode.CompletionItem {
        const completion = new vscode.CompletionItem(snippet, vscode.CompletionItemKind.Snippet);
        completion.insertText = new vscode.SnippetString(snippet);
        completion.documentation = new vscode.MarkdownString(description);
        return completion;
    }

    private getDocumentation(word: string): vscode.MarkdownString | undefined {
        const docs: { [key: string]: string } = {
            // Keywords
            'scene': 'Defines a game scene containing entities and scene-level properties',
            'entity': 'Defines a game entity with components like transform, sprite, physics, etc.',
            'spawn': 'Creates an instance of an entity at runtime',
            'event': 'Defines an event handler for game interactions',

            // Components
            'transform': 'Position, rotation, and scale component - required for all visible entities',
            'sprite': 'Visual representation component for displaying textures/images',
            'physics': 'Physics simulation component for movement and collision response',
            'collider': 'Collision detection component for triggers and solid bodies',
            'behavior': 'Behavior script component for custom entity logic',
            'particle': 'Particle system component for visual effects',
            'animation': 'Animation component for sprite animations',
            'audio': 'Audio component for sound effects and music',
            'input': 'Input handling component for player control',

            // Behaviors
            'PlatformerMovement': 'Standard platformer movement with running, jumping, and gravity',
            'TopDownMovement': 'Top-down movement in all directions with configurable speed',
            'FollowBehavior': 'Makes entity smoothly follow a target entity or position',
            'PatrolBehavior': 'Makes entity patrol between multiple waypoints in sequence',
            'ChaseBehavior': 'Makes entity chase a target when within detection range',
            'ClickBehavior': 'Responds to mouse clicks with configurable actions',
            'DragBehavior': 'Allows entity to be dragged with mouse input',
            'AnimationBehavior': 'Plays sprite animations based on state changes',
            'FadeBehavior': 'Gradually changes entity opacity over time',
            'FlashBehavior': 'Makes entity flash/blink for visual feedback',
            'BounceBehavior': 'Makes entity bounce around the screen or area',
            'OrbitBehavior': 'Makes entity orbit around a center point',
            'WanderBehavior': 'Random wandering movement within bounds',

            // Physics Modes
            'static': 'Static body - immovable, infinite mass (platforms, walls)',
            'dynamic': 'Dynamic body - full physics simulation with forces',
            'kinematic': 'Kinematic body - script-controlled movement, no forces',
            'platformer': 'Platformer mode - optimized for platform games',
            'topdown': 'Top-down mode - movement with friction, no gravity',

            // Collider Types
            'box': 'Rectangular collision shape defined by width and height',
            'circle': 'Circular collision shape defined by radius',
            'polygon': 'Custom polygon collision shape (advanced)',

            // Properties
            'x': 'X coordinate position in pixels',
            'y': 'Y coordinate position in pixels',
            'z': 'Z coordinate for depth/layering',
            'scale': 'Scale multiplier (1.0 = normal size)',
            'rotation': 'Rotation angle in degrees',
            'texture': 'Path to image file for sprite rendering',
            'width': 'Width in pixels',
            'height': 'Height in pixels',
            'tint': 'Color tint applied to sprite (hex color)',
            'alpha': 'Transparency level (0.0-1.0)',
            'visible': 'Whether entity is visible (true/false)',
            'layer': 'Rendering layer for depth sorting',
            'mode': 'Physics simulation mode',
            'mass': 'Physics mass for dynamic bodies (kg)',
            'friction': 'Surface friction coefficient (0.0-1.0)',
            'restitution': 'Bounciness factor (0.0-1.0)',
            'gravityScale': 'Gravity multiplier for this body',
            'fixedRotation': 'Prevent rotation from physics forces',
            'type': 'Collider shape type',
            'radius': 'Radius for circle colliders (pixels)',
            'isSensor': 'Sensor collider (detects but no collision response)',
            'category': 'Collision category bitmask',
            'mask': 'Which categories this collider can collide with',
            'speed': 'Movement speed in pixels per second',
            'jumpPower': 'Jump velocity for platformer movement',
            'target': 'Target entity or position to interact with',
            'points': 'Array of waypoints for patrol behavior',
            'range': 'Detection or effect range in pixels',
            'duration': 'Duration of effect in seconds',
            'health': 'Entity health points',
            'damage': 'Damage amount dealt',

            // Scene Properties
            'size': 'Scene dimensions as [width, height] array',
            'gravity': 'Global gravity vector as [x, y] array',
            'background': 'Background color or texture',
            'pixelArt': 'Enable pixel-perfect rendering (true/false)',
            'camera': 'Camera configuration object'
        };

        const doc = docs[word];
        if (doc) {
            return new vscode.MarkdownString(doc);
        }
    }

    private formatGDL(text: string, options: vscode.FormattingOptions): string {
        const lines = text.split('\n');
        const formatted: string[] = [];
        let indentLevel = 0;
        const indent = options.insertSpaces ? ' '.repeat(options.tabSize) : '\t';

        for (let line of lines) {
            const originalLine = line;
            line = line.trim();
            
            // Preserve empty lines
            if (line === '') {
                formatted.push(originalLine);
                continue;
            }

            // Preserve comments
            if (line.startsWith('//') || line.startsWith('/*')) {
                formatted.push(indent.repeat(indentLevel) + line);
                continue;
            }

            // Decrease indent for closing braces
            if (line === '}') {
                indentLevel = Math.max(0, indentLevel - 1);
            }

            // Add proper indentation
            formatted.push(indent.repeat(indentLevel) + line);

            // Increase indent for opening braces
            if (line.endsWith('{')) {
                indentLevel++;
            }
        }

        return formatted.join('\n');
    }

    // Document change handlers for real-time validation
    private onDocumentChange(event: vscode.TextDocumentChangeEvent): void {
        if (event.document.languageId === 'gdl') {
            const diagnostics = this.provideDiagnostics(event.document);
            this.diagnostics.set(event.document.uri, diagnostics);
        }
    }

    private onDocumentClose(document: vscode.TextDocument): void {
        if (document.languageId === 'gdl') {
            this.diagnostics.delete(document.uri);
        }
    }

    public dispose(): void {
        this.diagnostics.dispose();
    }
}