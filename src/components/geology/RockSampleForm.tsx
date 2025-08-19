/**
 * Rock Sample Data Entry Form
 * 
 * Comprehensive form for geological rock sample collection and description
 * including location, lithology, alteration, mineralization, and structural data
 */

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  MapPin, 
  Camera, 
  Save, 
  Plus, 
  Trash2,
  Upload,
  Map,
  Compass,
  Layers
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface RockSampleData {
  sample_id: string;
  location: {
    easting: number;
    northing: number;
    elevation: number;
    coordinate_system: string;
  };
  lithology: {
    rock_type: string;
    texture: string;
    grain_size: string;
    color: string;
    weathering: string;
  };
  mineralization: {
    primary_minerals: string[];
    secondary_minerals: string[];
    alteration_type: string;
    alteration_intensity: string;
    sulfide_content: string;
  };
  structure: {
    foliation_strike: number | null;
    foliation_dip: number | null;
    lineation_trend: number | null;
    lineation_plunge: number | null;
    joint_sets: Array<{
      strike: number;
      dip: number;
      spacing: string;
    }>;
  };
  description: string;
  photos: string[];
  collector: string;
  collection_date: string;
}

const RockSampleForm: React.FC = () => {
  const { toast } = useToast();
  const [formData, setFormData] = useState<RockSampleData>({
    sample_id: '',
    location: {
      easting: 0,
      northing: 0,
      elevation: 0,
      coordinate_system: 'WGS84'
    },
    lithology: {
      rock_type: '',
      texture: '',
      grain_size: '',
      color: '',
      weathering: ''
    },
    mineralization: {
      primary_minerals: [],
      secondary_minerals: [],
      alteration_type: '',
      alteration_intensity: '',
      sulfide_content: ''
    },
    structure: {
      foliation_strike: null,
      foliation_dip: null,
      lineation_trend: null,
      lineation_plunge: null,
      joint_sets: []
    },
    description: '',
    photos: [],
    collector: '',
    collection_date: new Date().toISOString().split('T')[0]
  });

  const [newJointSet, setNewJointSet] = useState({
    strike: 0,
    dip: 0,
    spacing: ''
  });

  const rockTypes = [
    'Granite', 'Gneiss', 'Schist', 'Quartzite', 'Marble',
    'Basalt', 'Andesite', 'Rhyolite', 'Sandstone', 'Limestone',
    'Shale', 'Conglomerate', 'Breccia', 'Vein', 'Other'
  ];

  const textures = [
    'Phaneritic', 'Aphanitic', 'Porphyritic', 'Pegmatitic',
    'Vesicular', 'Glassy', 'Foliated', 'Massive', 'Banded'
  ];

  const grainSizes = [
    'Very Fine', 'Fine', 'Medium', 'Coarse', 'Very Coarse', 'Mixed'
  ];

  const alterationTypes = [
    'Sericitic', 'Argillic', 'Propylitic', 'Potassic', 'Silicic',
    'Carbonate', 'Chloritic', 'Epidote', 'Tourmaline', 'None'
  ];

  const handleInputChange = (section: string, field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [section]: {
        ...prev[section as keyof RockSampleData],
        [field]: value
      }
    }));
  };

  const handleArrayChange = (section: string, field: string, value: string, action: 'add' | 'remove') => {
    setFormData(prev => {
      const currentArray = prev[section as keyof RockSampleData][field] as string[];
      if (action === 'add' && value && !currentArray.includes(value)) {
        return {
          ...prev,
          [section]: {
            ...prev[section as keyof RockSampleData],
            [field]: [...currentArray, value]
          }
        };
      } else if (action === 'remove') {
        return {
          ...prev,
          [section]: {
            ...prev[section as keyof RockSampleData],
            [field]: currentArray.filter(item => item !== value)
          }
        };
      }
      return prev;
    });
  };

  const addJointSet = () => {
    if (newJointSet.strike >= 0 && newJointSet.dip >= 0 && newJointSet.spacing) {
      setFormData(prev => ({
        ...prev,
        structure: {
          ...prev.structure,
          joint_sets: [...prev.structure.joint_sets, { ...newJointSet }]
        }
      }));
      setNewJointSet({ strike: 0, dip: 0, spacing: '' });
    }
  };

  const removeJointSet = (index: number) => {
    setFormData(prev => ({
      ...prev,
      structure: {
        ...prev.structure,
        joint_sets: prev.structure.joint_sets.filter((_, i) => i !== index)
      }
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      // Validate required fields
      if (!formData.sample_id || !formData.lithology.rock_type) {
        toast({
          title: "Validation Error",
          description: "Sample ID and Rock Type are required fields",
          variant: "destructive"
        });
        return;
      }

      // Here you would typically send the data to your API
      console.log('Submitting rock sample data:', formData);
      
      toast({
        title: "Success",
        description: "Rock sample data saved successfully",
      });

      // Reset form
      setFormData({
        sample_id: '',
        location: { easting: 0, northing: 0, elevation: 0, coordinate_system: 'WGS84' },
        lithology: { rock_type: '', texture: '', grain_size: '', color: '', weathering: '' },
        mineralization: { primary_minerals: [], secondary_minerals: [], alteration_type: '', alteration_intensity: '', sulfide_content: '' },
        structure: { foliation_strike: null, foliation_dip: null, lineation_trend: null, lineation_plunge: null, joint_sets: [] },
        description: '',
        photos: [],
        collector: '',
        collection_date: new Date().toISOString().split('T')[0]
      });

    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save rock sample data",
        variant: "destructive"
      });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Tabs defaultValue="basic" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="basic">Basic Info</TabsTrigger>
          <TabsTrigger value="lithology">Lithology</TabsTrigger>
          <TabsTrigger value="mineralization">Mineralization</TabsTrigger>
          <TabsTrigger value="structure">Structure</TabsTrigger>
        </TabsList>

        {/* Basic Information */}
        <TabsContent value="basic" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="sample_id">Sample ID *</Label>
              <Input
                id="sample_id"
                value={formData.sample_id}
                onChange={(e) => setFormData(prev => ({ ...prev, sample_id: e.target.value }))}
                placeholder="RS-2025-001"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="collector">Collector</Label>
              <Input
                id="collector"
                value={formData.collector}
                onChange={(e) => setFormData(prev => ({ ...prev, collector: e.target.value }))}
                placeholder="Geologist name"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="collection_date">Collection Date</Label>
              <Input
                id="collection_date"
                type="date"
                value={formData.collection_date}
                onChange={(e) => setFormData(prev => ({ ...prev, collection_date: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="coordinate_system">Coordinate System</Label>
              <Select
                value={formData.location.coordinate_system}
                onValueChange={(value) => handleInputChange('location', 'coordinate_system', value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="WGS84">WGS84</SelectItem>
                  <SelectItem value="UTM">UTM</SelectItem>
                  <SelectItem value="Local">Local Grid</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="easting">Easting</Label>
              <Input
                id="easting"
                type="number"
                step="0.001"
                value={formData.location.easting}
                onChange={(e) => handleInputChange('location', 'easting', parseFloat(e.target.value))}
                placeholder="0.000"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="northing">Northing</Label>
              <Input
                id="northing"
                type="number"
                step="0.001"
                value={formData.location.northing}
                onChange={(e) => handleInputChange('location', 'northing', parseFloat(e.target.value))}
                placeholder="0.000"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="elevation">Elevation (m)</Label>
              <Input
                id="elevation"
                type="number"
                step="0.1"
                value={formData.location.elevation}
                onChange={(e) => handleInputChange('location', 'elevation', parseFloat(e.target.value))}
                placeholder="0.0"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Field Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Detailed field description of the rock sample..."
              rows={4}
            />
          </div>
        </TabsContent>

        {/* Lithology */}
        <TabsContent value="lithology" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="rock_type">Rock Type *</Label>
              <Select
                value={formData.lithology.rock_type}
                onValueChange={(value) => handleInputChange('lithology', 'rock_type', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select rock type" />
                </SelectTrigger>
                <SelectContent>
                  {rockTypes.map(type => (
                    <SelectItem key={type} value={type}>{type}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="texture">Texture</Label>
              <Select
                value={formData.lithology.texture}
                onValueChange={(value) => handleInputChange('lithology', 'texture', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select texture" />
                </SelectTrigger>
                <SelectContent>
                  {textures.map(texture => (
                    <SelectItem key={texture} value={texture}>{texture}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="grain_size">Grain Size</Label>
              <Select
                value={formData.lithology.grain_size}
                onValueChange={(value) => handleInputChange('lithology', 'grain_size', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select grain size" />
                </SelectTrigger>
                <SelectContent>
                  {grainSizes.map(size => (
                    <SelectItem key={size} value={size}>{size}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="color">Color</Label>
              <Input
                id="color"
                value={formData.lithology.color}
                onChange={(e) => handleInputChange('lithology', 'color', e.target.value)}
                placeholder="e.g., Light gray"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="weathering">Weathering</Label>
              <Select
                value={formData.lithology.weathering}
                onValueChange={(value) => handleInputChange('lithology', 'weathering', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select weathering" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Fresh">Fresh</SelectItem>
                  <SelectItem value="Slightly Weathered">Slightly Weathered</SelectItem>
                  <SelectItem value="Moderately Weathered">Moderately Weathered</SelectItem>
                  <SelectItem value="Highly Weathered">Highly Weathered</SelectItem>
                  <SelectItem value="Completely Weathered">Completely Weathered</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </TabsContent>

        {/* Mineralization */}
        <TabsContent value="mineralization" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Primary Minerals</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="Add mineral"
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      const value = (e.target as HTMLInputElement).value;
                      if (value) {
                        handleArrayChange('mineralization', 'primary_minerals', value, 'add');
                        (e.target as HTMLInputElement).value = '';
                      }
                    }
                  }}
                />
                <Button type="button" size="sm">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex flex-wrap gap-1">
                {formData.mineralization.primary_minerals.map((mineral, index) => (
                  <Badge key={index} variant="secondary" className="cursor-pointer"
                    onClick={() => handleArrayChange('mineralization', 'primary_minerals', mineral, 'remove')}>
                    {mineral} ×
                  </Badge>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Secondary Minerals</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="Add mineral"
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      const value = (e.target as HTMLInputElement).value;
                      if (value) {
                        handleArrayChange('mineralization', 'secondary_minerals', value, 'add');
                        (e.target as HTMLInputElement).value = '';
                      }
                    }
                  }}
                />
                <Button type="button" size="sm">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex flex-wrap gap-1">
                {formData.mineralization.secondary_minerals.map((mineral, index) => (
                  <Badge key={index} variant="secondary" className="cursor-pointer"
                    onClick={() => handleArrayChange('mineralization', 'secondary_minerals', mineral, 'remove')}>
                    {mineral} ×
                  </Badge>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="alteration_type">Alteration Type</Label>
              <Select
                value={formData.mineralization.alteration_type}
                onValueChange={(value) => handleInputChange('mineralization', 'alteration_type', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select alteration" />
                </SelectTrigger>
                <SelectContent>
                  {alterationTypes.map(type => (
                    <SelectItem key={type} value={type}>{type}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="alteration_intensity">Alteration Intensity</Label>
              <Select
                value={formData.mineralization.alteration_intensity}
                onValueChange={(value) => handleInputChange('mineralization', 'alteration_intensity', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select intensity" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="None">None</SelectItem>
                  <SelectItem value="Weak">Weak</SelectItem>
                  <SelectItem value="Moderate">Moderate</SelectItem>
                  <SelectItem value="Strong">Strong</SelectItem>
                  <SelectItem value="Intense">Intense</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="sulfide_content">Sulfide Content</Label>
              <Select
                value={formData.mineralization.sulfide_content}
                onValueChange={(value) => handleInputChange('mineralization', 'sulfide_content', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select content" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="None">None</SelectItem>
                  <SelectItem value="Trace">Trace (&lt;1%)</SelectItem>
                  <SelectItem value="Minor">Minor (1-5%)</SelectItem>
                  <SelectItem value="Moderate">Moderate (5-15%)</SelectItem>
                  <SelectItem value="Major">Major (&gt;15%)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </TabsContent>

        {/* Structure */}
        <TabsContent value="structure" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Foliation</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="foliation_strike">Strike (°)</Label>
                    <Input
                      id="foliation_strike"
                      type="number"
                      min="0"
                      max="360"
                      value={formData.structure.foliation_strike || ''}
                      onChange={(e) => handleInputChange('structure', 'foliation_strike', 
                        e.target.value ? parseInt(e.target.value) : null)}
                      placeholder="0-360"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="foliation_dip">Dip (°)</Label>
                    <Input
                      id="foliation_dip"
                      type="number"
                      min="0"
                      max="90"
                      value={formData.structure.foliation_dip || ''}
                      onChange={(e) => handleInputChange('structure', 'foliation_dip', 
                        e.target.value ? parseInt(e.target.value) : null)}
                      placeholder="0-90"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Lineation</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="lineation_trend">Trend (°)</Label>
                    <Input
                      id="lineation_trend"
                      type="number"
                      min="0"
                      max="360"
                      value={formData.structure.lineation_trend || ''}
                      onChange={(e) => handleInputChange('structure', 'lineation_trend', 
                        e.target.value ? parseInt(e.target.value) : null)}
                      placeholder="0-360"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lineation_plunge">Plunge (°)</Label>
                    <Input
                      id="lineation_plunge"
                      type="number"
                      min="0"
                      max="90"
                      value={formData.structure.lineation_plunge || ''}
                      onChange={(e) => handleInputChange('structure', 'lineation_plunge', 
                        e.target.value ? parseInt(e.target.value) : null)}
                      placeholder="0-90"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center justify-between">
                Joint Sets
                <Button type="button" size="sm" onClick={addJointSet}>
                  <Plus className="h-4 w-4 mr-1" />
                  Add Joint Set
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label>Strike (°)</Label>
                  <Input
                    type="number"
                    min="0"
                    max="360"
                    value={newJointSet.strike}
                    onChange={(e) => setNewJointSet(prev => ({ ...prev, strike: parseInt(e.target.value) || 0 }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Dip (°)</Label>
                  <Input
                    type="number"
                    min="0"
                    max="90"
                    value={newJointSet.dip}
                    onChange={(e) => setNewJointSet(prev => ({ ...prev, dip: parseInt(e.target.value) || 0 }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Spacing</Label>
                  <Select
                    value={newJointSet.spacing}
                    onValueChange={(value) => setNewJointSet(prev => ({ ...prev, spacing: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select spacing" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Very Close (&lt;6cm)">Very Close (&lt;6cm)</SelectItem>
                      <SelectItem value="Close (6-20cm)">Close (6-20cm)</SelectItem>
                      <SelectItem value="Moderate (20-60cm)">Moderate (20-60cm)</SelectItem>
                      <SelectItem value="Wide (60-200cm)">Wide (60-200cm)</SelectItem>
                      <SelectItem value="Very Wide (&gt;200cm)">Very Wide (&gt;200cm)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {formData.structure.joint_sets.length > 0 && (
                <div className="space-y-2">
                  <Label>Recorded Joint Sets</Label>
                  <div className="space-y-2">
                    {formData.structure.joint_sets.map((joint, index) => (
                      <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                        <span className="text-sm">
                          Strike: {joint.strike}°, Dip: {joint.dip}°, Spacing: {joint.spacing}
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeJointSet(index)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline">
          <Camera className="h-4 w-4 mr-2" />
          Add Photos
        </Button>
        <Button type="submit">
          <Save className="h-4 w-4 mr-2" />
          Save Rock Sample
        </Button>
      </div>
    </form>
  );
};

export default RockSampleForm;