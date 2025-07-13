const functions = require('firebase-functions');

// Simple health check function
exports.api = functions.https.onRequest((req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'Receipt Manager Cloud Functions',
    timestamp: new Date().toISOString()
  });
});

// Simple callable function for testing
exports.hello = functions.https.onCall((data, context) => {
  return {
    message: 'Hello from Firebase Functions!',
    data: data,
    user: context.auth ? context.auth.uid : 'anonymous'
  };
});
