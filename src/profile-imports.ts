// This file MUST be imported FIRST
import fs from 'fs';

// Force garbage collection if available
if (global.gc) {
  global.gc();
}

console.log('🔍 Starting import profiler...');

// Track memory before each import
const memorySnapshots: Array<{
  timestamp: number;
  label: string;
  heapUsed: number;
  heapTotal: number;
  rss: number;
}> = [];

export function profileImport(label: string) {
  const mem = process.memoryUsage();
  const snapshot = {
    timestamp: Date.now(),
    label,
    heapUsed: mem.heapUsed,
    heapTotal: mem.heapTotal,
    rss: mem.rss,
  };
  memorySnapshots.push(snapshot);
  
  const heapMB = Math.round(mem.heapUsed / 1024 / 1024);
  const rssMB = Math.round(mem.rss / 1024 / 1024);
  console.log(`📦 [${label}] Heap: ${heapMB}MB | RSS: ${rssMB}MB`);
  
  // Alert on large jumps
  if (memorySnapshots.length > 1) {
    const prev = memorySnapshots[memorySnapshots.length - 2];
    const diff = mem.heapUsed - prev.heapUsed;
    const diffMB = Math.round(diff / 1024 / 1024);
    if (diffMB > 10) {
      console.warn(`⚠️  +${diffMB}MB memory increase in "${label}"`);
    }
  }
  
  return snapshot;
}

// Save report on exit
process.on('beforeExit', () => {
  console.log('\n📊 ===== IMPORT MEMORY REPORT =====');
  console.log('Step | Heap (MB) | Δ (MB) | Label');
  console.log('-----|-----------|--------|------------------');
  
  let previous = memorySnapshots[0];
  for (const snap of memorySnapshots) {
    const diff = Math.round((snap.heapUsed - previous.heapUsed) / 1024 / 1024);
    const heapMB = Math.round(snap.heapUsed / 1024 / 1024);
    console.log(`${String(memorySnapshots.indexOf(snap)).padStart(4)} | ${String(heapMB).padStart(9)} | ${String(diff).padStart(6)} | ${snap.label}`);
    previous = snap;
  }
  console.log('======================================\n');
  
  fs.writeFileSync('import-memory.json', JSON.stringify(memorySnapshots, null, 2));
});

// Export the profile function
export const profiler = { profileImport, snapshots: memorySnapshots };

// Take initial snapshot
profileImport('Initial');