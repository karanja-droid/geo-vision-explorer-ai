import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from '@/hooks/useAuth';
import { useProfiles } from '@/hooks/useProfiles';
import { useActivityLogs } from '@/hooks/useActivityLogs';
import { SecuritySettings } from '@/components/security/SecuritySettings';
import { ROLE_LABELS } from '@/hooks/useRolePermissions';
import { User, Settings as SettingsIcon, Database, Shield, Activity } from "lucide-react";
import EnhancedDataButton from '@/components/EnhancedDataButton';

const Settings = () => {
  const { user, signOut } = useAuth();
  const { profile, loading: profileLoading, createProfile, updateProfile } = useProfiles();
  const { logs, loading: logsLoading } = useActivityLogs();
  
  const [formData, setFormData] = useState({
    display_name: '',
    company: '',
    phone: '',
    department: ''
  });

  useEffect(() => {
    if (profile) {
      setFormData({
        display_name: profile.display_name || '',
        company: profile.company || '',
        phone: profile.phone || '',
        department: profile.department || ''
      });
    }
  }, [profile]);

  const handleSaveProfile = async () => {
    try {
      if (profile) {
        await updateProfile({ id: profile.id, ...formData });
      } else {
        await createProfile(formData);
      }
    } catch (error) {
      console.error('Error saving profile:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Settings</h1>
          <p className="text-slate-400">Manage your account and application preferences</p>
        </div>
        
        <Tabs defaultValue="profile" className="w-full">
          <TabsList className="grid w-full grid-cols-4 bg-slate-800/50 border-slate-700">
            <TabsTrigger 
              value="profile" 
              className="data-[state=active]:bg-blue-600 data-[state=active]:text-white"
            >
              <User className="w-4 h-4 mr-2" />
              Profile
            </TabsTrigger>
            <TabsTrigger 
              value="preferences" 
              className="data-[state=active]:bg-blue-600 data-[state=active]:text-white"
            >
              <SettingsIcon className="w-4 h-4 mr-2" />
              Preferences
            </TabsTrigger>
            <TabsTrigger 
              value="data" 
              className="data-[state=active]:bg-blue-600 data-[state=active]:text-white"
            >
              <Database className="w-4 h-4 mr-2" />
              Data
            </TabsTrigger>
            <TabsTrigger 
              value="security" 
              className="data-[state=active]:bg-blue-600 data-[state=active]:text-white"
            >
              <Shield className="w-4 h-4 mr-2" />
              Security
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="profile" className="mt-6">
            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader>
                <CardTitle className="text-slate-100">User Profile</CardTitle>
                <CardDescription className="text-slate-400">
                  Manage your personal information
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-slate-200">Email</Label>
                  <Input 
                    id="email" 
                    type="email" 
                    value={user?.email || ''} 
                    disabled
                    className="bg-slate-700/50 border-slate-600 text-slate-200"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="display-name" className="text-slate-200">Display Name</Label>
                  <Input 
                    id="display-name" 
                    value={formData.display_name}
                    onChange={(e) => setFormData(prev => ({ ...prev, display_name: e.target.value }))}
                    placeholder="Enter your display name"
                    className="bg-slate-700/50 border-slate-600 text-slate-200"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="company" className="text-slate-200">Company</Label>
                  <Input 
                    id="company" 
                    value={formData.company}
                    onChange={(e) => setFormData(prev => ({ ...prev, company: e.target.value }))}
                    placeholder="Enter your company name"
                    className="bg-slate-700/50 border-slate-600 text-slate-200"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone" className="text-slate-200">Phone</Label>
                  <Input 
                    id="phone" 
                    value={formData.phone}
                    onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                    placeholder="Enter your phone number"
                    className="bg-slate-700/50 border-slate-600 text-slate-200"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="department" className="text-slate-200">Department</Label>
                    <Input 
                      id="department" 
                      value={formData.department}
                      onChange={(e) => setFormData(prev => ({ ...prev, department: e.target.value }))}
                      placeholder="Enter your department"
                      className="bg-slate-700/50 border-slate-600 text-slate-200"
                    />
                  </div>
                   <div className="space-y-2">
                     <Label htmlFor="role" className="text-slate-200">Role</Label>
                     <div className="bg-slate-700/50 border border-slate-600 rounded-md px-3 py-2 text-slate-200">
                       {profile?.role ? ROLE_LABELS[profile.role as keyof typeof ROLE_LABELS] || profile.role : 'Loading...'}
                     </div>
                     <p className="text-sm text-slate-400">
                       Contact an administrator to change your role
                     </p>
                   </div>
                </div>
                <div className="flex gap-2">
                  <Button 
                    onClick={handleSaveProfile}
                    disabled={profileLoading}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    {profileLoading ? 'Saving...' : 'Save Changes'}
                  </Button>
                  <Button 
                    variant="outline" 
                     onClick={() => setFormData({
                       display_name: profile?.display_name || '',
                       company: profile?.company || '',
                       phone: profile?.phone || '',
                       department: profile?.department || ''
                     })}
                    className="border-slate-600 text-slate-200 hover:bg-slate-700"
                  >
                    Cancel
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="preferences" className="mt-6">
            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader>
                <CardTitle className="text-slate-100">Application Preferences</CardTitle>
                <CardDescription className="text-slate-400">
                  Customize your application experience
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-slate-400">Preferences settings coming soon...</p>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="data" className="mt-6 space-y-6">
            <EnhancedDataButton />
            
            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader>
                <CardTitle className="text-slate-100 flex items-center gap-2">
                  <Activity className="w-5 h-5" />
                  Activity Logs
                </CardTitle>
                <CardDescription className="text-slate-400">
                  Recent activity in your account
                </CardDescription>
              </CardHeader>
              <CardContent>
                {logsLoading ? (
                  <p className="text-slate-400">Loading activity logs...</p>
                ) : logs.length === 0 ? (
                  <p className="text-slate-400">No activity logs found</p>
                ) : (
                  <div className="space-y-2">
                    {logs.slice(0, 10).map((log) => (
                      <div key={log.id} className="flex items-center justify-between p-3 bg-slate-700/30 rounded-lg">
                        <div>
                          <p className="text-slate-200 font-medium">
                            {log.action} {log.entity_type}
                          </p>
                          <p className="text-sm text-slate-400">
                            {new Date(log.created_at).toLocaleString()}
                          </p>
                        </div>
                        <div className="text-sm text-slate-400">
                          ID: {log.entity_id.slice(0, 8)}...
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="security" className="mt-6">
            <SecuritySettings />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Settings;