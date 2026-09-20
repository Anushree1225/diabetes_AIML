import { useState } from 'react'
import './App.css'

function App() {
  const [activeTab, setActiveTab] = useState('upload');

  return (
    <div className="app-container">
      <header className="app-header">
        <h1>Diabetes Lab Analyzer</h1>
        <p>Intelligent processing and explanation</p>
      </header>

      <main className="app-main">
        <div className="tabs">
          <button 
            className={`tab ${activeTab === 'upload' ? 'active' : ''}`}
            onClick={() => setActiveTab('upload')}
          >
            1. Upload
          </button>
          <button 
            className={`tab ${activeTab === 'results' ? 'active' : ''}`}
            onClick={() => setActiveTab('results')}
          >
            2. Results
          </button>
          <button 
            className={`tab ${activeTab === 'chat' ? 'active' : ''}`}
            onClick={() => setActiveTab('chat')}
          >
            3. Chatbot
          </button>
        </div>

        <div className="tab-content">
          {activeTab === 'upload' && (
            <div className="upload-section">
              <h2>Upload Laboratory Report</h2>
              <div className="upload-box">
                <p>Drag and drop your PDF or image here</p>
                <button className="upload-btn">Select File</button>
              </div>
            </div>
          )}

          {activeTab === 'results' && (
            <div className="results-section">
              <h2>Analysis Results</h2>
              <p className="placeholder-text">Upload a report to see findings, XAI, and ML assessment here.</p>
            </div>
          )}

          {activeTab === 'chat' && (
            <div className="chat-section">
              <h2>Ask Questions</h2>
              <p className="placeholder-text">Chat with the AI about your report findings.</p>
            </div>
          )}
        </div>
      </main>

      <footer className="app-footer">
        <p>Disclaimer: This is a demonstration analysis tool, not a medical diagnosis system.</p>
      </footer>
    </div>
  )
}

export default App
