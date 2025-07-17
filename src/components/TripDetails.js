import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, orderBy, updateDoc, doc, serverTimestamp } from 'firebase/firestore';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth, db } from '../firebase';
import './TripDetails.css';

const TripDetails = ({ tripId, onBack, onEditTrip }) => {
  const [user] = useAuthState(auth);
  const [trip, setTrip] = useState(null);
  const [receipts, setReceipts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showAddReceipts, setShowAddReceipts] = useState(false);

  useEffect(() => {
    if (!user || !tripId) return;

    // Listen to the specific trip
    const tripDocRef = doc(db, `users/${user.uid}/trips`, tripId);
    
    const unsubscribeTrip = onSnapshot(tripDocRef, (snapshot) => {
      if (snapshot.exists()) {
        setTrip({
          id: snapshot.id,
          ...snapshot.data()
        });
      }
    });

    // Listen to all receipts to get both assigned and unassigned
    const receiptsQuery = query(
      collection(db, 'receipts'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );
    
    const unsubscribeReceipts = onSnapshot(receiptsQuery, (snapshot) => {
      const receiptsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setReceipts(receiptsData);
    });

    return () => {
      unsubscribeTrip();
      unsubscribeReceipts();
    };
  }, [user, tripId]);

  // Get receipts for this specific trip
  const getReceiptsForTrip = () => {
    return receipts.filter(receipt => receipt.tripId === tripId);
  };

  // Get unassigned receipts
  const getUnassignedReceipts = () => {
    return receipts.filter(receipt => !receipt.tripId);
  };

  // Calculate trip total
  const getTripTotal = () => {
    const tripReceipts = getReceiptsForTrip();
    return tripReceipts.reduce((total, receipt) => {
      const receiptTotal = typeof receipt.total === 'number' ? receipt.total : 0;
      return total + receiptTotal;
    }, 0);
  };

  // Get expense breakdown by category
  const getTripExpensesByCategory = () => {
    const tripReceipts = getReceiptsForTrip();
    const categoryTotals = {};
    
    tripReceipts.forEach(receipt => {
      const category = receipt.category || 'Uncategorized';
      const amount = typeof receipt.total === 'number' ? receipt.total : 0;
      categoryTotals[category] = (categoryTotals[category] || 0) + amount;
    });
    
    return Object.entries(categoryTotals)
      .map(([category, total]) => ({ category, total }))
      .sort((a, b) => b.total - a.total);
  };

  // Handle assigning receipt to trip
  const handleAssignReceipt = async (receiptId, tripName) => {
    if (!receiptId || !tripId) return;
    
    setLoading(true);
    try {
      const receiptRef = doc(db, 'receipts', receiptId);
      await updateDoc(receiptRef, {
        tripId: tripId,
        tripName: tripName,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      console.error('Error assigning receipt to trip:', error);
      setError('Failed to assign receipt to trip');
    } finally {
      setLoading(false);
    }
  };

  // Handle removing receipt from trip
  const handleRemoveReceiptFromTrip = async (receiptId) => {
    if (!receiptId) return;
    
    setLoading(true);
    try {
      const receiptRef = doc(db, 'receipts', receiptId);
      await updateDoc(receiptRef, {
        tripId: null,
        tripName: null,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      console.error('Error removing receipt from trip:', error);
      setError('Failed to remove receipt from trip');
    } finally {
      setLoading(false);
    }
  };

  // Format date helper
  const formatDate = (dateValue) => {
    if (!dateValue) return 'Invalid Date';
    
    // Handle Firestore Timestamp objects
    if (dateValue.toDate && typeof dateValue.toDate === 'function') {
      return dateValue.toDate().toLocaleDateString();
    }
    
    // Handle regular Date objects or date strings
    const date = new Date(dateValue);
    return isNaN(date.getTime()) ? 'Invalid Date' : date.toLocaleDateString();
  };

  if (!trip) {
    return (
      <div className="trip-details-loading">
        <div className="loading-spinner"></div>
        <p>Loading trip details...</p>
      </div>
    );
  }

  return (
    <div className="trip-details-page">
      {/* Header with back button */}
      <div className="trip-details-header">
        <button onClick={onBack} className="back-btn">
          ← Back to Trips
        </button>
        <div className="trip-title-section">
          <h1>📊 {trip.name}</h1>
          <p className="trip-subtitle">Trip Details & Management</p>
        </div>
      </div>

      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      <div className="trip-details-content">
        {/* Trip Info Section */}
        <div className="trip-info-section">
          <div className="trip-basic-info">
            <div className="info-item">
              <span className="info-label">📅 Dates:</span>
              <span className="info-value">{formatDate(trip.startDate)} - {formatDate(trip.endDate)}</span>
            </div>
            {trip.location && (
              <div className="info-item">
                <span className="info-label">📍 Location:</span>
                <span className="info-value">{trip.location}</span>
              </div>
            )}
            <div className="info-item">
              <span className="info-label">💰 Total Expenses:</span>
              <span className="info-value total-amount">${getTripTotal().toFixed(2)}</span>
            </div>
            <div className="info-item">
              <span className="info-label">📝 Total Receipts:</span>
              <span className="info-value">{getReceiptsForTrip().length}</span>
            </div>
          </div>
          
          <div className="trip-actions-detailed">
            <button 
              onClick={() => onEditTrip(trip)}
              className="btn-edit-detailed"
            >
              ✏️ Edit Trip Info
            </button>
          </div>
        </div>

        {/* Expense Breakdown by Category */}
        <div className="expense-breakdown-section">
          <h2>📊 Expense Breakdown by Category</h2>
          {getTripExpensesByCategory().length === 0 ? (
            <p className="no-expenses">No expenses recorded for this trip</p>
          ) : (
            <div className="category-breakdown">
              {getTripExpensesByCategory().map(({ category, total }) => {
                const percentage = ((total / getTripTotal()) * 100).toFixed(1);
                return (
                  <div key={category} className="category-item">
                    <div className="category-header">
                      <span className="category-name">{category}</span>
                      <span className="category-amount">${total.toFixed(2)} ({percentage}%)</span>
                    </div>
                    <div className="category-bar">
                      <div 
                        className="category-fill" 
                        style={{ width: `${percentage}%` }}
                      ></div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* All Receipts Section */}
        <div className="trip-receipts-section">
          <h2>📝 All Trip Receipts ({getReceiptsForTrip().length})</h2>
          {getReceiptsForTrip().length === 0 ? (
            <p className="no-receipts">No receipts assigned to this trip</p>
          ) : (
            <div className="detailed-receipts-grid">
              {getReceiptsForTrip()
                .sort((a, b) => new Date(b.date || b.createdAt) - new Date(a.date || a.createdAt))
                .map(receipt => (
                <div key={receipt.id} className="detailed-receipt-card">
                  {/* Receipt Image */}
                  <div className="receipt-image-container">
                    {receipt.storageUrl ? (
                      <img 
                        src={receipt.storageUrl} 
                        alt={receipt.originalName || 'Receipt'} 
                        className="receipt-image"
                        onError={(e) => {
                          e.target.style.display = 'none';
                          e.target.nextSibling.style.display = 'flex';
                        }}
                      />
                    ) : null}
                    <div className="receipt-placeholder" style={{ display: receipt.storageUrl ? 'none' : 'flex' }}>
                      <span>📄</span>
                      <p>No Image</p>
                    </div>
                  </div>
                  
                  {/* Receipt Info */}
                  <div className="receipt-info-section">
                    <div className="receipt-header">
                      <h3 className="receipt-name">{receipt.originalName || 'Receipt'}</h3>
                      <span className="receipt-amount">${(typeof receipt.total === 'number' ? receipt.total : 0).toFixed(2)}</span>
                    </div>
                    
                    <div className="receipt-meta">
                      <span className="receipt-date">
                        📅 {new Date(receipt.date || receipt.createdAt).toLocaleDateString()}
                      </span>
                      {receipt.category && (
                        <span className="receipt-category">
                          🏷️ {receipt.category}
                        </span>
                      )}
                      {receipt.location && (
                        <span className="receipt-location">
                          📍 {typeof receipt.location === 'string' ? receipt.location : receipt.location?.full || 'Unknown'}
                        </span>
                      )}
                    </div>
                    
                    <div className="receipt-actions">
                      <button
                        onClick={() => handleRemoveReceiptFromTrip(receipt.id)}
                        className="btn-remove-receipt"
                        disabled={loading}
                        title="Remove from trip"
                      >
                        ❌ Remove from Trip
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Add Receipts Section */}
        <div className="add-receipts-section">
          <h2 
            className="collapsible-header"
            onClick={() => setShowAddReceipts(!showAddReceipts)}
          >
            {showAddReceipts ? '▼' : '▶'} Add Receipts to Trip ({getUnassignedReceipts().length} available)
          </h2>
          
          {showAddReceipts && (
            <>
              {getUnassignedReceipts().length === 0 ? (
                <p className="no-unassigned">All receipts are already assigned to trips</p>
              ) : (
                <div className="unassigned-receipts-grid">
                  {getUnassignedReceipts()
                    .sort((a, b) => new Date(b.date || b.createdAt) - new Date(a.date || a.createdAt))
                    .map(receipt => (
                    <div key={receipt.id} className="unassigned-receipt-card">
                      {/* Receipt Image */}
                      <div className="receipt-image-container">
                        {receipt.storageUrl ? (
                          <img 
                            src={receipt.storageUrl} 
                            alt={receipt.originalName || 'Receipt'} 
                            className="receipt-image"
                            onError={(e) => {
                              e.target.style.display = 'none';
                              e.target.nextSibling.style.display = 'flex';
                            }}
                          />
                        ) : null}
                        <div className="receipt-placeholder" style={{ display: receipt.storageUrl ? 'none' : 'flex' }}>
                          <span>📄</span>
                          <p>No Image</p>
                        </div>
                      </div>
                      
                      {/* Receipt Info */}
                      <div className="receipt-info-section">
                        <div className="receipt-header">
                          <h3 className="receipt-name">{receipt.originalName || 'Receipt'}</h3>
                          <span className="receipt-amount">${(typeof receipt.total === 'number' ? receipt.total : 0).toFixed(2)}</span>
                        </div>
                        
                        <div className="receipt-meta">
                          <span className="receipt-date">
                            📅 {new Date(receipt.date || receipt.createdAt).toLocaleDateString()}
                          </span>
                          {receipt.category && (
                            <span className="receipt-category">
                              🏷️ {receipt.category}
                            </span>
                          )}
                        </div>
                        
                        <div className="receipt-actions">
                          <button
                            onClick={() => handleAssignReceipt(receipt.id, trip.name)}
                            className="btn-add-receipt"
                            disabled={loading}
                          >
                            ➕ Add to Trip
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default TripDetails;
