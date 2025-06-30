// Level Designer Webview Implementation
declare const acquireVsCodeApi: any;

interface Vector2 {
    x: number;
    y: number;
}

interface EntityData {
    id: string;
    name: string;
    type: string;
    position: Vector2;
    rotation: number;
    scale: Vector2;
    sprite?: {
        texture: string;
        width: number;
        height: number;
        color?: string;
    };
    physics?: any;
    collider?: any;
    behaviors?: string[];
    layer: number;
    locked: boolean;
    visible: boolean;
}

interface LevelData {
    sceneName: string;
    width: number;
    height: number;
    background: string;
    gravity: number;
    entities: EntityData[];
}

interface Tool {
    name: string;
    cursor: string;
    onMouseDown?: (e: MouseEvent) => void;
    onMouseMove?: (e: MouseEvent) => void;
    onMouseUp?: (e: MouseEvent) => void;
}

class LevelDesigner {
    private vscode = acquireVsCodeApi();
    private levelData: LevelData = {
        sceneName: 'MainScene',
        width: 1920,
        height: 1080,
        background: '#87CEEB',
        gravity: 800,
        entities: []
    };

    // Canvas elements
    private gridCanvas!: HTMLCanvasElement;
    private levelCanvas!: HTMLCanvasElement;
    private selectionCanvas!: HTMLCanvasElement;
    private gridContext!: CanvasRenderingContext2D;
    private levelContext!: CanvasRenderingContext2D;
    private selectionContext!: CanvasRenderingContext2D;

    // State
    private currentTool: string = 'select-tool';
    private selectedEntities: Set<string> = new Set();
    private isDragging: boolean = false;
    private isPanning: boolean = false;
    private dragStart: Vector2 = { x: 0, y: 0 };
    private dragStartPositions: Map<string, Vector2> = new Map();
    private lastMousePos: Vector2 = { x: 0, y: 0 };
    private camera: { x: number; y: number; zoom: number } = { x: 100, y: 100, zoom: 1 };
    private gridSize: number = 16;
    private showGrid: boolean = true;
    private snapToGrid: boolean = true;
    private clipboard: EntityData[] = [];
    private entityIdCounter: number = 0;
    private currentLayer: number = 0;
    private spacePressed: boolean = false;
    private layers: { name: string; visible: boolean; locked: boolean }[] = [
        { name: 'Main Layer', visible: true, locked: false }
    ];

    // Assets
    private loadedSprites: { [key: string]: HTMLImageElement | string } = {};
    private entityTemplates: { [key: string]: any } = {};
    private prefabs: { [key: string]: any } = {};

    // Tools with functionality
    private tools: { [key: string]: Tool } = {
        'select-tool': {
            name: 'Select',
            cursor: 'default',
            onMouseDown: this.handleSelectTool.bind(this),
            onMouseMove: this.handleSelectMove.bind(this),
            onMouseUp: this.handleSelectUp.bind(this)
        },
        'move-tool': {
            name: 'Move',
            cursor: 'move',
            onMouseDown: this.handleMoveTool.bind(this),
            onMouseMove: this.handleMoveMove.bind(this),
            onMouseUp: this.handleMoveUp.bind(this)
        },
        'rotate-tool': {
            name: 'Rotate',
            cursor: 'crosshair',
            onMouseDown: this.handleRotateTool.bind(this),
            onMouseMove: this.handleRotateMove.bind(this),
            onMouseUp: this.handleRotateUp.bind(this)
        },
        'scale-tool': {
            name: 'Scale',
            cursor: 'nw-resize',
            onMouseDown: this.handleScaleTool.bind(this),
            onMouseMove: this.handleScaleMove.bind(this),
            onMouseUp: this.handleScaleUp.bind(this)
        },
        'pan-tool': {
            name: 'Pan',
            cursor: 'grab',
            onMouseDown: this.handlePanTool.bind(this),
            onMouseMove: this.handlePanMove.bind(this),
            onMouseUp: this.handlePanUp.bind(this)
        }
    };

    // Undo/Redo system
    private undoStack: string[] = [];
    private redoStack: string[] = [];
    private maxUndoSteps: number = 50;
    private rotationStart: number = 0;
    private scaleStart: Vector2 = { x: 1, y: 1 };
    private transformOrigin: Vector2 = { x: 0, y: 0 };

    constructor() {
        this.initializeCanvas();
        this.setupEventListeners();
        this.setupMessageHandling();
        this.render();
        
        // Request initial data
        this.vscode.postMessage({ command: 'loadAssets' });
        this.vscode.postMessage({ command: 'loadPrefabs' });
        this.vscode.postMessage({ command: 'getEntityTemplates' });

        console.log('Level Designer initialized');
    }

    private initializeCanvas() {
        this.gridCanvas = document.getElementById('grid-canvas') as HTMLCanvasElement;
        this.levelCanvas = document.getElementById('level-canvas') as HTMLCanvasElement;
        this.selectionCanvas = document.getElementById('selection-canvas') as HTMLCanvasElement;

        if (!this.gridCanvas || !this.levelCanvas || !this.selectionCanvas) {
            console.error('❌ Canvas elements not found');
            return;
        }

        this.gridContext = this.gridCanvas.getContext('2d')!;
        this.levelContext = this.levelCanvas.getContext('2d')!;
        this.selectionContext = this.selectionCanvas.getContext('2d')!;

        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());
    }

    private resizeCanvas() {
        const container = document.getElementById('canvas-container')!;
        const rect = container.getBoundingClientRect();
        
        [this.gridCanvas, this.levelCanvas, this.selectionCanvas].forEach(canvas => {
            canvas.width = rect.width;
            canvas.height = rect.height;
        });

        this.render();
    }


    private setupEventListeners() {
        // Tool selection with event delegation for better reliability
        document.addEventListener('click', (e) => {
            const target = e.target as HTMLElement;
            if (target && target.classList.contains('tool-btn')) {
                const toolId = target.id;
                if (this.tools[toolId]) {
                    this.selectTool(toolId);
                }
            }
        });

        // Canvas mouse events
        this.selectionCanvas.addEventListener('mousedown', this.onMouseDown.bind(this));
        this.selectionCanvas.addEventListener('mousemove', this.onMouseMove.bind(this));
        this.selectionCanvas.addEventListener('mouseup', this.onMouseUp.bind(this));
        this.selectionCanvas.addEventListener('wheel', this.onWheel.bind(this));
        this.selectionCanvas.addEventListener('contextmenu', this.onContextMenu.bind(this));

        // Additional navigation controls
        this.selectionCanvas.addEventListener('mouseleave', () => {
            this.isPanning = false;
            this.isDragging = false;
            this.updateCursor();
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', this.onKeyDown.bind(this));
        document.addEventListener('keyup', this.onKeyUp.bind(this));

        // Grid controls
        document.getElementById('grid-snap-btn')?.addEventListener('click', () => {
            this.snapToGrid = !this.snapToGrid;
            document.getElementById('grid-snap-btn')?.classList.toggle('active');
        });

        document.getElementById('show-grid-btn')?.addEventListener('click', () => {
            this.showGrid = !this.showGrid;
            document.getElementById('show-grid-btn')?.classList.toggle('active');
            this.render();
        });

        document.getElementById('grid-size')?.addEventListener('change', (e) => {
            this.gridSize = parseInt((e.target as HTMLSelectElement).value);
            this.render();
        });

        // Scene properties
        document.getElementById('scene-name')?.addEventListener('input', (e) => {
            this.levelData.sceneName = (e.target as HTMLInputElement).value;
            this.updateGDL();
        });

        document.getElementById('scene-width')?.addEventListener('input', (e) => {
            this.levelData.width = parseInt((e.target as HTMLInputElement).value);
            this.render();
            this.updateGDL();
        });

        document.getElementById('scene-height')?.addEventListener('input', (e) => {
            this.levelData.height = parseInt((e.target as HTMLInputElement).value);
            this.render();
            this.updateGDL();
        });

        document.getElementById('scene-background')?.addEventListener('input', (e) => {
            this.levelData.background = (e.target as HTMLInputElement).value;
            this.render();
            this.updateGDL();
        });

        document.getElementById('scene-gravity')?.addEventListener('input', (e) => {
            this.levelData.gravity = parseInt((e.target as HTMLInputElement).value);
            this.updateGDL();
        });

        // Zoom controls
        document.getElementById('zoom-in')?.addEventListener('click', () => this.zoom(1.2));
        document.getElementById('zoom-out')?.addEventListener('click', () => this.zoom(0.8));
        document.getElementById('zoom-fit')?.addEventListener('click', () => this.fitToScreen());

        // Entity library drag and drop
        this.setupDragAndDrop();

        // Save/Export
        document.getElementById('save-btn')?.addEventListener('click', () => this.saveLevel());
        document.getElementById('export-btn')?.addEventListener('click', () => this.showExportDialog());
    }

    private setupMessageHandling() {
        window.addEventListener('message', event => {
            const message = event.data;
            
            switch (message.type) {
                case 'update':
                    // Skip parsing if this update is from our own changes
                    if (!this.isUpdatingFromUI) {
                        this.parseGDL(message.content);
                    }
                    break;
                case 'assetsLoaded':
                    this.handleAssetsLoaded(message.sprites, message.sounds);
                    break;
                case 'prefabsLoaded':
                    this.handlePrefabsLoaded(message.prefabs);
                    break;
                case 'templatesLoaded':
                    this.handleTemplatesLoaded(message.templates);
                    break;
            }
        });
    }

    private selectTool(toolId: string) {
        // Remove active class from all tool buttons
        document.querySelectorAll('.tool-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        
        // Add active class to selected tool
        const targetButton = document.getElementById(toolId);
        if (targetButton) {
            targetButton.classList.add('active');
        }
        
        this.currentTool = toolId;
        this.updateCursor();
    }

    private updateCursor() {
        if (this.isPanning) {
            this.selectionCanvas.style.cursor = 'grabbing';
        } else if (this.spacePressed || this.currentTool === 'pan-tool') {
            this.selectionCanvas.style.cursor = 'grab';
        } else {
            this.selectionCanvas.style.cursor = this.tools[this.currentTool]?.cursor || 'default';
        }
    }

    private onMouseDown(e: MouseEvent) {
        const rect = this.selectionCanvas.getBoundingClientRect();
        const screenX = e.clientX - rect.left;
        const screenY = e.clientY - rect.top;
        const worldPos = this.screenToWorld(screenX, screenY);
        
        this.dragStart = worldPos;
        this.lastMousePos = { x: screenX, y: screenY };

        if (e.button === 1 || (e.button === 0 && e.altKey) || (e.button === 0 && this.spacePressed) || (e.button === 0 && this.currentTool === 'pan-tool')) {
            // Middle mouse, Alt+Left, Space+Left, or Pan tool for panning
            this.isPanning = true;
            this.updateCursor();
            e.preventDefault();
            return;
        }

        if (e.button === 0) {
            const tool = this.tools[this.currentTool];
            if (tool && tool.onMouseDown) {
                tool.onMouseDown(e);
            }
        }
    }

    private onMouseMove(e: MouseEvent) {
        const rect = this.selectionCanvas.getBoundingClientRect();
        const screenX = e.clientX - rect.left;
        const screenY = e.clientY - rect.top;
        const worldPos = this.screenToWorld(screenX, screenY);
        
        this.updateCursorPosition(worldPos);

        if (this.isPanning) {
            const dx = screenX - this.lastMousePos.x;
            const dy = screenY - this.lastMousePos.y;
            this.camera.x += dx;
            this.camera.y += dy;
            this.lastMousePos = { x: screenX, y: screenY };
            this.render();
            return;
        }

        const tool = this.tools[this.currentTool];
        if (tool && tool.onMouseMove) {
            tool.onMouseMove(e);
        }
    }

    private onMouseUp(e: MouseEvent) {
        const tool = this.tools[this.currentTool];
        if (tool && tool.onMouseUp) {
            tool.onMouseUp(e);
        }
        
        this.isDragging = false;
        this.isPanning = false;
        this.updateCursor();
    }

    private onWheel(e: WheelEvent) {
        e.preventDefault();
        const zoomSpeed = 0.001;
        const zoomDelta = 1 - e.deltaY * zoomSpeed;
        this.zoom(zoomDelta, { x: e.offsetX, y: e.offsetY });
    }

    private onContextMenu(e: MouseEvent) {
        e.preventDefault();
        
        if (this.selectedEntities.size > 0) {
            this.showContextMenu(e.pageX, e.pageY);
        }
    }

    private onKeyDown(e: KeyboardEvent) {
        switch (e.key) {
            case 'Delete':
            case 'Backspace':
                if (this.selectedEntities.size > 0) {
                    this.deleteSelected();
                }
                break;
            case 'c':
                if (e.ctrlKey || e.metaKey) {
                    this.copySelected();
                }
                break;
            case 'v':
                if (e.ctrlKey || e.metaKey) {
                    this.paste();
                } else {
                    this.selectTool('select-tool');
                }
                break;
            case 'x':
                if (e.ctrlKey || e.metaKey) {
                    this.cutSelected();
                }
                break;
            case 'd':
                if (e.ctrlKey || e.metaKey) {
                    e.preventDefault();
                    this.duplicateSelected();
                }
                break;
            case 'a':
                if (e.ctrlKey || e.metaKey) {
                    e.preventDefault();
                    this.selectAll();
                }
                break;
            case 'z':
                if (e.ctrlKey || e.metaKey) {
                    if (e.shiftKey) {
                        this.redo();
                    } else {
                        this.undo();
                    }
                }
                break;
            case 'w':
                if (!e.ctrlKey && !e.metaKey) {
                    this.selectTool('move-tool');
                }
                break;
            case 'e':
                if (!e.ctrlKey && !e.metaKey) {
                    this.selectTool('rotate-tool');
                }
                break;
            case 'r':
                if (!e.ctrlKey && !e.metaKey) {
                    this.selectTool('scale-tool');
                }
                break;
            case 'h':
                if (!e.ctrlKey && !e.metaKey) {
                    this.selectTool('pan-tool');
                }
                break;
            case ' ':
                // Spacebar for temporary pan mode
                e.preventDefault();
                this.spacePressed = true;
                if (!this.isDrawing && !this.isDragging) {
                    this.updateCursor();
                }
                break;
            case '+':
            case '=':
                if (!e.ctrlKey && !e.metaKey) {
                    e.preventDefault();
                    this.zoom(1.2);
                }
                break;
            case '-':
                if (!e.ctrlKey && !e.metaKey) {
                    e.preventDefault();
                    this.zoom(0.8);
                }
                break;
            case '0':
                if (!e.ctrlKey && !e.metaKey) {
                    e.preventDefault();
                    this.camera = { x: 100, y: 100, zoom: 1 };
                    this.updateZoomDisplay();
                    this.render();
                }
                break;
        }
    }

    private onKeyUp(e: KeyboardEvent) {
        switch (e.key) {
            case ' ':
                this.spacePressed = false;
                if (!this.isPanning) {
                    this.updateCursor();
                }
                break;
        }
    }

    private screenToWorld(screenX: number, screenY: number): Vector2 {
        return {
            x: (screenX - this.camera.x) / this.camera.zoom,
            y: (screenY - this.camera.y) / this.camera.zoom
        };
    }

    private worldToScreen(worldX: number, worldY: number): Vector2 {
        return {
            x: worldX * this.camera.zoom + this.camera.x,
            y: worldY * this.camera.zoom + this.camera.y
        };
    }

    private zoom(factor: number, center?: Vector2) {
        const oldZoom = this.camera.zoom;
        this.camera.zoom *= factor;
        this.camera.zoom = Math.max(0.1, Math.min(5, this.camera.zoom));
        
        if (center) {
            const zoomDiff = this.camera.zoom - oldZoom;
            this.camera.x -= (center.x - this.camera.x) * (zoomDiff / oldZoom);
            this.camera.y -= (center.y - this.camera.y) * (zoomDiff / oldZoom);
        }
        
        this.updateZoomDisplay();
        this.render();
    }

    private fitToScreen() {
        if (this.levelData.entities.length === 0) {
            this.camera = { x: 0, y: 0, zoom: 1 };
        } else {
            // Calculate bounding box of all entities
            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
            
            this.levelData.entities.forEach(entity => {
                minX = Math.min(minX, entity.position.x);
                minY = Math.min(minY, entity.position.y);
                maxX = Math.max(maxX, entity.position.x + (entity.sprite?.width || 32));
                maxY = Math.max(maxY, entity.position.y + (entity.sprite?.height || 32));
            });
            
            const padding = 50;
            const width = maxX - minX + padding * 2;
            const height = maxY - minY + padding * 2;
            const centerX = (minX + maxX) / 2;
            const centerY = (minY + maxY) / 2;
            
            const canvasWidth = this.levelCanvas.width;
            const canvasHeight = this.levelCanvas.height;
            
            const zoomX = canvasWidth / width;
            const zoomY = canvasHeight / height;
            this.camera.zoom = Math.min(zoomX, zoomY, 2);
            
            this.camera.x = canvasWidth / 2 - centerX * this.camera.zoom;
            this.camera.y = canvasHeight / 2 - centerY * this.camera.zoom;
        }
        
        this.updateZoomDisplay();
        this.render();
    }

    private updateZoomDisplay() {
        const zoomLevel = document.getElementById('zoom-level');
        if (zoomLevel) {
            zoomLevel.textContent = `${Math.round(this.camera.zoom * 100)}%`;
        }
    }

    private updateCursorPosition(worldPos: Vector2) {
        const cursorPos = document.getElementById('cursor-position');
        if (cursorPos) {
            cursorPos.textContent = `X: ${Math.round(worldPos.x)}, Y: ${Math.round(worldPos.y)}`;
        }
    }

    private handleSelection(worldPos: Vector2, addToSelection: boolean) {
        if (!addToSelection) {
            this.selectedEntities.clear();
        }

        // Find entity at position
        for (let i = this.levelData.entities.length - 1; i >= 0; i--) {
            const entity = this.levelData.entities[i];
            if (!this.layers[entity.layer].visible) continue;
            
            const bounds = {
                x: entity.position.x,
                y: entity.position.y,
                width: entity.sprite?.width || 32,
                height: entity.sprite?.height || 32
            };
            
            if (worldPos.x >= bounds.x && worldPos.x <= bounds.x + bounds.width &&
                worldPos.y >= bounds.y && worldPos.y <= bounds.y + bounds.height) {
                if (this.selectedEntities.has(entity.id)) {
                    this.selectedEntities.delete(entity.id);
                } else {
                    this.selectedEntities.add(entity.id);
                }
                break;
            }
        }
        
        this.render();
        this.updateEntityInspector();
        this.updateHierarchy();
    }

    private selectAll() {
        this.selectedEntities.clear();
        this.levelData.entities.forEach(entity => {
            if (this.layers[entity.layer].visible && !this.layers[entity.layer].locked) {
                this.selectedEntities.add(entity.id);
            }
        });
        this.render();
        this.updateEntityInspector();
    }

    private deleteSelected() {
        this.levelData.entities = this.levelData.entities.filter(
            entity => !this.selectedEntities.has(entity.id)
        );
        this.selectedEntities.clear();
        this.render();
        this.updateGDL();
        this.updateEntityInspector();
        this.updateHierarchy();
    }

    private copySelected() {
        this.clipboard = [];
        this.selectedEntities.forEach(id => {
            const entity = this.findEntity(id);
            if (entity) {
                this.clipboard.push(JSON.parse(JSON.stringify(entity)));
            }
        });
    }

    private cutSelected() {
        this.copySelected();
        this.deleteSelected();
    }

    private paste() {
        if (this.clipboard.length === 0) return;
        
        this.selectedEntities.clear();
        
        const offset = 20;
        this.clipboard.forEach(entityData => {
            const newEntity = JSON.parse(JSON.stringify(entityData));
            newEntity.id = this.generateEntityId();
            newEntity.position.x += offset;
            newEntity.position.y += offset;
            newEntity.layer = this.currentLayer;
            
            this.levelData.entities.push(newEntity);
            this.selectedEntities.add(newEntity.id);
        });
        
        this.render();
        this.updateGDL();
        this.updateEntityInspector();
        this.updateHierarchy();
    }

    private duplicateSelected() {
        const toDuplicate: EntityData[] = [];
        this.selectedEntities.forEach(id => {
            const entity = this.findEntity(id);
            if (entity) {
                toDuplicate.push(entity);
            }
        });
        
        this.selectedEntities.clear();
        
        toDuplicate.forEach(entity => {
            const newEntity = JSON.parse(JSON.stringify(entity));
            newEntity.id = this.generateEntityId();
            newEntity.position.x += 20;
            newEntity.position.y += 20;
            
            this.levelData.entities.push(newEntity);
            this.selectedEntities.add(newEntity.id);
        });
        
        this.render();
        this.updateGDL();
        this.updateEntityInspector();
        this.updateHierarchy();
    }

    private findEntity(id: string): EntityData | undefined {
        return this.levelData.entities.find(e => e.id === id);
    }

    private generateEntityId(): string {
        return `entity_${++this.entityIdCounter}`;
    }

    private setupDragAndDrop() {
        // Setup drag from entity library
        document.addEventListener('dragstart', (e) => {
            const target = e.target as HTMLElement;
            if (target.classList.contains('entity-template')) {
                const entityType = target.dataset.entityType;
                const prefabName = target.dataset.prefabName;
                
                if (entityType) {
                    e.dataTransfer!.setData('entityType', entityType);
                    e.dataTransfer!.effectAllowed = 'copy';
                } else if (prefabName) {
                    e.dataTransfer!.setData('prefabName', prefabName);
                    e.dataTransfer!.effectAllowed = 'copy';
                }
            }
        });

        // Setup drop on canvas
        this.selectionCanvas.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer!.dropEffect = 'copy';
        });

        this.selectionCanvas.addEventListener('drop', (e) => {
            e.preventDefault();
            
            const rect = this.selectionCanvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            const worldPos = this.screenToWorld(x, y);
            
            const entityType = e.dataTransfer!.getData('entityType');
            const prefabName = e.dataTransfer!.getData('prefabName');
            
            if (entityType) {
                this.createEntity(entityType, worldPos);
            } else if (prefabName) {
                this.createPrefabInstance(prefabName, worldPos);
            }
        });
    }

    private createEntity(type: string, position: Vector2) {
        const template = this.entityTemplates[type];
        if (!template) {
            console.error(`Template not found for entity type: ${type}`);
            return;
        }

        // Ensure position is valid
        const validPosition = {
            x: Math.max(0, position.x),
            y: Math.max(0, position.y)
        };

        const entity: EntityData = {
            id: this.generateEntityId(),
            name: `${type}_${this.entityIdCounter}`,
            type: type,
            position: {
                x: this.snapToGrid ? Math.round(validPosition.x / this.gridSize) * this.gridSize : validPosition.x,
                y: this.snapToGrid ? Math.round(validPosition.y / this.gridSize) * this.gridSize : validPosition.y
            },
            rotation: 0,
            scale: { x: 1, y: 1 },
            sprite: template.sprite ? { ...template.sprite } : undefined,
            physics: template.physics ? { ...template.physics } : undefined,
            collider: template.collider ? { ...template.collider } : undefined,
            behaviors: template.behaviors ? [...template.behaviors] : [],
            layer: this.currentLayer,
            locked: false,
            visible: true
        };

        console.log(`Creating entity ${entity.name} at position:`, entity.position);

        this.levelData.entities.push(entity);
        this.selectedEntities.clear();
        this.selectedEntities.add(entity.id);
        
        this.render();
        this.updateGDL();
        this.updateEntityInspector();
        this.updateHierarchy();
    }

    private createPrefabInstance(prefabName: string, position: Vector2) {
        const prefab = this.prefabs[prefabName];
        if (!prefab) {
            console.error(`Prefab not found: ${prefabName}`);
            return;
        }

        // Clear selection
        this.selectedEntities.clear();

        // Create instances of all entities in the prefab
        const offset = {
            x: Math.max(0, position.x),
            y: Math.max(0, position.y)
        };

        prefab.entities.forEach((entityData: any) => {
            const newEntity: EntityData = {
                ...JSON.parse(JSON.stringify(entityData)),
                id: this.generateEntityId(),
                position: {
                    x: offset.x + (entityData.position?.x || 0),
                    y: offset.y + (entityData.position?.y || 0)
                },
                layer: this.currentLayer
            };

            if (this.snapToGrid) {
                newEntity.position.x = Math.round(newEntity.position.x / this.gridSize) * this.gridSize;
                newEntity.position.y = Math.round(newEntity.position.y / this.gridSize) * this.gridSize;
            }

            this.levelData.entities.push(newEntity);
            this.selectedEntities.add(newEntity.id);
        });

        this.render();
        this.updateGDL();
        this.updateEntityInspector();
        this.updateHierarchy();
    }

    private render() {
        // Clear all canvases
        this.gridContext.clearRect(0, 0, this.gridCanvas.width, this.gridCanvas.height);
        this.levelContext.clearRect(0, 0, this.levelCanvas.width, this.levelCanvas.height);
        this.selectionContext.clearRect(0, 0, this.selectionCanvas.width, this.selectionCanvas.height);

        // Save context state
        this.gridContext.save();
        this.levelContext.save();
        this.selectionContext.save();

        // Apply camera transform
        [this.gridContext, this.levelContext, this.selectionContext].forEach(ctx => {
            ctx.translate(this.camera.x, this.camera.y);
            ctx.scale(this.camera.zoom, this.camera.zoom);
        });

        // Draw grid
        if (this.showGrid) {
            this.drawGrid();
        }

        // Draw level bounds
        this.drawLevelBounds();

        // Draw entities
        this.drawEntities();

        // Draw selection
        this.drawSelection();

        // Restore context state
        this.gridContext.restore();
        this.levelContext.restore();
        this.selectionContext.restore();

        // Update status
        this.updateStatus();
    }

    private drawGrid() {
        this.gridContext.strokeStyle = 'rgba(128, 128, 128, 0.2)';
        this.gridContext.lineWidth = 1 / this.camera.zoom;

        const startX = Math.floor(-this.camera.x / this.camera.zoom / this.gridSize) * this.gridSize;
        const startY = Math.floor(-this.camera.y / this.camera.zoom / this.gridSize) * this.gridSize;
        const endX = startX + this.gridCanvas.width / this.camera.zoom + this.gridSize;
        const endY = startY + this.gridCanvas.height / this.camera.zoom + this.gridSize;

        // Vertical lines
        for (let x = startX; x <= endX; x += this.gridSize) {
            this.gridContext.beginPath();
            this.gridContext.moveTo(x, startY);
            this.gridContext.lineTo(x, endY);
            this.gridContext.stroke();
        }

        // Horizontal lines
        for (let y = startY; y <= endY; y += this.gridSize) {
            this.gridContext.beginPath();
            this.gridContext.moveTo(startX, y);
            this.gridContext.lineTo(endX, y);
            this.gridContext.stroke();
        }
    }

    private drawLevelBounds() {
        this.levelContext.strokeStyle = '#333';
        this.levelContext.lineWidth = 2 / this.camera.zoom;
        this.levelContext.setLineDash([5 / this.camera.zoom, 5 / this.camera.zoom]);
        
        this.levelContext.strokeRect(0, 0, this.levelData.width, this.levelData.height);
        
        this.levelContext.setLineDash([]);
        
        // Draw background
        this.levelContext.fillStyle = this.levelData.background;
        this.levelContext.globalAlpha = 0.1;
        this.levelContext.fillRect(0, 0, this.levelData.width, this.levelData.height);
        this.levelContext.globalAlpha = 1;
    }

    private drawEntities() {
        // Draw entities by layer
        for (let layerIndex = 0; layerIndex < this.layers.length; layerIndex++) {
            if (!this.layers[layerIndex].visible) continue;

            this.levelData.entities
                .filter(entity => entity.layer === layerIndex && entity.visible)
                .forEach(entity => {
                    this.drawEntity(entity);
                });
        }
    }

    private drawEntity(entity: EntityData) {
        const { position, rotation, scale, sprite } = entity;
        const width = sprite?.width || 32;
        const height = sprite?.height || 32;

        this.levelContext.save();
        this.levelContext.translate(position.x + width/2, position.y + height/2);
        this.levelContext.rotate(rotation * Math.PI / 180);
        this.levelContext.scale(scale.x, scale.y);

        if (sprite?.texture && this.loadedSprites[sprite.texture]) {
            const img = this.loadedSprites[sprite.texture];
            if (img instanceof HTMLImageElement) {
                this.levelContext.drawImage(img, -width/2, -height/2, width, height);
            } else if (typeof img === 'string' && img.startsWith('<svg')) {
                // Draw SVG
                const svgImg = new Image();
                svgImg.src = 'data:image/svg+xml;base64,' + btoa(img);
                this.levelContext.drawImage(svgImg, -width/2, -height/2, width, height);
            }
        } else {
            // Draw placeholder
            this.levelContext.fillStyle = sprite?.color || this.getDefaultColor(entity.type);
            this.levelContext.fillRect(-width/2, -height/2, width, height);
            
            // Draw border
            this.levelContext.strokeStyle = '#333';
            this.levelContext.lineWidth = 1 / this.camera.zoom;
            this.levelContext.strokeRect(-width/2, -height/2, width, height);
        }

        // Draw entity name
        this.levelContext.restore();
        this.levelContext.fillStyle = '#000';
        this.levelContext.font = `${12 / this.camera.zoom}px Arial`;
        this.levelContext.textAlign = 'center';
        this.levelContext.fillText(entity.name, position.x + width/2, position.y - 5);
    }

    private drawSelection() {
        this.selectedEntities.forEach(id => {
            const entity = this.findEntity(id);
            if (!entity || !entity.visible) return;

            const { position, sprite } = entity;
            const width = sprite?.width || 32;
            const height = sprite?.height || 32;

            // Draw selection box
            this.selectionContext.strokeStyle = '#0099ff';
            this.selectionContext.lineWidth = 2 / this.camera.zoom;
            this.selectionContext.setLineDash([5 / this.camera.zoom, 5 / this.camera.zoom]);
            this.selectionContext.strokeRect(position.x - 2, position.y - 2, width + 4, height + 4);
            this.selectionContext.setLineDash([]);

            // Draw handles
            const handleSize = 6 / this.camera.zoom;
            this.selectionContext.fillStyle = '#0099ff';
            
            // Corner handles
            this.selectionContext.fillRect(position.x - handleSize/2, position.y - handleSize/2, handleSize, handleSize);
            this.selectionContext.fillRect(position.x + width - handleSize/2, position.y - handleSize/2, handleSize, handleSize);
            this.selectionContext.fillRect(position.x - handleSize/2, position.y + height - handleSize/2, handleSize, handleSize);
            this.selectionContext.fillRect(position.x + width - handleSize/2, position.y + height - handleSize/2, handleSize, handleSize);
            
            // Middle handles
            this.selectionContext.fillRect(position.x + width/2 - handleSize/2, position.y - handleSize/2, handleSize, handleSize);
            this.selectionContext.fillRect(position.x + width/2 - handleSize/2, position.y + height - handleSize/2, handleSize, handleSize);
            this.selectionContext.fillRect(position.x - handleSize/2, position.y + height/2 - handleSize/2, handleSize, handleSize);
            this.selectionContext.fillRect(position.x + width - handleSize/2, position.y + height/2 - handleSize/2, handleSize, handleSize);
        });
    }

    private getDefaultColor(type: string): string {
        const colors: { [key: string]: string } = {
            'Player': '#4A90E2',
            'Platform': '#654321',
            'Enemy': '#E74C3C',
            'Coin': '#FFD700',
            'Spike': '#8B0000',
            'Checkpoint': '#32CD32',
            'MovingPlatform': '#8B4513',
            'Spring': '#FF69B4'
        };
        return colors[type] || '#999999';
    }

    private updateStatus() {
        document.getElementById('entity-count')!.textContent = `Entities: ${this.levelData.entities.length}`;
        
        if (this.selectedEntities.size === 0) {
            document.getElementById('selection-info')!.textContent = 'No selection';
        } else if (this.selectedEntities.size === 1) {
            const entity = this.findEntity(Array.from(this.selectedEntities)[0]);
            document.getElementById('selection-info')!.textContent = `Selected: ${entity?.name}`;
        } else {
            document.getElementById('selection-info')!.textContent = `Selected: ${this.selectedEntities.size} entities`;
        }
    }

    private updateEntityInspector() {
        const inspector = document.getElementById('entity-inspector')!;
        
        if (this.selectedEntities.size === 0) {
            inspector.innerHTML = `
                <div class="no-selection">
                    <p>No entity selected</p>
                    <p class="hint">Select an entity to view properties</p>
                </div>
            `;
            return;
        }

        if (this.selectedEntities.size === 1) {
            const entity = this.findEntity(Array.from(this.selectedEntities)[0])!;
            inspector.innerHTML = this.createEntityInspectorHTML(entity);
            this.bindInspectorEvents(entity);
        } else {
            inspector.innerHTML = `
                <div class="multi-selection">
                    <p>${this.selectedEntities.size} entities selected</p>
                </div>
            `;
        }
    }

    private createEntityInspectorHTML(entity: EntityData): string {
        return `
            <div class="property-group">
                <label>Name:</label>
                <input type="text" id="entity-name" value="${entity.name}">
            </div>
            <div class="property-group">
                <label>Type:</label>
                <input type="text" id="entity-type" value="${entity.type}" readonly>
            </div>
            <div class="property-group-row">
                <div class="property-group">
                    <label>X:</label>
                    <input type="number" id="entity-x" value="${entity.position.x}">
                </div>
                <div class="property-group">
                    <label>Y:</label>
                    <input type="number" id="entity-y" value="${entity.position.y}">
                </div>
            </div>
            <div class="property-group">
                <label>Rotation:</label>
                <input type="number" id="entity-rotation" value="${entity.rotation}" min="-360" max="360">
            </div>
            <div class="property-group-row">
                <div class="property-group">
                    <label>Scale X:</label>
                    <input type="number" id="entity-scale-x" value="${entity.scale.x}" step="0.1">
                </div>
                <div class="property-group">
                    <label>Scale Y:</label>
                    <input type="number" id="entity-scale-y" value="${entity.scale.y}" step="0.1">
                </div>
            </div>
            ${entity.sprite ? `
                <div class="property-section">
                    <h4>Sprite</h4>
                    <div class="property-group">
                        <label>Texture:</label>
                        <input type="text" id="entity-texture" value="${entity.sprite.texture || ''}">
                    </div>
                    <div class="property-group-row">
                        <div class="property-group">
                            <label>Width:</label>
                            <input type="number" id="entity-width" value="${entity.sprite.width}">
                        </div>
                        <div class="property-group">
                            <label>Height:</label>
                            <input type="number" id="entity-height" value="${entity.sprite.height}">
                        </div>
                    </div>
                    ${entity.sprite.color ? `
                        <div class="property-group">
                            <label>Color:</label>
                            <input type="color" id="entity-color" value="${entity.sprite.color}">
                        </div>
                    ` : ''}
                </div>
            ` : ''}
            ${entity.behaviors && entity.behaviors.length > 0 ? `
                <div class="property-section">
                    <h4>Behaviors</h4>
                    <div class="behavior-list">
                        ${entity.behaviors.map(b => `<div class="behavior-item">${b}</div>`).join('')}
                    </div>
                </div>
            ` : ''}
        `;
    }

    private bindInspectorEvents(entity: EntityData) {
        document.getElementById('entity-name')?.addEventListener('input', (e) => {
            entity.name = (e.target as HTMLInputElement).value;
            this.updateGDL();
            this.updateHierarchy();
        });

        document.getElementById('entity-x')?.addEventListener('input', (e) => {
            entity.position.x = parseFloat((e.target as HTMLInputElement).value);
            this.render();
            this.updateGDL();
        });

        document.getElementById('entity-y')?.addEventListener('input', (e) => {
            entity.position.y = parseFloat((e.target as HTMLInputElement).value);
            this.render();
            this.updateGDL();
        });

        document.getElementById('entity-rotation')?.addEventListener('input', (e) => {
            entity.rotation = parseFloat((e.target as HTMLInputElement).value);
            this.render();
            this.updateGDL();
        });

        document.getElementById('entity-scale-x')?.addEventListener('input', (e) => {
            entity.scale.x = parseFloat((e.target as HTMLInputElement).value);
            this.render();
            this.updateGDL();
        });

        document.getElementById('entity-scale-y')?.addEventListener('input', (e) => {
            entity.scale.y = parseFloat((e.target as HTMLInputElement).value);
            this.render();
            this.updateGDL();
        });

        if (entity.sprite) {
            document.getElementById('entity-texture')?.addEventListener('input', (e) => {
                entity.sprite!.texture = (e.target as HTMLInputElement).value;
                this.render();
                this.updateGDL();
            });

            document.getElementById('entity-width')?.addEventListener('input', (e) => {
                entity.sprite!.width = parseInt((e.target as HTMLInputElement).value);
                this.render();
                this.updateGDL();
            });

            document.getElementById('entity-height')?.addEventListener('input', (e) => {
                entity.sprite!.height = parseInt((e.target as HTMLInputElement).value);
                this.render();
                this.updateGDL();
            });

            document.getElementById('entity-color')?.addEventListener('input', (e) => {
                entity.sprite!.color = (e.target as HTMLInputElement).value;
                this.render();
                this.updateGDL();
            });
        }
    }

    private updateHierarchy() {
        const tree = document.getElementById('hierarchy-tree')!;
        tree.innerHTML = '';

        this.levelData.entities.forEach(entity => {
            const item = document.createElement('div');
            item.className = 'hierarchy-item';
            if (this.selectedEntities.has(entity.id)) {
                item.classList.add('selected');
            }
            
            item.innerHTML = `
                <span class="hierarchy-icon">${this.getEntityIcon(entity.type)}</span>
                <span class="hierarchy-name">${entity.name}</span>
            `;
            
            item.addEventListener('click', () => {
                this.selectedEntities.clear();
                this.selectedEntities.add(entity.id);
                this.render();
                this.updateEntityInspector();
                this.updateHierarchy();
            });
            
            tree.appendChild(item);
        });
    }

    private getEntityIcon(type: string): string {
        const icons: { [key: string]: string } = {
            'Player': 'P',
            'Platform': '⬜',
            'Enemy': '👾',
            'Coin': '🪙',
            'Spike': '⚠️',
            'Checkpoint': '🚩',
            'MovingPlatform': 'M',
            'Spring': '🌀'
        };
        return icons[type] || 'E';
    }

    private showContextMenu(x: number, y: number) {
        const menu = document.getElementById('context-menu')!;
        menu.style.display = 'block';
        menu.style.left = `${x}px`;
        menu.style.top = `${y}px`;

        // Add click handler
        const handleClick = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            if (target.classList.contains('menu-item')) {
                const action = target.dataset.action;
                this.handleContextMenuAction(action!);
            }
            menu.style.display = 'none';
            document.removeEventListener('click', handleClick);
        };

        setTimeout(() => {
            document.addEventListener('click', handleClick);
        }, 0);
    }

    private handleContextMenuAction(action: string) {
        switch (action) {
            case 'cut':
                this.cutSelected();
                break;
            case 'copy':
                this.copySelected();
                break;
            case 'paste':
                this.paste();
                break;
            case 'duplicate':
                this.duplicateSelected();
                break;
            case 'delete':
                this.deleteSelected();
                break;
            case 'bring-front':
                this.bringToFront();
                break;
            case 'send-back':
                this.sendToBack();
                break;
            case 'create-prefab':
                this.createPrefab();
                break;
        }
    }

    private bringToFront() {
        const selected = Array.from(this.selectedEntities);
        const entities = this.levelData.entities.filter(e => !selected.includes(e.id));
        const selectedEntities = this.levelData.entities.filter(e => selected.includes(e.id));
        this.levelData.entities = [...entities, ...selectedEntities];
        this.render();
        this.updateGDL();
    }

    private sendToBack() {
        const selected = Array.from(this.selectedEntities);
        const entities = this.levelData.entities.filter(e => !selected.includes(e.id));
        const selectedEntities = this.levelData.entities.filter(e => selected.includes(e.id));
        this.levelData.entities = [...selectedEntities, ...entities];
        this.render();
        this.updateGDL();
    }

    private createPrefab() {
        if (this.selectedEntities.size === 0) return;

        const name = prompt('Enter prefab name:');
        if (!name) return;

        const entities: EntityData[] = [];
        this.selectedEntities.forEach(id => {
            const entity = this.findEntity(id);
            if (entity) {
                entities.push(JSON.parse(JSON.stringify(entity)));
            }
        });

        const prefabData = {
            name: name,
            entities: entities
        };

        this.vscode.postMessage({
            command: 'savePrefab',
            prefabData: prefabData
        });
    }

    private isUpdatingFromUI: boolean = false;
    
    private updateGDL() {
        this.isUpdatingFromUI = true;
        const gdl = this.generateGDL();
        this.vscode.postMessage({
            command: 'updateLevel',
            gdlContent: gdl
        });
        // Reset flag after a short delay to handle async updates
        setTimeout(() => {
            this.isUpdatingFromUI = false;
        }, 100);
    }

    private generateGDL(): string {
        let gdl = `// Level: ${this.levelData.sceneName}\n`;
        gdl += `// Generated by Game Vibe Level Designer\n\n`;
        
        gdl += `scene ${this.levelData.sceneName} {\n`;
        gdl += `    size: { width: ${this.levelData.width}, height: ${this.levelData.height} }\n`;
        gdl += `    background: "${this.levelData.background}"\n`;
        gdl += `    gravity: ${this.levelData.gravity}\n\n`;
        
        this.levelData.entities.forEach(entity => {
            gdl += `    entity ${entity.name} {\n`;
            gdl += `        transform: { x: ${Math.round(entity.position.x)}, y: ${Math.round(entity.position.y)} }\n`;
            
            if (entity.sprite) {
                gdl += `        sprite: { `;
                if (entity.sprite.texture) gdl += `texture: "${entity.sprite.texture}", `;
                gdl += `width: ${entity.sprite.width}, height: ${entity.sprite.height}`;
                if (entity.sprite.color) gdl += `, color: "${entity.sprite.color}"`;
                gdl += ` }\n`;
            }
            
            if (entity.physics) {
                gdl += `        physics: { mode: "${entity.physics.mode}"`;
                if (entity.physics.mass !== undefined) gdl += `, mass: ${entity.physics.mass}`;
                if (entity.physics.friction !== undefined) gdl += `, friction: ${entity.physics.friction}`;
                gdl += ` }\n`;
            }
            
            if (entity.collider) {
                gdl += `        collider: { type: "${entity.collider.type}"`;
                if (entity.collider.width) gdl += `, width: ${entity.collider.width}`;
                if (entity.collider.height) gdl += `, height: ${entity.collider.height}`;
                if (entity.collider.radius) gdl += `, radius: ${entity.collider.radius}`;
                if (entity.collider.isTrigger) gdl += `, isTrigger: true`;
                gdl += ` }\n`;
            }
            
            if (entity.behaviors && entity.behaviors.length > 0) {
                entity.behaviors.forEach(behavior => {
                    gdl += `        behavior: ${behavior} { }\n`;
                });
            }
            
            gdl += `    }\n\n`;
        });
        
        gdl += `}`;
        
        return gdl;
    }

    private parseGDL(gdlContent: string) {
        // Enhanced GDL parser for loading levels with proper format support
        try {
            console.log('Parsing GDL content:', gdlContent.substring(0, 200) + '...');
            
            // Parse scene properties
            const sceneMatch = gdlContent.match(/scene\s+(\w+)\s*\{/);
            if (sceneMatch) {
                this.levelData.sceneName = sceneMatch[1];
                console.log('Found scene name:', sceneMatch[1]);
            }

            // Parse size: [width, height] format
            const sizeMatch = gdlContent.match(/size:\s*\[\s*(\d+),?\s*(\d+)\s*\]/);
            if (sizeMatch) {
                this.levelData.width = parseInt(sizeMatch[1]);
                this.levelData.height = parseInt(sizeMatch[2]);
                console.log('Found scene size:', sizeMatch[1], 'x', sizeMatch[2]);
            }

            // Parse background
            const bgMatch = gdlContent.match(/background:\s*"([^"]+)"/);
            if (bgMatch) {
                this.levelData.background = bgMatch[1];
                console.log('Found background:', bgMatch[1]);
            }

            // Parse gravity: [x, y] format  
            const gravityMatch = gdlContent.match(/gravity:\s*\[\s*(\d+),?\s*(\d+)\s*\]/);
            if (gravityMatch) {
                this.levelData.gravity = parseInt(gravityMatch[2]); // Use Y gravity
                console.log('Found gravity:', gravityMatch[2]);
            }

            // Parse entities using improved regex that handles nested braces
            this.levelData.entities = [];
            const entityMatches = this.extractEntities(gdlContent);
            
            for (const entityMatch of entityMatches) {
                const entity: EntityData = {
                    id: this.generateEntityId(),
                    name: entityMatch.name,
                    type: this.guessEntityType(entityMatch.name),
                    position: { x: 0, y: 0 },
                    rotation: 0,
                    scale: { x: 1, y: 1 },
                    layer: 0,
                    locked: false,
                    visible: true
                };
                
                console.log('Parsing entity:', entityMatch.name);
                
                // Parse transform: { x: value y: value } format (no commas)
                const transformMatch = entityMatch.content.match(/transform:\s*\{\s*x:\s*(\d+(?:\.\d+)?)\s+y:\s*(\d+(?:\.\d+)?)\s*(?:scale:\s*(\d+(?:\.\d+)?))?\s*\}/);
                if (transformMatch) {
                    entity.position = {
                        x: parseFloat(transformMatch[1]),
                        y: parseFloat(transformMatch[2])
                    };
                    if (transformMatch[3]) {
                        entity.scale = { x: parseFloat(transformMatch[3]), y: parseFloat(transformMatch[3]) };
                    }
                    console.log('Found transform:', entity.position);
                }
                
                // Parse sprite with nested braces
                const spriteContent = this.extractNestedBlock(entityMatch.content, 'sprite');
                if (spriteContent) {
                    entity.sprite = {
                        texture: '',
                        width: 32,
                        height: 32
                    };
                    
                    const textureMatch = spriteContent.match(/texture:\s*"([^"]+)"/);
                    if (textureMatch) entity.sprite.texture = textureMatch[1];
                    
                    const widthMatch = spriteContent.match(/width:\s*(\d+)/);
                    if (widthMatch) entity.sprite.width = parseInt(widthMatch[1]);
                    
                    const heightMatch = spriteContent.match(/height:\s*(\d+)/);
                    if (heightMatch) entity.sprite.height = parseInt(heightMatch[1]);
                    
                    const colorMatch = spriteContent.match(/color:\s*"([^"]+)"/);
                    if (colorMatch) entity.sprite.color = colorMatch[1];
                    
                    console.log('Found sprite:', entity.sprite);
                }
                
                // Parse physics with unquoted mode values
                const physicsContent = this.extractNestedBlock(entityMatch.content, 'physics');
                if (physicsContent) {
                    entity.physics = {};
                    
                    const modeMatch = physicsContent.match(/mode:\s*(\w+)/); // No quotes in actual GDL
                    if (modeMatch) entity.physics.mode = modeMatch[1];
                    
                    const massMatch = physicsContent.match(/mass:\s*(\d+(?:\.\d+)?)/);
                    if (massMatch) entity.physics.mass = parseFloat(massMatch[1]);
                    
                    const frictionMatch = physicsContent.match(/friction:\s*(\d+(?:\.\d+)?)/);
                    if (frictionMatch) entity.physics.friction = parseFloat(frictionMatch[1]);
                    
                    console.log('Found physics:', entity.physics);
                }
                
                // Parse collider with unquoted type values
                const colliderContent = this.extractNestedBlock(entityMatch.content, 'collider');
                if (colliderContent) {
                    entity.collider = {};
                    
                    const typeMatch = colliderContent.match(/type:\s*(\w+)/); // No quotes in actual GDL
                    if (typeMatch) entity.collider.type = typeMatch[1];
                    
                    const widthMatch = colliderContent.match(/width:\s*(\d+)/);
                    if (widthMatch) entity.collider.width = parseInt(widthMatch[1]);
                    
                    const heightMatch = colliderContent.match(/height:\s*(\d+)/);
                    if (heightMatch) entity.collider.height = parseInt(heightMatch[1]);
                    
                    const radiusMatch = colliderContent.match(/radius:\s*(\d+)/);
                    if (radiusMatch) entity.collider.radius = parseInt(radiusMatch[1]);
                    
                    entity.collider.isTrigger = colliderContent.includes('isSensor: true');
                    
                    console.log('Found collider:', entity.collider);
                }
                
                // Parse behaviors with parameters
                const behaviorMatches = entityMatch.content.match(/behavior:\s*(\w+)(?:\s*\{[^}]*\})?/g);
                if (behaviorMatches) {
                    entity.behaviors = behaviorMatches.map(b => {
                        const match = b.match(/behavior:\s*(\w+)/);
                        return match ? match[1] : '';
                    }).filter(b => b);
                    console.log('Found behaviors:', entity.behaviors);
                }
                
                this.levelData.entities.push(entity);
            }
            
            console.log('Parsed', this.levelData.entities.length, 'entities');
            
            // Update UI
            this.updateSceneProperties();
            this.render();
            this.updateHierarchy();
        } catch (error) {
            console.error('Failed to parse GDL:', error);
        }
    }

    private extractEntities(gdlContent: string): Array<{name: string, content: string}> {
        const entities: Array<{name: string, content: string}> = [];
        const lines = gdlContent.split('\n');
        let currentEntity: {name: string, content: string} | null = null;
        let braceCount = 0;
        let inEntity = false;
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            
            // Skip comments and empty lines
            if (line.startsWith('//') || line === '') continue;
            
            // Check for entity start
            const entityMatch = line.match(/^\s*entity\s+(\w+)\s*\{/);
            if (entityMatch) {
                if (currentEntity) {
                    entities.push(currentEntity);
                }
                currentEntity = { name: entityMatch[1], content: '' };
                braceCount = 1;
                inEntity = true;
                continue;
            }
            
            if (inEntity && currentEntity) {
                // Count braces to handle nested blocks
                const openBraces = (line.match(/\{/g) || []).length;
                const closeBraces = (line.match(/\}/g) || []).length;
                braceCount += openBraces - closeBraces;
                
                currentEntity.content += line + '\n';
                
                // Entity ends when brace count reaches 0
                if (braceCount === 0) {
                    entities.push(currentEntity);
                    currentEntity = null;
                    inEntity = false;
                }
            }
        }
        
        // Handle case where file ends without closing brace
        if (currentEntity) {
            entities.push(currentEntity);
        }
        
        return entities;
    }

    private extractNestedBlock(content: string, blockName: string): string | null {
        const regex = new RegExp(`${blockName}:\\s*\\{`);
        const match = content.match(regex);
        if (!match) return null;
        
        const startIndex = content.indexOf(match[0]) + match[0].length;
        let braceCount = 1;
        let endIndex = startIndex;
        
        for (let i = startIndex; i < content.length && braceCount > 0; i++) {
            if (content[i] === '{') braceCount++;
            else if (content[i] === '}') braceCount--;
            endIndex = i;
        }
        
        return content.substring(startIndex, endIndex);
    }

    private guessEntityType(name: string): string {
        const lowerName = name.toLowerCase();
        if (lowerName.includes('player')) return 'Player';
        if (lowerName.includes('platform')) return 'Platform';
        if (lowerName.includes('enemy')) return 'Enemy';
        if (lowerName.includes('coin')) return 'Coin';
        if (lowerName.includes('spike')) return 'Spike';
        if (lowerName.includes('checkpoint')) return 'Checkpoint';
        if (lowerName.includes('spring')) return 'Spring';
        return 'Platform';
    }

    private updateSceneProperties() {
        (document.getElementById('scene-name') as HTMLInputElement).value = this.levelData.sceneName;
        (document.getElementById('scene-width') as HTMLInputElement).value = this.levelData.width.toString();
        (document.getElementById('scene-height') as HTMLInputElement).value = this.levelData.height.toString();
        (document.getElementById('scene-background') as HTMLInputElement).value = this.levelData.background;
        (document.getElementById('scene-gravity') as HTMLInputElement).value = this.levelData.gravity.toString();
    }

    private handleAssetsLoaded(sprites: { [key: string]: string }, _sounds: string[]) {
        this.loadedSprites = {};
        
        // Load sprites
        Object.entries(sprites).forEach(([fileName, data]) => {
            if (data.startsWith('data:image')) {
                const img = new Image();
                img.src = data;
                img.onload = () => {
                    this.loadedSprites[fileName] = img;
                    this.render();
                };
            } else if (data.startsWith('<svg')) {
                this.loadedSprites[fileName] = data;
                this.render();
            }
        });
    }

    private handlePrefabsLoaded(prefabs: { [key: string]: any }) {
        this.prefabs = prefabs;
        this.updatePrefabsList();
    }

    private handleTemplatesLoaded(templates: { [key: string]: any }) {
        this.entityTemplates = templates;
        this.updateEntityLibrary();
    }

    private updateEntityLibrary() {
        const container = document.getElementById('basic-entities')!;
        container.innerHTML = '';

        Object.entries(this.entityTemplates).forEach(([type, template]) => {
            const item = document.createElement('div');
            item.className = 'entity-template';
            item.draggable = true;
            item.dataset.entityType = type;
            
            const color = template.sprite?.color || this.getDefaultColor(type);
            
            item.innerHTML = `
                <div class="entity-preview" style="background-color: ${color};">
                    <span class="entity-icon">${this.getEntityIcon(type)}</span>
                </div>
                <span class="entity-label">${type}</span>
            `;
            
            container.appendChild(item);
        });
    }

    private updatePrefabsList() {
        const container = document.getElementById('prefabs')!;
        container.innerHTML = '';

        Object.entries(this.prefabs).forEach(([name, _prefab]) => {
            const item = document.createElement('div');
            item.className = 'entity-template';
            item.draggable = true;
            item.dataset.prefabName = name;
            
            item.innerHTML = `
                <div class="entity-preview" style="background-color: #9b59b6;">
                    <span class="entity-icon">E</span>
                </div>
                <span class="entity-label">${name}</span>
            `;
            
            container.appendChild(item);
        });
    }

    private saveLevel() {
        this.updateGDL();
        // Show save confirmation in UI instead of VS Code message
        const statusBar = document.querySelector('.status-bar');
        if (statusBar) {
            const saveIndicator = document.createElement('div');
            saveIndicator.className = 'status-item';
            saveIndicator.innerHTML = '<span style="color: #4caf50;">✓ Level saved</span>';
            statusBar.appendChild(saveIndicator);
            setTimeout(() => saveIndicator.remove(), 3000);
        }
    }

    private showExportDialog() {
        const format = prompt('Export format: json, typescript, or gdl?', 'json');
        if (format) {
            this.vscode.postMessage({
                command: 'exportLevel',
                format: format
            });
        }
    }

    // Tool handlers
    private handleSelectTool(e: MouseEvent) {
        const rect = this.selectionCanvas.getBoundingClientRect();
        const screenX = e.clientX - rect.left;
        const screenY = e.clientY - rect.top;
        const worldPos = this.screenToWorld(screenX, screenY);
        
        this.handleSelection(worldPos, e.shiftKey);
        if (this.selectedEntities.size > 0) {
            this.saveStateForUndo();
            this.isDragging = true;
            this.dragStartPositions = new Map();
            this.selectedEntities.forEach(id => {
                const entity = this.findEntity(id);
                if (entity) {
                    this.dragStartPositions.set(id, { ...entity.position });
                }
            });
        }
    }

    private handleSelectMove(e: MouseEvent) {
        if (!this.isDragging) return;
        
        const rect = this.selectionCanvas.getBoundingClientRect();
        const screenX = e.clientX - rect.left;
        const screenY = e.clientY - rect.top;
        const worldPos = this.screenToWorld(screenX, screenY);
        
        const dx = worldPos.x - this.dragStart.x;
        const dy = worldPos.y - this.dragStart.y;
        
        this.selectedEntities.forEach(id => {
            const entity = this.findEntity(id);
            const startPos = this.dragStartPositions.get(id);
            
            if (entity && startPos && !this.layers[entity.layer].locked) {
                entity.position.x = startPos.x + dx;
                entity.position.y = startPos.y + dy;
                
                if (this.snapToGrid) {
                    entity.position.x = Math.round(entity.position.x / this.gridSize) * this.gridSize;
                    entity.position.y = Math.round(entity.position.y / this.gridSize) * this.gridSize;
                }
                
                entity.position.x = Math.max(0, entity.position.x);
                entity.position.y = Math.max(0, entity.position.y);
            }
        });
        
        this.render();
        this.updateEntityInspector();
    }

    private handleSelectUp(_e: MouseEvent) {
        if (this.isDragging) {
            this.updateGDL();
            this.dragStartPositions.clear();
        }
    }

    private handleMoveTool(e: MouseEvent) {
        this.handleSelectTool(e);
    }

    private handleMoveMove(e: MouseEvent) {
        this.handleSelectMove(e);
    }

    private handleMoveUp(e: MouseEvent) {
        this.handleSelectUp(e);
    }

    private handleRotateTool(e: MouseEvent) {
        const rect = this.selectionCanvas.getBoundingClientRect();
        const screenX = e.clientX - rect.left;
        const screenY = e.clientY - rect.top;
        const worldPos = this.screenToWorld(screenX, screenY);
        
        this.handleSelection(worldPos, e.shiftKey);
        if (this.selectedEntities.size > 0) {
            this.saveStateForUndo();
            this.isDragging = true;
            
            // Calculate center of selected entities
            let centerX = 0, centerY = 0;
            this.selectedEntities.forEach(id => {
                const entity = this.findEntity(id);
                if (entity) {
                    centerX += entity.position.x + (entity.sprite?.width || 32) / 2;
                    centerY += entity.position.y + (entity.sprite?.height || 32) / 2;
                }
            });
            centerX /= this.selectedEntities.size;
            centerY /= this.selectedEntities.size;
            
            this.transformOrigin = { x: centerX, y: centerY };
            this.rotationStart = Math.atan2(worldPos.y - centerY, worldPos.x - centerX);
        }
    }

    private handleRotateMove(e: MouseEvent) {
        if (!this.isDragging) return;
        
        const rect = this.selectionCanvas.getBoundingClientRect();
        const screenX = e.clientX - rect.left;
        const screenY = e.clientY - rect.top;
        const worldPos = this.screenToWorld(screenX, screenY);
        
        const currentAngle = Math.atan2(worldPos.y - this.transformOrigin.y, worldPos.x - this.transformOrigin.x);
        const deltaAngle = (currentAngle - this.rotationStart) * 180 / Math.PI;
        
        this.selectedEntities.forEach(id => {
            const entity = this.findEntity(id);
            if (entity && !this.layers[entity.layer].locked) {
                entity.rotation = (entity.rotation + deltaAngle) % 360;
            }
        });
        
        this.rotationStart = currentAngle;
        this.render();
        this.updateEntityInspector();
    }

    private handleRotateUp(_e: MouseEvent) {
        if (this.isDragging) {
            this.updateGDL();
        }
    }

    private handleScaleTool(e: MouseEvent) {
        const rect = this.selectionCanvas.getBoundingClientRect();
        const screenX = e.clientX - rect.left;
        const screenY = e.clientY - rect.top;
        const worldPos = this.screenToWorld(screenX, screenY);
        
        this.handleSelection(worldPos, e.shiftKey);
        if (this.selectedEntities.size > 0) {
            this.saveStateForUndo();
            this.isDragging = true;
            
            // Store initial scales
            this.selectedEntities.forEach(id => {
                const entity = this.findEntity(id);
                if (entity) {
                    this.scaleStart = { ...entity.scale };
                }
            });
        }
    }

    private handleScaleMove(e: MouseEvent) {
        if (!this.isDragging) return;
        
        const rect = this.selectionCanvas.getBoundingClientRect();
        const screenX = e.clientX - rect.left;
        const screenY = e.clientY - rect.top;
        const worldPos = this.screenToWorld(screenX, screenY);
        
        // Calculate scale factor based on distance from drag start
        const distance = Math.sqrt(
            Math.pow(worldPos.x - this.dragStart.x, 2) + 
            Math.pow(worldPos.y - this.dragStart.y, 2)
        );
        const scaleFactor = Math.max(0.1, 1 + distance / 100);
        
        this.selectedEntities.forEach(id => {
            const entity = this.findEntity(id);
            if (entity && !this.layers[entity.layer].locked) {
                entity.scale.x = this.scaleStart.x * scaleFactor;
                entity.scale.y = this.scaleStart.y * scaleFactor;
            }
        });
        
        this.render();
        this.updateEntityInspector();
    }

    private handleScaleUp(_e: MouseEvent) {
        if (this.isDragging) {
            this.updateGDL();
        }
    }

    private handlePanTool(e: MouseEvent) {
        const rect = this.selectionCanvas.getBoundingClientRect();
        const screenX = e.clientX - rect.left;
        const screenY = e.clientY - rect.top;
        
        this.isPanning = true;
        this.lastMousePos = { x: screenX, y: screenY };
        this.updateCursor();
    }

    private handlePanMove(e: MouseEvent) {
        if (!this.isPanning) return;
        
        const rect = this.selectionCanvas.getBoundingClientRect();
        const screenX = e.clientX - rect.left;
        const screenY = e.clientY - rect.top;
        
        const dx = screenX - this.lastMousePos.x;
        const dy = screenY - this.lastMousePos.y;
        
        this.camera.x += dx;
        this.camera.y += dy;
        
        this.lastMousePos = { x: screenX, y: screenY };
        this.render();
    }

    private handlePanUp(_e: MouseEvent) {
        this.isPanning = false;
        this.updateCursor();
    }

    // Undo/Redo system
    private saveStateForUndo() {
        const state = this.generateGDL();
        this.undoStack.push(state);
        
        if (this.undoStack.length > this.maxUndoSteps) {
            this.undoStack.shift();
        }
        
        // Clear redo stack when new action is performed
        this.redoStack = [];
    }

    private undo() {
        if (this.undoStack.length === 0) return;
        
        // Save current state to redo stack
        const currentState = this.generateGDL();
        this.redoStack.push(currentState);
        
        // Restore previous state
        const previousState = this.undoStack.pop()!;
        this.parseGDL(previousState);
    }

    private redo() {
        if (this.redoStack.length === 0) return;
        
        // Save current state to undo stack
        const currentState = this.generateGDL();
        this.undoStack.push(currentState);
        
        // Restore redo state
        const redoState = this.redoStack.pop()!;
        this.parseGDL(redoState);
    }
}

// Initialize when DOM is loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => new LevelDesigner());
} else {
    new LevelDesigner();
}