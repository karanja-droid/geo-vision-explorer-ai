import { supabase } from '@/integrations/supabase/client';
import { cacheManager } from './cache-manager';

export interface TutorialStep {
  id: string;
  title: string;
  description: string;
  targetElement?: string;
  action: 'highlight' | 'click' | 'input' | 'navigate' | 'wait';
  validation?: () => boolean | Promise<boolean>;
  nextStep?: string;
  skipCondition?: () => boolean | Promise<boolean>;
  position?: 'top' | 'bottom' | 'left' | 'right' | 'center';
  delay?: number;
  autoAdvance?: boolean;
  content?: {
    html?: string;
    video?: string;
    image?: string;
  };
}

export interface OnboardingFlow {
  id: string;
  name: string;
  description: string;
  userRole: string;
  steps: TutorialStep[];
  estimatedDuration: number;
  completionReward?: {
    type: 'badge' | 'feature_unlock' | 'credit' | 'discount';
    value: string;
    description: string;
  };
  prerequisites?: string[];
  category: 'getting_started' | 'advanced_features' | 'best_practices' | 'troubleshooting';
}

export interface OnboardingProgress {
  userId: string;
  flowId: string;
  currentStep: string;
  completedSteps: string[];
  startedAt: Date;
  lastActiveAt: Date;
  completedAt?: Date;
  skipped: boolean;
  progress: number;
  timeSpent: number;
}

export interface UserOnboardingState {
  userId: string;
  role: string;
  completedFlows: string[];
  currentFlow?: string;
  onboardingCompleted: boolean;
  preferences: {
    showTooltips: boolean;
    autoAdvance: boolean;
    skipAnimations: boolean;
  };
  achievements: OnboardingAchievement[];
}

export interface OnboardingAchievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  unlockedAt: Date;
  category: string;
}

export class OnboardingManager {
  private currentFlow: OnboardingFlow | null = null;
  private currentProgress: OnboardingProgress | null = null;
  private overlayElement: HTMLElement | null = null;
  private highlightElement: HTMLElement | null = null;
  private eventListeners: Map<string, EventListener> = new Map();

  /**
   * Initialize onboarding for a user
   */
  async initializeOnboarding(userId: string): Promise<UserOnboardingState> {
    try {
      // Get user profile and role
      const { data: user, error: userError } = await supabase
        .from('users')
        .select('role, onboarding_completed, onboarding_progress')
        .eq('id', userId)
        .single();

      if (userError) {
        throw new Error(`Failed to fetch user: ${userError.message}`);
      }

      // Get or create onboarding state
      let onboardingState = await this.getUserOnboardingState(userId);
      
      if (!onboardingState) {
        onboardingState = await this.createUserOnboardingState(userId, user.role);
      }

      return onboardingState;
    } catch (error) {
      console.error('Failed to initialize onboarding:', error);
      throw error;
    }
  }

  /**
   * Start an onboarding flow
   */
  async startOnboarding(userId: string, flowId?: string): Promise<OnboardingFlow> {
    try {
      const userState = await this.getUserOnboardingState(userId);
      if (!userState) {
        throw new Error('User onboarding state not found');
      }

      // Get appropriate flow
      const flow = flowId 
        ? await this.getOnboardingFlow(flowId)
        : await this.getRecommendedFlow(userState.role);

      if (!flow) {
        throw new Error('No suitable onboarding flow found');
      }

      // Check prerequisites
      if (flow.prerequisites && flow.prerequisites.length > 0) {
        const missingPrereqs = flow.prerequisites.filter(
          prereq => !userState.completedFlows.includes(prereq)
        );
        
        if (missingPrereqs.length > 0) {
          throw new Error(`Missing prerequisites: ${missingPrereqs.join(', ')}`);
        }
      }

      // Create or update progress
      const progress: OnboardingProgress = {
        userId,
        flowId: flow.id,
        currentStep: flow.steps[0].id,
        completedSteps: [],
        startedAt: new Date(),
        lastActiveAt: new Date(),
        skipped: false,
        progress: 0,
        timeSpent: 0
      };

      await this.saveProgress(progress);

      this.currentFlow = flow;
      this.currentProgress = progress;

      // Start the first step
      await this.showStep(flow.steps[0]);

      // Track analytics
      this.trackEvent('onboarding_started', {
        flowId: flow.id,
        userId,
        role: userState.role
      });

      return flow;
    } catch (error) {
      console.error('Failed to start onboarding:', error);
      throw error;
    }
  }

  /**
   * Show a tutorial step
   */
  private async showStep(step: TutorialStep): Promise<void> {
    try {
      // Clear previous step
      this.clearStep();

      // Wait for delay if specified
      if (step.delay) {
        await new Promise(resolve => setTimeout(resolve, step.delay));
      }

      // Check skip condition
      if (step.skipCondition && await step.skipCondition()) {
        await this.nextStep();
        return;
      }

      // Find target element if specified
      let targetElement: HTMLElement | null = null;
      if (step.targetElement) {
        targetElement = document.querySelector(step.targetElement);
        if (!targetElement) {
          console.warn(`Target element not found: ${step.targetElement}`);
        }
      }

      // Create overlay
      this.createOverlay(step, targetElement);

      // Highlight target element
      if (targetElement) {
        this.highlightElement = this.createHighlight(targetElement);
      }

      // Handle step action
      await this.handleStepAction(step, targetElement);

      // Auto-advance if specified
      if (step.autoAdvance) {
        setTimeout(() => this.nextStep(), 3000);
      }

    } catch (error) {
      console.error('Failed to show step:', error);
    }
  }

  /**
   * Create tutorial overlay
   */
  private createOverlay(step: TutorialStep, targetElement: HTMLElement | null): void {
    // Create overlay container
    this.overlayElement = document.createElement('div');
    this.overlayElement.className = 'onboarding-overlay';
    this.overlayElement.innerHTML = `
      <div class="onboarding-backdrop"></div>
      <div class="onboarding-tooltip ${step.position || 'center'}">
        <div class="onboarding-content">
          <h3 class="onboarding-title">${step.title}</h3>
          <div class="onboarding-description">${step.description}</div>
          ${step.content?.html || ''}
          ${step.content?.video ? `<video src="${step.content.video}" controls></video>` : ''}
          ${step.content?.image ? `<img src="${step.content.image}" alt="${step.title}">` : ''}
        </div>
        <div class="onboarding-actions">
          <button class="onboarding-skip">Skip Tour</button>
          <button class="onboarding-prev" ${this.currentProgress?.completedSteps.length === 0 ? 'disabled' : ''}>Previous</button>
          <button class="onboarding-next">Next</button>
        </div>
        <div class="onboarding-progress">
          <div class="progress-bar">
            <div class="progress-fill" style="width: ${this.currentProgress?.progress || 0}%"></div>
          </div>
          <span class="progress-text">
            Step ${(this.currentProgress?.completedSteps.length || 0) + 1} of ${this.currentFlow?.steps.length || 1}
          </span>
        </div>
      </div>
    `;

    // Position tooltip relative to target element
    if (targetElement && step.position !== 'center') {
      this.positionTooltip(this.overlayElement.querySelector('.onboarding-tooltip')!, targetElement, step.position || 'top');
    }

    // Add event listeners
    const skipBtn = this.overlayElement.querySelector('.onboarding-skip') as HTMLButtonElement;
    const prevBtn = this.overlayElement.querySelector('.onboarding-prev') as HTMLButtonElement;
    const nextBtn = this.overlayElement.querySelector('.onboarding-next') as HTMLButtonElement;

    skipBtn.addEventListener('click', () => this.skipOnboarding());
    prevBtn.addEventListener('click', () => this.previousStep());
    nextBtn.addEventListener('click', () => this.nextStep());

    // Add to DOM
    document.body.appendChild(this.overlayElement);

    // Add CSS styles if not already present
    this.addOnboardingStyles();
  }

  /**
   * Create element highlight
   */
  private createHighlight(element: HTMLElement): HTMLElement {
    const highlight = document.createElement('div');
    highlight.className = 'onboarding-highlight';
    
    const rect = element.getBoundingClientRect();
    highlight.style.cssText = `
      position: fixed;
      top: ${rect.top - 4}px;
      left: ${rect.left - 4}px;
      width: ${rect.width + 8}px;
      height: ${rect.height + 8}px;
      border: 2px solid #3b82f6;
      border-radius: 4px;
      pointer-events: none;
      z-index: 9999;
      animation: pulse 2s infinite;
    `;

    document.body.appendChild(highlight);
    return highlight;
  }

  /**
   * Handle step actions
   */
  private async handleStepAction(step: TutorialStep, targetElement: HTMLElement | null): Promise<void> {
    switch (step.action) {
      case 'highlight':
        // Just highlight the element (already done)
        break;

      case 'click':
        if (targetElement) {
          // Wait for user to click the element
          await this.waitForElementClick(targetElement);
        }
        break;

      case 'input':
        if (targetElement && (targetElement as HTMLInputElement).tagName === 'INPUT') {
          // Wait for user to input something
          await this.waitForElementInput(targetElement as HTMLInputElement);
        }
        break;

      case 'navigate':
        // Wait for navigation to complete
        await this.waitForNavigation();
        break;

      case 'wait':
        // Just wait for user to click next
        break;
    }
  }

  /**
   * Move to next step
   */
  async nextStep(): Promise<void> {
    if (!this.currentFlow || !this.currentProgress) return;

    const currentStepIndex = this.currentFlow.steps.findIndex(
      step => step.id === this.currentProgress!.currentStep
    );

    if (currentStepIndex === -1) return;

    // Mark current step as completed
    const currentStep = this.currentFlow.steps[currentStepIndex];
    if (!this.currentProgress.completedSteps.includes(currentStep.id)) {
      this.currentProgress.completedSteps.push(currentStep.id);
    }

    // Check if this was the last step
    if (currentStepIndex >= this.currentFlow.steps.length - 1) {
      await this.completeOnboarding();
      return;
    }

    // Move to next step
    const nextStep = this.currentFlow.steps[currentStepIndex + 1];
    this.currentProgress.currentStep = nextStep.id;
    this.currentProgress.progress = (this.currentProgress.completedSteps.length / this.currentFlow.steps.length) * 100;
    this.currentProgress.lastActiveAt = new Date();

    await this.saveProgress(this.currentProgress);
    await this.showStep(nextStep);

    // Track progress
    this.trackEvent('onboarding_step_completed', {
      flowId: this.currentFlow.id,
      stepId: currentStep.id,
      progress: this.currentProgress.progress
    });
  }

  /**
   * Move to previous step
   */
  async previousStep(): Promise<void> {
    if (!this.currentFlow || !this.currentProgress) return;

    const currentStepIndex = this.currentFlow.steps.findIndex(
      step => step.id === this.currentProgress!.currentStep
    );

    if (currentStepIndex <= 0) return;

    // Move to previous step
    const prevStep = this.currentFlow.steps[currentStepIndex - 1];
    this.currentProgress.currentStep = prevStep.id;
    
    // Remove current step from completed if it was there
    const currentStep = this.currentFlow.steps[currentStepIndex];
    this.currentProgress.completedSteps = this.currentProgress.completedSteps.filter(
      stepId => stepId !== currentStep.id
    );

    this.currentProgress.progress = (this.currentProgress.completedSteps.length / this.currentFlow.steps.length) * 100;
    this.currentProgress.lastActiveAt = new Date();

    await this.saveProgress(this.currentProgress);
    await this.showStep(prevStep);
  }

  /**
   * Skip onboarding
   */
  async skipOnboarding(): Promise<void> {
    if (!this.currentFlow || !this.currentProgress) return;

    this.currentProgress.skipped = true;
    this.currentProgress.completedAt = new Date();
    
    await this.saveProgress(this.currentProgress);
    this.clearStep();

    // Track skip event
    this.trackEvent('onboarding_skipped', {
      flowId: this.currentFlow.id,
      stepId: this.currentProgress.currentStep,
      progress: this.currentProgress.progress
    });

    this.currentFlow = null;
    this.currentProgress = null;
  }

  /**
   * Complete onboarding
   */
  async completeOnboarding(): Promise<void> {
    if (!this.currentFlow || !this.currentProgress) return;

    this.currentProgress.completedAt = new Date();
    this.currentProgress.progress = 100;
    
    await this.saveProgress(this.currentProgress);

    // Update user onboarding state
    const userState = await this.getUserOnboardingState(this.currentProgress.userId);
    if (userState) {
      userState.completedFlows.push(this.currentFlow.id);
      
      // Check if all required flows are completed
      const requiredFlows = await this.getRequiredFlows(userState.role);
      const allCompleted = requiredFlows.every(flowId => 
        userState.completedFlows.includes(flowId)
      );
      
      if (allCompleted) {
        userState.onboardingCompleted = true;
      }

      await this.saveUserOnboardingState(userState);
    }

    // Award completion reward
    if (this.currentFlow.completionReward) {
      await this.awardReward(this.currentProgress.userId, this.currentFlow.completionReward);
    }

    // Show completion message
    this.showCompletionMessage();

    // Track completion
    this.trackEvent('onboarding_completed', {
      flowId: this.currentFlow.id,
      userId: this.currentProgress.userId,
      timeSpent: this.currentProgress.timeSpent,
      stepsCompleted: this.currentProgress.completedSteps.length
    });

    this.currentFlow = null;
    this.currentProgress = null;
  }

  /**
   * Get user onboarding progress
   */
  async getProgress(userId: string): Promise<OnboardingProgress[]> {
    const { data, error } = await supabase
      .from('onboarding_progress')
      .select('*')
      .eq('user_id', userId)
      .order('started_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch progress: ${error.message}`);
    }

    return data.map(this.mapProgressFromDB);
  }

  /**
   * Restart onboarding
   */
  async restartOnboarding(userId: string, flowId: string): Promise<void> {
    // Clear existing progress
    await supabase
      .from('onboarding_progress')
      .delete()
      .eq('user_id', userId)
      .eq('flow_id', flowId);

    // Start fresh
    await this.startOnboarding(userId, flowId);
  }

  // Private helper methods
  private async getUserOnboardingState(userId: string): Promise<UserOnboardingState | null> {
    const cacheKey = `onboarding_state_${userId}`;
    const cached = await cacheManager.get<UserOnboardingState>(cacheKey);
    
    if (cached) return cached;

    const { data, error } = await supabase
      .from('user_onboarding_state')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw new Error(`Failed to fetch onboarding state: ${error.message}`);
    }

    if (!data) return null;

    const state = this.mapOnboardingStateFromDB(data);
    await cacheManager.set(cacheKey, state, 300); // 5 minutes
    
    return state;
  }

  private async createUserOnboardingState(userId: string, role: string): Promise<UserOnboardingState> {
    const state: UserOnboardingState = {
      userId,
      role,
      completedFlows: [],
      onboardingCompleted: false,
      preferences: {
        showTooltips: true,
        autoAdvance: false,
        skipAnimations: false
      },
      achievements: []
    };

    await this.saveUserOnboardingState(state);
    return state;
  }

  private async saveUserOnboardingState(state: UserOnboardingState): Promise<void> {
    const { error } = await supabase
      .from('user_onboarding_state')
      .upsert({
        user_id: state.userId,
        role: state.role,
        completed_flows: state.completedFlows,
        current_flow: state.currentFlow,
        onboarding_completed: state.onboardingCompleted,
        preferences: state.preferences,
        achievements: state.achievements,
        updated_at: new Date().toISOString()
      });

    if (error) {
      throw new Error(`Failed to save onboarding state: ${error.message}`);
    }

    // Update cache
    const cacheKey = `onboarding_state_${state.userId}`;
    await cacheManager.set(cacheKey, state, 300);
  }

  private async saveProgress(progress: OnboardingProgress): Promise<void> {
    const { error } = await supabase
      .from('onboarding_progress')
      .upsert({
        user_id: progress.userId,
        flow_id: progress.flowId,
        current_step: progress.currentStep,
        completed_steps: progress.completedSteps,
        started_at: progress.startedAt.toISOString(),
        last_active_at: progress.lastActiveAt.toISOString(),
        completed_at: progress.completedAt?.toISOString(),
        skipped: progress.skipped,
        progress: progress.progress,
        time_spent: progress.timeSpent
      });

    if (error) {
      throw new Error(`Failed to save progress: ${error.message}`);
    }
  }

  private async getOnboardingFlow(flowId: string): Promise<OnboardingFlow | null> {
    const cacheKey = `onboarding_flow_${flowId}`;
    const cached = await cacheManager.get<OnboardingFlow>(cacheKey);
    
    if (cached) return cached;

    const { data, error } = await supabase
      .from('onboarding_flows')
      .select('*')
      .eq('id', flowId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new Error(`Failed to fetch onboarding flow: ${error.message}`);
    }

    const flow = this.mapFlowFromDB(data);
    await cacheManager.set(cacheKey, flow, 3600); // 1 hour
    
    return flow;
  }

  private async getRecommendedFlow(role: string): Promise<OnboardingFlow | null> {
    const { data, error } = await supabase
      .from('onboarding_flows')
      .select('*')
      .eq('user_role', role)
      .eq('category', 'getting_started')
      .order('created_at', { ascending: true })
      .limit(1)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new Error(`Failed to fetch recommended flow: ${error.message}`);
    }

    return this.mapFlowFromDB(data);
  }

  private async getRequiredFlows(role: string): Promise<string[]> {
    const { data, error } = await supabase
      .from('onboarding_flows')
      .select('id')
      .eq('user_role', role)
      .eq('category', 'getting_started');

    if (error) {
      throw new Error(`Failed to fetch required flows: ${error.message}`);
    }

    return data.map(flow => flow.id);
  }

  private clearStep(): void {
    if (this.overlayElement) {
      this.overlayElement.remove();
      this.overlayElement = null;
    }

    if (this.highlightElement) {
      this.highlightElement.remove();
      this.highlightElement = null;
    }

    // Clear event listeners
    this.eventListeners.forEach((listener, event) => {
      document.removeEventListener(event, listener);
    });
    this.eventListeners.clear();
  }

  private positionTooltip(tooltip: HTMLElement, target: HTMLElement, position: string): void {
    const targetRect = target.getBoundingClientRect();
    const tooltipRect = tooltip.getBoundingClientRect();

    let top = 0;
    let left = 0;

    switch (position) {
      case 'top':
        top = targetRect.top - tooltipRect.height - 10;
        left = targetRect.left + (targetRect.width - tooltipRect.width) / 2;
        break;
      case 'bottom':
        top = targetRect.bottom + 10;
        left = targetRect.left + (targetRect.width - tooltipRect.width) / 2;
        break;
      case 'left':
        top = targetRect.top + (targetRect.height - tooltipRect.height) / 2;
        left = targetRect.left - tooltipRect.width - 10;
        break;
      case 'right':
        top = targetRect.top + (targetRect.height - tooltipRect.height) / 2;
        left = targetRect.right + 10;
        break;
    }

    // Ensure tooltip stays within viewport
    top = Math.max(10, Math.min(top, window.innerHeight - tooltipRect.height - 10));
    left = Math.max(10, Math.min(left, window.innerWidth - tooltipRect.width - 10));

    tooltip.style.top = `${top}px`;
    tooltip.style.left = `${left}px`;
    tooltip.style.position = 'fixed';
  }

  private async waitForElementClick(element: HTMLElement): Promise<void> {
    return new Promise(resolve => {
      const clickHandler = () => {
        element.removeEventListener('click', clickHandler);
        resolve();
      };
      element.addEventListener('click', clickHandler);
    });
  }

  private async waitForElementInput(element: HTMLInputElement): Promise<void> {
    return new Promise(resolve => {
      const inputHandler = () => {
        if (element.value.length > 0) {
          element.removeEventListener('input', inputHandler);
          resolve();
        }
      };
      element.addEventListener('input', inputHandler);
    });
  }

  private async waitForNavigation(): Promise<void> {
    return new Promise(resolve => {
      const navigationHandler = () => {
        window.removeEventListener('popstate', navigationHandler);
        resolve();
      };
      window.addEventListener('popstate', navigationHandler);
      
      // Also resolve after a timeout
      setTimeout(resolve, 5000);
    });
  }

  private showCompletionMessage(): void {
    const message = document.createElement('div');
    message.className = 'onboarding-completion';
    message.innerHTML = `
      <div class="completion-content">
        <div class="completion-icon">🎉</div>
        <h2>Congratulations!</h2>
        <p>You've completed the onboarding tour. You're ready to start exploring geological data!</p>
        <button class="completion-close">Get Started</button>
      </div>
    `;

    message.querySelector('.completion-close')?.addEventListener('click', () => {
      message.remove();
    });

    document.body.appendChild(message);

    // Auto-remove after 5 seconds
    setTimeout(() => {
      if (message.parentNode) {
        message.remove();
      }
    }, 5000);
  }

  private async awardReward(userId: string, reward: OnboardingFlow['completionReward']): Promise<void> {
    if (!reward) return;

    const achievement: OnboardingAchievement = {
      id: crypto.randomUUID(),
      name: reward.value,
      description: reward.description,
      icon: reward.type === 'badge' ? '🏆' : '🎁',
      unlockedAt: new Date(),
      category: reward.type
    };

    // Save achievement
    const { error } = await supabase
      .from('user_achievements')
      .insert({
        user_id: userId,
        achievement_id: achievement.id,
        name: achievement.name,
        description: achievement.description,
        icon: achievement.icon,
        category: achievement.category,
        unlocked_at: achievement.unlockedAt.toISOString()
      });

    if (error) {
      console.error('Failed to save achievement:', error);
    }

    // Show achievement notification
    this.showAchievementNotification(achievement);
  }

  private showAchievementNotification(achievement: OnboardingAchievement): void {
    const notification = document.createElement('div');
    notification.className = 'achievement-notification';
    notification.innerHTML = `
      <div class="achievement-content">
        <div class="achievement-icon">${achievement.icon}</div>
        <div class="achievement-text">
          <h4>Achievement Unlocked!</h4>
          <p>${achievement.name}</p>
        </div>
      </div>
    `;

    document.body.appendChild(notification);

    // Auto-remove after 4 seconds
    setTimeout(() => {
      notification.remove();
    }, 4000);
  }

  private trackEvent(event: string, data: any): void {
    // Send to analytics
    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('event', event, {
        custom_parameter: JSON.stringify(data)
      });
    }

    // Log for debugging
    console.log(`Onboarding event: ${event}`, data);
  }

  private addOnboardingStyles(): void {
    if (document.getElementById('onboarding-styles')) return;

    const styles = document.createElement('style');
    styles.id = 'onboarding-styles';
    styles.textContent = `
      .onboarding-overlay {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        z-index: 10000;
        pointer-events: none;
      }

      .onboarding-backdrop {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        pointer-events: auto;
      }

      .onboarding-tooltip {
        position: fixed;
        background: white;
        border-radius: 8px;
        box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
        max-width: 400px;
        pointer-events: auto;
        z-index: 10001;
      }

      .onboarding-tooltip.center {
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
      }

      .onboarding-content {
        padding: 20px;
      }

      .onboarding-title {
        margin: 0 0 10px 0;
        font-size: 18px;
        font-weight: 600;
        color: #1f2937;
      }

      .onboarding-description {
        margin: 0 0 15px 0;
        color: #6b7280;
        line-height: 1.5;
      }

      .onboarding-actions {
        display: flex;
        justify-content: space-between;
        padding: 15px 20px;
        border-top: 1px solid #e5e7eb;
        gap: 10px;
      }

      .onboarding-actions button {
        padding: 8px 16px;
        border: 1px solid #d1d5db;
        border-radius: 6px;
        background: white;
        cursor: pointer;
        font-size: 14px;
        transition: all 0.2s;
      }

      .onboarding-actions button:hover:not(:disabled) {
        background: #f9fafb;
      }

      .onboarding-actions button:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      .onboarding-next {
        background: #3b82f6 !important;
        color: white !important;
        border-color: #3b82f6 !important;
      }

      .onboarding-next:hover {
        background: #2563eb !important;
      }

      .onboarding-progress {
        padding: 15px 20px;
        border-top: 1px solid #e5e7eb;
        background: #f9fafb;
        border-radius: 0 0 8px 8px;
      }

      .progress-bar {
        width: 100%;
        height: 4px;
        background: #e5e7eb;
        border-radius: 2px;
        overflow: hidden;
        margin-bottom: 8px;
      }

      .progress-fill {
        height: 100%;
        background: #3b82f6;
        transition: width 0.3s ease;
      }

      .progress-text {
        font-size: 12px;
        color: #6b7280;
      }

      .onboarding-highlight {
        animation: pulse 2s infinite;
      }

      @keyframes pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.5; }
      }

      .onboarding-completion {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
      }

      .completion-content {
        background: white;
        padding: 40px;
        border-radius: 12px;
        text-align: center;
        max-width: 400px;
      }

      .completion-icon {
        font-size: 48px;
        margin-bottom: 20px;
      }

      .completion-content h2 {
        margin: 0 0 15px 0;
        color: #1f2937;
      }

      .completion-content p {
        margin: 0 0 25px 0;
        color: #6b7280;
        line-height: 1.5;
      }

      .completion-close {
        background: #3b82f6;
        color: white;
        border: none;
        padding: 12px 24px;
        border-radius: 6px;
        cursor: pointer;
        font-size: 16px;
        font-weight: 500;
      }

      .completion-close:hover {
        background: #2563eb;
      }

      .achievement-notification {
        position: fixed;
        top: 20px;
        right: 20px;
        background: white;
        border-radius: 8px;
        box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
        padding: 15px;
        z-index: 10000;
        animation: slideIn 0.3s ease;
      }

      .achievement-content {
        display: flex;
        align-items: center;
        gap: 12px;
      }

      .achievement-icon {
        font-size: 24px;
      }

      .achievement-text h4 {
        margin: 0 0 4px 0;
        font-size: 14px;
        font-weight: 600;
        color: #1f2937;
      }

      .achievement-text p {
        margin: 0;
        font-size: 12px;
        color: #6b7280;
      }

      @keyframes slideIn {
        from {
          transform: translateX(100%);
          opacity: 0;
        }
        to {
          transform: translateX(0);
          opacity: 1;
        }
      }
    `;

    document.head.appendChild(styles);
  }

  // Database mapping helpers
  private mapFlowFromDB(data: any): OnboardingFlow {
    return {
      id: data.id,
      name: data.name,
      description: data.description,
      userRole: data.user_role,
      steps: data.steps,
      estimatedDuration: data.estimated_duration,
      completionReward: data.completion_reward,
      prerequisites: data.prerequisites,
      category: data.category
    };
  }

  private mapProgressFromDB(data: any): OnboardingProgress {
    return {
      userId: data.user_id,
      flowId: data.flow_id,
      currentStep: data.current_step,
      completedSteps: data.completed_steps,
      startedAt: new Date(data.started_at),
      lastActiveAt: new Date(data.last_active_at),
      completedAt: data.completed_at ? new Date(data.completed_at) : undefined,
      skipped: data.skipped,
      progress: data.progress,
      timeSpent: data.time_spent
    };
  }

  private mapOnboardingStateFromDB(data: any): UserOnboardingState {
    return {
      userId: data.user_id,
      role: data.role,
      completedFlows: data.completed_flows,
      currentFlow: data.current_flow,
      onboardingCompleted: data.onboarding_completed,
      preferences: data.preferences,
      achievements: data.achievements
    };
  }
}

// Export singleton instance
export const onboardingManager = new OnboardingManager();

// React hook for onboarding
export function useOnboarding() {
  const [isOnboarding, setIsOnboarding] = React.useState(false);
  const [currentFlow, setCurrentFlow] = React.useState<OnboardingFlow | null>(null);
  const [progress, setProgress] = React.useState<OnboardingProgress | null>(null);

  const startOnboarding = async (userId: string, flowId?: string) => {
    try {
      const flow = await onboardingManager.startOnboarding(userId, flowId);
      setCurrentFlow(flow);
      setIsOnboarding(true);
    } catch (error) {
      console.error('Failed to start onboarding:', error);
    }
  };

  const skipOnboarding = async () => {
    await onboardingManager.skipOnboarding();
    setIsOnboarding(false);
    setCurrentFlow(null);
    setProgress(null);
  };

  return {
    isOnboarding,
    currentFlow,
    progress,
    startOnboarding,
    skipOnboarding,
    onboardingManager
  };
}