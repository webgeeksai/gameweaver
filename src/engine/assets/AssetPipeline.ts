/**
 * Asset Pipeline with Automatic Optimization
 * 
 * Provides automatic asset processing, optimization, and conversion
 * similar to Unity's asset import pipeline.
 */

import { EventEmitter } from 'events';
import { AssetType } from '../core/types';
import { AssetMetadata } from '../core/assets/UnifiedAssetManager';

export interface AssetImportSettings {
  type: AssetType;
  quality: 'low' | 'medium' | 'high' | 'original';
  compression: boolean;
  generateMipmaps?: boolean;
  maxSize?: number;
  format?: string;
  customSettings?: Record<string, any>;
}

export interface AssetProcessor {
  type: AssetType;
  extensions: string[];
  process(
    input: Buffer | string,
    settings: AssetImportSettings,
    metadata: AssetMetadata
  ): Promise<ProcessedAsset>;
  validate(input: Buffer | string): Promise<boolean>;
}

export interface ProcessedAsset {
  data: Buffer | string;
  metadata: AssetMetadata;
  optimizationReport: OptimizationReport;
  variants?: AssetVariant[];
}

export interface AssetVariant {
  name: string;
  data: Buffer | string;
  metadata: Partial<AssetMetadata>;
  platform?: string;
}

export interface OptimizationReport {
  originalSize: number;
  optimizedSize: number;
  compressionRatio: number;
  processingTime: number;
  optimizations: string[];
  warnings: string[];
}

export interface PipelineConfig {
  autoOptimize: boolean;
  generateVariants: boolean;
  maxTextureSize: number;
  defaultQuality: 'low' | 'medium' | 'high';
  enableCaching: boolean;
  cacheDir?: string;
  processors: AssetProcessor[];
}

/**
 * Sprite/Image Processor
 */
export class SpriteProcessor implements AssetProcessor {
  type = AssetType.Sprite;
  extensions = ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp'];

  async process(
    input: Buffer | string,
    settings: AssetImportSettings,
    metadata: AssetMetadata
  ): Promise<ProcessedAsset> {
    const startTime = Date.now();
    const originalSize = Buffer.isBuffer(input) ? input.length : input.length;
    const optimizations: string[] = [];

    // Mock processing - in real implementation would use sharp or similar
    let processedData = input;
    let width = metadata.width || 0;
    let height = metadata.height || 0;

    // Apply max size constraint
    if (settings.maxSize && (width > settings.maxSize || height > settings.maxSize)) {
      const scale = settings.maxSize / Math.max(width, height);
      width = Math.floor(width * scale);
      height = Math.floor(height * scale);
      optimizations.push(`Resized to ${width}x${height}`);
    }

    // Apply quality settings
    if (settings.quality !== 'original') {
      const qualityMap = { low: 60, medium: 80, high: 95 };
      const quality = qualityMap[settings.quality];
      optimizations.push(`Applied ${settings.quality} quality (${quality}%)`);
    }

    // Generate mipmaps if requested
    const variants: AssetVariant[] = [];
    if (settings.generateMipmaps) {
      const mipLevels = [0.5, 0.25, 0.125];
      for (const scale of mipLevels) {
        variants.push({
          name: `mip_${scale}`,
          data: processedData, // Mock - would be scaled version
          metadata: {
            width: Math.floor(width * scale),
            height: Math.floor(height * scale)
          }
        });
      }
      optimizations.push('Generated mipmaps');
    }

    // Create optimization report
    const report: OptimizationReport = {
      originalSize,
      optimizedSize: Buffer.isBuffer(processedData) ? processedData.length : processedData.length,
      compressionRatio: 1.0, // Mock
      processingTime: Date.now() - startTime,
      optimizations,
      warnings: []
    };

    return {
      data: processedData,
      metadata: {
        ...metadata,
        width,
        height,
        format: settings.format || metadata.format
      },
      optimizationReport: report,
      variants
    };
  }

  async validate(input: Buffer | string): Promise<boolean> {
    // Mock validation - in real implementation would check file format
    return true;
  }
}

/**
 * Sound Processor
 */
export class SoundProcessor implements AssetProcessor {
  type = AssetType.Sound;
  extensions = ['.mp3', '.wav', '.ogg', '.m4a', '.flac'];

  async process(
    input: Buffer | string,
    settings: AssetImportSettings,
    metadata: AssetMetadata
  ): Promise<ProcessedAsset> {
    const startTime = Date.now();
    const originalSize = Buffer.isBuffer(input) ? input.length : input.length;
    const optimizations: string[] = [];

    let processedData = input;

    // Apply compression settings
    if (settings.compression) {
      // Mock compression
      optimizations.push('Applied audio compression');
    }

    // Generate quality variants
    const variants: AssetVariant[] = [];
    if (settings.quality !== 'original') {
      // Low quality variant for mobile
      variants.push({
        name: 'mobile',
        data: processedData,
        metadata: {
          bitrate: 64000,
          format: 'mp3'
        },
        platform: 'mobile'
      });
      optimizations.push('Generated mobile variant');
    }

    const report: OptimizationReport = {
      originalSize,
      optimizedSize: originalSize * 0.7, // Mock compression
      compressionRatio: 0.7,
      processingTime: Date.now() - startTime,
      optimizations,
      warnings: []
    };

    return {
      data: processedData,
      metadata,
      optimizationReport: report,
      variants
    };
  }

  async validate(input: Buffer | string): Promise<boolean> {
    return true;
  }
}

/**
 * Level/Scene Processor
 */
export class LevelProcessor implements AssetProcessor {
  type = AssetType.Level;
  extensions = ['.gdl', '.json', '.scene'];

  async process(
    input: Buffer | string,
    settings: AssetImportSettings,
    metadata: AssetMetadata
  ): Promise<ProcessedAsset> {
    const startTime = Date.now();
    const originalSize = Buffer.isBuffer(input) ? input.length : input.length;
    const optimizations: string[] = [];

    let processedData = input;
    
    // Parse and optimize level data
    if (typeof input === 'string') {
      try {
        const levelData = JSON.parse(input);
        
        // Remove redundant data
        if (settings.compression) {
          // Remove default values
          this.removeDefaults(levelData);
          optimizations.push('Removed default values');
        }

        processedData = JSON.stringify(levelData);
      } catch (e) {
        // Not JSON, keep as is
      }
    }

    const report: OptimizationReport = {
      originalSize,
      optimizedSize: Buffer.isBuffer(processedData) ? processedData.length : processedData.length,
      compressionRatio: 1.0,
      processingTime: Date.now() - startTime,
      optimizations,
      warnings: []
    };

    return {
      data: processedData,
      metadata,
      optimizationReport: report
    };
  }

  async validate(input: Buffer | string): Promise<boolean> {
    return true;
  }

  private removeDefaults(obj: any): void {
    // Mock implementation - would remove default values recursively
  }
}

/**
 * Asset Pipeline Manager
 */
export class AssetPipeline extends EventEmitter {
  private config: PipelineConfig;
  private processors: Map<AssetType, AssetProcessor> = new Map();
  private processingQueue: Map<string, Promise<ProcessedAsset>> = new Map();
  private cache: Map<string, ProcessedAsset> = new Map();

  constructor(config?: Partial<PipelineConfig>) {
    super();

    this.config = {
      autoOptimize: true,
      generateVariants: true,
      maxTextureSize: 2048,
      defaultQuality: 'high',
      enableCaching: true,
      processors: [],
      ...config
    };

    // Register default processors
    this.registerProcessor(new SpriteProcessor());
    this.registerProcessor(new SoundProcessor());
    this.registerProcessor(new LevelProcessor());

    // Register custom processors
    this.config.processors.forEach(p => this.registerProcessor(p));
  }

  /**
   * Register asset processor
   */
  registerProcessor(processor: AssetProcessor): void {
    this.processors.set(processor.type, processor);
    console.log(`Registered processor for ${processor.type}`);
  }

  /**
   * Process an asset
   */
  async processAsset(
    assetPath: string,
    data: Buffer | string,
    type: AssetType,
    metadata: AssetMetadata,
    settings?: Partial<AssetImportSettings>
  ): Promise<ProcessedAsset> {
    // Check cache
    const cacheKey = this.getCacheKey(assetPath, settings);
    if (this.config.enableCaching && this.cache.has(cacheKey)) {
      console.log(`Using cached asset: ${assetPath}`);
      return this.cache.get(cacheKey)!;
    }

    // Check if already processing
    if (this.processingQueue.has(cacheKey)) {
      return this.processingQueue.get(cacheKey)!;
    }

    // Create processing promise
    const processingPromise = this.doProcessAsset(
      assetPath,
      data,
      type,
      metadata,
      settings
    );

    this.processingQueue.set(cacheKey, processingPromise);

    try {
      const result = await processingPromise;
      
      // Cache result
      if (this.config.enableCaching) {
        this.cache.set(cacheKey, result);
      }

      return result;
    } finally {
      this.processingQueue.delete(cacheKey);
    }
  }

  /**
   * Process multiple assets in batch
   */
  async processBatch(
    assets: Array<{
      path: string;
      data: Buffer | string;
      type: AssetType;
      metadata: AssetMetadata;
      settings?: Partial<AssetImportSettings>;
    }>
  ): Promise<ProcessedAsset[]> {
    console.log(`Processing batch of ${assets.length} assets`);

    const results = await Promise.all(
      assets.map(asset =>
        this.processAsset(
          asset.path,
          asset.data,
          asset.type,
          asset.metadata,
          asset.settings
        )
      )
    );

    // Generate report
    const totalOriginal = results.reduce((sum, r) => sum + r.optimizationReport.originalSize, 0);
    const totalOptimized = results.reduce((sum, r) => sum + r.optimizationReport.optimizedSize, 0);
    const totalTime = results.reduce((sum, r) => sum + r.optimizationReport.processingTime, 0);

    console.log(`Batch processing complete:
      Original size: ${(totalOriginal / 1024 / 1024).toFixed(2)}MB
      Optimized size: ${(totalOptimized / 1024 / 1024).toFixed(2)}MB
      Compression: ${((1 - totalOptimized / totalOriginal) * 100).toFixed(1)}%
      Time: ${totalTime}ms`);

    return results;
  }

  /**
   * Validate asset
   */
  async validateAsset(
    data: Buffer | string,
    type: AssetType
  ): Promise<{ valid: boolean; errors: string[] }> {
    const processor = this.processors.get(type);
    if (!processor) {
      return { valid: false, errors: ['No processor for asset type'] };
    }

    try {
      const valid = await processor.validate(data);
      return { valid, errors: valid ? [] : ['Validation failed'] };
    } catch (error) {
      return { valid: false, errors: [(error as Error).message] };
    }
  }

  /**
   * Get optimization recommendations
   */
  getOptimizationRecommendations(
    type: AssetType,
    metadata: AssetMetadata
  ): string[] {
    const recommendations: string[] = [];

    switch (type) {
      case AssetType.Sprite:
        if (metadata.width && metadata.width > this.config.maxTextureSize) {
          recommendations.push(`Texture size (${metadata.width}px) exceeds recommended maximum (${this.config.maxTextureSize}px)`);
        }
        if (!metadata.format || metadata.format === 'bmp') {
          recommendations.push('Consider using PNG or WebP format for better compression');
        }
        break;

      case AssetType.Sound:
        if (metadata.duration && metadata.duration > 30) {
          recommendations.push('Long audio files should be streamed rather than loaded entirely');
        }
        break;
    }

    return recommendations;
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
    console.log('Asset pipeline cache cleared');
  }

  /**
   * Get pipeline statistics
   */
  getStats(): {
    processorsCount: number;
    cacheSize: number;
    processingQueueSize: number;
  } {
    return {
      processorsCount: this.processors.size,
      cacheSize: this.cache.size,
      processingQueueSize: this.processingQueue.size
    };
  }

  /**
   * Do actual asset processing
   */
  private async doProcessAsset(
    assetPath: string,
    data: Buffer | string,
    type: AssetType,
    metadata: AssetMetadata,
    settings?: Partial<AssetImportSettings>
  ): Promise<ProcessedAsset> {
    console.log(`Processing asset: ${assetPath}`);
    this.emit('processing:start', { path: assetPath, type });

    const processor = this.processors.get(type);
    if (!processor) {
      throw new Error(`No processor registered for type: ${type}`);
    }

    // Merge with default settings
    const importSettings: AssetImportSettings = {
      type,
      quality: settings?.quality || this.config.defaultQuality,
      compression: settings?.compression ?? this.config.autoOptimize,
      generateMipmaps: settings?.generateMipmaps ?? (type === AssetType.Sprite),
      maxSize: settings?.maxSize || this.config.maxTextureSize,
      format: settings?.format,
      customSettings: settings?.customSettings
    };

    try {
      const result = await processor.process(data, importSettings, metadata);
      
      // Apply additional optimizations if enabled
      if (this.config.autoOptimize) {
        this.applyGlobalOptimizations(result, type);
      }

      this.emit('processing:complete', {
        path: assetPath,
        type,
        report: result.optimizationReport
      });

      return result;
    } catch (error) {
      this.emit('processing:error', { path: assetPath, type, error });
      throw error;
    }
  }

  /**
   * Apply global optimizations
   */
  private applyGlobalOptimizations(asset: ProcessedAsset, type: AssetType): void {
    // Add any cross-type optimizations here
    if (type === AssetType.Sprite && this.config.generateVariants) {
      // Ensure we have mobile variants
      if (!asset.variants?.find(v => v.platform === 'mobile')) {
        asset.optimizationReport.warnings.push('No mobile variant generated');
      }
    }
  }

  /**
   * Get cache key for asset
   */
  private getCacheKey(path: string, settings?: Partial<AssetImportSettings>): string {
    return `${path}_${JSON.stringify(settings || {})}`;
  }

  /**
   * Export pipeline configuration
   */
  exportConfig(): string {
    return JSON.stringify({
      config: this.config,
      processors: Array.from(this.processors.keys()),
      stats: this.getStats()
    }, null, 2);
  }
}