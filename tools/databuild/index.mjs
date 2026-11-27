import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
import process from 'node:process';
import {
  SourceGameDataSchema,
  PortDefSchema,
  WindDefSchema,
} from '../../packages/core/src/data/schemas.ts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const dataDir = resolve(root, 'data');
const outputDir = resolve(root, 'packages/client/public/data');

async function readJson(path) {
  let raw;
  try {
    raw = await readFile(path, 'utf8');
  } catch (error) {
    throw new Error(`${path}: ${error.message}`, { cause: error });
  }
  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new Error(`${path}: invalid JSON: ${error.message}`, {
      cause: error,
    });
  }
}

function check(schema, value, file) {
  const result = schema.safeParse(value);
  if (!result.success) {
    const details = result.error.issues.map((issue) => {
      const [section, ...rest] = issue.path;
      const location =
        file === 'data' && typeof section === 'string'
          ? `data/${section}.json${rest.length ? `.${rest.join('.')}` : ''}`
          : `${file}${issue.path.length ? `.${issue.path.join('.')}` : ''}`;
      return `${location}: ${issue.message}`;
    });
    throw new Error(details.join('\n'));
  }
  return result.data;
}

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

function mergePorts(ports, geo) {
  if (!geo || typeof geo !== 'object' || Array.isArray(geo)) {
    throw new Error(
      'data/generated/ports.geo.json: expected object keyed by port id',
    );
  }
  const ids = new Set(ports.map((port) => port.id));
  for (const key of Object.keys(geo)) {
    if (!ids.has(key))
      throw new Error(`data/generated/ports.geo.json.${key}: unknown port`);
  }
  return ports.map((port, index) => {
    const merged = { ...port, ...geo[port.id] };
    return check(PortDefSchema, merged, `data/ports.json[${index}]`);
  });
}

function mergeWind(wind, geo) {
  if (!geo || typeof geo !== 'object' || Array.isArray(geo)) {
    throw new Error(
      'data/generated/wind.geo.json: expected object keyed by region id',
    );
  }
  const ids = new Set(wind.regions.map((region) => region.id));
  for (const key of Object.keys(geo)) {
    if (!ids.has(key))
      throw new Error(`data/generated/wind.geo.json.${key}: unknown region`);
  }
  const regions = wind.regions.map((region) => ({
    ...region,
    ...geo[region.id],
  }));
  return check(WindDefSchema, { ...wind, regions }, 'data/wind.json');
}

async function build() {
  const names = ['goods', 'ports', 'ship', 'wind', 'balance'];
  const raw = Object.fromEntries(
    await Promise.all(
      names.map(async (name) => [
        name,
        await readJson(resolve(dataDir, `${name}.json`)),
      ]),
    ),
  );
  const source = check(SourceGameDataSchema, raw, 'data');

  const [goodNames, portNames] = await Promise.all([
    readJson(resolve(root, 'packages/client/locales/ru/goods.json')),
    readJson(resolve(root, 'packages/client/locales/ru/ports.json')),
  ]);
  for (const good of source.goods) {
    if (typeof goodNames[`goods.${good.id}.name`] !== 'string') {
      throw new Error(
        `packages/client/locales/ru/goods.json: missing goods.${good.id}.name`,
      );
    }
  }
  for (const port of source.ports) {
    if (typeof portNames[`ports.${port.id}.name`] !== 'string') {
      throw new Error(
        `packages/client/locales/ru/ports.json: missing ports.${port.id}.name`,
      );
    }
  }

  const portGeoPath = resolve(dataDir, 'generated/ports.geo.json');
  const windGeoPath = resolve(dataDir, 'generated/wind.geo.json');
  const havePortGeo = await exists(portGeoPath);
  const haveWindGeo = await exists(windGeoPath);
  const requireGenerated =
    process.argv.includes('--require-generated') ||
    (await exists(resolve(outputDir, 'navgrid.bin')));
  if (havePortGeo !== haveWindGeo) {
    throw new Error(
      'data/generated: both ports.geo.json and wind.geo.json are required together',
    );
  }
  if (!havePortGeo && requireGenerated) {
    throw new Error('data/generated: map files missing; run pnpm map:build');
  }

  const output = { ...source };
  if (havePortGeo) {
    output.ports = mergePorts(source.ports, await readJson(portGeoPath));
    output.wind = mergeWind(source.wind, await readJson(windGeoPath));
  } else {
    process.stderr.write(
      'Warning: map files missing; run pnpm map:build. Geographic merge skipped.\n',
    );
  }
  await mkdir(outputDir, { recursive: true });
  for (const name of names) {
    await writeFile(
      resolve(outputDir, `${name}.json`),
      `${JSON.stringify(output[name], null, 2)}\n`,
    );
  }
  process.stdout.write('Game data validated and copied.\n');
}

build().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
});
