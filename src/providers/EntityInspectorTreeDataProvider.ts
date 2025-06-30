import * as vscode from 'vscode';
import { GameEngine } from '../engine';

export class EntityInspectorTreeDataProvider implements vscode.TreeDataProvider<InspectorItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<InspectorItem | undefined | null | void> = new vscode.EventEmitter<InspectorItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<InspectorItem | undefined | null | void> = this._onDidChangeTreeData.event;

    private selectedEntityId: string | null = null;

    constructor(private gameEngine: GameEngine) {
        // Listen for entity selection changes
        this.gameEngine.on('entitySelected', (entityId: string) => {
            this.selectedEntityId = entityId;
            this.refresh();
        });

        // Listen for entity changes
        this.gameEngine.on('entityChanged', (entityId: string) => {
            if (entityId === this.selectedEntityId) {
                this.refresh();
            }
        });
    }

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    selectEntity(entityId: string): void {
        this.selectedEntityId = entityId;
        this.refresh();
    }

    getTreeItem(element: InspectorItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: InspectorItem): Thenable<InspectorItem[]> {
        if (!this.selectedEntityId) {
            return Promise.resolve([
                new InspectorItem('No entity selected', vscode.TreeItemCollapsibleState.None, 'info')
            ]);
        }

        const entity = this.gameEngine.getEntity(this.selectedEntityId);
        if (!entity) {
            return Promise.resolve([
                new InspectorItem('Entity not found', vscode.TreeItemCollapsibleState.None, 'error')
            ]);
        }

        if (!element) {
            // Root level - return component categories
            const components = entity.getComponents();
            const items: InspectorItem[] = [
                new InspectorItem(`Entity: ${entity.name || entity.id}`, vscode.TreeItemCollapsibleState.None, 'header')
            ];

            // Add component sections
            for (const [componentType, component] of components) {
                items.push(new InspectorItem(
                    componentType,
                    vscode.TreeItemCollapsibleState.Collapsed,
                    'component',
                    componentType,
                    component
                ));
            }

            return Promise.resolve(items);
        } else if (element.contextValue === 'component') {
            // Component level - return component properties
            const component = element.data;
            if (!component) return Promise.resolve([]);

            const properties: InspectorItem[] = [];
            for (const [key, value] of Object.entries(component)) {
                if (key !== 'entityId' && key !== 'id') {
                    properties.push(new InspectorItem(
                        `${key}: ${this.formatValue(value)}`,
                        vscode.TreeItemCollapsibleState.None,
                        'property',
                        key,
                        { key, value, componentType: element.componentType }
                    ));
                }
            }

            return Promise.resolve(properties);
        }

        return Promise.resolve([]);
    }

    private formatValue(value: any): string {
        if (typeof value === 'object' && value !== null) {
            return JSON.stringify(value);
        }
        return String(value);
    }
}

class InspectorItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly contextValue: string,
        public readonly componentType?: string,
        public readonly data?: any
    ) {
        super(label, collapsibleState);

        switch (contextValue) {
            case 'header':
                this.iconPath = new vscode.ThemeIcon('symbol-object');
                break;
            case 'component':
                this.iconPath = new vscode.ThemeIcon('symbol-class');
                this.tooltip = `Component: ${this.label}`;
                break;
            case 'property':
                this.iconPath = new vscode.ThemeIcon('symbol-property');
                this.tooltip = `Property: ${this.label}`;
                this.command = {
                    command: 'gameVibe.editProperty',
                    title: 'Edit Property',
                    arguments: [this.data]
                };
                break;
            case 'info':
                this.iconPath = new vscode.ThemeIcon('info');
                break;
            case 'error':
                this.iconPath = new vscode.ThemeIcon('error');
                break;
        }
    }
}