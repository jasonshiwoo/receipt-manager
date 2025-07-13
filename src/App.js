import React from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import ErrorBoundary from './components/ErrorBoundary';
import './App.css';

function AppContent() {
  const { currentUser } = useAuth();
  
  console.log('AppContent rendering, currentUser exists:', !!currentUser);
  
  return (
    <div className="App">
      {currentUser ? <Dashboard /> : <Login />}
    </div>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;
