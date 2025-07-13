# Receipt Manager

A modern web application for managing and organizing receipts, built with React and Firebase.

## Features

- 🔐 **Firebase Authentication** - Secure email/password login
- 📄 **Receipt Storage** - Upload and store receipt images
- 🔍 **Search & Filter** - Find receipts quickly
- 📊 **Analytics** - Track spending patterns
- 📱 **Responsive Design** - Works on all devices
- 🔒 **Data Isolation** - Each user's data is completely isolated

## Setup Instructions

### 1. Firebase Project Setup

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a new project called "Receipt Manager"
3. Enable the following services:
   - **Authentication** (Email/Password provider)
   - **Firestore Database**
   - **Storage**
   - **Hosting**

### 2. Get Firebase Configuration

1. In your Firebase project, go to Project Settings
2. Scroll down to "Your apps" and click "Add app" → Web
3. Register your app with nickname "Receipt Manager"
4. Copy the Firebase configuration object
5. Replace the placeholder values in `src/firebase.js` with your actual config

### 3. Deploy Security Rules

```bash
# Login to Firebase (if not already logged in)
npx firebase login

# Initialize Firebase in your project
npx firebase init

# Deploy Firestore security rules
npx firebase deploy --only firestore:rules

# Deploy Storage security rules
npx firebase deploy --only storage
```

### 4. Install Dependencies & Run

```bash
# Install dependencies
npm install

# Start development server
npm start
```

The app will open at [http://localhost:3000](http://localhost:3000)

### 5. Deploy to Firebase Hosting

```bash
# Build the app
npm run build

# Deploy to Firebase Hosting
npx firebase deploy --only hosting
```

## Project Structure

```
src/
├── components/
│   ├── Login.js          # Authentication component
│   ├── Login.css         # Login styles
│   ├── Dashboard.js      # Main dashboard
│   └── Dashboard.css     # Dashboard styles
├── contexts/
│   └── AuthContext.js    # Authentication context
├── firebase.js           # Firebase configuration
├── App.js               # Main app component
└── App.css              # Global styles
```

## Security Features

- **Firestore Rules**: Users can only access their own data
- **Storage Rules**: Users can only access files in their own folders
- **Authentication**: Email/password authentication required
- **Data Isolation**: Each user's receipts are stored under their user ID

## Available Scripts

- `npm start` - Run development server
- `npm run build` - Build for production
- `npm test` - Run tests
- `npx firebase deploy` - Deploy to Firebase

## Next Steps

The basic authentication and homepage are complete. You can now:

1. Add receipt upload functionality
2. Implement receipt listing and search
3. Add spending analytics
4. Enhance the UI with more features

## Support

If you encounter any issues during setup, please check:
- Firebase project configuration
- Security rules deployment
- Authentication provider settings

### Code Splitting

This section has moved here: [https://facebook.github.io/create-react-app/docs/code-splitting](https://facebook.github.io/create-react-app/docs/code-splitting)

### Analyzing the Bundle Size

This section has moved here: [https://facebook.github.io/create-react-app/docs/analyzing-the-bundle-size](https://facebook.github.io/create-react-app/docs/analyzing-the-bundle-size)

### Making a Progressive Web App

This section has moved here: [https://facebook.github.io/create-react-app/docs/making-a-progressive-web-app](https://facebook.github.io/create-react-app/docs/making-a-progressive-web-app)

### Advanced Configuration

This section has moved here: [https://facebook.github.io/create-react-app/docs/advanced-configuration](https://facebook.github.io/create-react-app/docs/advanced-configuration)

### Deployment

This section has moved here: [https://facebook.github.io/create-react-app/docs/deployment](https://facebook.github.io/create-react-app/docs/deployment)

### `npm run build` fails to minify

This section has moved here: [https://facebook.github.io/create-react-app/docs/troubleshooting#npm-run-build-fails-to-minify](https://facebook.github.io/create-react-app/docs/troubleshooting#npm-run-build-fails-to-minify)
