/**
 * Unified Project Management System
 * 
 * Manages the entire game project including scenes, assets, settings,
 * and build configurations in a Unity-like manner.
 */

import { EventEmitter } from 'events';
import * as path from 'path';
import { UnifiedStateStore } from '../core/state/UnifiedStateStore';
import { MessageBus, MessageType } from '../core/messaging/MessageBus';
import { AssetType } from '../core/types';

export interface ProjectMetadata {
  name: string;
  version: string;
  author: string;
  description: string;
  createdAt: Date;
  lastModified: Date;
  engineVersion: string;
  tags: string[];
}

export interface ProjectSettings {
  display: {
    width: number;
    height: number;
    pixelArt: boolean;
    backgroundColor: string;
    fullscreen: boolean;
    resizable: boolean;
  };
  physics: {
    gravity: [number, number];
    defaultFriction: number;
    defaultRestitution: number;
  };
  audio: {
    masterVolume: number;
    musicVolume: number;
    sfxVolume: number;
  };
  input: {
    keyboardEnabled: boolean;
    mouseEnabled: boolean;
    touchEnabled: boolean;
    gamepadEnabled: boolean;
  };
  build: {
    targetPlatforms: string[];
    compressionEnabled: boolean;
    minify: boolean;
    sourceMaps: boolean;
  };
}

export interface SceneReference {
  id: string;
  name: string;
  path: string;
  isStartScene: boolean;
  buildIndex: number;
  tags: string[];
}

export interface AssetFolder {
  name: string;
  path: string;
  type?: AssetType;
  children: AssetFolder[];
}

export interface Project {
  id: string;
  metadata: ProjectMetadata;
  settings: ProjectSettings;
  scenes: SceneReference[];
  assetFolders: AssetFolder;
  dependencies: Record<string, string>;
  customData: Record<string, any>;
}

export interface ProjectEvents {
  'project:created': { project: Project };
  'project:loaded': { project: Project };
  'project:saved': { project: Project };
  'project:closed': void;
  'project:modified': { changes: Partial<Project> };
  'scene:added': { scene: SceneReference };
  'scene:removed': { sceneId: string };
  'scene:reordered': { scenes: SceneReference[] };
  'settings:changed': { settings: Partial<ProjectSettings> };
}

/**
 * Project Manager
 * 
 * Central hub for all project-related operations
 */
export class ProjectManager extends EventEmitter {
  private currentProject?: Project;
  private projectPath?: string;
  private isDirty: boolean = false;
  private autoSaveTimer?: NodeJS.Timeout;
  private stateStore?: UnifiedStateStore;
  private messageBus?: MessageBus;

  constructor(stateStore?: UnifiedStateStore, messageBus?: MessageBus) {
    super();
    this.stateStore = stateStore;
    this.messageBus = messageBus;
    this.setupMessageHandlers();
  }

  /**
   * Create a new project
   */
  async createProject(
    projectPath: string,
    metadata: Partial<ProjectMetadata>,
    settings?: Partial<ProjectSettings>
  ): Promise<Project> {
    const project: Project = {
      id: this.generateProjectId(),
      metadata: {
        name: metadata.name || 'Untitled Project',
        version: metadata.version || '1.0.0',
        author: metadata.author || 'Unknown',
        description: metadata.description || '',
        createdAt: new Date(),
        lastModified: new Date(),
        engineVersion: '1.0.0',
        tags: metadata.tags || [],
        ...metadata
      },
      settings: this.createDefaultSettings(settings),
      scenes: [],
      assetFolders: {
        name: 'Assets',
        path: 'assets',
        children: [
          { name: 'Sprites', path: 'assets/sprites', type: AssetType.Sprite, children: [] },
          { name: 'Sounds', path: 'assets/sounds', type: AssetType.Sound, children: [] },
          { name: 'Levels', path: 'assets/levels', type: AssetType.Level, children: [] },
          { name: 'Prefabs', path: 'assets/prefabs', type: AssetType.Prefab, children: [] },
          { name: 'Scripts', path: 'assets/scripts', type: AssetType.Other, children: [] }
        ]
      },
      dependencies: {},
      customData: {}
    };

    this.currentProject = project;
    this.projectPath = projectPath;

    // Create project structure
    await this.createProjectStructure(projectPath, project);

    // Save project file
    await this.saveProject();

    // Update state
    this.updateState();

    // Emit events
    this.emit('project:created', { project });
    this.messageBus?.publish({
      type: MessageType.SYSTEM_LOG,
      source: 'project-manager',
      payload: { message: `Project created: ${project.metadata.name}` }
    });

    return project;
  }

  /**
   * Load an existing project
   */
  async loadProject(projectPath: string): Promise<Project> {
    try {
      // Load project file
      const projectData = await this.readProjectFile(projectPath);
      
      this.currentProject = projectData;
      this.projectPath = projectPath;
      this.isDirty = false;

      // Validate project structure
      await this.validateProjectStructure(projectPath, projectData);

      // Update state
      this.updateState();

      // Emit events
      this.emit('project:loaded', { project: projectData });
      this.messageBus?.publish({
        type: MessageType.SYSTEM_LOG,
        source: 'project-manager',
        payload: { message: `Project loaded: ${projectData.metadata.name}` }
      });

      // Start auto-save
      this.startAutoSave();

      return projectData;
    } catch (error) {
      throw new Error(`Failed to load project: ${error}`);
    }
  }

  /**
   * Save the current project
   */
  async saveProject(): Promise<void> {
    if (!this.currentProject || !this.projectPath) {
      throw new Error('No project loaded');
    }

    // Update last modified
    this.currentProject.metadata.lastModified = new Date();

    // Write project file
    await this.writeProjectFile(this.projectPath, this.currentProject);

    this.isDirty = false;

    // Emit events
    this.emit('project:saved', { project: this.currentProject });
    this.messageBus?.publish({
      type: MessageType.SYSTEM_LOG,
      source: 'project-manager',
      payload: { message: 'Project saved' }
    });
  }

  /**
   * Close the current project
   */
  async closeProject(): Promise<void> {
    if (!this.currentProject) return;

    // Save if dirty
    if (this.isDirty) {
      await this.saveProject();
    }

    // Stop auto-save
    this.stopAutoSave();

    // Clear project
    this.currentProject = undefined;
    this.projectPath = undefined;
    this.isDirty = false;

    // Update state
    this.updateState();

    // Emit events
    this.emit('project:closed');
    this.messageBus?.publish({
      type: MessageType.SYSTEM_LOG,
      source: 'project-manager',
      payload: { message: 'Project closed' }
    });
  }

  /**
   * Add a scene to the project
   */
  addScene(scene: Omit<SceneReference, 'buildIndex'>): void {
    if (!this.currentProject) {
      throw new Error('No project loaded');
    }

    const sceneRef: SceneReference = {
      ...scene,
      buildIndex: this.currentProject.scenes.length
    };

    this.currentProject.scenes.push(sceneRef);
    this.markDirty();

    // Set as start scene if it's the first one
    if (this.currentProject.scenes.length === 1) {
      sceneRef.isStartScene = true;
    }

    // Emit events
    this.emit('scene:added', { scene: sceneRef });
    this.messageBus?.publish({
      type: MessageType.SCENE_LOADED,
      source: 'project-manager',
      payload: { sceneId: scene.id, sceneName: scene.name }
    });
  }

  /**
   * Remove a scene from the project
   */
  removeScene(sceneId: string): void {
    if (!this.currentProject) {
      throw new Error('No project loaded');
    }

    const index = this.currentProject.scenes.findIndex(s => s.id === sceneId);
    if (index === -1) return;

    const wasStartScene = this.currentProject.scenes[index].isStartScene;
    this.currentProject.scenes.splice(index, 1);

    // Update build indices
    this.currentProject.scenes.forEach((scene, i) => {
      scene.buildIndex = i;
    });

    // Set new start scene if needed
    if (wasStartScene && this.currentProject.scenes.length > 0) {
      this.currentProject.scenes[0].isStartScene = true;
    }

    this.markDirty();

    // Emit events
    this.emit('scene:removed', { sceneId });
  }

  /**
   * Reorder scenes
   */
  reorderScenes(sceneIds: string[]): void {
    if (!this.currentProject) {
      throw new Error('No project loaded');
    }

    const scenes = sceneIds.map(id => 
      this.currentProject!.scenes.find(s => s.id === id)
    ).filter(Boolean) as SceneReference[];

    // Update build indices
    scenes.forEach((scene, i) => {
      scene.buildIndex = i;
    });

    this.currentProject.scenes = scenes;
    this.markDirty();

    // Emit events
    this.emit('scene:reordered', { scenes });
  }

  /**
   * Update project settings
   */
  updateSettings(settings: Partial<ProjectSettings>): void {
    if (!this.currentProject) {
      throw new Error('No project loaded');
    }

    this.currentProject.settings = {
      ...this.currentProject.settings,
      ...settings,
      display: {
        ...this.currentProject.settings.display,
        ...settings.display
      },
      physics: {
        ...this.currentProject.settings.physics,
        ...settings.physics
      },
      audio: {
        ...this.currentProject.settings.audio,
        ...settings.audio
      },
      input: {
        ...this.currentProject.settings.input,
        ...settings.input
      },
      build: {
        ...this.currentProject.settings.build,
        ...settings.build
      }
    };

    this.markDirty();

    // Emit events
    this.emit('settings:changed', { settings });
    this.messageBus?.publish({
      type: MessageType.SYSTEM_CONFIG,
      source: 'project-manager',
      payload: { settings }
    });
  }

  /**
   * Get current project
   */
  getCurrentProject(): Project | undefined {
    return this.currentProject;
  }

  /**
   * Get project path
   */
  getProjectPath(): string | undefined {
    return this.projectPath;
  }

  /**
   * Check if project is dirty
   */
  isProjectDirty(): boolean {
    return this.isDirty;
  }

  /**
   * Get start scene
   */
  getStartScene(): SceneReference | undefined {
    return this.currentProject?.scenes.find(s => s.isStartScene);
  }

  /**
   * Set start scene
   */
  setStartScene(sceneId: string): void {
    if (!this.currentProject) {
      throw new Error('No project loaded');
    }

    this.currentProject.scenes.forEach(scene => {
      scene.isStartScene = scene.id === sceneId;
    });

    this.markDirty();
  }

  /**
   * Create project structure on disk
   */
  private async createProjectStructure(projectPath: string, project: Project): Promise<void> {
    // Mock implementation - in real implementation would create directories
    console.log(`Creating project structure at: ${projectPath}`);
    
    // Create directories
    const dirs = [
      'assets/sprites',
      'assets/sounds', 
      'assets/levels',
      'assets/prefabs',
      'assets/scripts',
      'scenes',
      'settings',
      'builds'
    ];

    // In real implementation, create these directories
    for (const dir of dirs) {
      console.log(`Creating directory: ${path.join(projectPath, dir)}`);
    }
  }

  /**
   * Validate project structure
   */
  private async validateProjectStructure(projectPath: string, project: Project): Promise<void> {
    // Mock implementation - in real implementation would check directories exist
    console.log(`Validating project structure at: ${projectPath}`);
  }

  /**
   * Read project file
   */
  private async readProjectFile(projectPath: string): Promise<Project> {
    // Mock implementation - in real implementation would read from disk
    const mockProject: Project = {
      id: 'mock-project',
      metadata: {
        name: 'Mock Project',
        version: '1.0.0',
        author: 'Developer',
        description: 'A mock project',
        createdAt: new Date(),
        lastModified: new Date(),
        engineVersion: '1.0.0',
        tags: []
      },
      settings: this.createDefaultSettings(),
      scenes: [],
      assetFolders: {
        name: 'Assets',
        path: 'assets',
        children: []
      },
      dependencies: {},
      customData: {}
    };

    return mockProject;
  }

  /**
   * Write project file
   */
  private async writeProjectFile(projectPath: string, project: Project): Promise<void> {
    // Mock implementation - in real implementation would write to disk
    console.log(`Writing project file to: ${projectPath}`, project);
  }

  /**
   * Create default settings
   */
  private createDefaultSettings(overrides?: Partial<ProjectSettings>): ProjectSettings {
    return {
      display: {
        width: 1280,
        height: 720,
        pixelArt: false,
        backgroundColor: '#1e1e1e',
        fullscreen: false,
        resizable: true,
        ...overrides?.display
      },
      physics: {
        gravity: [0, 800],
        defaultFriction: 0.3,
        defaultRestitution: 0.2,
        ...overrides?.physics
      },
      audio: {
        masterVolume: 1.0,
        musicVolume: 0.8,
        sfxVolume: 1.0,
        ...overrides?.audio
      },
      input: {
        keyboardEnabled: true,
        mouseEnabled: true,
        touchEnabled: true,
        gamepadEnabled: false,
        ...overrides?.input
      },
      build: {
        targetPlatforms: ['web', 'desktop'],
        compressionEnabled: true,
        minify: true,
        sourceMaps: false,
        ...overrides?.build
      }
    };
  }

  /**
   * Mark project as dirty
   */
  private markDirty(): void {
    this.isDirty = true;
    this.emit('project:modified', { changes: {} });
  }

  /**
   * Update state store
   */
  private updateState(): void {
    if (!this.stateStore) return;

    this.stateStore.dispatch({
      type: 'PROJECT_LOADED',
      payload: this.currentProject || null,
      source: 'engine',
      timestamp: Date.now()
    });
  }

  /**
   * Setup message handlers
   */
  private setupMessageHandlers(): void {
    if (!this.messageBus) return;

    this.messageBus.subscribe(MessageType.SYSTEM_REQUEST, (message) => {
      if (message.payload.action === 'saveProject') {
        this.saveProject();
      }
    });
  }

  /**
   * Start auto-save
   */
  private startAutoSave(): void {
    this.stopAutoSave();
    
    // Auto-save every 5 minutes
    this.autoSaveTimer = setInterval(() => {
      if (this.isDirty) {
        this.saveProject().catch(console.error);
      }
    }, 5 * 60 * 1000);
  }

  /**
   * Stop auto-save
   */
  private stopAutoSave(): void {
    if (this.autoSaveTimer) {
      clearInterval(this.autoSaveTimer);
      this.autoSaveTimer = undefined;
    }
  }

  /**
   * Generate project ID
   */
  private generateProjectId(): string {
    return `project_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Export project
   */
  async exportProject(format: 'zip' | 'folder'): Promise<string> {
    if (!this.currentProject || !this.projectPath) {
      throw new Error('No project loaded');
    }

    // Save first
    await this.saveProject();

    // Mock implementation
    const exportPath = path.join(this.projectPath, 'exports', `${this.currentProject.metadata.name}_${Date.now()}.${format}`);
    
    console.log(`Exporting project to: ${exportPath}`);
    
    return exportPath;
  }

  /**
   * Import project
   */
  async importProject(importPath: string): Promise<Project> {
    // Mock implementation
    console.log(`Importing project from: ${importPath}`);
    
    // In real implementation, would extract and validate project
    return this.loadProject(importPath);
  }

  /**
   * Get project statistics
   */
  getProjectStats(): {
    sceneCount: number;
    assetCount: number;
    totalSize: number;
    lastSaved: Date | null;
  } {
    if (!this.currentProject) {
      return {
        sceneCount: 0,
        assetCount: 0,
        totalSize: 0,
        lastSaved: null
      };
    }

    // Mock implementation
    return {
      sceneCount: this.currentProject.scenes.length,
      assetCount: 0, // Would count assets in real implementation
      totalSize: 0, // Would calculate size in real implementation
      lastSaved: this.currentProject.metadata.lastModified
    };
  }
}