// src/middleware/realtime.middleware.ts

import { Request, Response, NextFunction } from 'express';
import { Server as SocketServer } from 'socket.io';
import RealtimeService from '../services/realtime.service';

declare global {
  namespace Express {
    interface Request {
      io?: SocketServer;
      realtime?: RealtimeService;
    }
  }
}

let globalIo: SocketServer | null = null;
let globalRealtimeService: RealtimeService | null = null;

export function setRealtimeService(io: SocketServer, realtimeService: RealtimeService) {
  globalIo = io;
  globalRealtimeService = realtimeService;
  console.log('✅ Realtime service initialized');
}

export function injectRealtime(req: Request, res: Response, next: NextFunction) {
  try {
    req.io = req.app.get('io') || globalIo || undefined;
    req.realtime = req.app.get('realtimeService') || globalRealtimeService || undefined;
  } catch (error) {
    console.warn('⚠️ Could not inject realtime service:', error);
  }
  next();
}

export function getRealtimeService(req?: Request): RealtimeService | null {
  // Try request first
  if (req?.realtime) {
    return req.realtime;
  }
  
  // Try global
  if (globalRealtimeService) {
    return globalRealtimeService;
  }
  
  // Return null instead of throwing
  console.warn('⚠️ Realtime service not available');
  return null;
}

export function getIO(req?: Request): SocketServer | null {
  if (req?.io) {
    return req.io;
  }
  if (globalIo) {
    return globalIo;
  }
  console.warn('⚠️ Socket.IO not available');
  return null;
}

// Safe emit helper
export function safeEmit(req: Request | null, event: string, data: any): void {
  const io = req ? getIO(req) : getIO();
  if (io) {
    io.emit(event, data);
  } else {
    console.warn(`⚠️ Cannot emit ${event}: Socket.IO not available`);
  }
}