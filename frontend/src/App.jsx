import { useState, useRef } from 'react'
import './App.css'

function App() {
  const [activeTab, setActiveTab] = useState('upload');
  
  // Phase 4 states
  const [file, setFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);
  const [extractedData, setExtractedData] = useState(null);
  const [mlAssessment, setMlAssessment] = useState(null);
  const [xaiAssessment, setXaiAssessment] = useState(null);
  const [llmAssessment, setLlmAssessment] = useState(null);
  const [uploadError, setUploadError] = useState(null);
  const fileInputRef = useRef(null);

  // Phase 10: Chatbot states
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const chatScrollRef = useRef(null);

  const handleFileSelect = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      setFile(selectedFile);
      setUploadError(null);
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    
    setIsUploading(true);
    setUploadError(null);
    setUploadResult(null);
    setExtractedData(null);
    setMlAssessment(null);
    setXaiAssessment(null);
    setLlmAssessment(null);
    setChatMessages([]);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('http://localhost:8000/api/analyze', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();
      
      if (data.status === 'success') {
        setUploadResult(data.raw_text);
        setExtractedData(data.extracted_data);
        setMlAssessment(data.ml_assessment);
        setXaiAssessment(data.xai_assessment);
        setLlmAssessment(data.llm_assessment);
        setActiveTab('results');
      } else {
        setUploadError(data.message || 'An error occurred during upload.');
      }
    } catch (err) {
      setUploadError('Failed to connect to the server. Is the backend running?');
      console.error(err);
    } finally {
      setIsUploading(false);
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!chatInput.trim()) return;

    const userMessage = { role: 'user', content: chatInput };
    const newChatHistory = [...chatMessages, userMessage];
    
    setChatMessages(newChatHistory);
    setChatInput('');
    setIsChatLoading(true);

    const reportContext = {
      extracted_data: extractedData,
      ml_assessment: mlAssessment,
      xai_assessment: xaiAssessment,
      llm_assessment: llmAssessment
    };

    try {
      const response = await fetch('http://localhost:8000/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage.content,
          report_context: reportContext,
          history: chatMessages
        }),
      });

      const data = await response.json();
      
      if (data.status === 'success') {
        setChatMessages([...newChatHistory, { role: 'assistant', content: data.response }]);
      } else if (data.status === 'unavailable') {
        setChatMessages([...newChatHistory, { role: 'assistant', content: `⚠️ ${data.response}` }]);
      } else {
        setChatMessages([...newChatHistory, { role: 'assistant', content: `❌ Error: ${data.response || 'Unknown error'}` }]);
      }
    } catch (err) {
      setChatMessages([...newChatHistory, { role: 'assistant', content: '❌ Failed to connect to the server.' }]);
      console.error(err);
    } finally {
      setIsChatLoading(false);
      // Scroll to bottom
      setTimeout(() => {
        if (chatScrollRef.current) {
          chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
        }
      }, 100);
    }
  };

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
              <div className="upload-box" onClick={() => fileInputRef.current.click()}>
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  style={{ display: 'none' }} 
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={handleFileSelect}
                />
                {file ? (
                  <p>Selected file: <strong>{file.name}</strong></p>
                ) : (
                  <p>Click to select or drag and drop your PDF or image here</p>
                )}
                
                {!isUploading && (
                  <button className="upload-btn" onClick={(e) => {
                    e.stopPropagation();
                    if (file) handleUpload();
                    else fileInputRef.current.click();
                  }}>
                    {file ? 'Upload & Analyze' : 'Select File'}
                  </button>
                )}

                {isUploading && (
                  <div className="loading-state">
                    <p className="loading-spinner">⏳ Processing document with OCR...</p>
                  </div>
                )}
                
                {uploadError && (
                  <div className="error-message">
                    <p>❌ {uploadError}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'results' && (
            <div className="results-section">
              <h2>Analysis Results</h2>
              {uploadResult ? (
                <div className="results-container">
                  {extractedData && extractedData.length > 0 && (
                    <div className="extracted-data">
                      <h3>Extracted Parameters:</h3>
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Parameter</th>
                            <th>Value</th>
                            <th>Unit</th>
                            <th>Reference Range</th>
                            <th>Clinical Status</th>
                            <th>Extraction Status</th>
                            <th>Original Text</th>
                          </tr>
                        </thead>
                        <tbody>
                          {extractedData.map((param, index) => (
                            <tr key={index}>
                              <td><strong>{param.name}</strong></td>
                              <td>{param.value}</td>
                              <td>{param.unit}</td>
                              <td>{param.reference_range || '-'}</td>
                              <td>
                                <span className={`status-badge stat-${param.status?.toLowerCase().replace(/[^a-z]/g, '')}`}>
                                  {param.status || '-'}
                                </span>
                              </td>
                              <td>
                                <span className={`status-badge ${param.extraction_status}`}>
                                  {param.extraction_status}
                                </span>
                              </td>
                              <td className="original-text">{param.original_name}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  
                  {mlAssessment && (
                    <div className={`ml-assessment-section ${mlAssessment.connected ? 'real-model' : 'demo-model'}`}>
                      <h3>ML Model Assessment</h3>
                      {!mlAssessment.connected && (
                        <div className="warning-banner">
                          ⚠️ <strong>DEVELOPMENT MODE:</strong> Real ML model is not connected. 
                          The final predictive model will be plugged in here.
                        </div>
                      )}
                      <div className="assessment-details">
                        <p><strong>Status:</strong> {mlAssessment.connected ? 'Connected' : 'Disconnected (Demo)'}</p>
                        <p><strong>Prediction:</strong> {mlAssessment.prediction}</p>
                        <p><strong>Message:</strong> {mlAssessment.message}</p>
                      </div>
                    </div>
                  )}

                  {xaiAssessment && (
                    <div className="xai-section">
                      <h3>Explainable AI (XAI)</h3>
                      {xaiAssessment.status === 'unavailable' ? (
                        <div className="info-banner">
                          <p><strong>What is XAI?</strong> Explainable AI helps you understand which test results most influenced the ML prediction.</p>
                          <p><em>{xaiAssessment.message}</em></p>
                          <p className="subtext">Explanations will appear here once the real model is connected.</p>
                        </div>
                      ) : xaiAssessment.status === 'success' ? (
                        <div className="xai-contributions">
                          <p>{xaiAssessment.message}</p>
                          <div className="placeholder-chart">
                            Chart ready for real feature contributions.
                          </div>
                        </div>
                      ) : (
                        <div className="error-banner">
                           <p>XAI Error: {xaiAssessment.message}</p>
                        </div>
                      )}
                    </div>
                  )}

                  {llmAssessment && (
                    <div className="llm-section">
                      <h3>AI Explanation</h3>
                      {llmAssessment.status === 'success' ? (
                        <div className="llm-content">
                          <pre className="markdown-text">{llmAssessment.explanation}</pre>
                        </div>
                      ) : llmAssessment.status === 'unavailable' ? (
                        <div className="info-banner">
                          <p><strong>AI Explanation Unavailable:</strong> {llmAssessment.message}</p>
                        </div>
                      ) : (
                        <div className="error-banner">
                          <p><strong>AI Error:</strong> {llmAssessment.message}</p>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="ocr-results">
                    <h3>Raw OCR Text:</h3>
                    <pre className="ocr-text">{uploadResult}</pre>
                  </div>
                </div>
              ) : (
                <p className="placeholder-text">Upload a report to see findings, XAI, and ML assessment here.</p>
              )}
            </div>
          )}

          {activeTab === 'chat' && (
            <div className="chat-section">
              <h2>Ask Questions</h2>
              {!extractedData ? (
                <p className="placeholder-text">Please upload a laboratory report first to start a conversation.</p>
              ) : (
                <div className="chat-container">
                  <div className="chat-context-banner">
                    <p>💡 The assistant is answering based on your uploaded report: <strong>{file?.name}</strong></p>
                  </div>
                  
                  <div className="chat-messages" ref={chatScrollRef}>
                    {chatMessages.length === 0 ? (
                      <p className="chat-empty">Send a message to ask about your laboratory results, e.g., "What does my HbA1c level mean?"</p>
                    ) : (
                      chatMessages.map((msg, index) => (
                        <div key={index} className={`chat-message ${msg.role}`}>
                          <div className="message-bubble">
                            <pre className="message-content">{msg.content}</pre>
                          </div>
                        </div>
                      ))
                    )}
                    {isChatLoading && (
                      <div className="chat-message assistant">
                        <div className="message-bubble loading">
                          <span className="dot-typing"></span>
                        </div>
                      </div>
                    )}
                  </div>

                  <form className="chat-input-area" onSubmit={handleSendMessage}>
                    <input
                      type="text"
                      placeholder="Ask about your report..."
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      disabled={isChatLoading}
                    />
                    <button type="submit" disabled={isChatLoading || !chatInput.trim()}>
                      Send
                    </button>
                  </form>
                </div>
              )}
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
