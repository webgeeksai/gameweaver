/**
 * Type definitions for the Export System
 */

// Export platforms
export enum ExportPlatform {
  Web = 'web',
  Mobile = 'mobile',
  Desktop = 'desktop',
  Embedded = 'embedded'
}

// Optimization levels
export enum OptimizationLevel {
  None = 'none',
  Basic = 'basic',
  Standard = 'standard',
  Aggressive = 'aggressive'
}

// Asset formats
export enum ImageFormat {
  PNG = 'png',
  JPEG = 'jpeg',
  WebP = 'webp',
  SVG = 'svg'
}

export enum AudioFormat {
  MP3 = 'mp3',
  OGG = 'ogg',
  WAV = 'wav',
  AAC = 'aac'
}

// Export options
export interface ExportOptions {
  platform: ExportPlatform;
  optimization: OptimizationLevel;
  optimizeAssets: boolean;
  deploy?: boolean;
  deployTarget?: DeploymentTarget;
}

// Web-specific export options
export interface WebExportOptions extends ExportOptions {
  platform: ExportPlatform.Web;
  pwa?: PWAOptions;
  analytics?: AnalyticsOptions;
  bundling?: BundlingOptions;
}

// PWA options
export interface PWAOptions {
  enabled: boolean;
  cacheName?: string;
  version?: string;
  offlineSupport?: boolean;
  installPrompt?: boolean;
}

// Analytics options
export interface AnalyticsOptions {
  enabled: boolean;
  trackingId?: string;
  provider?: 'google' | 'custom';
}

// Bundling options
export interface BundlingOptions {
  minify: boolean;
  sourceMaps: boolean;
  splitChunks: boolean;
}

// Export result
export interface ExportResult {
  success: boolean;
  platform: string;
  bundle?: GameBundle;
  size?: number;
  optimizations?: any;
  error?: string;
  deploymentResult?: DeploymentResult;
}

// Game bundle
export interface GameBundle {
  platform: string;
  files: Record<string, any>;
  entryPoint: string;
  size: number;
}

// Deployment
export interface DeploymentTarget {
  provider: string;
  config: DeploymentConfig;
}

export interface DeploymentConfig {
  [key: string]: any;
}

export interface DeploymentResult {
  success: boolean;
  provider: string;
  url?: string;
  deploymentId?: string;
  error?: string;
  timestamp: number;
}

export interface PreparedDeployment {
  files: Map<string, any>;
  config: DeploymentConfig;
}

export interface UploadResult {
  deploymentId: string;
  url: string;
  files: string[];
}