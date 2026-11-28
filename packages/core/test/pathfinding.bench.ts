import { readFile } from 'node:fs/promises';
import { test } from 'vitest';
import ports from '../../client/public/data/ports.json';
import { parseNavGrid } from '../src/nav/navgrid.js';
import { findRoute } from '../src/nav/pathfinding.js';

const binary = await readFile(
  new URL('../../client/public/data/navgrid.bin', import.meta.url),
);
const grid = parseNavGrid(binary);
const venice = ports.find((port) => port.id === 'venice')!.anchorage;
const beirut = ports.find((port) => port.id === 'beirut')!.anchorage;

test('route benchmark', async ({ bench }) => {
  await bench('Venice to Beirut', { time: 1000 }, () => {
    findRoute(grid, venice, beirut);
  }).run();
});
