/**
 * GDL Parser for converting tokens into an Abstract Syntax Tree (AST)
 * Implements recursive descent parsing for the Game Description Language
 */

import { 
  Token, 
  TokenType, 
  NodeType, 
  GDLNode, 
  Program,
  GameNode,
  EntityNode,
  BehaviorNode,
  SceneNode,
  PropertyNode,
  ValueNode,
  EventNode,
  SpawnNode,
  BlockStatementNode,
  ExpressionNode,
  BinaryExpressionNode,
  UnaryExpressionNode,
  CallExpressionNode,
  MemberExpressionNode,
  IdentifierNode,
  StringLiteralNode,
  NumberLiteralNode,
  BooleanLiteralNode,
  ArrayLiteralNode,
  ObjectLiteralNode,
  MethodNode,
  ParseContext,
  CompilationError,
  SourceRange
} from './types';

export class GDLParser {
  private context: ParseContext = {
    position: 0,
    tokens: [],
    errors: [],
    warnings: []
  };
  
  /**
   * Parse GDL source code into an AST
   */
  parse(tokens: Token[]): Program {
    // Initialize parsing context
    this.context = {
      position: 0,
      tokens,
      errors: [],
      warnings: []
    };
    
    // Create program node
    const program: Program = {
      type: NodeType.Program,
      body: [],
      location: {
        start: tokens[0]?.location || { line: 1, column: 1, offset: 0 },
        end: tokens[tokens.length - 1]?.location || { line: 1, column: 1, offset: 0 }
      }
    };
    
    // Parse top-level declarations
    while (!this.isEOF()) {
      const token = this.peek();
      
      // Skip EOF tokens and whitespace
      if (token.type === TokenType.EOF) {
        break;
      }
      
      try {
        const node = this.parseDeclaration();
        if (node) {
          program.body.push(node);
        }
      } catch (error) {
        // Record error and try to recover
        this.recordError(error instanceof Error ? error.message : String(error));
        this.synchronize();
      }
    }
    
    // Update program location
    if (program.body.length > 0) {
      program.location = {
        start: program.body[0].location.start,
        end: program.body[program.body.length - 1].location.end
      };
    }
    
    return program;
  }
  
  /**
   * Parse a top-level declaration (game, entity, behavior, scene)
   */
  private parseDeclaration(): GDLNode | null {
    const token = this.peek();
    
    if (token.type !== TokenType.Keyword) {
      this.recordError(`Expected declaration keyword, got ${token.type}`);
      this.advance();
      return null;
    }
    
    switch (token.value) {
      case 'game':
        return this.parseGameDeclaration();
      case 'entity':
        return this.parseEntityDeclaration();
      case 'behavior':
        return this.parseBehaviorDeclaration();
      case 'scene':
        return this.parseSceneDeclaration();
      default:
        this.recordError(`Unexpected keyword: ${token.value}`);
        this.advance();
        return null;
    }
  }
  
  /**
   * Parse a game declaration
   * game {
   *   title: "Game Title"
   *   size: [800, 600]
   *   ...
   * }
   */
  private parseGameDeclaration(): GameNode {
    const startToken = this.consume(TokenType.Keyword, 'game');
    
    // Parse game body
    this.consume(TokenType.Punctuation, '{');
    const properties = this.parseProperties();
    const endToken = this.consume(TokenType.Punctuation, '}');
    
    return {
      type: NodeType.Game,
      properties,
      location: {
        start: startToken.location,
        end: endToken.location
      }
    };
  }
  
  /**
   * Parse an entity declaration
   * entity Player {
   *   sprite: "player.png"
   *   ...
   * }
   */
  private parseEntityDeclaration(): EntityNode {
    const startToken = this.consume(TokenType.Keyword, 'entity');
    const nameToken = this.consume(TokenType.Identifier);
    
    // Parse entity body
    this.consume(TokenType.Punctuation, '{');
    const properties = this.parseProperties();
    const endToken = this.consume(TokenType.Punctuation, '}');
    
    // Extract behaviors from properties
    const behaviors: string[] = [];
    const behaviorsProp = properties.find(p => p.name === 'behaviors');
    if (behaviorsProp && behaviorsProp.value.type === NodeType.ArrayLiteral) {
      const behaviorArray = behaviorsProp.value as ArrayLiteralNode;
      for (const element of behaviorArray.elements) {
        if (element.type === NodeType.Identifier) {
          behaviors.push((element as IdentifierNode).value);
        }
      }
    }
    
    // Extract events from properties
    const events: EventNode[] = [];
    // In a full implementation, we would parse event handlers here
    
    return {
      type: NodeType.Entity,
      name: nameToken.value,
      properties,
      behaviors,
      events,
      location: {
        start: startToken.location,
        end: endToken.location
      }
    };
  }
  
  /**
   * Parse a behavior declaration
   * behavior Moveable {
   *   properties: { ... }
   *   methods: { ... }
   *   update: { ... }
   * }
   */
  private parseBehaviorDeclaration(): BehaviorNode {
    const startToken = this.consume(TokenType.Keyword, 'behavior');
    const nameToken = this.consume(TokenType.Identifier);
    
    // Parse behavior body
    this.consume(TokenType.Punctuation, '{');
    const properties = this.parseProperties();
    const endToken = this.consume(TokenType.Punctuation, '}');
    
    // Extract methods from properties
    const methods: MethodNode[] = [];
    // In a full implementation, we would parse method definitions here
    
    // Extract update block
    let update: BlockStatementNode | null = null;
    const updateProp = properties.find(p => p.name === 'update');
    if (updateProp && updateProp.value.type === NodeType.ObjectLiteral) {
      // In a full implementation, we would parse the update block here
    }
    
    return {
      type: NodeType.Behavior,
      name: nameToken.value,
      properties,
      methods,
      update,
      location: {
        start: startToken.location,
        end: endToken.location
      }
    };
  }
  
  /**
   * Parse a scene declaration
   * scene MainScene {
   *   size: [800, 600]
   *   ...
   *   spawn Player at [100, 100] as player
   * }
   */
  private parseSceneDeclaration(): SceneNode {
    const startToken = this.consume(TokenType.Keyword, 'scene');
    const nameToken = this.consume(TokenType.Identifier);
    
    // Parse scene body
    this.consume(TokenType.Punctuation, '{');
    const properties = this.parseProperties();
    
    // Parse spawn statements and events
    const spawns: SpawnNode[] = [];
    const events: EventNode[] = [];
    
    while (this.peek().value !== '}') {
      const token = this.peek();
      
      if (token.type === TokenType.Keyword) {
        if (token.value === 'spawn') {
          spawns.push(this.parseSpawnStatement());
        } else if (token.value === 'when' || token.value === 'on') {
          events.push(this.parseEventStatement());
        } else {
          this.recordError(`Unexpected keyword in scene body: ${token.value}`);
          this.advance();
        }
      } else {
        this.recordError(`Unexpected token in scene body: ${token.value}`);
        this.advance();
      }
    }
    
    const endToken = this.consume(TokenType.Punctuation, '}');
    
    return {
      type: NodeType.Scene,
      name: nameToken.value,
      properties,
      spawns,
      events,
      location: {
        start: startToken.location,
        end: endToken.location
      }
    };
  }
  
  /**
   * Parse a list of properties
   * property1: value1
   * property2: value2
   */
  private parseProperties(): PropertyNode[] {
    const properties: PropertyNode[] = [];
    
    while ((this.peek().type === TokenType.Identifier || this.peek().type === TokenType.Keyword) && this.peek(1).value === ':') {
      properties.push(this.parseProperty());
    }
    
    return properties;
  }
  
  /**
   * Parse a single property
   * name: value
   */
  private parseProperty(): PropertyNode {
    const nameToken = this.peek().type === TokenType.Keyword 
      ? this.consume(TokenType.Keyword)
      : this.consume(TokenType.Identifier);
    this.consume(TokenType.Punctuation, ':');
    const value = this.parseValue();
    
    return {
      type: NodeType.Property,
      name: nameToken.value,
      value,
      location: {
        start: nameToken.location,
        end: value.location.end
      }
    };
  }
  
  /**
   * Parse a value (string, number, boolean, array, object, identifier)
   */
  private parseValue(): ValueNode {
    const token = this.peek();
    
    switch (token.type) {
      case TokenType.String:
        return this.parseStringLiteral();
      case TokenType.Number:
        return this.parseNumberLiteral();
      case TokenType.Boolean:
        return this.parseBooleanLiteral();
      case TokenType.Identifier:
        return this.parseIdentifier();
      case TokenType.Punctuation:
        if (token.value === '[') {
          return this.parseArrayLiteral();
        } else if (token.value === '{') {
          return this.parseObjectLiteral();
        } else if (token.value === '(') {
          return this.parseTupleLiteral();
        }
        break;
    }
    
    this.recordError(`Expected value, got ${token.type}: ${token.value}`);
    this.advance();
    
    // Return a placeholder value
    return {
      type: NodeType.StringLiteral,
      value: '',
      location: {
        start: token.location,
        end: token.location
      }
    };
  }
  
  /**
   * Parse a string literal
   * "string value"
   */
  private parseStringLiteral(): StringLiteralNode {
    const token = this.consume(TokenType.String);
    
    return {
      type: NodeType.StringLiteral,
      value: token.value,
      location: {
        start: token.location,
        end: token.location
      }
    };
  }
  
  /**
   * Parse a number literal
   * 123, 45.67
   */
  private parseNumberLiteral(): NumberLiteralNode {
    const token = this.consume(TokenType.Number);
    
    return {
      type: NodeType.NumberLiteral,
      value: parseFloat(token.value),
      location: {
        start: token.location,
        end: token.location
      }
    };
  }
  
  /**
   * Parse a boolean literal
   * true, false
   */
  private parseBooleanLiteral(): BooleanLiteralNode {
    const token = this.consume(TokenType.Boolean);
    
    return {
      type: NodeType.BooleanLiteral,
      value: token.value === 'true',
      location: {
        start: token.location,
        end: token.location
      }
    };
  }
  
  /**
   * Parse an identifier
   * variableName
   */
  private parseIdentifier(): IdentifierNode {
    const token = this.consume(TokenType.Identifier);
    
    return {
      type: NodeType.Identifier,
      value: token.value,
      location: {
        start: token.location,
        end: token.location
      }
    };
  }
  
  /**
   * Parse an array literal
   * [1, 2, 3]
   */
  private parseArrayLiteral(): ArrayLiteralNode {
    const startToken = this.consume(TokenType.Punctuation, '[');
    const elements: ValueNode[] = [];
    
    // Parse array elements
    if (this.peek().value !== ']') {
      do {
        elements.push(this.parseValue());
        
        if (this.peek().value !== ',') {
          break;
        }
        
        this.consume(TokenType.Punctuation, ',');
      } while (!this.isEOF() && this.peek().value !== ']');
    }
    
    const endToken = this.consume(TokenType.Punctuation, ']');
    
    return {
      type: NodeType.ArrayLiteral,
      elements,
      value: elements.map(e => e.value),
      location: {
        start: startToken.location,
        end: endToken.location
      }
    };
  }
  
  /**
   * Parse an object literal
   * { key1: value1, key2: value2 }
   */
  private parseObjectLiteral(): ObjectLiteralNode {
    const startToken = this.consume(TokenType.Punctuation, '{');
    const properties: PropertyNode[] = [];
    
    // Parse object properties
    if (this.peek().value !== '}') {
      do {
        properties.push(this.parseProperty());
        
        if (this.peek().value !== ',') {
          break;
        }
        
        this.consume(TokenType.Punctuation, ',');
      } while (!this.isEOF() && this.peek().value !== '}');
    }
    
    const endToken = this.consume(TokenType.Punctuation, '}');
    
    // Convert properties to a value object
    const value: Record<string, any> = {};
    for (const prop of properties) {
      value[prop.name] = prop.value.value;
    }
    
    return {
      type: NodeType.ObjectLiteral,
      properties,
      value,
      location: {
        start: startToken.location,
        end: endToken.location
      }
    };
  }
  
  /**
   * Parse a tuple literal (x, y)
   */
  private parseTupleLiteral(): ArrayLiteralNode {
    const startToken = this.consume(TokenType.Punctuation, '(');
    const elements: ValueNode[] = [];
    
    // Parse tuple elements
    if (this.peek().value !== ')') {
      do {
        elements.push(this.parseValue());
        
        if (this.peek().value !== ',') {
          break;
        }
        
        this.consume(TokenType.Punctuation, ',');
      } while (!this.isEOF() && this.peek().value !== ')');
    }
    
    const endToken = this.consume(TokenType.Punctuation, ')');
    
    // Return as an array literal since tuples are essentially arrays
    return {
      type: NodeType.ArrayLiteral,
      elements,
      value: elements.map(e => e.value),
      location: {
        start: startToken.location,
        end: endToken.location
      }
    };
  }
  
  /**
   * Parse a spawn statement
   * spawn Player at [100, 100] as player
   */
  private parseSpawnStatement(): SpawnNode {
    const startToken = this.consume(TokenType.Keyword, 'spawn');
    const entityTypeToken = this.consume(TokenType.Identifier);
    
    // Parse position
    this.consume(TokenType.Keyword, 'at');
    const position = this.parseExpression();
    
    // Parse optional name
    let name: string | undefined;
    if (this.peek().type === TokenType.Keyword && this.peek().value === 'as') {
      this.advance(); // Consume 'as'
      name = this.consume(TokenType.Identifier).value;
    }
    
    return {
      type: NodeType.Spawn,
      entityType: entityTypeToken.value,
      position,
      name,
      location: {
        start: startToken.location,
        end: this.previous().location
      }
    };
  }
  
  /**
   * Parse an event statement
   * when player touches enemy: { ... }
   * on gameOver: { ... }
   */
  private parseEventStatement(): EventNode {
    const startToken = this.consume(TokenType.Keyword); // 'when' or 'on'
    const trigger = this.parseTrigger();
    
    // Parse handler
    this.consume(TokenType.Punctuation, ':');
    const handler = this.parseEventHandler();
    
    return {
      type: NodeType.Event,
      trigger,
      handler,
      location: {
        start: startToken.location,
        end: handler.location.end
      }
    };
  }
  
  /**
   * Parse an event trigger
   * player touches enemy
   * key(space) pressed
   * score >= 100
   */
  private parseTrigger(): string {
    // This is a simplified implementation
    // In a full parser, we would parse this into a structured trigger object
    let trigger = '';
    
    // Read tokens until we hit a colon
    while (!this.isEOF() && this.peek().value !== ':') {
      trigger += this.advance().value + ' ';
    }
    
    return trigger.trim();
  }
  
  /**
   * Parse an event handler
   * { action1(); action2(); }
   */
  private parseEventHandler(): any {
    // This is a placeholder implementation
    // In a full parser, we would parse this into a proper block statement
    
    // Check if it's a block or a single statement
    if (this.peek().value === '{') {
      this.consume(TokenType.Punctuation, '{');
      
      // Skip tokens until we find the closing brace
      let braceCount = 1;
      const startToken = this.previous();
      
      while (!this.isEOF() && braceCount > 0) {
        const token = this.advance();
        if (token.value === '{') braceCount++;
        if (token.value === '}') braceCount--;
      }
      
      return {
        type: NodeType.EventHandler,
        body: {
          type: NodeType.BlockStatement,
          body: [],
          location: {
            start: startToken.location,
            end: this.previous().location
          }
        },
        location: {
          start: startToken.location,
          end: this.previous().location
        }
      };
    } else {
      // Single statement
      const startToken = this.peek();
      
      // Skip tokens until we find a semicolon or newline
      while (!this.isEOF() && this.peek().value !== ';' && this.peek().value !== '\n') {
        this.advance();
      }
      
      // Skip the semicolon if present
      if (this.peek().value === ';') {
        this.advance();
      }
      
      return {
        type: NodeType.EventHandler,
        body: {
          type: NodeType.BlockStatement,
          body: [],
          location: {
            start: startToken.location,
            end: this.previous().location
          }
        },
        location: {
          start: startToken.location,
          end: this.previous().location
        }
      };
    }
  }
  
  /**
   * Parse an expression (placeholder implementation)
   */
  private parseExpression(): ExpressionNode {
    // This is a simplified implementation
    // In a full parser, we would implement proper expression parsing
    
    // For now, just handle array literals and identifiers
    if (this.peek().value === '[') {
      const arrayLiteral = this.parseArrayLiteral();
      
      // Convert to a call expression for position
      return {
        type: NodeType.CallExpression,
        callee: {
          type: NodeType.Identifier,
          value: 'Vector2',
          location: arrayLiteral.location
        } as unknown as ExpressionNode,
        arguments: arrayLiteral.elements as unknown as ExpressionNode[],
        location: arrayLiteral.location
      } as CallExpressionNode;
    } else if (this.peek().type === TokenType.Identifier) {
      const identifier = this.parseIdentifier();
      
      return identifier as unknown as ExpressionNode;
    }
    
    // Default placeholder
    const token = this.advance();
    return {
      type: NodeType.Identifier,
      value: token.value,
      location: {
        start: token.location,
        end: token.location
      }
    } as unknown as ExpressionNode;
  }
  
  // Helper methods
  private isEOF(): boolean {
    return this.context.position >= this.context.tokens.length;
  }
  
  private peek(offset: number = 0): Token {
    const position = this.context.position + offset;
    if (position >= this.context.tokens.length) {
      return { 
        type: TokenType.EOF, 
        value: '', 
        location: this.context.tokens[this.context.tokens.length - 1]?.location || { line: 1, column: 1, offset: 0 } 
      };
    }
    return this.context.tokens[position];
  }
  
  private advance(): Token {
    if (!this.isEOF()) {
      return this.context.tokens[this.context.position++];
    }
    return this.peek();
  }
  
  private previous(): Token {
    return this.context.tokens[Math.max(0, this.context.position - 1)];
  }
  
  private consume(type: TokenType, value?: string): Token {
    const token = this.peek();
    
    if (token.type !== type) {
      throw new Error(`Expected ${type}, got ${token.type}`);
    }
    
    if (value !== undefined && token.value !== value) {
      throw new Error(`Expected '${value}', got '${token.value}'`);
    }
    
    return this.advance();
  }
  
  private recordError(message: string): void {
    const token = this.peek();
    this.context.errors.push({
      message,
      location: {
        start: token.location,
        end: token.location
      }
    });
  }
  
  private synchronize(): void {
    // Skip tokens until we find a safe point to resume parsing
    this.advance(); // Skip the problematic token
    
    while (!this.isEOF()) {
      // Stop at statement boundaries or declarations
      if (this.previous().value === ';' || this.previous().value === '}') {
        return;
      }
      
      if (this.peek().type === TokenType.Keyword) {
        const value = this.peek().value;
        if (value === 'game' || value === 'entity' || value === 'behavior' || value === 'scene') {
          return;
        }
      }
      
      this.advance();
    }
  }
}