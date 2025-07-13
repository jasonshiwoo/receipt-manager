import React, { useState, useEffect } from 'react';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase';
import './ReceiptList.css';

export default function ReceiptList() {
  const { currentUser } = useAuth();
  const [receipts, setReceipts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [deletingIds, setDeletingIds] = useState(new Set());

  useEffect(() => {
    if (!currentUser) {
      setLoading(false);
      return;
    }

    // Try query with ordering first, fallback to simple query if index not ready
    const tryQuery = async () => {
      try {
        // Primary query with ordering
        const receiptsQuery = query(
          collection(db, 'receipts'),
          where('userId', '==', currentUser.uid),
          orderBy('createdAt', 'desc')
        );

        const unsubscribe = onSnapshot(
          receiptsQuery,
          (snapshot) => {
            const receiptData = snapshot.docs.map(doc => ({
              id: doc.id,
              ...doc.data()
            }));
            // Sort by createdAt on client side as backup
            receiptData.sort((a, b) => {
              const aTime = a.createdAt?.toDate?.() || new Date(0);
              const bTime = b.createdAt?.toDate?.() || new Date(0);
              return bTime - aTime;
            });
            setReceipts(receiptData);
            setLoading(false);
            setError(null);
          },
          (error) => {
            console.error('Error fetching receipts with ordering:', error);
            // Fallback to simple query without ordering
            trySimpleQuery();
          }
        );

        return unsubscribe;
      } catch (error) {
        console.error('Error setting up query:', error);
        trySimpleQuery();
      }
    };

    const trySimpleQuery = () => {
      try {
        // Fallback query without ordering
        const simpleQuery = query(
          collection(db, 'receipts'),
          where('userId', '==', currentUser.uid)
        );

        const unsubscribe = onSnapshot(
          simpleQuery,
          (snapshot) => {
            const receiptData = snapshot.docs.map(doc => ({
              id: doc.id,
              ...doc.data()
            }));
            // Sort by createdAt on client side
            receiptData.sort((a, b) => {
              const aTime = a.createdAt?.toDate?.() || new Date(0);
              const bTime = b.createdAt?.toDate?.() || new Date(0);
              return bTime - aTime;
            });
            setReceipts(receiptData);
            setLoading(false);
            setError(null);
          },
          (error) => {
            console.error('Error fetching receipts (simple query):', error);
            setError('Failed to load receipts');
            setLoading(false);
          }
        );

        return unsubscribe;
      } catch (error) {
        console.error('Error with simple query:', error);
        setError('Failed to load receipts');
        setLoading(false);
      }
    };

    const unsubscribe = tryQuery();
    return () => {
      if (unsubscribe && typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
  }, [currentUser]);

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const deleteReceipt = async (receiptId) => {
    if (!window.confirm('Are you sure you want to delete this receipt? This action cannot be undone.')) {
      return;
    }

    setDeletingIds(prev => new Set([...prev, receiptId]));

    try {
      const functions = getFunctions();
      const deleteReceiptFn = httpsCallable(functions, 'deleteReceipt');
      
      const result = await deleteReceiptFn({ receiptId });
      
      console.log('Receipt deleted successfully:', result.data);
      
      // The real-time listener will automatically update the UI
      // by removing the deleted receipt from the list
      
    } catch (error) {
      console.error('Error deleting receipt:', error);
      
      let errorMessage = 'Failed to delete receipt';
      if (error.code === 'unauthenticated') {
        errorMessage = 'Authentication required - please log in';
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      alert(errorMessage);
    } finally {
      setDeletingIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(receiptId);
        return newSet;
      });
    }
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return 'Unknown';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  };

  if (loading) {
    return (
      <div className="receipt-list">
        <div className="receipt-list-header">
          <h3>📄 Your Receipts</h3>
          <p>Loading your receipts...</p>
        </div>
        <div className="loading-spinner">
          <div className="spinner"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="receipt-list">
        <div className="receipt-list-header">
          <h3>📄 Your Receipts</h3>
          <p className="error-message">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="receipt-list">
      <div className="receipt-list-header">
        <h3>📄 Your Receipts</h3>
        <p>
          {receipts.length === 0 
            ? 'No receipts uploaded yet. Use the camera above to get started!' 
            : `${receipts.length} receipt${receipts.length !== 1 ? 's' : ''} found`
          }
        </p>
      </div>

      {receipts.length > 0 && (
        <div className="receipt-grid">
          {receipts.map((receipt) => (
            <div key={receipt.id} className="receipt-card">
              <div className="receipt-image">
                <img 
                  src={receipt.storageUrl} 
                  alt={receipt.originalName}
                  loading="lazy"
                />
              </div>
              <div className="receipt-info">
                <h4 className="receipt-name">{receipt.originalName}</h4>
                <div className="receipt-details">
                  <span className="receipt-size">{formatFileSize(receipt.size)}</span>
                  <span className="receipt-date">{formatDate(receipt.uploadedAt)}</span>
                </div>
                <div className="receipt-user-info">
                  <small>User ID: {receipt.userId.substring(0, 8)}...</small>
                </div>
                
                {/* Display OCR data if available */}
                {receipt.extractedData && (
                  <div className="receipt-ocr-data">
                    <div className="ocr-header">
                      <span className="ocr-badge">✅ Processed</span>
                    </div>
                    <div className="ocr-details">
                      {receipt.extractedData.total && (
                        <div className="ocr-item">
                          <span className="ocr-label">💰</span>
                          <span className="ocr-value">${receipt.extractedData.total}</span>
                        </div>
                      )}
                      {receipt.extractedData.date && (
                        <div className="ocr-item">
                          <span className="ocr-label">📅</span>
                          <span className="ocr-value">{receipt.extractedData.date}</span>
                        </div>
                      )}
                      {receipt.extractedData.location && (
                        <div className="ocr-item">
                          <span className="ocr-label">📍</span>
                          <span className="ocr-value">{receipt.extractedData.location}</span>
                        </div>
                      )}
                      {receipt.extractedData.category && (
                        <div className="ocr-item">
                          <span className="ocr-label">🏷️</span>
                          <span className="ocr-value">{receipt.extractedData.category}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
                
                {/* Show processing status if no OCR data yet */}
                {!receipt.extractedData && (
                  <div className="receipt-status">
                    <span className="status-badge processing">🔍 Processing...</span>
                  </div>
                )}
                
                {/* Receipt Actions */}
                <div className="receipt-actions">
                  <button 
                    className={`delete-btn ${deletingIds.has(receipt.id) ? 'deleting' : ''}`}
                    onClick={() => deleteReceipt(receipt.id)}
                    disabled={deletingIds.has(receipt.id)}
                    title="Delete receipt"
                  >
                    {deletingIds.has(receipt.id) ? (
                      <>
                        <span className="spinner"></span>
                        Deleting...
                      </>
                    ) : (
                      <>
                        🗑️ Delete
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
