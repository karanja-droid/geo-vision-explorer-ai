
import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { 
  TrendingUp, 
  MapPin, 
  Zap, 
  Activity,
  Target,
  Database,
  FolderOpen
} from "lucide-react";
import { useProjects } from '@/hooks/useProjects';

const MetricsDashboard = () => {
  const { projects, loading, getProjectStats } = useProjects();
  const stats = getProjectStats();

  // Show real data if we have projects, otherwise show mock data
  const metrics = projects.length > 0 ? [
    {
      title: "Total Projects",
      value: stats.total.toString(),
      change: "+12%",
      changeType: "positive",
      icon: FolderOpen,
      description: "Active exploration projects",
      color: "blue"
    },
    {
      title: "Active Projects",
      value: stats.active.toString(),
      change: "+2.3%",
      changeType: "positive",
      icon: Activity,
      description: "Currently in progress",
      color: "green"
    },
    {
      title: "Total Budget",
      value: `$${(stats.totalBudget / 1000000).toFixed(1)}M`,
      change: "+15%",
      changeType: "positive",
      icon: TrendingUp,
      description: "Allocated funds",
      color: "purple"
    }
  ] : [
    {
      title: "Active Exploration Sites",
      value: "247",
      change: "+12%",
      changeType: "positive",
      icon: MapPin,
      description: "Across 15 countries",
      color: "blue"
    },
    {
      title: "AI Model Accuracy",
      value: "94.7%",
      change: "+2.3%",
      changeType: "positive",
      icon: Zap,
      description: "Mineral prediction models",
      color: "purple"
    },
    {
      title: "Processing Queue",
      value: "1,847",
      change: "-8%",
      changeType: "positive",
      icon: Activity,
      description: "Satellite images analyzed",
      color: "green"
    }
  ];

  const getColorClasses = (color: string) => {
    const colors = {
      blue: "bg-blue-500/20 text-blue-300 border-blue-500/30",
      purple: "bg-purple-500/20 text-purple-300 border-purple-500/30",
      green: "bg-green-500/20 text-green-300 border-green-500/30"
    };
    return colors[color as keyof typeof colors];
  };

  const getIconColor = (color: string) => {
    const colors = {
      blue: "text-blue-400",
      purple: "text-purple-400",
      green: "text-green-400"
    };
    return colors[color as keyof typeof colors];
  };

  return (
    <>
      {metrics.map((metric, index) => {
        const IconComponent = metric.icon;
        return (
          <Card key={index} className="bg-slate-800/50 border-slate-700 backdrop-blur-sm hover:bg-slate-800/70 transition-all duration-300">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-slate-300">
                {metric.title}
              </CardTitle>
              <IconComponent className={`h-4 w-4 ${getIconColor(metric.color)}`} />
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between mb-2">
                <div className="text-2xl font-bold text-slate-100">{metric.value}</div>
                <Badge variant="secondary" className={getColorClasses(metric.color)}>
                  {metric.change}
                </Badge>
              </div>
              <p className="text-xs text-slate-400 mb-3">
                {metric.description}
              </p>
              <Progress 
                value={Math.random() * 100} 
                className="h-1 bg-slate-700"
              />
            </CardContent>
          </Card>
        );
      })}
    </>
  );
};

export default MetricsDashboard;
