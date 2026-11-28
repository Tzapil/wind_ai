import { createHash } from 'node:crypto';
import { Buffer } from 'node:buffer';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import mapshaper from 'mapshaper';

import { project, scaleAt } from '../../packages/core/src/util/geo.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const cacheDir = path.join(root, 'tools/mapgen/.cache');
const outputPath = path.join(root, 'packages/client/public/data/coast.json');
const sources = [
  {
    name: 'ne_10m_land',
    url: 'https://naciscdn.org/naturalearth/10m/physical/ne_10m_land.zip',
    sha256: 'e547d749445eaa0964aba76738090ec88f5e63c4585122170f98c67a7ea922dc',
  },
  {
    name: 'ne_10m_minor_islands',
    url: 'https://naciscdn.org/naturalearth/10m/physical/ne_10m_minor_islands.zip',
    sha256: '47c0b3ce26df7b4dbabdbb251023918cb2f5c83462a426288f1f253da7284db2',
  },
];
const clipBbox = '-13,28.5,38.5,48.5';
const mapBbox = [-12, 29.5, 37.5, 47.5];
const lods = [0.3, 3];
const coordinatePrecision = 100;

async function sourceArchive(source) {
  const cachePath = path.join(cacheDir, `${source.name}.zip`);
  let archive;
  let downloaded = false;
  try {
    archive = await readFile(cachePath);
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
  if (!archive) {
    const response = await globalThis.fetch(source.url);
    if (!response.ok) throw new Error(`Cannot download ${source.url}: HTTP ${response.status}`);
    archive = Buffer.from(await response.arrayBuffer());
    if (archive.subarray(0, 2).toString() !== 'PK') throw new Error(`Invalid ZIP: ${source.url}`);
    downloaded = true;
  }
  const sha256 = createHash('sha256').update(archive).digest('hex');
  if (sha256 !== source.sha256) throw new Error(`Unexpected source revision: ${source.name} (${sha256})`);
  if (downloaded) await writeFile(cachePath, archive);
  return archive;
}

function polygonsOf(geometry) {
  if (!geometry) return [];
  if (geometry.type === 'Polygon') return [geometry.coordinates];
  if (geometry.type === 'MultiPolygon') return geometry.coordinates;
  throw new Error(`Unexpected geometry: ${geometry.type}`);
}

function roundCoordinate(value) {
  return Math.round(value * coordinatePrecision) / coordinatePrecision;
}

function projectGeometry(geometry) {
  const coordinates = polygonsOf(geometry).map((polygon) => polygon.map((ring) => ring.map(([lon, lat]) => {
    const point = project(lon, lat);
    return [roundCoordinate(point.x), roundCoordinate(point.y)];
  })));
  return { type: 'MultiPolygon', coordinates };
}

function ringArea(ring) {
  let twiceArea = 0;
  for (let index = 0; index < ring.length - 1; index += 1) {
    twiceArea += ring[index][0] * ring[index + 1][1] - ring[index + 1][0] * ring[index][1];
  }
  const meanY = ring.reduce((sum, point) => sum + point[1], 0) / ring.length;
  return (Math.abs(twiceArea) / 2) * scaleAt(meanY) ** 2;
}

function toFlatRings(geojson, minIslandArea) {
  const rings = [];
  const geometries = geojson.features?.map((feature) => feature.geometry) ?? geojson.geometries ?? [];
  for (const geometry of geometries) {
    for (const polygon of polygonsOf(geometry)) {
      if (ringArea(polygon[0]) < minIslandArea) continue;
      for (const ring of polygon) {
        if (ring.length < 4) continue;
        rings.push(ring.flatMap(([x, y]) => [roundCoordinate(x), roundCoordinate(y)]));
      }
    }
  }
  return rings;
}

async function run() {
  await mkdir(cacheDir, { recursive: true });
  const features = [];
  for (const source of sources) {
    const archive = await sourceArchive(source);
    const beforeCount = features.length;
    const output = await mapshaper.applyCommands(
      `-i source.zip -clip bbox=${clipBbox} -o format=geojson clipped.geojson`,
      { 'source.zip': archive },
    );
    for (const file of Object.values(output)) {
      const clipped = JSON.parse(file.toString());
      const geometries = clipped.features?.map((feature) => feature.geometry) ?? clipped.geometries ?? [];
      for (const geometry of geometries) {
        features.push({ type: 'Feature', properties: { source: source.name }, geometry: projectGeometry(geometry) });
      }
    }
    process.stdout.write(`${source.name}: ${features.length - beforeCount} clipped features\n`);
  }

  const projected = { type: 'FeatureCollection', features };
  const result = { bbox: [
    roundCoordinate(project(mapBbox[0], mapBbox[3]).x),
    roundCoordinate(project(mapBbox[0], mapBbox[3]).y),
    roundCoordinate(project(mapBbox[2], mapBbox[1]).x),
    roundCoordinate(project(mapBbox[2], mapBbox[1]).y),
  ], lods: [] };

  for (const tolerance of lods) {
    const output = await mapshaper.applyCommands(
      `-i projected.geojson -simplify planar interval=${tolerance} keep-shapes -o format=geojson simplified.geojson`,
      { 'projected.geojson': JSON.stringify(projected) },
    );
    const polygons = Object.values(output).flatMap((file) => toFlatRings(JSON.parse(file.toString()), tolerance === 3 ? 1 : 0));
    const lod = { tolerance, polygons };
    const size = Buffer.byteLength(JSON.stringify(lod));
    const limit = tolerance === 3 ? 300_000 : 3_000_000;
    if (size > limit) throw new Error(`LOD ${tolerance} is ${size} bytes, limit is ${limit}`);
    process.stdout.write(`LOD ${tolerance}: ${polygons.length} rings, ${size} bytes\n`);
    result.lods.push(lod);
  }

  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(result)}\n`);
  process.stdout.write(`Wrote ${path.relative(root, outputPath)}\n`);
}

run().catch((error) => {
  process.stderr.write(`${error.stack ?? error}\n`);
  process.exitCode = 1;
});
