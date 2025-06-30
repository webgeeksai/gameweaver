import React, { useState, useRef, useEffect } from 'react';
import { Send, User, Bot, Loader } from 'lucide-react';
import { AIProcessor } from '../ai/AIProcessor';

interface ChatMessage {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  timestamp: number;
  command?: any;
  result?: any;
}

interface ChatPanelProps {
  onSendMessage: (message: string) => void;
  isProcessing?: boolean;
  onCodeGenerated?: (code: string) => void;
}

const ChatPanel: React.FC<ChatPanelProps> = ({ 
  onSendMessage,
  isProcessing = false,
  onCodeGenerated
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      type: 'assistant',
      content: 'Welcome to Game Vibe Engine! Describe the game you want to create, and I\'ll help you build it.',
      timestamp: Date.now()
    }
  ]);
  const [input, setInput] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  
  // Initialize AI processor
  const aiProcessorRef = useRef<AIProcessor>(new AIProcessor());
  
  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);
  
  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
    
    // Generate initial suggestions
    const initialSuggestions = aiProcessorRef.current.generateSuggestions();
    setSuggestions(initialSuggestions);
  }, []);
  
  const handleSendMessage = async () => {
    if (input.trim() === '' || isProcessing) return;
    
    // Add user message
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      type: 'user',
      content: input,
      timestamp: Date.now()
    };
    
    setMessages(prev => [...prev, userMessage]);
    onSendMessage(input);
    setInput('');
    
    try {
      // Process the input
      const aiProcessor = aiProcessorRef.current;
      
      // Process the input to generate GDL code
      const command = await aiProcessor.processInput(input);
      
      // Create result object (in a real implementation, this would come from executing the command)
      const result = {
        success: true,
        code: command.gdlCode
      };
      
      // Update context
      aiProcessor.updateContext(command, result);
      
      // Generate response message
      const responseContent = `I've created the ${command.type.toLowerCase().replace('_', ' ')} you requested. Here's the GDL code:
\`\`\`gdl
${command.gdlCode}
\`\`\``;
      
      // Add assistant message
      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: responseContent,
        timestamp: Date.now(),
        command,
        result
      };
      
      setMessages(prev => [...prev, assistantMessage]);
      
      // Update suggestions
      const newSuggestions = aiProcessor.generateSuggestions();
      setSuggestions(newSuggestions);
      
      // Notify parent component
      if (onCodeGenerated) {
        onCodeGenerated(command.gdlCode);
      }
      
    } catch (error) {
      console.error('AI processing error:', error);
      
      // Add error message
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: `I'm having trouble understanding that request. Could you try rephrasing it?`,
        timestamp: Date.now()
      };
      
      setMessages(prev => [...prev, errorMessage]);
    }
  };
  
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };
  
  const handleSuggestionClick = (suggestion: string) => {
    setInput(suggestion);
    inputRef.current?.focus();
  };
  
  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit'
    });
  };
  
  return (
    <div className="flex flex-col h-full border rounded-lg overflow-hidden">
      <div className="bg-indigo-700 text-white p-3">
        <h3 className="font-semibold">Game Development Assistant</h3>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
        {messages.map(message => (
          <div 
            key={message.id} 
            className={`mb-4 flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div 
              className={`max-w-[80%] rounded-lg p-3 ${
                message.type === 'user' 
                  ? 'bg-indigo-600 text-white rounded-tr-none' 
                  : 'bg-white border shadow-sm rounded-tl-none'
              }`}
            >
              <div className="flex items-center mb-1">
                {message.type === 'assistant' ? (
                  <Bot size={16} className="mr-1" />
                ) : (
                  <User size={16} className="mr-1" />
                )}
                <span className="text-xs opacity-75">
                  {message.type === 'user' ? 'You' : 'Assistant'} • {formatTime(message.timestamp)}
                </span>
              </div>
              <div className="whitespace-pre-wrap prose prose-sm max-w-none">
                {message.content.split('```').map((part, i) => {
                  if (i % 2 === 0) {
                    return <span key={i}>{part}</span>;
                  } else {
                    const [language, ...codeParts] = part.split('\n');
                    const code = codeParts.join('\n');
                    return (
                      <pre key={i} className="bg-gray-800 text-white p-2 rounded-md overflow-x-auto">
                        <code>{code}</code>
                      </pre>
                    );
                  }
                })}
              </div>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
      
      {suggestions.length > 0 && (
        <div className="px-3 py-2 border-t bg-gray-50">
          <p className="text-xs text-gray-500 mb-2">Try asking:</p>
          <div className="flex flex-wrap gap-2">
            {suggestions.slice(0, 3).map((suggestion, index) => (
              <button
                key={index}
                className="px-3 py-1 text-xs bg-white border border-gray-300 rounded-full hover:bg-gray-100 transition-colors"
                onClick={() => handleSuggestionClick(suggestion)}
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>
      )}
      
      <div className="border-t p-3 bg-white">
        <div className="flex items-end">
          <textarea
            ref={inputRef}
            className="flex-1 p-2 border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="Describe what you want to add to your game..."
            rows={2}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isProcessing}
          />
          <button
            className={`ml-2 p-2 rounded-full ${
              isProcessing || input.trim() === ''
                ? 'bg-gray-300 cursor-not-allowed'
                : 'bg-indigo-600 hover:bg-indigo-500 text-white'
            }`}
            onClick={handleSendMessage}
            disabled={isProcessing || input.trim() === ''}
          >
            {isProcessing ? <Loader className="animate-spin" size={20} /> : <Send size={20} />}
          </button>
        </div>
        {isProcessing && (
          <div className="text-xs text-gray-500 mt-1">
            Processing your request...
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatPanel;