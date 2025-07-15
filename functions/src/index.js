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

// Helper function to extract date from text with enhanced patterns
function extractDate(text) {
  console.log('=== DATE EXTRACTION START ===');
  console.log('Input text length:', text.length);
  
  // Enhanced date patterns with better regex for receipt formats
  const datePatterns = [
    // MM/DD/YYYY or MM-DD-YYYY (most common US format)
    { pattern: /\b(0?[1-9]|1[0-2])[\/\-\.](0?[1-9]|[12]\d|3[01])[\/\-\.](20\d{2}|\d{2})\b/g, format: 'MM/DD/YYYY', priority: 10 },
    // DD/MM/YYYY or DD-MM-YYYY (European format)
    { pattern: /\b(0?[1-9]|[12]\d|3[01])[\/\-\.](0?[1-9]|1[0-2])[\/\-\.](20\d{2}|\d{2})\b/g, format: 'DD/MM/YYYY', priority: 8 },
    // Month DD, YYYY (e.g., "Jan 15, 2024")
    { pattern: /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+(0?[1-9]|[12]\d|3[01]),?\s+(20\d{2}|\d{2})\b/gi, format: 'Month DD, YYYY', priority: 9 },
    // DD Month YYYY (e.g., "15 Jan 2024")
    { pattern: /\b(0?[1-9]|[12]\d|3[01])\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+(20\d{2}|\d{2})\b/gi, format: 'DD Month YYYY', priority: 7 },
    // YYYY-MM-DD (ISO format)
    { pattern: /\b(20\d{2})-(0?[1-9]|1[0-2])-(0?[1-9]|[12]\d|3[01])\b/g, format: 'YYYY-MM-DD', priority: 6 },
    // Time-based patterns (look for dates near time stamps)
    { pattern: /\b(0?[1-9]|1[0-2])[\/\-](0?[1-9]|[12]\d|3[01])[\/\-](20\d{2}|\d{2})\s*\d{1,2}:\d{2}/g, format: 'MM/DD/YYYY with time', priority: 12 }
  ];
  
  const monthNames = {
    'jan': '01', 'january': '01', 'feb': '02', 'february': '02', 'mar': '03', 'march': '03',
    'apr': '04', 'april': '04', 'may': '05', 'jun': '06', 'june': '06',
    'jul': '07', 'july': '07', 'aug': '08', 'august': '08', 'sep': '09', 'september': '09',
    'oct': '10', 'october': '10', 'nov': '11', 'november': '11', 'dec': '12', 'december': '12'
  };
  
  let bestDate = null;
  let bestScore = 0;
  let allMatches = [];
  
  // Process each pattern
  for (const { pattern, format, priority } of datePatterns) {
    const matches = [...text.matchAll(pattern)];
    console.log(`Pattern ${format}: found ${matches.length} matches`);
    
    for (const match of matches) {
      try {
        let dateStr = match[0].trim();
        let parsedDate = null;
        let confidence = 0;
        
        console.log(`Processing match: "${dateStr}" (format: ${format})`);
        
        // Parse different formats
        if (format.includes('Month')) {
          // Month name format
          const monthMatch = dateStr.match(/(\w+)\s+(\d{1,2}),?\s+(\d{2,4})/i) || 
                            dateStr.match(/(\d{1,2})\s+(\w+)\s+(\d{2,4})/i);
          if (monthMatch) {
            let month, day, year;
            if (format === 'Month DD, YYYY') {
              [, month, day, year] = monthMatch;
            } else {
              [, day, month, year] = monthMatch;
            }
            
            const monthNum = monthNames[month.toLowerCase()];
            if (monthNum) {
              if (year.length === 2) year = '20' + year;
              parsedDate = `${year}-${monthNum}-${day.padStart(2, '0')}`;
              confidence = 0.9;
            }
          }
        } else {
          // Numeric formats
          const nums = dateStr.match(/\d+/g);
          if (nums && nums.length >= 3) {
            let month, day, year;
            
            if (format === 'YYYY-MM-DD') {
              [year, month, day] = nums;
            } else if (format === 'DD/MM/YYYY') {
              [day, month, year] = nums;
            } else {
              // Default to MM/DD/YYYY
              [month, day, year] = nums;
            }
            
            if (year.length === 2) year = '20' + year;
            
            // Validate date components
            const m = parseInt(month);
            const d = parseInt(day);
            const y = parseInt(year);
            
            if (m >= 1 && m <= 12 && d >= 1 && d <= 31 && y >= 2020 && y <= 2030) {
              parsedDate = `${y}-${m.toString().padStart(2, '0')}-${d.toString().padStart(2, '0')}`;
              confidence = getDateConfidence(dateStr, format);
            }
          }
        }
        
        if (parsedDate) {
          const score = confidence * priority;
          allMatches.push({ date: parsedDate, score, original: dateStr, format });
          
          if (score > bestScore) {
            bestDate = parsedDate;
            bestScore = score;
            console.log(`New best date: ${parsedDate} (score: ${score}, format: ${format})`);
          }
        }
        
      } catch (error) {
        console.log(`Error parsing date "${match[0]}": ${error.message}`);
      }
    }
  }
  
  console.log('All date matches:', allMatches);
  console.log(`=== DATE EXTRACTION RESULT: ${bestDate} (score: ${bestScore}) ===`);
  return bestDate;
}

// Helper function to determine date confidence
function getDateConfidence(dateStr, format) {
  let confidence = 50; // Base confidence
  
  // Higher confidence for more explicit formats
  if (format === 'MONTH_DAY_YEAR' || format === 'DAY_MONTH_YEAR') confidence += 30;
  if (format === 'ISO') confidence += 20;
  if (dateStr.includes(',')) confidence += 10; // Comma usually indicates proper date formatting
  
  return confidence;
}

// Helper function to extract total amount with enhanced patterns
function extractTotal(text) {
  console.log('Extracting total amount from text...');
  
  const totalPatterns = [
    // Standard total patterns
    { pattern: /total[:\s]*\$?([\d,]+\.\d{2})/gi, priority: 90 },
    { pattern: /grand[\s]*total[:\s]*\$?([\d,]+\.\d{2})/gi, priority: 95 },
    { pattern: /final[\s]*total[:\s]*\$?([\d,]+\.\d{2})/gi, priority: 85 },
    { pattern: /amount[\s]*due[:\s]*\$?([\d,]+\.\d{2})/gi, priority: 80 },
    { pattern: /balance[:\s]*\$?([\d,]+\.\d{2})/gi, priority: 70 },
    
    // Currency symbol first patterns
    { pattern: /\$([\d,]+\.\d{2})\s*total/gi, priority: 85 },
    { pattern: /\$([\d,]+\.\d{2})\s*grand[\s]*total/gi, priority: 90 },
    
    // Line-based patterns (amount at end of line)
    { pattern: /total.*?\$?([\d,]+\.\d{2})\s*$/gim, priority: 75 },
    { pattern: /^.*total.*?\$?([\d,]+\.\d{2}).*$/gim, priority: 70 },
    
    // Subtotal + tax patterns (look for final amount)
    { pattern: /(?:subtotal|sub[\s]*total)[:\s]*\$?([\d,]+\.\d{2})/gi, priority: 60 },
    { pattern: /(?:tax|hst|gst|pst)[:\s]*\$?([\d,]+\.\d{2})/gi, priority: 50 },
    
    // Generic dollar amounts (lowest priority)
    { pattern: /\$([\d,]+\.\d{2})/g, priority: 30 }
  ];
  
  const foundAmounts = [];
  
  for (const { pattern, priority } of totalPatterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const amountStr = match[1];
      const amount = parseFloat(amountStr.replace(/,/g, ''));
      
      if (amount && amount > 0 && amount < 10000) { // Reasonable amount range
        console.log(`Found potential amount: $${amount} (priority: ${priority}, context: "${match[0].trim()}")`);
        foundAmounts.push({ amount, priority, context: match[0].trim() });
      }
    }
  }
  
  if (foundAmounts.length > 0) {
    // Sort by priority (highest first), then by amount (highest first for same priority)
    foundAmounts.sort((a, b) => {
      if (a.priority !== b.priority) return b.priority - a.priority;
      return b.amount - a.amount;
    });
    
    const selectedAmount = foundAmounts[0];
    console.log(`Selected amount: $${selectedAmount.amount} (priority: ${selectedAmount.priority}, context: "${selectedAmount.context}")`);
    return selectedAmount.amount;
  }
  
  console.log('No valid amount found');
  return null;
}

// Helper function to extract merchant name from top lines of receipt
function extractMerchant(text) {
  console.log('Extracting merchant name...');
  
  const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
  
  // Look at first few lines for merchant name
  const potentialMerchants = [];
  
  for (let i = 0; i < Math.min(5, lines.length); i++) {
    const line = lines[i];
    
    // Skip lines that are clearly not merchant names
    if (/^\d+$/.test(line)) continue; // Pure numbers
    if (/^[\d\s\-\/\.]+$/.test(line)) continue; // Dates/numbers only
    if (line.length < 3) continue; // Too short
    if (line.length > 50) continue; // Too long
    if (/^(receipt|invoice|bill|order)$/i.test(line)) continue; // Generic terms
    
    // Higher priority for lines with common business indicators
    let priority = 50;
    if (/\b(inc|llc|corp|ltd|co\.|company)\b/i.test(line)) priority += 30;
    if (/\b(store|shop|market|restaurant|cafe|bar|grill)\b/i.test(line)) priority += 20;
    if (i === 0) priority += 20; // First line bonus
    if (i === 1) priority += 10; // Second line bonus
    
    potentialMerchants.push({ name: line, priority, lineIndex: i });
    console.log(`Potential merchant: "${line}" (line ${i}, priority: ${priority})`);
  }
  
  if (potentialMerchants.length > 0) {
    potentialMerchants.sort((a, b) => b.priority - a.priority);
    const selectedMerchant = potentialMerchants[0];
    console.log(`Selected merchant: "${selectedMerchant.name}" (priority: ${selectedMerchant.priority})`);
    return selectedMerchant.name;
  }
  
  console.log('No merchant name found');
  return null;
}

// Helper function to extract location (city, state) with enhanced patterns
function extractLocation(text) {
  console.log('Extracting location...');
  
  const locationPatterns = [
    // Full address patterns
    { pattern: /([A-Za-z\s]+),\s*([A-Z]{2})\s*(\d{5}(?:-\d{4})?)/g, priority: 90 }, // City, ST 12345-6789
    { pattern: /([A-Za-z\s]+),\s*([A-Z]{2})\s+(\d{5})/g, priority: 85 }, // City, ST 12345
    { pattern: /([A-Za-z\s]+)\s+([A-Z]{2})\s+(\d{5})/g, priority: 80 }, // City ST 12345
    
    // City, State without ZIP
    { pattern: /([A-Za-z\s]{3,}),\s*([A-Z]{2})(?!\d)/g, priority: 70 }, // City, ST
    { pattern: /([A-Za-z\s]{3,})\s+([A-Z]{2})(?!\d)/g, priority: 65 }, // City ST
    
    // Address line patterns
    { pattern: /(\d+\s+[A-Za-z\s]+),\s*([A-Za-z\s]+),\s*([A-Z]{2})/g, priority: 75 }, // 123 Main St, City, ST
    { pattern: /(\d+\s+[A-Za-z\s]+)\s+([A-Za-z\s]+)\s+([A-Z]{2})\s+(\d{5})/g, priority: 85 } // 123 Main St City ST 12345
  ];
  
  const foundLocations = [];
  
  for (const { pattern, priority } of locationPatterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      let city, state, zip, address;
      
      if (match.length === 4 && /\d{5}/.test(match[3])) {
        // City, ST ZIP
        city = match[1].trim();
        state = match[2].trim();
        zip = match[3].trim();
      } else if (match.length === 3) {
        // City, ST
        city = match[1].trim();
        state = match[2].trim();
      } else if (match.length === 5) {
        // Address City ST ZIP
        address = match[1].trim();
        city = match[2].trim();
        state = match[3].trim();
        zip = match[4].trim();
      }
      
      if (city && state && city.length >= 3 && /^[A-Z]{2}$/.test(state)) {
        const location = {
          city: city,
          state: state,
          full: `${city}, ${state}${zip ? ' ' + zip : ''}`
        };
        
        if (address) location.address = address;
        if (zip) location.zip = zip;
        
        foundLocations.push({ location, priority, context: match[0] });
        console.log(`Found location: ${location.full} (priority: ${priority}, context: "${match[0]}")`);
      }
    }
  }
  
  if (foundLocations.length > 0) {
    foundLocations.sort((a, b) => b.priority - a.priority);
    const selectedLocation = foundLocations[0];
    console.log(`Selected location: ${selectedLocation.location.full} (priority: ${selectedLocation.priority})`);
    return selectedLocation.location;
  }
  
  console.log('No location found');
  return null;
}

// Enhanced function to suggest category based on merchant name and receipt text
function suggestCategory(text) {
  if (!text) return 'Other';
  
  const lowerText = text.toLowerCase();
  console.log('Analyzing text for category suggestion:', lowerText.substring(0, 100) + '...');
  
  // First, check for exact merchant matches (highest priority)
  for (const [keyword, category] of Object.entries(MERCHANT_CATEGORIES)) {
    if (lowerText.includes(keyword)) {
      console.log(`Found merchant keyword '${keyword}' -> category '${category}'`);
      return category;
    }
  }
  
  // Enhanced pattern matching for common receipt patterns
  const patterns = [
    // Food & Dining patterns
    { regex: /\b(restaurant|cafe|coffee|food|dining|pizza|burger|taco|sushi|thai|chinese|mexican|italian)\b/i, category: 'Food & Drink' },
    { regex: /\b(bar|pub|brewery|wine|beer|cocktail)\b/i, category: 'Food & Drink' },
    
    // Transportation patterns
    { regex: /\b(gas|fuel|gasoline|station|shell|chevron|exxon|mobil|bp)\b/i, category: 'Transportation' },
    { regex: /\b(uber|lyft|taxi|cab|parking|toll)\b/i, category: 'Transportation' },
    
    // Shopping patterns
    { regex: /\b(walmart|target|costco|amazon|store|shop|retail|mall)\b/i, category: 'Shopping' },
    { regex: /\b(grocery|supermarket|market|safeway|kroger|whole foods)\b/i, category: 'Groceries' },
    
    // Healthcare patterns
    { regex: /\b(pharmacy|cvs|walgreens|hospital|clinic|doctor|medical|health)\b/i, category: 'Healthcare' },
    
    // Utilities patterns
    { regex: /\b(electric|electricity|water|gas bill|internet|phone|utility)\b/i, category: 'Utilities' },
    
    // Entertainment patterns
    { regex: /\b(movie|theater|cinema|netflix|spotify|entertainment|game)\b/i, category: 'Entertainment' },
    
    // Travel patterns
    { regex: /\b(hotel|motel|inn|resort|airline|airport|travel|booking)\b/i, category: 'Travel' }
  ];
  
  // Check patterns in order of specificity
  for (const pattern of patterns) {
    if (pattern.regex.test(lowerText)) {
      console.log(`Matched pattern '${pattern.regex}' -> category '${pattern.category}'`);
      return pattern.category;
    }
  }
  
  console.log('No category match found, defaulting to Other');
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

    // No need for user location data since we're not storing location

    // Perform OCR using Google Cloud Vision with DOCUMENT_TEXT_DETECTION for better accuracy
    console.log('Performing enhanced OCR on image:', imageUrl);
    const [result] = await visionClient.documentTextDetection(imageUrl);
    
    if (!result.fullTextAnnotation) {
      throw new functions.https.HttpsError('not-found', 'No text found in the image');
    }

    // Extract the full text and structured data
    const fullText = result.fullTextAnnotation.text;
    const pages = result.fullTextAnnotation.pages || [];
    const blocks = pages.flatMap(page => page.blocks || []);
    const paragraphs = blocks.flatMap(block => block.paragraphs || []);
    const words = paragraphs.flatMap(paragraph => paragraph.words || []);
    
    console.log('=== OCR EXTRACTION RESULTS ===');
    console.log('Full text length:', fullText.length);
    console.log('Number of blocks:', blocks.length);
    console.log('Number of paragraphs:', paragraphs.length);
    console.log('Number of words:', words.length);
    console.log('Raw extracted text:');
    console.log(fullText);
    console.log('=== END OCR RESULTS ===');

    // Intelligent data extraction with enhanced logging
    console.log('=== STARTING DATA EXTRACTION ===');
    const extractedDate = extractDate(fullText);
    const extractedTotal = extractTotal(fullText);
    const extractedMerchant = extractMerchant(fullText); // Used only for category suggestion
    
    // Use merchant name to suggest category, but don't store merchant or location
    const merchantBasedCategory = extractedMerchant ? suggestCategory(extractedMerchant) : null;
    const textBasedCategory = suggestCategory(fullText);
    const suggestedCategory = merchantBasedCategory || textBasedCategory;
    
    console.log('=== EXTRACTION SUMMARY ===');
    console.log('Date:', extractedDate);
    console.log('Total:', extractedTotal);
    console.log('Merchant (for category only):', extractedMerchant);
    console.log('Suggested Category:', suggestedCategory);
    console.log('=== END EXTRACTION SUMMARY ===');

    // Parse and extract structured data (simplified - only store essential fields)
    const extractedData = {
      date: extractedDate,
      total: extractedTotal,
      suggestedCategory: suggestedCategory,
      extractedAt: new Date().toISOString(),
      ocrMethod: 'DOCUMENT_TEXT_DETECTION'
    };

    // Update the receipt document with extracted data (only essential fields)
    const updateData = {
      extractedData: extractedData,
      processedAt: admin.firestore.FieldValue.serverTimestamp(),
      status: 'processed'
    };

    // Add only essential extracted fields to the main receipt document
    if (extractedDate) updateData.date = extractedDate;
    if (extractedTotal) updateData.total = extractedTotal;
    if (suggestedCategory) updateData.suggestedCategory = suggestedCategory;
    
    await db.collection('receipts').doc(receiptId).update(updateData);

    console.log('Receipt processed successfully:', {
      receiptId,
      date: extractedDate,
      total: extractedTotal,
      category: suggestedCategory
    });

    return {
      success: true,
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
