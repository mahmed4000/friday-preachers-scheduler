import fs from 'fs';

const content = fs.readFileSync('src/server/api.ts', 'utf8');
const lines = content.split('\n');
const results: { line: number; text: string }[] = [];

lines.forEach((l, i) => {
  if (l.includes('memoryStore')) {
    results.push({ line: i + 1, text: l.trim() });
  }
});

console.log(`Total memoryStore occurrences in src/server/api.ts: ${results.length}`);
results.forEach((r) => console.log(`${r.line}: ${r.text}`));
