import * as vscode from 'vscode';
import { GameEngine } from '../engine';

export class SceneManagerTreeDataProvider implements vscode.TreeDataProvider<SceneItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<SceneItem | undefined | null | void> = new vscode.EventEmitter<SceneItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<SceneItem | undefined | null | void> = this._onDidChangeTreeData.event;

    constructor(private gameEngine: GameEngine) {
        // Listen for game engine changes
        this.gameEngine.on('sceneChange', () => {
            this.refresh();
        });
    }

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: SceneItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: SceneItem): Thenable<SceneItem[]> {
        if (!element) {
            // Root level - return scenes
            const scenes = this.gameEngine.getScenes();
            return Promise.resolve(scenes.map(scene => new SceneItem(
                scene.name,
                vscode.TreeItemCollapsibleState.Collapsed,
                'scene',
                scene.active
            )));
        } else if (element.contextValue === 'scene') {
            // Scene level - return entities in scene
            const entities = this.gameEngine.getEntitiesInScene(element.label as string);
            return Promise.resolve(entities.map(entity => new SceneItem(
                entity.name || `Entity ${entity.id}`,
                vscode.TreeItemCollapsibleState.None,
                'entity',
                false,
                entity.id
            )));
        }
        return Promise.resolve([]);
    }
}

class SceneItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly contextValue: string,
        public readonly isActive: boolean = false,
        public readonly entityId?: string
    ) {
        super(label, collapsibleState);

        this.tooltip = contextValue === 'scene' 
            ? `Scene: ${this.label}${isActive ? ' (Active)' : ''}`
            : `Entity: ${this.label}`;

        this.description = isActive ? 'Active' : '';

        if (contextValue === 'scene') {
            this.iconPath = new vscode.ThemeIcon(isActive ? 'play' : 'file');
            this.command = {
                command: 'gameVibe.selectScene',
                title: 'Select Scene',
                arguments: [this.label]
            };
        } else if (contextValue === 'entity') {
            this.iconPath = new vscode.ThemeIcon('symbol-object');
            this.command = {
                command: 'gameVibe.selectEntity',
                title: 'Select Entity',
                arguments: [this.entityId]
            };
        }
    }
}