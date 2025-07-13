#!/bin/bash

# Deploy script for Receipt Manager
# This ensures the correct Firebase environment variables are used during build

echo "🔥 Building Receipt Manager with Firebase config..."

REACT_APP_FIREBASE_API_KEY="AIzaSyDdvix82B-0me0U9cphldwiD4ZMOd0Sfu0" \
REACT_APP_FIREBASE_AUTH_DOMAIN="receipt-manager-2c61b.firebaseapp.com" \
REACT_APP_FIREBASE_PROJECT_ID="receipt-manager-2c61b" \
REACT_APP_FIREBASE_STORAGE_BUCKET="receipt-manager-2c61b.firebasestorage.app" \
REACT_APP_FIREBASE_MESSAGING_SENDER_ID="1082387604545" \
REACT_APP_FIREBASE_APP_ID="1:1082387604545:web:06d1a663f62ca4a48592c0" \
npm run build

if [ $? -eq 0 ]; then
    echo "✅ Build successful! Deploying to Firebase..."
    firebase deploy --only hosting
    
    if [ $? -eq 0 ]; then
        echo "🚀 Deployment complete!"
        echo "🌐 Live at: https://receipt-manager-2c61b.web.app"
    else
        echo "❌ Deployment failed!"
        exit 1
    fi
else
    echo "❌ Build failed!"
    exit 1
fi
