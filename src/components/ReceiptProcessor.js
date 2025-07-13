import React, { useState } from 'react';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '../firebase';
import ReceiptConfirmationForm from './ReceiptConfirmationForm';
import './ReceiptProcessor.css';

const ReceiptProcessor = ({ receiptId, imageUrl, onProcessingComplete }) => {
  const [user] = useAuthState(auth);
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [showConfirmation, setShowConfirmation] = useState(false);

  const processReceipt = async () => {
    if (!receiptId || !imageUrl) {
      setError('Receipt ID and image URL are required');
      return;
    }

    if (!user) {
      setError('User must be authenticated');
      return;
    }

    setProcessing(true);
    setError(null);
    setResult(null);

    try {
      const functions = getFunctions();
      const processReceiptFunction = httpsCallable(functions, 'processReceipt');
      
      console.log('Processing receipt:', { receiptId, imageUrl });
      
      const response = await processReceiptFunction({
        receiptId,
        imageUrl
      });

      console.log('OCR processing result:', response.data);
      console.log('Setting result and showing confirmation...');
      setResult(response.data);
      setShowConfirmation(true);
      
      if (onProcessingComplete) {
        onProcessingComplete(response.data);
      }
    } catch (err) {
      console.error('Error processing receipt:', err);
      setError(err.message || 'Failed to process receipt');
    } finally {
      setProcessing(false);
    }
  };

  const handleConfirmationComplete = (finalData) => {
    setShowConfirmation(false);
    if (onProcessingComplete) {
      onProcessingComplete(finalData);
    }
  };

  if (showConfirmation && result) {
    return (
      <ReceiptConfirmationForm
        receiptId={receiptId}
        extractedData={result.extractedData}
        onComplete={handleConfirmationComplete}
        onCancel={() => setShowConfirmation(false)}
      />
    );
  }

  return (
    <div className="receipt-processor">
      <div className="processor-header">
        <h3>🔍 Smart Receipt Processing</h3>
        <p>Extract text, detect trips, and categorize your receipts with AI</p>
      </div>

      <div className="processor-actions">
        <button 
          onClick={processReceipt}
          disabled={processing || !receiptId || !imageUrl}
          className={`process-btn ${processing ? 'processing' : ''}`}
        >
          {processing ? (
            <>
              <div className="spinner"></div>
              Analyzing Receipt...
            </>
          ) : (
            <>
              🤖 Smart Process Receipt
            </>
          )}
        </button>
      </div>

      {processing && (
        <div className="processing-status">
          <div className="processing-steps">
            <div className="step active">
              <span className="step-icon">👁️</span>
              <span>Reading text with Google Vision AI</span>
            </div>
            <div className="step active">
              <span className="step-icon">🧠</span>
              <span>Extracting date, amount, and location</span>
            </div>
            <div className="step active">
              <span className="step-icon">🏷️</span>
              <span>Suggesting category and detecting trips</span>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="error-message">
          <span className="error-icon">⚠️</span>
          <div className="error-content">
            <strong>Processing Failed</strong>
            <p>{error}</p>
            <button onClick={() => setError(null)} className="dismiss-btn">
              Dismiss
            </button>
          </div>
        </div>
      )}

      {result && !showConfirmation && (
        <div className="processing-result">
          <div className="result-header">
            <h4>✅ Processing Complete</h4>
            <p>Review and confirm the extracted information</p>
          </div>
          
          <div className="quick-summary">
            {result.date && (
              <div className="summary-item">
                <span className="icon">📅</span>
                <span className="label">Date:</span>
                <span className="value">{result.date}</span>
              </div>
            )}
            {result.total && (
              <div className="summary-item">
                <span className="icon">💰</span>
                <span className="label">Total:</span>
                <span className="value">${result.total.toFixed(2)}</span>
              </div>
            )}
            {result.location && (
              <div className="summary-item">
                <span className="icon">📍</span>
                <span className="label">Location:</span>
                <span className="value">{typeof result.location === 'string' ? result.location : result.location?.full || 'Unknown'}</span>
              </div>
            )}
            {result.category && (
              <div className="summary-item">
                <span className="icon">🏷️</span>
                <span className="label">Category:</span>
                <span className="value">{result.category}</span>
              </div>
            )}
            {result.isPotentialTrip && (
              <div className="summary-item trip-detected">
                <span className="icon">✈️</span>
                <span className="label">Trip Detected:</span>
                <span className="value">This receipt appears to be from a trip!</span>
              </div>
            )}
          </div>

          <div className="result-actions">
            <button 
              onClick={() => setShowConfirmation(true)}
              className="confirm-btn"
            >
              📝 Review & Confirm Details
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReceiptProcessor;
