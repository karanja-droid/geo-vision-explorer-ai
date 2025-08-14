/**
 * Contextual Help System
 * Provides intelligent, context-aware help content and guidance
 */

export interface HelpContent {
  id: string;
  title: string;
  content: string;
  type: 'tooltip' | 'modal' | 'sidebar' | 'inline';
  category: 'geological' | 'ui' | 'analysis' | 'collaboration' | 'general';
  triggers: HelpTrigger[];
  priority: number;
  tags: string[];
  searchKeywords: string[];
  relatedContent: string[];
  lastUpdated: Date;
  analytics: HelpAnalytics;
}

export interface HelpTrigger {
  type: 'element' | 'route' | 'action' | 'error' | 'time';
  selector?: string;
  route?: string;
  action?: string;
  errorCode?: string;
  delay?: number;
  conditions?: HelpCondition[];
}

export interface HelpCondition {
  type: 'user_role' | 'feature_flag' | 'subscription' | 'usage_count' | 'custom';
  value: any;
  operator: 'equals' | 'not_equals' | 'greater_than' | 'less_than' | 'contains';
}

export interface HelpAnalytics {
  views: number;
  interactions: number;
  completions: number;
  dismissals: number;
  helpfulness: number;
  searchRank: number;
  lastViewed?: Date;
}

export interface HelpSearchResult {
  content: HelpContent;
  relevanceScore: number;
  matchType: 'title' | 'content' | 'keyword' | 'tag';
  snippet: string;
}

export interface HelpContext {
  route: string;
  userRole: string;
  subscription: string;
  activeFeatures: string[];
  recentActions: string[];
  errorHistory: string[];
  sessionDuration: number;
}

class ContextualHelpManager {
  private helpContent: Map<string, HelpContent> = new Map();
  private activeHelp: Map<string, HelpContent> = new Map();
  private searchIndex: Map<string, string[]> = new Map();
  private analytics: Map<string, HelpAnalytics> = new Map();
  private observers: MutationObserver[] = [];

  constructor() {
    this.initializeDefaultContent();
    this.setupElementObservers();
  }

  /**
   * Register help content with the system
   */
  registerContent(content: HelpContent): void {
    this.helpContent.set(content.id, content);
    this.updateSearchIndex(content);
    this.setupTriggers(content);
  }

  /**
   * Get contextual help for current state
   */
  getContextualHelp(context: HelpContext): HelpContent[] {
    const relevantHelp: HelpContent[] = [];

    for (const [id, content] of this.helpContent) {
      if (this.isContentRelevant(content, context)) {
        relevantHelp.push(content);
      }
    }

    return relevantHelp.sort((a, b) => b.priority - a.priority);
  }

  /**
   * Search help content
   */
  searchHelp(query: string, context?: HelpContext): HelpSearchResult[] {
    const results: HelpSearchResult[] = [];
    const queryLower = query.toLowerCase();

    for (const [id, content] of this.helpContent) {
      const relevanceScore = this.calculateRelevance(content, queryLower, context);
      
      if (relevanceScore > 0) {
        results.push({
          content,
          relevanceScore,
          matchType: this.getMatchType(content, queryLower),
          snippet: this.generateSnippet(content, queryLower)
        });
      }
    }

    return results.sort((a, b) => b.relevanceScore - a.relevanceScore);
  }

  /**
   * Show help content
   */
  showHelp(contentId: string, element?: HTMLElement): void {
    const content = this.helpContent.get(contentId);
    if (!content) return;

    this.trackAnalytics(contentId, 'view');
    this.activeHelp.set(contentId, content);

    switch (content.type) {
      case 'tooltip':
        this.showTooltip(content, element);
        break;
      case 'modal':
        this.showModal(content);
        break;
      case 'sidebar':
        this.showSidebar(content);
        break;
      case 'inline':
        this.showInline(content, element);
        break;
    }
  }

  /**
   * Hide help content
   */
  hideHelp(contentId: string): void {
    const content = this.activeHelp.get(contentId);
    if (!content) return;

    this.trackAnalytics(contentId, 'dismiss');
    this.activeHelp.delete(contentId);
    this.removeHelpElement(contentId);
  }

  /**
   * Track help interaction
   */
  trackInteraction(contentId: string, type: 'click' | 'complete' | 'helpful' | 'not_helpful'): void {
    this.trackAnalytics(contentId, type);
  }

  /**
   * Get help analytics
   */
  getAnalytics(contentId?: string): HelpAnalytics | Map<string, HelpAnalytics> {
    if (contentId) {
      return this.analytics.get(contentId) || this.createDefaultAnalytics();
    }
    return this.analytics;
  }

  private initializeDefaultContent(): void {
    const defaultContent: HelpContent[] = [
      {
        id: 'geological-site-creation',
        title: 'Creating a Geological Site',
        content: 'Learn how to create and configure geological sites with proper coordinates, mineral data, and analysis parameters.',
        type: 'modal',
        category: 'geological',
        triggers: [
          { type: 'route', route: '/sites/new' },
          { type: 'element', selector: '[data-help="create-site"]' }
        ],
        priority: 10,
        tags: ['sites', 'geological', 'creation'],
        searchKeywords: ['site', 'geological', 'create', 'new', 'location'],
        relatedContent: ['mineral-deposit-analysis', 'site-management'],
        lastUpdated: new Date(),
        analytics: this.createDefaultAnalytics()
      },
      {
        id: 'ai-mineral-analysis',
        title: 'AI Mineral Analysis',
        content: 'Understand how our AI analyzes mineral deposits, confidence scores, and prediction accuracy.',
        type: 'sidebar',
        category: 'analysis',
        triggers: [
          { type: 'route', route: '/analysis' },
          { type: 'action', action: 'start_analysis' }
        ],
        priority: 9,
        tags: ['ai', 'analysis', 'minerals', 'prediction'],
        searchKeywords: ['ai', 'analysis', 'mineral', 'prediction', 'confidence'],
        relatedContent: ['geological-site-creation', 'data-interpretation'],
        lastUpdated: new Date(),
        analytics: this.createDefaultAnalytics()
      },
      {
        id: 'map-navigation',
        title: 'Interactive Map Navigation',
        content: 'Master the 3D map controls, layer management, and geological visualization features.',
        type: 'tooltip',
        category: 'ui',
        triggers: [
          { type: 'element', selector: '.mapbox-gl-canvas' },
          { type: 'route', route: '/dashboard' }
        ],
        priority: 8,
        tags: ['map', 'navigation', '3d', 'visualization'],
        searchKeywords: ['map', 'navigation', '3d', 'zoom', 'layers'],
        relatedContent: ['geological-site-creation', 'data-visualization'],
        lastUpdated: new Date(),
        analytics: this.createDefaultAnalytics()
      },
      {
        id: 'collaboration-features',
        title: 'Team Collaboration',
        content: 'Collaborate with your team using real-time sharing, comments, and project management features.',
        type: 'inline',
        category: 'collaboration',
        triggers: [
          { type: 'route', route: '/projects' },
          { type: 'action', action: 'invite_user' }
        ],
        priority: 7,
        tags: ['collaboration', 'team', 'sharing', 'projects'],
        searchKeywords: ['collaborate', 'team', 'share', 'invite', 'project'],
        relatedContent: ['project-management', 'user-permissions'],
        lastUpdated: new Date(),
        analytics: this.createDefaultAnalytics()
      }
    ];

    defaultContent.forEach(content => this.registerContent(content));
  }

  private setupElementObservers(): void {
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'childList') {
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              this.checkElementTriggers(node as Element);
            }
          });
        }
      });
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    this.observers.push(observer);
  }

  private setupTriggers(content: HelpContent): void {
    content.triggers.forEach(trigger => {
      switch (trigger.type) {
        case 'element':
          this.setupElementTrigger(content, trigger);
          break;
        case 'route':
          this.setupRouteTrigger(content, trigger);
          break;
        case 'action':
          this.setupActionTrigger(content, trigger);
          break;
        case 'error':
          this.setupErrorTrigger(content, trigger);
          break;
        case 'time':
          this.setupTimeTrigger(content, trigger);
          break;
      }
    });
  }

  private setupElementTrigger(content: HelpContent, trigger: HelpTrigger): void {
    if (!trigger.selector) return;

    const checkElements = () => {
      const elements = document.querySelectorAll(trigger.selector!);
      elements.forEach(element => {
        if (!element.hasAttribute('data-help-registered')) {
          element.setAttribute('data-help-registered', 'true');
          element.addEventListener('mouseenter', () => {
            if (this.shouldShowHelp(content, trigger)) {
              this.showHelp(content.id, element as HTMLElement);
            }
          });
        }
      });
    };

    checkElements();
    // Re-check when DOM changes
    setTimeout(checkElements, 1000);
  }

  private setupRouteTrigger(content: HelpContent, trigger: HelpTrigger): void {
    if (!trigger.route) return;

    const checkRoute = () => {
      if (window.location.pathname === trigger.route) {
        if (this.shouldShowHelp(content, trigger)) {
          setTimeout(() => this.showHelp(content.id), trigger.delay || 2000);
        }
      }
    };

    window.addEventListener('popstate', checkRoute);
    checkRoute();
  }

  private setupActionTrigger(content: HelpContent, trigger: HelpTrigger): void {
    if (!trigger.action) return;

    document.addEventListener(`help:${trigger.action}`, () => {
      if (this.shouldShowHelp(content, trigger)) {
        this.showHelp(content.id);
      }
    });
  }

  private setupErrorTrigger(content: HelpContent, trigger: HelpTrigger): void {
    if (!trigger.errorCode) return;

    document.addEventListener('error:occurred', (event: any) => {
      if (event.detail.code === trigger.errorCode) {
        if (this.shouldShowHelp(content, trigger)) {
          this.showHelp(content.id);
        }
      }
    });
  }

  private setupTimeTrigger(content: HelpContent, trigger: HelpTrigger): void {
    const delay = trigger.delay || 30000; // 30 seconds default
    
    setTimeout(() => {
      if (this.shouldShowHelp(content, trigger)) {
        this.showHelp(content.id);
      }
    }, delay);
  }

  private shouldShowHelp(content: HelpContent, trigger: HelpTrigger): boolean {
    if (this.activeHelp.has(content.id)) return false;

    if (trigger.conditions) {
      return trigger.conditions.every(condition => this.evaluateCondition(condition));
    }

    return true;
  }

  private evaluateCondition(condition: HelpCondition): boolean {
    // This would integrate with your user context, feature flags, etc.
    // For now, return true to show all help
    return true;
  }

  private isContentRelevant(content: HelpContent, context: HelpContext): boolean {
    // Check route relevance
    const routeMatch = content.triggers.some(trigger => 
      trigger.type === 'route' && trigger.route === context.route
    );

    // Check role relevance
    const roleMatch = content.triggers.some(trigger =>
      trigger.conditions?.some(condition =>
        condition.type === 'user_role' && condition.value === context.userRole
      )
    );

    return routeMatch || roleMatch || content.priority > 8;
  }

  private calculateRelevance(content: HelpContent, query: string, context?: HelpContext): number {
    let score = 0;

    // Title match (highest weight)
    if (content.title.toLowerCase().includes(query)) {
      score += 10;
    }

    // Content match
    if (content.content.toLowerCase().includes(query)) {
      score += 5;
    }

    // Keyword match
    if (content.searchKeywords.some(keyword => keyword.includes(query))) {
      score += 7;
    }

    // Tag match
    if (content.tags.some(tag => tag.includes(query))) {
      score += 6;
    }

    // Context relevance bonus
    if (context && this.isContentRelevant(content, context)) {
      score += 3;
    }

    return score;
  }

  private getMatchType(content: HelpContent, query: string): 'title' | 'content' | 'keyword' | 'tag' {
    if (content.title.toLowerCase().includes(query)) return 'title';
    if (content.searchKeywords.some(keyword => keyword.includes(query))) return 'keyword';
    if (content.tags.some(tag => tag.includes(query))) return 'tag';
    return 'content';
  }

  private generateSnippet(content: HelpContent, query: string): string {
    const contentLower = content.content.toLowerCase();
    const queryIndex = contentLower.indexOf(query);
    
    if (queryIndex === -1) {
      return content.content.substring(0, 150) + '...';
    }

    const start = Math.max(0, queryIndex - 50);
    const end = Math.min(content.content.length, queryIndex + query.length + 50);
    
    return (start > 0 ? '...' : '') + 
           content.content.substring(start, end) + 
           (end < content.content.length ? '...' : '');
  }

  private showTooltip(content: HelpContent, element?: HTMLElement): void {
    if (!element) return;

    const tooltip = document.createElement('div');
    tooltip.id = `help-tooltip-${content.id}`;
    tooltip.className = 'help-tooltip';
    tooltip.innerHTML = `
      <div class="help-tooltip-content">
        <h4>${content.title}</h4>
        <p>${content.content}</p>
        <div class="help-tooltip-actions">
          <button onclick="helpManager.trackInteraction('${content.id}', 'helpful')">Helpful</button>
          <button onclick="helpManager.hideHelp('${content.id}')">Dismiss</button>
        </div>
      </div>
    `;

    document.body.appendChild(tooltip);
    this.positionTooltip(tooltip, element);
  }

  private showModal(content: HelpContent): void {
    const modal = document.createElement('div');
    modal.id = `help-modal-${content.id}`;
    modal.className = 'help-modal';
    modal.innerHTML = `
      <div class="help-modal-overlay" onclick="helpManager.hideHelp('${content.id}')"></div>
      <div class="help-modal-content">
        <div class="help-modal-header">
          <h3>${content.title}</h3>
          <button onclick="helpManager.hideHelp('${content.id}')">&times;</button>
        </div>
        <div class="help-modal-body">
          <p>${content.content}</p>
        </div>
        <div class="help-modal-footer">
          <button onclick="helpManager.trackInteraction('${content.id}', 'helpful')">This was helpful</button>
          <button onclick="helpManager.trackInteraction('${content.id}', 'not_helpful')">Not helpful</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
  }

  private showSidebar(content: HelpContent): void {
    let sidebar = document.getElementById('help-sidebar');
    if (!sidebar) {
      sidebar = document.createElement('div');
      sidebar.id = 'help-sidebar';
      sidebar.className = 'help-sidebar';
      document.body.appendChild(sidebar);
    }

    sidebar.innerHTML = `
      <div class="help-sidebar-header">
        <h3>Help</h3>
        <button onclick="helpManager.hideHelp('${content.id}')">&times;</button>
      </div>
      <div class="help-sidebar-content">
        <h4>${content.title}</h4>
        <p>${content.content}</p>
        <div class="help-sidebar-actions">
          <button onclick="helpManager.trackInteraction('${content.id}', 'helpful')">Helpful</button>
          <button onclick="helpManager.trackInteraction('${content.id}', 'complete')">Mark Complete</button>
        </div>
      </div>
    `;

    sidebar.classList.add('active');
  }

  private showInline(content: HelpContent, element?: HTMLElement): void {
    if (!element) return;

    const inline = document.createElement('div');
    inline.id = `help-inline-${content.id}`;
    inline.className = 'help-inline';
    inline.innerHTML = `
      <div class="help-inline-content">
        <strong>${content.title}</strong>
        <p>${content.content}</p>
        <button onclick="helpManager.hideHelp('${content.id}')">Got it</button>
      </div>
    `;

    element.parentNode?.insertBefore(inline, element.nextSibling);
  }

  private positionTooltip(tooltip: HTMLElement, element: HTMLElement): void {
    const rect = element.getBoundingClientRect();
    const tooltipRect = tooltip.getBoundingClientRect();

    let top = rect.bottom + 10;
    let left = rect.left + (rect.width / 2) - (tooltipRect.width / 2);

    // Adjust if tooltip goes off screen
    if (left < 10) left = 10;
    if (left + tooltipRect.width > window.innerWidth - 10) {
      left = window.innerWidth - tooltipRect.width - 10;
    }
    if (top + tooltipRect.height > window.innerHeight - 10) {
      top = rect.top - tooltipRect.height - 10;
    }

    tooltip.style.position = 'fixed';
    tooltip.style.top = `${top}px`;
    tooltip.style.left = `${left}px`;
    tooltip.style.zIndex = '10000';
  }

  private removeHelpElement(contentId: string): void {
    const elements = [
      `help-tooltip-${contentId}`,
      `help-modal-${contentId}`,
      `help-inline-${contentId}`
    ];

    elements.forEach(id => {
      const element = document.getElementById(id);
      if (element) {
        element.remove();
      }
    });

    // Hide sidebar if it was showing this content
    const sidebar = document.getElementById('help-sidebar');
    if (sidebar) {
      sidebar.classList.remove('active');
    }
  }

  private checkElementTriggers(element: Element): void {
    for (const [id, content] of this.helpContent) {
      content.triggers.forEach(trigger => {
        if (trigger.type === 'element' && trigger.selector) {
          if (element.matches(trigger.selector)) {
            this.setupElementTrigger(content, trigger);
          }
        }
      });
    }
  }

  private trackAnalytics(contentId: string, action: string): void {
    let analytics = this.analytics.get(contentId);
    if (!analytics) {
      analytics = this.createDefaultAnalytics();
      this.analytics.set(contentId, analytics);
    }

    switch (action) {
      case 'view':
        analytics.views++;
        analytics.lastViewed = new Date();
        break;
      case 'click':
        analytics.interactions++;
        break;
      case 'complete':
        analytics.completions++;
        break;
      case 'dismiss':
        analytics.dismissals++;
        break;
      case 'helpful':
        analytics.helpfulness++;
        break;
      case 'not_helpful':
        analytics.helpfulness--;
        break;
    }

    // Update search rank based on engagement
    analytics.searchRank = this.calculateSearchRank(analytics);
  }

  private updateSearchIndex(content: HelpContent): void {
    const keywords = [
      ...content.searchKeywords,
      ...content.tags,
      content.title.toLowerCase().split(' '),
      content.content.toLowerCase().split(' ')
    ].filter(keyword => keyword.length > 2);

    keywords.forEach(keyword => {
      if (!this.searchIndex.has(keyword)) {
        this.searchIndex.set(keyword, []);
      }
      const contentIds = this.searchIndex.get(keyword)!;
      if (!contentIds.includes(content.id)) {
        contentIds.push(content.id);
      }
    });
  }

  private createDefaultAnalytics(): HelpAnalytics {
    return {
      views: 0,
      interactions: 0,
      completions: 0,
      dismissals: 0,
      helpfulness: 0,
      searchRank: 0
    };
  }

  private calculateSearchRank(analytics: HelpAnalytics): number {
    const engagementScore = (analytics.interactions + analytics.completions) / Math.max(analytics.views, 1);
    const helpfulnessScore = analytics.helpfulness / Math.max(analytics.views, 1);
    const popularityScore = Math.log(analytics.views + 1);
    
    return engagementScore * 0.4 + helpfulnessScore * 0.4 + popularityScore * 0.2;
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    this.observers.forEach(observer => observer.disconnect());
    this.observers = [];
    this.helpContent.clear();
    this.activeHelp.clear();
    this.searchIndex.clear();
    this.analytics.clear();
  }
}

// Global instance
export const helpManager = new ContextualHelpManager();

// Make it available globally for HTML onclick handlers
(window as any).helpManager = helpManager;