import React, { useState, useEffect } from 'react';
import { collection, query, where, orderBy, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { useAuth } from '../contexts/AuthContext';
import { db, functions } from '../firebase';
import './ReceiptList.css';

export default function ReceiptList() {
  const { currentUser } = useAuth();
  const [receipts, setReceipts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [deletingIds, setDeletingIds] = useState(new Set());
  const [editingReceipt, setEditingReceipt] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [saving, setSaving] = useState(false);

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
    if (!currentUser) {
      alert('You must be logged in to delete receipts');
      return;
    }

    if (!window.confirm('Are you sure you want to delete this receipt? This action cannot be undone.')) {
      return;
    }

    console.log('Delete attempt:', {
      receiptId,
      userId: currentUser.uid,
      userEmail: currentUser.email
    });

    setDeletingIds(prev => new Set([...prev, receiptId]));

    try {
      // Ensure user is authenticated and get fresh token
      const idToken = await currentUser.getIdToken(true);
      console.log('Got auth token, length:', idToken.length);
      
      const deleteReceiptFn = httpsCallable(functions, 'deleteReceipt');
      
      console.log('Calling deleteReceipt function...');
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

  const handleEditReceipt = (receipt) => {
    setEditingReceipt(receipt);
    setEditForm({
      originalName: receipt.originalName || '',
      total: receipt.total || '',
      date: receipt.date || '',
      location: typeof receipt.location === 'string' ? receipt.location : receipt.location?.full || '',
      category: receipt.category || '',
      description: receipt.description || ''
    });
  };

  const handleSaveEdit = async () => {
    if (!editingReceipt || !currentUser) return;

    setSaving(true);
    try {
      const receiptRef = doc(db, 'receipts', editingReceipt.id);
      await updateDoc(receiptRef, {
        originalName: editForm.originalName,
        total: parseFloat(editForm.total) || 0,
        date: editForm.date,
        location: editForm.location,
        category: editForm.category,
        description: editForm.description,
        updatedAt: new Date()
      });
      
      setEditingReceipt(null);
      setEditForm({});
    } catch (error) {
      console.error('Error updating receipt:', error);
      alert('Failed to update receipt. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setEditingReceipt(null);
    setEditForm({});
  };

  const handleFormChange = (field, value) => {
    setEditForm(prev => ({ ...prev, [field]: value }));
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
            <div key={receipt.id} className="receipt-card" onClick={() => handleEditReceipt(receipt)}>
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
                {(receipt.total || receipt.date || receipt.location || receipt.category) && (
                  <div className="receipt-ocr-data">
                    <div className="ocr-header">
                      <span className="ocr-badge">✅ Processed</span>
                    </div>
                    <div className="ocr-details">
                      {receipt.total && (
                        <div className="ocr-item">
                          <span className="ocr-label">💰</span>
                          <span className="ocr-value">${typeof receipt.total === 'number' ? receipt.total.toFixed(2) : receipt.total}</span>
                        </div>
                      )}
                      {receipt.date && (
                        <div className="ocr-item">
                          <span className="ocr-label">📅</span>
                          <span className="ocr-value">{receipt.date}</span>
                        </div>
                      )}
                      {receipt.location && (
                        <div className="ocr-item">
                          <span className="ocr-label">📍</span>
                          <span className="ocr-value">{typeof receipt.location === 'string' ? receipt.location : receipt.location?.full || 'Unknown'}</span>
                        </div>
                      )}
                      {receipt.category && (
                        <div className="ocr-item">
                          <span className="ocr-label">🏷️</span>
                          <span className="ocr-value">{receipt.category}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
                
                {/* Show processing status if no OCR data yet */}
                {!(receipt.total || receipt.date || receipt.location || receipt.category) && (
                  <div className="receipt-status">
                    <span className="status-badge processing">🔍 Processing...</span>
                  </div>
                )}
                
                {/* Receipt Actions */}
                <div className="receipt-actions">
                  <button 
                    className="edit-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleEditReceipt(receipt);
                    }}
                    title="Edit receipt"
                  >
                    ✏️ Edit
                  </button>
                  <button 
                    className={`delete-btn ${deletingIds.has(receipt.id) ? 'deleting' : ''}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteReceipt(receipt.id);
                    }}
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

      {/* Edit Modal */}
      {editingReceipt && (
        <div className="modal-overlay" onClick={handleCancelEdit}>
          <div className="edit-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>✏️ Edit Receipt</h3>
              <button className="close-btn" onClick={handleCancelEdit}>×</button>
            </div>
            
            <div className="modal-body">
              <div className="form-group">
                <label>Receipt Name:</label>
                <input
                  type="text"
                  value={editForm.originalName}
                  onChange={(e) => handleFormChange('originalName', e.target.value)}
                  placeholder="Enter receipt name"
                />
              </div>
              
              <div className="form-group">
                <label>Total Amount:</label>
                <input
                  type="number"
                  step="0.01"
                  value={editForm.total}
                  onChange={(e) => handleFormChange('total', e.target.value)}
                  placeholder="0.00"
                />
              </div>
              
              <div className="form-group">
                <label>Date:</label>
                <input
                  type="text"
                  value={editForm.date}
                  onChange={(e) => handleFormChange('date', e.target.value)}
                  placeholder="Enter date"
                />
              </div>
              
              <div className="form-group">
                <label>Location:</label>
                <input
                  type="text"
                  value={editForm.location}
                  onChange={(e) => handleFormChange('location', e.target.value)}
                  placeholder="Enter location"
                />
              </div>
              
              <div className="form-group">
                <label>Category:</label>
                <input
                  type="text"
                  value={editForm.category}
                  onChange={(e) => handleFormChange('category', e.target.value)}
                  placeholder="Enter category"
                />
              </div>
              
              <div className="form-group">
                <label>Description:</label>
                <textarea
                  value={editForm.description}
                  onChange={(e) => handleFormChange('description', e.target.value)}
                  placeholder="Enter description (optional)"
                  rows="3"
                />
              </div>
            </div>
            
            <div className="modal-footer">
              <button className="cancel-btn" onClick={handleCancelEdit}>
                Cancel
              </button>
              <button 
                className="save-btn" 
                onClick={handleSaveEdit}
                disabled={saving}
              >
                {saving ? (
                  <>
                    <span className="spinner"></span>
                    Saving...
                  </>
                ) : (
                  'Save Changes'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
