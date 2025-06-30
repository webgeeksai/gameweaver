/**
 * Type definitions for the Game Description Language (GDL)
 * Defines the structure of GDL AST nodes and related types
 */

export enum NodeType {
  // Top-level nodes
  Game = 'game',
  Entity = 'entity',
  Behavior = 'behavior',
  Scene = 'scene',
  
  // Property nodes
  Property = 'property',
  PropertyList = 'propertyList',
  
  // Value nodes
  StringLiteral = 'stringLiteral',
  NumberLiteral = 'numberLiteral',
  BooleanLiteral = 'booleanLiteral',
  ArrayLiteral = 'arrayLiteral',
  ObjectLiteral = 'objectLiteral',
  Identifier = 'identifier',
  
  // Event nodes
  Event = 'event',
  EventHandler = 'eventHandler',
  
  // Spawn nodes
  Spawn = 'spawn',
  
  // Expression nodes
  BinaryExpression = 'binaryExpression',
  UnaryExpression = 'unaryExpression',
  CallExpression = 'callExpression',
  MemberExpression = 'memberExpression',
  
  // Statement nodes
  BlockStatement = 'blockStatement',
  IfStatement = 'ifStatement',
  ForStatement = 'forStatement',
  
  // Root node
  Program = 'program'
}

export interface SourceLocation {
  line: number;
  column: number;
  offset: number;
}

export interface SourceRange {
  start: SourceLocation;
  end: SourceLocation;
}

export interface GDLNode {
  type: NodeType;
  location: SourceRange;
}

export interface Program extends GDLNode {
  type: NodeType.Program;
  body: GDLNode[];
}

export interface GameNode extends GDLNode {
  type: NodeType.Game;
  properties: PropertyNode[];
}

export interface EntityNode extends GDLNode {
  type: NodeType.Entity;
  name: string;
  properties: PropertyNode[];
  behaviors: string[];
  events: EventNode[];
}

export interface BehaviorNode extends GDLNode {
  type: NodeType.Behavior;
  name: string;
  properties: PropertyNode[];
  methods: MethodNode[];
  update: BlockStatementNode | null;
}

export interface SceneNode extends GDLNode {
  type: NodeType.Scene;
  name: string;
  properties: PropertyNode[];
  spawns: SpawnNode[];
  events: EventNode[];
}

export interface PropertyNode extends GDLNode {
  type: NodeType.Property;
  name: string;
  value: ValueNode;
}

export interface PropertyListNode extends GDLNode {
  type: NodeType.PropertyList;
  properties: PropertyNode[];
}

export interface ValueNode extends GDLNode {
  type: NodeType.StringLiteral | NodeType.NumberLiteral | NodeType.BooleanLiteral | 
        NodeType.ArrayLiteral | NodeType.ObjectLiteral | NodeType.Identifier;
  value: any;
}

export interface StringLiteralNode extends ValueNode {
  type: NodeType.StringLiteral;
  value: string;
}

export interface NumberLiteralNode extends ValueNode {
  type: NodeType.NumberLiteral;
  value: number;
}

export interface BooleanLiteralNode extends ValueNode {
  type: NodeType.BooleanLiteral;
  value: boolean;
}

export interface ArrayLiteralNode extends ValueNode {
  type: NodeType.ArrayLiteral;
  elements: ValueNode[];
}

export interface ObjectLiteralNode extends ValueNode {
  type: NodeType.ObjectLiteral;
  properties: PropertyNode[];
}

export interface IdentifierNode extends ValueNode {
  type: NodeType.Identifier;
  value: string;
}

export interface EventNode extends GDLNode {
  type: NodeType.Event;
  trigger: string;
  condition?: ExpressionNode;
  handler: EventHandlerNode;
}

export interface EventHandlerNode extends GDLNode {
  type: NodeType.EventHandler;
  body: BlockStatementNode;
}

export interface SpawnNode extends GDLNode {
  type: NodeType.Spawn;
  entityType: string;
  position: ExpressionNode;
  name?: string;
  pattern?: SpawnPattern;
}

export interface SpawnPattern {
  type: 'single' | 'grid' | 'random' | 'repeat';
  count?: number;
  rows?: number;
  cols?: number;
  spacing?: [number, number];
  area?: [number, number, number, number];
  start?: [number, number];
  end?: [number, number];
  step?: [number, number];
}

export interface ExpressionNode extends GDLNode {
  type: NodeType.BinaryExpression | NodeType.UnaryExpression | 
        NodeType.CallExpression | NodeType.MemberExpression;
}

export interface BinaryExpressionNode extends ExpressionNode {
  type: NodeType.BinaryExpression;
  operator: string;
  left: ExpressionNode;
  right: ExpressionNode;
}

export interface UnaryExpressionNode extends ExpressionNode {
  type: NodeType.UnaryExpression;
  operator: string;
  argument: ExpressionNode;
}

export interface CallExpressionNode extends ExpressionNode {
  type: NodeType.CallExpression;
  callee: ExpressionNode;
  arguments: ExpressionNode[];
}

export interface MemberExpressionNode extends ExpressionNode {
  type: NodeType.MemberExpression;
  object: ExpressionNode;
  property: IdentifierNode;
  computed: boolean;
}

export interface StatementNode extends GDLNode {
  type: NodeType.BlockStatement | NodeType.IfStatement | NodeType.ForStatement;
}

export interface BlockStatementNode extends StatementNode {
  type: NodeType.BlockStatement;
  body: StatementNode[];
}

export interface IfStatementNode extends StatementNode {
  type: NodeType.IfStatement;
  test: ExpressionNode;
  consequent: StatementNode;
  alternate?: StatementNode;
}

export interface ForStatementNode extends StatementNode {
  type: NodeType.ForStatement;
  init?: ExpressionNode;
  test?: ExpressionNode;
  update?: ExpressionNode;
  body: StatementNode;
}

export interface MethodNode extends GDLNode {
  name: string;
  params: string[];
  body: BlockStatementNode;
}

// Token types for lexer
export enum TokenType {
  Identifier = 'identifier',
  String = 'string',
  Number = 'number',
  Boolean = 'boolean',
  Keyword = 'keyword',
  Operator = 'operator',
  Punctuation = 'punctuation',
  Comment = 'comment',
  Whitespace = 'whitespace',
  EOF = 'eof'
}

export interface Token {
  type: TokenType;
  value: string;
  location: SourceLocation;
}

// Compiler related types
export interface CompilationResult {
  success: boolean;
  code?: string;
  ast?: Program;
  errors?: CompilationError[];
  warnings?: CompilationWarning[];
  metadata?: CompilationMetadata;
  compilationTime?: number;
}

export interface CompilationError {
  message: string;
  location?: SourceRange;
  code?: string;
  suggestions?: string[];
}

export interface CompilationWarning {
  message: string;
  location?: SourceRange;
  code?: string;
}

export interface CompilationMetadata {
  entities: string[];
  behaviors: string[];
  scenes: string[];
  assets: string[];
}

// Parser related types
export interface ParseContext {
  position: number;
  tokens: Token[];
  errors: CompilationError[];
  warnings: CompilationWarning[];
}

// Code generation related types
export interface CodeGenContext {
  indent: number;
  currentScope: string;
  imports: Set<string>;
  declarations: Map<string, string>;
}