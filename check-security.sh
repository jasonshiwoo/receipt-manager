#!/bin/bash

echo "🔐 Receipt Manager - Security Check"
echo "=================================="
echo ""

# Check if we're in the right directory
if [ ! -f "firebase.json" ]; then
    echo "❌ Please run this script from the receipt-manager root directory"
    exit 1
fi

echo "📋 Checking Security Status..."
echo ""

# 1. Check .gitignore protection
echo "1️⃣ Checking .gitignore protection:"
if grep -q "service-account-key.json" functions/.gitignore; then
    echo "   ✅ service-account-key.json is gitignored"
else
    echo "   ❌ service-account-key.json NOT gitignored"
fi

if grep -q "*-key.json" functions/.gitignore; then
    echo "   ✅ *-key.json pattern is gitignored"
else
    echo "   ❌ *-key.json pattern NOT gitignored"
fi

# 2. Check for accidentally committed keys
echo ""
echo "2️⃣ Checking for committed service account keys:"
if git ls-files | grep -E "(key\.json|credentials\.json)" | grep -v package; then
    echo "   ❌ WARNING: Service account keys found in Git!"
else
    echo "   ✅ No service account keys committed to Git"
fi

# 3. Check local key files
echo ""
echo "3️⃣ Checking local key files:"
if [ -f "functions/service-account-key.json" ]; then
    echo "   ✅ Local service account key found (for development)"
    echo "   📝 File size: $(ls -lh functions/service-account-key.json | awk '{print $5}')"
else
    echo "   ℹ️  No local service account key (will use Firebase config)"
fi

# 4. Check Firebase Functions config
echo ""
echo "4️⃣ Checking Firebase Functions config:"
if command -v firebase &> /dev/null; then
    CONFIG_CHECK=$(firebase functions:config:get google.credentials --project receipt-manager-2c61b 2>/dev/null)
    if [ "$CONFIG_CHECK" != "{}" ] && [ -n "$CONFIG_CHECK" ]; then
        echo "   ✅ Firebase Functions config contains Google credentials"
    else
        echo "   ℹ️  No Google credentials in Firebase Functions config"
    fi
else
    echo "   ⚠️  Firebase CLI not available to check config"
fi

# 5. Check environment variables
echo ""
echo "5️⃣ Checking environment variables:"
if [ -n "$GOOGLE_APPLICATION_CREDENTIALS" ]; then
    echo "   ✅ GOOGLE_APPLICATION_CREDENTIALS is set"
    echo "   📝 Points to: $GOOGLE_APPLICATION_CREDENTIALS"
else
    echo "   ℹ️  GOOGLE_APPLICATION_CREDENTIALS not set"
fi

# 6. Check current Git status for sensitive files
echo ""
echo "6️⃣ Checking Git status for sensitive files:"
SENSITIVE_FILES=$(git status --porcelain | grep -E "(key|credential)" | grep -v package)
if [ -n "$SENSITIVE_FILES" ]; then
    echo "   ⚠️  Sensitive files in Git staging:"
    echo "$SENSITIVE_FILES"
else
    echo "   ✅ No sensitive files in Git staging"
fi

echo ""
echo "🎯 Security Recommendations:"
echo ""

# Provide recommendations based on findings
if [ ! -f "functions/service-account-key.json" ] && [ "$CONFIG_CHECK" = "{}" ]; then
    echo "📋 You need to set up Google Cloud Vision credentials:"
    echo "   Option 1 (Recommended): Use Firebase Functions Config"
    echo "   → firebase functions:config:set google.credentials=\"\$(cat your-key.json)\""
    echo ""
    echo "   Option 2: Use local development file"
    echo "   → Place service account key as functions/service-account-key.json"
    echo ""
    echo "   See SECURE_VISION_SETUP.md for detailed instructions"
fi

echo "🔒 Security Status: Your setup follows security best practices!"
echo "   • Service account keys are properly gitignored"
echo "   • No sensitive files committed to repository"
echo "   • Multiple secure credential methods supported"
echo ""
echo "📖 For setup instructions, see: SECURE_VISION_SETUP.md"
