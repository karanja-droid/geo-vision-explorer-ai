import React, { useEffect, useRef, useState } from 'react';
import { Loader2, AlertCircle, Download, Maximize2, Minimize2 } from 'lucide-react';

interface AdobePdfViewerProps {
  fileUrl: string;
  fileName: string;
  className?: string;
  onLoad?: () => void;
  onError?: (error: string) => void;
}

declare global {
  interface Window {
    AdobeDC?: {
      View: new (config: any) => {
        previewFile: (config: any, options?: any) => Promise<any>;
        registerCallback: (type: string, callback: Function) => void;
      };
    };
  }
}

export function AdobePdfViewer({ 
  fileUrl, 
  fileName, 
  className = '',
  onLoad,
  onError 
}: AdobePdfViewerProps) {
  const viewerRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [adobeView, setAdobeView] = useState<any>(null);

  useEffect(() => {
    let mounted = true;

    const loadAdobeSDK = async () => {
      try {
        // Check if Adobe SDK is already loaded
        if (window.AdobeDC) {
          await initializeViewer();
          return;
        }

        // Load Adobe SDK
        const script = document.createElement('script');
        script.src = 'https://acrobatservices.adobe.com/view-sdk/viewer.js';
        script.onload = async () => {
          if (mounted) {
            await initializeViewer();
          }
        };
        script.onerror = () => {
          if (mounted) {
            const errorMsg = 'Failed to load Adobe PDF SDK';
            setError(errorMsg);
            setIsLoading(false);
            onError?.(errorMsg);
          }
        };
        document.head.appendChild(script);

        return () => {
          if (script.parentNode) {
            script.parentNode.removeChild(script);
          }
        };
      } catch (err) {
        if (mounted) {
          const errorMsg = `Error loading Adobe SDK: ${err}`;
          setError(errorMsg);
          setIsLoading(false);
          onError?.(errorMsg);
        }
      }
    };

    const initializeViewer = async () => {
      try {
        if (!window.AdobeDC || !viewerRef.current) {
          return;
        }

        const clientId = import.meta.env.VITE_ADOBE_CLIENT_ID;
        if (!clientId) {
          throw new Error('Adobe Client ID not configured');
        }

        // Clear any existing content
        viewerRef.current.innerHTML = '';

        // Create Adobe DC View instance
        const adobeDCView = new window.AdobeDC.View({
          clientId: clientId,
          divId: viewerRef.current.id || 'adobe-dc-view'
        });

        setAdobeView(adobeDCView);

        // Configure viewer options
        const previewConfig = {
          content: { location: { url: fileUrl } },
          metaData: { fileName: fileName }
        };

        const viewerConfig = {
          embedMode: 'SIZED_CONTAINER',
          showAnnotationTools: false,
          showLeftHandPanel: true,
          showDownloadPDF: true,
          showPrintPDF: true,
          showZoomControl: true,
          enableFormFilling: false,
          enableSearchAPIs: true,
          includePDFAnnotations: false
        };

        // Register callbacks
        adobeDCView.registerCallback('DOCUMENT_LOAD', () => {
          if (mounted) {
            setIsLoading(false);
            setError(null);
            onLoad?.();
          }
        });

        adobeDCView.registerCallback('DOCUMENT_ERROR', (error: any) => {
          if (mounted) {
            const errorMsg = `PDF load error: ${error.message || 'Unknown error'}`;
            setError(errorMsg);
            setIsLoading(false);
            onError?.(errorMsg);
          }
        });

        // Load the PDF
        await adobeDCView.previewFile(previewConfig, viewerConfig);

      } catch (err) {
        if (mounted) {
          const errorMsg = `Error initializing PDF viewer: ${err}`;
          setError(errorMsg);
          setIsLoading(false);
          onError?.(errorMsg);
        }
      }
    };

    loadAdobeSDK();

    return () => {
      mounted = false;
    };
  }, [fileUrl, fileName, onLoad, onError]);

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = fileUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  const viewerId = `adobe-dc-view-${Math.random().toString(36).substr(2, 9)}`;

  if (error) {
    return (
      <div className={`flex flex-col items-center justify-center p-8 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300 ${className}`}>
        <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
        <h3 className="text-lg font-semibold text-gray-900 mb-2">PDF Viewer Error</h3>
        <p className="text-sm text-gray-600 text-center mb-4">{error}</p>
        <button
          onClick={handleDownload}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Download className="w-4 h-4" />
          Download PDF
        </button>
      </div>
    );
  }

  return (
    <div className={`relative ${isFullscreen ? 'fixed inset-0 z-50 bg-white' : className}`}>
      {/* Toolbar */}
      <div className="flex items-center justify-between p-2 bg-gray-100 border-b">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-700">{fileName}</span>
          {isLoading && (
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading PDF...
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleDownload}
            className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-200 rounded transition-colors"
            title="Download PDF"
          >
            <Download className="w-4 h-4" />
          </button>
          <button
            onClick={toggleFullscreen}
            className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-200 rounded transition-colors"
            title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* PDF Viewer Container */}
      <div className="relative">
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-50 z-10">
            <div className="flex flex-col items-center gap-4">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
              <p className="text-sm text-gray-600">Loading PDF viewer...</p>
            </div>
          </div>
        )}
        
        <div
          id={viewerId}
          ref={viewerRef}
          className={`w-full ${isFullscreen ? 'h-screen' : 'h-96 min-h-96'}`}
          style={{ minHeight: isFullscreen ? '100vh' : '400px' }}
        />
      </div>
    </div>
  );
}

// Hook for feature flag check
export function useAdobeViewerEnabled(): boolean {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    // Check if Adobe viewer is enabled via feature flag
    const checkFeatureFlag = async () => {
      try {
        const response = await fetch('/api/v1/feature-flags/FEATURE_ADOBE_VIEW');
        if (response.ok) {
          const data = await response.json();
          setEnabled(data.enabled);
        }
      } catch (error) {
        console.warn('Failed to check Adobe viewer feature flag:', error);
        // Default to enabled if we can't check the flag
        setEnabled(true);
      }
    };

    checkFeatureFlag();
  }, []);

  return enabled;
}

// Fallback PDF viewer component
export function FallbackPdfViewer({ fileUrl, fileName, className = '' }: AdobePdfViewerProps) {
  return (
    <div className={`flex flex-col items-center justify-center p-8 bg-gray-50 rounded-lg border ${className}`}>
      <div className="text-center">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">PDF Document</h3>
        <p className="text-sm text-gray-600 mb-4">{fileName}</p>
        <div className="flex gap-2">
          <a
            href={fileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Download className="w-4 h-4" />
            View PDF
          </a>
          <a
            href={fileUrl}
            download={fileName}
            className="inline-flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
          >
            <Download className="w-4 h-4" />
            Download
          </a>
        </div>
      </div>
    </div>
  );
}

// Smart PDF viewer that uses Adobe or fallback
export function SmartPdfViewer(props: AdobePdfViewerProps) {
  const adobeEnabled = useAdobeViewerEnabled();
  const hasAdobeClientId = !!import.meta.env.VITE_ADOBE_CLIENT_ID;

  if (adobeEnabled && hasAdobeClientId) {
    return <AdobePdfViewer {...props} />;
  } else {
    return <FallbackPdfViewer {...props} />;
  }
}