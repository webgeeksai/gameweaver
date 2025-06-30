/**
 * Code Generator for GDL
 * Transforms the AST into executable TypeScript code
 */

import {
  Program,
  NodeType,
  EntityNode,
  BehaviorNode,
  SceneNode,
  GameNode,
  PropertyNode,
  SpawnNode,
  EventNode,
  CodeGenContext,
  ObjectLiteralNode,
  ArrayLiteralNode,
  ValueNode
} from './types';
import { CompilerOptions } from './compiler';

export class CodeGenerator {
  private context: CodeGenContext = {
    indent: 0,
    currentScope: 'global',
    imports: new Set(),
    declarations: new Map()
  };
  
  /**
   * Generate TypeScript code from the AST
   */
  generate(ast: Program, options: CompilerOptions = {}): string {
    // Reset context
    this.context = {
      indent: 0,
      currentScope: 'global',
      imports: new Set(),
      declarations: new Map()
    };
    
    // Generate code for each node
    const declarations: string[] = [];
    
    // Add standard imports
    this.context.imports.add('import { GameEngine } from "./core/GameEngine";');
    this.context.imports.add('import { Entity } from "./core/ecs/Entity";');
    this.context.imports.add('import { ComponentType } from "./core/types";');
    this.context.imports.add('import { Vector2 } from "./core/math/Vector2";');
    
    // Generate code for each declaration
    for (const node of ast.body) {
      switch (node.type) {
        case NodeType.Game:
          declarations.push(this.generateGameCode(node as GameNode));
          break;
        case NodeType.Entity:
          declarations.push(this.generateEntityCode(node as EntityNode));
          break;
        case NodeType.Behavior:
          declarations.push(this.generateBehaviorCode(node as BehaviorNode));
          break;
        case NodeType.Scene:
          declarations.push(this.generateSceneCode(node as SceneNode));
          break;
      }
    }
    
    // Generate main game initialization code
    const mainCode = this.generateMainCode(ast);
    
    // Combine all code
    const imports = Array.from(this.context.imports).join('\n');
    const code = `${imports}\n\n${declarations.join('\n\n')}\n\n${mainCode}`;
    
    return code;
  }
  
  /**
   * Generate code for a game declaration
   */
  private generateGameCode(game: GameNode): string {
    let code = '// Game Configuration\n';
    code += 'export const gameConfig = {\n';
    
    // Generate properties
    for (const prop of game.properties) {
      code += `  ${prop.name}: ${this.generatePropertyValue(prop)},\n`;
    }
    
    code += '};\n';
    
    return code;
  }
  
  /**
   * Generate code for an entity declaration
   */
  private generateEntityCode(entity: EntityNode): string {
    let code = `// Entity: ${entity.name}\n`;
    code += `export class ${entity.name} extends Entity {\n`;
    
    // Constructor
    code += '  constructor(id: string, name: string, scene: string) {\n';
    code += '    super(id, name, scene);\n';
    code += '    this.setupComponents();\n';
    code += '  }\n\n';
    
    // Setup components method
    code += '  private setupComponents(): void {\n';
    
    // Add transform component
    code += '    // Add transform component\n';
    code += '    this.addComponent(ComponentType.Transform, {\n';
    code += '      position: { x: 0, y: 0 },\n';
    code += '      rotation: 0,\n';
    code += '      scale: { x: 1, y: 1 }\n';
    code += '    });\n\n';
    
    // Add other components based on properties
    for (const prop of entity.properties) {
      switch (prop.name) {
        case 'sprite':
          code += '    // Add sprite component\n';
          code += '    this.addComponent(ComponentType.Sprite, {\n';
          code += `      texture: ${this.generatePropertyValue(prop)},\n`;
          code += '      alpha: 1,\n';
          code += '      visible: true\n';
          code += '    });\n\n';
          break;
          
        case 'physics':
          code += '    // Add physics component\n';
          code += '    this.addComponent(ComponentType.Physics, {\n';
          code += `      mode: ${this.generatePropertyValue(prop)},\n`;
          code += '      velocity: { x: 0, y: 0 },\n';
          code += '      acceleration: { x: 0, y: 0 }\n';
          code += '    });\n\n';
          break;
          
        case 'properties':
          code += '    // Set custom properties\n';
          if (prop.value.type === NodeType.ObjectLiteral) {
            const objectLiteral = prop.value as ObjectLiteralNode;
            for (const customProp of objectLiteral.properties) {
              code += `    this.setProperty("${customProp.name}", ${this.generatePropertyValue(customProp)});\n`;
            }
          }
          code += '\n';
          break;
      }
    }
    
    // Apply behaviors
    if (entity.behaviors.length > 0) {
      code += '    // Apply behaviors\n';
      code += `    this.applyBehaviors([${entity.behaviors.map(b => `"${b}"`).join(', ')}]);\n\n`;
    }
    
    code += '  }\n';
    
    // Add event handlers
    if (entity.events.length > 0) {
      code += '\n  // Event handlers\n';
      for (const event of entity.events) {
        code += this.generateEventHandlerCode(event);
      }
    }
    
    code += '}\n';
    
    // Register entity with factory
    code += `\n// Register entity type\n`;
    code += `EntityRegistry.register("${entity.name}", ${entity.name});\n`;
    
    return code;
  }
  
  /**
   * Generate code for a behavior declaration
   */
  private generateBehaviorCode(behavior: BehaviorNode): string {
    let code = `// Behavior: ${behavior.name}\n`;
    code += `export class ${behavior.name}Behavior {\n`;
    
    // Properties
    const propertiesProp = behavior.properties.find(p => p.name === 'properties');
    if (propertiesProp && propertiesProp.value.type === NodeType.ObjectLiteral) {
      code += '  // Properties\n';
      const objectLiteral = propertiesProp.value as ObjectLiteralNode;
      for (const prop of objectLiteral.properties) {
        code += `  ${prop.name}: ${this.getTypeForValue(prop.value)} = ${this.generatePropertyValue(prop)};\n`;
      }
      code += '\n';
    }
    
    // Methods
    const methodsProp = behavior.properties.find(p => p.name === 'methods');
    if (methodsProp && methodsProp.value.type === NodeType.ObjectLiteral) {
      code += '  // Methods\n';
      const methodsObject = methodsProp.value as ObjectLiteralNode;
      for (const method of methodsObject.properties) {
        code += `  ${method.name}(): void {\n`;
        code += '    // Method implementation\n';
        code += '  }\n\n';
      }
    }
    
    // Update method
    const updateProp = behavior.properties.find(p => p.name === 'update');
    if (updateProp) {
      code += '  // Update method\n';
      code += '  update(entity: Entity, deltaTime: number): void {\n';
      code += '    // Update implementation\n';
      code += '  }\n';
    }
    
    code += '}\n';
    
    // Register behavior
    code += `\n// Register behavior\n`;
    code += `BehaviorRegistry.register("${behavior.name}", ${behavior.name}Behavior);\n`;
    
    return code;
  }
  
  /**
   * Generate code for a scene declaration
   */
  private generateSceneCode(scene: SceneNode): string {
    let code = `// Scene: ${scene.name}\n`;
    code += `export class ${scene.name}Scene {\n`;
    
    // Properties
    code += '  private engine: GameEngine;\n';
    code += '  private entities: Map<string, Entity> = new Map();\n\n';
    
    // Constructor
    code += '  constructor(engine: GameEngine) {\n';
    code += '    this.engine = engine;\n';
    code += '  }\n\n';
    
    // Initialize method
    code += '  initialize(): void {\n';
    
    // Apply scene properties
    code += '    // Apply scene properties\n';
    for (const prop of scene.properties) {
      switch (prop.name) {
        case 'size':
          code += `    // Set scene size: ${this.generatePropertyValue(prop)}\n`;
          break;
        case 'camera':
          code += `    // Configure camera: ${this.generatePropertyValue(prop)}\n`;
          break;
        case 'physics':
          code += `    // Configure physics: ${this.generatePropertyValue(prop)}\n`;
          break;
      }
    }
    code += '\n';
    
    // Spawn entities
    if (scene.spawns.length > 0) {
      code += '    // Spawn entities\n';
      for (const spawn of scene.spawns) {
        code += this.generateSpawnCode(spawn);
      }
      code += '\n';
    }
    
    // Setup event handlers
    if (scene.events.length > 0) {
      code += '    // Setup event handlers\n';
      for (const event of scene.events) {
        code += `    // Event: ${event.trigger}\n`;
      }
    }
    
    code += '  }\n';
    
    // Update method
    code += '\n  update(deltaTime: number): void {\n';
    code += '    // Scene update logic\n';
    code += '  }\n';
    
    // Cleanup method
    code += '\n  cleanup(): void {\n';
    code += '    // Cleanup scene resources\n';
    code += '    this.entities.clear();\n';
    code += '  }\n';
    
    code += '}\n';
    
    // Register scene
    code += `\n// Register scene\n`;
    code += `SceneRegistry.register("${scene.name}", ${scene.name}Scene);\n`;
    
    return code;
  }
  
  /**
   * Generate code for the main game initialization
   */
  private generateMainCode(ast: Program): string {
    let code = '// Main game initialization\n';
    code += 'export function initializeGame(engine: GameEngine): void {\n';
    
    // Initialize registries
    code += '  // Initialize registries\n';
    code += '  initializeRegistries();\n\n';
    
    // Find game configuration
    const gameNode = ast.body.find(node => node.type === NodeType.Game) as GameNode;
    if (gameNode) {
      code += '  // Apply game configuration\n';
      code += '  engine.updateConfig({\n';
      
      // Generate config properties
      for (const prop of gameNode.properties) {
        switch (prop.name) {
          case 'title':
            code += `    title: ${this.generatePropertyValue(prop)},\n`;
            break;
          case 'size':
            if (prop.value.type === NodeType.ArrayLiteral) {
              const arrayLiteral = prop.value as ArrayLiteralNode;
              if (arrayLiteral.elements.length === 2) {
                code += `    width: ${arrayLiteral.elements[0].value},\n`;
                code += `    height: ${arrayLiteral.elements[1].value},\n`;
              }
            }
            break;
          case 'pixelArt':
            code += `    pixelArt: ${this.generatePropertyValue(prop)},\n`;
            break;
        }
      }
      
      code += '  });\n\n';
      
      // Load default scene if specified
      const defaultSceneProp = gameNode.properties.find(p => p.name === 'defaultScene');
      if (defaultSceneProp) {
        code += '  // Load default scene\n';
        code += `  loadScene(engine, ${this.generatePropertyValue(defaultSceneProp)});\n`;
      }
    }
    
    code += '}\n\n';
    
    // Helper function to load scenes
    code += '// Helper function to load scenes\n';
    code += 'function loadScene(engine: GameEngine, sceneName: string): void {\n';
    code += '  const SceneClass = SceneRegistry.get(sceneName);\n';
    code += '  if (SceneClass) {\n';
    code += '    const scene = new SceneClass(engine);\n';
    code += '    scene.initialize();\n';
    code += '  } else {\n';
    code += '    console.error(`Scene ${sceneName} not found`);\n';
    code += '  }\n';
    code += '}\n\n';
    
    // Registry initialization
    code += '// Initialize registries\n';
    code += 'function initializeRegistries(): void {\n';
    code += '  // This will be populated by the entity and behavior registrations\n';
    code += '}\n\n';
    
    // Registry classes
    code += '// Entity registry\n';
    code += 'export class EntityRegistry {\n';
    code += '  private static entities: Map<string, any> = new Map();\n\n';
    code += '  static register(name: string, entityClass: any): void {\n';
    code += '    EntityRegistry.entities.set(name, entityClass);\n';
    code += '  }\n\n';
    code += '  static get(name: string): any {\n';
    code += '    return EntityRegistry.entities.get(name);\n';
    code += '  }\n';
    code += '}\n\n';
    
    code += '// Behavior registry\n';
    code += 'export class BehaviorRegistry {\n';
    code += '  private static behaviors: Map<string, any> = new Map();\n\n';
    code += '  static register(name: string, behaviorClass: any): void {\n';
    code += '    BehaviorRegistry.behaviors.set(name, behaviorClass);\n';
    code += '  }\n\n';
    code += '  static get(name: string): any {\n';
    code += '    return BehaviorRegistry.behaviors.get(name);\n';
    code += '  }\n';
    code += '}\n\n';
    
    code += '// Scene registry\n';
    code += 'export class SceneRegistry {\n';
    code += '  private static scenes: Map<string, any> = new Map();\n\n';
    code += '  static register(name: string, sceneClass: any): void {\n';
    code += '    SceneRegistry.scenes.set(name, sceneClass);\n';
    code += '  }\n\n';
    code += '  static get(name: string): any {\n';
    code += '    return SceneRegistry.scenes.get(name);\n';
    code += '  }\n';
    code += '}\n';
    
    return code;
  }
  
  /**
   * Generate code for a spawn statement
   */
  private generateSpawnCode(spawn: SpawnNode): string {
    let code = '';
    
    // Basic spawn
    if (!spawn.pattern) {
      code += `    const ${spawn.name || spawn.entityType.toLowerCase()} = this.spawnEntity("${spawn.entityType}", `;
      
      // Position
      if (spawn.position.type === NodeType.CallExpression) {
        // Handle array position [x, y]
        const args = (spawn.position as any).arguments;
        if (args && args.length === 2) {
          code += `new Vector2(${args[0].value}, ${args[1].value})`;
        } else {
          code += 'new Vector2(0, 0)';
        }
      } else {
        code += 'new Vector2(0, 0)';
      }
      
      code += `);\n`;
      
      // Store named entity
      if (spawn.name) {
        code += `    this.entities.set("${spawn.name}", ${spawn.name});\n`;
      }
    }
    // Pattern spawning would be handled here in a full implementation
    
    return code;
  }
  
  /**
   * Generate code for an event handler
   */
  private generateEventHandlerCode(event: EventNode): string {
    // This is a simplified implementation
    return `  // Event handler for: ${event.trigger}\n`;
  }
  
  /**
   * Generate code for a property value
   */
  private generatePropertyValue(prop: PropertyNode): string {
    const value = prop.value;
    
    switch (value.type) {
      case NodeType.StringLiteral:
        return `"${value.value}"`;
        
      case NodeType.NumberLiteral:
        return value.value.toString();
        
      case NodeType.BooleanLiteral:
        return value.value.toString();
        
      case NodeType.Identifier:
        return value.value;
        
      case NodeType.ArrayLiteral:
        const arrayLiteral = value as ArrayLiteralNode;
        return `[${arrayLiteral.elements.map((e: any) => {
          if (e.type === NodeType.StringLiteral) return `"${e.value}"`;
          return e.value;
        }).join(', ')}]`;
        
      case NodeType.ObjectLiteral:
        const objectLiteral = value as ObjectLiteralNode;
        return `{${objectLiteral.properties.map((p: any) => 
          `${p.name}: ${this.generatePropertyValue(p)}`
        ).join(', ')}}`;
        
      default:
        return 'undefined';
    }
  }
  
  /**
   * Get TypeScript type for a value node
   */
  private getTypeForValue(value: any): string {
    switch (value.type) {
      case NodeType.StringLiteral:
        return 'string';
      case NodeType.NumberLiteral:
        return 'number';
      case NodeType.BooleanLiteral:
        return 'boolean';
      case NodeType.ArrayLiteral:
        const arrayLiteral = value as ArrayLiteralNode;
        if (arrayLiteral.elements.length > 0) {
          return `${this.getTypeForValue(arrayLiteral.elements[0])}[]`;
        }
        return 'any[]';
      case NodeType.ObjectLiteral:
        return 'Record<string, any>';
      default:
        return 'any';
    }
  }
}