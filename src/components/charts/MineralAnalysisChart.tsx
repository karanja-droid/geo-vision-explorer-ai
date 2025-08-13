import React from 'react';
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ComposedChart,
  Bar,
  Line,
  Area,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Gem, TrendingUp, Zap, Target } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MineralData {
  id: string;
  name: string;
  mineral_type: string;
  grade: number;
  tonnage: number;
  confidence_level: number;
  depth: number;
  coordinates: {
    latitude: number;
    longitude: number;
  };
  predictions?: Array<{
    confidence_score: number;
    predicted_grade: number;
    predicted_tonnage: number;
    model_name: string;
  }>;
}

interface MineralAnalysisChartProps {
  deposits: MineralData[];
  selectedMineral?: string;
  onMineralSelect?: (mineral: string) => void;
  className?: string;
}

const MINERAL_COLORS = {
  Gold: '#FFD700',
  Silver: '#C0C0C0',
  Copper: '#B87333',
  Iron: '#8B4513',
  Lead: '#2F4F4F',
  Zinc: '#708090',
  Nickel: '#32CD32',
  Platinum: '#E5E4E2',
  Coal: '#36454F',
  Diamond: '#B9F2FF',
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-white p-4 border border-gray-200 rounded-lg shadow-lg max-w-xs">
        <p className="font-medium text-gray-900 mb-2">{data.name}</p>
        <div className="space-y-1 text-sm">
          <p><span className="font-medium">Mineral:</span> {data.mineral_type}</p>
          <p><span className="font-medium">Grade:</span> {data.grade}%</p>
          <p><span className="font-medium">Tonnage:</span> {data.tonnage?.toLocaleString()} tons</p>
          <p><span className="font-medium">Confidence:</span> {data.confidence_level}%</p>
          <p><span className="font-medium">Depth:</span> {data.depth}m</p>
        </div>
      </div>
    );
  }
  return null;
};

const getConfidenceColor = (confidence: number) => {
  if (confidence >= 80) return '#10B981'; // green
  if (confidence >= 60) return '#F59E0B'; // yellow
  return '#EF4444'; // red
};

const getGradeSize = (grade: number) => {
  return Math.max(20, Math.min(200, grade * 10));
};

export function MineralAnalysisChart({ 
  deposits, 
  selectedMineral, 
  onMineralSelect, 
  className 
}: MineralAnalysisChartProps) {
  const mineralTypes = [...new Set(deposits.map(d => d.mineral_type))];
  
  const filteredDeposits = selectedMineral 
    ? deposits.filter(d => d.mineral_type === selectedMineral)
    : deposits;

  // Prepare data for different chart types
  const scatterData = filteredDeposits.map(deposit => ({
    ...deposit,
    x: deposit.grade,
    y: deposit.tonnage || 0,
    z: deposit.confidence_level,
    color: getConfidenceColor(deposit.confidence_level),
    size: getGradeSize(deposit.grade),
  }));

  const radarData = mineralTypes.map(mineral => {
    const mineralDeposits = deposits.filter(d => d.mineral_type === mineral);
    const avgGrade = mineralDeposits.reduce((sum, d) => sum + d.grade, 0) / mineralDeposits.length;
    const avgConfidence = mineralDeposits.reduce((sum, d) => sum + d.confidence_level, 0) / mineralDeposits.length;
    const avgTonnage = mineralDeposits.reduce((sum, d) => sum + (d.tonnage || 0), 0) / mineralDeposits.length;
    const avgDepth = mineralDeposits.reduce((sum, d) => sum + (d.depth || 0), 0) / mineralDeposits.length;
    
    return {
      mineral,
      grade: avgGrade,
      confidence: avgConfidence,
      tonnage: avgTonnage / 1000, // Convert to thousands for better scale
      depth: avgDepth / 100, // Convert to hundreds for better scale
      count: mineralDeposits.length,
    };
  });

  const gradeDistribution = mineralTypes.map(mineral => {
    const mineralDeposits = deposits.filter(d => d.mineral_type === mineral);
    const grades = mineralDeposits.map(d => d.grade).sort((a, b) => a - b);
    
    return {
      mineral,
      min: grades[0] || 0,
      q1: grades[Math.floor(grades.length * 0.25)] || 0,
      median: grades[Math.floor(grades.length * 0.5)] || 0,
      q3: grades[Math.floor(grades.length * 0.75)] || 0,
      max: grades[grades.length - 1] || 0,
      average: mineralDeposits.reduce((sum, d) => sum + d.grade, 0) / mineralDeposits.length,
    };
  });

  const predictionAccuracy = deposits
    .filter(d => d.predictions && d.predictions.length > 0)
    .map(deposit => {
      const bestPrediction = deposit.predictions!.reduce((best, pred) => 
        pred.confidence_score > best.confidence_score ? pred : best
      );
      
      return {
        name: deposit.name,
        actualGrade: deposit.grade,
        predictedGrade: bestPrediction.predicted_grade,
        accuracy: 100 - Math.abs(deposit.grade - bestPrediction.predicted_grade) / deposit.grade * 100,
        confidence: bestPrediction.confidence_score * 100,
        model: bestPrediction.model_name,
      };
    });

  return (
    <div className={cn('space-y-6', className)}>
      {/* Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Gem className="h-5 w-5 text-purple-600" />
            <h3 className="text-lg font-semibold">Mineral Analysis</h3>
          </div>
          <Badge variant="secondary">
            {filteredDeposits.length} deposits
          </Badge>
        </div>
        
        <Select value={selectedMineral || 'all'} onValueChange={onMineralSelect}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Select mineral type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Minerals</SelectItem>
            {mineralTypes.map(mineral => (
              <SelectItem key={mineral} value={mineral}>
                {mineral}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Charts */}
      <Tabs defaultValue="scatter" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="scatter">Grade vs Tonnage</TabsTrigger>
          <TabsTrigger value="radar">Mineral Profile</TabsTrigger>
          <TabsTrigger value="distribution">Grade Distribution</TabsTrigger>
          <TabsTrigger value="predictions">AI Predictions</TabsTrigger>
        </TabsList>

        <TabsContent value="scatter" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5" />
                Grade vs Tonnage Analysis
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <ScatterChart data={scatterData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    type="number" 
                    dataKey="x" 
                    name="Grade (%)"
                    label={{ value: 'Grade (%)', position: 'insideBottom', offset: -10 }}
                  />
                  <YAxis 
                    type="number" 
                    dataKey="y" 
                    name="Tonnage"
                    label={{ value: 'Tonnage (tons)', angle: -90, position: 'insideLeft' }}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  {mineralTypes.map((mineral, index) => (
                    <Scatter
                      key={mineral}
                      name={mineral}
                      data={scatterData.filter(d => d.mineral_type === mineral)}
                      fill={MINERAL_COLORS[mineral as keyof typeof MINERAL_COLORS] || `hsl(${index * 137.5}, 70%, 50%)`}
                    />
                  ))}
                </ScatterChart>
              </ResponsiveContainer>
              <div className="mt-4 text-sm text-gray-600">
                <p>• Bubble size represents grade percentage</p>
                <p>• Color intensity indicates confidence level</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="radar" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5" />
                Mineral Profile Comparison
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <RadarChart data={radarData}>
                  <PolarGrid />
                  <PolarAngleAxis dataKey="mineral" />
                  <PolarRadiusAxis angle={90} domain={[0, 'dataMax']} />
                  <Radar
                    name="Average Grade"
                    dataKey="grade"
                    stroke="#8884d8"
                    fill="#8884d8"
                    fillOpacity={0.3}
                  />
                  <Radar
                    name="Confidence Level"
                    dataKey="confidence"
                    stroke="#82ca9d"
                    fill="#82ca9d"
                    fillOpacity={0.3}
                  />
                  <Tooltip />
                  <Legend />
                </RadarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="distribution" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Grade Distribution by Mineral
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <ComposedChart data={gradeDistribution}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="mineral" />
                  <YAxis label={{ value: 'Grade (%)', angle: -90, position: 'insideLeft' }} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="min" fill="#e3f2fd" name="Min Grade" />
                  <Bar dataKey="max" fill="#bbdefb" name="Max Grade" />
                  <Line 
                    type="monotone" 
                    dataKey="average" 
                    stroke="#1976d2" 
                    strokeWidth={3}
                    name="Average Grade"
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="predictions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5" />
                AI Prediction Accuracy
              </CardTitle>
            </CardHeader>
            <CardContent>
              {predictionAccuracy.length > 0 ? (
                <ResponsiveContainer width="100%" height={400}>
                  <ScatterChart data={predictionAccuracy}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      type="number" 
                      dataKey="actualGrade" 
                      name="Actual Grade"
                      label={{ value: 'Actual Grade (%)', position: 'insideBottom', offset: -10 }}
                    />
                    <YAxis 
                      type="number" 
                      dataKey="predictedGrade" 
                      name="Predicted Grade"
                      label={{ value: 'Predicted Grade (%)', angle: -90, position: 'insideLeft' }}
                    />
                    <Tooltip 
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          return (
                            <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
                              <p className="font-medium text-gray-900">{data.name}</p>
                              <p className="text-sm">Actual: {data.actualGrade.toFixed(2)}%</p>
                              <p className="text-sm">Predicted: {data.predictedGrade.toFixed(2)}%</p>
                              <p className="text-sm">Accuracy: {data.accuracy.toFixed(1)}%</p>
                              <p className="text-sm">Model: {data.model}</p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Scatter
                      name="Predictions"
                      data={predictionAccuracy}
                      fill="#8884d8"
                    />
                  </ScatterChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-64 text-gray-500">
                  <div className="text-center">
                    <Target className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No AI predictions available</p>
                    <p className="text-sm">Run AI analysis to see prediction accuracy</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default MineralAnalysisChart;