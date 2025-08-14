import React, { useState, useEffect, useRef } from 'react';
import { Search, X, HelpCircle, BookOpen, Lightbulb, Users } from 'lucide-react';
import { useHelpSearch } from '@/hooks/useContextualHelp';
import { HelpSearchResult } from '@/lib/contextual-help';

interface HelpSearchDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export function HelpSearchDialog({ isOpen, onClose }: HelpSearchDialogProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<HelpSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const { search } = useHelpSearch();

  // Focus search input when dialog opens
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen]);

  // Perform search with debouncing
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    setIsSearching(true);
    const timer = setTimeout(() => {
      const searchResults = search(query);
      setResults(searchResults);
      setIsSearching(false);
    }, 300);

    return () => clearTimeout(timer);
  }, [query, search]);

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'geological':
        return <Lightbulb className="w-4 h-4" />;
      case 'ui':
        return <BookOpen className="w-4 h-4" />;
      case 'analysis':
        return <HelpCircle className="w-4 h-4" />;
      case 'collaboration':
        return <Users className="w-4 h-4" />;
      default:
        return <HelpCircle className="w-4 h-4" />;
    }
  };

  const getMatchTypeColor = (matchType: string) => {
    switch (matchType) {
      case 'title':
        return 'text-blue-600';
      case 'keyword':
        return 'text-green-600';
      case 'tag':
        return 'text-purple-600';
      default:
        return 'text-gray-600';
    }
  };

  const handleResultClick = (result: HelpSearchResult) => {
    // Show the help content
    import('@/lib/contextual-help').then(({ helpManager }) => {
      helpManager.showHelp(result.content.id);
    });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-16">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Dialog */}
      <div className="relative w-full max-w-2xl mx-4 bg-white rounded-lg shadow-xl">
        {/* Header */}
        <div className="flex items-center gap-3 p-4 border-b">
          <Search className="w-5 h-5 text-gray-400" />
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Search help articles..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1 text-lg outline-none placeholder-gray-400"
          />
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 rounded"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Results */}
        <div className="max-h-96 overflow-y-auto">
          {isSearching && (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
              <span className="ml-2 text-gray-600">Searching...</span>
            </div>
          )}

          {!isSearching && query && results.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              <HelpCircle className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p>No help articles found for "{query}"</p>
              <p className="text-sm mt-1">Try different keywords or browse categories</p>
            </div>
          )}

          {!isSearching && results.length > 0 && (
            <div className="py-2">
              {results.map((result, index) => (
                <button
                  key={result.content.id}
                  onClick={() => handleResultClick(result)}
                  className="w-full text-left p-4 hover:bg-gray-50 border-b border-gray-100 last:border-b-0 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 mt-1">
                      {getCategoryIcon(result.content.category)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-medium text-gray-900 truncate">
                          {result.content.title}
                        </h3>
                        <span className={`text-xs px-2 py-1 rounded-full bg-gray-100 ${getMatchTypeColor(result.matchType)}`}>
                          {result.matchType}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 line-clamp-2">
                        {result.snippet}
                      </p>
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-xs text-gray-400 capitalize">
                          {result.content.category}
                        </span>
                        <span className="text-xs text-gray-300">•</span>
                        <span className="text-xs text-gray-400">
                          Relevance: {Math.round(result.relevanceScore * 10)}%
                        </span>
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}

          {!query && (
            <div className="p-6">
              <h3 className="font-medium text-gray-900 mb-4">Popular Help Topics</h3>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { title: 'Creating Geological Sites', category: 'geological' },
                  { title: 'AI Mineral Analysis', category: 'analysis' },
                  { title: 'Map Navigation', category: 'ui' },
                  { title: 'Team Collaboration', category: 'collaboration' }
                ].map((topic, index) => (
                  <button
                    key={index}
                    onClick={() => setQuery(topic.title)}
                    className="flex items-center gap-2 p-3 text-left bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    {getCategoryIcon(topic.category)}
                    <span className="text-sm font-medium text-gray-700">
                      {topic.title}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t bg-gray-50 text-xs text-gray-500">
          <div className="flex items-center gap-4">
            <span>Press <kbd className="px-1 py-0.5 bg-gray-200 rounded">Esc</kbd> to close</span>
          </div>
          <div>
            {results.length > 0 && `${results.length} result${results.length === 1 ? '' : 's'}`}
          </div>
        </div>
      </div>
    </div>
  );
}

// Keyboard shortcut component
export function HelpSearchShortcut() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === '/') {
        e.preventDefault();
        setIsOpen(true);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <HelpSearchDialog 
      isOpen={isOpen} 
      onClose={() => setIsOpen(false)} 
    />
  );
}