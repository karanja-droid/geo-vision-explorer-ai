import neo4j, { Driver, Session, Result } from 'neo4j-driver';

export interface Neo4jConfig {
  uri: string;
  username: string;
  password: string;
  database?: string;
}

export interface GeologicalNode {
  id: string;
  type: 'MineralDeposit' | 'RockFormation' | 'FaultSystem' | 'GeologicalEvent' | 'ProspectiveArea';
  properties: Record<string, any>;
  coordinates?: [number, number, number];
}

export interface GeologicalRelationship {
  type: 'HOSTED_IN' | 'CONTAINS' | 'AFFECTS' | 'SIMILAR_TO' | 'CONNECTED_TO' | 'UNDERLIES' | 'OVERLIES';
  properties: Record<string, any>;
  strength?: number;
  confidence?: number;
}

export interface SimilarDeposit {
  deposit: any;
  similarity: number;
  geologicalContext: any;
}

export interface ExplorationTarget {
  area: any;
  averageGrade: number;
  depositCount: number;
  potential: number;
  riskFactor: number;
}

export interface ExplorationCriteria {
  minPotential: number;
  minGrade: number;
  maxRisk?: number;
  mineralType?: string;
  maxDistance?: number;
}

export class Neo4jService {
  private driver: Driver;
  private database: string;

  constructor(config: Neo4jConfig) {
    this.driver = neo4j.driver(
      config.uri,
      neo4j.auth.basic(config.username, config.password)
    );
    this.database = config.database || 'neo4j';
  }

  async close(): Promise<void> {
    await this.driver.close();
  }

  private async runQuery(query: string, parameters: any = {}): Promise<Result> {
    const session: Session = this.driver.session({ database: this.database });
    try {
      return await session.run(query, parameters);
    } finally {
      await session.close();
    }
  }

  // Mineral Deposit Analysis
  async findSimilarDeposits(depositId: string, limit: number = 10): Promise<SimilarDeposit[]> {
    const query = `
      MATCH (d:MineralDeposit {id: $depositId})-[:HOSTED_IN]->(rock:RockFormation)
      MATCH (rock)-[:SIMILAR_TO]->(similarRock:RockFormation)
      MATCH (similarRock)<-[:HOSTED_IN]-(similar:MineralDeposit)
      WHERE d <> similar
      OPTIONAL MATCH (similar)-[:HAS_CONTEXT]->(context:GeologicalContext)
      RETURN similar, 
             gds.similarity.cosine(d.geochemicalSignature, similar.geochemicalSignature) as similarity,
             context
      ORDER BY similarity DESC
      LIMIT $limit
    `;

    const result = await this.runQuery(query, { depositId, limit });
    return result.records.map(record => ({
      deposit: record.get('similar').properties,
      similarity: record.get('similarity'),
      geologicalContext: record.get('context')?.properties || null
    }));
  }

  async findExplorationTargets(criteria: ExplorationCriteria): Promise<ExplorationTarget[]> {
    const query = `
      MATCH (area:ProspectiveArea)
      WHERE area.mineralPotential > $minPotential
      ${criteria.maxRisk ? 'AND area.riskFactor <= $maxRisk' : ''}
      ${criteria.mineralType ? 'AND area.primaryMineral = $mineralType' : ''}
      
      MATCH (area)-[:HAS_GEOLOGY]->(geology:GeologicalContext)
      MATCH (geology)-[:SIMILAR_TO]->(knownContext:GeologicalContext)
      MATCH (knownContext)<-[:HAS_GEOLOGY]-(knownArea:ProspectiveArea)
      MATCH (knownArea)-[:CONTAINS]->(deposit:MineralDeposit)
      WHERE deposit.grade > $minGrade
      
      ${criteria.maxDistance ? `
        MATCH (area)-[:DISTANCE_TO]->(reference:ReferencePoint)
        WHERE reference.distance <= $maxDistance
      ` : ''}
      
      RETURN area, geology, 
             avg(deposit.grade) as avgGrade,
             count(deposit) as depositCount,
             area.mineralPotential as potential,
             area.riskFactor as riskFactor
      ORDER BY potential DESC, avgGrade DESC
    `;

    const result = await this.runQuery(query, criteria);
    return result.records.map(record => ({
      area: record.get('area').properties,
      averageGrade: record.get('avgGrade'),
      depositCount: record.get('depositCount'),
      potential: record.get('potential'),
      riskFactor: record.get('riskFactor')
    }));
  }

  // Geological Relationship Analysis
  async analyzeGeologicalConnections(nodeId: string, maxDepth: number = 3): Promise<any[]> {
    const query = `
      MATCH path = (start {id: $nodeId})-[*1..$maxDepth]-(connected)
      WHERE start <> connected
      RETURN path,
             length(path) as depth,
             [rel in relationships(path) | type(rel)] as relationshipTypes,
             connected
      ORDER BY depth, connected.importance DESC
    `;

    const result = await this.runQuery(query, { nodeId, maxDepth });
    return result.records.map(record => ({
      path: record.get('path'),
      depth: record.get('depth'),
      relationshipTypes: record.get('relationshipTypes'),
      connectedNode: record.get('connected').properties
    }));
  }

  async findOptimalExplorationPath(startId: string, targetId: string): Promise<any> {
    const query = `
      MATCH (start:ExplorationSite {id: $startId}), (target:ProspectiveArea {id: $targetId})
      MATCH path = shortestPath((start)-[:CONNECTED_TO*]-(target))
      RETURN path,
             reduce(cost = 0, rel in relationships(path) | cost + rel.distance) as totalDistance,
             reduce(risk = 0, node in nodes(path) | risk + coalesce(node.riskFactor, 0)) as totalRisk,
             reduce(potential = 0, node in nodes(path) | potential + coalesce(node.mineralPotential, 0)) as totalPotential
    `;

    const result = await this.runQuery(query, { startId, targetId });
    if (result.records.length === 0) return null;

    const record = result.records[0];
    return {
      path: record.get('path'),
      totalDistance: record.get('totalDistance'),
      totalRisk: record.get('totalRisk'),
      totalPotential: record.get('totalPotential'),
      score: record.get('totalPotential') / (record.get('totalDistance') + record.get('totalRisk'))
    };
  }

  // Pattern Discovery
  async discoverGeologicalPatterns(patternType: string): Promise<any[]> {
    const patterns = {
      'high_grade_clusters': `
        MATCH (d1:MineralDeposit)-[:NEAR_TO]-(d2:MineralDeposit)
        WHERE d1.grade > 5.0 AND d2.grade > 5.0
        AND d1 <> d2
        MATCH (d1)-[:HOSTED_IN]->(rock:RockFormation)
        MATCH (d2)-[:HOSTED_IN]->(rock)
        RETURN rock, collect(d1) + collect(d2) as deposits,
               avg(d1.grade + d2.grade) as avgGrade
        ORDER BY avgGrade DESC
      `,
      'fault_mineralization': `
        MATCH (fault:FaultSystem)-[:CONTROLS]->(mineralization:MineralizationEvent)
        MATCH (mineralization)-[:PRODUCES]->(deposit:MineralDeposit)
        RETURN fault, mineralization, collect(deposit) as deposits,
               avg(deposit.grade) as avgGrade,
               sum(deposit.tonnage) as totalTonnage
        ORDER BY totalTonnage DESC
      `,
      'alteration_halos': `
        MATCH (deposit:MineralDeposit)-[:SURROUNDED_BY]->(alteration:AlterationZone)
        MATCH (alteration)-[:EXTENDS_TO]->(halo:AlterationHalo)
        RETURN deposit, alteration, halo,
               halo.intensity as intensity,
               halo.extent as extent
        ORDER BY intensity DESC, extent DESC
      `
    };

    const query = patterns[patternType as keyof typeof patterns];
    if (!query) {
      throw new Error(`Unknown pattern type: ${patternType}`);
    }

    const result = await this.runQuery(query);
    return result.records.map(record => record.toObject());
  }

  // Graph Analytics
  async calculateCentralityMetrics(nodeType: string): Promise<any[]> {
    const query = `
      CALL gds.pageRank.stream('geological-graph', {
        nodeLabels: [$nodeType],
        maxIterations: 20,
        dampingFactor: 0.85
      })
      YIELD nodeId, score
      MATCH (n) WHERE id(n) = nodeId
      RETURN n, score
      ORDER BY score DESC
      LIMIT 20
    `;

    const result = await this.runQuery(query, { nodeType });
    return result.records.map(record => ({
      node: record.get('n').properties,
      centralityScore: record.get('score')
    }));
  }

  async detectCommunities(): Promise<any[]> {
    const query = `
      CALL gds.louvain.stream('geological-graph')
      YIELD nodeId, communityId
      MATCH (n) WHERE id(n) = nodeId
      RETURN communityId, collect(n) as nodes, count(n) as size
      ORDER BY size DESC
    `;

    const result = await this.runQuery(query);
    return result.records.map(record => ({
      communityId: record.get('communityId'),
      nodes: record.get('nodes').map((n: any) => n.properties),
      size: record.get('size')
    }));
  }

  // Data Management
  async createMineralDeposit(deposit: GeologicalNode): Promise<void> {
    const query = `
      CREATE (d:MineralDeposit {
        id: $id,
        name: $name,
        primaryMineral: $primaryMineral,
        grade: $grade,
        tonnage: $tonnage,
        confidence: $confidence,
        longitude: $longitude,
        latitude: $latitude,
        depth: $depth,
        createdAt: datetime(),
        updatedAt: datetime()
      })
      RETURN d
    `;

    await this.runQuery(query, deposit.properties);
  }

  async createGeologicalRelationship(
    sourceId: string,
    targetId: string,
    relationship: GeologicalRelationship
  ): Promise<void> {
    const query = `
      MATCH (source {id: $sourceId}), (target {id: $targetId})
      CREATE (source)-[r:${relationship.type} $properties]->(target)
      SET r.createdAt = datetime(),
          r.updatedAt = datetime()
      RETURN r
    `;

    await this.runQuery(query, {
      sourceId,
      targetId,
      properties: relationship.properties
    });
  }

  async updateNodeProperties(nodeId: string, properties: Record<string, any>): Promise<void> {
    const query = `
      MATCH (n {id: $nodeId})
      SET n += $properties,
          n.updatedAt = datetime()
      RETURN n
    `;

    await this.runQuery(query, { nodeId, properties });
  }

  // Health Check
  async healthCheck(): Promise<boolean> {
    try {
      const result = await this.runQuery('RETURN 1 as health');
      return result.records.length > 0;
    } catch (error) {
      console.error('Neo4j health check failed:', error);
      return false;
    }
  }
}

// Singleton instance
let neo4jService: Neo4jService | null = null;

export const getNeo4jService = (): Neo4jService => {
  if (!neo4jService) {
    const config: Neo4jConfig = {
      uri: process.env.VITE_NEO4J_URI || 'bolt://localhost:7687',
      username: process.env.VITE_NEO4J_USERNAME || 'neo4j',
      password: process.env.VITE_NEO4J_PASSWORD || 'geovision-password',
      database: process.env.VITE_NEO4J_DATABASE || 'geovision'
    };
    
    neo4jService = new Neo4jService(config);
  }
  
  return neo4jService;
};

export default Neo4jService;