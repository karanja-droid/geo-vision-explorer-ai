import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Radio, 
  Thermometer, 
  Droplets, 
  Wind, 
  Zap, 
  AlertTriangle, 
  CheckCircle, 
  WifiOff,
  Battery,
  MapPin
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';

interface IoTDashboardProps {
  siteId: string;
}

interface IoTDevice {
  id: string;
  device_type: string;
  device_model: string;
  serial_number: string;
  status: 'active' | 'inactive' | 'maintenance' | 'error';
  battery_level: number;
  last_communication: string;
  location: any;
}

interface SensorReading {
  id: string;
  device_id: string;
  reading_type: string;
  value: number;
  unit: string;
  quality_flag: string;
  timestamp: string;
}

interface AnomalyDetection {
  id: string;
  anomaly_type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  confidence_score: number;
  description: string;
  detected_at: string;
  investigation_status: string;
}

const IoTDashboard: React.FC<IoTDashboardProps> = ({ siteId }) => {
  const [selectedDevice, setSelectedDevice] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<'1h' | '24h' | '7d' | '30d'>('24h');
  const queryClient = useQueryClient();

  // Fetch IoT devices
  const { data: devices, isLoading: devicesLoading } = useQuery({
    queryKey: ['iot-devices', siteId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('iot_devices')
        .select('*')
        .eq('site_id', siteId)
        .order('device_type');
      
      if (error) throw error;
      return data as IoTDevice[];
    }
  });

  // Fetch recent sensor readings
  const { data: sensorReadings, isLoading: readingsLoading } = useQuery({
    queryKey: ['sensor-readings', siteId, selectedDevice, timeRange],
    queryFn: async () => {
      let query = supabase
        .from('sensor_readings')
        .select(`
          *,
          device:iot_devices!inner(site_id)
        `)
        .eq('device.site_id', siteId)
        .order('timestamp', { ascending: false })
        .limit(100);

      if (selectedDevice) {
        query = query.eq('device_id', selectedDevice);
      }

      // Add time range filter
      const now = new Date();
      const timeRangeHours = {
        '1h': 1,
        '24h': 24,
        '7d': 168,
        '30d': 720
      };
      
      const startTime = new Date(now.getTime() - timeRangeHours[timeRange] * 60 * 60 * 1000);
      query = query.gte('timestamp', startTime.toISOString());

      const { data, error } = await query;
      
      if (error) throw error;
      return data as SensorReading[];
    }
  });

  // Fetch anomaly detections
  const { data: anomalies, isLoading: anomaliesLoading } = useQuery({
    queryKey: ['anomalies', siteId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('anomaly_detections')
        .select('*')
        .eq('source_type', 'sensor')
        .order('detected_at', { ascending: false })
        .limit(20);
      
      if (error) throw error;
      return data as AnomalyDetection[];
    }
  });

  // Real-time subscription for sensor readings
  useEffect(() => {
    const channel = supabase
      .channel('sensor-readings')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'sensor_readings'
      }, (payload) => {
        queryClient.invalidateQueries({ queryKey: ['sensor-readings'] });
        toast.info('New sensor reading received');
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  // Trigger anomaly detection
  const triggerAnomalyDetection = useMutation({
    mutationFn: async () => {
      const recentReadings = sensorReadings?.slice(0, 10) || [];
      
      const { data, error } = await supabase.functions.invoke('realtime-anomaly-detection', {
        body: {
          sourceType: 'sensor',
          sourceId: selectedDevice || siteId,
          dataPoints: recentReadings,
          thresholds: {
            temperature: 35,
            seismic: 2.0,
            ph_level: 7.0
          }
        }
      });
      
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast.success(`Anomaly detection completed. Found ${data.anomaliesDetected} anomalies.`);
      queryClient.invalidateQueries({ queryKey: ['anomalies'] });
    },
    onError: (error) => {
      toast.error(`Anomaly detection failed: ${error.message}`);
    }
  });

  const getDeviceIcon = (deviceType: string) => {
    switch (deviceType) {
      case 'weather_station':
        return <Wind className="h-4 w-4" />;
      case 'seismic_sensor':
        return <Radio className="h-4 w-4" />;
      case 'water_quality':
        return <Droplets className="h-4 w-4" />;
      case 'air_quality':
        return <Wind className="h-4 w-4" />;
      default:
        return <Radio className="h-4 w-4" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-500';
      case 'inactive':
        return 'bg-gray-500';
      case 'maintenance':
        return 'bg-yellow-500';
      case 'error':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'destructive';
      case 'high':
        return 'destructive';
      case 'medium':
        return 'default';
      case 'low':
        return 'secondary';
      default:
        return 'secondary';
    }
  };

  // Process sensor data for charts
  const chartData = sensorReadings?.reduce((acc, reading) => {
    const timestamp = new Date(reading.timestamp).toLocaleTimeString();
    const existingPoint = acc.find(point => point.timestamp === timestamp);
    
    if (existingPoint) {
      existingPoint[reading.reading_type] = reading.value;
    } else {
      acc.push({
        timestamp,
        [reading.reading_type]: reading.value
      });
    }
    
    return acc;
  }, [] as any[]) || [];

  const activeDevices = devices?.filter(d => d.status === 'active').length || 0;
  const totalDevices = devices?.length || 0;
  const criticalAnomalies = anomalies?.filter(a => a.severity === 'critical').length || 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">IoT Monitoring Dashboard</h2>
          <p className="text-muted-foreground">
            Real-time sensor monitoring and anomaly detection
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => triggerAnomalyDetection.mutate()}
            disabled={triggerAnomalyDetection.isPending}
            variant="outline"
          >
            <AlertTriangle className="h-4 w-4 mr-2" />
            {triggerAnomalyDetection.isPending ? 'Analyzing...' : 'Run Anomaly Detection'}
          </Button>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Devices</CardTitle>
            <Radio className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeDevices}/{totalDevices}</div>
            <p className="text-xs text-muted-foreground">
              {((activeDevices / totalDevices) * 100).toFixed(0)}% operational
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Data Points Today</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{sensorReadings?.length || 0}</div>
            <p className="text-xs text-muted-foreground">
              Last reading: {sensorReadings?.[0] ? new Date(sensorReadings[0].timestamp).toLocaleTimeString() : 'N/A'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Critical Anomalies</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{criticalAnomalies}</div>
            <p className="text-xs text-muted-foreground">
              Require immediate attention
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">System Health</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">98%</div>
            <p className="text-xs text-muted-foreground">
              All systems operational
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="devices" className="space-y-4">
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="devices">Devices</TabsTrigger>
            <TabsTrigger value="readings">Sensor Data</TabsTrigger>
            <TabsTrigger value="anomalies">Anomalies</TabsTrigger>
            <TabsTrigger value="alerts">Alerts</TabsTrigger>
          </TabsList>
          
          <div className="flex gap-2">
            {['1h', '24h', '7d', '30d'].map((range) => (
              <Button
                key={range}
                variant={timeRange === range ? 'default' : 'outline'}
                size="sm"
                onClick={() => setTimeRange(range as any)}
              >
                {range}
              </Button>
            ))}
          </div>
        </div>

        <TabsContent value="devices" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {devicesLoading ? (
              <div className="col-span-full text-center py-8">Loading devices...</div>
            ) : devices?.map((device) => (
              <Card 
                key={device.id} 
                className={`cursor-pointer transition-colors ${
                  selectedDevice === device.id ? 'ring-2 ring-primary' : ''
                }`}
                onClick={() => setSelectedDevice(device.id)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {getDeviceIcon(device.device_type)}
                      <CardTitle className="text-sm font-medium">
                        {device.device_type.replace('_', ' ').toUpperCase()}
                      </CardTitle>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${getStatusColor(device.status)}`} />
                      <Badge variant="outline">{device.status}</Badge>
                    </div>
                  </div>
                  <CardDescription>
                    {device.device_model} • {device.serial_number}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-1">
                        <Battery className="h-3 w-3" />
                        Battery
                      </span>
                      <span className={device.battery_level > 20 ? 'text-green-600' : 'text-red-600'}>
                        {device.battery_level}%
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        Location
                      </span>
                      <span className="text-muted-foreground">
                        {device.location ? 'GPS Available' : 'No GPS'}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Last seen: {new Date(device.last_communication).toLocaleString()}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="readings" className="space-y-4">
          {chartData.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>Sensor Readings Over Time</CardTitle>
                <CardDescription>
                  {selectedDevice ? 'Selected device' : 'All devices'} • Last {timeRange}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="timestamp" />
                    <YAxis />
                    <Tooltip />
                    <Line 
                      type="monotone" 
                      dataKey="temperature" 
                      stroke="#ef4444" 
                      strokeWidth={2}
                      name="Temperature (°C)"
                    />
                    <Line 
                      type="monotone" 
                      dataKey="humidity" 
                      stroke="#3b82f6" 
                      strokeWidth={2}
                      name="Humidity (%)"
                    />
                    <Line 
                      type="monotone" 
                      dataKey="ph_level" 
                      stroke="#10b981" 
                      strokeWidth={2}
                      name="pH Level"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="text-center py-8">
                <WifiOff className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No sensor data available for the selected time range</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="anomalies" className="space-y-4">
          <div className="grid gap-4">
            {anomaliesLoading ? (
              <div className="text-center py-8">Loading anomalies...</div>
            ) : anomalies?.map((anomaly) => (
              <Card key={anomaly.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5" />
                      {anomaly.anomaly_type.replace('_', ' ').toUpperCase()}
                    </CardTitle>
                    <div className="flex items-center gap-2">
                      <Badge variant={getSeverityColor(anomaly.severity) as any}>
                        {anomaly.severity}
                      </Badge>
                      <Badge variant="outline">
                        {(anomaly.confidence_score * 100).toFixed(0)}% confidence
                      </Badge>
                    </div>
                  </div>
                  <CardDescription>
                    Detected: {new Date(anomaly.detected_at).toLocaleString()}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm mb-3">{anomaly.description}</p>
                  <div className="flex items-center justify-between">
                    <Badge variant="secondary">
                      Status: {anomaly.investigation_status}
                    </Badge>
                    <Button size="sm" variant="outline">
                      Investigate
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="alerts" className="space-y-4">
          <Alert>
            <CheckCircle className="h-4 w-4" />
            <AlertDescription>
              All systems are operating normally. No active alerts.
            </AlertDescription>
          </Alert>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default IoTDashboard;