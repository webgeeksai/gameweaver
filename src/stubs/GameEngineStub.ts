import { EventEmitter } from 'events';

export interface GameEngineOptions {
    canvas?: HTMLCanvasElement;
    config?: any;
}

export class GameEngine extends EventEmitter {
    private running: boolean = false;
    private canvas?: HTMLCanvasElement;

    constructor(options: GameEngineOptions = {}) {
        super();
        this.canvas = options.canvas;
        console.log('Game Engine stub initialized');
    }

    start(): void {
        if (this.running) return;
        this.running = true;
        console.log('Game started (stub)');
        this.emit('start');
    }

    stop(): void {
        if (!this.running) return;
        this.running = false;
        console.log('Game stopped (stub)');
        this.emit('stop');
    }

    isRunning(): boolean {
        return this.running;
    }

    async loadCompiledCode(compiledCode: any): Promise<void> {
        console.log('Loading compiled code (stub):', compiledCode);
        this.emit('codeLoaded', compiledCode);
    }

    getScenes(): any[] {
        return [
            { name: 'MainScene', active: true, id: 'main' },
            { name: 'MenuScene', active: false, id: 'menu' }
        ];
    }

    getEntitiesInScene(sceneName: string): any[] {
        return [
            { id: 'player', name: 'Player', type: 'player' },
            { id: 'enemy1', name: 'Enemy', type: 'enemy' }
        ];
    }

    getEntity(entityId: string): any {
        return { id: entityId, name: 'Entity', type: 'entity' };
    }

    getState(): any {
        return {
            global: {
                gameTitle: 'Game Vibe Engine Game',
                gameSize: { x: 800, y: 600 },
                backgroundColor: '#2c3e50',
                pixelArt: false
            },
            entities: [],
            components: [],
            scenes: this.getScenes(),
            assets: []
        };
    }

    getCanvas(): HTMLCanvasElement | undefined {
        return this.canvas;
    }
}