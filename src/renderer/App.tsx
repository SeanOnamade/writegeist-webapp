import React, { useState } from 'react';

declare global {
  interface Window {
    api: {
      echo: (text: string) => Promise<string>;
    };
  }
}

const App: React.FC = () => {
  const [inputText, setInputText] = useState('');
  const [response, setResponse] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSend = async () => {
    if (!inputText.trim()) return;
    
    setLoading(true);
    try {
      const result = await window.api.echo(inputText);
      setResponse(result);
    } catch (error) {
      setResponse(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '12px',
      padding: '20px',
      fontFamily: 'sans-serif',
      maxWidth: '600px',
      margin: '0 auto'
    }}>
      <h1>Writegeist Desktop</h1>
      
      <div style={{ display: 'flex', gap: '8px' }}>
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Enter text to echo..."
          style={{
            flex: 1,
            padding: '8px 12px',
            border: '1px solid #ccc',
            borderRadius: '4px',
            fontSize: '14px'
          }}
          disabled={loading}
        />
        <button
          onClick={handleSend}
          disabled={loading || !inputText.trim()}
          style={{
            padding: '8px 16px',
            backgroundColor: loading ? '#ccc' : '#007acc',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: loading ? 'not-allowed' : 'pointer',
            fontSize: '14px'
          }}
        >
          {loading ? 'Sending...' : 'Send'}
        </button>
      </div>

      {response && (
        <div style={{
          padding: '12px',
          backgroundColor: '#f5f5f5',
          border: '1px solid #ddd',
          borderRadius: '4px',
          marginTop: '8px'
        }}>
          <strong>Server Response:</strong>
          <p style={{ margin: '8px 0 0 0', whiteSpace: 'pre-wrap' }}>{response}</p>
        </div>
      )}
    </div>
  );
};

export default App; 