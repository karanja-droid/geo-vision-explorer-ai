import React, { useState } from 'react';
import { HelpCircle, Search, Book, MessageCircle } from 'lucide-react';
import { useContextualHelp } from '@/hooks/useContextualHelp';
import { HelpSearchDialog } from './HelpSearchDialog';

interface HelpButtonProps {
  contentId?: string;
  variant?: 'floating' | 'inline' | 'icon';
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
  showSearch?: boolean;
  className?: string;
}

export function HelpButton({ 
  contentId, 
  variant = 'floating',
  position = 'bottom-right',
  showSearch = true,
  className = ''
}: HelpButtonProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const { showHelp, getContextualHelp } = useContextualHelp(contentId);

  const handleHelpClick = () => {
    if (contentId) {
      showHelp();
    } else {
      setIsMenuOpen(!isMenuOpen);
    }
  };

  const handleSearchClick = () => {
    setIsSearchOpen(true);
    setIsMenuOpen(false);
  };

  const handleContextualHelpClick = () => {
    const contextualHelp = getContextualHelp();
    if (contextualHelp.length > 0) {
      showHelp(contextualHelp[0].id);
    }
    setIsMenuOpen(false);
  };

  const getPositionClasses = () => {
    switch (position) {
      case 'bottom-right':
        return 'bottom-6 right-6';
      case 'bottom-left':
        return 'bottom-6 left-6';
      case 'top-right':
        return 'top-6 right-6';
      case 'top-left':
        return 'top-6 left-6';
      default:
        return 'bottom-6 right-6';
    }
  };

  if (variant === 'icon') {
    return (
      <>
        <button
          onClick={handleHelpClick}
          className={`p-2 text-gray-500 hover:text-gray-700 transition-colors ${className}`}
          title="Get help"
        >
          <HelpCircle className="w-5 h-5" />
        </button>
        {showSearch && (
          <HelpSearchDialog 
            isOpen={isSearchOpen} 
            onClose={() => setIsSearchOpen(false)} 
          />
        )}
      </>
    );
  }

  if (variant === 'inline') {
    return (
      <>
        <button
          onClick={handleHelpClick}
          className={`inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors ${className}`}
        >
          <HelpCircle className="w-4 h-4" />
          Help
        </button>
        {showSearch && (
          <HelpSearchDialog 
            isOpen={isSearchOpen} 
            onClose={() => setIsSearchOpen(false)} 
          />
        )}
      </>
    );
  }

  // Floating variant
  return (
    <>
      <div className={`fixed ${getPositionClasses()} z-40`}>
        {/* Help Menu */}
        {isMenuOpen && (
          <div className="absolute bottom-16 right-0 mb-2 w-64 bg-white rounded-lg shadow-lg border border-gray-200 py-2">
            <div className="px-4 py-2 border-b border-gray-100">
              <h3 className="font-medium text-gray-900">Need Help?</h3>
              <p className="text-sm text-gray-600">Choose an option below</p>
            </div>
            
            {showSearch && (
              <button
                onClick={handleSearchClick}
                className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors"
              >
                <Search className="w-5 h-5 text-blue-600" />
                <div>
                  <div className="font-medium text-gray-900">Search Help</div>
                  <div className="text-sm text-gray-600">Find answers quickly</div>
                </div>
              </button>
            )}
            
            <button
              onClick={handleContextualHelpClick}
              className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors"
            >
              <Book className="w-5 h-5 text-green-600" />
              <div>
                <div className="font-medium text-gray-900">Contextual Help</div>
                <div className="text-sm text-gray-600">Help for this page</div>
              </div>
            </button>
            
            <button
              onClick={() => {
                // This would open a contact form or chat
                console.log('Contact support clicked');
                setIsMenuOpen(false);
              }}
              className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors"
            >
              <MessageCircle className="w-5 h-5 text-purple-600" />
              <div>
                <div className="font-medium text-gray-900">Contact Support</div>
                <div className="text-sm text-gray-600">Get personal help</div>
              </div>
            </button>
          </div>
        )}

        {/* Main Help Button */}
        <button
          onClick={handleHelpClick}
          className={`w-14 h-14 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center group ${className}`}
          title="Get help"
        >
          <HelpCircle className="w-6 h-6 group-hover:scale-110 transition-transform" />
        </button>
      </div>

      {/* Backdrop */}
      {isMenuOpen && (
        <div 
          className="fixed inset-0 z-30"
          onClick={() => setIsMenuOpen(false)}
        />
      )}

      {showSearch && (
        <HelpSearchDialog 
          isOpen={isSearchOpen} 
          onClose={() => setIsSearchOpen(false)} 
        />
      )}
    </>
  );
}

// Quick help trigger for specific actions
export function useHelpTrigger() {
  return {
    triggerHelp: (action: string) => {
      document.dispatchEvent(new CustomEvent(`help:${action}`));
    }
  };
}