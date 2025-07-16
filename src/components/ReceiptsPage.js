import React, { useState, useEffect } from 'react';
import { collection, query, where, orderBy, onSnapshot, doc, updateDoc, writeBatch, getDocs } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { useAuth } from '../contexts/AuthContext';
import { db, functions } from '../firebase';
import ReceiptConfirmation from './ReceiptConfirmation';
import './ReceiptsPage.css';

export default function ReceiptsPage({ onBack }) {
  const { currentUser } = useAuth();
  const [receipts, setReceipts] = useState([]);
  const [filteredReceipts, setFilteredReceipts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [deletingIds, setDeletingIds] = useState(new Set());
  const [editingReceipt, setEditingReceipt] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [categories, setCategories] = useState([]);
  const [showNewCategoryInput, setShowNewCategoryInput] = useState(false);
  const [newCategoryValue, setNewCategoryValue] = useState('');
  const [showCategoryManager, setShowCategoryManager] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [editCategoryValue, setEditCategoryValue] = useState('');
  const [updatingCategories, setUpdatingCategories] = useState(false);
  const [confirmationReceipt, setConfirmationReceipt] = useState(null);

  // Filter states
  const [dateFilter, setDateFilter] = useState('all'); // 'all', 'month', '3months', 'year', 'custom'
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  // Reusable function to sort receipts by receipt date (most recent first)
  const sortReceiptsByDate = (receipts) => {
    return receipts.sort((a, b) => {
      // Parse receipt dates (format: YYYY-MM-DD or MM/DD/YYYY)
      const parseReceiptDate = (dateStr) => {
        if (!dateStr) return new Date(0); // Default to epoch if no date
        
        // Try parsing different date formats
        let parsedDate;
        if (dateStr.includes('/')) {
          // Handle MM/DD/YYYY format
          parsedDate = new Date(dateStr);
        } else if (dateStr.includes('-')) {
          // Handle YYYY-MM-DD format
          parsedDate = new Date(dateStr);
        } else {
          // Try direct parsing
          parsedDate = new Date(dateStr);
        }
        
        // If parsing failed, fallback to upload date
        return isNaN(parsedDate.getTime()) ? (a.createdAt?.toDate?.() || new Date(0)) : parsedDate;
      };

      const aDate = parseReceiptDate(a.date);
      const bDate = parseReceiptDate(b.date);
      
      // If receipt dates are the same or both invalid, sort by upload date
      if (aDate.getTime() === bDate.getTime()) {
        const aUpload = a.createdAt?.toDate?.() || new Date(0);
        const bUpload = b.createdAt?.toDate?.() || new Date(0);
        return bUpload - aUpload; // Most recent upload first
      }
      
      return bDate - aDate; // Most recent receipt date first
    });
  };

  // Filter receipts based on date range and search term
  const filterReceipts = (receipts, filter, startDate, endDate, search) => {
    let filtered = [...receipts];

    // Apply date filter
    if (filter !== 'all') {
      const now = new Date();
      let filterStartDate;

      switch (filter) {
        case 'month':
          filterStartDate = new Date(now.getFullYear(), now.getMonth(), 1);
          break;
        case '3months':
          filterStartDate = new Date(now.getFullYear(), now.getMonth() - 2, 1);
          break;
        case 'year':
          filterStartDate = new Date(now.getFullYear(), 0, 1);
          break;
        case 'custom':
          if (startDate && endDate) {
            filterStartDate = new Date(startDate);
            const filterEndDate = new Date(endDate);
            filterEndDate.setHours(23, 59, 59, 999); // End of day
            
            filtered = filtered.filter(receipt => {
              const receiptDate = receipt.date ? new Date(receipt.date) : (receipt.createdAt?.toDate?.() || new Date(0));
              return receiptDate >= filterStartDate && receiptDate <= filterEndDate;
            });
          }
          break;
        default:
          break;
      }

      if (filter !== 'custom' && filterStartDate) {
        filtered = filtered.filter(receipt => {
          const receiptDate = receipt.date ? new Date(receipt.date) : (receipt.createdAt?.toDate?.() || new Date(0));
          return receiptDate >= filterStartDate;
        });
      }
    }

    // Apply search filter
    if (search.trim()) {
      const searchLower = search.toLowerCase();
      filtered = filtered.filter(receipt => 
        receipt.originalName?.toLowerCase().includes(searchLower) ||
        receipt.description?.toLowerCase().includes(searchLower) ||
        receipt.category?.toLowerCase().includes(searchLower) ||
        receipt.total?.toString().includes(searchLower)
      );
    }

    return sortReceiptsByDate(filtered);
  };

  // Load receipts from Firestore
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

  // Apply filters whenever receipts or filter settings change
  useEffect(() => {
    const filtered = filterReceipts(receipts, dateFilter, customStartDate, customEndDate, searchTerm);
    setFilteredReceipts(filtered);
  }, [receipts, dateFilter, customStartDate, customEndDate, searchTerm]);

  // Load categories
  useEffect(() => {
    async function getUniqueCategories() {
      if (!currentUser) return;
      
      try {
        const receiptsRef = collection(db, 'receipts');
        const q = query(receiptsRef, where('userId', '==', currentUser.uid));
        const snapshot = await getDocs(q);
        
        const categorySet = new Set();
        snapshot.docs.forEach(doc => {
          const data = doc.data();
          if (data.category && data.category.trim()) {
            categorySet.add(data.category.trim());
          }
        });
        
        const sortedCategories = Array.from(categorySet).sort();
        setCategories(sortedCategories);
      } catch (error) {
        console.error('Error fetching categories:', error);
      }
    }
    
    getUniqueCategories();
  }, [currentUser, receipts]);

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return 'Unknown date';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString();
  };

  const handleEditReceipt = (receipt) => {
    setEditingReceipt(receipt);
    setEditForm({
      total: receipt.total || '',
      date: receipt.date || '',
      category: receipt.category || '',
      description: receipt.description || ''
    });
  };

  const handleSaveEdit = async () => {
    if (!editingReceipt) return;
    
    setSaving(true);
    try {
      const receiptRef = doc(db, `users/${currentUser.uid}/receipts`, editingReceipt.id);
      await updateDoc(receiptRef, {
        total: editForm.total,
        date: editForm.date,
        category: editForm.category,
        description: editForm.description,
        updatedAt: new Date()
      });
      
      setEditingReceipt(null);
      setEditForm({});
    } catch (error) {
      console.error('Error updating receipt:', error);
      setError('Failed to update receipt');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteReceipt = async (receiptId) => {
    if (!window.confirm('Are you sure you want to delete this receipt?')) return;
    
    setDeletingIds(prev => new Set([...prev, receiptId]));
    
    try {
      const deleteReceipt = httpsCallable(functions, 'deleteReceipt');
      await deleteReceipt({ receiptId });
    } catch (error) {
      console.error('Error deleting receipt:', error);
      setError('Failed to delete receipt');
    } finally {
      setDeletingIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(receiptId);
        return newSet;
      });
    }
  };

  const handleAddCategory = async () => {
    if (!newCategoryValue.trim()) return;
    
    const newCategory = newCategoryValue.trim();
    if (categories.includes(newCategory)) {
      setNewCategoryValue('');
      setShowNewCategoryInput(false);
      return;
    }
    
    setCategories(prev => [...prev, newCategory].sort());
    setNewCategoryValue('');
    setShowNewCategoryInput(false);
  };

  const handleEditCategory = (category) => {
    setEditingCategory(category);
    setEditCategoryValue(category);
  };

  const handleSaveCategory = async () => {
    if (!editCategoryValue.trim() || !editingCategory) return;
    
    const newCategoryName = editCategoryValue.trim();
    if (newCategoryName === editingCategory) {
      setEditingCategory(null);
      setEditCategoryValue('');
      return;
    }
    
    setUpdatingCategories(true);
    
    try {
      const receiptsRef = collection(db, `users/${currentUser.uid}/receipts`);
      const q = query(receiptsRef, where('category', '==', editingCategory));
      const snapshot = await getDocs(q);
      
      if (!snapshot.empty) {
        const batch = writeBatch(db);
        snapshot.docs.forEach(doc => {
          batch.update(doc.ref, { category: newCategoryName });
        });
        await batch.commit();
      }
      
      setCategories(prev => 
        prev.map(cat => cat === editingCategory ? newCategoryName : cat).sort()
      );
      
      setEditingCategory(null);
      setEditCategoryValue('');
    } catch (error) {
      console.error('Error updating category:', error);
      setError('Failed to update category');
    } finally {
      setUpdatingCategories(false);
    }
  };

  const handleDeleteCategory = async (categoryToDelete) => {
    if (!window.confirm(`Delete category "${categoryToDelete}"? This will remove the category from all receipts.`)) return;
    
    setUpdatingCategories(true);
    
    try {
      const receiptsRef = collection(db, `users/${currentUser.uid}/receipts`);
      const q = query(receiptsRef, where('category', '==', categoryToDelete));
      const snapshot = await getDocs(q);
      
      if (!snapshot.empty) {
        const batch = writeBatch(db);
        snapshot.docs.forEach(doc => {
          batch.update(doc.ref, { category: '' });
        });
        await batch.commit();
      }
      
      setCategories(prev => prev.filter(cat => cat !== categoryToDelete));
    } catch (error) {
      console.error('Error deleting category:', error);
      setError('Failed to delete category');
    } finally {
      setUpdatingCategories(false);
    }
  };

  if (loading) {
    return (
      <div className="receipts-page">
        <div className="receipts-header">
          <button className="back-button" onClick={onBack}>
            ← Back to Dashboard
          </button>
          <h1>📄 All Receipts</h1>
        </div>
        <div className="loading">Loading receipts...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="receipts-page">
        <div className="receipts-header">
          <button className="back-button" onClick={onBack}>
            ← Back to Dashboard
          </button>
          <h1>📄 All Receipts</h1>
        </div>
        <div className="error">Error: {error}</div>
      </div>
    );
  }

  return (
    <div className="receipts-page">
      <div className="receipts-header">
        <button className="back-button" onClick={onBack}>
          ← Back to Dashboard
        </button>
        <h1>📄 All Receipts ({filteredReceipts.length})</h1>
      </div>

      {/* Filters Section */}
      <div className="filters-section">
        <div className="filter-row">
          {/* Date Filter */}
          <div className="filter-group">
            <label>Time Period:</label>
            <select 
              value={dateFilter} 
              onChange={(e) => setDateFilter(e.target.value)}
              className="filter-select"
            >
              <option value="all">All Time</option>
              <option value="month">This Month</option>
              <option value="3months">Last 3 Months</option>
              <option value="year">This Year</option>
              <option value="custom">Custom Range</option>
            </select>
          </div>

          {/* Custom Date Range */}
          {dateFilter === 'custom' && (
            <div className="filter-group custom-date-range">
              <label>From:</label>
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="date-input"
              />
              <label>To:</label>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="date-input"
              />
            </div>
          )}

          {/* Search */}
          <div className="filter-group">
            <label>Search:</label>
            <input
              type="text"
              placeholder="Search receipts..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input"
            />
          </div>
        </div>
      </div>

      {/* Receipts Grid */}
      {filteredReceipts.length === 0 ? (
        <div className="no-receipts">
          {receipts.length === 0 
            ? 'No receipts uploaded yet. Go back to upload your first receipt!'
            : 'No receipts match your current filters.'
          }
        </div>
      ) : (
        <div className="receipt-grid">
          {filteredReceipts.map((receipt) => (
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
                
                {/* Display OCR data if available */}
                {(receipt.total || receipt.date || receipt.category || receipt.description) && (
                  <div className="receipt-ocr-data">
                    <div className="ocr-header">
                      <span className="ocr-badge">✅ Processed</span>
                    </div>
                    <div className="ocr-details">
                      {receipt.total && <div><strong>Total:</strong> ${receipt.total}</div>}
                      {receipt.date && <div><strong>Date:</strong> {receipt.date}</div>}
                      {receipt.category && <div><strong>Category:</strong> {receipt.category}</div>}
                      {receipt.description && <div><strong>Description:</strong> {receipt.description}</div>}
                    </div>
                  </div>
                )}
                
                <div className="receipt-actions">
                  <button 
                    className="edit-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleEditReceipt(receipt);
                    }}
                  >
                    Edit
                  </button>
                  <button 
                    className="delete-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteReceipt(receipt.id);
                    }}
                    disabled={deletingIds.has(receipt.id)}
                  >
                    {deletingIds.has(receipt.id) ? 'Deleting...' : 'Delete'}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Edit Receipt Modal */}
      {editingReceipt && (
        <div className="modal-overlay" onClick={() => setEditingReceipt(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Edit Receipt</h2>
              <button className="close-btn" onClick={() => setEditingReceipt(null)}>×</button>
            </div>
            
            <div className="modal-body">
              <div className="receipt-preview">
                <img src={editingReceipt.storageUrl} alt={editingReceipt.originalName} />
              </div>
              
              <div className="edit-form">
                <div className="form-group">
                  <label htmlFor="total">Total Amount ($)</label>
                  <input
                    type="number"
                    id="total"
                    step="0.01"
                    value={editForm.total}
                    onChange={(e) => setEditForm({...editForm, total: e.target.value})}
                    placeholder="0.00"
                  />
                </div>
                
                <div className="form-group">
                  <label htmlFor="date">Receipt Date</label>
                  <input
                    type="date"
                    id="date"
                    value={editForm.date}
                    onChange={(e) => setEditForm({...editForm, date: e.target.value})}
                  />
                </div>
                
                <div className="form-group">
                  <label htmlFor="category">Category</label>
                  <div className="category-input-container">
                    <select
                      id="category"
                      value={editForm.category}
                      onChange={(e) => setEditForm({...editForm, category: e.target.value})}
                    >
                      <option value="">Select a category</option>
                      {categories.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                    <button 
                      type="button" 
                      className="manage-categories-btn"
                      onClick={() => setShowCategoryManager(!showCategoryManager)}
                    >
                      Manage
                    </button>
                  </div>
                  
                  {showCategoryManager && (
                    <div className="category-manager">
                      <div className="category-list">
                        {categories.map(category => (
                          <div key={category} className="category-item">
                            {editingCategory === category ? (
                              <div className="category-edit">
                                <input
                                  type="text"
                                  value={editCategoryValue}
                                  onChange={(e) => setEditCategoryValue(e.target.value)}
                                  onKeyPress={(e) => e.key === 'Enter' && handleSaveCategory()}
                                />
                                <button onClick={handleSaveCategory} disabled={updatingCategories}>Save</button>
                                <button onClick={() => setEditingCategory(null)}>Cancel</button>
                              </div>
                            ) : (
                              <div className="category-display">
                                <span>{category}</span>
                                <div className="category-actions">
                                  <button onClick={() => handleEditCategory(category)}>Edit</button>
                                  <button onClick={() => handleDeleteCategory(category)} disabled={updatingCategories}>Delete</button>
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                      
                      {showNewCategoryInput ? (
                        <div className="new-category-input">
                          <input
                            type="text"
                            value={newCategoryValue}
                            onChange={(e) => setNewCategoryValue(e.target.value)}
                            placeholder="New category name"
                            onKeyPress={(e) => e.key === 'Enter' && handleAddCategory()}
                          />
                          <button onClick={handleAddCategory}>Add</button>
                          <button onClick={() => setShowNewCategoryInput(false)}>Cancel</button>
                        </div>
                      ) : (
                        <button 
                          className="add-category-btn"
                          onClick={() => setShowNewCategoryInput(true)}
                        >
                          + Add New Category
                        </button>
                      )}
                    </div>
                  )}
                </div>
                
                <div className="form-group">
                  <label htmlFor="description">Description</label>
                  <textarea
                    id="description"
                    value={editForm.description}
                    onChange={(e) => setEditForm({...editForm, description: e.target.value})}
                    placeholder="Receipt description or notes"
                    rows="3"
                  />
                </div>
              </div>
            </div>
            
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setEditingReceipt(null)}>Cancel</button>
              <button 
                className="btn-primary" 
                onClick={handleSaveEdit}
                disabled={saving}
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Receipt Confirmation Modal */}
      {confirmationReceipt && (
        <ReceiptConfirmation
          receipt={confirmationReceipt}
          onClose={() => setConfirmationReceipt(null)}
        />
      )}
    </div>
  );
}
