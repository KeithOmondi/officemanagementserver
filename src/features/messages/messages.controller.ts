// src/features/messages/messages.controller.ts

import { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { AppError, sendSuccess } from '../../utils/response';
import { MessagesService } from './messages.service';
import {
    createGroupSchema,
    updateGroupSchema,
    addGroupMembersSchema,
    removeGroupMemberSchema,
    sendMessageSchema,
    editMessageSchema,
    deleteMessageSchema,
    markMessageReadSchema,
    markMultipleMessagesReadSchema,
    messageFiltersSchema,
    messageIdSchema,
    groupIdSchema,
    conversationParamsSchema,
    unreadCountSchema,
} from './messages.validator';

export const messagesController = {

    // ─── Groups ─────────────────────────────────────────────────────────────

    getAllGroups: asyncHandler(async (req: Request, res: Response) => {
        const { group_type } = req.query;
        const groups = await MessagesService.findAllGroups(
            req.user!.id,
            group_type as string | undefined
        );
        return sendSuccess(res, groups, 'Message groups retrieved');
    }),

    getGroupById: asyncHandler(async (req: Request, res: Response) => {
        const result = groupIdSchema.safeParse({ params: req.params });
        if (!result.success) {
            throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid ID');
        }
        const group = await MessagesService.findGroupById(result.data.params.id);
        if (!group) throw new AppError(404, 'Message group not found');
        return sendSuccess(res, group, 'Message group retrieved');
    }),

    createGroup: asyncHandler(async (req: Request, res: Response) => {
        const result = createGroupSchema.safeParse({ body: req.body });
        if (!result.success) {
            throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid data');
        }
        const group = await MessagesService.createGroup(result.data.body, req.user!.id);
        return sendSuccess(res, group, 'Message group created', 201);
    }),

    updateGroup: asyncHandler(async (req: Request, res: Response) => {
        const paramsResult = groupIdSchema.safeParse({ params: req.params });
        if (!paramsResult.success) {
            throw new AppError(400, paramsResult.error.issues[0]?.message ?? 'Invalid ID');
        }
        const bodyResult = updateGroupSchema.safeParse({ body: req.body });
        if (!bodyResult.success) {
            throw new AppError(400, bodyResult.error.issues[0]?.message ?? 'Invalid data');
        }
        const group = await MessagesService.updateGroup(
            paramsResult.data.params.id,
            bodyResult.data.body
        );
        return sendSuccess(res, group, 'Message group updated');
    }),

    deleteGroup: asyncHandler(async (req: Request, res: Response) => {
        const result = groupIdSchema.safeParse({ params: req.params });
        if (!result.success) {
            throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid ID');
        }
        await MessagesService.deleteGroup(result.data.params.id);
        return sendSuccess(res, null, 'Message group deleted');
    }),

    // ─── Group Members ─────────────────────────────────────────────────────

    getGroupMembers: asyncHandler(async (req: Request, res: Response) => {
        const result = groupIdSchema.safeParse({ params: req.params });
        if (!result.success) {
            throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid ID');
        }
        const members = await MessagesService.getGroupMembers(result.data.params.id);
        return sendSuccess(res, members, 'Group members retrieved');
    }),

    addGroupMembers: asyncHandler(async (req: Request, res: Response) => {
        const paramsResult = groupIdSchema.safeParse({ params: req.params });
        if (!paramsResult.success) {
            throw new AppError(400, paramsResult.error.issues[0]?.message ?? 'Invalid ID');
        }
        const bodyResult = addGroupMembersSchema.safeParse({ body: req.body });
        if (!bodyResult.success) {
            throw new AppError(400, bodyResult.error.issues[0]?.message ?? 'Invalid data');
        }
        const members = await MessagesService.addGroupMembers(
            paramsResult.data.params.id,
            bodyResult.data.body,
            req.user!.id
        );
        return sendSuccess(res, members, 'Members added to group');
    }),

    removeGroupMember: asyncHandler(async (req: Request, res: Response) => {
        const result = removeGroupMemberSchema.safeParse({ params: req.params });
        if (!result.success) {
            throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid data');
        }
        await MessagesService.removeGroupMember(
            result.data.params.groupId,
            result.data.params.userId,
            req.user!.id
        );
        return sendSuccess(res, null, 'Member removed from group');
    }),

    // ─── Messages ──────────────────────────────────────────────────────────

    getMessages: asyncHandler(async (req: Request, res: Response) => {
        const result = messageFiltersSchema.safeParse({ query: req.query });
        if (!result.success) {
            throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid filters');
        }
        const { messages, total } = await MessagesService.getMessages(
            result.data.query,
            req.user!.id
        );
        return sendSuccess(res, { messages, total }, 'Messages retrieved');
    }),

    sendMessage: asyncHandler(async (req: Request, res: Response) => {
        const result = sendMessageSchema.safeParse({ body: req.body });
        if (!result.success) {
            throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid data');
        }
        const message = await MessagesService.sendMessage(result.data.body, req.user!.id);
        return sendSuccess(res, message, 'Message sent', 201);
    }),

    // ─── NEW: Edit Message ─────────────────────────────────────────────────

    editMessage: asyncHandler(async (req: Request, res: Response) => {
        const result = editMessageSchema.safeParse({ params: req.params, body: req.body });
        if (!result.success) {
            throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid data');
        }
        const message = await MessagesService.editMessage(
            result.data.params.id,
            result.data.body,
            req.user!.id
        );
        return sendSuccess(res, message, 'Message edited successfully');
    }),

    // ─── NEW: Delete Message ──────────────────────────────────────────────

    deleteMessage: asyncHandler(async (req: Request, res: Response) => {
        const result = deleteMessageSchema.safeParse({ params: req.params, body: req.body });
        if (!result.success) {
            throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid data');
        }
        await MessagesService.deleteMessage(
            result.data.params.id,
            result.data.body,
            req.user!.id,
            req.user!.role
        );
        return sendSuccess(res, null, 'Message deleted successfully');
    }),

    // ─── Get Conversation (DM) ─────────────────────────────────────────────

    getConversation: asyncHandler(async (req: Request, res: Response) => {
        const result = conversationParamsSchema.safeParse({ params: req.params, query: req.query });
        if (!result.success) {
            throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid params');
        }

        const { userId } = result.data.params;
        const { limit, offset } = result.data.query;

        if (userId === req.user!.id) {
            throw new AppError(400, 'Cannot fetch conversation with yourself');
        }

        const { messages, total } = await MessagesService.getConversation(
            req.user!.id,
            userId,
            limit,
            offset
        );

        return sendSuccess(res, { messages, total }, 'Conversation retrieved');
    }),

    // ─── Get Conversations List ────────────────────────────────────────────

    getConversationsList: asyncHandler(async (req: Request, res: Response) => {
        const conversations = await MessagesService.getConversationsList(req.user!.id);
        return sendSuccess(res, conversations, 'Conversations retrieved');
    }),

    // ─── Message Status ─────────────────────────────────────────────────────

    getUnreadCount: asyncHandler(async (req: Request, res: Response) => {
        const unread = await MessagesService.getUnreadCount(req.user!.id);
        return sendSuccess(res, unread, 'Unread count retrieved');
    }),

    markAsRead: asyncHandler(async (req: Request, res: Response) => {
        const result = markMessageReadSchema.safeParse({ params: req.params });
        if (!result.success) {
            throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid ID');
        }
        await MessagesService.markMessageAsRead(result.data.params.id, req.user!.id);
        return sendSuccess(res, null, 'Message marked as read');
    }),

    markMultipleAsRead: asyncHandler(async (req: Request, res: Response) => {
        const result = markMultipleMessagesReadSchema.safeParse({ body: req.body });
        if (!result.success) {
            throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid data');
        }
        const { count } = await MessagesService.markMultipleMessagesAsRead(
            result.data.body.message_ids,
            req.user!.id
        );
        return sendSuccess(res, { count }, `${count} messages marked as read`);
    }),

    markAllRead: asyncHandler(async (req: Request, res: Response) => {
        const result = unreadCountSchema.safeParse({ query: req.query });
        if (!result.success) {
            throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid query');
        }
        await MessagesService.markAllRead(req.user!.id, result.data.query.group_id);
        return sendSuccess(res, null, 'All messages marked as read');
    }),

    archiveMessage: asyncHandler(async (req: Request, res: Response) => {
        const result = messageIdSchema.safeParse({ params: req.params });
        if (!result.success) {
            throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid ID');
        }
        await MessagesService.archiveMessage(result.data.params.id, req.user!.id);
        return sendSuccess(res, null, 'Message archived');
    }),
};