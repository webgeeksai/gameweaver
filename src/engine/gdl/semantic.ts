/**
 * Semantic Analyzer for GDL
 * Performs semantic validation and reference resolution on the AST
 */

import {
  Program,
  NodeType,
  EntityNode,
  BehaviorNode,
  SceneNode,
  GameNode,
  PropertyNode,
  CompilationError,
  CompilationWarning,
  ArrayLiteralNode
} from './types';

export interface SemanticAnalysisResult {
  valid: boolean;
  errors: CompilationError[];
  warnings: CompilationWarning[];
}

export class SemanticAnalyzer {
  private errors: CompilationError[] = [];
  private warnings: CompilationWarning[] = [];
  
  // Symbol tables for reference resolution
  private entities: Map<string, EntityNode> = new Map();
  private behaviors: Map<string, BehaviorNode> = new Map();
  private scenes: Map<string, SceneNode> = new Map();
  
  /**
   * Analyze the AST for semantic correctness
   */
  analyze(ast: Program): SemanticAnalysisResult {
    // Reset state
    this.errors = [];
    this.warnings = [];
    this.entities.clear();
    this.behaviors.clear();
    this.scenes.clear();
    
    // First pass: collect declarations
    this.collectDeclarations(ast);
    
    // Second pass: validate references
    this.validateReferences(ast);
    
    // Third pass: type checking
    this.checkTypes(ast);
    
    return {
      valid: this.errors.length === 0,
      errors: this.errors,
      warnings: this.warnings
    };
  }
  
  /**
   * Collect all declarations for reference resolution
   */
  private collectDeclarations(ast: Program): void {
    for (const node of ast.body) {
      switch (node.type) {
        case NodeType.Entity:
          const entity = node as EntityNode;
          if (this.entities.has(entity.name)) {
            this.addError(`Entity '${entity.name}' is already defined`, entity.location);
          } else {
            this.entities.set(entity.name, entity);
          }
          break;
          
        case NodeType.Behavior:
          const behavior = node as BehaviorNode;
          if (this.behaviors.has(behavior.name)) {
            this.addError(`Behavior '${behavior.name}' is already defined`, behavior.location);
          } else {
            this.behaviors.set(behavior.name, behavior);
          }
          break;
          
        case NodeType.Scene:
          const scene = node as SceneNode;
          if (this.scenes.has(scene.name)) {
            this.addError(`Scene '${scene.name}' is already defined`, scene.location);
          } else {
            this.scenes.set(scene.name, scene);
          }
          break;
      }
    }
  }
  
  /**
   * Validate references between declarations
   */
  private validateReferences(ast: Program): void {
    for (const node of ast.body) {
      switch (node.type) {
        case NodeType.Entity:
          this.validateEntityReferences(node as EntityNode);
          break;
          
        case NodeType.Scene:
          this.validateSceneReferences(node as SceneNode);
          break;
          
        case NodeType.Game:
          this.validateGameReferences(node as GameNode);
          break;
      }
    }
  }
  
  /**
   * Validate references in an entity declaration
   */
  private validateEntityReferences(entity: EntityNode): void {
    // Validate behavior references
    for (const behaviorName of entity.behaviors) {
      if (!this.behaviors.has(behaviorName)) {
        this.addError(`Behavior '${behaviorName}' is not defined`, entity.location);
      }
    }
    
    // Validate property types
    this.validateEntityProperties(entity);
  }
  
  /**
   * Validate references in a scene declaration
   */
  private validateSceneReferences(scene: SceneNode): void {
    // Validate entity references in spawn statements
    for (const spawn of scene.spawns) {
      if (!this.entities.has(spawn.entityType)) {
        this.addError(`Entity '${spawn.entityType}' is not defined`, spawn.location);
      }
    }
    
    // Validate property types
    this.validateSceneProperties(scene);
  }
  
  /**
   * Validate references in a game declaration
   */
  private validateGameReferences(game: GameNode): void {
    // Validate default scene reference
    const defaultSceneProp = game.properties.find(p => p.name === 'defaultScene');
    if (defaultSceneProp && defaultSceneProp.value.type === NodeType.Identifier) {
      const sceneName = defaultSceneProp.value.value;
      if (!this.scenes.has(sceneName)) {
        this.addError(`Default scene '${sceneName}' is not defined`, defaultSceneProp.location);
      }
    }
    
    // Validate property types
    this.validateGameProperties(game);
  }
  
  /**
   * Validate entity property types
   */
  private validateEntityProperties(entity: EntityNode): void {
    for (const prop of entity.properties) {
      switch (prop.name) {
        case 'sprite':
          // Sprite can be a string, color, or shape
          break;
          
        case 'physics':
          // Physics must be one of the valid modes
          if (prop.value.type === NodeType.Identifier) {
            const mode = prop.value.value;
            const validModes = ['static', 'dynamic', 'kinematic', 'platformer', 'topdown'];
            if (!validModes.includes(mode)) {
              this.addError(`Invalid physics mode '${mode}'. Expected one of: ${validModes.join(', ')}`, prop.location);
            }
          }
          break;
          
        case 'size':
          // Size must be an array with 2 numbers
          if (prop.value.type === NodeType.ArrayLiteral) {
            const arrayLiteral = prop.value as ArrayLiteralNode;
            const array = arrayLiteral.elements;
            if (array.length !== 2) {
              this.addError(`Size must be an array with 2 elements [width, height]`, prop.location);
            }
          }
          break;
      }
    }
  }
  
  /**
   * Validate scene property types
   */
  private validateSceneProperties(scene: SceneNode): void {
    for (const prop of scene.properties) {
      switch (prop.name) {
        case 'size':
          // Size must be an array with 2 numbers
          if (prop.value.type === NodeType.ArrayLiteral) {
            const arrayLiteral = prop.value as ArrayLiteralNode;
            const array = arrayLiteral.elements;
            if (array.length !== 2) {
              this.addError(`Size must be an array with 2 elements [width, height]`, prop.location);
            }
          }
          break;
          
        case 'camera':
          // Camera can be follow(entity), fixed, or scrolling
          break;
      }
    }
  }
  
  /**
   * Validate game property types
   */
  private validateGameProperties(game: GameNode): void {
    for (const prop of game.properties) {
      switch (prop.name) {
        case 'size':
          // Size must be an array with 2 numbers
          if (prop.value.type === NodeType.ArrayLiteral) {
            const arrayLiteral = prop.value as ArrayLiteralNode;
            const array = arrayLiteral.elements;
            if (array.length !== 2) {
              this.addError(`Size must be an array with 2 elements [width, height]`, prop.location);
            }
          }
          break;
          
        case 'scale':
          // Scale must be one of: fit, exact, zoom
          if (prop.value.type === NodeType.Identifier) {
            const scale = prop.value.value;
            const validScales = ['fit', 'exact', 'zoom'];
            if (!validScales.includes(scale)) {
              this.addError(`Invalid scale mode '${scale}'. Expected one of: ${validScales.join(', ')}`, prop.location);
            }
          }
          break;
          
        case 'physics':
          // Physics must be one of: arcade, matter
          if (prop.value.type === NodeType.Identifier) {
            const physics = prop.value.value;
            const validPhysics = ['arcade', 'matter'];
            if (!validPhysics.includes(physics)) {
              this.addError(`Invalid physics engine '${physics}'. Expected one of: ${validPhysics.join(', ')}`, prop.location);
            }
          }
          break;
          
        case 'pixelArt':
          // PixelArt must be a boolean
          if (prop.value.type !== NodeType.BooleanLiteral) {
            this.addError(`pixelArt must be a boolean (true or false)`, prop.location);
          }
          break;
      }
    }
  }
  
  /**
   * Perform type checking on the AST
   */
  private checkTypes(ast: Program): void {
    // In a full implementation, we would perform more thorough type checking here
  }
  
  /**
   * Add an error to the error list
   */
  private addError(message: string, location: any): void {
    this.errors.push({
      message,
      location
    });
  }
  
  /**
   * Add a warning to the warning list
   */
  private addWarning(message: string, location: any): void {
    this.warnings.push({
      message,
      location
    });
  }
}