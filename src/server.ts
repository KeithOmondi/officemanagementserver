// ── MUST BE THE FIRST IMPORT ──────────────────────────────────────────────────
import { profileImport } from './profile-imports';

// ── Now import everything else ──────────────────────────────────────────────
import app from './app';
import { connectDB } from './config/db';
import { env } from './config/env';
import { setupWebSocket } from './socket';
//import { Server } from 'http';
import { scheduleBringUpReminders } from './jobs/bringUpReminders.job';

profileImport('After imports');

// ── Detailed Memory Profiler ──────────────────────────────────────────────────
class StartupProfiler {
  private snapshots: Array<{
    timestamp: number;
    label: string;
    heapUsed: number;
    heapTotal: number;
    rss: number;
    external: number;
    arrayBuffers: number;
  }> = [];

  takeSnapshot(label: string) {
    const mem = process.memoryUsage();
    const snapshot = {
      timestamp: Date.now(),
      label,
      heapUsed: mem.heapUsed,
      heapTotal: mem.heapTotal,
      rss: mem.rss,
      external: mem.external,
      arrayBuffers: (mem as any).arrayBuffers || 0
    };
    this.snapshots.push(snapshot);
    
    const heapMB = Math.round(mem.heapUsed / 1024 / 1024);
    const rssMB = Math.round(mem.rss / 1024 / 1024);
    console.log(`🧠 [${label}] Heap: ${heapMB}MB | RSS: ${rssMB}MB | External: ${Math.round(mem.external / 1024 / 1024)}MB`);
    
    // Alert on large jumps
    if (this.snapshots.length > 1) {
      const prev = this.snapshots[this.snapshots.length - 2];
      const diff = mem.heapUsed - prev.heapUsed;
      const diffMB = Math.round(diff / 1024 / 1024);
      if (diffMB > 50) {
        console.warn(`⚠️ Large memory jump: +${diffMB}MB in "${label}"`);
      }
    }
    
    return snapshot;
  }

  generateReport() {
    console.log('\n📊 ===== STARTUP MEMORY REPORT =====');
    console.log('Step | Heap (MB) | Δ (MB) | RSS (MB) | Label');
    console.log('-----|-----------|--------|----------|------------------');
    
    let previous = this.snapshots[0];
    for (const snap of this.snapshots) {
      const diff = Math.round((snap.heapUsed - previous.heapUsed) / 1024 / 1024);
      const heapMB = Math.round(snap.heapUsed / 1024 / 1024);
      const rssMB = Math.round(snap.rss / 1024 / 1024);
      const stepNum = String(this.snapshots.indexOf(snap)).padStart(4);
      console.log(`${stepNum} | ${String(heapMB).padStart(9)} | ${String(diff).padStart(6)} | ${String(rssMB).padStart(8)} | ${snap.label}`);
      previous = snap;
    }
    console.log('======================================\n');
    
    // Find the biggest jump
    let maxJump = 0;
    let maxJumpLabel = '';
    for (let i = 1; i < this.snapshots.length; i++) {
      const diff = this.snapshots[i].heapUsed - this.snapshots[i-1].heapUsed;
      if (diff > maxJump) {
        maxJump = diff;
        maxJumpLabel = this.snapshots[i].label;
      }
    }
    
    const maxJumpMB = Math.round(maxJump / 1024 / 1024);
    console.log(`🔍 Biggest memory jump: ${maxJumpMB}MB in "${maxJumpLabel}"`);
    console.log(`📊 Current memory usage: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB / ${Math.round(process.memoryUsage().heapTotal / 1024 / 1024)}MB`);
    
    // Write to file for analysis
    const fs = require('fs');
    fs.writeFileSync('startup-memory.json', JSON.stringify(this.snapshots, (key, value) => {
      if (typeof value === 'bigint') return value.toString();
      return value;
    }, 2));
    console.log('📁 Detailed snapshot saved to startup-memory.json\n');
    
    // Check if memory is already too high
    const currentHeap = Math.round(process.memoryUsage().heapUsed / 1024 / 1024);
    if (currentHeap > 1500) {
      console.warn(`⚠️⚠️⚠️ CRITICAL: Memory already at ${currentHeap}MB before any requests!`);
      console.warn('   This indicates a module is loading large amounts of data on import.');
      console.warn('   Check the import profiler output above for the culprit.');
    }
  }
}

const profiler = new StartupProfiler();

// ── Take initial snapshot ─────────────────────────────────────────────────────
profiler.takeSnapshot('Initial (before imports)');

// ── Start Server ─────────────────────────────────────────────────────────────
const startServer = async () => {
  profiler.takeSnapshot('Before server start');
  
  console.log('🚀 Server initialization started...');
  console.log(`📋 Environment: ${env.NODE_ENV}`);
  console.log(`📋 Port: ${env.PORT}`);
  console.log(`📋 Node Version: ${process.version}`);
  
  // Check if memory is already high before doing anything
  const initialHeap = Math.round(process.memoryUsage().heapUsed / 1024 / 1024);
  if (initialHeap > 1000) {
    console.warn(`⚠️ Warning: Memory already at ${initialHeap}MB before server initialization`);
    console.warn('   This suggests a module is consuming memory during import.');
  }
  
  // Force garbage collection if available
  if (global.gc) {
    console.log('🗑️ Forcing initial GC...');
    global.gc();
    profiler.takeSnapshot('After initial GC');
  }

  try {
    // ── Database Connection ──────────────────────────────────────────────────
    console.log('📦 Connecting to database...');
    profiler.takeSnapshot('Before DB connection');
    const dbStart = Date.now();
    await connectDB();
    console.log(`✅ Database connected in ${Date.now() - dbStart}ms`);
    profiler.takeSnapshot('After DB connection');

    // ── Start HTTP Server ────────────────────────────────────────────────────
    console.log(`🌐 Starting HTTP server on port ${env.PORT}...`);
    profiler.takeSnapshot('Before HTTP server');
    const server = app.listen(env.PORT, () => {
      console.log(`🚀 [server]: Running in ${env.NODE_ENV} mode on http://localhost:${env.PORT}`);
      console.log(`🔗 API URL: ${env.API_URL}`);
      console.log(`🌐 Client URL: ${env.CLIENT_URL}`);
      profiler.takeSnapshot('After HTTP server started');
    });
    profiler.takeSnapshot('After HTTP server instantiated');

    // ── Setup WebSocket ──────────────────────────────────────────────────────
    console.log('🔌 Initializing WebSocket server...');
    profiler.takeSnapshot('Before WebSocket setup');
    const io = setupWebSocket(server);
    console.log('✅ WebSocket server initialized');
    profiler.takeSnapshot('After WebSocket setup');

    // Make io available to routes
    app.set('io', io);
    profiler.takeSnapshot('After app.set(io)');

    // ── Schedule Background Jobs ─────────────────────────────────────────────
    console.log('⏰ Scheduling background jobs...');
    scheduleBringUpReminders(io);
    console.log('✅ Bring-up date reminder job scheduled (daily 07:00)');
    profiler.takeSnapshot('After background jobs scheduled');

    // ── Check final memory ──────────────────────────────────────────────────
    const finalHeap = Math.round(process.memoryUsage().heapUsed / 1024 / 1024);
    if (finalHeap > 1500) {
      console.warn(`⚠️⚠️⚠️ CRITICAL: Server started with ${finalHeap}MB memory usage!`);
      console.warn('   The application is at risk of crashing. Please investigate the import profiler output.');
    }

    // ── Generate Report ─────────────────────────────────────────────────────
    profiler.generateReport();
    
    // ── Log startup success ──────────────────────────────────────────────────
    console.log('✅ Server initialization complete!');
    console.log(`📊 Final memory: ${finalHeap}MB / ${Math.round(process.memoryUsage().heapTotal / 1024 / 1024)}MB`);

    // ── Return for testing ──────────────────────────────────────────────────
    return { server, io };

  } catch (error) {
    console.error('❌ Failed to initialize application framework:', error);
    if (error instanceof Error) {
      console.error('   Error name:', error.name);
      console.error('   Error message:', error.message);
      console.error('   Error stack:', error.stack);
    }
    process.exit(1);
  }
};

// ── Set up graceful shutdown ──────────────────────────────────────────────────
process.on('unhandledRejection', (reason: unknown) => {
  console.error('💥 Unhandled Rejection:', reason);
  if (reason instanceof Error) {
    console.error('   Stack:', reason.stack);
  }
});

process.on('uncaughtException', (err: Error) => {
  console.error('💥 Uncaught Exception:', err.message);
  console.error('   Stack:', err.stack);
  if (err.message.includes('heap out of memory')) {
    console.error('🚨 Heap out of memory - exiting immediately');
    process.exit(1);
  }
});

// ── Run Server ──────────────────────────────────────────────────────────────
console.log('🏁 Starting application...');
console.log('📊 Initial memory before any operations:', 
  Math.round(process.memoryUsage().heapUsed / 1024 / 1024), 'MB');

const serverPromise = startServer();

// ── Log when server is ready ──────────────────────────────────────────────────
serverPromise.then(() => {
  console.log('🎉 Application is ready!');
}).catch((error) => {
  console.error('❌ Failed to start application:', error);
  process.exit(1);
});

export default serverPromise;