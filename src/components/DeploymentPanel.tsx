import React, { useState } from 'react';
import { Rocket, Check, AlertCircle, Loader } from 'lucide-react';

interface DeploymentPanelProps {
  onDeploy: () => Promise<void>;
  isDeploying: boolean;
  deploymentUrl?: string;
  deploymentError?: string;
}

const DeploymentPanel: React.FC<DeploymentPanelProps> = ({
  onDeploy,
  isDeploying,
  deploymentUrl,
  deploymentError
}) => {
  const [provider, setProvider] = useState('netlify');
  
  const handleDeploy = async () => {
    await onDeploy();
  };
  
  return (
    <div className="border rounded-lg p-4">
      <h3 className="text-lg font-semibold mb-4 flex items-center">
        <Rocket className="mr-2" size={20} />
        Deploy Game
      </h3>
      
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Deployment Provider
        </label>
        <select
          className="w-full p-2 border rounded-md"
          value={provider}
          onChange={(e) => setProvider(e.target.value)}
          disabled={isDeploying}
        >
          <option value="netlify">Netlify</option>
          <option value="vercel" disabled>Vercel (Coming Soon)</option>
          <option value="github" disabled>GitHub Pages (Coming Soon)</option>
        </select>
      </div>
      
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Build Settings
        </label>
        <div className="flex items-center mb-2">
          <input
            type="checkbox"
            id="optimize-assets"
            className="mr-2"
            defaultChecked
          />
          <label htmlFor="optimize-assets">Optimize assets</label>
        </div>
        <div className="flex items-center">
          <input
            type="checkbox"
            id="minify-code"
            className="mr-2"
            defaultChecked
          />
          <label htmlFor="minify-code">Minify code</label>
        </div>
      </div>
      
      <button
        className={`w-full py-2 px-4 rounded-md flex items-center justify-center ${
          isDeploying
            ? 'bg-gray-400 cursor-not-allowed'
            : 'bg-indigo-600 hover:bg-indigo-500 text-white'
        }`}
        onClick={handleDeploy}
        disabled={isDeploying}
      >
        {isDeploying ? (
          <>
            <Loader className="animate-spin mr-2" size={18} />
            Deploying...
          </>
        ) : (
          <>
            <Rocket className="mr-2" size={18} />
            Deploy to {provider.charAt(0).toUpperCase() + provider.slice(1)}
          </>
        )}
      </button>
      
      {deploymentUrl && (
        <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-md">
          <div className="flex items-start">
            <Check className="text-green-500 mr-2 mt-0.5" size={18} />
            <div>
              <p className="text-green-800 font-medium">Deployment successful!</p>
              <p className="text-sm text-green-700 mt-1">
                Your game is now live at:
              </p>
              <a
                href={deploymentUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-indigo-600 hover:text-indigo-500 underline break-all"
              >
                {deploymentUrl}
              </a>
            </div>
          </div>
        </div>
      )}
      
      {deploymentError && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
          <div className="flex items-start">
            <AlertCircle className="text-red-500 mr-2 mt-0.5" size={18} />
            <div>
              <p className="text-red-800 font-medium">Deployment failed</p>
              <p className="text-sm text-red-700 mt-1">{deploymentError}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DeploymentPanel;