# 📄 Receipt Manager

A comprehensive web application for managing receipts, expenses, and business trips with AI-powered OCR processing.

## 🌟 Features

### 📸 **Receipt Processing**
- Upload receipt images via camera or file selection
- AI-powered OCR extraction using Google Cloud Vision API
- Automatic extraction of total, date, location, and merchant info
- Manual editing and correction of extracted data

### ✏️ **Receipt Management**
- View all receipts in a responsive grid layout
- Click-to-edit functionality for any receipt
- Real-time updates to receipt information
- Delete receipts with confirmation

### 🧳 **Trip Management**
- Automatic trip detection based on location differences
- Manual trip creation and management
- Assign receipts to specific trips
- Track trip expenses and totals
- View unassigned receipts

### 🔐 **Security & Authentication**
- Firebase Authentication with email/password
- Complete user data isolation
- Secure access code system ("jasonhan")
- Server-side OCR processing for security

### 📱 **Modern UI/UX**
- Responsive design for mobile and desktop
- Modern card-based interface
- Loading states and error handling
- Smooth animations and transitions

## 🛠 Tech Stack

- **Frontend**: React with Hooks, Modern CSS
- **Backend**: Firebase (Auth, Firestore, Storage, Functions, Hosting)
- **OCR**: Google Cloud Vision API
- **Authentication**: react-firebase-hooks
- **Deployment**: Firebase Hosting

## 🚀 Live Demo

Visit the live app: **https://receipt-manager-2c61b.web.app**

Use access code: `jasonhan`

## 📁 Project Structure

```
receipt-manager/
├── src/
│   ├── components/
│   │   ├── Dashboard.js          # Main dashboard with tabs
│   │   ├── ReceiptUpload.js      # Receipt upload interface
│   │   ├── ReceiptList.js        # Receipt display and editing
│   │   ├── ReceiptProcessor.js   # OCR processing component
│   │   ├── TripManager.js        # Trip management interface
│   │   ├── ReceiptConfirmationForm.js # OCR data confirmation
│   │   └── ErrorBoundary.js      # Error handling
│   ├── contexts/
│   │   └── AuthContext.js        # Authentication context
│   └── firebase.js               # Firebase configuration
├── functions/
│   └── index.js                  # Firebase Cloud Functions
├── public/
└── firebase.json                 # Firebase configuration
```

## 🔧 Setup Instructions

### 1. Clone the Repository

```bash
git clone https://github.com/jasonshiwoo/receipt-manager.git
cd receipt-manager
```

### 2. Install Dependencies

```bash
npm install
cd functions && npm install && cd ..
```

### 3. Firebase Setup

1. Create a Firebase project at [Firebase Console](https://console.firebase.google.com/)
2. Enable Authentication, Firestore, Storage, Functions, and Hosting
3. Get your Firebase configuration:
   - Go to Project Settings → General → Your apps
   - Copy the Firebase configuration object
4. Create a `.env` file in the project root:
   ```bash
   REACT_APP_FIREBASE_API_KEY=your_api_key_here
   REACT_APP_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
   REACT_APP_FIREBASE_PROJECT_ID=your_project_id
   REACT_APP_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
   REACT_APP_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
   REACT_APP_FIREBASE_APP_ID=your_app_id
   REACT_APP_FIREBASE_MEASUREMENT_ID=your_measurement_id
   ```
5. **NEVER commit the `.env` file to version control**

### 4. Google Cloud Vision Setup

1. Enable Google Cloud Vision API in your Firebase project
2. Set up service account credentials
3. Deploy Firebase Functions with Vision API access

### 5. Deploy

```bash
# Build the app
npm run build

# Deploy to Firebase
firebase deploy
```

## 🎯 Usage

1. **Login**: Use access code "jasonhan" to create account
2. **Upload Receipts**: Take photos or upload receipt images
3. **Review OCR**: Confirm and edit extracted information
4. **Manage Trips**: Create trips and assign receipts
5. **Edit Receipts**: Click any receipt to edit details
6. **Track Expenses**: View totals and analytics

## 🔒 Security Features

- **User Isolation**: Each user's data is completely isolated
- **Firestore Rules**: Server-side security rules prevent unauthorized access
- **Storage Rules**: Receipt images are user-specific
- **Server-side OCR**: Sensitive processing happens on secure servers

## 🌐 Firebase Services Used

- **Authentication**: Email/password with access code
- **Firestore**: Real-time database for receipts and trips
- **Storage**: Secure image storage
- **Functions**: Server-side OCR processing
- **Hosting**: Static web hosting

## 📱 Mobile Support

- Responsive design works on all screen sizes
- Camera integration for mobile receipt capture
- Touch-friendly interface
- Progressive Web App capabilities

## 🐛 Error Handling

- Comprehensive error boundaries
- Loading states for all operations
- Graceful fallbacks for failed operations
- User-friendly error messages

## 🔄 Real-time Updates

- Live receipt list updates
- Real-time trip expense calculations
- Instant UI updates after edits
- Synchronized data across devices

## 📊 Analytics Ready

- Trip expense tracking
- Receipt categorization
- Date-based filtering
- Export capabilities (future feature)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License.

## 🆘 Support

For issues or questions:
1. Check the Firebase Console for errors
2. Review the browser console for client-side issues
3. Check Firebase Functions logs for server-side issues

---

Built with ❤️ using React and Firebase
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
=======
# receipt-manager
>>>>>>> 1c04fa932fab45e06eccd61326dfbd45d81d1686
