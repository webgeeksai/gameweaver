/**
 * Asset Optimizer for the Game Vibe Engine
 * Optimizes game assets for different export platforms
 */

import { OptimizationLevel, ExportPlatform, ImageFormat, AudioFormat } from './types';

export class AssetOptimizer {
  /**
   * Optimize assets for export
   */
  async optimizeAssets(
    assets: any[],
    platform: ExportPlatform,
    optimizationLevel: OptimizationLevel = OptimizationLevel.Standard
  ): Promise<any[]> {
    console.log(`Optimizing assets for ${platform} with level ${optimizationLevel}...`);
    
    // Clone assets to avoid modifying originals
    const optimizedAssets = [...assets];
    
    // Apply optimizations based on asset type
    for (let i = 0; i < optimizedAssets.length; i++) {
      const asset = optimizedAssets[i];
      
      switch (asset.type) {
        case 'image':
          optimizedAssets[i] = await this.optimizeImage(asset, platform, optimizationLevel);
          break;
          
        case 'audio':
          optimizedAssets[i] = await this.optimizeAudio(asset, platform, optimizationLevel);
          break;
          
        case 'font':
          optimizedAssets[i] = await this.optimizeFont(asset, platform, optimizationLevel);
          break;
          
        case 'json':
          optimizedAssets[i] = this.optimizeJSON(asset, optimizationLevel);
          break;
      }
    }
    
    // Create texture atlases for images if appropriate
    if (optimizationLevel !== OptimizationLevel.None) {
      optimizedAssets.push(...await this.createTextureAtlases(
        optimizedAssets.filter(a => a.type === 'image'),
        platform,
        optimizationLevel
      ));
    }
    
    return optimizedAssets;
  }
  
  /**
   * Optimize an image asset
   */
  private async optimizeImage(
    asset: any,
    platform: ExportPlatform,
    optimizationLevel: OptimizationLevel
  ): Promise<any> {
    // Clone asset to avoid modifying original
    const optimized = { ...asset };
    
    // Choose optimal format
    optimized.format = this.chooseOptimalImageFormat(asset, platform);
    
    // Resize if too large
    if (asset.width > 2048 || asset.height > 2048) {
      const maxSize = this.getMaxImageSize(optimizationLevel);
      optimized.width = Math.min(asset.width, maxSize);
      optimized.height = Math.min(asset.height, maxSize);
      optimized.resized = true;
    }
    
    // Apply compression based on optimization level
    optimized.quality = this.getImageQuality(optimizationLevel);
    
    // In a real implementation, this would actually process the image data
    // For now, just simulate optimization
    optimized.optimized = true;
    optimized.originalSize = asset.size;
    optimized.size = Math.floor(asset.size * this.getCompressionRatio(optimizationLevel));
    
    return optimized;
  }
  
  /**
   * Optimize an audio asset
   */
  private async optimizeAudio(
    asset: any,
    platform: ExportPlatform,
    optimizationLevel: OptimizationLevel
  ): Promise<any> {
    // Clone asset to avoid modifying original
    const optimized = { ...asset };
    
    // Choose optimal format
    optimized.format = this.chooseOptimalAudioFormat(platform);
    
    // Apply compression based on optimization level
    optimized.bitrate = this.getAudioBitrate(optimizationLevel);
    
    // In a real implementation, this would actually process the audio data
    // For now, just simulate optimization
    optimized.optimized = true;
    optimized.originalSize = asset.size;
    optimized.size = Math.floor(asset.size * this.getCompressionRatio(optimizationLevel));
    
    return optimized;
  }
  
  /**
   * Optimize a font asset
   */
  private async optimizeFont(
    asset: any,
    platform: ExportPlatform,
    optimizationLevel: OptimizationLevel
  ): Promise<any> {
    // Clone asset to avoid modifying original
    const optimized = { ...asset };
    
    // Choose optimal format
    optimized.format = platform === ExportPlatform.Web ? 'woff2' : 'ttf';
    
    // Subset font if aggressive optimization
    if (optimizationLevel === OptimizationLevel.Aggressive) {
      optimized.subset = true;
    }
    
    // In a real implementation, this would actually process the font data
    // For now, just simulate optimization
    optimized.optimized = true;
    optimized.originalSize = asset.size;
    optimized.size = Math.floor(asset.size * this.getCompressionRatio(optimizationLevel));
    
    return optimized;
  }
  
  /**
   * Optimize a JSON asset
   */
  private optimizeJSON(asset: any, optimizationLevel: OptimizationLevel): any {
    // Clone asset to avoid modifying original
    const optimized = { ...asset };
    
    // Minify JSON if not None optimization
    if (optimizationLevel !== OptimizationLevel.None) {
      optimized.minified = true;
    }
    
    // In a real implementation, this would actually process the JSON data
    // For now, just simulate optimization
    optimized.optimized = true;
    optimized.originalSize = asset.size;
    optimized.size = Math.floor(asset.size * 0.7); // JSON minification typically saves ~30%
    
    return optimized;
  }
  
  /**
   * Create texture atlases from image assets
   */
  private async createTextureAtlases(
    images: any[],
    platform: ExportPlatform,
    optimizationLevel: OptimizationLevel
  ): Promise<any[]> {
    // Skip atlas creation for low optimization levels
    if (optimizationLevel === OptimizationLevel.None || images.length < 5) {
      return [];
    }
    
    // Group images by size category
    const smallImages = images.filter(img => img.width <= 64 && img.height <= 64);
    const mediumImages = images.filter(img => 
      (img.width > 64 && img.width <= 256) || 
      (img.height > 64 && img.height <= 256)
    );
    
    const atlases = [];
    
    // Create atlas for small images
    if (smallImages.length >= 5) {
      atlases.push(this.createAtlas('small', smallImages, platform, optimizationLevel));
    }
    
    // Create atlas for medium images
    if (mediumImages.length >= 3) {
      atlases.push(this.createAtlas('medium', mediumImages, platform, optimizationLevel));
    }
    
    return atlases;
  }
  
  /**
   * Create a texture atlas
   */
  private createAtlas(
    name: string,
    images: any[],
    platform: ExportPlatform,
    optimizationLevel: OptimizationLevel
  ): any {
    // In a real implementation, this would actually create the atlas
    // For now, just simulate atlas creation
    
    // Calculate atlas size based on images
    const totalArea = images.reduce((sum, img) => sum + (img.width * img.height), 0);
    const atlasSize = Math.ceil(Math.sqrt(totalArea * 1.2)); // Add 20% for padding
    
    // Choose optimal format
    const format = this.chooseOptimalImageFormat({ hasAlpha: true }, platform);
    
    // Create atlas metadata
    return {
      id: `atlas_${name}_${Date.now()}`,
      name: `atlas_${name}`,
      type: 'atlas',
      width: Math.min(atlasSize, 2048),
      height: Math.min(atlasSize, 2048),
      format,
      quality: this.getImageQuality(optimizationLevel),
      images: images.map(img => img.id),
      size: Math.floor(totalArea * this.getCompressionRatio(optimizationLevel) * 0.8), // Atlasing saves ~20%
      optimized: true
    };
  }
  
  /**
   * Choose the optimal image format for a platform
   */
  private chooseOptimalImageFormat(image: any, platform: ExportPlatform): ImageFormat {
    // For web, prefer WebP if available
    if (platform === ExportPlatform.Web) {
      return image.hasAlpha ? ImageFormat.WebP : ImageFormat.WebP;
    }
    
    // For mobile, use platform-specific formats
    if (platform === ExportPlatform.Mobile) {
      return image.hasAlpha ? ImageFormat.PNG : ImageFormat.JPEG;
    }
    
    // Default formats
    return image.hasAlpha ? ImageFormat.PNG : ImageFormat.JPEG;
  }
  
  /**
   * Choose the optimal audio format for a platform
   */
  private chooseOptimalAudioFormat(platform: ExportPlatform): AudioFormat {
    // For web, prefer OGG
    if (platform === ExportPlatform.Web) {
      return AudioFormat.OGG;
    }
    
    // For mobile, use AAC
    if (platform === ExportPlatform.Mobile) {
      return AudioFormat.AAC;
    }
    
    // Default format
    return AudioFormat.MP3;
  }
  
  /**
   * Get the maximum image size for an optimization level
   */
  private getMaxImageSize(optimizationLevel: OptimizationLevel): number {
    switch (optimizationLevel) {
      case OptimizationLevel.None:
        return 4096;
      case OptimizationLevel.Basic:
        return 2048;
      case OptimizationLevel.Standard:
        return 1024;
      case OptimizationLevel.Aggressive:
        return 512;
      default:
        return 1024;
    }
  }
  
  /**
   * Get the image quality for an optimization level
   */
  private getImageQuality(optimizationLevel: OptimizationLevel): number {
    switch (optimizationLevel) {
      case OptimizationLevel.None:
        return 1.0;
      case OptimizationLevel.Basic:
        return 0.9;
      case OptimizationLevel.Standard:
        return 0.8;
      case OptimizationLevel.Aggressive:
        return 0.6;
      default:
        return 0.8;
    }
  }
  
  /**
   * Get the audio bitrate for an optimization level
   */
  private getAudioBitrate(optimizationLevel: OptimizationLevel): number {
    switch (optimizationLevel) {
      case OptimizationLevel.None:
        return 192;
      case OptimizationLevel.Basic:
        return 160;
      case OptimizationLevel.Standard:
        return 128;
      case OptimizationLevel.Aggressive:
        return 96;
      default:
        return 128;
    }
  }
  
  /**
   * Get the compression ratio for an optimization level
   */
  private getCompressionRatio(optimizationLevel: OptimizationLevel): number {
    switch (optimizationLevel) {
      case OptimizationLevel.None:
        return 1.0;
      case OptimizationLevel.Basic:
        return 0.8;
      case OptimizationLevel.Standard:
        return 0.6;
      case OptimizationLevel.Aggressive:
        return 0.4;
      default:
        return 0.6;
    }
  }
}