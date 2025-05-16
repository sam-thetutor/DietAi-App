// @ts-nocheck
"use client";

import { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '../components/DemoComponents';

export default function CameraModal({ isOpen, onClose, onCaptureSuccess, mealType }) {
  const [stream, setStream] = useState(null);
  const [error, setError] = useState(null);
  const [isCaptureLoading, setIsCaptureLoading] = useState(false);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  // Function to stop the camera
  const stopCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  }, [stream]);

  // Start camera when modal opens
  useEffect(() => {
    if (isOpen) {
      startCamera();
    } else {
      stopCamera();
    }
    
    return () => {
      stopCamera();
    };
  }, [isOpen, stopCamera]);

  // Function to start the camera with better error handling
  const startCamera = async () => {
    try {
      setError(null);
      console.log("Requesting camera access...");
      
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Your browser doesn't support camera access");
      }
      
      // Try with simpler constraints first
      const mediaStream = await navigator.mediaDevices.getUserMedia({ 
        video: true,
        audio: false
      });
      
      console.log("Camera access granted:", mediaStream.getVideoTracks().length > 0);
      setStream(mediaStream);
      
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        console.log("Video element updated with stream");
      }
    } catch (err) {
      console.error("Error accessing camera:", err);
      setError(`Camera access error: ${err.message || "Unknown error"}`);
    }
  };

  // Function to capture image
  const captureImage = () => {
    if (!videoRef.current || !canvasRef.current || !mealType) return;
    
    setIsCaptureLoading(true);
    
    try {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');
      
      if (!context) {
        throw new Error('Could not get canvas context');
      }
      
      // Set canvas dimensions to match video
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      // Draw the video frame to the canvas
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      // Convert canvas to data URL
      const imageDataUrl = canvas.toDataURL('image/jpeg', 0.8);
      
      // Pass the image data to the parent component
      onCaptureSuccess(imageDataUrl, mealType);
      
      // Close the modal
      onClose();
    } catch (err) {
      console.error('Error capturing image:', err);
      setError(`Capture error: ${err.message || 'Unknown error'}`);
    } finally {
      setIsCaptureLoading(false);
    }
  };

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center ${isOpen ? 'visible' : 'invisible'}`}>
      <div className="fixed inset-0 bg-black opacity-50" onClick={onClose}></div>
      
      <div className="bg-white rounded-lg shadow-xl z-10 w-full max-w-md overflow-hidden">
        <div className="p-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">
            Take a photo of your {mealType} meal
          </h3>
        </div>
        
        <div className="relative">
          {error && (
            <div className="p-4 bg-red-50 border-l-4 border-red-500 text-red-700">
              <p>{error}</p>
              <p className="text-sm mt-2">
                Please check your browser settings and ensure camera access is allowed.
              </p>
            </div>
          )}
          
          <video 
            ref={videoRef}
            autoPlay 
            playsInline 
            className="w-full h-64 object-cover bg-black"
          />
          
          <canvas ref={canvasRef} className="hidden" />
        </div>
        
        <div className="p-4 flex justify-between">
          <Button 
            variant="outline" 
            onClick={onClose}
            disabled={isCaptureLoading}
          >
            Cancel
          </Button>
          
          <Button 
            variant="primary" 
            onClick={captureImage}
            disabled={!stream || isCaptureLoading}
          >
            {isCaptureLoading ? (
              <span className="flex items-center">
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Processing...
              </span>
            ) : 'Capture'}
          </Button>
        </div>
      </div>
    </div>
  );
}