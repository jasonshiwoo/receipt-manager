#!/bin/bash

echo "🚀 Pushing Receipt Manager to GitHub..."

# Add all files to git
echo "📁 Adding files to git..."
git add .

# Commit with a descriptive message
echo "💾 Committing changes..."
git commit -m "Complete Receipt Manager app with OCR, trip management, and edit functionality

Features:
- React app with Firebase integration
- Receipt upload and OCR processing with Google Cloud Vision
- Trip management and automatic trip detection
- Receipt editing functionality with modal interface
- User authentication and data isolation
- Responsive design for mobile and desktop
- Error handling and loading states

Technical stack:
- React with hooks
- Firebase (Auth, Firestore, Storage, Functions, Hosting)
- Google Cloud Vision API for OCR
- Modern CSS with animations and responsive design"

# Check if remote origin exists
if git remote get-url origin > /dev/null 2>&1; then
    echo "📡 Remote origin found, pushing to GitHub..."
    git push origin main
else
    echo "❌ No remote origin found!"
    echo ""
    echo "To push to GitHub, you need to:"
    echo "1. Create a new repository on GitHub"
    echo "2. Add the remote origin:"
    echo "   git remote add origin https://github.com/YOUR_USERNAME/receipt-manager.git"
    echo "3. Push to GitHub:"
    echo "   git push -u origin main"
    echo ""
    echo "Or run this script again after setting up the remote."
fi

echo "✅ Done!"
