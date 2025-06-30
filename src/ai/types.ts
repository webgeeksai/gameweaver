/**
 * Type definitions for the AI integration layer
 */

import { Vector2 } from '../core/math/Vector2';

// Intent types
export enum IntentType {
  CREATE_ENTITY = 'CREATE_ENTITY',
  ADD_BEHAVIOR = 'ADD_BEHAVIOR',
  MODIFY_PROPERTY = 'MODIFY_PROPERTY',
  MOVE_ENTITY = 'MOVE_ENTITY',
  ADD_PHYSICS = 'ADD_PHYSICS',
  CREATE_SCENE = 'CREATE_SCENE',
  CREATE_GAME = 'CREATE_GAME'
}

// Game context - exported for use in other modules
export interface GameContext {
  // Entity tracking
  entities: Map<string, EntityReference>;
  lastCreatedEntity: EntityReference | null;
  playerEntity: EntityReference | null;
  
  // Game understanding
  gameType: GameType | null;
  currentScene: string | null;
  gamePhase: GamePhase;
  
  // Scene tracking
  scenes: Map<string, SceneReference>;
  
  // Conversation state
  conversationHistory: ConversationTurn[];
  lastCommand: any | null;
  lastSuccess: boolean;
  
  // User preferences
  preferredStyle: DevelopmentStyle;
  skillLevel: SkillLevel;
  
  // Temporal context
  sessionStartTime: number;
  lastActivityTime: number;
  commandCount: number;
}

export interface EntityReference {
  id: string;
  name: string;
  type: string;
  createdAt: number;
  lastModified: number;
  position?: { x: number, y: number };
  properties?: Record<string, any>;
}

export interface SceneReference {
  id: string;
  name: string;
  createdAt: number;
  lastModified: number;
}

export type GameType = 'platformer' | 'shooter' | 'puzzle' | 'rpg' | 'racing' | 'strategy' | null;

export enum GamePhase {
  Initial = 'initial',
  EntityCreation = 'entity_creation',
  MechanicsDefinition = 'mechanics_definition',
  Refinement = 'refinement'
}

export type DevelopmentStyle = 'natural' | 'code' | 'mixed';

export type SkillLevel = 'beginner' | 'intermediate' | 'advanced';

export interface ConversationTurn {
  userInput: string;
  command?: any;
  result?: any;
  timestamp: number;
}

// Intent recognition
export interface RecognitionResult {
  intent: IntentType;
  confidence: number;
  parameters: Record<string, any>;
  originalInput: string;
  matchedPattern: string;
}

export interface IntentPattern {
  pattern: RegExp;
  intent: IntentType;
  confidence: number;
  extractors: ParameterExtractor[];
  context?: ContextRequirement[];
}

export interface ParameterExtractor {
  name: string;
  group: number;
  transform?: string;
  default?: any;
}

export interface ContextRequirement {
  requires: string;
  message: string;
}

// Named entity recognition
export interface NamedEntity {
  type: string;
  text: string;
  confidence: number;
  entityId?: string;
  position?: Vector2;
  color?: string;
}

// Parsed intent
export interface ParsedIntent {
  type: IntentType | null;
  parameters: Record<string, any>;
  confidence: number;
  entities: NamedEntity[];
  originalInput: string;
  needsClarification: boolean;
  alternativeIntents?: RecognitionResult[];
}

// GDL command generation
export interface GDLCommand {
  type: IntentType;
  gdlCode: string;
  parameters: Record<string, any>;
  originalInput: string;
  confidence: number;
}

export interface GDLTemplate {
  code: string;
  requiredParams: string[];
  optionalParams: string[];
}

// Error handling
export class ProcessingError extends Error {
  type: string;
  data: any;
  
  constructor(message: string, data: any = {}) {
    super(message);
    this.name = 'ProcessingError';
    this.type = data.type || 'processing_error';
    this.data = data;
  }
}

export interface RecoveryResult {
  type: 'suggestion' | 'clarification' | 'prompt' | 'alternative' | 'error';
  message: string;
  suggestions?: string[];
  options?: RecoveryOption[];
  expectedParams?: string[];
  alternatives?: string[];
}

export interface RecoveryOption {
  id: string;
  title: string;
  description: string;
  confidence?: number;
}

// Conversation flow
export interface ConversationFlow {
  type: string;
  state: 'started' | 'in_progress' | 'completed' | 'cancelled';
  context: any;
  steps: FlowStep[];
  currentStep: number;
  collectedData: Record<string, any>;
}

export interface FlowStep {
  dataKey: string;
  prompt: string;
  validator: (input: string) => boolean;
}

export interface ConversationResponse {
  type: 'question' | 'command' | 'clarification' | 'error';
  message: string;
  options?: any[];
  command?: GDLCommand;
  error?: string;
}