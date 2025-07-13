import React, { useState, useRef } from 'react';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { storage, db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import './ReceiptUpload.css';

export default function ReceiptUpload() {
  const { currentUser } = useAuth();
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploads, setUploads] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);

  // Handle file selection
  const handleFiles = (files) => {
    const fileArray = Array.from(files);
    const imageFiles = fileArray.filter(file => 
      file.type.startsWith('image/') && file.size > 0
    );

    if (imageFiles.length === 0) {
      alert('Please select valid image files (JPG, PNG, etc.)');
      return;
    }

    if (imageFiles.length !== fileArray.length) {
      alert(`${fileArray.length - imageFiles.length} non-image files were skipped`);
    }

    uploadFiles(imageFiles);
  };

  // Upload files to Firebase Storage
  const uploadFiles = async (files) => {
    setIsUploading(true);
    const uploadPromises = files.map((file, index) => uploadSingleFile(file, index));
    
    try {
      await Promise.all(uploadPromises);
      // Show success message after all uploads complete
      setTimeout(() => {
        setUploads([]);
        setIsUploading(false);
      }, 2000);
    } catch (error) {
      console.error('Upload error:', error);
      setIsUploading(false);
    }
  };

  // Upload single file with progress tracking
  const uploadSingleFile = (file, index) => {
    return new Promise((resolve, reject) => {
      const timestamp = Date.now();
      const fileName = `${timestamp}_${file.name}`;
      const storageRef = ref(storage, `receipts/${currentUser.uid}/${fileName}`);
      const uploadTask = uploadBytesResumable(storageRef, file);

      // Initialize upload state
      const uploadInfo = {
        id: `${index}_${timestamp}`,
        name: file.name,
        size: file.size,
        progress: 0,
        status: 'uploading',
        error: null
      };

      setUploads(prev => [...prev, uploadInfo]);

      uploadTask.on(
        'state_changed',
        (snapshot) => {
          // Progress tracking
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          setUploads(prev => prev.map(upload => 
            upload.id === uploadInfo.id 
              ? { ...upload, progress: Math.round(progress) }
              : upload
          ));
        },
        (error) => {
          // Handle upload error
          console.error('Upload failed:', error);
          setUploads(prev => prev.map(upload => 
            upload.id === uploadInfo.id 
              ? { ...upload, status: 'error', error: error.message }
              : upload
          ));
          reject(error);
        },
        async () => {
          // Upload completed successfully
          try {
            const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
            
            // Save receipt metadata to Firestore
            const docRef = await addDoc(collection(db, 'receipts'), {
              userId: currentUser.uid,
              fileName: file.name,
              originalName: file.name,
              size: file.size,
              storageUrl: downloadURL,
              storagePath: `receipts/${currentUser.uid}/${fileName}`,
              uploadedAt: serverTimestamp(),
              createdAt: serverTimestamp()
            });

            setUploads(prev => prev.map(upload => 
              upload.id === uploadInfo.id 
                ? { ...upload, status: 'completed', progress: 100 }
                : upload
            ));
            
            // Automatically trigger OCR processing
            try {
              console.log('Starting OCR processing for receipt:', docRef.id);
              console.log('Current user:', currentUser?.uid);
              console.log('Image URL:', downloadURL);
              
              const functions = getFunctions();
              const processReceipt = httpsCallable(functions, 'processReceipt');
              
              setUploads(prev => prev.map(upload => 
                upload.id === uploadInfo.id 
                  ? { ...upload, status: 'processing', progress: 100 }
                  : upload
              ));
              
              const result = await processReceipt({
                imageUrl: downloadURL,
                receiptId: docRef.id
              });
              
              console.log('OCR processing completed successfully:', result.data);
              
              setUploads(prev => prev.map(upload => 
                upload.id === uploadInfo.id 
                  ? { ...upload, status: 'ocr-completed', progress: 100, ocrData: result.data }
                  : upload
              ));
              
            } catch (ocrError) {
              console.error('OCR processing failed:', ocrError);
              console.error('Error details:', {
                code: ocrError.code,
                message: ocrError.message,
                details: ocrError.details
              });
              
              let errorMessage = 'OCR processing failed';
              if (ocrError.code === 'unauthenticated') {
                errorMessage = 'Authentication required - please log in';
              } else if (ocrError.message) {
                errorMessage = ocrError.message;
              }
              
              setUploads(prev => prev.map(upload => 
                upload.id === uploadInfo.id 
                  ? { ...upload, status: 'ocr-failed', progress: 100, error: errorMessage }
                  : upload
              ));
            }
            
            resolve(downloadURL);
          } catch (error) {
            console.error('Failed to save receipt metadata:', error);
            setUploads(prev => prev.map(upload => 
              upload.id === uploadInfo.id 
                ? { ...upload, status: 'error', error: 'Failed to save receipt data' }
                : upload
            ));
            reject(error);
          }
        }
      );
    });
  };

  // Drag and drop handlers
  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    const files = e.dataTransfer.files;
    handleFiles(files);
  };

  // File input handler
  const handleFileInput = (e) => {
    const files = e.target.files;
    if (files.length > 0) {
      handleFiles(files);
    }
  };

  // Camera capture handler
  const handleCameraCapture = (e) => {
    const files = e.target.files;
    if (files.length > 0) {
      handleFiles(files);
    }
  };

  // Open camera
  const openCamera = () => {
    if (!isUploading) {
      cameraInputRef.current?.click();
    }
  };

  // Open file browser
  const openFileBrowser = () => {
    if (!isUploading) {
      fileInputRef.current?.click();
    }
  };

  // Format file size
  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="receipt-upload">
      <div className="upload-header">
        <h3>Capture Receipt Photos</h3>
        <p>Take a photo with your camera or upload existing images</p>
      </div>

      {/* Camera Button - Primary Action */}
      <div className="camera-section">
        <button 
          className={`camera-btn ${isUploading ? 'disabled' : ''}`}
          onClick={openCamera}
          disabled={isUploading}
        >
          <div className="camera-icon">📷</div>
          <div className="camera-text">
            <strong>Take Photo</strong>
            <span>Capture receipt with camera</span>
          </div>
        </button>
      </div>

      {/* Secondary Upload Options */}
      <div className="upload-options">
        <div className="option-divider">
          <span>or</span>
        </div>
        
        <div className="upload-buttons">
          <button 
            className={`upload-btn ${isUploading ? 'disabled' : ''}`}
            onClick={openFileBrowser}
            disabled={isUploading}
          >
            📁 Browse Files
          </button>
        </div>
        
        <div 
          className={`drag-area ${isDragOver ? 'drag-over' : ''} ${isUploading ? 'uploading' : ''}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <div className="drag-content">
            <div className="drag-icon">⬇️</div>
            <div className="drag-text">Drop images here</div>
          </div>
        </div>
      </div>
        
      {/* Hidden File Inputs */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleCameraCapture}
        style={{ display: 'none' }}
      />
      
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*"
        onChange={handleFileInput}
        style={{ display: 'none' }}
      />

      {/* Upload Progress */}
      {uploads.length > 0 && (
        <div className="upload-progress">
          <div className="progress-header">
            <h4>Processing Progress ({uploads.filter(u => u.status === 'ocr-completed' || u.status === 'completed').length}/{uploads.length})</h4>
          </div>
          
          <div className="progress-list">
            {uploads.map((upload) => (
              <div key={upload.id} className={`progress-item ${upload.status}`}>
                <div className="file-info">
                  <div className="file-name">{upload.name}</div>
                  <div className="file-size">{formatFileSize(upload.size)}</div>
                </div>
                
                <div className="progress-bar-container">
                  <div className="progress-bar">
                    <div 
                      className="progress-fill"
                      style={{ width: `${upload.progress}%` }}
                    ></div>
                  </div>
                  <div className="progress-text">
                    {upload.status === 'uploading' && `📤 ${upload.progress}%`}
                    {upload.status === 'completed' && '📄 Uploaded'}
                    {upload.status === 'processing' && '🔍 Processing OCR...'}
                    {upload.status === 'ocr-completed' && '✅ Complete'}
                    {upload.status === 'ocr-failed' && '⚠️ OCR Failed'}
                    {upload.status === 'error' && '❌ Failed'}
                  </div>
                </div>
                
                {upload.error && (
                  <div className="error-message">{upload.error}</div>
                )}
                
                {upload.status === 'ocr-completed' && upload.ocrData && (
                  <div className="ocr-summary">
                    <div className="ocr-data">
                      {upload.ocrData.extractedData?.total && (
                        <span className="ocr-item">💰 ${upload.ocrData.extractedData.total}</span>
                      )}
                      {upload.ocrData.extractedData?.date && (
                        <span className="ocr-item">📅 {upload.ocrData.extractedData.date}</span>
                      )}
                      {upload.ocrData.extractedData?.location && (
                        <span className="ocr-item">📍 {typeof upload.ocrData.extractedData.location === 'string' ? upload.ocrData.extractedData.location : upload.ocrData.extractedData.location?.full || 'Unknown'}</span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
          
          {uploads.every(u => u.status === 'ocr-completed' || u.status === 'ocr-failed' || u.status === 'error') && (
            <div className="success-message">
              {uploads.some(u => u.status === 'ocr-completed') && '🎉 Receipts processed with OCR!'}
              {uploads.every(u => u.status === 'ocr-failed' || u.status === 'error') && '⚠️ Some receipts had processing issues'}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
