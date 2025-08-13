import { supabase } from '@/integrations/supabase/client';
import { RealtimeChannel, RealtimePresenceState } from '@supabase/supabase-js';

export interface CollaborationUser {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  role: string;
  status: 'online' | 'away' | 'offline';
  lastSeen: Date;
  currentLocation?: {
    page: string;
    projectId?: string;
    siteId?: string;
    coordinates?: { lat: number; lng: number };
  };
}

export interface CollaborationEvent {
  id: string;
  type: 'cursor_move' | 'selection_change' | 'edit' | 'comment' | 'annotation' | 'map_interaction';
  userId: string;
  timestamp: Date;
  data: any;
  projectId?: string;
  siteId?: string;
}

export interface CursorPosition {
  userId: string;
  x: number;
  y: number;
  elementId?: string;
  timestamp: Date;
}

export interface MapInteraction {
  userId: string;
  type: 'pan' | 'zoom' | 'marker_add' | 'marker_move' | 'area_select';
  coordinates: { lat: number; lng: number };
  zoom?: number;
  data?: any;
  timestamp: Date;
}

export class RealtimeCollaborationManager {
  private channels: Map<string, RealtimeChannel> = new Map();
  private currentUser: CollaborationUser | null = null;
  private presenceState: RealtimePresenceState = {};
  private eventHandlers: Map<string, Function[]> = new Map();
  private cursorPositions: Map<string, CursorPosition> = new Map();
  private isConnected = false;

  constructor() {
    this.initializeUser();
  }

  /**
   * Initialize current user from auth session
   */
  private async initializeUser(): Promise<void> {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (session?.user) {
      this.currentUser = {
        id: session.user.id,
        name: session.user.user_metadata?.full_name || session.user.email || 'Anonymous',
        email: session.user.email || '',
        avatar: session.user.user_metadata?.avatar_url,
        role: session.user.user_metadata?.role || 'geologist',
        status: 'online',
        lastSeen: new Date()
      };
    }
  }

  /**
   * Join a collaboration room (project, site, or global)
   */
  async joinRoom(roomId: string, roomType: 'project' | 'site' | 'global' = 'project'): Promise<void> {
    if (!this.currentUser) {
      await this.initializeUser();
    }

    const channelName = `collaboration:${roomType}:${roomId}`;
    
    // Leave existing channel if any
    if (this.channels.has(channelName)) {
      await this.leaveRoom(roomId, roomType);
    }

    const channel = supabase.channel(channelName, {
      config: {
        presence: {
          key: this.currentUser?.id || 'anonymous'
        }
      }
    });

    // Track presence
    channel
      .on('presence', { event: 'sync' }, () => {
        this.presenceState = channel.presenceState();
        this.emitEvent('presence_sync', this.getOnlineUsers());
      })
      .on('presence', { event: 'join' }, ({ key, newPresences }) => {
        this.emitEvent('user_joined', { userId: key, presences: newPresences });
      })
      .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
        this.emitEvent('user_left', { userId: key, presences: leftPresences });
      });

    // Handle collaboration events
    channel
      .on('broadcast', { event: 'cursor_move' }, (payload) => {
        this.handleCursorMove(payload);
      })
      .on('broadcast', { event: 'map_interaction' }, (payload) => {
        this.handleMapInteraction(payload);
      })
      .on('broadcast', { event: 'edit_event' }, (payload) => {
        this.handleEditEvent(payload);
      })
      .on('broadcast', { event: 'comment_event' }, (payload) => {
        this.handleCommentEvent(payload);
      })
      .on('broadcast', { event: 'annotation_event' }, (payload) => {
        this.handleAnnotationEvent(payload);
      });

    // Subscribe and track presence
    await channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED' && this.currentUser) {
        await channel.track({
          user: this.currentUser,
          online_at: new Date().toISOString()
        });
        this.isConnected = true;
        this.emitEvent('connected', { roomId, roomType });
      }
    });

    this.channels.set(channelName, channel);
  }

  /**
   * Leave a collaboration room
   */
  async leaveRoom(roomId: string, roomType: 'project' | 'site' | 'global' = 'project'): Promise<void> {
    const channelName = `collaboration:${roomType}:${roomId}`;
    const channel = this.channels.get(channelName);
    
    if (channel) {
      await channel.unsubscribe();
      this.channels.delete(channelName);
      this.emitEvent('disconnected', { roomId, roomType });
    }
  }

  /**
   * Send cursor position to other users
   */
  async sendCursorPosition(position: Omit<CursorPosition, 'userId' | 'timestamp'>): Promise<void> {
    if (!this.currentUser || !this.isConnected) return;

    const cursorData: CursorPosition = {
      ...position,
      userId: this.currentUser.id,
      timestamp: new Date()
    };

    // Throttle cursor updates to avoid spam
    const lastUpdate = this.cursorPositions.get(this.currentUser.id);
    if (lastUpdate && Date.now() - lastUpdate.timestamp.getTime() < 50) {
      return; // Skip if less than 50ms since last update
    }

    this.cursorPositions.set(this.currentUser.id, cursorData);

    // Broadcast to all channels
    for (const channel of this.channels.values()) {
      await channel.send({
        type: 'broadcast',
        event: 'cursor_move',
        payload: cursorData
      });
    }
  }

  /**
   * Send map interaction to other users
   */
  async sendMapInteraction(interaction: Omit<MapInteraction, 'userId' | 'timestamp'>): Promise<void> {
    if (!this.currentUser || !this.isConnected) return;

    const mapData: MapInteraction = {
      ...interaction,
      userId: this.currentUser.id,
      timestamp: new Date()
    };

    for (const channel of this.channels.values()) {
      await channel.send({
        type: 'broadcast',
        event: 'map_interaction',
        payload: mapData
      });
    }
  }

  /**
   * Send edit event (form changes, data updates)
   */
  async sendEditEvent(editData: {
    type: 'form_change' | 'data_update' | 'field_focus';
    elementId: string;
    field?: string;
    value?: any;
    projectId?: string;
    siteId?: string;
  }): Promise<void> {
    if (!this.currentUser || !this.isConnected) return;

    const event: CollaborationEvent = {
      id: crypto.randomUUID(),
      type: 'edit',
      userId: this.currentUser.id,
      timestamp: new Date(),
      data: editData,
      projectId: editData.projectId,
      siteId: editData.siteId
    };

    for (const channel of this.channels.values()) {
      await channel.send({
        type: 'broadcast',
        event: 'edit_event',
        payload: event
      });
    }
  }

  /**
   * Send comment event
   */
  async sendComment(commentData: {
    text: string;
    coordinates?: { lat: number; lng: number };
    elementId?: string;
    parentCommentId?: string;
    projectId?: string;
    siteId?: string;
  }): Promise<void> {
    if (!this.currentUser || !this.isConnected) return;

    const event: CollaborationEvent = {
      id: crypto.randomUUID(),
      type: 'comment',
      userId: this.currentUser.id,
      timestamp: new Date(),
      data: commentData,
      projectId: commentData.projectId,
      siteId: commentData.siteId
    };

    // Store comment in database
    const { error } = await supabase
      .from('collaboration_comments')
      .insert({
        id: event.id,
        user_id: this.currentUser.id,
        project_id: commentData.projectId,
        site_id: commentData.siteId,
        comment_text: commentData.text,
        coordinates: commentData.coordinates,
        element_id: commentData.elementId,
        parent_comment_id: commentData.parentCommentId,
        created_at: new Date().toISOString()
      });

    if (error) {
      console.error('Failed to store comment:', error);
      return;
    }

    // Broadcast to other users
    for (const channel of this.channels.values()) {
      await channel.send({
        type: 'broadcast',
        event: 'comment_event',
        payload: event
      });
    }
  }

  /**
   * Send annotation event (map annotations, drawings)
   */
  async sendAnnotation(annotationData: {
    type: 'marker' | 'polygon' | 'line' | 'circle' | 'text';
    coordinates: { lat: number; lng: number }[];
    style?: any;
    text?: string;
    projectId?: string;
    siteId?: string;
  }): Promise<void> {
    if (!this.currentUser || !this.isConnected) return;

    const event: CollaborationEvent = {
      id: crypto.randomUUID(),
      type: 'annotation',
      userId: this.currentUser.id,
      timestamp: new Date(),
      data: annotationData,
      projectId: annotationData.projectId,
      siteId: annotationData.siteId
    };

    // Store annotation in database
    const { error } = await supabase
      .from('collaboration_annotations')
      .insert({
        id: event.id,
        user_id: this.currentUser.id,
        project_id: annotationData.projectId,
        site_id: annotationData.siteId,
        annotation_type: annotationData.type,
        coordinates: annotationData.coordinates,
        style_data: annotationData.style,
        text_content: annotationData.text,
        created_at: new Date().toISOString()
      });

    if (error) {
      console.error('Failed to store annotation:', error);
      return;
    }

    // Broadcast to other users
    for (const channel of this.channels.values()) {
      await channel.send({
        type: 'broadcast',
        event: 'annotation_event',
        payload: event
      });
    }
  }

  /**
   * Get list of online users
   */
  getOnlineUsers(): CollaborationUser[] {
    const users: CollaborationUser[] = [];
    
    Object.values(this.presenceState).forEach((presences: any[]) => {
      presences.forEach((presence) => {
        if (presence.user) {
          users.push({
            ...presence.user,
            status: 'online',
            lastSeen: new Date(presence.online_at)
          });
        }
      });
    });

    return users;
  }

  /**
   * Get cursor positions of other users
   */
  getCursorPositions(): Map<string, CursorPosition> {
    // Filter out current user's cursor
    const otherCursors = new Map(this.cursorPositions);
    if (this.currentUser) {
      otherCursors.delete(this.currentUser.id);
    }
    return otherCursors;
  }

  /**
   * Update user status
   */
  async updateUserStatus(status: 'online' | 'away' | 'offline'): Promise<void> {
    if (!this.currentUser) return;

    this.currentUser.status = status;
    this.currentUser.lastSeen = new Date();

    // Update presence in all channels
    for (const channel of this.channels.values()) {
      await channel.track({
        user: this.currentUser,
        online_at: new Date().toISOString()
      });
    }
  }

  /**
   * Update user location (current page/project/site)
   */
  async updateUserLocation(location: CollaborationUser['currentLocation']): Promise<void> {
    if (!this.currentUser) return;

    this.currentUser.currentLocation = location;

    // Update presence in all channels
    for (const channel of this.channels.values()) {
      await channel.track({
        user: this.currentUser,
        online_at: new Date().toISOString()
      });
    }
  }

  /**
   * Add event listener
   */
  addEventListener(event: string, handler: Function): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, []);
    }
    this.eventHandlers.get(event)!.push(handler);
  }

  /**
   * Remove event listener
   */
  removeEventListener(event: string, handler: Function): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }
  }

  /**
   * Get collaboration history for a room
   */
  async getCollaborationHistory(
    roomId: string,
    roomType: 'project' | 'site' | 'global',
    limit: number = 50
  ): Promise<CollaborationEvent[]> {
    const { data, error } = await supabase
      .from('collaboration_events')
      .select('*')
      .eq(roomType === 'project' ? 'project_id' : 'site_id', roomId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Failed to fetch collaboration history:', error);
      return [];
    }

    return data.map(event => ({
      id: event.id,
      type: event.event_type,
      userId: event.user_id,
      timestamp: new Date(event.created_at),
      data: event.event_data,
      projectId: event.project_id,
      siteId: event.site_id
    }));
  }

  /**
   * Cleanup and disconnect
   */
  async disconnect(): Promise<void> {
    for (const [channelName, channel] of this.channels.entries()) {
      await channel.unsubscribe();
      this.channels.delete(channelName);
    }
    
    this.isConnected = false;
    this.presenceState = {};
    this.cursorPositions.clear();
    this.eventHandlers.clear();
  }

  // Private event handlers
  private handleCursorMove(payload: any): void {
    const cursorData = payload.payload as CursorPosition;
    
    // Don't handle our own cursor
    if (cursorData.userId === this.currentUser?.id) return;
    
    this.cursorPositions.set(cursorData.userId, cursorData);
    this.emitEvent('cursor_move', cursorData);
  }

  private handleMapInteraction(payload: any): void {
    const mapData = payload.payload as MapInteraction;
    
    // Don't handle our own interactions
    if (mapData.userId === this.currentUser?.id) return;
    
    this.emitEvent('map_interaction', mapData);
  }

  private handleEditEvent(payload: any): void {
    const event = payload.payload as CollaborationEvent;
    
    // Don't handle our own edits
    if (event.userId === this.currentUser?.id) return;
    
    this.emitEvent('edit_event', event);
  }

  private handleCommentEvent(payload: any): void {
    const event = payload.payload as CollaborationEvent;
    
    // Don't handle our own comments
    if (event.userId === this.currentUser?.id) return;
    
    this.emitEvent('comment_event', event);
  }

  private handleAnnotationEvent(payload: any): void {
    const event = payload.payload as CollaborationEvent;
    
    // Don't handle our own annotations
    if (event.userId === this.currentUser?.id) return;
    
    this.emitEvent('annotation_event', event);
  }

  private emitEvent(event: string, data: any): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(data);
        } catch (error) {
          console.error(`Error in event handler for ${event}:`, error);
        }
      });
    }
  }
}

// Export singleton instance
export const collaborationManager = new RealtimeCollaborationManager();

// React hook for collaboration
export function useRealtimeCollaboration(roomId?: string, roomType: 'project' | 'site' | 'global' = 'project') {
  const [onlineUsers, setOnlineUsers] = React.useState<CollaborationUser[]>([]);
  const [cursorPositions, setCursorPositions] = React.useState<Map<string, CursorPosition>>(new Map());
  const [isConnected, setIsConnected] = React.useState(false);

  React.useEffect(() => {
    if (!roomId) return;

    const handlePresenceSync = (users: CollaborationUser[]) => {
      setOnlineUsers(users);
    };

    const handleCursorMove = () => {
      setCursorPositions(new Map(collaborationManager.getCursorPositions()));
    };

    const handleConnected = () => {
      setIsConnected(true);
    };

    const handleDisconnected = () => {
      setIsConnected(false);
    };

    // Add event listeners
    collaborationManager.addEventListener('presence_sync', handlePresenceSync);
    collaborationManager.addEventListener('cursor_move', handleCursorMove);
    collaborationManager.addEventListener('connected', handleConnected);
    collaborationManager.addEventListener('disconnected', handleDisconnected);

    // Join room
    collaborationManager.joinRoom(roomId, roomType);

    return () => {
      // Remove event listeners
      collaborationManager.removeEventListener('presence_sync', handlePresenceSync);
      collaborationManager.removeEventListener('cursor_move', handleCursorMove);
      collaborationManager.removeEventListener('connected', handleConnected);
      collaborationManager.removeEventListener('disconnected', handleDisconnected);

      // Leave room
      collaborationManager.leaveRoom(roomId, roomType);
    };
  }, [roomId, roomType]);

  return {
    onlineUsers,
    cursorPositions,
    isConnected,
    sendCursorPosition: collaborationManager.sendCursorPosition.bind(collaborationManager),
    sendMapInteraction: collaborationManager.sendMapInteraction.bind(collaborationManager),
    sendEditEvent: collaborationManager.sendEditEvent.bind(collaborationManager),
    sendComment: collaborationManager.sendComment.bind(collaborationManager),
    sendAnnotation: collaborationManager.sendAnnotation.bind(collaborationManager),
    updateUserStatus: collaborationManager.updateUserStatus.bind(collaborationManager),
    updateUserLocation: collaborationManager.updateUserLocation.bind(collaborationManager)
  };
}