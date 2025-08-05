import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from '@/hooks/useAuth';
import { User, Settings as SettingsIcon, Database, Shield } from "lucide-react";

const Settings = () => {
  const { user, signOut } = useAuth();

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
                    placeholder="Enter your display name"
                    className="bg-slate-700/50 border-slate-600 text-slate-200"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="company" className="text-slate-200">Company</Label>
                  <Input 
                    id="company" 
                    placeholder="Enter your company name"
                    className="bg-slate-700/50 border-slate-600 text-slate-200"
                  />
                </div>
                <div className="flex gap-2">
                  <Button className="bg-blue-600 hover:bg-blue-700">Save Changes</Button>
                  <Button variant="outline" className="border-slate-600 text-slate-200 hover:bg-slate-700">
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
          
          <TabsContent value="data" className="mt-6">
            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader>
                <CardTitle className="text-slate-100">Data Management</CardTitle>
                <CardDescription className="text-slate-400">
                  Import and export your geological data
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-slate-400">Data import/export features coming soon...</p>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="security" className="mt-6">
            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader>
                <CardTitle className="text-slate-100">Security Settings</CardTitle>
                <CardDescription className="text-slate-400">
                  Manage your account security
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-slate-700/30 rounded-lg">
                  <div>
                    <h4 className="text-slate-200 font-medium">Change Password</h4>
                    <p className="text-sm text-slate-400">Update your account password</p>
                  </div>
                  <Button variant="outline" className="border-slate-600 text-slate-200 hover:bg-slate-700">
                    Change
                  </Button>
                </div>
                
                <div className="flex items-center justify-between p-4 bg-slate-700/30 rounded-lg">
                  <div>
                    <h4 className="text-slate-200 font-medium">Two-Factor Authentication</h4>
                    <p className="text-sm text-slate-400">Add an extra layer of security</p>
                  </div>
                  <Button variant="outline" className="border-slate-600 text-slate-200 hover:bg-slate-700">
                    Enable
                  </Button>
                </div>
                
                <div className="border-t border-slate-700 pt-4">
                  <Button 
                    variant="destructive" 
                    onClick={signOut}
                    className="bg-red-600 hover:bg-red-700"
                  >
                    Sign Out
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Settings;