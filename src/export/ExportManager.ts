/**
 * Export Manager for the Game Vibe Engine
 * Handles game export to various platforms and formats
 */

import { WebExporter } from './WebExporter';
import { AssetOptimizer } from './AssetOptimizer';
import { DeploymentManager } from './DeploymentManager';
import { ExportOptions, ExportResult, ExportPlatform, OptimizationLevel } from './types';
import { GameState } from '../core/types';

export class ExportManager {
  private webExporter: WebExporter;
  private assetOptimizer: AssetOptimizer;
  private deploymentManager: DeploymentManager;
  
  constructor() {
    this.webExporter = new WebExporter();
    this.assetOptimizer = new AssetOptimizer();
    this.deploymentManager = new DeploymentManager();
  }
  
  /**
   * Export game to the specified platform
   */
  async exportGame(gameState: GameState, options: ExportOptions): Promise<ExportResult> {
    try {
      console.log(`Exporting game to ${options.platform}...`);
      
      // Validate export options
      this.validateExportOptions(options);
      
      // Optimize assets if requested
      let optimizedAssets = gameState.assets;
      if (options.optimizeAssets) {
        console.log('Optimizing assets...');
        optimizedAssets = await this.assetOptimizer.optimizeAssets(
          gameState.assets, 
          options.platform,
          options.optimization
        );
      }
      
      // Export to the specified platform
      let exportResult: ExportResult;
      
      switch (options.platform) {
        case ExportPlatform.Web:
          console.log('Using web exporter...');
          exportResult = await this.webExporter.export({
            ...gameState,
            assets: optimizedAssets
          }, options);
          break;
          
        default:
          throw new Error(`Unsupported export platform: ${options.platform}`);
      }
      
      // Deploy if requested
      if (options.deploy && options.deployTarget) {
        console.log(`Deploying to ${options.deployTarget.provider}...`);
        const deploymentResult = await this.deploymentManager.deploy(
          exportResult.bundle,
          options.deployTarget
        );
        
        exportResult.deploymentResult = deploymentResult;
      }
      
      return exportResult;
      
    } catch (error) {
      console.error('Export failed:', error);
      return {
        success: false,
        error: error.message,
        platform: options.platform
      };
    }
  }
  
  /**
   * Validate export options
   */
  private validateExportOptions(options: ExportOptions): void {
    // Check if platform is supported
    if (!Object.values(ExportPlatform).includes(options.platform)) {
      throw new Error(`Unsupported export platform: ${options.platform}`);
    }
    
    // Check optimization level
    if (options.optimization && !Object.values(OptimizationLevel).includes(options.optimization)) {
      throw new Error(`Invalid optimization level: ${options.optimization}`);
    }
    
    // Check deployment target
    if (options.deploy && !options.deployTarget) {
      throw new Error('Deployment target is required when deploy is true');
    }
  }
  
  /**
   * Get supported export platforms
   */
  getSupportedPlatforms(): ExportPlatform[] {
    return [ExportPlatform.Web];
  }
  
  /**
   * Get supported deployment providers
   */
  getSupportedDeploymentProviders(): string[] {
    return this.deploymentManager.getSupportedProviders();
  }
  
  /**
   * Get optimization options
   */
  getOptimizationOptions(): Record<OptimizationLevel, string> {
    return {
      [OptimizationLevel.None]: 'No optimization',
      [OptimizationLevel.Basic]: 'Basic optimization',
      [OptimizationLevel.Standard]: 'Standard optimization',
      [OptimizationLevel.Aggressive]: 'Aggressive optimization'
    };
  }
  
  /**
   * Get export status
   */
  async getExportStatus(exportId: string): Promise<any> {
    return this.deploymentManager.getDeploymentStatus(exportId);
  }
}