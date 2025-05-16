"use client";

import { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '../components/DemoComponents';

interface CameraModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCaptureSuccess: (imageDataUrl: string, mealType: 'breakfast' | 'lunch' | 'supper') => void;
  mealType: 'breakfast' | 'lunch' | 'supper' | null;
}

export default function CameraModal({ isOpen, onClose, onCaptureSuccess, mealType }: CameraModalProps) {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isCaptureLoading, setIsCaptureLoading] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

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
  }, [isOpen]);

  // Start camera function
  const startCamera = async () => {
    setError(null);
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' } // Use back camera if available
      });
      
      setStream(mediaStream);
      
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err: any) {
      console.error('Error accessing camera:', err);
      setError(`Camera access error: ${err.message || 'Unknown error'}`);
    }
  };

  // Stop camera function
  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  // Capture image function
  const captureImage = useCallback(() => {
    if (!mealType) {
      setError('No meal type selected');
      return;
    }
    
    setIsCaptureLoading(true);
    
    try {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      
      if (!video || !canvas) {
        throw new Error('Video or canvas element not available');
      }
      
      const context = canvas.getContext('2d');
      if (!context) {
        throw new Error('Could not get canvas context');
      }
      
      // Set canvas dimensions to match video
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      // Draw the current video frame to the canvas
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      // Convert canvas to data URL
      const imageDataUrl = canvas.toDataURL('image/jpeg', 0.8);
      
      // Pass the image data to the parent component
      onCaptureSuccess(imageDataUrl, mealType);
      
      // Close the modal
      onClose();
    } catch (err: any) {
      console.error('Error capturing image:', err);
      setError(`Capture error: ${err.message || 'Unknown error'}`);
    } finally {
      setIsCaptureLoading(false);
    }
  }, [mealType, onCaptureSuccess, onClose]);

  // If modal is not open, don't render anything
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4 overflow-hidden">
        <div className="p-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">
            {mealType ? `📸 Capture ${mealType.charAt(0).toUpperCase() + mealType.slice(1)}` : 'Camera'}
          </h3>
        </div>
        
        <div className="relative bg-black">
          {/* Video element for camera feed */}
          <video 
            ref={videoRef}
            autoPlay 
            playsInline 
            className="w-full h-64 object-cover"
          />
          
          {/* Hidden canvas for capturing frames */}
          <canvas ref={canvasRef} className="hidden" />
          
          {/* Error message */}
          {error && (
            <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-75">
              <div className="text-white text-center p-4">
                <p className="mb-2">{error}</p>
                <Button 
                  variant="secondary" 
                  onClick={startCamera}
                >
                  Retry Camera
                </Button>
              </div>
            </div>
          )}
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