/**
 * Core type definitions for the Game Vibe Engine
 * Provides fundamental types used throughout the engine
 */

// Unique identifiers
export type EntityId = string;
export type ComponentId = string;
export type SceneId = string;
export type AssetId = string;

// Component types enumeration
export enum ComponentType {
  Transform = 'transform',
  Sprite = 'sprite',
  Physics = 'physics',
  Collider = 'collider',
  Health = 'health',
  Input = 'input',
  Audio = 'audio',
  Particle = 'particle',
  Animation = 'animation',
  Script = 'script',
  Behavior = 'behavior'
}

// Physics modes for different game types
export enum PhysicsMode {
  Static = 'static',        // No movement, collisions affect others
  Dynamic = 'dynamic',      // Full physics simulation
  Kinematic = 'kinematic',  // Script-controlled movement
  Platformer = 'platformer', // Optimized for platform games
  TopDown = 'topdown'       // Top-down movement with friction
}

// Event system types
export enum EventPriority {
  Low = 0,
  Normal = 1,
  High = 2,
  Critical = 3
}

export enum EventSource {
  System = 'system',
  Input = 'input',
  AI = 'ai',
  User = 'user',
  Network = 'network',
  Timer = 'timer'
}

// Asset types
export enum AssetType {
  Sprite = 'sprite',
  Atlas = 'atlas',
  Tilemap = 'tilemap',
  Tileset = 'tileset',
  Sound = 'sound',
  Music = 'music',
  Level = 'level',
  Prefab = 'prefab',
  Font = 'font',
  Shader = 'shader',
  Data = 'data',
  Other = 'other'
}

// Optimization levels
export enum OptimizationLevel {
  None = 'none',
  Basic = 'basic',
  Standard = 'standard',
  Aggressive = 'aggressive'
}

// Export platforms
export enum ExportPlatform {
  Web = 'web',
  Mobile = 'mobile',
  Desktop = 'desktop',
  Embedded = 'embedded'
}

// Error types and severity
export enum ErrorType {
  SyntaxError = 'syntax_error',
  SemanticError = 'semantic_error',
  TypeMismatch = 'type_mismatch',
  ReferenceError = 'reference_error',
  EntityNotFound = 'entity_not_found',
  ComponentMissing = 'component_missing',
  PhysicsError = 'physics_error',
  RenderingError = 'rendering_error',
  IntentParsingError = 'intent_parsing_error',
  ContextError = 'context_error',
  GenerationError = 'generation_error',
  MemoryError = 'memory_error',
  PerformanceError = 'performance_error',
  NetworkError = 'network_error',
  InvalidCommand = 'invalid_command',
  AmbiguousInput = 'ambiguous_input',
  UnsupportedFeature = 'unsupported_feature'
}

export enum ErrorSeverity {
  Info = 'info',
  Warning = 'warning',
  Error = 'error',
  Critical = 'critical'
}

// Plugin system types
export enum PluginState {
  Loaded = 'loaded',
  Initialized = 'initialized',
  Active = 'active',
  Inactive = 'inactive',
  Error = 'error'
}

// Development and debugging
export interface PerformanceMetrics {
  fps: number;
  frameTime: number;
  memoryUsage: number;
  drawCalls: number;
  entityCount: number;
  systemPerformance: Map<string, SystemPerformanceMetrics>;
}

export interface SystemPerformanceMetrics {
  updateTime: number;
  renderTime: number;
  entityCount: number;
  averageUpdateTime: number;
  peakUpdateTime: number;
}

// Utility types for better type safety
export interface Timestamped {
  timestamp: number;
}

export interface Identifiable {
  id: string;
}

export interface Named {
  name: string;
}

export interface Versioned {
  version: string;
}

// Generic result types
export interface Result<T, E = Error> {
  success: boolean;
  data?: T;
  error?: E;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

// Configuration interfaces
export interface EngineConfig {
  rendering: RenderingConfig;
  physics: PhysicsConfig;
  audio: AudioConfig;
  input: InputConfig;
  assets: AssetConfig;
  performance: PerformanceConfig;
  debug: DebugConfig;
}

export interface RenderingConfig {
  width: number;
  height: number;
  pixelArt: boolean;
  backgroundColor: string;
  antialias: boolean;
  powerPreference: 'default' | 'high-performance' | 'low-power';
  title?: string;
}

export interface PhysicsConfig {
  gravity: [number, number];
  worldBounds: boolean;
  bounceWorldBounds: boolean;
  debug: boolean;
}

export interface AudioConfig {
  masterVolume: number;
  musicVolume: number;
  sfxVolume: number;
  spatialAudio: boolean;
}

export interface InputConfig {
  keyboard: boolean;
  mouse: boolean;
  touch: boolean;
  gamepad: boolean;
}

export interface AssetConfig {
  baseUrl: string;
  maxCacheSize: number;
  preloadCritical: boolean;
  compressionEnabled: boolean;
}

export interface PerformanceConfig {
  targetFPS: number;
  maxMemoryUsage: number;
  enableProfiling: boolean;
  objectPooling: boolean;
}

export interface DebugConfig {
  enabled: boolean;
  showFPS: boolean;
  showMemory: boolean;
  showColliders: boolean;
  showBounds: boolean;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
}

// Game state interface
export interface GameState {
  global: {
    gameTitle: string;
    gameSize: { x: number; y: number };
    backgroundColor: string;
    pixelArt: boolean;
    description?: string;
    gravity?: [number, number];
  };
  entities: Map<string, any>;
  components: Map<string, any>;
  scenes: Map<string, any>;
  assets: any[];
}