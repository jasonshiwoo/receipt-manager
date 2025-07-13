import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import './AccountMenu.css';

export default function AccountMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const [showAccountDetails, setShowAccountDetails] = useState(false);
  const { logout } = useAuth();

  async function handleLogout() {
    try {
      await logout();
    } catch (error) {
      console.error('Failed to log out', error);
    }
  }

  function toggleMenu() {
    setIsOpen(!isOpen);
  }

  function openAccountDetails() {
    setShowAccountDetails(true);
    setIsOpen(false);
  }

  function closeAccountDetails() {
    setShowAccountDetails(false);
  }

  return (
    <>
      <div className="account-menu">
        <button className="account-icon" onClick={toggleMenu}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 12C14.7614 12 17 9.76142 17 7C17 4.23858 14.7614 2 12 2C9.23858 2 7 4.23858 7 7C7 9.76142 9.23858 12 12 12Z" fill="currentColor"/>
            <path d="M12 14C7.58172 14 4 17.5817 4 22H20C20 17.5817 16.4183 14 12 14Z" fill="currentColor"/>
          </svg>
        </button>
        
        {isOpen && (
          <div className="dropdown-menu">
            <button className="dropdown-item" onClick={openAccountDetails}>
              <span>Account Details</span>
            </button>
            <button className="dropdown-item logout" onClick={handleLogout}>
              <span>Logout</span>
            </button>
          </div>
        )}
      </div>

      {/* Account Details Modal */}
      {showAccountDetails && (
        <AccountDetailsModal onClose={closeAccountDetails} />
      )}
    </>
  );
}

function AccountDetailsModal({ onClose }) {
  const { currentUser } = useAuth();
  const [fullName, setFullName] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [email, setEmail] = useState(currentUser?.email || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  async function handleSave() {
    setLoading(true);
    setMessage('');
    
    try {
      // Here you would implement the actual save functionality
      // For now, we'll just show a success message
      setMessage('Account details saved successfully!');
      
      // In a real implementation, you would:
      // 1. Update user profile in Firestore
      // 2. Update email if changed (requires re-authentication)
      // 3. Update password if provided (requires current password)
      
    } catch (error) {
      setMessage('Failed to save account details');
      console.error(error);
    }
    
    setLoading(false);
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Account Details</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        
        <div className="modal-body">
          {message && (
            <div className={`message ${message.includes('success') ? 'success' : 'error'}`}>
              {message}
            </div>
          )}
          
          <div className="form-group">
            <label htmlFor="fullName">Full Name</label>
            <input
              type="text"
              id="fullName"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Enter your full name"
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="businessName">Business Name</label>
            <input
              type="text"
              id="businessName"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              placeholder="Enter your business name"
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="currentPassword">Current Password</label>
            <input
              type="password"
              id="currentPassword"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Enter current password to make changes"
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="newPassword">New Password (optional)</label>
            <input
              type="password"
              id="newPassword"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Enter new password (leave blank to keep current)"
            />
          </div>
        </div>
        
        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button 
            className="btn-primary" 
            onClick={handleSave}
            disabled={loading}
          >
            {loading ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
