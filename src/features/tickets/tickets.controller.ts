// src/features/tickets/tickets.controller.ts

import { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { AppError, sendSuccess } from '../../utils/response';
import { TicketService } from './tickets.service';
import {
  createTicketSchema,
  updateTicketSchema,
  approveTicketSchema,
  rejectTicketSchema,
  returnTicketSchema,
  bookTicketSchema,
  addCommentSchema,
  ticketFiltersSchema,
  ticketIdSchema,
  ticketCommentIdSchema,
} from './tickets.validator';
import { getRealtimeService } from '../../middleware/realtime.middleware';

// ─── Helper: Safe realtime emit ──────────────────────────────────────────────

const safeRealtimeEmit = (req: Request, event: string, data: any) => {
  const realtime = getRealtimeService(req);
  if (realtime) {
    realtime.broadcast(event, data);
  } else {
    console.warn(`⚠️ Realtime service not available, skipping emit for event: ${event}`);
  }
};

const safeRealtimeEmitToRoom = (req: Request, room: string, event: string, data: any) => {
  const realtime = getRealtimeService(req);
  if (realtime) {
    realtime.emitToRoom(room, event, data);
  } else {
    console.warn(`⚠️ Realtime service not available, skipping emit to room ${room} for event: ${event}`);
  }
};

export const ticketController = {

  // ─── Create ────────────────────────────────────────────────────────────────────

  create: asyncHandler(async (req: Request, res: Response) => {
    const result = createTicketSchema.safeParse({ body: req.body });
    if (!result.success) {
      throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid data');
    }
    const ticket = await TicketService.createTicket(result.data.body, req.user!.id);
    
    // ── Emit real-time event ──────────────────────────────────────────────────
    safeRealtimeEmit(req, 'ticket_created', ticket);
    
    return sendSuccess(res, ticket, 'Ticket created successfully', 201);
  }),

  // ─── Read ──────────────────────────────────────────────────────────────────────

  getAll: asyncHandler(async (req: Request, res: Response) => {
    const result = ticketFiltersSchema.safeParse({ query: req.query });
    if (!result.success) {
      throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid filters');
    }
    const tickets = await TicketService.findAll(result.data.query, req.user!.id);
    return sendSuccess(res, tickets, 'Tickets retrieved successfully');
  }),

  getById: asyncHandler(async (req: Request, res: Response) => {
    const result = ticketIdSchema.safeParse({ params: req.params });
    if (!result.success) {
      throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid ID');
    }
    const ticket = await TicketService.findByIdWithHistory(result.data.params.id);
    if (!ticket) {
      throw new AppError(404, 'Ticket not found');
    }
    return sendSuccess(res, ticket, 'Ticket retrieved successfully');
  }),

  // ─── Update ────────────────────────────────────────────────────────────────────

  update: asyncHandler(async (req: Request, res: Response) => {
    const paramsResult = ticketIdSchema.safeParse({ params: req.params });
    if (!paramsResult.success) {
      throw new AppError(400, paramsResult.error.issues[0]?.message ?? 'Invalid ID');
    }
    const bodyResult = updateTicketSchema.safeParse({ body: req.body });
    if (!bodyResult.success) {
      throw new AppError(400, bodyResult.error.issues[0]?.message ?? 'Invalid data');
    }
    const ticket = await TicketService.update(
      paramsResult.data.params.id,
      bodyResult.data.body,
      req.user!.id
    );
    
    // ── Emit real-time event ──────────────────────────────────────────────────
    safeRealtimeEmit(req, 'ticket_updated', ticket);
    
    return sendSuccess(res, ticket, 'Ticket updated successfully');
  }),

  // ─── Workflow ─────────────────────────────────────────────────────────────────

  submitForApproval: asyncHandler(async (req: Request, res: Response) => {
    const result = ticketIdSchema.safeParse({ params: req.params });
    if (!result.success) {
      throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid ID');
    }
    const ticket = await TicketService.submitForApproval(result.data.params.id, req.user!.id);
    
    // ── Emit real-time event ──────────────────────────────────────────────────
    safeRealtimeEmit(req, 'ticket_submitted', {
      id: ticket.id,
      title: ticket.title,
      status: ticket.status,
      reference_no: ticket.reference_no,
    });
    
    return sendSuccess(res, ticket, 'Ticket submitted for approval');
  }),

  approve: asyncHandler(async (req: Request, res: Response) => {
    const paramsResult = ticketIdSchema.safeParse({ params: req.params });
    if (!paramsResult.success) {
      throw new AppError(400, paramsResult.error.issues[0]?.message ?? 'Invalid ID');
    }
    const bodyResult = approveTicketSchema.safeParse({ body: req.body });
    if (!bodyResult.success) {
      throw new AppError(400, bodyResult.error.issues[0]?.message ?? 'Invalid data');
    }
    const ticket = await TicketService.approveTicket(
      paramsResult.data.params.id,
      bodyResult.data.body,
      req.user!.id
    );
    
    // ── Emit real-time event ──────────────────────────────────────────────────
    safeRealtimeEmit(req, 'ticket_approved', {
      id: ticket.id,
      title: ticket.title,
      status: ticket.status,
      reference_no: ticket.reference_no,
      approved_by: req.user!.full_name,
      approved_at: new Date().toISOString(),
    });
    
    return sendSuccess(res, ticket, 'Ticket approved successfully');
  }),

  reject: asyncHandler(async (req: Request, res: Response) => {
    const paramsResult = ticketIdSchema.safeParse({ params: req.params });
    if (!paramsResult.success) {
      throw new AppError(400, paramsResult.error.issues[0]?.message ?? 'Invalid ID');
    }
    const bodyResult = rejectTicketSchema.safeParse({ body: req.body });
    if (!bodyResult.success) {
      throw new AppError(400, bodyResult.error.issues[0]?.message ?? 'Invalid data');
    }
    const ticket = await TicketService.rejectTicket(
      paramsResult.data.params.id,
      bodyResult.data.body,
      req.user!.id
    );
    
    // ── Emit real-time event ──────────────────────────────────────────────────
    safeRealtimeEmit(req, 'ticket_rejected', {
      id: ticket.id,
      title: ticket.title,
      status: ticket.status,
      reference_no: ticket.reference_no,
      rejected_by: req.user!.full_name,
      reason: bodyResult.data.body.reason,
    });
    
    return sendSuccess(res, ticket, 'Ticket rejected');
  }),

  return: asyncHandler(async (req: Request, res: Response) => {
    const paramsResult = ticketIdSchema.safeParse({ params: req.params });
    if (!paramsResult.success) {
      throw new AppError(400, paramsResult.error.issues[0]?.message ?? 'Invalid ID');
    }
    const bodyResult = returnTicketSchema.safeParse({ body: req.body });
    if (!bodyResult.success) {
      throw new AppError(400, bodyResult.error.issues[0]?.message ?? 'Invalid data');
    }
    const ticket = await TicketService.returnTicket(
      paramsResult.data.params.id,
      bodyResult.data.body,
      req.user!.id
    );
    
    // ── Emit real-time event ──────────────────────────────────────────────────
    safeRealtimeEmit(req, 'ticket_returned', {
      id: ticket.id,
      title: ticket.title,
      status: ticket.status,
      reference_no: ticket.reference_no,
      returned_by: req.user!.full_name,
      reason: bodyResult.data.body.reason,
    });
    
    return sendSuccess(res, ticket, 'Ticket returned successfully');
  }),

  book: asyncHandler(async (req: Request, res: Response) => {
    const paramsResult = ticketIdSchema.safeParse({ params: req.params });
    if (!paramsResult.success) {
      throw new AppError(400, paramsResult.error.issues[0]?.message ?? 'Invalid ID');
    }
    const bodyResult = bookTicketSchema.safeParse({ body: req.body });
    if (!bodyResult.success) {
      throw new AppError(400, bodyResult.error.issues[0]?.message ?? 'Invalid data');
    }
    const ticket = await TicketService.bookTicket(
      paramsResult.data.params.id,
      bodyResult.data.body,
      req.user!.id
    );
    
    // ── Emit real-time event ──────────────────────────────────────────────────
    safeRealtimeEmit(req, 'ticket_booked', {
      id: ticket.id,
      title: ticket.title,
      status: ticket.status,
      reference_no: ticket.reference_no,
      booking_reference: bodyResult.data.body.booking_reference,
      booked_by: req.user!.full_name,
    });
    
    return sendSuccess(res, ticket, 'Ticket booked successfully');
  }),

  cancel: asyncHandler(async (req: Request, res: Response) => {
    const result = ticketIdSchema.safeParse({ params: req.params });
    if (!result.success) {
      throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid ID');
    }
    const ticket = await TicketService.cancelTicket(result.data.params.id, req.user!.id);
    
    // ── Emit real-time event ──────────────────────────────────────────────────
    safeRealtimeEmit(req, 'ticket_cancelled', {
      id: ticket.id,
      title: ticket.title,
      status: ticket.status,
      reference_no: ticket.reference_no,
      cancelled_by: req.user!.full_name,
    });
    
    return sendSuccess(res, ticket, 'Ticket cancelled');
  }),

  complete: asyncHandler(async (req: Request, res: Response) => {
    const result = ticketIdSchema.safeParse({ params: req.params });
    if (!result.success) {
      throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid ID');
    }
    const ticket = await TicketService.completeTicket(result.data.params.id, req.user!.id);
    
    // ── Emit real-time event ──────────────────────────────────────────────────
    safeRealtimeEmit(req, 'ticket_completed', {
      id: ticket.id,
      title: ticket.title,
      status: ticket.status,
      reference_no: ticket.reference_no,
      completed_by: req.user!.full_name,
    });
    
    return sendSuccess(res, ticket, 'Ticket completed');
  }),

  // ─── Comments ─────────────────────────────────────────────────────────────────

  addComment: asyncHandler(async (req: Request, res: Response) => {
    const paramsResult = ticketIdSchema.safeParse({ params: req.params });
    if (!paramsResult.success) {
      throw new AppError(400, paramsResult.error.issues[0]?.message ?? 'Invalid ID');
    }
    const bodyResult = addCommentSchema.safeParse({ body: req.body });
    if (!bodyResult.success) {
      throw new AppError(400, bodyResult.error.issues[0]?.message ?? 'Invalid data');
    }
    const comment = await TicketService.addComment(
      paramsResult.data.params.id,
      bodyResult.data.body,
      req.user!.id
    );
    
    // ── Emit real-time event ──────────────────────────────────────────────────
    safeRealtimeEmitToRoom(req, `ticket:${paramsResult.data.params.id}`, 'ticket_comment_added', {
      ticket_id: paramsResult.data.params.id,
      comment: comment,
      added_by: req.user!.full_name,
      added_at: new Date().toISOString(),
    });
    
    return sendSuccess(res, comment, 'Comment added successfully', 201);
  }),

  deleteComment: asyncHandler(async (req: Request, res: Response) => {
    const result = ticketCommentIdSchema.safeParse({ params: req.params });
    if (!result.success) {
      throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid ID');
    }
    await TicketService.deleteComment(
      result.data.params.id,
      result.data.params.commentId,
      req.user!.id
    );
    
    // ── Emit real-time event ──────────────────────────────────────────────────
    safeRealtimeEmitToRoom(req, `ticket:${result.data.params.id}`, 'ticket_comment_deleted', {
      ticket_id: result.data.params.id,
      comment_id: result.data.params.commentId,
      deleted_by: req.user!.full_name,
    });
    
    return sendSuccess(res, null, 'Comment deleted successfully');
  }),

  // ─── Delete ───────────────────────────────────────────────────────────────────

  delete: asyncHandler(async (req: Request, res: Response) => {
    const result = ticketIdSchema.safeParse({ params: req.params });
    if (!result.success) {
      throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid ID');
    }
    await TicketService.softDelete(result.data.params.id);
    
    // ── Emit real-time event ──────────────────────────────────────────────────
    safeRealtimeEmit(req, 'ticket_deleted', { id: result.data.params.id });
    
    return sendSuccess(res, null, 'Ticket deleted successfully');
  }),
};