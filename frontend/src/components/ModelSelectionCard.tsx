import React from 'react';
import { Brain, DollarSign, Zap, Target } from 'lucide-react';
import { GeminiModel } from '../types';

interface ModelOption {
  id: GeminiModel;
  name: string;
  description: string;
  price: number; // Relative price score (1-5)
  speed: number; // Speed score (1-5)
  reasoning: number; // Reasoning score (1-5)
  priceLabel: string;
  features: string[];
  recommended?: boolean;
}

interface ModelSelectionCardProps {
  selectedModel: GeminiModel;
  onModelChange: (model: GeminiModel) => void;
}

const modelOptions: ModelOption[] = [
  {
    id: '2.0-flash',
    name: 'Gemini 2.0 Flash',
    description: 'Fast & Cost-effective',
    price: 1,
    speed: 5,
    reasoning: 4,
    priceLabel: '$0.10-$0.40 per 1M tokens',
    features: ['Latest model (Feb 2025)', 'Audio/video support', 'Thinking mode'],
    recommended: true
  },
  {
    id: '2.5-flash',
    name: 'Gemini 2.5 Flash',
    description: 'Balanced performance',
    price: 3,
    speed: 4,
    reasoning: 4,
    priceLabel: '$0.30-$2.50 per 1M tokens',
    features: ['Enhanced reasoning', 'Thinking capabilities', 'Optimized for tasks']
  },
  {
    id: '2.5-pro',
    name: 'Gemini 2.5 Pro',
    description: 'Maximum reasoning power',
    price: 5,
    speed: 3,
    reasoning: 5,
    priceLabel: '$1.25-$15.00 per 1M tokens',
    features: ['Complex problem solving', 'Advanced reasoning', 'Premium accuracy']
  }
];

const ModelSelectionCard: React.FC<ModelSelectionCardProps> = ({
  selectedModel,
  onModelChange
}) => {
  const renderBar = (score: number, maxScore: number = 5) => {
    const percentage = (score / maxScore) * 100;
    return (
      <div className="flex items-center gap-2">
        <div className="w-16 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div 
            className="h-full bg-blue-500 transition-all duration-300"
            style={{ width: `${percentage}%` }}
          />
        </div>
        <span className="text-xs text-muted-foreground w-8">
          {score}/{maxScore}
        </span>
      </div>
    );
  };

  const renderPriceBar = (score: number, maxScore: number = 5) => {
    const percentage = (score / maxScore) * 100;
    // Invert colors for price - lower price is better (green), higher price is worse (red)
    const colorClass = score <= 2 ? 'bg-green-500' : score <= 3 ? 'bg-yellow-500' : 'bg-red-500';
    
    return (
      <div className="flex items-center gap-2">
        <div className="w-16 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div 
            className={`h-full transition-all duration-300 ${colorClass}`}
            style={{ width: `${percentage}%` }}
          />
        </div>
        <span className="text-xs text-muted-foreground w-8">
          {score}/{maxScore}
        </span>
      </div>
    );
  };

  return (
    <div className="bg-card rounded-lg border border-border p-4">
      <div className="flex items-center gap-2 mb-4">
        <Brain className="w-5 h-5 text-blue-600 dark:text-blue-400" />
        <h3 className="font-semibold text-lg">AI Model Selection</h3>
      </div>
      
      <div className="space-y-4">
        {modelOptions.map((model) => (
          <div
            key={model.id}
            className={`relative border rounded-lg p-4 cursor-pointer transition-all duration-200 ${
              selectedModel === model.id
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                : 'border-border hover:border-gray-300 dark:hover:border-gray-600'
            }`}
            onClick={() => onModelChange(model.id)}
          >
            <div className="flex items-start gap-3">
              {/* Radio button */}
              <div className="flex items-center pt-1">
                <input
                  type="radio"
                  name="model"
                  value={model.id}
                  checked={selectedModel === model.id}
                  onChange={() => onModelChange(model.id)}
                  className="w-4 h-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                />
              </div>
              
              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-medium text-sm">
                        {model.name}
                        {model.recommended && (
                          <span className="ml-2 text-xs bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300 px-2 py-0.5 rounded-full">
                            Default
                          </span>
                        )}
                      </h4>
                    </div>
                    <p className="text-xs text-muted-foreground mb-2">
                      {model.description}
                    </p>
                    <p className="text-xs text-muted-foreground mb-3">
                      {model.priceLabel}
                    </p>
                    
                    {/* Features */}
                    <div className="flex flex-wrap gap-1 mb-3">
                      {model.features.map((feature, index) => (
                        <span
                          key={index}
                          className="text-xs bg-muted text-muted-foreground px-2 py-1 rounded"
                        >
                          {feature}
                        </span>
                      ))}
                    </div>
                  </div>
                  
                  {/* Metrics */}
                  <div className="ml-4 space-y-2 min-w-0">
                    <div className="flex items-center gap-2">
                      <DollarSign className="w-3 h-3 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground min-w-0">Price:</span>
                      {renderPriceBar(model.price)}
                    </div>
                    <div className="flex items-center gap-2">
                      <Zap className="w-3 h-3 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground min-w-0">Speed:</span>
                      {renderBar(model.speed)}
                    </div>
                    <div className="flex items-center gap-2">
                      <Target className="w-3 h-3 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground min-w-0">Reasoning:</span>
                      {renderBar(model.reasoning)}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
      
      {/* Info note */}
      <div className="mt-4 text-xs text-muted-foreground bg-muted/50 rounded-lg p-3">
        <p>
          <strong>💡 Model Guide:</strong> Use 2.0 Flash for fast, cost-effective analysis. 
          Choose 2.5 Flash for better reasoning without major cost increases. 
          Select 2.5 Pro for complex contracts requiring maximum analytical depth.
        </p>
      </div>
    </div>
  );
};

export default ModelSelectionCard;