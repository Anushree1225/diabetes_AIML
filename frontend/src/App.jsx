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
  const [uploadError, setUploadError] = useState(null);
  const fileInputRef = useRef(null);

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
