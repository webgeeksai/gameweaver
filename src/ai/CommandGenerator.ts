/**
 * Command Generator for the Game Vibe Engine
 * Generates GDL code from recognized intents
 */

import { IntentType, RecognitionResult, GDLCommand, GDLTemplate } from './types';
import { GameContext } from './types';
import { Vector2 } from '../core/math/Vector2';

export class CommandGenerator {
  private templates: Map<IntentType, GDLTemplate> = new Map();
  
  constructor() {
    this.initializeTemplates();
  }
  
  /**
   * Initialize GDL templates for different intent types
   */
  private initializeTemplates(): void {
    // Entity creation template
    this.templates.set(IntentType.CREATE_ENTITY, {
      code: `
entity {{name}} {
  sprite: {{appearance}}
  size: {{size}}
  position: {{position}}
  {{#if physics}}
  physics: {{physics}}
  {{/if}}
  {{#if behaviors}}
  behaviors: [{{behaviors}}]
  {{/if}}
}

spawn {{name}} at {{position}} as {{instanceName}}
      `,
      requiredParams: ['name', 'position'],
      optionalParams: ['appearance', 'size', 'physics', 'behaviors']
    });
    
    // Behavior addition template
    this.templates.set(IntentType.ADD_BEHAVIOR, {
      code: `
// Add {{behavior}} behavior to {{target}}
{{target}}.behaviors.push({{behavior}})
{{#if behaviorConfig}}
{{target}}.{{behaviorConfig}}
{{/if}}
      `,
      requiredParams: ['target', 'behavior'],
      optionalParams: ['behaviorConfig']
    });
    
    // Property modification template
    this.templates.set(IntentType.MODIFY_PROPERTY, {
      code: `
// Modify {{target}} property
{{target}}.{{property}} = {{value}}
{{#if animation}}
tween {{target}}.{{property}} to {{value}} over {{duration}}ms
{{/if}}
      `,
      requiredParams: ['target', 'property', 'value'],
      optionalParams: ['animation', 'duration']
    });
    
    // Scene creation template
    this.templates.set(IntentType.CREATE_SCENE, {
      code: `
scene {{name}} {
  size: {{size}}
  backgroundColor: {{backgroundColor}}
  {{#if physics}}
  physics: {
    gravity: {{gravity}}
  }
  {{/if}}
  
  {{#each entities}}
  spawn {{type}} at {{position}} as {{name}}
  {{/each}}
  
  when start: {
    {{#each startActions}}
    {{this}}
    {{/each}}
  }
}
      `,
      requiredParams: ['name'],
      optionalParams: ['size', 'backgroundColor', 'physics', 'entities', 'startActions']
    });
    
    // Game creation template
    this.templates.set(IntentType.CREATE_GAME, {
      code: `
// Game Configuration
game {
  title: "{{title}}"
  size: [800, 600]
  scale: fit
  defaultScene: MainScene
  physics: arcade
  pixelArt: {{pixelArt}}
  backgroundColor: {{backgroundColor}}
  gravity: [0, {{gravity}}]
}

// Player Entity
entity Player {
  sprite: "player.png"
  size: [32, 48]
  physics: platformer
  behaviors: [Moveable, Jumpable]
  
  properties: {
    health: 100
    speed: 200
    jumpPower: 400
  }
}

// Main Scene
scene MainScene {
  size: [1600, 600]
  backgroundColor: {{backgroundColor}}
  
  spawn Player at [100, 400] as player
  
  when start: {
    // Scene initialization
  }
}
      `,
      requiredParams: ['title'],
      optionalParams: ['pixelArt', 'backgroundColor', 'gravity']
    });
  }
  
  /**
   * Generate GDL commands from recognized intents
   */
  generate(intent: RecognitionResult, context: GameContext): GDLCommand {
    const template = this.templates.get(intent.intent);
    if (!template) {
      throw new Error(`No template found for intent: ${intent.intent}`);
    }
    
    // Fill template with parameters
    const gdlCode = this.fillTemplate(template, intent.parameters, context);
    
    return {
      type: intent.intent,
      gdlCode,
      parameters: intent.parameters,
      originalInput: intent.originalInput,
      confidence: intent.confidence
    };
  }
  
  /**
   * Fill a template with parameters and context
   */
  private fillTemplate(template: GDLTemplate, parameters: any, context: GameContext): string {
    let code = template.code;
    
    // Replace template variables
    for (const [key, value] of Object.entries(parameters)) {
      const placeholder = `{{${key}}}`;
      code = code.replace(new RegExp(placeholder, 'g'), this.formatValue(value));
    }
    
    // Fill missing parameters with context-aware defaults
    const missingParams = this.findMissingParameters(code);
    for (const param of missingParams) {
      const defaultValue = this.getContextualDefault(param, context, parameters);
      code = code.replace(`{{${param}}}`, defaultValue);
    }
    
    // Process conditional sections
    code = this.processConditionals(code, parameters);
    
    // Process loops
    code = this.processLoops(code, parameters);
    
    return code;
  }
  
  /**
   * Find missing parameters in a template
   */
  private findMissingParameters(code: string): string[] {
    const matches = code.match(/{{([^#\/][^}]*)}}/g) || [];
    return matches.map(match => match.slice(2, -2));
  }
  
  /**
   * Get a contextual default value for a parameter
   */
  private getContextualDefault(parameter: string, context: GameContext, parameters: any): string {
    switch (parameter) {
      case 'position':
        // Place new entities away from existing ones
        return this.findEmptyPosition(context).toString();
        
      case 'size':
        // Size based on game type
        return context.gameType === 'platformer' ? '[32, 48]' : '[64, 64]';
        
      case 'appearance':
        // Default appearance
        return '"#" + Math.floor(Math.random() * 16777215).toString(16)';
        
      case 'backgroundColor':
        // Default background color
        return '"#87CEEB"';
        
      case 'physics':
        // Default physics mode
        return context.gameType === 'platformer' ? 'platformer' : 'dynamic';
        
      case 'gravity':
        // Default gravity
        return context.gameType === 'platformer' ? '800' : '0';
        
      case 'pixelArt':
        // Default pixelArt setting
        return 'true';
        
      case 'instanceName':
        // Generate a unique instance name
        return parameters.name ? parameters.name.toLowerCase() : 'entity' + Date.now();
        
      case 'name':
        // Default entity name
        if (parameters.entityType) {
          return parameters.entityType;
        }
        return 'Entity' + Date.now();
        
      case 'title':
        // Default game title
        return '"My Awesome Game"';
        
      default:
        return '""';
    }
  }
  
  /**
   * Format a value for inclusion in GDL code
   */
  private formatValue(value: any): string {
    if (value === undefined || value === null) {
      return '""';
    }
    
    if (typeof value === 'string') {
      // Check if it's already a quoted string
      if (value.startsWith('"') && value.endsWith('"')) {
        return value;
      }
      return `"${value}"`;
    }
    
    if (typeof value === 'object') {
      if (value instanceof Vector2) {
        return `[${value.x}, ${value.y}]`;
      }
      return JSON.stringify(value);
    }
    
    return String(value);
  }
  
  /**
   * Process conditional sections in a template
   */
  private processConditionals(code: string, parameters: any): string {
    // Process #if conditionals
    const ifRegex = /{{#if ([^}]*)}}\s*([\s\S]*?)\s*{{\/if}}/g;
    code = code.replace(ifRegex, (match, condition, content) => {
      const conditionValue = parameters[condition];
      return conditionValue ? content : '';
    });
    
    return code;
  }
  
  /**
   * Process loop sections in a template
   */
  private processLoops(code: string, parameters: any): string {
    // Process #each loops
    const eachRegex = /{{#each ([^}]*)}}\s*([\s\S]*?)\s*{{\/each}}/g;
    code = code.replace(eachRegex, (match, arrayName, content) => {
      const array = parameters[arrayName];
      if (!array || !Array.isArray(array)) {
        return '';
      }
      
      return array.map((item: any) => {
        let itemContent = content;
        for (const [key, value] of Object.entries(item)) {
          itemContent = itemContent.replace(new RegExp(`{{${key}}}`, 'g'), this.formatValue(value));
        }
        return itemContent;
      }).join('\n');
    });
    
    return code;
  }
  
  /**
   * Find an empty position for a new entity
   */
  private findEmptyPosition(context: GameContext): Vector2 {
    // Default position
    const defaultPosition = new Vector2(400, 300);
    
    // If no entities, return default position
    if (context.entities.size === 0) {
      return defaultPosition;
    }
    
    // Get existing positions
    const existingPositions: Vector2[] = [];
    for (const entity of context.entities.values()) {
      if (entity.position) {
        existingPositions.push(new Vector2(entity.position.x, entity.position.y));
      }
    }
    
    // If no positions, return default
    if (existingPositions.length === 0) {
      return defaultPosition;
    }
    
    // Try to find a position away from existing entities
    const gridSize = 100;
    const maxAttempts = 10;
    
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const x = Math.floor(Math.random() * 8) * gridSize + 100;
      const y = Math.floor(Math.random() * 5) * gridSize + 100;
      const position = new Vector2(x, y);
      
      // Check if position is far enough from existing entities
      let isFarEnough = true;
      for (const existingPos of existingPositions) {
        if (position.distance(existingPos) < gridSize) {
          isFarEnough = false;
          break;
        }
      }
      
      if (isFarEnough) {
        return position;
      }
    }
    
    // If all attempts fail, return a random position
    return new Vector2(
      Math.floor(Math.random() * 700) + 50,
      Math.floor(Math.random() * 500) + 50
    );
  }
}