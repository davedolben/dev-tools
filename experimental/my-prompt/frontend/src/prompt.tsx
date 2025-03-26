import React, { useEffect, useState, useRef } from "react";

// Interface for prompt results
interface PromptResult {
  id: string;
  input: string;
  output: string;
  timestamp: Date;
}

// Interface for prompt handlers
interface PromptHandler {
  name: string;
  handle: (input: string) => Promise<string>;
}

// Initial simple echo handler
const echoHandler: PromptHandler = {
  name: "echo",
  handle: async (input: string) => `Echo: ${input}`,
};

export const Prompt = () => {
  const [inputValue, setInputValue] = useState("");
  const [results, setResults] = useState<PromptResult[]>([]);
  const resultsEndRef = useRef<HTMLDivElement>(null);
  
  // Array of handlers - can be extended in the future
  const handlers: PromptHandler[] = [echoHandler];

  // Scroll to bottom when new results are added
  useEffect(() => {
    resultsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [results]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim()) return;

    // Process input through all handlers
    for (const handler of handlers) {
      const output = await handler.handle(inputValue);
      const result: PromptResult = {
        id: crypto.randomUUID(),
        input: inputValue,
        output,
        timestamp: new Date(),
      };
      setResults(prev => [...prev, result]);
    }
    
    setInputValue("");
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      width: '100%',
    }}>
      {/* Results display */}
      <div style={{
        flex: 1,
        width: '100%',
        padding: '20px',
        overflow: 'hidden',
        display: 'flex',
        justifyContent: 'center'
      }}>
        <div style={{
          width: '80%',
          maxWidth: '600px',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px'
        }}>
          {results.map((result) => (
            <div
              key={result.id}
              style={{
                padding: '15px',
                borderRadius: '8px',
                backgroundColor: '#f5f5f5',
                border: '1px solid #e0e0e0'
              }}
            >
              <div style={{ fontSize: '14px', color: '#666', marginBottom: '8px' }}>
                {result.timestamp.toLocaleTimeString()}
              </div>
              <div style={{ marginBottom: '8px' }}>
                <strong>Input:</strong> {result.input}
              </div>
              <div>
                <strong>Output:</strong> {result.output}
              </div>
            </div>
          ))}
          <div ref={resultsEndRef} />
        </div>
      </div>

      {/* Input form */}
      <div style={{
        borderTop: '1px solid #eee',
        padding: '20px',
        backgroundColor: 'white',
        display: 'flex',
        justifyContent: 'center'
      }}>
        <form
          onSubmit={handleSubmit}
          style={{
            width: '80%',
            maxWidth: '600px'
          }}
        >
          <div style={{
            position: 'relative',
            width: '100%',
            display: 'flex',
            alignItems: 'center'
          }}>
            <svg
              style={{
                position: 'absolute',
                left: '12px',
                width: '20px',
                height: '20px',
                color: '#666'
              }}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="11" cy="11" r="6.5" />
              <line x1="22" y1="22" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Enter your prompt..."
              style={{
                width: '100%',
                padding: '12px 20px 12px 40px',
                fontSize: '16px',
                border: '1px solid #ccc',
                borderRadius: '4px',
                outline: 'none'
              }}
            />
          </div>
        </form>
      </div>
    </div>
  );
};

