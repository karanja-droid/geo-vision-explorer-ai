import React, { useEffect, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useGeologicalConnections, useCentralityMetrics } from '@/hooks/useNeo4jAnalytics';
import { Network, DataSet, Node, Edge } from 'vis-network/standalone';
import { Loader2, ZoomIn, ZoomOut, RotateCcw, Download, Filter } from 'lucide-react';

interface GraphVisualizationProps {
  nodeId?: string;
  maxDepth?: number;
  nodeType?: string;
  className?: string;
}

interface GraphNode extends Node {
  id: string;
  label: string;
  group: string;
  title: string;
  value: number;
  color?: {
    background: string;
    border: string;
    highlight: { background: string; border: string };
  };
}

interface GraphEdge extends Edge {
  id: string;
  from: string;
  to: string;
  label: string;
  width: number;
  color: string;
}

const GraphVisualization: React.FC<GraphVisualizationProps> = ({
  nodeId = '',
  maxDepth = 3,
  nodeType = 'MineralDeposit',
  className = ''
}) => {
  const networkRef = useRef<HTMLDivElement>(null);
  const networkInstance = useRef<Network | null>(null);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<string>('all');
  const [depthFilter, setDepthFilter] = useState<number[]>([maxDepth]);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Fetch data
  const { 
    data: connections, 
    isLoading: connectionsLoading, 
    error: connectionsError 
  } = useGeologicalConnections(nodeId, maxDepth);

  const { 
    data: centralityData, 
    isLoading: centralityLoading 
  } = useCentralityMetrics(nodeType);

  // Color scheme for different node types
  const nodeColors = {
    MineralDeposit: { background: '#FFD700', border: '#FFA500' },
    RockFormation: { background: '#8B4513', border: '#654321' },
    FaultSystem: { background: '#FF4500', border: '#DC143C' },
    GeologicalEvent: { background: '#9370DB', border: '#663399' },
    ProspectiveArea: { background: '#32CD32', border: '#228B22' },
    AlterationZone: { background: '#FF69B4', border: '#FF1493' }
  };

  // Process data for visualization
  const processGraphData = () => {
    if (!connections || !centralityData) return { nodes: new DataSet([]), edges: new DataSet([]) };

    const nodes: GraphNode[] = [];
    const edges: GraphEdge[] = [];
    const nodeMap = new Map();

    // Create centrality score map
    const centralityMap = new Map();
    centralityData.forEach(item => {
      centralityMap.set(item.node.id, item.centralityScore);
    });

    // Process connections
    connections.forEach((connection, index) => {
      const { path, depth, relationshipTypes, connectedNode } = connection;
      
      // Filter by depth
      if (depth > depthFilter[0]) return;

      // Add connected node if not already added
      if (!nodeMap.has(connectedNode.id)) {
        const centralityScore = centralityMap.get(connectedNode.id) || 0;
        const nodeColor = nodeColors[connectedNode.type as keyof typeof nodeColors] || 
                         { background: '#CCCCCC', border: '#999999' };

        nodes.push({
          id: connectedNode.id,
          label: connectedNode.name || connectedNode.id,
          group: connectedNode.type,
          title: `
            <div>
              <strong>${connectedNode.name || connectedNode.id}</strong><br/>
              Type: ${connectedNode.type}<br/>
              ${connectedNode.grade ? `Grade: ${connectedNode.grade}` : ''}<br/>
              ${connectedNode.tonnage ? `Tonnage: ${connectedNode.tonnage}` : ''}<br/>
              Centrality: ${centralityScore.toFixed(3)}
            </div>
          `,
          value: Math.max(centralityScore * 100, 10),
          color: {
            background: nodeColor.background,
            border: nodeColor.border,
            highlight: {
              background: nodeColor.background,
              border: '#000000'
            }
          }
        });
        nodeMap.set(connectedNode.id, true);
      }

      // Add edges for relationships
      relationshipTypes.forEach((relType: string, relIndex: number) => {
        const edgeId = `${nodeId}-${connectedNode.id}-${relIndex}`;
        if (!edges.find(e => e.id === edgeId)) {
          edges.push({
            id: edgeId,
            from: nodeId,
            to: connectedNode.id,
            label: relType.replace(/_/g, ' '),
            width: Math.max(3 - depth, 1),
            color: depth === 1 ? '#FF6B6B' : depth === 2 ? '#4ECDC4' : '#45B7D1'
          });
        }
      });
    });

    // Add central node if not already added
    if (nodeId && !nodeMap.has(nodeId)) {
      nodes.push({
        id: nodeId,
        label: 'Central Node',
        group: 'Central',
        title: 'Central Node',
        value: 50,
        color: {
          background: '#FF0000',
          border: '#CC0000',
          highlight: {
            background: '#FF0000',
            border: '#000000'
          }
        }
      });
    }

    return {
      nodes: new DataSet(nodes),
      edges: new DataSet(edges)
    };
  };

  // Initialize network
  useEffect(() => {
    if (!networkRef.current || connectionsLoading || centralityLoading) return;

    const { nodes, edges } = processGraphData();

    const options = {
      nodes: {
        shape: 'dot',
        size: 16,
        font: {
          size: 12,
          color: '#000000'
        },
        borderWidth: 2,
        shadow: true
      },
      edges: {
        width: 2,
        color: { inherit: 'from' },
        smooth: {
          type: 'continuous',
          roundness: 0.5
        },
        arrows: {
          to: { enabled: true, scaleFactor: 1, type: 'arrow' }
        },
        font: {
          size: 10,
          align: 'middle'
        }
      },
      physics: {
        enabled: true,
        stabilization: { iterations: 100 },
        barnesHut: {
          gravitationalConstant: -2000,
          centralGravity: 0.3,
          springLength: 95,
          springConstant: 0.04,
          damping: 0.09
        }
      },
      interaction: {
        hover: true,
        tooltipDelay: 200,
        hideEdgesOnDrag: true,
        hideNodesOnDrag: true
      },
      layout: {
        improvedLayout: true
      }
    };

    networkInstance.current = new Network(networkRef.current, { nodes, edges }, options);

    // Event handlers
    networkInstance.current.on('click', (params) => {
      if (params.nodes.length > 0) {
        setSelectedNode(params.nodes[0]);
      } else {
        setSelectedNode(null);
      }
    });

    networkInstance.current.on('hoverNode', (params) => {
      networkRef.current!.style.cursor = 'pointer';
    });

    networkInstance.current.on('blurNode', () => {
      networkRef.current!.style.cursor = 'default';
    });

    return () => {
      if (networkInstance.current) {
        networkInstance.current.destroy();
        networkInstance.current = null;
      }
    };
  }, [connections, centralityData, depthFilter, filterType]);

  // Control functions
  const zoomIn = () => {
    if (networkInstance.current) {
      const scale = networkInstance.current.getScale();
      networkInstance.current.moveTo({ scale: scale * 1.2 });
    }
  };

  const zoomOut = () => {
    if (networkInstance.current) {
      const scale = networkInstance.current.getScale();
      networkInstance.current.moveTo({ scale: scale * 0.8 });
    }
  };

  const resetView = () => {
    if (networkInstance.current) {
      networkInstance.current.fit();
    }
  };

  const exportGraph = () => {
    if (networkInstance.current && networkRef.current) {
      const canvas = networkRef.current.querySelector('canvas');
      if (canvas) {
        const link = document.createElement('a');
        link.download = `geological-graph-${Date.now()}.png`;
        link.href = canvas.toDataURL();
        link.click();
      }
    }
  };

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  if (connectionsError) {
    return (
      <Card className={className}>
        <CardContent className="p-6">
          <div className="text-center text-red-600">
            Error loading graph data: {connectionsError.message}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={`${className} ${isFullscreen ? 'fixed inset-0 z-50' : ''}`}>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            Geological Relationship Graph
            {(connectionsLoading || centralityLoading) && (
              <Loader2 className="h-4 w-4 animate-spin" />
            )}
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="outline">
              {connections?.length || 0} connections
            </Badge>
            <Badge variant="outline">
              Depth: {depthFilter[0]}
            </Badge>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium">Max Depth:</label>
            <div className="w-32">
              <Slider
                value={depthFilter}
                onValueChange={setDepthFilter}
                max={5}
                min={1}
                step={1}
                className="w-full"
              />
            </div>
          </div>

          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Filter by type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="MineralDeposit">Mineral Deposits</SelectItem>
              <SelectItem value="RockFormation">Rock Formations</SelectItem>
              <SelectItem value="FaultSystem">Fault Systems</SelectItem>
              <SelectItem value="GeologicalEvent">Geological Events</SelectItem>
            </SelectContent>
          </Select>

          <div className="flex items-center gap-1">
            <Button variant="outline" size="sm" onClick={zoomIn}>
              <ZoomIn className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={zoomOut}>
              <ZoomOut className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={resetView}>
              <RotateCcw className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={exportGraph}>
              <Download className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={toggleFullscreen}>
              {isFullscreen ? 'Exit' : 'Fullscreen'}
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        <div className="relative">
          <div
            ref={networkRef}
            className={`border rounded-lg ${isFullscreen ? 'h-screen' : 'h-96'}`}
            style={{ width: '100%' }}
          />

          {/* Loading overlay */}
          {(connectionsLoading || centralityLoading) && (
            <div className="absolute inset-0 bg-white/80 flex items-center justify-center rounded-lg">
              <div className="flex items-center gap-2">
                <Loader2 className="h-6 w-6 animate-spin" />
                <span>Loading graph data...</span>
              </div>
            </div>
          )}

          {/* Selected node info */}
          {selectedNode && (
            <div className="absolute top-4 right-4 bg-white p-4 rounded-lg shadow-lg border max-w-xs">
              <h4 className="font-semibold mb-2">Selected Node</h4>
              <p className="text-sm text-gray-600">ID: {selectedNode}</p>
              {/* Add more node details here */}
            </div>
          )}
        </div>

        {/* Legend */}
        <div className="p-4 border-t">
          <h4 className="font-semibold mb-2">Legend</h4>
          <div className="flex flex-wrap gap-4">
            {Object.entries(nodeColors).map(([type, color]) => (
              <div key={type} className="flex items-center gap-2">
                <div
                  className="w-4 h-4 rounded-full border-2"
                  style={{
                    backgroundColor: color.background,
                    borderColor: color.border
                  }}
                />
                <span className="text-sm">{type.replace(/([A-Z])/g, ' $1').trim()}</span>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default GraphVisualization;