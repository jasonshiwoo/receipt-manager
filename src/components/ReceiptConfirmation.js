import React, { useState, useEffect } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import './ReceiptConfirmation.css';

export default function ReceiptConfirmation({ receipt, onClose, onSave }) {
  const [formData, setFormData] = useState({
    merchant: '',
    date: '',
    total: '',
    location: '',
    category: '',
    description: ''
  });
  const [isLoading, setIsLoading] = useState(false);
  const [showRawText, setShowRawText] = useState(false);

  useEffect(() => {
    if (receipt) {
      setFormData({
        merchant: receipt.merchant || receipt.extractedData?.merchant || '',
        date: receipt.date || '',
        total: receipt.total || '',
        location: receipt.location?.full || receipt.location || '',
        category: receipt.suggestedCategory || receipt.category || 'Other',
        description: receipt.description || ''
      });
    }
  }, [receipt]);

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSave = async () => {
    setIsLoading(true);
    try {
      const updateData = {
        merchant: formData.merchant,
        date: formData.date,
        total: parseFloat(formData.total) || 0,
        location: formData.location,
        category: formData.category,
        description: formData.description,
        userConfirmed: true,
        confirmedAt: new Date().toISOString()
      };

      await updateDoc(doc(db, 'receipts', receipt.id), updateData);
      
      if (onSave) {
        onSave({ ...receipt, ...updateData });
      }
      
      onClose();
    } catch (error) {
      console.error('Error saving receipt:', error);
      alert('Failed to save receipt. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const categories = [
    'Food & Drink',
    'Transportation',
    'Accommodation',
    'Shopping',
    'Entertainment',
    'Business',
    'Healthcare',
    'Utilities',
    'Other'
  ];

  if (!receipt) return null;

  return (
    <div className="receipt-confirmation-overlay">
      <div className="receipt-confirmation-modal">
        <div className="confirmation-header">
          <h2>📋 Confirm Receipt Details</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <div className="confirmation-content">
          {/* OCR Extraction Results */}
          <div className="extraction-summary">
            <h3>🔍 OCR Extraction Results</h3>
            <div className="extraction-stats">
              <span>✅ Date: {receipt.extractedData?.date ? 'Found' : 'Not found'}</span>
              <span>✅ Amount: {receipt.extractedData?.total ? 'Found' : 'Not found'}</span>
              <span>✅ Merchant: {receipt.extractedData?.merchant ? 'Found' : 'Not found'}</span>
              <span>✅ Location: {receipt.extractedData?.location ? 'Found' : 'Not found'}</span>
            </div>
            
            <button 
              className="toggle-raw-text"
              onClick={() => setShowRawText(!showRawText)}
            >
              {showRawText ? '🔼 Hide' : '🔽 Show'} Raw OCR Text
            </button>
            
            {showRawText && (
              <div className="raw-text-display">
                <pre>{receipt.extractedText || 'No raw text available'}</pre>
              </div>
            )}
          </div>

          {/* Editable Form */}
          <div className="confirmation-form">
            <div className="form-row">
              <div className="form-group">
                <label>🏪 Merchant Name</label>
                <input
                  type="text"
                  value={formData.merchant}
                  onChange={(e) => handleInputChange('merchant', e.target.value)}
                  placeholder="Enter merchant name"
                />
              </div>
              
              <div className="form-group">
                <label>📅 Date</label>
                <input
                  type="date"
                  value={formData.date}
                  onChange={(e) => handleInputChange('date', e.target.value)}
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>💰 Total Amount</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.total}
                  onChange={(e) => handleInputChange('total', e.target.value)}
                  placeholder="0.00"
                />
              </div>
              
              <div className="form-group">
                <label>🏷️ Category</label>
                <select
                  value={formData.category}
                  onChange={(e) => handleInputChange('category', e.target.value)}
                >
                  {categories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-group">
              <label>📍 Location</label>
              <input
                type="text"
                value={formData.location}
                onChange={(e) => handleInputChange('location', e.target.value)}
                placeholder="City, State or full address"
              />
            </div>

            <div className="form-group">
              <label>📝 Description (Optional)</label>
              <textarea
                value={formData.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                placeholder="Add any additional notes..."
                rows="3"
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="confirmation-actions">
            <button 
              className="cancel-btn" 
              onClick={onClose}
              disabled={isLoading}
            >
              Cancel
            </button>
            <button 
              className="save-btn" 
              onClick={handleSave}
              disabled={isLoading}
            >
              {isLoading ? '💾 Saving...' : '✅ Save Receipt'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
