
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { 
  Users, 
  MessageCircle, 
  Video, 
  Share,
  Bell,
  Activity,
  Eye,
  Edit,
  Send
} from "lucide-react";
import { useCollaboration } from '@/hooks/useCollaboration';

const RealtimeCollaboration = () => {
  const [message, setMessage] = useState('');
  const { activeUsers, activities, logActivity } = useCollaboration();

  // Transform activities for display
  const recentActivity = activities.slice(0, 10).map(activity => ({
    user: "Unknown User", // Would be populated with user profile data
    action: activity.action,
    time: new Date(activity.created_at).toLocaleString(),
    type: activity.entity_type
  }));

  // Mock messages for now - would be from real-time messaging system
  const [messages] = useState([
    { id: 1, user: "Dr. Sarah Chen", message: "The gold prospects in Sector 7 look very promising", time: "10:23 AM", avatar: "SC" },
    { id: 2, user: "Mike Rodriguez", message: "I've updated the mineral density layers with the latest satellite data", time: "10:25 AM", avatar: "MR" },
    { id: 3, user: "Emily Zhang", message: "AI model is showing 94% confidence for lithium deposits in the northern region", time: "10:28 AM", avatar: "EZ" }
  ]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "online": return "bg-green-500";
      case "away": return "bg-yellow-500";
      case "offline": return "bg-gray-500";
      default: return "bg-gray-500";
    }
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case "update": return <Edit className="w-3 h-3" />;
      case "addition": return <Activity className="w-3 h-3" />;
      case "completion": return <Activity className="w-3 h-3" />;
      case "upload": return <Share className="w-3 h-3" />;
      default: return <Activity className="w-3 h-3" />;
    }
  };

  const sendMessage = () => {
    if (message.trim()) {
      // Log the message activity
      logActivity({
        entity_type: 'message',
        entity_id: 'chat',
        action: 'send_message',
        details: { message: message.trim() }
      });
      console.log("Sending message:", message);
      setMessage('');
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Active Users Panel */}
      <Card className="bg-slate-800/50 border-slate-700 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-slate-100 flex items-center gap-2">
            <Users className="w-5 h-5 text-green-400" />
            Active Team Members
          </CardTitle>
          <CardDescription className="text-slate-400">
            Currently online and collaborating
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {activeUsers.map((user) => (
              <div key={user.id} className="flex items-center gap-3 p-3 bg-slate-700/30 rounded-lg">
                <div className="relative">
                  <Avatar className="w-10 h-10">
                    <AvatarFallback className="bg-gradient-to-r from-blue-500 to-purple-500 text-white">
                      {user.avatar}
                    </AvatarFallback>
                  </Avatar>
                  <div className={`absolute -bottom-1 -right-1 w-3 h-3 ${getStatusColor(user.status)} rounded-full border-2 border-slate-800`}></div>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-slate-200 truncate">{user.name}</p>
                  <p className="text-xs text-slate-400">{user.role}</p>
                  <p className="text-xs text-slate-500 truncate">{user.activity}</p>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="sm" className="text-slate-400 hover:text-white p-1">
                    <MessageCircle className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="sm" className="text-slate-400 hover:text-white p-1">
                    <Video className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 pt-4 border-t border-slate-700">
            <div className="flex items-center justify-between">
              <Badge variant="secondary" className="bg-green-500/20 text-green-300 border-green-500/30">
                <div className="w-2 h-2 bg-green-500 rounded-full mr-1 animate-pulse" />
                {activeUsers.filter(u => u.status === "online").length} Online
              </Badge>
              <Button variant="outline" size="sm" className="border-slate-600 text-slate-300">
                <Share className="w-4 h-4 mr-1" />
                Invite
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Real-time Chat */}
      <Card className="bg-slate-800/50 border-slate-700 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-slate-100 flex items-center gap-2">
            <MessageCircle className="w-5 h-5 text-blue-400" />
            Team Communication
          </CardTitle>
          <CardDescription className="text-slate-400">
            Real-time project discussions
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4 mb-4 max-h-64 overflow-y-auto">
            {messages.map((msg) => (
              <div key={msg.id} className="flex items-start gap-3">
                <Avatar className="w-8 h-8">
                  <AvatarFallback className="bg-gradient-to-r from-blue-500 to-purple-500 text-white text-xs">
                    {msg.avatar}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-slate-200 text-sm">{msg.user}</span>
                    <span className="text-xs text-slate-500">{msg.time}</span>
                  </div>
                  <p className="text-sm text-slate-300 bg-slate-700/30 p-2 rounded-lg">
                    {msg.message}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <Input
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Type your message..."
              className="bg-slate-700 border-slate-600 text-slate-200"
              onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
            />
            <Button onClick={sendMessage} size="sm" className="bg-blue-600 hover:bg-blue-700">
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Activity Feed */}
      <Card className="bg-slate-800/50 border-slate-700 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-slate-100 flex items-center gap-2">
            <Activity className="w-5 h-5 text-orange-400" />
            Recent Activity
          </CardTitle>
          <CardDescription className="text-slate-400">
            Live updates from team members
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {recentActivity.map((activity, index) => (
              <div key={index} className="flex items-start gap-3 p-3 bg-slate-700/30 rounded-lg">
                <div className="w-8 h-8 bg-orange-500/20 rounded-full flex items-center justify-center text-orange-400">
                  {getActivityIcon(activity.type)}
                </div>
                <div className="flex-1 space-y-1">
                  <p className="text-sm text-slate-200">
                    <span className="font-medium">{activity.user}</span>
                  </p>
                  <p className="text-sm text-slate-300">{activity.action}</p>
                  <p className="text-xs text-slate-500">{activity.time}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 pt-4 border-t border-slate-700">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4 text-slate-400" />
                <span className="text-sm text-slate-400">Live notifications</span>
              </div>
              <Badge variant="secondary" className="bg-orange-500/20 text-orange-300 border-orange-500/30">
                <Activity className="w-3 h-3 mr-1" />
                Real-time
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default RealtimeCollaboration;
