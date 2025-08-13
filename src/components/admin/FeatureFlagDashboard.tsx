import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Settings, 
  Flag, 
  Users, 
  BarChart3, 
  History, 
  TestTube,
  Search,
  Plus,
  Edit,
  Trash2,
  Eye,
  EyeOff
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useFeatureFlags } from '@/config/featureFlags';

interface FeatureFlag {
  id: string;
  flag_name: string;
  display_name: string;
  description: string;
  flag_category: 'phase_a' | 'phase_b' | 'phase_c' | 'advanced' | 'experimental';
  is_enabled: boolean;
  is_active: boolean;
  rollout_percentage: number;
  target_audience: any;
  dependencies: string[];
  created_at: string;
  updated_at: string;
}

interface FeatureFlagHistory {
  id: string;
  flag_id: string;
  previous_state: any;
  new_state: any;
  change_reason: string;
  changed_by: string;
  changed_at: string;
}

interface FeatureUsageAnalytics {
  flag_name: string;
  display_name: string;
  total_users: number;
  usage_count: number;
  avg_session_duration: number;
  last_used: string;
}

const FeatureFlagDashboard: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [editingFlag, setEditingFlag] = useState<FeatureFlag | null>(null);
  const queryClient = useQueryClient();
  const { flags: currentFlags } = useFeatureFlags();

  // Fetch feature flags
  const { data: featureFlags, isLoading: flagsLoading } = useQuery({
    queryKey: ['feature-flags'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('feature_flags')
        .select('*')
        .order('flag_category', { ascending: true })
        .order('display_name', { ascending: true });
      
      if (error) throw error;
      return data as FeatureFlag[];
    }
  });

  // Fetch feature flag history
  const { data: flagHistory } = useQuery({
    queryKey: ['feature-flag-history'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('feature_flag_history')
        .select(`
          *,
          feature_flags(display_name)
        `)
        .order('changed_at', { ascending: false })
        .limit(50);
      
      if (error) throw error;
      return data as FeatureFlagHistory[];
    }
  });

  // Fetch usage analytics
  const { data: usageAnalytics } = useQuery({
    queryKey: ['feature-usage-analytics'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('feature_usage_analytics')
        .select(`
          flag_id,
          feature_flags(flag_name, display_name),
          COUNT(*) as usage_count,
          COUNT(DISTINCT user_id) as total_users,
          AVG(session_duration_seconds) as avg_session_duration,
          MAX(created_at) as last_used
        `)
        .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()) // Last 30 days
        .group('flag_id, feature_flags.flag_name, feature_flags.display_name');
      
      if (error) throw error;
      return data as FeatureUsageAnalytics[];
    }
  });

  // Update feature flag
  const updateFlag = useMutation({
    mutationFn: async ({ flagId, updates }: { flagId: string; updates: Partial<FeatureFlag> }) => {
      const { data, error } = await supabase
        .from('feature_flags')
        .update(updates)
        .eq('id', flagId)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success('Feature flag updated successfully');
      queryClient.invalidateQueries({ queryKey: ['feature-flags'] });
      setEditingFlag(null);
    },
    onError: (error: any) => {
      toast.error(`Failed to update flag: ${error.message}`);
    }
  });

  // Toggle feature flag
  const toggleFlag = useMutation({
    mutationFn: async ({ flagId, enabled }: { flagId: string; enabled: boolean }) => {
      const { data, error } = await supabase
        .from('feature_flags')
        .update({ is_enabled: enabled, updated_at: new Date().toISOString() })
        .eq('id', flagId)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast.success(`Feature flag ${data.is_enabled ? 'enabled' : 'disabled'}`);
      queryClient.invalidateQueries({ queryKey: ['feature-flags'] });
    },
    onError: (error: any) => {
      toast.error(`Failed to toggle flag: ${error.message}`);
    }
  });

  // Filter flags based on search and category
  const filteredFlags = featureFlags?.filter(flag => {
    const matchesSearch = flag.display_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         flag.flag_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         flag.description?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesCategory = selectedCategory === 'all' || flag.flag_category === selectedCategory;
    
    return matchesSearch && matchesCategory;
  }) || [];

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'phase_a':
        return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'phase_b':
        return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'phase_c':
        return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
      case 'advanced':
        return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
      case 'experimental':
        return 'bg-red-500/20 text-red-400 border-red-500/30';
      default:
        return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    }
  };

  const getStatusIcon = (isEnabled: boolean, isActive: boolean) => {
    if (!isActive) return <EyeOff className="h-4 w-4 text-gray-500" />;
    return isEnabled ? <Eye className="h-4 w-4 text-green-500" /> : <EyeOff className="h-4 w-4 text-red-500" />;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Feature Flag Management</h2>
          <p className="text-muted-foreground">
            Control feature rollouts and manage A/B tests
          </p>
        </div>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          New Feature Flag
        </Button>
      </div>

      {/* Search and Filters */}
      <div className="flex gap-4">
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search feature flags..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
        <Select value={selectedCategory} onValueChange={setSelectedCategory}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Filter by category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            <SelectItem value="phase_a">Phase A</SelectItem>
            <SelectItem value="phase_b">Phase B</SelectItem>
            <SelectItem value="phase_c">Phase C</SelectItem>
            <SelectItem value="advanced">Advanced</SelectItem>
            <SelectItem value="experimental">Experimental</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Tabs defaultValue="flags" className="space-y-4">
        <TabsList>
          <TabsTrigger value="flags">
            <Flag className="h-4 w-4 mr-2" />
            Feature Flags
          </TabsTrigger>
          <TabsTrigger value="analytics">
            <BarChart3 className="h-4 w-4 mr-2" />
            Usage Analytics
          </TabsTrigger>
          <TabsTrigger value="history">
            <History className="h-4 w-4 mr-2" />
            Change History
          </TabsTrigger>
          <TabsTrigger value="tests">
            <TestTube className="h-4 w-4 mr-2" />
            A/B Tests
          </TabsTrigger>
        </TabsList>

        <TabsContent value="flags" className="space-y-4">
          <div className="grid gap-4">
            {flagsLoading ? (
              <div className="text-center py-8">Loading feature flags...</div>
            ) : filteredFlags.map((flag) => (
              <Card key={flag.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {getStatusIcon(flag.is_enabled, flag.is_active)}
                      <div>
                        <CardTitle className="text-lg">{flag.display_name}</CardTitle>
                        <CardDescription className="font-mono text-sm">
                          {flag.flag_name}
                        </CardDescription>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={getCategoryColor(flag.flag_category)}>
                        {flag.flag_category.replace('_', ' ').toUpperCase()}
                      </Badge>
                      <Switch
                        checked={flag.is_enabled}
                        onCheckedChange={(enabled) => 
                          toggleFlag.mutate({ flagId: flag.id, enabled })
                        }
                        disabled={!flag.is_active || toggleFlag.isPending}
                      />
                      <Button variant="ghost" size="icon">
                        <Edit className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <p className="text-sm text-muted-foreground">{flag.description}</p>
                    
                    <div className="flex items-center gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">Rollout:</span>
                        <span className="ml-1 font-medium">{flag.rollout_percentage}%</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Status:</span>
                        <span className={`ml-1 font-medium ${
                          flag.is_enabled ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {flag.is_enabled ? 'Enabled' : 'Disabled'}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Current State:</span>
                        <span className={`ml-1 font-medium ${
                          currentFlags[flag.flag_name as keyof typeof currentFlags] ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {currentFlags[flag.flag_name as keyof typeof currentFlags] ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                    </div>

                    {flag.dependencies && flag.dependencies.length > 0 && (
                      <div>
                        <span className="text-sm text-muted-foreground">Dependencies:</span>
                        <div className="flex gap-1 mt-1">
                          {flag.dependencies.map((dep) => (
                            <Badge key={dep} variant="secondary" className="text-xs">
                              {dep}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-4">
          <div className="grid gap-4">
            {usageAnalytics?.map((analytics) => (
              <Card key={analytics.flag_name}>
                <CardHeader>
                  <CardTitle className="text-lg">{analytics.display_name}</CardTitle>
                  <CardDescription>{analytics.flag_name}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-4 gap-4 text-sm">
                    <div>
                      <div className="text-muted-foreground">Total Users</div>
                      <div className="text-2xl font-bold">{analytics.total_users}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Usage Count</div>
                      <div className="text-2xl font-bold">{analytics.usage_count}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Avg Session</div>
                      <div className="text-2xl font-bold">
                        {Math.round(analytics.avg_session_duration / 60)}m
                      </div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Last Used</div>
                      <div className="text-sm font-medium">
                        {new Date(analytics.last_used).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <div className="space-y-3">
            {flagHistory?.map((history) => (
              <Card key={history.id}>
                <CardContent className="pt-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">{history.feature_flags?.display_name}</div>
                      <div className="text-sm text-muted-foreground">
                        {history.change_reason || 'Flag state changed'}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-medium">
                        {new Date(history.changed_at).toLocaleString()}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Changed by: {history.changed_by}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="tests" className="space-y-4">
          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-8 text-muted-foreground">
                A/B testing functionality coming soon...
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default FeatureFlagDashboard;