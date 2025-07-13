# Google Cloud Vision Setup Guide

## 🔐 Secure Service Account Key Setup for Firebase Cloud Functions

### Step 1: Create Google Cloud Service Account

1. **Go to Google Cloud Console:**
   - Visit: https://console.cloud.google.com/
   - Select your project: `receipt-manager-2c61b`

2. **Enable Google Cloud Vision API:**
   ```bash
   # Or enable via console: APIs & Services > Library > Vision API
   gcloud services enable vision.googleapis.com --project=receipt-manager-2c61b
   ```

3. **Create Service Account:**
   - Go to: IAM & Admin > Service Accounts
   - Click "Create Service Account"
   - Name: `receipt-vision-processor`
   - Description: `Service account for receipt OCR processing`

4. **Assign Roles:**
   - `Cloud Vision API Service Agent`
   - `Firebase Admin SDK Administrator Service Agent`

5. **Generate Key:**
   - Click on the service account
   - Go to "Keys" tab
   - Click "Add Key" > "Create new key"
   - Choose JSON format
   - Download the key file

### Step 2: Secure Key Storage Options

#### Option A: Firebase Functions Config (Recommended for Production)

```bash
# Set the service account key as environment variable
firebase functions:config:set google.credentials="$(cat path/to/your/service-account-key.json)"

# Deploy the config
firebase deploy --only functions:config
```

#### Option B: Local Development with Environment Variable

```bash
# Set environment variable (add to your shell profile)
export GOOGLE_APPLICATION_CREDENTIALS="/path/to/your/service-account-key.json"

# Or create a .env file in functions directory (already gitignored)
echo 'GOOGLE_APPLICATION_CREDENTIALS=/path/to/your/service-account-key.json' > functions/.env
```

#### Option C: Firebase Admin SDK Default Credentials (Simplest)

For Firebase projects, you can use the default Firebase Admin SDK credentials:

```typescript
// In your Cloud Function (already implemented)
import { ImageAnnotatorClient } from '@google-cloud/vision';

// This will automatically use Firebase project credentials
const visionClient = new ImageAnnotatorClient();
```

### Step 3: Update Cloud Function for Service Account

If using Option A (Firebase Config), update the function:

```typescript
// functions/src/index.ts
import * as functions from 'firebase-functions';

// Get credentials from Firebase config
const googleCredentials = functions.config().google?.credentials;

const visionClient = new ImageAnnotatorClient({
  credentials: googleCredentials ? JSON.parse(googleCredentials) : undefined
});
```

### Step 4: Security Best Practices

#### ✅ DO:
- Store service account keys as environment variables
- Use Firebase Functions config for production
- Add service account files to .gitignore
- Rotate keys regularly
- Use least privilege principle for roles

#### ❌ DON'T:
- Commit service account keys to version control
- Hardcode credentials in source code
- Share keys via email or chat
- Use overly broad permissions

### Step 5: Deploy and Test

```bash
# Build the functions
cd functions
npm run build

# Deploy functions
cd ..
firebase deploy --only functions --project receipt-manager-2c61b

# Test the function
# The processReceipt function will be available as a callable function
```

### Step 6: Frontend Integration

Add to your React app to call the Cloud Function:

```javascript
import { getFunctions, httpsCallable } from 'firebase/functions';

const functions = getFunctions();
const processReceipt = httpsCallable(functions, 'processReceipt');

// Call the function
const result = await processReceipt({
  imageUrl: 'gs://your-bucket/path/to/image.jpg',
  receiptId: 'receipt-document-id'
});
```

## 🔍 Troubleshooting

### Common Issues:

1. **"Permission denied" errors:**
   - Verify service account has correct roles
   - Check Firebase project permissions

2. **"Credentials not found" errors:**
   - Ensure GOOGLE_APPLICATION_CREDENTIALS is set
   - Verify service account key file exists

3. **"Vision API not enabled" errors:**
   - Enable Vision API in Google Cloud Console
   - Wait a few minutes for propagation

### Testing Locally:

```bash
# Start Firebase emulators
firebase emulators:start --only functions

# Test with curl
curl -X POST http://localhost:5001/receipt-manager-2c61b/us-central1/api
```

## 📊 Cost Considerations

- Google Cloud Vision API pricing: ~$1.50 per 1,000 images
- Firebase Functions: Pay per invocation
- Consider implementing caching to reduce API calls

## 🚀 Next Steps

1. Set up your service account key using one of the methods above
2. Deploy the Cloud Functions
3. Test with a sample receipt image
4. Integrate with your React frontend
5. Add more sophisticated receipt parsing logic

---

**Security Note:** Never commit service account keys to version control. The functions/.gitignore file is configured to prevent this.
