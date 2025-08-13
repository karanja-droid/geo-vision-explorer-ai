import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Calculator, 
  TrendingUp, 
  Users, 
  Database, 
  Zap, 
  Shield, 
  Globe, 
  Cpu,
  HardDrive,
  Network,
  BarChart3,
  CheckCircle,
  XCircle
} from 'lucide-react';

interface PricingTier {
  name: string;
  price: number;
  description: string;
  features: {
    projects: number;
    sites: number;
    aiRuns: number;
    storage: number;
    mapTiles: number;
    users: number;
    support: string;
    sla: string;
  };
  infrastructure: {
    aws: number;
    supabase: number;
    redis: number;
    neo4j: number;
    mapbox: number;
    openai: number;
    monitoring: number;
    total: number;
  };
  included: string[];
  excluded: string[];
}

const pricingTiers: PricingTier[] = [
  {
    name: 'Explorer',
    price: 299,
    description: 'Perfect for individual geologists and small teams',
    features: {
      projects: 5,
      sites: 25,
      aiRuns: 50,
      storage: 100,
      mapTiles: 10000,
      users: 2,
      support: 'Email',
      sla: '99%'
    },
    infrastructure: {
      aws: 50,
      supabase: 25,
      redis: 30,
      neo4j: 0,
      mapbox: 50,
      openai: 100,
      monitoring: 15,
      total: 270
    },
    included: [
      'Basic AI Analysis',
      'Standard Mapping',
      'Email Support',
      'Basic Security',
      'Standard Performance'
    ],
    excluded: [
      'Real-time Collaboration',
      'Advanced Analytics',
      'Graph Database',
      'Priority Support',
      'Custom Integrations'
    ]
  },
  {
    name: 'Professional',
    price: 899,
    description: 'Ideal for growing exploration companies',
    features: {
      projects: 20,
      sites: 100,
      aiRuns: 300,
      storage: 500,
      mapTiles: 50000,
      users: 10,
      support: 'Priority Email + Chat',
      sla: '99.5%'
    },
    infrastructure: {
      aws: 200,
      supabase: 100,
      redis: 150,
      neo4j: 500,
      mapbox: 200,
      openai: 500,
      monitoring: 50,
      total: 1700
    },
    included: [
      'Advanced AI Analysis',
      'Real-time Collaboration',
      'Graph Analytics',
      'Priority Support',
      'Enhanced Security',
      'Performance Optimization'
    ],
    excluded: [
      'White-label Options',
      'Custom AI Models',
      'Dedicated Support',
      'Multi-region Deployment',
      'Enterprise SLA'
    ]
  },
  {
    name: 'Enterprise',
    price: 2499,
    description: 'Comprehensive solution for large organizations',
    features: {
      projects: 100,
      sites: 500,
      aiRuns: 1500,
      storage: 2000,
      mapTiles: 200000,
      users: 50,
      support: '24/7 Phone + CSM',
      sla: '99.9%'
    },
    infrastructure: {
      aws: 800,
      supabase: 500,
      redis: 600,
      neo4j: 1500,
      mapbox: 800,
      openai: 2000,
      monitoring: 200,
      total: 6400
    },
    included: [
      'Full AI Suite',
      'Advanced Collaboration',
      'Complete Analytics',
      'Dedicated Support',
      'Enterprise Security',
      'API Access',
      'White-label Options'
    ],
    excluded: [
      'Unlimited Resources',
      'Custom Infrastructure',
      'Dedicated Technical Team',
      'Custom AI Training'
    ]
  },
  {
    name: 'Global',
    price: 7999,
    description: 'Ultimate solution for multinational operations',
    features: {
      projects: -1, // Unlimited
      sites: -1,
      aiRuns: -1,
      storage: 10000,
      mapTiles: -1,
      users: 200,
      support: 'Dedicated Technical Team',
      sla: '99.99%'
    },
    infrastructure: {
      aws: 2000,
      supabase: 2000,
      redis: 1500,
      neo4j: 5000,
      mapbox: 3000,
      openai: 8000,
      monitoring: 500,
      total: 22000
    },
    included: [
      'Unlimited Everything',
      'Custom AI Models',
      'Multi-region Deployment',
      'Dedicated Infrastructure',
      'Custom Integrations',
      'Professional Services',
      'Strategic Partnership'
    ],
    excluded: []
  }
];

const PricingCalculator: React.FC = () => {
  const [selectedTier, setSelectedTier] = useState<PricingTier>(pricingTiers[1]);
  const [customUsers, setCustomUsers] = useState([10]);
  const [customProjects, setCustomProjects] = useState([20]);
  const [customStorage, setCustomStorage] = useState([500]);
  const [includeAddOns, setIncludeAddOns] = useState({
    professionalServices: false,
    additionalStorage: false,
    premiumSupport: false,
    customIntegrations: false
  });
  const [calculatedPrice, setCalculatedPrice] = useState(0);
  const [showROI, setShowROI] = useState(false);

  // Calculate custom pricing based on usage
  const calculateCustomPrice = () => {
    let basePrice = selectedTier.price;
    let additionalCosts = 0;

    // User overage
    if (customUsers[0] > selectedTier.features.users) {
      const extraUsers = customUsers[0] - selectedTier.features.users;
      additionalCosts += extraUsers * 50; // $50 per additional user
    }

    // Project overage
    if (selectedTier.features.projects !== -1 && customProjects[0] > selectedTier.features.projects) {
      const extraProjects = customProjects[0] - selectedTier.features.projects;
      additionalCosts += extraProjects * 25; // $25 per additional project
    }

    // Storage overage
    if (customStorage[0] > selectedTier.features.storage) {
      const extraStorage = customStorage[0] - selectedTier.features.storage;
      additionalCosts += extraStorage * 0.5; // $0.50 per GB
    }

    // Add-ons
    if (includeAddOns.professionalServices) additionalCosts += basePrice * 0.2;
    if (includeAddOns.additionalStorage) additionalCosts += 200;
    if (includeAddOns.premiumSupport) additionalCosts += 500;
    if (includeAddOns.customIntegrations) additionalCosts += 1000;

    setCalculatedPrice(basePrice + additionalCosts);
  };

  useEffect(() => {
    calculateCustomPrice();
  }, [selectedTier, customUsers, customProjects, customStorage, includeAddOns]);

  const formatNumber = (num: number) => {
    if (num === -1) return 'Unlimited';
    return num.toLocaleString();
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0
    }).format(price);
  };

  const calculateROI = (tier: PricingTier) => {
    const monthlyCost = tier.price;
    const annualCost = monthlyCost * 12;
    
    // Estimated benefits based on industry data
    const explorationEfficiency = 0.25; // 25% improvement
    const costReduction = 0.30; // 30% cost reduction
    const productivityGain = 0.40; // 40% productivity improvement
    
    // Typical exploration budget for different tiers
    const typicalBudgets = {
      'Explorer': 500000,
      'Professional': 2000000,
      'Enterprise': 10000000,
      'Global': 50000000
    };
    
    const budget = typicalBudgets[tier.name as keyof typeof typicalBudgets];
    const savings = budget * costReduction;
    const roi = ((savings - annualCost) / annualCost) * 100;
    
    return {
      annualCost,
      annualSavings: savings,
      roi: Math.round(roi),
      paybackMonths: Math.round(annualCost / (savings / 12))
    };
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            GeoVision AI Miner - Pricing Calculator
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="tiers" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="tiers">Pricing Tiers</TabsTrigger>
              <TabsTrigger value="calculator">Custom Calculator</TabsTrigger>
              <TabsTrigger value="roi">ROI Analysis</TabsTrigger>
            </TabsList>

            <TabsContent value="tiers" className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {pricingTiers.map((tier, index) => (
                  <Card 
                    key={tier.name} 
                    className={`relative ${index === 1 ? 'border-blue-500 shadow-lg' : ''}`}
                  >
                    {index === 1 && (
                      <Badge className="absolute -top-2 left-1/2 transform -translate-x-1/2 bg-blue-500">
                        Most Popular
                      </Badge>
                    )}
                    <CardHeader>
                      <CardTitle className="text-xl">{tier.name}</CardTitle>
                      <div className="text-3xl font-bold">
                        {formatPrice(tier.price)}
                        <span className="text-sm font-normal text-gray-500">/month</span>
                      </div>
                      <p className="text-sm text-gray-600">{tier.description}</p>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-sm">Projects</span>
                          <span className="font-medium">{formatNumber(tier.features.projects)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm">Sites per Project</span>
                          <span className="font-medium">{formatNumber(tier.features.sites)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm">AI Runs/Month</span>
                          <span className="font-medium">{formatNumber(tier.features.aiRuns)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm">Storage</span>
                          <span className="font-medium">{formatNumber(tier.features.storage)}GB</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm">Team Members</span>
                          <span className="font-medium">{formatNumber(tier.features.users)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm">SLA</span>
                          <span className="font-medium">{tier.features.sla}</span>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <h4 className="font-medium text-green-600">Included:</h4>
                        {tier.included.map((feature, idx) => (
                          <div key={idx} className="flex items-center gap-2 text-sm">
                            <CheckCircle className="h-4 w-4 text-green-500" />
                            {feature}
                          </div>
                        ))}
                      </div>

                      {tier.excluded.length > 0 && (
                        <div className="space-y-2">
                          <h4 className="font-medium text-gray-500">Not Included:</h4>
                          {tier.excluded.slice(0, 3).map((feature, idx) => (
                            <div key={idx} className="flex items-center gap-2 text-sm text-gray-500">
                              <XCircle className="h-4 w-4 text-gray-400" />
                              {feature}
                            </div>
                          ))}
                        </div>
                      )}

                      <Button 
                        className="w-full" 
                        variant={index === 1 ? "default" : "outline"}
                        onClick={() => setSelectedTier(tier)}
                      >
                        Choose {tier.name}
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Infrastructure Cost Breakdown</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {pricingTiers.map((tier) => (
                      <div key={tier.name} className="space-y-3">
                        <h4 className="font-medium">{tier.name}</h4>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span>AWS Infrastructure</span>
                            <span>{formatPrice(tier.infrastructure.aws)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Supabase</span>
                            <span>{formatPrice(tier.infrastructure.supabase)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Redis Cache</span>
                            <span>{formatPrice(tier.infrastructure.redis)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Neo4j Graph DB</span>
                            <span>{formatPrice(tier.infrastructure.neo4j)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Mapbox</span>
                            <span>{formatPrice(tier.infrastructure.mapbox)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>OpenAI API</span>
                            <span>{formatPrice(tier.infrastructure.openai)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Monitoring</span>
                            <span>{formatPrice(tier.infrastructure.monitoring)}</span>
                          </div>
                          <div className="flex justify-between font-medium border-t pt-2">
                            <span>Total Cost</span>
                            <span>{formatPrice(tier.infrastructure.total)}</span>
                          </div>
                          <div className="flex justify-between font-medium text-green-600">
                            <span>Profit Margin</span>
                            <span>{Math.round(((tier.price - tier.infrastructure.total) / tier.price) * 100)}%</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="calculator" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Custom Pricing Calculator</CardTitle>
                  <p className="text-sm text-gray-600">
                    Adjust the parameters below to calculate custom pricing for your needs
                  </p>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <h4 className="font-medium mb-4">Base Tier Selection</h4>
                      <div className="grid grid-cols-2 gap-2">
                        {pricingTiers.map((tier) => (
                          <Button
                            key={tier.name}
                            variant={selectedTier.name === tier.name ? "default" : "outline"}
                            onClick={() => setSelectedTier(tier)}
                            className="text-sm"
                          >
                            {tier.name}
                          </Button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <h4 className="font-medium mb-4">Usage Parameters</h4>
                      <div className="space-y-4">
                        <div>
                          <label className="text-sm font-medium">Team Members: {customUsers[0]}</label>
                          <Slider
                            value={customUsers}
                            onValueChange={setCustomUsers}
                            max={500}
                            min={1}
                            step={1}
                            className="mt-2"
                          />
                        </div>
                        <div>
                          <label className="text-sm font-medium">Projects: {customProjects[0]}</label>
                          <Slider
                            value={customProjects}
                            onValueChange={setCustomProjects}
                            max={1000}
                            min={1}
                            step={1}
                            className="mt-2"
                          />
                        </div>
                        <div>
                          <label className="text-sm font-medium">Storage (GB): {customStorage[0]}</label>
                          <Slider
                            value={customStorage}
                            onValueChange={setCustomStorage}
                            max={50000}
                            min={100}
                            step={100}
                            className="mt-2"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-medium mb-4">Add-on Services</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="font-medium">Professional Services</span>
                          <p className="text-sm text-gray-600">Implementation & training (+20%)</p>
                        </div>
                        <Switch
                          checked={includeAddOns.professionalServices}
                          onCheckedChange={(checked) => 
                            setIncludeAddOns(prev => ({ ...prev, professionalServices: checked }))
                          }
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="font-medium">Additional Storage</span>
                          <p className="text-sm text-gray-600">Extra 1TB storage (+$200)</p>
                        </div>
                        <Switch
                          checked={includeAddOns.additionalStorage}
                          onCheckedChange={(checked) => 
                            setIncludeAddOns(prev => ({ ...prev, additionalStorage: checked }))
                          }
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="font-medium">Premium Support</span>
                          <p className="text-sm text-gray-600">24/7 priority support (+$500)</p>
                        </div>
                        <Switch
                          checked={includeAddOns.premiumSupport}
                          onCheckedChange={(checked) => 
                            setIncludeAddOns(prev => ({ ...prev, premiumSupport: checked }))
                          }
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="font-medium">Custom Integrations</span>
                          <p className="text-sm text-gray-600">API integrations (+$1,000)</p>
                        </div>
                        <Switch
                          checked={includeAddOns.customIntegrations}
                          onCheckedChange={(checked) => 
                            setIncludeAddOns(prev => ({ ...prev, customIntegrations: checked }))
                          }
                        />
                      </div>
                    </div>
                  </div>

                  <Card className="bg-blue-50 border-blue-200">
                    <CardContent className="pt-6">
                      <div className="text-center">
                        <div className="text-3xl font-bold text-blue-600">
                          {formatPrice(calculatedPrice)}
                        </div>
                        <p className="text-sm text-blue-600">per month</p>
                        <div className="mt-2 text-sm text-gray-600">
                          Annual: {formatPrice(calculatedPrice * 12)} 
                          <span className="text-green-600 ml-2">
                            (Save {formatPrice(calculatedPrice * 12 * 0.1)} with annual billing)
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="roi" className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {pricingTiers.map((tier) => {
                  const roi = calculateROI(tier);
                  return (
                    <Card key={tier.name}>
                      <CardHeader>
                        <CardTitle className="text-lg">{tier.name} ROI</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="space-y-2">
                          <div className="flex justify-between">
                            <span className="text-sm">Annual Cost</span>
                            <span className="font-medium">{formatPrice(roi.annualCost)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-sm">Annual Savings</span>
                            <span className="font-medium text-green-600">{formatPrice(roi.annualSavings)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-sm">ROI</span>
                            <span className="font-medium text-green-600">{roi.roi}%</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-sm">Payback Period</span>
                            <span className="font-medium">{roi.paybackMonths} months</span>
                          </div>
                        </div>
                        
                        <div className="pt-4 border-t">
                          <h4 className="font-medium mb-2">Key Benefits:</h4>
                          <ul className="text-sm space-y-1">
                            <li>• 25% faster exploration</li>
                            <li>• 30% cost reduction</li>
                            <li>• 40% productivity gain</li>
                            <li>• 50% better risk assessment</li>
                          </ul>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5" />
                    Value Proposition Summary
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="text-center">
                      <div className="text-3xl font-bold text-blue-600">10x</div>
                      <p className="text-sm text-gray-600">Faster Performance</p>
                      <p className="text-xs mt-1">Redis caching & optimization</p>
                    </div>
                    <div className="text-center">
                      <div className="text-3xl font-bold text-green-600">25%</div>
                      <p className="text-sm text-gray-600">Exploration Efficiency</p>
                      <p className="text-xs mt-1">AI-powered target identification</p>
                    </div>
                    <div className="text-center">
                      <div className="text-3xl font-bold text-purple-600">5x</div>
                      <p className="text-sm text-gray-600">Unique Features</p>
                      <p className="text-xs mt-1">Graph analytics & real-time collaboration</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default PricingCalculator;