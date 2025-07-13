const functions = require('firebase-functions');
const admin = require('firebase-admin');
const { ImageAnnotatorClient } = require('@google-cloud/vision');

// Initialize Firebase Admin
admin.initializeApp();
const db = admin.firestore();

// Initialize Google Cloud Vision client with secure credential handling
let visionClient;
try {
  // Method 1: Try Environment Variables (Production)
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    console.log('Using GOOGLE_APPLICATION_CREDENTIALS environment variable');
    visionClient = new ImageAnnotatorClient();
  } else if (process.env.GOOGLE_CLOUD_CREDENTIALS) {
    console.log('Using GOOGLE_CLOUD_CREDENTIALS environment variable');
    const credentials = JSON.parse(process.env.GOOGLE_CLOUD_CREDENTIALS);
    visionClient = new ImageAnnotatorClient({
      credentials: credentials
    });
  } 
  // Method 2: Try local service account file (Development)
  else {
    console.log('Using default credentials or local service account file');
    // This will use GOOGLE_APPLICATION_CREDENTIALS env var or local key file
    visionClient = new ImageAnnotatorClient();
  }
  
  console.log('Google Cloud Vision client initialized successfully');
} catch (error) {
  console.error('Failed to initialize Google Cloud Vision client:', error);
  console.error('Make sure to set up credentials using one of these methods:');
  console.error('1. Environment: Set GOOGLE_APPLICATION_CREDENTIALS=/path/to/key.json');
  console.error('2. Environment: Set GOOGLE_CLOUD_CREDENTIALS with JSON credentials');
  console.error('3. Local file: Place service-account-key.json in functions/ directory');
  // Client will be undefined if initialization fails
}

// Merchant category mapping
const MERCHANT_CATEGORIES = {
  // Food & Dining
  'starbucks': 'Food & Drink',
  'mcdonalds': 'Food & Drink',
  'subway': 'Food & Drink',
  'pizza': 'Food & Drink',
  'restaurant': 'Food & Drink',
  'cafe': 'Food & Drink',
  'coffee': 'Food & Drink',
  'bar': 'Food & Drink',
  'diner': 'Food & Drink',
  
  // Travel & Transportation
  'hotel': 'Travel',
  'motel': 'Travel',
  'inn': 'Travel',
  'resort': 'Travel',
  'airline': 'Travel',
  'airport': 'Travel',
  'uber': 'Transportation',
  'lyft': 'Transportation',
  'taxi': 'Transportation',
  'gas': 'Transportation',
  'shell': 'Transportation',
  'chevron': 'Transportation',
  'exxon': 'Transportation',
  
  // Shopping
  'walmart': 'Shopping',
  'target': 'Shopping',
  'amazon': 'Shopping',
  'costco': 'Shopping',
  'grocery': 'Groceries',
  'supermarket': 'Groceries',
  'safeway': 'Groceries',
  'kroger': 'Groceries',
  
  // Healthcare
  'pharmacy': 'Healthcare',
  'cvs': 'Healthcare',
  'walgreens': 'Healthcare',
  'hospital': 'Healthcare',
  'clinic': 'Healthcare',
  'doctor': 'Healthcare',
  
  // Entertainment
  'movie': 'Entertainment',
  'theater': 'Entertainment',
  'cinema': 'Entertainment',
  'netflix': 'Entertainment',
  'spotify': 'Entertainment',
  
  // Utilities & Services
  'electric': 'Utilities',
  'water': 'Utilities',
  'internet': 'Utilities',
  'phone': 'Utilities',
  'insurance': 'Insurance',
  'bank': 'Banking'
};

// Helper function to extract date from text
function extractDate(text) {
  const datePatterns = [
    // MM/DD/YYYY or MM-DD-YYYY
    /\b(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})\b/g,
    // DD/MM/YYYY or DD-MM-YYYY
    /\b(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})\b/g,
    // Month DD, YYYY
    /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(\d{1,2}),?\s+(\d{4})\b/gi,
    // DD Month YYYY
    /\b(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(\d{4})\b/gi
  ];
  
  for (const pattern of datePatterns) {
    const matches = text.match(pattern);
    if (matches && matches.length > 0) {
      try {
        const dateStr = matches[0];
        const date = new Date(dateStr);
        if (!isNaN(date.getTime())) {
          return date.toISOString().split('T')[0]; // Return YYYY-MM-DD format
        }
      } catch (e) {
        continue;
      }
    }
  }
  return null;
}

// Helper function to extract total amount
function extractTotal(text) {
  const totalPatterns = [
    /total[:\s]*\$?([\d,]+\.\d{2})/gi,
    /amount[:\s]*\$?([\d,]+\.\d{2})/gi,
    /balance[:\s]*\$?([\d,]+\.\d{2})/gi,
    /\$([\d,]+\.\d{2})\s*total/gi,
    /grand\s*total[:\s]*\$?([\d,]+\.\d{2})/gi
  ];
  
  for (const pattern of totalPatterns) {
    const matches = text.match(pattern);
    if (matches && matches.length > 0) {
      const amount = matches[0].match(/([\d,]+\.\d{2})/);
      if (amount) {
        return parseFloat(amount[1].replace(/,/g, ''));
      }
    }
  }
  return null;
}

// Helper function to extract location (city, state)
function extractLocation(text) {
  // Look for city, state patterns
  const locationPatterns = [
    /([A-Za-z\s]+),\s*([A-Z]{2})\s*\d{5}/g, // City, ST 12345
    /([A-Za-z\s]+),\s*([A-Z]{2})/g, // City, ST
    /([A-Za-z\s]+)\s+([A-Z]{2})\s*\d{5}/g // City ST 12345
  ];
  
  for (const pattern of locationPatterns) {
    const matches = [...text.matchAll(pattern)];
    if (matches.length > 0) {
      const match = matches[0];
      return {
        city: match[1].trim(),
        state: match[2].trim(),
        full: `${match[1].trim()}, ${match[2].trim()}`
      };
    }
  }
  return null;
}

// Helper function to suggest category based on merchant/text
function suggestCategory(text) {
  const lowerText = text.toLowerCase();
  
  for (const [keyword, category] of Object.entries(MERCHANT_CATEGORIES)) {
    if (lowerText.includes(keyword)) {
      return category;
    }
  }
  
  // Default fallback categories based on common patterns
  if (lowerText.includes('food') || lowerText.includes('restaurant') || lowerText.includes('dining')) {
    return 'Food & Drink';
  }
  if (lowerText.includes('gas') || lowerText.includes('fuel')) {
    return 'Transportation';
  }
  if (lowerText.includes('store') || lowerText.includes('shop')) {
    return 'Shopping';
  }
  
  return 'Other';
}

exports.processReceipt = functions.https.onCall(async (data, context) => {
  console.log('processReceipt called with:', { data, authExists: !!context.auth });
  
  // Handle both old and new authentication formats
  let authContext = context.auth;
  if (!authContext && data.auth) {
    authContext = data.auth;
  }
  
  // Verify user is authenticated
  if (!authContext) {
    console.error('No authentication context found in processReceipt');
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  // Validate input parameters
  const imageUrl = data.imageUrl || data.data?.imageUrl;
  const receiptId = data.receiptId || data.data?.receiptId;
  if (!imageUrl || !receiptId) {
    throw new functions.https.HttpsError('invalid-argument', 'imageUrl and receiptId are required');
  }

  // Check if Vision client is available
  if (!visionClient) {
    throw new functions.https.HttpsError('unavailable', 'Google Cloud Vision service is not available');
  }

  const userId = authContext.uid;
  console.log(`Processing receipt ${receiptId} for user ${userId}`);

  try {
    // Verify the receipt belongs to the authenticated user
    const receiptDoc = await db.collection('receipts').doc(receiptId).get();
    
    if (!receiptDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'Receipt not found');
    }
    
    const receiptData = receiptDoc.data();
    if (receiptData.userId !== userId) {
      throw new functions.https.HttpsError('permission-denied', 'Access denied');
    }

    // Get user's default location for trip detection
    const userDoc = await db.collection('users').doc(userId).get();
    const userData = userDoc.exists ? userDoc.data() : {};
    const userDefaultLocation = userData.defaultLocation || null;

    // Perform OCR using Google Cloud Vision
    console.log('Performing OCR on image:', imageUrl);
    const [result] = await visionClient.textDetection(imageUrl);
    const detections = result.textAnnotations;
    
    if (!detections || detections.length === 0) {
      throw new functions.https.HttpsError('not-found', 'No text found in the image');
    }

    // Extract the full text
    const fullText = detections[0].description;
    console.log('Extracted text:', fullText);

    // Intelligent data extraction
    const extractedDate = extractDate(fullText);
    const extractedTotal = extractTotal(fullText);
    const extractedLocation = extractLocation(fullText);
    const suggestedCategory = suggestCategory(fullText);
    
    // Determine if this might be a trip (location different from user's default)
    let isPotentialTrip = false;
    if (extractedLocation && userDefaultLocation) {
      const receiptCity = extractedLocation.city.toLowerCase();
      const receiptState = extractedLocation.state.toLowerCase();
      const userCity = userDefaultLocation.city ? userDefaultLocation.city.toLowerCase() : '';
      const userState = userDefaultLocation.state ? userDefaultLocation.state.toLowerCase() : '';
      
      isPotentialTrip = (receiptCity !== userCity || receiptState !== userState);
    }

    // Parse and extract structured data
    const extractedData = {
      rawText: fullText,
      date: extractedDate,
      total: extractedTotal,
      location: extractedLocation,
      suggestedCategory: suggestedCategory,
      isPotentialTrip: isPotentialTrip,
      userDefaultLocation: userDefaultLocation,
      lines: fullText.split('\n').filter(line => line.trim().length > 0),
      extractedAt: new Date().toISOString()
    };

    // Update the receipt document with extracted data
    const updateData = {
      extractedText: fullText,
      extractedData: extractedData,
      processedAt: admin.firestore.FieldValue.serverTimestamp(),
      status: 'processed'
    };

    // Add extracted fields to the main receipt document
    if (extractedDate) updateData.date = extractedDate;
    if (extractedTotal) updateData.total = extractedTotal;
    if (extractedLocation) updateData.location = extractedLocation;
    if (suggestedCategory) updateData.suggestedCategory = suggestedCategory;
    
    await db.collection('receipts').doc(receiptId).update(updateData);

    console.log('Receipt processed successfully:', {
      receiptId,
      date: extractedDate,
      total: extractedTotal,
      location: extractedLocation?.full,
      category: suggestedCategory,
      isPotentialTrip
    });

    return {
      success: true,
      extractedText: fullText,
      extractedData: extractedData,
      receiptId: receiptId
    };

  } catch (error) {
    console.error('Error processing receipt:', error);
    
    // Update receipt with error status
    try {
      await db.collection('receipts').doc(receiptId).update({
        status: 'error',
        error: error.message,
        processedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    } catch (updateError) {
      console.error('Error updating receipt status:', updateError);
    }
    
    if (error.code) {
      throw error; // Re-throw Firebase errors
    }
    
    throw new functions.https.HttpsError('internal', 'Failed to process receipt: ' + error.message);
  }
});

// Create a new trip
exports.createTrip = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  const { name, startDate, endDate, location } = data;
  if (!name || !startDate || !endDate) {
    throw new functions.https.HttpsError('invalid-argument', 'name, startDate, and endDate are required');
  }

  const userId = context.auth.uid;
  
  try {
    // Create trip document
    const tripRef = db.collection('users').doc(userId).collection('trips').doc();
    const tripData = {
      id: tripRef.id,
      name: name,
      startDate: startDate,
      endDate: endDate,
      location: location || null,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      userId: userId
    };
    
    await tripRef.set(tripData);
    
    console.log('Trip created:', { tripId: tripRef.id, name, userId });
    
    return {
      success: true,
      tripId: tripRef.id,
      trip: tripData
    };
    
  } catch (error) {
    console.error('Error creating trip:', error);
    throw new functions.https.HttpsError('internal', 'Failed to create trip');
  }
});

// Assign receipt to trip
exports.assignReceiptToTrip = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  const { receiptId, tripId, tripName } = data;
  if (!receiptId || (!tripId && !tripName)) {
    throw new functions.https.HttpsError('invalid-argument', 'receiptId and either tripId or tripName are required');
  }

  const userId = context.auth.uid;
  
  try {
    // Verify receipt belongs to user
    const receiptDoc = await db.collection('receipts').doc(receiptId).get();
    if (!receiptDoc.exists || receiptDoc.data().userId !== userId) {
      throw new functions.https.HttpsError('permission-denied', 'Receipt not found or access denied');
    }
    
    // Update receipt with trip information
    const updateData = {
      tripId: tripId || null,
      tripName: tripName || null,
      reason: tripName || 'Trip',
      tripAlbum: tripName || null,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };
    
    await db.collection('receipts').doc(receiptId).update(updateData);
    
    console.log('Receipt assigned to trip:', { receiptId, tripId, tripName, userId });
    
    return {
      success: true,
      receiptId: receiptId,
      tripId: tripId,
      tripName: tripName
    };
    
  } catch (error) {
    console.error('Error assigning receipt to trip:', error);
    if (error.code) {
      throw error;
    }
    throw new functions.https.HttpsError('internal', 'Failed to assign receipt to trip');
  }
});

// Find receipts in date range for trip suggestion
exports.findReceiptsInDateRange = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  const { startDate, endDate } = data;
  if (!startDate || !endDate) {
    throw new functions.https.HttpsError('invalid-argument', 'startDate and endDate are required');
  }

  const userId = context.auth.uid;
  
  try {
    // Query receipts in date range
    const receiptsQuery = await db.collection('receipts')
      .where('userId', '==', userId)
      .where('date', '>=', startDate)
      .where('date', '<=', endDate)
      .get();
    
    const receipts = [];
    receiptsQuery.forEach(doc => {
      receipts.push({
        id: doc.id,
        ...doc.data()
      });
    });
    
    console.log(`Found ${receipts.length} receipts in date range ${startDate} to ${endDate} for user ${userId}`);
    
    return {
      success: true,
      receipts: receipts,
      count: receipts.length
    };
    
  } catch (error) {
    console.error('Error finding receipts in date range:', error);
    throw new functions.https.HttpsError('internal', 'Failed to find receipts in date range');
  }
});

// Update user settings (including default location)
exports.updateUserSettings = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  const { defaultLocation, preferences } = data;
  const userId = context.auth.uid;
  
  try {
    const updateData = {
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };
    
    if (defaultLocation) {
      updateData.defaultLocation = defaultLocation;
    }
    
    if (preferences) {
      updateData.preferences = preferences;
    }
    
    // Create or update user document
    await db.collection('users').doc(userId).set(updateData, { merge: true });
    
    console.log('User settings updated:', { userId, defaultLocation, preferences });
    
    return {
      success: true,
      userId: userId,
      settings: updateData
    };
    
  } catch (error) {
    console.error('Error updating user settings:', error);
    throw new functions.https.HttpsError('internal', 'Failed to update user settings');
  }
});

// Delete Receipt Function
exports.deleteReceipt = functions.https.onCall(async (data, context) => {
  console.log('deleteReceipt called with:', { data, authExists: !!context.auth });
  
  // Handle both old and new authentication formats
  let authContext = context.auth;
  if (!authContext && data.auth) {
    authContext = data.auth;
  }
  
  if (!authContext) {
    console.error('No authentication context found');
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  const receiptId = data.receiptId || data.data?.receiptId;
  const userId = authContext.uid;
  
  console.log('deleteReceipt authenticated user:', { userId, receiptId });

  if (!receiptId) {
    throw new functions.https.HttpsError('invalid-argument', 'receiptId is required');
  }

  try {
    console.log('Starting receipt deletion process...');
    
    // Get the receipt document to verify ownership and get storage path
    const receiptRef = db.collection('receipts').doc(receiptId);
    console.log('Attempting to get receipt document...');
    const receiptDoc = await receiptRef.get();
    console.log('Receipt document retrieved, exists:', receiptDoc.exists);

    if (!receiptDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'Receipt not found');
    }

    const receiptData = receiptDoc.data();

    console.log('Receipt data:', { userId: receiptData.userId, storagePath: receiptData.storagePath });
    
    // Verify ownership
    if (receiptData.userId !== userId) {
      console.error('Ownership verification failed:', { receiptUserId: receiptData.userId, requestUserId: userId });
      throw new functions.https.HttpsError('permission-denied', 'You can only delete your own receipts');
    }
    
    console.log('Ownership verified, proceeding with deletion...');

    // Delete from Firebase Storage if storage path exists
    if (receiptData.storagePath) {
      try {
        console.log('Attempting to delete storage file:', receiptData.storagePath);
        const bucket = admin.storage().bucket();
        await bucket.file(receiptData.storagePath).delete();
        console.log(`Deleted storage file: ${receiptData.storagePath}`);
      } catch (storageError) {
        console.error('Error deleting storage file:', storageError);
        // Continue with Firestore deletion even if storage deletion fails
      }
    }

    // Delete from Firestore
    console.log('Attempting to delete Firestore document...');
    await receiptRef.delete();
    console.log(`Deleted receipt document: ${receiptId}`);

    // Remove receipt from any trips it's assigned to
    const tripsQuery = db.collection('users').doc(userId).collection('trips')
      .where('receiptIds', 'array-contains', receiptId);
    
    const tripsSnapshot = await tripsQuery.get();
    const batch = db.batch();
    
    tripsSnapshot.forEach(tripDoc => {
      const tripRef = tripDoc.ref;
      const tripData = tripDoc.data();
      const updatedReceiptIds = tripData.receiptIds.filter(id => id !== receiptId);
      
      batch.update(tripRef, {
        receiptIds: updatedReceiptIds,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    });
    
    if (!tripsSnapshot.empty) {
      await batch.commit();
      console.log(`Removed receipt ${receiptId} from ${tripsSnapshot.size} trip(s)`);
    }

    console.log('Receipt deleted successfully:', receiptId);
    return {
      success: true,
      message: 'Receipt deleted successfully',
      receiptId: receiptId
    };
    
  } catch (error) {
    console.error('Error deleting receipt:', error);
    
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    
    throw new functions.https.HttpsError('internal', 'Failed to delete receipt');
  }
});

// Health check endpoint
exports.api = functions.https.onRequest((req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'Receipt Manager Cloud Functions',
    timestamp: new Date().toISOString()
  });
});
