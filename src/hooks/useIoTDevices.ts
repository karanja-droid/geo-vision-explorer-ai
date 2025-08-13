import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useEffect } from 'react';

export interface IoTDevice {
  id: string;
  site_id: string;
  device_type: 'weather_station' | 'seismic_sensor' | 'water_quality' | 'air_quality';
  device_model: string;
  serial_number: string;
  installation_date: string;
  location: any; // PostGIS geometry
  elevation: number;
  status: 'active' | 'inactive' | 'maintenance' | 'error';
  battery_level: number;
  last_communication: string;
  configuration: Record<string, any>;
}

export interface SensorReading {
  id: string;
  device_id: string;
  reading_type: string;
  value: number;
  unit: string;
  quality_flag: 'good' | 'suspect' | 'bad' | 'missing';
  timestamp: string;
  metadata: Record<string, any>;
}

export interface AnomalyDetection {
  id: string;
  source_type: string;
  source_id: string;
  anomaly_type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  confidence_score: number;
  description: string;
  location?: any;
  detected_at: string;
  investigation_status: 'pending' | 'investigating' | 'resolved' | 'false_positive';
}

export const useIoTDevices = (siteId: string) => {
  const queryClient = useQueryClient();

  // Fetch IoT devices
  const {
    data: devices,
    isLoading: devicesLoading,
    error: devicesError
  } = useQuery({
    queryKey: ['iot-devices', siteId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('iot_devices')
        .select('*')
        .eq('site_id', siteId)
        .order('device_type');
      
      if (error) throw error;
      return data as IoTDevice[];
    },
    enabled: !!siteId
  });

  // Fetch sensor readings
  const {
    data: sensorReadings,
    isLoading: readingsLoading
  } = useQuery({
    queryKey: ['sensor-readings', siteId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sensor_readings')
        .select(`
          *,
          device:iot_devices!inner(site_id)
        `)
        .eq('device.site_id', siteId)
        .order('timestamp', { ascending: false })
        .limit(100);
      
      if (error) throw error;
      return data as SensorReading[];
    },
    enabled: !!siteId
  });

  // Fetch anomaly detections
  const {
    data: anomalies,
    isLoading: anomaliesLoading
  } = useQuery({
    queryKey: ['anomaly-detections', siteId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('anomaly_detections')
        .select('*')
        .eq('source_type', 'sensor')
        .order('detected_at', { ascending: false })
        .limit(50);
      
      if (error) throw error;
      return data as AnomalyDetection[];
    },
    enabled: !!siteId
  });

  // Real-time subscription for sensor readings
  useEffect(() => {
    if (!siteId) return;

    const channel = supabase
      .channel(`sensor-readings-${siteId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'sensor_readings'
      }, (payload) => {
        queryClient.invalidateQueries({ queryKey: ['sensor-readings', siteId] });
      })
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'anomaly_detections'
      }, (payload) => {
        queryClient.invalidateQueries({ queryKey: ['anomaly-detections', siteId] });
        
        // Show toast for critical anomalies
        if (payload.new.severity === 'critical') {
          toast.error(`Critical anomaly detected: ${payload.new.description}`);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [siteId, queryClient]);

  // Add new IoT device
  const addDevice = useMutation({
    mutationFn: async (deviceData: Omit<IoTDevice, 'id' | 'last_communication'>) => {
      const { data, error } = await supabase
        .from('iot_devices')
        .insert({
          ...deviceData,
          last_communication: new Date().toISOString()
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success('IoT device added successfully');
      queryClient.invalidateQueries({ queryKey: ['iot-devices', siteId] });
    },
    onError: (error: any) => {
      toast.error(`Failed to add device: ${error.message}`);
    }
  });

  // Update device status
  const updateDeviceStatus = useMutation({
    mutationFn: async ({
      deviceId,
      status,
      batteryLevel
    }: {
      deviceId: string;
      status: IoTDevice['status'];
      batteryLevel?: number;
    }) => {
      const updateData: any = {
        status,
        last_communication: new Date().toISOString()
      };
      
      if (batteryLevel !== undefined) {
        updateData.battery_level = batteryLevel;
      }

      const { data, error } = await supabase
        .from('iot_devices')
        .update(updateData)
        .eq('id', deviceId)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['iot-devices', siteId] });
    }
  });

  // Trigger anomaly detection
  const triggerAnomalyDetection = useMutation({
    mutationFn: async ({
      deviceId,
      thresholds
    }: {
      deviceId?: string;
      thresholds?: Record<string, number>;
    }) => {
      const recentReadings = sensorReadings?.filter(r => 
        !deviceId || r.device_id === deviceId
      ).slice(0, 20) || [];

      const { data, error } = await supabase.functions.invoke('realtime-anomaly-detection', {
        body: {
          sourceType: 'sensor',
          sourceId: deviceId || siteId,
          dataPoints: recentReadings,
          thresholds: thresholds || {
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
      queryClient.invalidateQueries({ queryKey: ['anomaly-detections', siteId] });
    },
    onError: (error: any) => {
      toast.error(`Anomaly detection failed: ${error.message}`);
    }
  });

  // Remove device
  const removeDevice = useMutation({
    mutationFn: async (deviceId: string) => {
      const { error } = await supabase
        .from('iot_devices')
        .delete()
        .eq('id', deviceId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Device removed successfully');
      queryClient.invalidateQueries({ queryKey: ['iot-devices', siteId] });
    },
    onError: (error: any) => {
      toast.error(`Failed to remove device: ${error.message}`);
    }
  });

  // Computed values
  const activeDevices = devices?.filter(d => d.status === 'active') || [];
  const inactiveDevices = devices?.filter(d => d.status !== 'active') || [];
  const lowBatteryDevices = devices?.filter(d => d.battery_level < 20) || [];
  const criticalAnomalies = anomalies?.filter(a => a.severity === 'critical') || [];
  const recentReadings = sensorReadings?.slice(0, 10) || [];

  // Device statistics by type
  const deviceStats = devices?.reduce((acc, device) => {
    acc[device.device_type] = (acc[device.device_type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>) || {};

  // Latest readings by type
  const latestReadingsByType = sensorReadings?.reduce((acc, reading) => {
    if (!acc[reading.reading_type] || 
        new Date(reading.timestamp) > new Date(acc[reading.reading_type].timestamp)) {
      acc[reading.reading_type] = reading;
    }
    return acc;
  }, {} as Record<string, SensorReading>) || {};

  return {
    // Data
    devices,
    sensorReadings,
    anomalies,
    
    // Loading states
    devicesLoading,
    readingsLoading,
    anomaliesLoading,
    isAddingDevice: addDevice.isPending,
    isUpdatingDevice: updateDeviceStatus.isPending,
    isDetectingAnomalies: triggerAnomalyDetection.isPending,
    
    // Error states
    devicesError,
    
    // Actions
    addDevice: addDevice.mutate,
    updateDeviceStatus: updateDeviceStatus.mutate,
    triggerAnomalyDetection: triggerAnomalyDetection.mutate,
    removeDevice: removeDevice.mutate,
    
    // Computed values
    totalDevices: devices?.length || 0,
    activeDevicesCount: activeDevices.length,
    inactiveDevicesCount: inactiveDevices.length,
    lowBatteryCount: lowBatteryDevices.length,
    criticalAnomaliesCount: criticalAnomalies.length,
    
    // Categorized data
    activeDevices,
    inactiveDevices,
    lowBatteryDevices,
    criticalAnomalies,
    recentReadings,
    deviceStats,
    latestReadingsByType,
    
    // Health metrics
    systemHealth: {
      deviceUptime: (activeDevices.length / Math.max(devices?.length || 1, 1)) * 100,
      averageBatteryLevel: devices?.reduce((sum, d) => sum + d.battery_level, 0) / Math.max(devices?.length || 1, 1) || 0,
      dataQuality: sensorReadings?.filter(r => r.quality_flag === 'good').length / Math.max(sensorReadings?.length || 1, 1) * 100 || 0
    }
  };
};