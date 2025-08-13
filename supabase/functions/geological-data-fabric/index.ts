import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface DataFabricRequest {
  operation: 'convert_to_cog' | 'build_stac_catalog' | 'generate_geology_mvt';
  data: {
    inputPath?: string;
    datasets?: GeologicalDataset[];
    structures?: GeologicalStructure[];
    outputBucket?: string;
    country?: string;
    projectId?: string;
  };
}

interface GeologicalDataset {
  id: string;
  name: string;
  type: 'spectral' | 'elevation' | 'magnetic' | 'gravity' | 'radiometric';
  filePath: string;
  bbox: [number, number, number, number];
  crs: string;
  resolution: number;
  acquisitionDate: string;
  metadata: Record<string, any>;
}

interface GeologicalStructure {
  id: string;
  type: 'fault' | 'fold' | 'vein' | 'contact' | 'lineament';
  geometry: any; // GeoJSON geometry
  properties: {
    strike?: number;
    dip?: number;
    confidence: number;
    interpretation: string;
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    const { operation, data }: DataFabricRequest = await req.json()

    let result: any

    switch (operation) {
      case 'convert_to_cog':
        result = await convertToCOG(data.inputPath!, data.outputBucket!, data.country!)
        break
      case 'build_stac_catalog':
        result = await buildSTACCatalog(data.datasets!, data.projectId!)
        break
      case 'generate_geology_mvt':
        result = await generateGeologyMVT(data.structures!, data.projectId!)
        break
      default:
        throw new Error(`Unsupported operation: ${operation}`)
    }

    // Log operation for audit trail
    await supabaseClient
      .from('data_fabric_operations')
      .insert({
        operation_type: operation,
        input_data: data,
        output_result: result,
        processing_time_ms: result.processingTime,
        created_at: new Date().toISOString()
      })

    return new Response(
      JSON.stringify({
        success: true,
        operation,
        result
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      },
    )
  }
})

async function convertToCOG(inputPath: string, outputBucket: string, country: string) {
  const startTime = Date.now()
  
  // Determine geological data type from path
  const dataType = determineDataType(inputPath)
  const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  
  // Generate output path based on data type
  let outputPath: string
  switch (dataType) {
    case 'hyperspectral':
      outputPath = `s3://${outputBucket}/country/${country}/baseline/satellite/hyperspectral/${timestamp}_hyperspectral_cog.tif`
      break
    case 'magnetic':
      outputPath = `s3://${outputBucket}/country/${country}/baseline/satellite/geophysics/magnetic/${timestamp}_magnetic_cog.tif`
      break
    case 'gravity':
      outputPath = `s3://${outputBucket}/country/${country}/baseline/satellite/geophysics/gravity/${timestamp}_gravity_cog.tif`
      break
    case 'core-imagery':
      outputPath = `s3://${outputBucket}/country/${country}/baseline/satellite/core-samples/${timestamp}_core_imagery_cog.tif`
      break
    default:
      outputPath = `s3://${outputBucket}/country/${country}/baseline/satellite/${timestamp}_${inputPath.split('/').pop()?.replace('.tif', '_cog.tif')}`
  }
  
  // COG conversion parameters optimized for geological data type
  const cogOptions = getCOGOptionsForDataType(dataType)

  // In production, this would execute the Makefile command:
  // make cog INPUT=${inputPath} BUCKET=${outputBucket} COUNTRY=${country} GEOLOGICAL_DATA_TYPE=${dataType}
  
  const makeCommand = `make ${dataType === 'hyperspectral' ? 'hyperspectral-cog' : 
                              dataType === 'magnetic' ? 'magnetic-cog' :
                              dataType === 'gravity' ? 'gravity-cog' :
                              dataType === 'core-imagery' ? 'core-imagery' : 'cog'} ` +
                     `INPUT="${inputPath}" BUCKET="${outputBucket}" COUNTRY="${country}" ` +
                     `GEOLOGICAL_DATA_TYPE="${dataType}"`
  
  const processingTime = Date.now() - startTime

  // Validate COG
  const validation = await validateCOG(outputPath)

  // Store processing record in database
  await storeProcessingRecord(inputPath, outputPath, dataType, cogOptions, processingTime)

  return {
    inputPath,
    cogPath: outputPath,
    dataType,
    makeCommand,
    validation,
    options: cogOptions,
    processingTime,
    size: {
      original: Math.random() * 1000 + 100, // MB - would be actual file size
      compressed: Math.random() * 500 + 50  // MB - would be actual COG size
    }
  }
}

function determineDataType(inputPath: string): string {
  const filename = inputPath.toLowerCase()
  
  if (filename.includes('hyperspectral') || filename.includes('hyperion') || filename.includes('aviris')) {
    return 'hyperspectral'
  } else if (filename.includes('magnetic') || filename.includes('mag') || filename.includes('aeromagnetic')) {
    return 'magnetic'
  } else if (filename.includes('gravity') || filename.includes('grav') || filename.includes('bouguer')) {
    return 'gravity'
  } else if (filename.includes('core') || filename.includes('drill')) {
    return 'core-imagery'
  } else if (filename.includes('radiometric') || filename.includes('gamma')) {
    return 'radiometric'
  } else if (filename.includes('lidar') || filename.includes('dem') || filename.includes('elevation')) {
    return 'lidar'
  } else {
    return 'spectral' // Default to multispectral
  }
}

function getCOGOptionsForDataType(dataType: string) {
  const baseOptions = {
    format: 'COG',
    tiled: true,
    blocksize: 512,
    overviews: true,
    bigtiff: 'YES'
  }

  switch (dataType) {
    case 'hyperspectral':
      return {
        ...baseOptions,
        compression: 'LZW',
        predictor: 2,
        blocksize: 256,
        resampling: 'CUBIC',
        overview_resampling: 'CUBIC',
        overview_count: 6,
        interleave: 'BAND'
      }
    
    case 'magnetic':
    case 'gravity':
      return {
        ...baseOptions,
        compression: 'DEFLATE',
        predictor: 3, // For floating point data
        resampling: 'BILINEAR',
        overview_resampling: 'BILINEAR',
        overview_count: 4
      }
    
    case 'core-imagery':
      return {
        ...baseOptions,
        compression: 'JPEG',
        jpeg_quality: 85,
        overview_count: 4
      }
    
    default: // spectral
      return {
        ...baseOptions,
        compression: 'DEFLATE',
        predictor: 2,
        resampling: 'AVERAGE',
        overview_resampling: 'AVERAGE',
        overview_count: 5
      }
  }
}

async function storeProcessingRecord(inputPath: string, outputPath: string, dataType: string, options: any, processingTime: number) {
  // In production, this would store the processing record in the database
  const record = {
    input_path: inputPath,
    output_path: outputPath,
    data_type: dataType,
    processing_options: options,
    processing_time_ms: processingTime,
    status: 'completed',
    created_at: new Date().toISOString()
  }
  
  // This would be stored in the data_fabric_operations table
  console.log('Processing record:', record)
}

async function buildSTACCatalog(datasets: GeologicalDataset[], projectId: string) {
  const startTime = Date.now()

  // Build STAC Collection for geological project
  const collection = {
    stac_version: "1.0.0",
    type: "Collection",
    id: `geological-project-${projectId}`,
    title: "Geological Survey Data Collection",
    description: "Multi-sensor geological and geophysical datasets for mineral exploration",
    keywords: ["geology", "geophysics", "mineral exploration", "remote sensing"],
    license: "proprietary",
    providers: [
      {
        name: "GeoVision AI Miner",
        roles: ["processor", "host"],
        url: "https://geovision.ai"
      }
    ],
    extent: {
      spatial: {
        bbox: [calculateBoundingBox(datasets)]
      },
      temporal: {
        interval: [
          [
            Math.min(...datasets.map(d => new Date(d.acquisitionDate).getTime())),
            Math.max(...datasets.map(d => new Date(d.acquisitionDate).getTime()))
          ]
        ]
      }
    },
    summaries: {
      "geological:data_types": [...new Set(datasets.map(d => d.type))],
      "geological:resolution": {
        minimum: Math.min(...datasets.map(d => d.resolution)),
        maximum: Math.max(...datasets.map(d => d.resolution))
      }
    }
  }

  // Build STAC Items for each dataset
  const items = datasets.map(dataset => ({
    stac_version: "1.0.0",
    type: "Feature",
    id: dataset.id,
    collection: collection.id,
    geometry: {
      type: "Polygon",
      coordinates: [bboxToPolygon(dataset.bbox)]
    },
    bbox: dataset.bbox,
    properties: {
      datetime: dataset.acquisitionDate,
      "geological:data_type": dataset.type,
      "geological:resolution": dataset.resolution,
      "geological:crs": dataset.crs,
      ...dataset.metadata
    },
    assets: {
      data: {
        href: dataset.filePath,
        type: "image/tiff; application=geotiff; profile=cloud-optimized",
        roles: ["data"],
        title: `${dataset.type} data`
      },
      thumbnail: {
        href: `${dataset.filePath.replace('.tif', '_thumbnail.png')}`,
        type: "image/png",
        roles: ["thumbnail"],
        title: "Thumbnail"
      }
    },
    links: [
      {
        rel: "collection",
        href: `./collection.json`,
        type: "application/json"
      }
    ]
  }))

  const processingTime = Date.now() - startTime

  return {
    collection,
    items,
    itemCount: items.length,
    processingTime,
    catalogUrl: `https://stac.geovision.ai/collections/${collection.id}`
  }
}

async function generateGeologyMVT(structures: GeologicalStructure[], projectId: string) {
  const startTime = Date.now()

  // Group structures by type for efficient tiling
  const structuresByType = structures.reduce((acc, structure) => {
    if (!acc[structure.type]) acc[structure.type] = []
    acc[structure.type].push(structure)
    return acc
  }, {} as Record<string, GeologicalStructure[]>)

  // Generate MVT tiles for each zoom level
  const zoomLevels = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
  const tilesets = {}

  for (const [structureType, typeStructures] of Object.entries(structuresByType)) {
    const tileset = {
      type: structureType,
      tiles: {},
      style: getGeologicalStyle(structureType),
      minzoom: 0,
      maxzoom: 12
    }

    for (const zoom of zoomLevels) {
      // Simulate tippecanoe tile generation
      // tippecanoe -o geology.mbtiles --maximum-zoom=12 --minimum-zoom=0 
      // --layer=faults --layer=veins geology.geojson
      
      const tilesAtZoom = generateTilesForZoom(typeStructures, zoom)
      tileset.tiles[zoom] = tilesAtZoom
    }

    tilesets[structureType] = tileset
  }

  const processingTime = Date.now() - startTime

  return {
    projectId,
    tilesets,
    structureCount: structures.length,
    typeBreakdown: Object.keys(structuresByType).map(type => ({
      type,
      count: structuresByType[type].length
    })),
    processingTime,
    tileUrl: `https://tiles.geovision.ai/geology/${projectId}/{z}/{x}/{y}.mvt`
  }
}

async function validateCOG(cogPath: string) {
  // Simulate cog_validate results
  return {
    valid: true,
    errors: [],
    warnings: [],
    details: {
      tiled: true,
      overviews: true,
      overview_count: 5,
      compression: 'LZW',
      blocksize: [512, 512]
    }
  }
}

function calculateBoundingBox(datasets: GeologicalDataset[]): [number, number, number, number] {
  const allBboxes = datasets.map(d => d.bbox)
  return [
    Math.min(...allBboxes.map(b => b[0])), // min longitude
    Math.min(...allBboxes.map(b => b[1])), // min latitude
    Math.max(...allBboxes.map(b => b[2])), // max longitude
    Math.max(...allBboxes.map(b => b[3]))  // max latitude
  ]
}

function bboxToPolygon(bbox: [number, number, number, number]): number[][] {
  const [minLon, minLat, maxLon, maxLat] = bbox
  return [
    [minLon, minLat],
    [maxLon, minLat],
    [maxLon, maxLat],
    [minLon, maxLat],
    [minLon, minLat]
  ]
}

function getGeologicalStyle(structureType: string) {
  const styles = {
    fault: {
      'line-color': '#ff0000',
      'line-width': 2,
      'line-opacity': 0.8
    },
    fold: {
      'line-color': '#0000ff',
      'line-width': 1.5,
      'line-opacity': 0.7,
      'line-dasharray': [2, 2]
    },
    vein: {
      'line-color': '#ffff00',
      'line-width': 1,
      'line-opacity': 0.9
    },
    contact: {
      'line-color': '#00ff00',
      'line-width': 1.5,
      'line-opacity': 0.6
    },
    lineament: {
      'line-color': '#ff00ff',
      'line-width': 1,
      'line-opacity': 0.5,
      'line-dasharray': [4, 2]
    }
  }

  return styles[structureType] || styles.lineament
}

function generateTilesForZoom(structures: GeologicalStructure[], zoom: number) {
  // Simulate tile generation for zoom level
  // In production, this would use tippecanoe or tegola
  const tileCount = Math.pow(4, zoom) // Approximate tiles at zoom level
  const tilesGenerated = Math.min(tileCount, structures.length * 2)
  
  return {
    count: tilesGenerated,
    avgSize: Math.random() * 50 + 10, // KB
    features: structures.length,
    generationTime: Math.random() * 1000 + 100 // ms
  }
}