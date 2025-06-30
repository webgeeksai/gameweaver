// Sprite Editor Webview Entry Point
// This implements the drawing functionality for the sprite editor

declare const acquireVsCodeApi: any;

// interface DrawingTool {
//     name: string;
//     cursor: string;
//     size: number;
//     opacity: number;
// }

interface Layer {
    id: number;
    name: string;
    visible: boolean;
    opacity: number;
    canvas: HTMLCanvasElement;
    context: CanvasRenderingContext2D;
}

interface AnimationFrame {
    id: number;
    canvas: HTMLCanvasElement;
    context: CanvasRenderingContext2D;
    duration: number;
}

interface SpriteProject {
    name: string;
    width: number;
    height: number;
    layers: Layer[];
    frames: AnimationFrame[];
    currentFrame: number;
    frameRate: number;
    loop: boolean;
}

class SpriteEditor {
    private vscode = acquireVsCodeApi();
    private project!: SpriteProject;
    private currentTool: string = 'brush-tool';
    private currentLayer: number = 0;
    private primaryColor: string = '#000000';
    private secondaryColor: string = '#ffffff';
    private isDrawing: boolean = false;
    private lastX: number = 0;
    private lastY: number = 0;
    private mainCanvas!: HTMLCanvasElement;
    private mainContext!: CanvasRenderingContext2D;
    private gridCanvas!: HTMLCanvasElement;
    private gridContext!: CanvasRenderingContext2D;
    private onionCanvas!: HTMLCanvasElement;
    private onionContext!: CanvasRenderingContext2D;
    private brushSize: number = 1;
    private brushOpacity: number = 100;
    private showGrid: boolean = true;
    private showOnionSkin: boolean = false;
    private zoom: number = 4;
    private panX: number = 0;
    private panY: number = 0;
    private isPanning: boolean = false;
    private spacePressed: boolean = false;
    private lastPanX: number = 0;
    private lastPanY: number = 0;
    private animationTimer: number | null = null;
    private undoStack: ImageData[] = [];
    private redoStack: ImageData[] = [];
    private startShape: { x: number, y: number } = { x: 0, y: 0 };
    private previewCanvas!: HTMLCanvasElement;
    private previewContext!: CanvasRenderingContext2D;

    constructor() {
        this.setupCanvas();
        this.initializeProject();
        this.updateCanvasSize(); // Now safe to call after project is initialized
        this.setupEventListeners();
        this.drawGrid();
        this.updateUI();
        console.log('🎨 Sprite Editor initialized');
    }

    private initializeProject() {
        this.project = {
            name: 'New Sprite',
            width: 32,
            height: 32,
            layers: [],
            frames: [],
            currentFrame: 0,
            frameRate: 12,
            loop: true
        };

        // Create initial layer
        this.addLayer('Layer 1');
        
        // Create initial frame
        this.addFrame();
    }

    private setupCanvas() {
        this.mainCanvas = document.getElementById('sprite-canvas') as HTMLCanvasElement;
        this.gridCanvas = document.getElementById('grid-canvas') as HTMLCanvasElement;
        this.onionCanvas = document.getElementById('onion-canvas') as HTMLCanvasElement;

        if (!this.mainCanvas || !this.gridCanvas || !this.onionCanvas) {
            console.error('❌ Canvas elements not found');
            return;
        }

        this.mainContext = this.mainCanvas.getContext('2d')!;
        this.gridContext = this.gridCanvas.getContext('2d')!;
        this.onionContext = this.onionCanvas.getContext('2d')!;
        
        // Create preview canvas
        this.previewCanvas = document.createElement('canvas');
        this.previewContext = this.previewCanvas.getContext('2d')!;

        // Initialize with default size before project is created
        const defaultSize = 32;
        [this.mainCanvas, this.gridCanvas, this.onionCanvas].forEach(canvas => {
            canvas.width = defaultSize;
            canvas.height = defaultSize;
        });

        // Set canvas properties
        this.setupCanvasStyle();
    }

    private updateCanvasSize() {
        const size = this.project.width * this.zoom;
        
        [this.mainCanvas, this.gridCanvas, this.onionCanvas].forEach(canvas => {
            canvas.width = this.project.width;
            canvas.height = this.project.height;
            canvas.style.width = `${size}px`;
            canvas.style.height = `${size}px`;
            canvas.style.imageRendering = 'pixelated';
        });

        // Update preview canvas size
        this.previewCanvas.width = this.project.width;
        this.previewCanvas.height = this.project.height;

        // Update contexts
        [this.mainContext, this.gridContext, this.onionContext, this.previewContext].forEach(ctx => {
            ctx.imageSmoothingEnabled = false;
        });

        this.updateCanvasTransform();
    }

    private updateCanvasTransform() {
        [this.mainCanvas, this.gridCanvas, this.onionCanvas].forEach(canvas => {
            canvas.style.transform = `translate(${this.panX}px, ${this.panY}px)`;
        });
    }

    private setupCanvasStyle() {
        const container = document.querySelector('.canvas-container') as HTMLElement;
        if (container) {
            container.style.position = 'relative';
            container.style.display = 'inline-block';
        }

        // Stack canvases
        [this.onionCanvas, this.mainCanvas, this.gridCanvas].forEach((canvas, index) => {
            canvas.style.position = 'absolute';
            canvas.style.left = '0';
            canvas.style.top = '0';
            canvas.style.zIndex = (index + 1).toString();
        });

        this.gridCanvas.style.pointerEvents = 'none';
        this.onionCanvas.style.pointerEvents = 'none';
    }

    private setupEventListeners() {
        // Tool selection
        document.querySelectorAll('.tool-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const toolId = (e.currentTarget as HTMLElement).id;
                this.selectTool(toolId);
            });
        });

        // Canvas drawing events
        this.mainCanvas.addEventListener('mousedown', this.onMouseDown.bind(this));
        this.mainCanvas.addEventListener('mousemove', this.onMouseMove.bind(this));
        this.mainCanvas.addEventListener('mouseup', this.onMouseUp.bind(this));
        this.mainCanvas.addEventListener('mouseout', this.onMouseUp.bind(this));
        this.mainCanvas.addEventListener('wheel', this.onWheel.bind(this));
        this.mainCanvas.addEventListener('mouseleave', () => {
            this.isPanning = false;
            this.isDrawing = false;
            this.updateCursor();
        });

        // Color picker
        const colorPicker = document.getElementById('color-picker') as HTMLInputElement;
        colorPicker?.addEventListener('change', (e) => {
            this.primaryColor = (e.target as HTMLInputElement).value;
            this.updateColorDisplay();
        });

        // Palette colors
        document.querySelectorAll('.palette-color').forEach(color => {
            color.addEventListener('click', (e) => {
                const colorValue = (e.target as HTMLElement).dataset.color;
                if (colorValue) {
                    this.primaryColor = colorValue;
                    this.updateColorDisplay();
                }
            });
        });

        // Brush controls
        const brushSizeSlider = document.getElementById('brush-size') as HTMLInputElement;
        brushSizeSlider?.addEventListener('input', (e) => {
            this.brushSize = parseInt((e.target as HTMLInputElement).value);
            this.updateToolOptions();
        });

        const brushOpacitySlider = document.getElementById('brush-opacity') as HTMLInputElement;
        brushOpacitySlider?.addEventListener('input', (e) => {
            this.brushOpacity = parseInt((e.target as HTMLInputElement).value);
            this.updateToolOptions();
        });

        // Canvas controls
        const canvasSizeSelect = document.getElementById('canvas-size') as HTMLSelectElement;
        canvasSizeSelect?.addEventListener('change', (e) => {
            const size = parseInt((e.target as HTMLSelectElement).value);
            this.resizeCanvas(size, size);
        });

        const zoomSelect = document.getElementById('zoom-level') as HTMLSelectElement;
        zoomSelect?.addEventListener('change', (e) => {
            this.setZoom(parseFloat((e.target as HTMLSelectElement).value));
        });

        // Toggle buttons
        document.getElementById('grid-toggle')?.addEventListener('click', () => {
            this.showGrid = !this.showGrid;
            this.toggleGrid();
        });

        document.getElementById('onion-skin-toggle')?.addEventListener('click', () => {
            this.showOnionSkin = !this.showOnionSkin;
            this.toggleOnionSkin();
        });

        // File operations
        document.getElementById('new-btn')?.addEventListener('click', () => this.newSprite());
        document.getElementById('save-btn')?.addEventListener('click', () => this.saveSprite());
        document.getElementById('export-btn')?.addEventListener('click', () => this.exportSprite());

        // Undo/Redo
        document.getElementById('undo-btn')?.addEventListener('click', () => this.undo());
        document.getElementById('redo-btn')?.addEventListener('click', () => this.redo());

        // Layer controls
        document.getElementById('add-layer-btn')?.addEventListener('click', () => this.addLayer());

        // Animation controls
        document.getElementById('add-frame-btn')?.addEventListener('click', () => this.addFrame());
        document.getElementById('play-animation-btn')?.addEventListener('click', () => this.playAnimation());
        document.getElementById('stop-animation-btn')?.addEventListener('click', () => this.stopAnimation());

        // Keyboard shortcuts
        document.addEventListener('keydown', this.handleKeydown.bind(this));
        document.addEventListener('keyup', this.handleKeyup.bind(this));
    }

    private selectTool(toolId: string) {
        // Remove active class from all tools
        document.querySelectorAll('.tool-btn').forEach(btn => {
            btn.classList.remove('active');
        });

        // Add active class to selected tool
        const selectedTool = document.getElementById(toolId);
        selectedTool?.classList.add('active');

        this.currentTool = toolId;
        this.updateCursor();
    }

    private updateCursor() {
        if (this.isPanning) {
            this.mainCanvas.style.cursor = 'grabbing';
            return;
        }

        if (this.spacePressed || this.currentTool === 'pan-tool') {
            this.mainCanvas.style.cursor = 'grab';
            return;
        }

        const cursors: { [key: string]: string } = {
            'brush-tool': 'crosshair',
            'pencil-tool': 'crosshair',
            'eraser-tool': 'crosshair',
            'fill-tool': 'crosshair',
            'eyedropper-tool': 'crosshair',
            'rect-tool': 'crosshair',
            'circle-tool': 'crosshair',
            'line-tool': 'crosshair',
            'pan-tool': 'grab'
        };

        this.mainCanvas.style.cursor = cursors[this.currentTool] || 'default';
    }

    private getMousePos(e: MouseEvent): { x: number, y: number } {
        const rect = this.mainCanvas.getBoundingClientRect();
        return {
            x: Math.floor((e.clientX - rect.left - this.panX) / this.zoom),
            y: Math.floor((e.clientY - rect.top - this.panY) / this.zoom)
        };
    }

    private getScreenPos(e: MouseEvent): { x: number, y: number } {
        const rect = this.mainCanvas.getBoundingClientRect();
        return {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };
    }

    private onMouseDown(e: MouseEvent) {
        const screenPos = this.getScreenPos(e);
        this.lastPanX = screenPos.x;
        this.lastPanY = screenPos.y;

        // Check for panning (middle mouse, Alt+click, Space+click, or pan tool)
        if (e.button === 1 || (e.button === 0 && e.altKey) || (e.button === 0 && this.spacePressed) || (e.button === 0 && this.currentTool === 'pan-tool')) {
            this.isPanning = true;
            this.updateCursor();
            e.preventDefault();
            return;
        }

        // Regular drawing
        if (e.button === 0) {
            this.startDrawing(e);
        }
    }

    private startDrawing(e: MouseEvent) {
        this.isDrawing = true;
        const pos = this.getMousePos(e);
        this.lastX = pos.x;
        this.lastY = pos.y;

        // Save state for undo
        this.saveState();

        // Handle different tools
        switch (this.currentTool) {
            case 'brush-tool':
            case 'pencil-tool':
                this.drawPixel(pos.x, pos.y);
                break;
            case 'eraser-tool':
                this.erasePixel(pos.x, pos.y);
                break;
            case 'fill-tool':
                this.floodFill(pos.x, pos.y);
                break;
            case 'eyedropper-tool':
                this.pickColor(pos.x, pos.y);
                break;
            case 'rect-tool':
                this.startShape = pos;
                break;
            case 'circle-tool':
                this.startShape = pos;
                break;
            case 'line-tool':
                this.startShape = pos;
                break;
        }
    }

    private onMouseMove(e: MouseEvent) {
        const screenPos = this.getScreenPos(e);

        if (this.isPanning) {
            const dx = screenPos.x - this.lastPanX;
            const dy = screenPos.y - this.lastPanY;
            this.panX += dx;
            this.panY += dy;
            this.lastPanX = screenPos.x;
            this.lastPanY = screenPos.y;
            this.updateCanvasTransform();
            return;
        }

        if (this.isDrawing) {
            this.draw(e);
        }
    }

    private draw(e: MouseEvent) {
        if (!this.isDrawing) return;

        const pos = this.getMousePos(e);

        switch (this.currentTool) {
            case 'brush-tool':
            case 'pencil-tool':
                this.drawLine(this.lastX, this.lastY, pos.x, pos.y);
                break;
            case 'eraser-tool':
                this.eraseLine(this.lastX, this.lastY, pos.x, pos.y);
                break;
            case 'rect-tool':
                this.drawPreviewRect(this.startShape, pos);
                break;
            case 'circle-tool':
                this.drawPreviewCircle(this.startShape, pos);
                break;
            case 'line-tool':
                this.drawPreviewLine(this.startShape, pos);
                break;
        }

        this.lastX = pos.x;
        this.lastY = pos.y;
    }

    private onMouseUp(_e: MouseEvent) {
        this.stopDrawing();
        this.isPanning = false;
        this.updateCursor();
    }

    private stopDrawing() {
        if (this.isDrawing) {
            // Complete shape tools
            const pos = { x: this.lastX, y: this.lastY };
            switch (this.currentTool) {
                case 'rect-tool':
                    this.drawRect(this.startShape, pos);
                    break;
                case 'circle-tool':
                    this.drawCircle(this.startShape, pos);
                    break;
                case 'line-tool':
                    this.drawStraightLine(this.startShape, pos);
                    break;
            }
            this.clearPreview();
        }
        this.isDrawing = false;
    }

    private drawPixel(x: number, y: number) {
        const ctx = this.getCurrentLayerContext();
        if (!ctx) return;

        ctx.globalAlpha = this.brushOpacity / 100;
        ctx.fillStyle = this.primaryColor;
        
        if (this.brushSize === 1) {
            ctx.fillRect(x, y, 1, 1);
        } else {
            const halfSize = Math.floor(this.brushSize / 2);
            ctx.fillRect(x - halfSize, y - halfSize, this.brushSize, this.brushSize);
        }
        
        ctx.globalAlpha = 1;
        this.composeLayers();
    }

    private drawLine(x0: number, y0: number, x1: number, y1: number) {
        // Bresenham's line algorithm
        const dx = Math.abs(x1 - x0);
        const dy = Math.abs(y1 - y0);
        const sx = x0 < x1 ? 1 : -1;
        const sy = y0 < y1 ? 1 : -1;
        let err = dx - dy;

        let x = x0;
        let y = y0;

        // eslint-disable-next-line no-constant-condition
        while (true) {
            this.drawPixel(x, y);

            if (x === x1 && y === y1) break;

            const e2 = 2 * err;
            if (e2 > -dy) {
                err -= dy;
                x += sx;
            }
            if (e2 < dx) {
                err += dx;
                y += sy;
            }
        }
    }

    private erasePixel(x: number, y: number) {
        const ctx = this.getCurrentLayerContext();
        if (!ctx) return;

        if (this.brushSize === 1) {
            ctx.clearRect(x, y, 1, 1);
        } else {
            const halfSize = Math.floor(this.brushSize / 2);
            ctx.clearRect(x - halfSize, y - halfSize, this.brushSize, this.brushSize);
        }
        
        this.composeLayers();
    }

    private eraseLine(x0: number, y0: number, x1: number, y1: number) {
        const dx = Math.abs(x1 - x0);
        const dy = Math.abs(y1 - y0);
        const sx = x0 < x1 ? 1 : -1;
        const sy = y0 < y1 ? 1 : -1;
        let err = dx - dy;

        let x = x0;
        let y = y0;

        // eslint-disable-next-line no-constant-condition
        while (true) {
            this.erasePixel(x, y);

            if (x === x1 && y === y1) break;

            const e2 = 2 * err;
            if (e2 > -dy) {
                err -= dy;
                x += sx;
            }
            if (e2 < dx) {
                err += dx;
                y += sy;
            }
        }
    }

    private floodFill(startX: number, startY: number) {
        const ctx = this.getCurrentLayerContext();
        if (!ctx) return;

        const imageData = ctx.getImageData(0, 0, this.project.width, this.project.height);
        const data = imageData.data;
        const targetColor = this.getPixelColor(data, startX, startY);
        const fillColor = this.hexToRgba(this.primaryColor);

        if (this.colorsEqual(targetColor, fillColor)) return;

        const stack = [{ x: startX, y: startY }];

        while (stack.length > 0) {
            const { x, y } = stack.pop()!;
            
            if (x < 0 || x >= this.project.width || y < 0 || y >= this.project.height) continue;
            
            const currentColor = this.getPixelColor(data, x, y);
            if (!this.colorsEqual(currentColor, targetColor)) continue;

            this.setPixelColor(data, x, y, fillColor);

            stack.push({ x: x + 1, y });
            stack.push({ x: x - 1, y });
            stack.push({ x, y: y + 1 });
            stack.push({ x, y: y - 1 });
        }

        ctx.putImageData(imageData, 0, 0);
        this.composeLayers();
    }

    private pickColor(x: number, y: number) {
        const ctx = this.getCurrentLayerContext();
        if (!ctx) return;

        const imageData = ctx.getImageData(x, y, 1, 1);
        const data = imageData.data;
        
        if (data[3] > 0) { // If pixel is not transparent
            this.primaryColor = this.rgbToHex(data[0], data[1], data[2]);
            this.updateColorDisplay();
        }
    }

    private getPixelColor(data: Uint8ClampedArray, x: number, y: number): [number, number, number, number] {
        const index = (y * this.project.width + x) * 4;
        return [data[index], data[index + 1], data[index + 2], data[index + 3]];
    }

    private setPixelColor(data: Uint8ClampedArray, x: number, y: number, color: [number, number, number, number]) {
        const index = (y * this.project.width + x) * 4;
        data[index] = color[0];
        data[index + 1] = color[1];
        data[index + 2] = color[2];
        data[index + 3] = color[3];
    }

    private colorsEqual(a: [number, number, number, number], b: [number, number, number, number]): boolean {
        return a[0] === b[0] && a[1] === b[1] && a[2] === b[2] && a[3] === b[3];
    }

    private hexToRgba(hex: string): [number, number, number, number] {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return [r, g, b, Math.floor(255 * this.brushOpacity / 100)];
    }

    private rgbToHex(r: number, g: number, b: number): string {
        return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
    }

    private getCurrentLayerContext(): CanvasRenderingContext2D | null {
        const currentFrame = this.project.frames[this.project.currentFrame];
        if (!currentFrame) return null;
        
        const currentLayer = this.project.layers[this.currentLayer];
        if (!currentLayer) return null;

        return currentLayer.context;
    }

    private addLayer(name?: string) {
        const layerId = this.project.layers.length;
        const layerName = name || `Layer ${layerId + 1}`;
        
        const canvas = document.createElement('canvas');
        canvas.width = this.project.width;
        canvas.height = this.project.height;
        const context = canvas.getContext('2d')!;
        context.imageSmoothingEnabled = false;

        const layer: Layer = {
            id: layerId,
            name: layerName,
            visible: true,
            opacity: 100,
            canvas,
            context
        };

        this.project.layers.push(layer);
        this.updateLayersList();
        this.composeLayers();
    }

    private addFrame() {
        const frameId = this.project.frames.length;
        
        const canvas = document.createElement('canvas');
        canvas.width = this.project.width;
        canvas.height = this.project.height;
        const context = canvas.getContext('2d')!;
        context.imageSmoothingEnabled = false;

        const frame: AnimationFrame = {
            id: frameId,
            canvas,
            context,
            duration: 1000 / this.project.frameRate
        };

        this.project.frames.push(frame);
        this.updateTimeline();
    }

    private composeLayers() {
        if (!this.mainContext || !this.project) return;
        
        // Clear main canvas
        this.mainContext.clearRect(0, 0, this.project.width, this.project.height);

        // Composite all visible layers
        this.project.layers.forEach(layer => {
            if (layer.visible) {
                this.mainContext.globalAlpha = layer.opacity / 100;
                this.mainContext.drawImage(layer.canvas, 0, 0);
            }
        });

        this.mainContext.globalAlpha = 1;
    }

    private drawGrid() {
        if (!this.gridContext || !this.project) return;
        
        if (!this.showGrid) {
            this.gridContext.clearRect(0, 0, this.project.width, this.project.height);
            return;
        }

        this.gridContext.clearRect(0, 0, this.project.width, this.project.height);
        this.gridContext.strokeStyle = 'rgba(128, 128, 128, 0.3)';
        this.gridContext.lineWidth = 1 / this.zoom;

        // Draw vertical lines
        for (let x = 0; x <= this.project.width; x++) {
            this.gridContext.beginPath();
            this.gridContext.moveTo(x, 0);
            this.gridContext.lineTo(x, this.project.height);
            this.gridContext.stroke();
        }

        // Draw horizontal lines
        for (let y = 0; y <= this.project.height; y++) {
            this.gridContext.beginPath();
            this.gridContext.moveTo(0, y);
            this.gridContext.lineTo(this.project.width, y);
            this.gridContext.stroke();
        }
    }

    private toggleGrid() {
        const gridBtn = document.getElementById('grid-toggle');
        if (gridBtn) {
            gridBtn.classList.toggle('active');
        }
        this.drawGrid();
    }

    private toggleOnionSkin() {
        const onionBtn = document.getElementById('onion-skin-toggle');
        if (onionBtn) {
            onionBtn.classList.toggle('active');
        }
        this.updateOnionSkin();
    }

    private updateOnionSkin() {
        this.onionContext.clearRect(0, 0, this.project.width, this.project.height);
        
        if (!this.showOnionSkin || this.project.frames.length <= 1) return;

        const prevFrame = this.project.currentFrame - 1;
        const nextFrame = this.project.currentFrame + 1;

        // Draw previous frame in red
        if (prevFrame >= 0) {
            this.onionContext.globalAlpha = 0.3;
            this.onionContext.globalCompositeOperation = 'multiply';
            this.onionContext.fillStyle = '#ff0000';
            this.onionContext.drawImage(this.project.frames[prevFrame].canvas, 0, 0);
        }

        // Draw next frame in blue
        if (nextFrame < this.project.frames.length) {
            this.onionContext.globalAlpha = 0.3;
            this.onionContext.globalCompositeOperation = 'multiply';
            this.onionContext.fillStyle = '#0000ff';
            this.onionContext.drawImage(this.project.frames[nextFrame].canvas, 0, 0);
        }

        this.onionContext.globalAlpha = 1;
        this.onionContext.globalCompositeOperation = 'source-over';
    }

    private saveState() {
        const currentLayer = this.project.layers[this.currentLayer];
        if (!currentLayer) return;

        const imageData = currentLayer.context.getImageData(0, 0, this.project.width, this.project.height);
        this.undoStack.push(imageData);
        
        // Limit undo stack size
        if (this.undoStack.length > 50) {
            this.undoStack.shift();
        }
        
        // Clear redo stack when new action is performed
        this.redoStack = [];
    }

    private undo() {
        if (this.undoStack.length === 0) return;

        const currentLayer = this.project.layers[this.currentLayer];
        if (!currentLayer) return;

        // Save current state to redo stack
        const currentState = currentLayer.context.getImageData(0, 0, this.project.width, this.project.height);
        this.redoStack.push(currentState);

        // Restore previous state
        const previousState = this.undoStack.pop()!;
        currentLayer.context.putImageData(previousState, 0, 0);
        this.composeLayers();
    }

    private redo() {
        if (this.redoStack.length === 0) return;

        const currentLayer = this.project.layers[this.currentLayer];
        if (!currentLayer) return;

        // Save current state to undo stack
        const currentState = currentLayer.context.getImageData(0, 0, this.project.width, this.project.height);
        this.undoStack.push(currentState);

        // Restore redo state
        const redoState = this.redoStack.pop()!;
        currentLayer.context.putImageData(redoState, 0, 0);
        this.composeLayers();
    }

    private newSprite() {
        if (confirm('Create new sprite? This will clear current work.')) {
            this.initializeProject();
            this.updateCanvasSize();
            this.drawGrid();
            this.updateUI();
        }
    }

    private saveSprite() {
        const spriteData = this.mainCanvas.toDataURL('image/png');
        const fileName = prompt('Enter sprite name:', this.project.name) || this.project.name;
        
        this.vscode.postMessage({
            command: 'saveSprite',
            spriteData: spriteData,
            fileName: fileName,
            format: 'png'
        });
    }

    private exportSprite() {
        if (this.project.frames.length > 1) {
            // Export as animation
            const animationData = {
                frames: this.project.frames.map(frame => frame.canvas.toDataURL('image/png')),
                frameRate: this.project.frameRate,
                loop: this.project.loop
            };
            
            const fileName = prompt('Enter animation name:', this.project.name + '_anim') || this.project.name + '_anim';
            
            this.vscode.postMessage({
                command: 'exportAnimation',
                animationData: animationData,
                fileName: fileName
            });
        } else {
            // Export as single sprite
            this.saveSprite();
        }
    }

    private resizeCanvas(width: number, height: number) {
        this.project.width = width;
        this.project.height = height;
        this.updateCanvasSize();
        
        // Resize all layer canvases
        this.project.layers.forEach(layer => {
            const oldCanvas = layer.canvas;
            const newCanvas = document.createElement('canvas');
            newCanvas.width = width;
            newCanvas.height = height;
            const newContext = newCanvas.getContext('2d')!;
            newContext.imageSmoothingEnabled = false;
            newContext.drawImage(oldCanvas, 0, 0);
            
            layer.canvas = newCanvas;
            layer.context = newContext;
        });

        this.composeLayers();
        this.drawGrid();
    }

    private playAnimation() {
        if (this.project.frames.length <= 1) return;

        this.stopAnimation();
        
        let currentFrame = 0;
        this.animationTimer = window.setInterval(() => {
            this.project.currentFrame = currentFrame;
            this.composeLayers();
            this.updateTimeline();
            
            currentFrame++;
            if (currentFrame >= this.project.frames.length) {
                if (this.project.loop) {
                    currentFrame = 0;
                } else {
                    this.stopAnimation();
                }
            }
        }, 1000 / this.project.frameRate);
    }

    private stopAnimation() {
        if (this.animationTimer) {
            clearInterval(this.animationTimer);
            this.animationTimer = null;
        }
    }

    private updateColorDisplay() {
        const primaryColorEl = document.getElementById('primary-color');
        const colorPicker = document.getElementById('color-picker') as HTMLInputElement;
        
        if (primaryColorEl) {
            primaryColorEl.style.backgroundColor = this.primaryColor;
        }
        
        if (colorPicker) {
            colorPicker.value = this.primaryColor;
        }
    }

    private updateToolOptions() {
        const brushSizeValue = document.getElementById('brush-size-value');
        const brushOpacityValue = document.getElementById('brush-opacity-value');
        
        if (brushSizeValue) {
            brushSizeValue.textContent = `${this.brushSize}px`;
        }
        
        if (brushOpacityValue) {
            brushOpacityValue.textContent = `${this.brushOpacity}%`;
        }
    }

    private updateLayersList() {
        const layersList = document.getElementById('layers-list');
        if (!layersList) return;

        layersList.innerHTML = '';
        
        this.project.layers.forEach((layer, index) => {
            const layerEl = document.createElement('div');
            layerEl.className = `layer-item ${index === this.currentLayer ? 'active' : ''}`;
            layerEl.dataset.layer = index.toString();
            
            layerEl.innerHTML = `
                <span class="layer-name">${layer.name}</span>
                <input type="range" class="opacity-slider" min="0" max="100" value="${layer.opacity}">
                <div class="layer-controls">
                    <button class="layer-btn duplicate-layer" title="Duplicate Layer">⧉</button>
                    <button class="layer-btn delete-layer" title="Delete Layer">×</button>
                </div>
            `;
            
            layerEl.addEventListener('click', (e) => {
                if (!(e.target as HTMLElement).classList.contains('layer-btn')) {
                    this.currentLayer = index;
                    this.updateLayersList();
                }
            });
            
            const opacitySlider = layerEl.querySelector('.opacity-slider') as HTMLInputElement;
            opacitySlider?.addEventListener('input', (e) => {
                layer.opacity = parseInt((e.target as HTMLInputElement).value);
                this.composeLayers();
            });

            const duplicateBtn = layerEl.querySelector('.duplicate-layer');
            duplicateBtn?.addEventListener('click', (e) => {
                e.stopPropagation();
                this.duplicateLayer(index);
            });

            const deleteBtn = layerEl.querySelector('.delete-layer');
            deleteBtn?.addEventListener('click', (e) => {
                e.stopPropagation();
                this.deleteLayer(index);
            });
            
            layersList.appendChild(layerEl);
        });
    }

    private updateTimeline() {
        const timeline = document.getElementById('timeline');
        if (!timeline) return;

        timeline.innerHTML = '';
        
        this.project.frames.forEach((frame, index) => {
            const frameEl = document.createElement('div');
            frameEl.className = `frame ${index === this.project.currentFrame ? 'active' : ''}`;
            frameEl.dataset.frame = index.toString();
            
            const thumbnail = document.createElement('canvas');
            thumbnail.width = 32;
            thumbnail.height = 32;
            const thumbCtx = thumbnail.getContext('2d')!;
            thumbCtx.imageSmoothingEnabled = false;
            thumbCtx.drawImage(frame.canvas, 0, 0, 32, 32);
            
            frameEl.appendChild(thumbnail);
            
            const frameNumber = document.createElement('span');
            frameNumber.textContent = (index + 1).toString();
            frameEl.appendChild(frameNumber);

            const frameControls = document.createElement('div');
            frameControls.className = 'frame-controls';
            frameControls.innerHTML = `
                <button class="frame-btn duplicate-frame" title="Duplicate Frame">⧉</button>
                <button class="frame-btn delete-frame" title="Delete Frame">×</button>
            `;
            frameEl.appendChild(frameControls);
            
            frameEl.addEventListener('click', (e) => {
                if (!(e.target as HTMLElement).classList.contains('frame-btn')) {
                    this.project.currentFrame = index;
                    this.updateTimeline();
                    this.composeLayers();
                }
            });

            const duplicateBtn = frameEl.querySelector('.duplicate-frame');
            duplicateBtn?.addEventListener('click', (e) => {
                e.stopPropagation();
                this.duplicateFrame(index);
            });

            const deleteBtn = frameEl.querySelector('.delete-frame');
            deleteBtn?.addEventListener('click', (e) => {
                e.stopPropagation();
                this.deleteFrame(index);
            });
            
            timeline.appendChild(frameEl);
        });
    }

    private updateUI() {
        this.updateColorDisplay();
        this.updateToolOptions();
        this.updateLayersList();
        this.updateTimeline();
    }

    private onWheel(e: WheelEvent) {
        e.preventDefault();
        const zoomSpeed = 0.1;
        const zoomDelta = e.deltaY > 0 ? -zoomSpeed : zoomSpeed;
        const newZoom = Math.max(0.5, Math.min(20, this.zoom + zoomDelta));
        this.setZoom(newZoom);
    }

    private setZoom(newZoom: number) {
        this.zoom = newZoom;
        this.updateCanvasSize();
        this.drawGrid();
        
        // Update zoom select if it exists
        const zoomSelect = document.getElementById('zoom-level') as HTMLSelectElement;
        if (zoomSelect) {
            zoomSelect.value = this.zoom.toString();
        }
    }

    private handleKeydown(e: KeyboardEvent) {
        if (e.ctrlKey || e.metaKey) {
            switch (e.key) {
                case 'z':
                    e.preventDefault();
                    if (e.shiftKey) {
                        this.redo();
                    } else {
                        this.undo();
                    }
                    break;
                case 's':
                    e.preventDefault();
                    this.saveSprite();
                    break;
                case 'n':
                    e.preventDefault();
                    this.newSprite();
                    break;
                case '=':
                case '+':
                    e.preventDefault();
                    this.setZoom(Math.min(20, this.zoom + 0.5));
                    break;
                case '-':
                    e.preventDefault();
                    this.setZoom(Math.max(0.5, this.zoom - 0.5));
                    break;
                case '0':
                    e.preventDefault();
                    this.setZoom(4);
                    this.panX = 0;
                    this.panY = 0;
                    this.updateCanvasTransform();
                    break;
            }
        } else {
            switch (e.key) {
                case ' ':
                    e.preventDefault();
                    this.spacePressed = true;
                    this.updateCursor();
                    break;
                case 'h':
                    this.selectTool('pan-tool');
                    break;
                case '+':
                case '=':
                    e.preventDefault();
                    this.setZoom(Math.min(20, this.zoom + 0.5));
                    break;
                case '-':
                    e.preventDefault();
                    this.setZoom(Math.max(0.5, this.zoom - 0.5));
                    break;
            }
        }
    }

    private handleKeyup(e: KeyboardEvent) {
        switch (e.key) {
            case ' ':
                this.spacePressed = false;
                this.updateCursor();
                break;
        }
    }

    // Shape drawing methods
    private drawRect(start: { x: number, y: number }, end: { x: number, y: number }) {
        const ctx = this.getCurrentLayerContext();
        if (!ctx) return;

        const x = Math.min(start.x, end.x);
        const y = Math.min(start.y, end.y);
        const width = Math.abs(end.x - start.x);
        const height = Math.abs(end.y - start.y);

        ctx.globalAlpha = this.brushOpacity / 100;
        ctx.strokeStyle = this.primaryColor;
        ctx.lineWidth = this.brushSize;
        ctx.strokeRect(x, y, width, height);
        ctx.globalAlpha = 1;
        this.composeLayers();
    }

    private drawCircle(start: { x: number, y: number }, end: { x: number, y: number }) {
        const ctx = this.getCurrentLayerContext();
        if (!ctx) return;

        const centerX = start.x;
        const centerY = start.y;
        const radius = Math.sqrt(Math.pow(end.x - start.x, 2) + Math.pow(end.y - start.y, 2));

        ctx.globalAlpha = this.brushOpacity / 100;
        ctx.strokeStyle = this.primaryColor;
        ctx.lineWidth = this.brushSize;
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
        ctx.stroke();
        ctx.globalAlpha = 1;
        this.composeLayers();
    }

    private drawStraightLine(start: { x: number, y: number }, end: { x: number, y: number }) {
        const ctx = this.getCurrentLayerContext();
        if (!ctx) return;

        ctx.globalAlpha = this.brushOpacity / 100;
        ctx.strokeStyle = this.primaryColor;
        ctx.lineWidth = this.brushSize;
        ctx.beginPath();
        ctx.moveTo(start.x, start.y);
        ctx.lineTo(end.x, end.y);
        ctx.stroke();
        ctx.globalAlpha = 1;
        this.composeLayers();
    }

    // Preview methods for shape tools
    private drawPreviewRect(start: { x: number, y: number }, end: { x: number, y: number }) {
        this.clearPreview();
        
        const x = Math.min(start.x, end.x);
        const y = Math.min(start.y, end.y);
        const width = Math.abs(end.x - start.x);
        const height = Math.abs(end.y - start.y);

        this.previewContext.strokeStyle = this.primaryColor;
        this.previewContext.lineWidth = this.brushSize;
        this.previewContext.globalAlpha = 0.5;
        this.previewContext.strokeRect(x, y, width, height);
        this.previewContext.globalAlpha = 1;
        
        this.showPreview();
    }

    private drawPreviewCircle(start: { x: number, y: number }, end: { x: number, y: number }) {
        this.clearPreview();
        
        const centerX = start.x;
        const centerY = start.y;
        const radius = Math.sqrt(Math.pow(end.x - start.x, 2) + Math.pow(end.y - start.y, 2));

        this.previewContext.strokeStyle = this.primaryColor;
        this.previewContext.lineWidth = this.brushSize;
        this.previewContext.globalAlpha = 0.5;
        this.previewContext.beginPath();
        this.previewContext.arc(centerX, centerY, radius, 0, 2 * Math.PI);
        this.previewContext.stroke();
        this.previewContext.globalAlpha = 1;
        
        this.showPreview();
    }

    private drawPreviewLine(start: { x: number, y: number }, end: { x: number, y: number }) {
        this.clearPreview();
        
        this.previewContext.strokeStyle = this.primaryColor;
        this.previewContext.lineWidth = this.brushSize;
        this.previewContext.globalAlpha = 0.5;
        this.previewContext.beginPath();
        this.previewContext.moveTo(start.x, start.y);
        this.previewContext.lineTo(end.x, end.y);
        this.previewContext.stroke();
        this.previewContext.globalAlpha = 1;
        
        this.showPreview();
    }

    private clearPreview() {
        this.previewContext.clearRect(0, 0, this.project.width, this.project.height);
    }

    private showPreview() {
        // Draw preview on main canvas temporarily
        this.mainContext.save();
        this.mainContext.globalAlpha = 0.5;
        this.mainContext.drawImage(this.previewCanvas, 0, 0);
        this.mainContext.restore();
    }

    // Enhanced layer management
    private deleteLayer(layerIndex: number) {
        if (this.project.layers.length <= 1) return; // Keep at least one layer
        
        this.project.layers.splice(layerIndex, 1);
        if (this.currentLayer >= this.project.layers.length) {
            this.currentLayer = this.project.layers.length - 1;
        }
        
        this.updateLayersList();
        this.composeLayers();
    }

    private duplicateLayer(layerIndex: number) {
        const sourceLayer = this.project.layers[layerIndex];
        if (!sourceLayer) return;

        const newCanvas = document.createElement('canvas');
        newCanvas.width = this.project.width;
        newCanvas.height = this.project.height;
        const newContext = newCanvas.getContext('2d')!;
        newContext.imageSmoothingEnabled = false;
        newContext.drawImage(sourceLayer.canvas, 0, 0);

        const newLayer: Layer = {
            id: this.project.layers.length,
            name: `${sourceLayer.name} Copy`,
            visible: true,
            opacity: sourceLayer.opacity,
            canvas: newCanvas,
            context: newContext
        };

        this.project.layers.splice(layerIndex + 1, 0, newLayer);
        this.updateLayersList();
        this.composeLayers();
    }

    // Enhanced frame management
    private deleteFrame(frameIndex: number) {
        if (this.project.frames.length <= 1) return; // Keep at least one frame
        
        this.project.frames.splice(frameIndex, 1);
        if (this.project.currentFrame >= this.project.frames.length) {
            this.project.currentFrame = this.project.frames.length - 1;
        }
        
        this.updateTimeline();
        this.composeLayers();
    }

    private duplicateFrame(frameIndex: number) {
        const sourceFrame = this.project.frames[frameIndex];
        if (!sourceFrame) return;

        const newCanvas = document.createElement('canvas');
        newCanvas.width = this.project.width;
        newCanvas.height = this.project.height;
        const newContext = newCanvas.getContext('2d')!;
        newContext.imageSmoothingEnabled = false;
        newContext.drawImage(sourceFrame.canvas, 0, 0);

        const newFrame: AnimationFrame = {
            id: this.project.frames.length,
            canvas: newCanvas,
            context: newContext,
            duration: sourceFrame.duration
        };

        this.project.frames.splice(frameIndex + 1, 0, newFrame);
        this.updateTimeline();
    }

    // Project management
    private createProject(name: string, width: number, height: number) {
        this.project = {
            name: name,
            width: width,
            height: height,
            layers: [],
            frames: [],
            currentFrame: 0,
            frameRate: 12,
            loop: true
        };

        this.addLayer('Layer 1');
        this.addFrame();
        this.updateCanvasSize();
        this.drawGrid();
        this.updateUI();
    }

    private importImage(imageData: string) {
        const img = new Image();
        img.onload = () => {
            const ctx = this.getCurrentLayerContext();
            if (ctx) {
                this.saveState();
                ctx.drawImage(img, 0, 0, this.project.width, this.project.height);
                this.composeLayers();
            }
        };
        img.src = imageData;
    }
}

// Initialize when DOM is loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => new SpriteEditor());
} else {
    new SpriteEditor();
}