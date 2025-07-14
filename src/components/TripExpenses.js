import React, { useState, useEffect } from 'react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth, db } from '../firebase';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';
import './TripExpenses.css';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

export default function TripExpenses() {
  const [user] = useAuthState(auth);
  const [receipts, setReceipts] = useState([]);
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTrip, setSelectedTrip] = useState('all');
  const [viewMode, setViewMode] = useState('overview'); // 'overview' or 'detailed'

  // Fetch receipts and trips from Firestore
  useEffect(() => {
    if (!user) return;

    // Fetch receipts
    const receiptsRef = collection(db, 'receipts');
    const receiptsQuery = query(
      receiptsRef,
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

    // Fetch trips
    const tripsRef = collection(db, 'trips');
    const tripsQuery = query(
      tripsRef,
      where('userId', '==', user.uid),
      orderBy('startDate', 'desc')
    );

    const unsubscribeTrips = onSnapshot(tripsQuery, (snapshot) => {
      const tripsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setTrips(tripsData);
      setLoading(false);
    });

    return () => {
      unsubscribeReceipts();
      unsubscribeTrips();
    };
  }, [user]);

  // Get trip expenses data
  const getTripExpensesData = () => {
    if (selectedTrip === 'all') {
      // Show overview of all trips
      return trips.map(trip => {
        const tripReceipts = receipts.filter(receipt => receipt.tripId === trip.id);
        const totalExpenses = tripReceipts.reduce((sum, receipt) => {
          return sum + (parseFloat(receipt.total) || 0);
        }, 0);
        
        return {
          tripName: trip.name,
          tripId: trip.id,
          totalExpenses,
          receiptCount: tripReceipts.length,
          startDate: trip.startDate,
          endDate: trip.endDate,
          receipts: tripReceipts
        };
      }).sort((a, b) => b.totalExpenses - a.totalExpenses);
    } else {
      // Show detailed view for selected trip
      const trip = trips.find(t => t.id === selectedTrip);
      if (!trip) return [];

      const tripReceipts = receipts.filter(receipt => receipt.tripId === selectedTrip);
      
      // Group by category
      const categoryTotals = {};
      tripReceipts.forEach(receipt => {
        const category = receipt.category || 'Uncategorized';
        const amount = parseFloat(receipt.total) || 0;
        categoryTotals[category] = (categoryTotals[category] || 0) + amount;
      });

      return Object.entries(categoryTotals)
        .map(([category, amount]) => ({
          category,
          amount,
          receipts: tripReceipts.filter(r => (r.category || 'Uncategorized') === category)
        }))
        .sort((a, b) => b.amount - a.amount);
    }
  };

  // Prepare chart data
  const getChartData = () => {
    const data = getTripExpensesData();
    
    if (!data.length) {
      return {
        labels: ['No Data'],
        datasets: [{
          label: 'Expenses',
          data: [0],
          backgroundColor: ['rgba(156, 163, 175, 0.5)'],
          borderColor: ['rgba(156, 163, 175, 1)'],
          borderWidth: 2,
        }]
      };
    }

    if (selectedTrip === 'all') {
      // Overview chart - trips vs expenses
      const labels = data.map(trip => trip.tripName);
      const amounts = data.map(trip => trip.totalExpenses);
      
      return {
        labels,
        datasets: [{
          label: 'Total Expenses',
          data: amounts,
          backgroundColor: [
            'rgba(59, 130, 246, 0.8)',
            'rgba(16, 185, 129, 0.8)',
            'rgba(245, 158, 11, 0.8)',
            'rgba(239, 68, 68, 0.8)',
            'rgba(139, 92, 246, 0.8)',
            'rgba(249, 115, 22, 0.8)',
            'rgba(6, 182, 212, 0.8)',
            'rgba(132, 204, 22, 0.8)',
          ],
          borderColor: [
            'rgba(59, 130, 246, 1)',
            'rgba(16, 185, 129, 1)',
            'rgba(245, 158, 11, 1)',
            'rgba(239, 68, 68, 1)',
            'rgba(139, 92, 246, 1)',
            'rgba(249, 115, 22, 1)',
            'rgba(6, 182, 212, 1)',
            'rgba(132, 204, 22, 1)',
          ],
          borderWidth: 2,
        }]
      };
    } else {
      // Detailed chart - categories for selected trip
      const labels = data.map(item => item.category);
      const amounts = data.map(item => item.amount);
      
      return {
        labels,
        datasets: [{
          label: 'Category Expenses',
          data: amounts,
          backgroundColor: [
            'rgba(59, 130, 246, 0.8)',
            'rgba(16, 185, 129, 0.8)',
            'rgba(245, 158, 11, 0.8)',
            'rgba(239, 68, 68, 0.8)',
            'rgba(139, 92, 246, 0.8)',
            'rgba(249, 115, 22, 0.8)',
            'rgba(6, 182, 212, 0.8)',
            'rgba(132, 204, 22, 0.8)',
          ],
          borderColor: [
            'rgba(59, 130, 246, 1)',
            'rgba(16, 185, 129, 1)',
            'rgba(245, 158, 11, 1)',
            'rgba(239, 68, 68, 1)',
            'rgba(139, 92, 246, 1)',
            'rgba(249, 115, 22, 1)',
            'rgba(6, 182, 212, 1)',
            'rgba(132, 204, 22, 1)',
          ],
          borderWidth: 2,
        }]
      };
    }
  };

  // Chart options
  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        callbacks: {
          label: function(context) {
            return `$${context.parsed.y.toFixed(2)}`;
          }
        }
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          callback: function(value) {
            return '$' + value.toFixed(0);
          }
        }
      },
      x: {
        ticks: {
          maxRotation: 45,
          minRotation: 0
        }
      }
    }
  };

  // Get summary statistics
  const getSummaryStats = () => {
    if (selectedTrip === 'all') {
      const totalTrips = trips.length;
      const totalExpenses = trips.reduce((sum, trip) => {
        const tripReceipts = receipts.filter(receipt => receipt.tripId === trip.id);
        return sum + tripReceipts.reduce((tripSum, receipt) => {
          return tripSum + (parseFloat(receipt.total) || 0);
        }, 0);
      }, 0);
      const totalReceipts = receipts.filter(receipt => receipt.tripId).length;
      
      return {
        totalTrips,
        totalExpenses,
        totalReceipts,
        averagePerTrip: totalTrips > 0 ? totalExpenses / totalTrips : 0
      };
    } else {
      const trip = trips.find(t => t.id === selectedTrip);
      const tripReceipts = receipts.filter(receipt => receipt.tripId === selectedTrip);
      const totalExpenses = tripReceipts.reduce((sum, receipt) => {
        return sum + (parseFloat(receipt.total) || 0);
      }, 0);
      const categories = [...new Set(tripReceipts.map(r => r.category || 'Uncategorized'))].length;
      
      return {
        tripName: trip?.name || 'Unknown Trip',
        totalExpenses,
        totalReceipts: tripReceipts.length,
        categories,
        startDate: trip?.startDate,
        endDate: trip?.endDate
      };
    }
  };

  const stats = getSummaryStats();

  if (loading) {
    return (
      <div className="trip-expenses">
        <div className="trip-expenses-header">
          <h3>✈️ Trip Expenses</h3>
        </div>
        <div className="loading-spinner">Loading...</div>
      </div>
    );
  }

  return (
    <div className="trip-expenses">
      <div className="trip-expenses-header">
        <h3>✈️ Trip Expenses</h3>
        <div className="trip-controls">
          <select 
            value={selectedTrip} 
            onChange={(e) => setSelectedTrip(e.target.value)}
            className="trip-select"
          >
            <option value="all">All Trips Overview</option>
            {trips.map(trip => (
              <option key={trip.id} value={trip.id}>
                {trip.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="trip-summary">
        {selectedTrip === 'all' ? (
          <>
            <div className="summary-item">
              <span className="summary-label">Total Trips:</span>
              <span className="summary-value">{stats.totalTrips}</span>
            </div>
            <div className="summary-item">
              <span className="summary-label">Total Expenses:</span>
              <span className="summary-value total-amount">${stats.totalExpenses.toFixed(2)}</span>
            </div>
            <div className="summary-item">
              <span className="summary-label">Total Receipts:</span>
              <span className="summary-value">{stats.totalReceipts}</span>
            </div>
            <div className="summary-item">
              <span className="summary-label">Avg per Trip:</span>
              <span className="summary-value">${stats.averagePerTrip.toFixed(2)}</span>
            </div>
          </>
        ) : (
          <>
            <div className="summary-item">
              <span className="summary-label">Trip:</span>
              <span className="summary-value">{stats.tripName}</span>
            </div>
            <div className="summary-item">
              <span className="summary-label">Total Expenses:</span>
              <span className="summary-value total-amount">${stats.totalExpenses.toFixed(2)}</span>
            </div>
            <div className="summary-item">
              <span className="summary-label">Receipts:</span>
              <span className="summary-value">{stats.totalReceipts}</span>
            </div>
            <div className="summary-item">
              <span className="summary-label">Categories:</span>
              <span className="summary-value">{stats.categories}</span>
            </div>
          </>
        )}
      </div>

      <div className="chart-container">
        <Bar data={getChartData()} options={chartOptions} />
      </div>

      {getTripExpensesData().length > 0 && (
        <div className="expenses-details">
          <h4>
            {selectedTrip === 'all' ? 'Trip Details' : 'Category Breakdown'}
          </h4>
          <div className="details-list">
            {getTripExpensesData().map((item, index) => (
              <div key={selectedTrip === 'all' ? item.tripId : item.category} className="detail-item">
                <div className="detail-info">
                  <span className="detail-name">
                    {selectedTrip === 'all' ? item.tripName : item.category}
                  </span>
                  {selectedTrip === 'all' && (
                    <span className="detail-meta">
                      {item.receiptCount} receipts
                    </span>
                  )}
                </div>
                <div className="detail-amount">
                  ${selectedTrip === 'all' ? item.totalExpenses.toFixed(2) : item.amount.toFixed(2)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {getTripExpensesData().length === 0 && (
        <div className="no-data-message">
          <p>No trip expense data available.</p>
          <p>Create some trips and add receipts to see your travel expenses!</p>
        </div>
      )}
    </div>
  );
}
