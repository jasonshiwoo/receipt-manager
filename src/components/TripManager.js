import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, orderBy, addDoc, updateDoc, doc, serverTimestamp } from 'firebase/firestore';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth, db } from '../firebase';
import './TripManager.css';

const TripManager = ({ onViewTripDetails, editingTrip, onEditTrip }) => {
  const [user] = useAuthState(auth);
  const [trips, setTrips] = useState([]);
  const [receipts, setReceipts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [selectedTrip, setSelectedTrip] = useState(null);
  
  const [newTrip, setNewTrip] = useState({
    name: '',
    startDate: '',
    endDate: '',
    location: ''
  });
  
  const [editTrip, setEditTrip] = useState({
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

  // Auto-assign receipts to trips based on date ranges
  const autoAssignReceipts = async () => {
    if (!user || trips.length === 0 || receipts.length === 0) return;

    const unassignedReceipts = receipts.filter(receipt => !receipt.tripId);
    
    for (const receipt of unassignedReceipts) {
      const receiptDate = new Date(receipt.date || receipt.createdAt);
      
      // Find a trip that contains this receipt's date
      const matchingTrip = trips.find(trip => {
        const tripStartDate = trip.startDate?.toDate ? trip.startDate.toDate() : new Date(trip.startDate);
        const tripEndDate = trip.endDate?.toDate ? trip.endDate.toDate() : new Date(trip.endDate);
        
        // Set times to start/end of day for proper comparison
        tripStartDate.setHours(0, 0, 0, 0);
        tripEndDate.setHours(23, 59, 59, 999);
        receiptDate.setHours(12, 0, 0, 0); // Set to noon to avoid timezone issues
        
        return receiptDate >= tripStartDate && receiptDate <= tripEndDate;
      });
      
      if (matchingTrip) {
        try {
          const receiptRef = doc(db, 'receipts', receipt.id);
          await updateDoc(receiptRef, {
            tripId: matchingTrip.id,
            tripName: matchingTrip.name,
            updatedAt: serverTimestamp()
          });
          console.log(`Auto-assigned receipt ${receipt.id} to trip ${matchingTrip.name}`);
        } catch (error) {
          console.error('Error auto-assigning receipt:', error);
        }
      }
    }
  };

  // Auto-assign receipts when trips or receipts change
  useEffect(() => {
    // Debounce the auto-assignment to avoid excessive calls
    const timeoutId = setTimeout(autoAssignReceipts, 1000);
    return () => clearTimeout(timeoutId);
  }, [trips, receipts, user]);

  // Handle editingTrip prop changes
  useEffect(() => {
    if (editingTrip) {
      setEditTrip({
        name: editingTrip.name,
        startDate: editingTrip.startDate?.toDate ? editingTrip.startDate.toDate().toISOString().split('T')[0] : new Date(editingTrip.startDate).toISOString().split('T')[0],
        endDate: editingTrip.endDate?.toDate ? editingTrip.endDate.toDate().toISOString().split('T')[0] : new Date(editingTrip.endDate).toISOString().split('T')[0],
        location: editingTrip.location || ''
      });
      setShowEditForm(true);
    }
  }, [editingTrip]);

  const handleCreateTrip = async (e) => {
    e.preventDefault();
    if (!newTrip.name || !newTrip.startDate || !newTrip.endDate) {
      setError('Please fill in all required fields');
      return;
    }

    if (!user) {
      setError('You must be logged in to create a trip');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Create dates at local midnight to avoid timezone issues
      const createLocalDate = (dateString) => {
        const [year, month, day] = dateString.split('-').map(Number);
        return new Date(year, month - 1, day); // month is 0-indexed
      };

      const tripData = {
        name: newTrip.name,
        startDate: createLocalDate(newTrip.startDate),
        endDate: createLocalDate(newTrip.endDate),
        location: newTrip.location || '',
        userId: user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      await addDoc(collection(db, `users/${user.uid}/trips`), tripData);

      setNewTrip({ name: '', startDate: '', endDate: '', location: '' });
      setShowCreateForm(false);
      
      // Trigger auto-assignment for the new trip
      setTimeout(autoAssignReceipts, 500);
    } catch (error) {
      console.error('Error creating trip:', error);
      setError(error.message || 'Failed to create trip');
    } finally {
      setLoading(false);
    }
  };

  const handleEditTrip = (trip) => {
    onEditTrip(trip);
    setEditTrip({
      name: trip.name,
      startDate: trip.startDate?.toDate ? trip.startDate.toDate().toISOString().split('T')[0] : new Date(trip.startDate).toISOString().split('T')[0],
      endDate: trip.endDate?.toDate ? trip.endDate.toDate().toISOString().split('T')[0] : new Date(trip.endDate).toISOString().split('T')[0],
      location: trip.location || ''
    });
    setShowEditForm(true);
  };

  const handleUpdateTrip = async (e) => {
    e.preventDefault();
    if (!editTrip.name || !editTrip.startDate || !editTrip.endDate) {
      setError('Please fill in all required fields');
      return;
    }

    if (!user || !editingTrip) {
      setError('You must be logged in to update a trip');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Create dates at local midnight to avoid timezone issues
      const createLocalDate = (dateString) => {
        const [year, month, day] = dateString.split('-').map(Number);
        return new Date(year, month - 1, day); // month is 0-indexed
      };

      const tripData = {
        name: editTrip.name,
        startDate: createLocalDate(editTrip.startDate),
        endDate: createLocalDate(editTrip.endDate),
        location: editTrip.location || '',
        updatedAt: serverTimestamp()
      };

      await updateDoc(doc(db, `users/${user.uid}/trips`, editingTrip.id), tripData);

      setEditTrip({ name: '', startDate: '', endDate: '', location: '' });
      onEditTrip(null);
      setShowEditForm(false);
      
      // Trigger auto-assignment for the updated trip
      setTimeout(autoAssignReceipts, 500);
    } catch (error) {
      console.error('Error updating trip:', error);
      setError(error.message || 'Failed to update trip');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelEdit = () => {
    setEditTrip({ name: '', startDate: '', endDate: '', location: '' });
    onEditTrip(null);
    setShowEditForm(false);
  };

  const handleAssignReceipt = async (receiptId, tripId, tripName) => {
    if (!user) {
      setError('You must be logged in to assign receipts');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const receiptRef = doc(db, 'receipts', receiptId);
      await updateDoc(receiptRef, {
        tripId: tripId,
        tripName: tripName,
        updatedAt: serverTimestamp()
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

  // Handle opening trip details
  const handleViewTripDetails = (trip) => {
    onViewTripDetails(trip.id);
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

      {showEditForm && (
        <div className="create-trip-form">
          <div className="form-header">
            <h3>✏️ Edit Trip</h3>
            <button 
              onClick={handleCancelEdit}
              className="close-btn"
            >
              ✕
            </button>
          </div>
          
          <form onSubmit={handleUpdateTrip}>
            <div className="form-group">
              <label>Trip Name *</label>
              <input
                type="text"
                value={editTrip.name}
                onChange={(e) => setEditTrip(prev => ({ ...prev, name: e.target.value }))}
                placeholder="e.g., Business Trip to NYC, Vacation in Paris"
                required
              />
            </div>
            
            <div className="form-row">
              <div className="form-group">
                <label>Start Date *</label>
                <input
                  type="date"
                  value={editTrip.startDate}
                  onChange={(e) => setEditTrip(prev => ({ ...prev, startDate: e.target.value }))}
                  required
                />
              </div>
              
              <div className="form-group">
                <label>End Date *</label>
                <input
                  type="date"
                  value={editTrip.endDate}
                  onChange={(e) => setEditTrip(prev => ({ ...prev, endDate: e.target.value }))}
                  required
                />
              </div>
            </div>
            
            <div className="form-group">
              <label>Location</label>
              <input
                type="text"
                value={editTrip.location}
                onChange={(e) => setEditTrip(prev => ({ ...prev, location: e.target.value }))}
                placeholder="City, State/Country"
              />
            </div>
            
            <div className="form-actions">
              <button 
                type="button" 
                onClick={handleCancelEdit}
                className="btn-cancel"
              >
                Cancel
              </button>
              <button 
                type="submit" 
                className="btn-update"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <div className="spinner"></div>
                    Updating...
                  </>
                ) : (
                  <>
                    ✅ Update Trip
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
                      {formatDate(trip.startDate)} - {formatDate(trip.endDate)}
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
                      onClick={() => handleViewTripDetails(trip)}
                      className="btn-view-details"
                    >
                      📊 View Details
                    </button>
                    <button 
                      onClick={() => setSelectedTrip(selectedTrip === trip.id ? null : trip.id)}
                      className="btn-manage"
                    >
                      {selectedTrip === trip.id ? 'Hide' : 'Quick Assign'}
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
