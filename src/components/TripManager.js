import React, { useState, useEffect } from 'react';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth, db } from '../firebase';
import './TripManager.css';

const TripManager = () => {
  const [user] = useAuthState(auth);
  const [trips, setTrips] = useState([]);
  const [receipts, setReceipts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedTrip, setSelectedTrip] = useState(null);
  
  const [newTrip, setNewTrip] = useState({
    name: '',
    startDate: '',
    endDate: '',
    location: ''
  });

  useEffect(() => {
    if (!user) return;

    // Listen to trips
    const tripsQuery = query(
      collection(db, `users/${user.uid}/trips`),
      orderBy('startDate', 'desc')
    );
    
    const unsubscribeTrips = onSnapshot(tripsQuery, (snapshot) => {
      const tripsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setTrips(tripsData);
    });

    // Listen to receipts
    const receiptsQuery = query(
      collection(db, 'receipts'),
      where('userId', '==', user.uid),
      orderBy('date', 'desc')
    );
    
    const unsubscribeReceipts = onSnapshot(receiptsQuery, (snapshot) => {
      const receiptsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setReceipts(receiptsData);
    });

    return () => {
      unsubscribeTrips();
      unsubscribeReceipts();
    };
  }, [user]);

  const handleCreateTrip = async (e) => {
    e.preventDefault();
    if (!newTrip.name || !newTrip.startDate || !newTrip.endDate) {
      setError('Please fill in all required fields');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const functions = getFunctions();
      const createTripFunction = httpsCallable(functions, 'createTrip');
      
      await createTripFunction({
        name: newTrip.name,
        startDate: newTrip.startDate,
        endDate: newTrip.endDate,
        location: newTrip.location
      });

      setNewTrip({ name: '', startDate: '', endDate: '', location: '' });
      setShowCreateForm(false);
    } catch (error) {
      console.error('Error creating trip:', error);
      setError(error.message || 'Failed to create trip');
    } finally {
      setLoading(false);
    }
  };

  const handleAssignReceipt = async (receiptId, tripId, tripName) => {
    setLoading(true);
    setError(null);

    try {
      const functions = getFunctions();
      const assignReceiptFunction = httpsCallable(functions, 'assignReceiptToTrip');
      
      await assignReceiptFunction({
        receiptId,
        tripId,
        tripName
      });
    } catch (error) {
      console.error('Error assigning receipt to trip:', error);
      setError(error.message || 'Failed to assign receipt to trip');
    } finally {
      setLoading(false);
    }
  };

  const getReceiptsForTrip = (trip) => {
    return receipts.filter(receipt => receipt.tripId === trip.id);
  };

  const getUnassignedReceipts = () => {
    return receipts.filter(receipt => !receipt.tripId);
  };

  const getTripTotal = (trip) => {
    const tripReceipts = getReceiptsForTrip(trip);
    return tripReceipts.reduce((total, receipt) => {
      const receiptTotal = typeof receipt.total === 'number' ? receipt.total : 0;
      return total + receiptTotal;
    }, 0);
  };

  if (!user) {
    return (
      <div className="trip-manager">
        <div className="auth-required">
          <h3>🔒 Authentication Required</h3>
          <p>Please sign in to manage your trips</p>
        </div>
      </div>
    );
  }

  return (
    <div className="trip-manager">
      <div className="manager-header">
        <h2>✈️ Trip Manager</h2>
        <p>Organize your receipts by trips and track expenses</p>
        <button 
          onClick={() => setShowCreateForm(true)}
          className="create-trip-btn"
        >
          ➕ Create New Trip
        </button>
      </div>

      {error && (
        <div className="error-message">
          <span className="error-icon">⚠️</span>
          {error}
          <button onClick={() => setError(null)} className="dismiss-btn">
            Dismiss
          </button>
        </div>
      )}

      {showCreateForm && (
        <div className="create-trip-form">
          <div className="form-header">
            <h3>🆕 Create New Trip</h3>
            <button 
              onClick={() => setShowCreateForm(false)}
              className="close-btn"
            >
              ✕
            </button>
          </div>
          
          <form onSubmit={handleCreateTrip}>
            <div className="form-group">
              <label>Trip Name *</label>
              <input
                type="text"
                value={newTrip.name}
                onChange={(e) => setNewTrip(prev => ({ ...prev, name: e.target.value }))}
                placeholder="e.g., Business Trip to NYC, Vacation in Paris"
                required
              />
            </div>
            
            <div className="form-row">
              <div className="form-group">
                <label>Start Date *</label>
                <input
                  type="date"
                  value={newTrip.startDate}
                  onChange={(e) => setNewTrip(prev => ({ ...prev, startDate: e.target.value }))}
                  required
                />
              </div>
              
              <div className="form-group">
                <label>End Date *</label>
                <input
                  type="date"
                  value={newTrip.endDate}
                  onChange={(e) => setNewTrip(prev => ({ ...prev, endDate: e.target.value }))}
                  required
                />
              </div>
            </div>
            
            <div className="form-group">
              <label>Location</label>
              <input
                type="text"
                value={newTrip.location}
                onChange={(e) => setNewTrip(prev => ({ ...prev, location: e.target.value }))}
                placeholder="City, State/Country"
              />
            </div>
            
            <div className="form-actions">
              <button 
                type="button" 
                onClick={() => setShowCreateForm(false)}
                className="btn-cancel"
              >
                Cancel
              </button>
              <button 
                type="submit" 
                className="btn-create"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <div className="spinner"></div>
                    Creating...
                  </>
                ) : (
                  <>
                    ✈️ Create Trip
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="trips-section">
        <h3>📋 Your Trips ({trips.length})</h3>
        
        {trips.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">✈️</div>
            <h4>No trips yet</h4>
            <p>Create your first trip to start organizing receipts by travel</p>
          </div>
        ) : (
          <div className="trips-grid">
            {trips.map(trip => {
              const tripReceipts = getReceiptsForTrip(trip);
              const tripTotal = getTripTotal(trip);
              
              return (
                <div key={trip.id} className="trip-card">
                  <div className="trip-header">
                    <h4>{trip.name}</h4>
                    <div className="trip-dates">
                      {new Date(trip.startDate).toLocaleDateString()} - {new Date(trip.endDate).toLocaleDateString()}
                    </div>
                    {trip.location && (
                      <div className="trip-location">📍 {trip.location}</div>
                    )}
                  </div>
                  
                  <div className="trip-stats">
                    <div className="stat">
                      <span className="stat-label">Receipts:</span>
                      <span className="stat-value">{tripReceipts.length}</span>
                    </div>
                    <div className="stat">
                      <span className="stat-label">Total:</span>
                      <span className="stat-value">${typeof tripTotal === 'number' ? tripTotal.toFixed(2) : '0.00'}</span>
                    </div>
                  </div>
                  
                  {tripReceipts.length > 0 && (
                    <div className="trip-receipts">
                      <h5>Recent Receipts:</h5>
                      <div className="receipt-list">
                        {tripReceipts.slice(0, 3).map(receipt => (
                          <div key={receipt.id} className="receipt-item">
                            <span className="receipt-date">
                              {new Date(receipt.date || receipt.createdAt).toLocaleDateString()}
                            </span>
                            <span className="receipt-amount">
                              ${typeof receipt.total === 'number' ? receipt.total.toFixed(2) : '0.00'}
                            </span>
                          </div>
                        ))}
                        {tripReceipts.length > 3 && (
                          <div className="more-receipts">
                            +{tripReceipts.length - 3} more receipts
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  
                  <div className="trip-actions">
                    <button 
                      onClick={() => setSelectedTrip(selectedTrip === trip.id ? null : trip.id)}
                      className="btn-manage"
                    >
                      {selectedTrip === trip.id ? 'Hide Details' : 'Manage Receipts'}
                    </button>
                  </div>
                  
                  {selectedTrip === trip.id && (
                    <div className="trip-management">
                      <div className="unassigned-receipts">
                        <h5>📄 Unassigned Receipts:</h5>
                        {getUnassignedReceipts().length === 0 ? (
                          <p>All receipts are assigned to trips</p>
                        ) : (
                          <div className="receipt-assignment-list">
                            {getUnassignedReceipts().map(receipt => (
                              <div key={receipt.id} className="assignable-receipt">
                                <div className="receipt-info">
                                  <span className="receipt-date">
                                    {new Date(receipt.date || receipt.createdAt).toLocaleDateString()}
                                  </span>
                                  <span className="receipt-amount">
                                    ${typeof receipt.total === 'number' ? receipt.total.toFixed(2) : '0.00'}
                                  </span>
                                  {receipt.location && (
                                    <span className="receipt-location">
                                      📍 {typeof receipt.location === 'string' ? receipt.location : receipt.location?.full || 'Unknown'}
                                    </span>
                                  )}
                                </div>
                                <button
                                  onClick={() => handleAssignReceipt(receipt.id, trip.id, trip.name)}
                                  className="btn-assign"
                                  disabled={loading}
                                >
                                  Assign to Trip
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default TripManager;
