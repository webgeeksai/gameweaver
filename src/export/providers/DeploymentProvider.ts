/**
 * Deployment Provider interface for the Game Vibe Engine
 * Defines the contract for deployment providers
 */

import { GameBundle, PreparedDeployment, UploadResult, DeploymentConfig } from '../types';

export interface DeploymentProvider {
  /**
   * Prepare a game bundle for deployment
   */
  prepare(bundle: GameBundle, config: DeploymentConfig): Promise<PreparedDeployment>;
  
  /**
   * Upload files to the hosting provider
   */
  upload(prepared: PreparedDeployment): Promise<UploadResult>;
  
  /**
   * Configure hosting settings
   */
  configure(uploaded: UploadResult, config: DeploymentConfig): Promise<any>;
  
  /**
   * Finalize deployment
   */
  finalize(configured: any): Promise<{ id: string; url: string }>;
  
  /**
   * Get deployment status
   */
  getStatus(deploymentId: string): Promise<any>;
  
  /**
   * Get configuration options for this provider
   */
  getConfigOptions(): any;
}