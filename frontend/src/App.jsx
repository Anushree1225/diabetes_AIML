import { useState, useRef } from 'react'
import './App.css'

function App() {
  const [activeTab, setActiveTab] = useState('upload');
  
  // Phase 4 states
  const [file, setFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);
  const [extractedData, setExtractedData] = useState(null);
  
  // Demographics form
  const [showDemographics, setShowDemographics] = useState(false);
  const [demographics, setDemographics] = useState({ age: '', sex: '', bmi: '' });
  const [isAssessing, setIsAssessing] = useState(false);

  // Results
  const [mlAssessment, setMlAssessment] = useState(null);
  const [xaiAssessment, setXaiAssessment] = useState(null);
  const [llmAssessment, setLlmAssessment] = useState(null);
  const [uploadError, setUploadError] = useState(null);
  const fileInputRef = useRef(null);

  // Chatbot states
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
    setShowDemographics(false);
    setMlAssessment(null);
    setXaiAssessment(null);
    setLlmAssessment(null);
    setChatMessages([]);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('http://localhost:8000/api/extract', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();
      
      if (data.status === 'success') {
        setUploadResult(data.raw_text);
        setExtractedData(data.extracted_data);
        setDemographics({
          age: data.demographics?.age || '',
          sex: data.demographics?.sex || '',
          bmi: ''
        });
        setShowDemographics(true);
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

  const handleAssess = async () => {
    if (!demographics.age || !demographics.sex) {
      setUploadError("Age and Sex are required for the ML assessment.");
      return;
    }
    
    setIsAssessing(true);
    setUploadError(null);
    
    try {
      const response = await fetch('http://localhost:8000/api/assess', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          extracted_data: extractedData,
          demographics: demographics,
          raw_text: uploadResult,
          filename: file.name
        }),
      });

      const data = await response.json();
      
      if (data.status === 'success') {
        setMlAssessment(data.ml_assessment);
        setXaiAssessment(data.xai_assessment);
        setLlmAssessment(data.llm_assessment);
        setActiveTab('results');
      } else {
        setUploadError(data.message || 'An error occurred during assessment.');
      }
    } catch (err) {
      setUploadError('Failed to connect to the server.');
      console.error(err);
    } finally {
      setIsAssessing(false);
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
            1. Upload & Extract
          </button>
          <button 
            className={`tab ${activeTab === 'results' ? 'active' : ''}`}
            onClick={() => setActiveTab('results')}
            disabled={!mlAssessment}
          >
            2. Results
          </button>
          <button 
            className={`tab ${activeTab === 'chat' ? 'active' : ''}`}
            onClick={() => setActiveTab('chat')}
            disabled={!mlAssessment}
          >
            3. Chatbot
          </button>
        </div>

        <div className="tab-content">
          {activeTab === 'upload' && (
            <div className="upload-section">
              <h2>Upload Laboratory Report</h2>
              {!showDemographics ? (
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
                      {file ? 'Upload & Extract' : 'Select File'}
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
              ) : (
                <div className="demographics-box">
                  <h3>Review Patient Demographics</h3>
                  <p>Please review and provide missing information for the ML assessment.</p>
                  <div className="form-group">
                    <label>Age (Years) *</label>
                    <input 
                      type="number" 
                      value={demographics.age} 
                      onChange={(e) => setDemographics({...demographics, age: e.target.value})} 
                      required 
                    />
                  </div>
                  <div className="form-group">
                    <label>Biological Sex *</label>
                    <select 
                      value={demographics.sex} 
                      onChange={(e) => setDemographics({...demographics, sex: e.target.value})}
                      required
                    >
                      <option value="">Select...</option>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>BMI (kg/m²) (Optional)</label>
                    <input 
                      type="number" 
                      step="0.1"
                      value={demographics.bmi} 
                      onChange={(e) => setDemographics({...demographics, bmi: e.target.value})} 
                    />
                  </div>
                  
                  {uploadError && (
                    <div className="error-message">
                      <p>❌ {uploadError}</p>
                    </div>
                  )}
                  
                  <div className="form-actions">
                    <button className="back-btn" onClick={() => setShowDemographics(false)} disabled={isAssessing}>
                      Back to Upload
                    </button>
                    <button className="upload-btn" onClick={handleAssess} disabled={isAssessing}>
                      {isAssessing ? '⏳ Assessing...' : 'Run ML Assessment'}
                    </button>
                  </div>
                </div>
              )}
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
                         </div>
                      )}
                      {mlAssessment.status === 'error' ? (
                        <div className="error-banner">
                          <p><strong>Error:</strong> {mlAssessment.message}</p>
                        </div>
                      ) : (
                        <div className="assessment-details">
                          <p><strong>Status:</strong> {mlAssessment.connected ? 'Connected (REAL)' : 'Disconnected (Demo)'}</p>
                          <p><strong>Assessment:</strong> {mlAssessment.message}</p>
                          {mlAssessment.confidence !== null && (
                            <p><strong>Probability:</strong> {(mlAssessment.confidence * 100).toFixed(1)}%</p>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {xaiAssessment && (
                    <div className="xai-section">
                      <h3>Explainable AI (XAI)</h3>
                      {xaiAssessment.status === 'unavailable' ? (
                        <div className="info-banner">
                          <p><strong>XAI Unavailable:</strong> {xaiAssessment.message}</p>
                        </div>
                      ) : xaiAssessment.status === 'success' ? (
                        <div className="xai-contributions">
                          <p>{xaiAssessment.message}</p>
                          <ul className="contributions-list">
                            {xaiAssessment.contributions?.map((c, i) => (
                              <li key={i}>
                                <strong>{c.feature}:</strong> {c.value.toFixed(4)}
                              </li>
                            ))}
                          </ul>
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
                      <p className="chat-empty">Send a message to ask about your laboratory results.</p>
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

