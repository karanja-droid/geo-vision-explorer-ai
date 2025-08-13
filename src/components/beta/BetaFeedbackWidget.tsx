import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { 
  Star, 
  MessageSquare, 
  Send, 
  ThumbsUp, 
  ThumbsDown,
  Bug,
  Lightbulb,
  Heart
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

interface FeedbackData {
  feature_name: string;
  satisfaction_score: number;
  usage_frequency: 'daily' | 'weekly' | 'monthly' | 'rarely';
  feedback_text: string;
  feedback_type: 'general' | 'bug' | 'improvement' | 'praise';
  improvement_suggestion?: string;
  bug_description?: string;
}

interface BetaFeedbackWidgetProps {
  feature?: string;
  trigger?: React.ReactNode;
  onFeedbackSubmitted?: (feedback: FeedbackData) => void;
}

const BetaFeedbackWidget: React.FC<BetaFeedbackWidgetProps> = ({
  feature = 'general',
  trigger,
  onFeedbackSubmitted
}) => {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedbackData, setFeedbackData] = useState<Partial<FeedbackData>>({
    feature_name: feature,
    satisfaction_score: 5,
    usage_frequency: 'weekly',
    feedback_text: '',
    feedback_type: 'general'
  });

  const handleStarClick = (rating: number) => {
    setFeedbackData(prev => ({ ...prev, satisfaction_score: rating }));
  };

  const handleSubmit = async () => {
    if (!feedbackData.feedback_text?.trim()) {
      toast.error('Please provide some feedback before submitting');
      return;
    }

    setIsSubmitting(true);
    
    try {
      const response = await fetch('/api/beta/feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...feedbackData,
          user_id: user?.id,
          timestamp: new Date().toISOString()
        })
      });

      if (!response.ok) {
        throw new Error('Failed to submit feedback');
      }

      toast.success('Thank you for your feedback! 🎉');
      setIsOpen(false);
      setFeedbackData({
        feature_name: feature,
        satisfaction_score: 5,
        usage_frequency: 'weekly',
        feedback_text: '',
        feedback_type: 'general'
      });

      if (onFeedbackSubmitted) {
        onFeedbackSubmitted(feedbackData as FeedbackData);
      }

    } catch (error) {
      console.error('Error submitting feedback:', error);
      toast.error('Failed to submit feedback. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getFeedbackTypeIcon = (type: string) => {
    switch (type) {
      case 'bug': return <Bug className="h-4 w-4 text-red-500" />;
      case 'improvement': return <Lightbulb className="h-4 w-4 text-yellow-500" />;
      case 'praise': return <Heart className="h-4 w-4 text-pink-500" />;
      default: return <MessageSquare className="h-4 w-4 text-blue-500" />;
    }
  };

  const defaultTrigger = (
    <Button variant="outline" size="sm" className="gap-2">
      <MessageSquare className="h-4 w-4" />
      Beta Feedback
    </Button>
  );

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {trigger || defaultTrigger}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-blue-600" />
            Beta Feedback
          </DialogTitle>
          <DialogDescription>
            Help us improve GeoVision AI Miner by sharing your experience with the{' '}
            <Badge variant="outline" className="mx-1">
              {feature.replace(/_/g, ' ')}
            </Badge>
            feature.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Satisfaction Rating */}
          <div className="space-y-2">
            <label className="text-sm font-medium">How satisfied are you with this feature?</label>
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  onClick={() => handleStarClick(star)}
                  className="p-1 hover:scale-110 transition-transform"
                >
                  <Star
                    className={`h-6 w-6 ${
                      star <= (feedbackData.satisfaction_score || 0)
                        ? 'text-yellow-400 fill-current'
                        : 'text-gray-300'
                    }`}
                  />
                </button>
              ))}
              <span className="ml-2 text-sm text-gray-600">
                {feedbackData.satisfaction_score}/5
              </span>
            </div>
          </div>

          {/* Usage Frequency */}
          <div className="space-y-2">
            <label className="text-sm font-medium">How often do you use this feature?</label>
            <Select
              value={feedbackData.usage_frequency}
              onValueChange={(value) => setFeedbackData(prev => ({ 
                ...prev, 
                usage_frequency: value as FeedbackData['usage_frequency']
              }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
                <SelectItem value="rarely">Rarely</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Feedback Type */}
          <div className="space-y-2">
            <label className="text-sm font-medium">What type of feedback is this?</label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { value: 'general', label: 'General Feedback', icon: <MessageSquare className="h-4 w-4" /> },
                { value: 'bug', label: 'Bug Report', icon: <Bug className="h-4 w-4 text-red-500" /> },
                { value: 'improvement', label: 'Improvement', icon: <Lightbulb className="h-4 w-4 text-yellow-500" /> },
                { value: 'praise', label: 'Praise', icon: <Heart className="h-4 w-4 text-pink-500" /> }
              ].map((type) => (
                <button
                  key={type.value}
                  onClick={() => setFeedbackData(prev => ({ 
                    ...prev, 
                    feedback_type: type.value as FeedbackData['feedback_type']
                  }))}
                  className={`p-3 border rounded-lg flex items-center gap-2 text-sm transition-colors ${
                    feedbackData.feedback_type === type.value
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  {type.icon}
                  {type.label}
                </button>
              ))}
            </div>
          </div>

          {/* Feedback Text */}
          <div className="space-y-2">
            <label className="text-sm font-medium">
              {feedbackData.feedback_type === 'bug' && 'Describe the bug you encountered'}
              {feedbackData.feedback_type === 'improvement' && 'What improvement would you suggest?'}
              {feedbackData.feedback_type === 'praise' && 'What did you love about this feature?'}
              {feedbackData.feedback_type === 'general' && 'Share your thoughts and feedback'}
            </label>
            <Textarea
              placeholder={
                feedbackData.feedback_type === 'bug' 
                  ? 'Please describe what happened, what you expected, and steps to reproduce...'
                  : feedbackData.feedback_type === 'improvement'
                  ? 'How could we make this feature better for you?'
                  : feedbackData.feedback_type === 'praise'
                  ? 'Tell us what you loved!'
                  : 'Your feedback helps us improve the platform...'
              }
              value={feedbackData.feedback_text}
              onChange={(e) => setFeedbackData(prev => ({ 
                ...prev, 
                feedback_text: e.target.value 
              }))}
              rows={4}
              className="resize-none"
            />
          </div>

          {/* Additional Fields Based on Type */}
          {feedbackData.feedback_type === 'improvement' && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Specific improvement suggestion</label>
              <Textarea
                placeholder="What specific changes would make this feature more useful?"
                value={feedbackData.improvement_suggestion || ''}
                onChange={(e) => setFeedbackData(prev => ({ 
                  ...prev, 
                  improvement_suggestion: e.target.value 
                }))}
                rows={2}
                className="resize-none"
              />
            </div>
          )}

          {feedbackData.feedback_type === 'bug' && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Steps to reproduce</label>
              <Textarea
                placeholder="1. Go to...\n2. Click on...\n3. Expected vs actual result..."
                value={feedbackData.bug_description || ''}
                onChange={(e) => setFeedbackData(prev => ({ 
                  ...prev, 
                  bug_description: e.target.value 
                }))}
                rows={3}
                className="resize-none"
              />
            </div>
          )}

          {/* Submit Button */}
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setIsOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting || !feedbackData.feedback_text?.trim()}
              className="gap-2"
            >
              {isSubmitting ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              ) : (
                <Send className="h-4 w-4" />
              )}
              Submit Feedback
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

// Quick feedback buttons for common actions
export const QuickFeedbackButtons: React.FC<{ feature: string }> = ({ feature }) => {
  const [submitted, setSubmitted] = useState<string | null>(null);

  const handleQuickFeedback = async (type: 'positive' | 'negative', score: number) => {
    try {
      await fetch('/api/beta/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          feature_name: feature,
          satisfaction_score: score,
          usage_frequency: 'weekly',
          feedback_text: type === 'positive' ? 'Quick positive feedback' : 'Quick negative feedback',
          feedback_type: 'general',
          timestamp: new Date().toISOString()
        })
      });

      setSubmitted(type);
      toast.success('Thanks for the quick feedback!');
      
      // Reset after 3 seconds
      setTimeout(() => setSubmitted(null), 3000);
    } catch (error) {
      toast.error('Failed to submit feedback');
    }
  };

  if (submitted) {
    return (
      <div className="flex items-center gap-2 text-sm text-green-600">
        <ThumbsUp className="h-4 w-4" />
        Thanks for your feedback!
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-gray-600">Was this helpful?</span>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => handleQuickFeedback('positive', 5)}
        className="h-8 w-8 p-0"
      >
        <ThumbsUp className="h-4 w-4 text-green-600" />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => handleQuickFeedback('negative', 2)}
        className="h-8 w-8 p-0"
      >
        <ThumbsDown className="h-4 w-4 text-red-600" />
      </Button>
      <BetaFeedbackWidget
        feature={feature}
        trigger={
          <Button variant="ghost" size="sm" className="h-8 px-2 text-xs">
            Details
          </Button>
        }
      />
    </div>
  );
};

export default BetaFeedbackWidget;