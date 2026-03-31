#!/usr/bin/env node
// geojson2osm.js — converts OSM-sourced GeoJSON back to .osm XML
// Usage: node geojson2osm.js <roads.geojson> [signs.geojson] -o output.osm

import { readFileSync, writeFileSync } from 'fs';

const args = process.argv.slice(2);
const outFlag = args.indexOf('-o');
const outFile = outFlag !== -1 ? args[outFlag + 1] : 'output.osm';
const inputFiles = args.filter((_, i) => i !== outFlag && i !== outFlag + 1);

if (inputFiles.length === 0) {
  console.error('Usage: node geojson2osm.js <roads.geojson> [signs.geojson] -o output.osm');
  process.exit(1);
}

function escapeXml(val) {
  return String(val)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function parseOsmId(idStr) {
  // "way/12345" or "node/12345" -> 12345
  const m = String(idStr).match(/\d+$/);
  return m ? parseInt(m[0]) : null;
}

// ---- collect all features ----
const namedNodes = new Map();   // id -> { id, lat, lon, tags }
const ways = [];                // { id, coords, tags }

for (const file of inputFiles) {
  const fc = JSON.parse(readFileSync(file, 'utf8'));
  for (const feat of fc.features) {
    const props = feat.properties || {};
    const rawId = props['@id'] || feat.id || '';
    const osmId = parseOsmId(rawId);
    const geom = feat.geometry;

    if (geom.type === 'Point') {
      const [lon, lat] = geom.coordinates;
      const tags = Object.fromEntries(
        Object.entries(props).filter(([k]) => !k.startsWith('@'))
      );
      namedNodes.set(osmId, { id: osmId, lat, lon, tags });
    } else if (geom.type === 'LineString') {
      const tags = Object.fromEntries(
        Object.entries(props).filter(([k]) => !k.startsWith('@'))
      );
      ways.push({ id: osmId, coords: geom.coordinates, tags });
    }
  }
}

// ---- build synthetic nodes for way coords ----
// Key: "lon,lat" -> node id
const coordIndex = new Map();
// Seed with named nodes so shared positions reuse their id
for (const [id, n] of namedNodes) {
  coordIndex.set(`${n.lon},${n.lat}`, id);
}

let nextSyntheticId = -1;
const syntheticNodes = new Map(); // id -> { lat, lon }

function getOrCreateNode(lon, lat) {
  const key = `${lon},${lat}`;
  if (coordIndex.has(key)) return coordIndex.get(key);
  const id = nextSyntheticId--;
  coordIndex.set(key, id);
  syntheticNodes.set(id, { lat, lon });
  return id;
}

// Resolve way node refs
const resolvedWays = ways.map(w => ({
  ...w,
  refs: w.coords.map(([lon, lat]) => getOrCreateNode(lon, lat)),
}));

// ---- emit OSM XML ----
const lines = ['<?xml version="1.0" encoding="UTF-8"?>', '<osm version="0.6" generator="geojson2osm">'];

// named nodes (signs, traffic calming, etc.)
for (const n of namedNodes.values()) {
  const tagLines = Object.entries(n.tags).map(
    ([k, v]) => `    <tag k="${escapeXml(k)}" v="${escapeXml(v)}"/>`
  );
  if (tagLines.length) {
    lines.push(`  <node id="${n.id}" lat="${n.lat}" lon="${n.lon}">`);
    lines.push(...tagLines);
    lines.push('  </node>');
  } else {
    lines.push(`  <node id="${n.id}" lat="${n.lat}" lon="${n.lon}"/>`);
  }
}

// synthetic way-coord nodes (no tags)
for (const [id, n] of syntheticNodes) {
  lines.push(`  <node id="${id}" lat="${n.lat}" lon="${n.lon}"/>`);
}

// ways
for (const w of resolvedWays) {
  lines.push(`  <way id="${w.id}">`);
  for (const ref of w.refs) lines.push(`    <nd ref="${ref}"/>`);
  for (const [k, v] of Object.entries(w.tags)) {
    lines.push(`    <tag k="${escapeXml(k)}" v="${escapeXml(v)}"/>`);
  }
  lines.push('  </way>');
}

lines.push('</osm>');

writeFileSync(outFile, lines.join('\n'), 'utf8');
console.log(`Written ${outFile} (${namedNodes.size} named nodes, ${syntheticNodes.size} synthetic nodes, ${resolvedWays.length} ways)`);
