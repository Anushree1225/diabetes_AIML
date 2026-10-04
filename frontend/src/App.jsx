import { useState, useRef, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import './App.css'

function App() {
  const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
  const [activeTab, setActiveTab] = useState('upload');
  
  const [file, setFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);
  const [extractedData, setExtractedData] = useState(null);
  
  const [showDemographics, setShowDemographics] = useState(false);
  const [demographics, setDemographics] = useState({ age: '', sex: '', bmi: '' });
  const [isAssessing, setIsAssessing] = useState(false);

  const [mlAssessment, setMlAssessment] = useState(null);
  const [xaiAssessment, setXaiAssessment] = useState(null);
  const [llmAssessment, setLlmAssessment] = useState(null);
  const [uploadError, setUploadError] = useState(null);
  const fileInputRef = useRef(null);

  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const chatScrollRef = useRef(null);

  const needsAttention = extractedData ? extractedData.filter(p => p.status && p.status.toLowerCase() !== 'normal') : [];

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
      const response = await fetch(`${API_BASE}/api/extract`, {
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
      const response = await fetch(`${API_BASE}/api/assess`, {
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

  const handleSendMessage = async (e, retryMessage = null) => {
    if (e) e.preventDefault();
    const content = retryMessage || chatInput;
    if (!content.trim()) return;

    const userMessage = { role: 'user', content: content };
    let newChatHistory = chatMessages;
    
    if (!retryMessage) {
      newChatHistory = [...chatMessages, userMessage];
      setChatMessages(newChatHistory);
    }
    
    if (!retryMessage) {
      setChatInput('');
    }
    setIsChatLoading(true);

    const reportContext = {
      extracted_data: extractedData,
      ml_assessment: mlAssessment,
      xai_assessment: xaiAssessment,
      llm_assessment: llmAssessment
    };

    try {
      const historyToSend = retryMessage ? chatMessages.slice(0, -1) : chatMessages;

      const response = await fetch(`${API_BASE}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage.content,
          report_context: reportContext,
          history: historyToSend
        }),
      });

      const data = await response.json();
      
      if (data.status === 'success') {
        setChatMessages(prev => {
          const cleanedPrev = retryMessage ? prev.filter(m => !m.isError) : prev;
          return [...cleanedPrev, { role: 'assistant', content: data.response }];
        });
      } else if (data.status === 'unavailable') {
        setChatMessages(prev => [...prev, { role: 'assistant', content: `AI is temporarily busy. Please try again in a moment.`, isError: true, retryContent: userMessage.content }]);
      } else {
        setChatMessages(prev => [...prev, { role: 'assistant', content: `❌ Error: ${data.response || 'Unknown error'}` }]);
      }
    } catch (err) {
      setChatMessages(prev => [...prev, { role: 'assistant', content: 'AI is temporarily busy. Please try again in a moment.', isError: true, retryContent: userMessage.content }]);
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

  const formatStatusClass = (status) => {
    if (!status) return 'stat-normal';
    const s = status.toLowerCase();
    if (s.includes('high')) return 'stat-high';
    if (s.includes('low')) return 'stat-low';
    if (s.includes('normal')) return 'stat-normal';
    return 'stat-attention';
  };

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="header-logo">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2L20 7V17L12 22L4 17V7L12 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M12 22V12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M20 7L12 12L4 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <circle cx="12" cy="12" r="3" fill="currentColor"/>
          </svg>
          <h1>Lumina Health</h1>
        </div>
      </header>

      <main className="app-content">
        {activeTab === 'upload' && (
          <div className="screen-container slide-in">
            <div className="page-header">
              <h2>New Analysis</h2>
              <p>Securely process your laboratory report</p>
            </div>

            {!showDemographics ? (
              <div className="hero-card upload-hero">
                <div className="upload-dropzone" onClick={() => fileInputRef.current.click()}>
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    style={{ display: 'none' }} 
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={handleFileSelect}
                  />
                  <div className="upload-icon-wrapper">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                  <h3>Upload Document</h3>
                  <p className="upload-hint">Drag & drop or tap to browse</p>
                  <p className="upload-formats">Supported: PDF, JPG, PNG, Mobile Camera</p>
                  
                  {file && (
                    <div className="selected-file">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path><polyline points="13 2 13 9 20 9"></polyline></svg>
                      {file.name}
                    </div>
                  )}
                </div>

                {!isUploading && (
                  <button 
                    className={`btn-primary ${!file ? 'btn-outline' : ''}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (file) handleUpload();
                      else fileInputRef.current.click();
                    }}
                  >
                    {file ? 'Extract Data' : 'Select File'}
                  </button>
                )}

                {isUploading && (
                  <div className="loading-state">
                    <div className="spinner"></div>
                    <p>Processing document with OCR...</p>
                  </div>
                )}
                
                {uploadError && (
                  <div className="alert-error">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                    <span>{uploadError}</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="hero-card demographics-card slide-up">
                <h3>Patient Profile</h3>
                <p className="subtitle">Required for accurate ML assessment</p>
                
                <div className="form-group">
                  <label>Age (Years)</label>
                  <input 
                    type="number" 
                    value={demographics.age} 
                    onChange={(e) => setDemographics({...demographics, age: e.target.value})} 
                    placeholder="e.g. 45"
                    required 
                  />
                </div>
                
                <div className="form-group">
                  <label>Biological Sex</label>
                  <div className="select-wrapper">
                    <select 
                      value={demographics.sex} 
                      onChange={(e) => setDemographics({...demographics, sex: e.target.value})}
                      required
                    >
                      <option value="" disabled>Select...</option>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                    </select>
                  </div>
                </div>
                
                <div className="form-group">
                  <label>BMI (kg/m²) <span className="badge-optional">Optional</span></label>
                  <input 
                    type="number" 
                    step="0.1"
                    value={demographics.bmi} 
                    onChange={(e) => setDemographics({...demographics, bmi: e.target.value})} 
                    placeholder="e.g. 24.5"
                  />
                </div>
                
                {uploadError && (
                  <div className="alert-error">
                    <span>{uploadError}</span>
                  </div>
                )}
                
                <div className="form-actions-row">
                  <button className="btn-secondary" onClick={() => setShowDemographics(false)} disabled={isAssessing}>
                    Back
                  </button>
                  <button className="btn-primary" onClick={handleAssess} disabled={isAssessing}>
                    {isAssessing ? (
                      <><div className="spinner-small"></div> Assessing...</>
                    ) : 'Run ML Assessment'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'results' && (
          <div className="screen-container slide-in">
            <div className="page-header">
              <h2>Your Report</h2>
              <p>Analysis complete for {file?.name}</p>
            </div>

            <div className="dashboard">
              {llmAssessment && (llmAssessment.status === 'success' || llmAssessment.explanation) && (
                <section className="dashboard-section llm-summary">
                  <div className="section-title">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>
                    <h3>AI Summary</h3>
                  </div>
                  <div className="llm-card">
                    <ReactMarkdown className="md-content">{llmAssessment.explanation}</ReactMarkdown>
                  </div>
                </section>
              )}

              {needsAttention.length > 0 && (
                <section className="dashboard-section">
                  <h3 className="section-title">Needs Attention</h3>
                  <div className="param-grid">
                    {needsAttention.map((param, index) => (
                      <div key={index} className={`param-card ${formatStatusClass(param.status)}`}>
                        <div className="param-header">
                          <span className="param-name">{param.name}</span>
                          <span className="param-badge">{param.status}</span>
                        </div>
                        <div className="param-value">
                          <span className="val">{param.value}</span>
                          <span className="unit">{param.unit}</span>
                        </div>
                        <div className="param-ref">Ref: {param.reference_range || '-'}</div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {mlAssessment && (
                <section className="dashboard-section">
                  <h3 className="section-title">ML Assessment</h3>
                  <div className="ml-card">
                    <div className="ml-card-header">
                      <div className="ml-icon">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg>
                      </div>
                      <div>
                        <h4>Diabetes Risk Model</h4>
                        <span className={`status-pill ${mlAssessment.connected ? 'pill-real' : 'pill-demo'}`}>
                          {mlAssessment.connected ? 'REAL' : 'DEMO'}
                        </span>
                      </div>
                    </div>
                    
                    <div className="ml-body">
                      {mlAssessment.status === 'error' ? (
                        <p className="text-error">{mlAssessment.message}</p>
                      ) : (
                        <>
                          <p className="ml-message">{mlAssessment.message}</p>
                          {mlAssessment.confidence !== null && (
                            <div className="ml-viz">
                              <div className="ml-viz-labels">
                                <span>Probability</span>
                                <strong>{(mlAssessment.confidence * 100).toFixed(1)}%</strong>
                              </div>
                              <div className="ml-progress-track">
                                <div className="ml-progress-bar" style={{ width: `${Math.min(mlAssessment.confidence * 100, 100)}%` }}></div>
                              </div>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </section>
              )}

              {xaiAssessment && xaiAssessment.status === 'success' && (
                <section className="dashboard-section">
                  <h3 className="section-title">Why the model decided this</h3>
                  <p className="section-desc">These bars show how strongly each feature influenced the model's prediction.</p>
                  
                  <div className="xai-card">
                    <div className="xai-legend">
                      <span className="legend-pos"><span className="dot pos"></span> Increases Risk</span>
                      <span className="legend-neg"><span className="dot neg"></span> Decreases Risk</span>
                    </div>
                    
                    <div className="xai-list">
                      {xaiAssessment.contributions?.map((c, i) => (
                        <div key={i} className="xai-item">
                          <div className="xai-item-header">
                            <span className="xai-feat">{c.feature}</span>
                            <span className="xai-val">{c.value > 0 ? '+' : ''}{c.value.toFixed(4)}</span>
                          </div>
                          <div className="xai-bar-bg">
                            <div 
                              className={`xai-bar-fill ${c.value > 0 ? 'pos' : 'neg'}`}
                              style={{ width: `${Math.min(Math.abs(c.value) * 100, 100)}%` }}
                            ></div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </section>
              )}

              {extractedData && extractedData.length > 0 && (
                <section className="dashboard-section">
                  <h3 className="section-title">All Results</h3>
                  <div className="param-list">
                    {extractedData.map((param, index) => (
                      <div key={index} className="param-list-item">
                        <div className="pli-left">
                          <span className="pli-name">{param.name}</span>
                          <span className="pli-ref">Ref: {param.reference_range || '-'}</span>
                        </div>
                        <div className="pli-right">
                          <div className="pli-val">{param.value} <span className="pli-unit">{param.unit}</span></div>
                          <span className={`pli-badge ${formatStatusClass(param.status)}`}>{param.status || '-'}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              <section className="dashboard-section text-center action-section">
                <p>Have questions about your report?</p>
                <button className="btn-primary btn-icon" onClick={() => setActiveTab('chat')}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
                  Ask Chatbot
                </button>
              </section>
            </div>
          </div>
        )}

        {activeTab === 'chat' && (
          <div className="screen-container slide-in chat-layout">
            <div className="page-header chat-header">
              <h2>Assistant</h2>
              <p>Discussing: {file?.name}</p>
            </div>

            <div className="chat-window">
              <div className="chat-messages" ref={chatScrollRef}>
                {chatMessages.length === 0 ? (
                  <div className="chat-empty-state">
                    <div className="empty-icon">👋</div>
                    <p>I'm here to answer questions about your lab report. What would you like to know?</p>
                  </div>
                ) : (
                  chatMessages.map((msg, index) => (
                    <div key={index} className={`msg-row ${msg.role}`}>
                      <div className={`msg-bubble ${msg.isError ? 'msg-error' : ''}`}>
                        {msg.role === 'assistant' && !msg.isError ? (
                          <ReactMarkdown className="md-chat">{msg.content}</ReactMarkdown>
                        ) : (
                          <p className="raw-text">{msg.content}</p>
                        )}
                        {msg.isError && (
                          <button className="btn-retry" onClick={() => handleSendMessage(null, msg.retryContent)}>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="1 4 1 10 7 10"></polyline><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path></svg>
                            Retry
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
                {isChatLoading && (
                  <div className="msg-row assistant">
                    <div className="msg-bubble typing-bubble">
                      <div className="dot-flashing"></div>
                    </div>
                  </div>
                )}
              </div>

              <form className="chat-input-wrapper" onSubmit={handleSendMessage}>
                <input
                  type="text"
                  placeholder="Type a question..."
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  disabled={isChatLoading}
                />
                <button type="submit" disabled={isChatLoading || !chatInput.trim()} className="btn-send">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
                </button>
              </form>
            </div>
          </div>
        )}
      </main>

      <nav className="bottom-nav">
        <button 
          className={`nav-item ${activeTab === 'upload' ? 'active' : ''}`}
          onClick={() => setActiveTab('upload')}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/></svg>
          <span>Upload</span>
        </button>
        <button 
          className={`nav-item ${activeTab === 'results' ? 'active' : ''}`}
          onClick={() => setActiveTab('results')}
          disabled={!mlAssessment}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
          <span>Results</span>
        </button>
        <button 
          className={`nav-item ${activeTab === 'chat' ? 'active' : ''}`}
          onClick={() => setActiveTab('chat')}
          disabled={!mlAssessment}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>
          <span>Chat</span>
        </button>
      </nav>
    </div>
  )
}

export default App
