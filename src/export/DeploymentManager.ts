/**
 * Deployment Manager for the Game Vibe Engine
 * Handles deployment to various hosting platforms
 */

import { DeploymentTarget, DeploymentResult, GameBundle } from './types';
import { NetlifyProvider } from './providers/NetlifyProvider';
import { DeploymentProvider } from './providers/DeploymentProvider';

export class DeploymentManager {
  private providers: Map<string, DeploymentProvider> = new Map();
  
  constructor() {
    // Register supported providers
    this.registerProvider('netlify', new NetlifyProvider());
  }
  
  /**
   * Register a deployment provider
   */
  registerProvider(name: string, provider: DeploymentProvider): void {
    this.providers.set(name, provider);
  }
  
  /**
   * Deploy a game bundle to a hosting provider
   */
  async deploy(bundle: GameBundle, target: DeploymentTarget): Promise<DeploymentResult> {
    try {
      console.log(`Deploying to ${target.provider}...`);
      
      // Get the provider
      const provider = this.providers.get(target.provider);
      if (!provider) {
        throw new Error(`Unsupported deployment provider: ${target.provider}`);
      }
      
      // Prepare deployment
      console.log('Preparing deployment...');
      const prepared = await provider.prepare(bundle, target.config);
      
      // Upload files
      console.log('Uploading files...');
      const uploaded = await provider.upload(prepared);
      
      // Configure hosting
      console.log('Configuring hosting...');
      const configured = await provider.configure(uploaded, target.config);
      
      // Finalize deployment
      console.log('Finalizing deployment...');
      const result = await provider.finalize(configured);
      
      return {
        success: true,
        provider: target.provider,
        url: result.url,
        deploymentId: result.id,
        timestamp: Date.now()
      };
      
    } catch (error) {
      console.error('Deployment failed:', error);
      return {
        success: false,
        provider: target.provider,
        error: error.message,
        timestamp: Date.now()
      };
    }
  }
  
  /**
   * Get deployment status
   */
  async getDeploymentStatus(deploymentId: string): Promise<any> {
    // Find the provider for this deployment
    for (const provider of this.providers.values()) {
      try {
        const status = await provider.getStatus(deploymentId);
        if (status) {
          return status;
        }
      } catch (error) {
        // Continue checking other providers
      }
    }
    
    throw new Error(`Deployment not found: ${deploymentId}`);
  }
  
  /**
   * Get supported providers
   */
  getSupportedProviders(): string[] {
    return Array.from(this.providers.keys());
  }
  
  /**
   * Get provider configuration options
   */
  getProviderOptions(provider: string): any {
    const providerInstance = this.providers.get(provider);
    if (!providerInstance) {
      throw new Error(`Unsupported deployment provider: ${provider}`);
    }
    
    return providerInstance.getConfigOptions();
  }
}