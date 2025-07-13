#!/bin/bash

# Google Cloud Vision Setup Script for Receipt Manager
# This script helps set up Google Cloud Vision API securely

echo "🔧 Receipt Manager - Google Cloud Vision Setup"
echo "=============================================="

# Check if gcloud CLI is installed
if ! command -v gcloud &> /dev/null; then
    echo "❌ Google Cloud CLI not found. Please install it first:"
    echo "   https://cloud.google.com/sdk/docs/install"
    exit 1
fi

# Set project ID
PROJECT_ID="receipt-manager-2c61b"
SERVICE_ACCOUNT_NAME="receipt-vision-processor"
SERVICE_ACCOUNT_EMAIL="${SERVICE_ACCOUNT_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"

echo "📋 Project ID: $PROJECT_ID"
echo "🔑 Service Account: $SERVICE_ACCOUNT_EMAIL"
echo ""

# Enable required APIs
echo "🚀 Enabling required APIs..."
gcloud services enable vision.googleapis.com --project=$PROJECT_ID
gcloud services enable cloudfunctions.googleapis.com --project=$PROJECT_ID
echo "✅ APIs enabled"

# Create service account
echo "👤 Creating service account..."
gcloud iam service-accounts create $SERVICE_ACCOUNT_NAME \
    --display-name="Receipt Vision Processor" \
    --description="Service account for receipt OCR processing" \
    --project=$PROJECT_ID

# Assign roles
echo "🔐 Assigning roles..."
gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:$SERVICE_ACCOUNT_EMAIL" \
    --role="roles/ml.admin"

gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:$SERVICE_ACCOUNT_EMAIL" \
    --role="roles/firebase.admin"

# Generate and download key
echo "🔑 Generating service account key..."
KEY_FILE="./functions/service-account-key.json"
gcloud iam service-accounts keys create $KEY_FILE \
    --iam-account=$SERVICE_ACCOUNT_EMAIL \
    --project=$PROJECT_ID

echo ""
echo "✅ Setup Complete!"
echo ""
echo "📁 Service account key saved to: $KEY_FILE"
echo "⚠️  IMPORTANT: This key file is already gitignored for security"
echo ""
echo "🚀 Next steps:"
echo "1. Deploy your Cloud Functions:"
echo "   firebase deploy --only functions"
echo ""
echo "2. Test the setup:"
echo "   firebase functions:shell"
echo ""
echo "3. Set environment variable for local development:"
echo "   export GOOGLE_APPLICATION_CREDENTIALS=\"$(pwd)/$KEY_FILE\""
echo ""
echo "🔒 Security reminder: Never commit service account keys to version control!"
