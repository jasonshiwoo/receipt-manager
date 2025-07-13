# 🔐 Secure Google Cloud Vision Setup Guide

## 🎯 **Overview**
This guide shows you how to securely add Google Cloud Vision service account credentials to your Firebase Cloud Functions without exposing sensitive keys.

## 📋 **Prerequisites**
- Google Cloud Console access
- Firebase project: `receipt-manager-2c61b`
- Firebase CLI installed and authenticated

## 🔧 **Step 1: Create Service Account (Google Cloud Console)**

### **1.1 Enable APIs**
1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Select project: `receipt-manager-2c61b`
3. Navigate to **APIs & Services > Library**
4. Enable these APIs:
   - **Cloud Vision API**
   - **Cloud Functions API** (should already be enabled)

### **1.2 Create Service Account**
1. Go to **IAM & Admin > Service Accounts**
2. Click **+ CREATE SERVICE ACCOUNT**
3. Fill in details:
   - **Name**: `receipt-vision-service`
   - **Description**: `Service account for Receipt Manager Vision API`
4. Click **CREATE AND CONTINUE**

### **1.3 Assign Roles (Minimal Permissions)**
Add these roles (principle of least privilege):
- **Cloud Vision API Service Agent**
- **Firebase Service Management Service Agent**

Click **CONTINUE** then **DONE**

### **1.4 Generate Key**
1. Find your new service account in the list
2. Click the **Actions** menu (3 dots) → **Manage keys**
3. Click **ADD KEY** → **Create new key**
4. Select **JSON** format
5. Click **CREATE**
6. **IMPORTANT**: The key file will download automatically

## 🔐 **Step 2: Secure Key Storage (Choose ONE Method)**

### **Method A: Firebase Functions Config (Recommended for Production)**

```bash
# Navigate to your project
cd /Users/jasonhan/CascadeProjects/Business\ Manager/receipt-manager

# Set the service account key as Firebase config
# Replace 'path/to/your/key.json' with actual downloaded key path
firebase functions:config:set google.credentials="$(cat path/to/your/downloaded-key.json)" --project receipt-manager-2c61b

# Verify it was set (should show truncated key)
firebase functions:config:get --project receipt-manager-2c61b
```

### **Method B: Local Development File (For Testing)**

```bash
# Move the downloaded key to functions directory
mv ~/Downloads/receipt-manager-2c61b-*.json functions/service-account-key.json

# Verify it's gitignored (should show no output)
git status functions/service-account-key.json
```

## 🚀 **Step 3: Deploy Vision-Enabled Functions**

### **3.1 Switch to Vision Functions**
```bash
cd functions
mv src/index.js src/index-simple.js
mv src/index-vision.js src/index.js
```

### **3.2 Update Vision Function for Config Method**
If using Firebase Functions Config (Method A), update the function:

```javascript
// In functions/src/index.js, replace the Vision client initialization:

// For Firebase Functions Config
let visionClient;
try {
  const credentials = functions.config().google?.credentials;
  if (credentials) {
    // Parse the JSON string from Firebase config
    const credentialsObj = typeof credentials === 'string' 
      ? JSON.parse(credentials) 
      : credentials;
    
    visionClient = new ImageAnnotatorClient({
      credentials: credentialsObj
    });
  } else {
    // Fallback to default credentials (for local development)
    visionClient = new ImageAnnotatorClient();
  }
  console.log('Google Cloud Vision client initialized successfully');
} catch (error) {
  console.error('Failed to initialize Google Cloud Vision client:', error);
}
```

### **3.3 Deploy Functions**
```bash
# Deploy the functions
firebase deploy --only functions --project receipt-manager-2c61b
```

## ✅ **Step 4: Security Verification**

### **4.1 Check Git Status**
```bash
# Should show NO service account files
git status | grep -i key
git status | grep -i credential
```

### **4.2 Verify .gitignore Protection**
```bash
# These should all be ignored
echo "service-account-key.json" >> test-file.json
git status test-file.json  # Should show as untracked
rm test-file.json
```

### **4.3 Test Function Security**
```bash
# Check deployed functions
firebase functions:list --project receipt-manager-2c61b

# Test the function (should work without exposing keys)
# Use your React app to test OCR functionality
```

## 🔒 **Security Best Practices Implemented**

### **✅ What's Secure:**
1. **Service account keys are gitignored** - Never committed to repository
2. **Minimal IAM roles** - Only Vision API permissions
3. **Firebase Functions Config** - Encrypted storage in Firebase
4. **Environment isolation** - Different configs for dev/prod
5. **Key rotation ready** - Easy to update credentials

### **❌ What to NEVER Do:**
- ❌ Commit `.json` key files to Git
- ❌ Hardcode credentials in source code
- ❌ Use overly broad IAM permissions
- ❌ Share service account keys via email/chat
- ❌ Store keys in public repositories

## 🧪 **Step 5: Test the Integration**

### **5.1 Test in React App**
1. Open your Receipt Manager app
2. Login with access code "jasonhan"
3. Upload a receipt image
4. Click "Process with OCR" button
5. Verify text extraction works

### **5.2 Monitor Function Logs**
```bash
# Watch function logs for errors
firebase functions:log --project receipt-manager-2c61b
```

## 🚨 **Troubleshooting**

### **Common Issues:**
1. **"Vision client not initialized"** - Check Firebase config or key file path
2. **"Permission denied"** - Verify IAM roles are correctly assigned
3. **"API not enabled"** - Enable Cloud Vision API in Google Cloud Console
4. **"Quota exceeded"** - Check Vision API quotas and billing

### **Debug Commands:**
```bash
# Check Firebase config
firebase functions:config:get --project receipt-manager-2c61b

# Test function locally
firebase emulators:start --only functions

# Check function deployment
firebase functions:list --project receipt-manager-2c61b
```

## 📞 **Support**

If you encounter issues:
1. Check the function logs: `firebase functions:log`
2. Verify API is enabled in Google Cloud Console
3. Confirm service account has correct permissions
4. Test with Firebase emulator first

---

**🔐 Your service account key is now securely configured for Firebase Cloud Functions!**
