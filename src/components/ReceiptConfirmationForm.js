import React, { useState, useEffect } from 'react';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import './ReceiptConfirmationForm.css';

const ReceiptConfirmationForm = ({ receiptId, extractedData, onComplete, onCancel }) => {
  const [formData, setFormData] = useState({
    date: extractedData?.date || '',
    total: extractedData?.total || '',
    location: extractedData?.location?.full || '',
    category: extractedData?.suggestedCategory || 'Other',
    notes: '',
    merchant: ''
  });
  
  const [tripData, setTripData] = useState({
    isTrip: false,
    tripName: '',
    startDate: '',
    endDate: ''
  });
  
  const [showTripPrompt, setShowTripPrompt] = useState(false);
  const [suggestedReceipts, setSuggestedReceipts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const categories = [
    'Food & Drink',
    'Transportation', 
    'Travel',
    'Shopping',
    'Groceries',
    'Healthcare',
    'Entertainment',
    'Utilities',
    'Insurance',
    'Banking',
    'Other'
  ];

  useEffect(() => {
    // Check if this might be a trip based on location
    if (extractedData?.isPotentialTrip) {
      setShowTripPrompt(true);
    }
  }, [extractedData]);

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleTripResponse = async (isTrip) => {
    setTripData(prev => ({ ...prev, isTrip }));
    setShowTripPrompt(false);
    
    if (isTrip) {
      // If it's a trip, suggest dates around the receipt date
      const receiptDate = new Date(formData.date || new Date());
      const startDate = new Date(receiptDate);
      startDate.setDate(startDate.getDate() - 2); // 2 days before
      const endDate = new Date(receiptDate);
      endDate.setDate(endDate.getDate() + 2); // 2 days after
      
      setTripData(prev => ({
        ...prev,
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0]
      }));
      
      // Find other receipts in the date range
      await findReceiptsInDateRange(startDate.toISOString().split('T')[0], endDate.toISOString().split('T')[0]);
    }
  };

  const findReceiptsInDateRange = async (startDate, endDate) => {
    try {
      const functions = getFunctions();
      const findReceiptsFunction = httpsCallable(functions, 'findReceiptsInDateRange');
      
      const response = await findReceiptsFunction({
        startDate,
        endDate
      });
      
      // Filter out the current receipt
      const otherReceipts = response.data.receipts.filter(r => r.id !== receiptId);
      setSuggestedReceipts(otherReceipts);
    } catch (error) {
      console.error('Error finding receipts in date range:', error);
    }
  };

  const handleSave = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Update the receipt document with confirmed data
      const receiptRef = doc(db, 'receipts', receiptId);
      const updateData = {
        ...formData,
        total: parseFloat(formData.total) || 0,
        confirmedAt: new Date().toISOString(),
        status: 'confirmed'
      };
      
      // If this is a trip, handle trip creation and assignment
      if (tripData.isTrip && tripData.tripName) {
        const functions = getFunctions();
        
        // Create trip if it doesn't exist
        const createTripFunction = httpsCallable(functions, 'createTrip');
        const tripResponse = await createTripFunction({
          name: tripData.tripName,
          startDate: tripData.startDate,
          endDate: tripData.endDate,
          location: formData.location
        });
        
        // Assign receipt to trip
        const assignReceiptFunction = httpsCallable(functions, 'assignReceiptToTrip');
        await assignReceiptFunction({
          receiptId,
          tripId: tripResponse.data.tripId,
          tripName: tripData.tripName
        });
        
        updateData.tripId = tripResponse.data.tripId;
        updateData.tripName = tripData.tripName;
        updateData.reason = tripData.tripName;
        updateData.tripAlbum = tripData.tripName;
      }
      
      await updateDoc(receiptRef, updateData);
      
      onComplete({
        ...updateData,
        tripData: tripData.isTrip ? tripData : null,
        suggestedReceipts
      });
      
    } catch (error) {
      console.error('Error saving receipt data:', error);
      setError(error.message || 'Failed to save receipt data');
    } finally {
      setLoading(false);
    }
  };

  if (showTripPrompt) {
    return (
      <div className="receipt-confirmation-form">
        <div className="trip-prompt">
          <div className="prompt-header">
            <h3>✈️ Trip Detected</h3>
            <p>This receipt appears to be from outside your usual location:</p>
            <div className="location-comparison">
              <div className="receipt-location">
                <strong>Receipt Location:</strong> {extractedData?.location?.full}
              </div>
              {extractedData?.userDefaultLocation && (
                <div className="user-location">
                  <strong>Your Default Location:</strong> {extractedData.userDefaultLocation.city}, {extractedData.userDefaultLocation.state}
                </div>
              )}
            </div>
          </div>
          
          <div className="prompt-question">
            <h4>Is this receipt from a trip?</h4>
            <div className="prompt-actions">
              <button 
                onClick={() => handleTripResponse(true)}
                className="btn-yes"
              >
                ✈️ Yes, it's from a trip
              </button>
              <button 
                onClick={() => handleTripResponse(false)}
                className="btn-no"
              >
                🏠 No, it's local
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="receipt-confirmation-form">
      <div className="form-header">
        <h3>📝 Confirm Receipt Details</h3>
        <p>Review and edit the extracted information</p>
      </div>

      <div className="form-content">
        <div className="form-section">
          <h4>📋 Basic Information</h4>
          
          <div className="form-group">
            <label>Date</label>
            <input
              type="date"
              value={formData.date}
              onChange={(e) => handleInputChange('date', e.target.value)}
            />
          </div>
          
          <div className="form-group">
            <label>Total Amount</label>
            <input
              type="number"
              step="0.01"
              value={formData.total}
              onChange={(e) => handleInputChange('total', e.target.value)}
              placeholder="0.00"
            />
          </div>
          
          <div className="form-group">
            <label>Merchant/Location</label>
            <input
              type="text"
              value={formData.merchant}
              onChange={(e) => handleInputChange('merchant', e.target.value)}
              placeholder="Store or restaurant name"
            />
          </div>
          
          <div className="form-group">
            <label>Location</label>
            <input
              type="text"
              value={formData.location}
              onChange={(e) => handleInputChange('location', e.target.value)}
              placeholder="City, State"
            />
          </div>
          
          <div className="form-group">
            <label>Category</label>
            <select
              value={formData.category}
              onChange={(e) => handleInputChange('category', e.target.value)}
            >
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
          
          <div className="form-group">
            <label>Notes (Optional)</label>
            <textarea
              value={formData.notes}
              onChange={(e) => handleInputChange('notes', e.target.value)}
              placeholder="Add any additional notes about this receipt..."
              rows={3}
            />
          </div>
        </div>

        {tripData.isTrip && (
          <div className="form-section trip-section">
            <h4>✈️ Trip Information</h4>
            
            <div className="form-group">
              <label>Trip Name</label>
              <input
                type="text"
                value={tripData.tripName}
                onChange={(e) => setTripData(prev => ({ ...prev, tripName: e.target.value }))}
                placeholder="e.g., Business Trip to NYC, Vacation in Paris"
              />
            </div>
            
            <div className="form-row">
              <div className="form-group">
                <label>Start Date</label>
                <input
                  type="date"
                  value={tripData.startDate}
                  onChange={(e) => setTripData(prev => ({ ...prev, startDate: e.target.value }))}
                />
              </div>
              
              <div className="form-group">
                <label>End Date</label>
                <input
                  type="date"
                  value={tripData.endDate}
                  onChange={(e) => setTripData(prev => ({ ...prev, endDate: e.target.value }))}
                />
              </div>
            </div>
            
            {suggestedReceipts.length > 0 && (
              <div className="suggested-receipts">
                <h5>📋 Other receipts in this date range:</h5>
                <p>Would you like to assign these to the same trip?</p>
                <div className="receipt-suggestions">
                  {suggestedReceipts.map(receipt => (
                    <div key={receipt.id} className="suggested-receipt">
                      <span className="receipt-info">
                        {receipt.date} - ${receipt.total?.toFixed(2) || '0.00'} - {receipt.location?.full || 'Unknown location'}
                      </span>
                      <input type="checkbox" defaultChecked />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {error && (
        <div className="error-message">
          <span className="error-icon">⚠️</span>
          {error}
        </div>
      )}

      <div className="form-actions">
        <button 
          onClick={onCancel}
          className="btn-cancel"
          disabled={loading}
        >
          Cancel
        </button>
        <button 
          onClick={handleSave}
          className="btn-save"
          disabled={loading}
        >
          {loading ? (
            <>
              <div className="spinner"></div>
              Saving...
            </>
          ) : (
            <>
              💾 Save Receipt
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default ReceiptConfirmationForm;
