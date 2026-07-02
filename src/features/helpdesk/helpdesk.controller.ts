import { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { AppError, sendSuccess } from '../../utils/response';
import { HelpDeskService } from './helpdesk.service';
import {
    createUtilitySchema,
    addUtilityItemSchema,
    updateUtilityItemSchema,
    utilityFiltersSchema,
    utilityItemIdSchema,
    createClubMembershipSchema,
    createCircuitSchema,
    createSpecialBenchSchema,
    createPartHeardSchema,
    createJudgeRequestSchema,
    createVisaRequestSchema,
    createProtocolEventSchema,
    helpDeskFiltersSchema,
    idSchema,
    updateCircuitDSASchema,
    createServiceWeekSchema,
} from './helpdesk.validator';

export const helpDeskController = {

    // ─── Stats & Audit ──────────────────────────────────────────────────────

    getStats: asyncHandler(async (_req: Request, res: Response) => {
        const stats = await HelpDeskService.getStats();
        return sendSuccess(res, stats, 'Help desk statistics retrieved');
    }),

    getAuditLog: asyncHandler(async (req: Request, res: Response) => {
        const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
        const logs = await HelpDeskService.getAuditLog(limit);
        return sendSuccess(res, logs, 'Audit log retrieved');
    }),

    // ─── Judge Utilities (one judge → many utility items) ───────────────────

    getAllUtilities: asyncHandler(async (req: Request, res: Response) => {
        const result = utilityFiltersSchema.safeParse({ query: req.query });
        if (!result.success) {
            throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid filters');
        }
        const utilities = await HelpDeskService.findAllUtilities(result.data.query);
        return sendSuccess(res, utilities, 'Judge utilities retrieved');
    }),

    getUtilityById: asyncHandler(async (req: Request, res: Response) => {
        const result = idSchema.safeParse({ params: req.params });
        if (!result.success) {
            throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid ID');
        }
        const utility = await HelpDeskService.findUtilityById(result.data.params.id);
        if (!utility) {
            throw new AppError(404, 'Judge utility record not found');
        }
        return sendSuccess(res, utility, 'Judge utility record retrieved');
    }),

    // Creates a judge + one or more utility items in one call
    createUtility: asyncHandler(async (req: Request, res: Response) => {
        const result = createUtilitySchema.safeParse({ body: req.body });
        if (!result.success) {
            throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid data');
        }
        const utility = await HelpDeskService.createUtility(result.data.body, req.user!.id);
        return sendSuccess(res, utility, 'Judge utility record created', 201);
    }),

    // Adds a new utility item under an existing judge
    addUtilityItem: asyncHandler(async (req: Request, res: Response) => {
        const paramsResult = idSchema.safeParse({ params: req.params });
        if (!paramsResult.success) {
            throw new AppError(400, paramsResult.error.issues[0]?.message ?? 'Invalid ID');
        }
        const bodyResult = addUtilityItemSchema.safeParse({ body: req.body });
        if (!bodyResult.success) {
            throw new AppError(400, bodyResult.error.issues[0]?.message ?? 'Invalid data');
        }
        const utility = await HelpDeskService.addUtilityItem(
            paramsResult.data.params.id,
            bodyResult.data.body
        );
        return sendSuccess(res, utility, 'Utility item added', 201);
    }),

    // Updates a single utility item's status/dates/amount/etc.
    updateUtilityItem: asyncHandler(async (req: Request, res: Response) => {
        const paramsResult = utilityItemIdSchema.safeParse({ params: req.params });
        if (!paramsResult.success) {
            throw new AppError(400, paramsResult.error.issues[0]?.message ?? 'Invalid ID');
        }
        const bodyResult = updateUtilityItemSchema.safeParse({ body: req.body });
        if (!bodyResult.success) {
            throw new AppError(400, bodyResult.error.issues[0]?.message ?? 'Invalid data');
        }
        const utility = await HelpDeskService.updateUtilityItem(
            paramsResult.data.params.id,
            paramsResult.data.params.itemId,
            bodyResult.data.body
        );
        return sendSuccess(res, utility, 'Utility item updated');
    }),

    deleteUtilityItem: asyncHandler(async (req: Request, res: Response) => {
        const result = utilityItemIdSchema.safeParse({ params: req.params });
        if (!result.success) {
            throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid ID');
        }
        await HelpDeskService.deleteUtilityItem(result.data.params.id, result.data.params.itemId);
        return sendSuccess(res, null, 'Utility item deleted');
    }),

    deleteUtility: asyncHandler(async (req: Request, res: Response) => {
        const result = idSchema.safeParse({ params: req.params });
        if (!result.success) {
            throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid ID');
        }
        await HelpDeskService.deleteUtility(result.data.params.id);
        return sendSuccess(res, null, 'Judge utility record deleted');
    }),

    // ─── Club Membership ─────────────────────────────────────────────────────

    getAllClubMemberships: asyncHandler(async (req: Request, res: Response) => {
        const result = helpDeskFiltersSchema.safeParse({ query: req.query });
        if (!result.success) {
            throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid filters');
        }
        const memberships = await HelpDeskService.findAllClubMemberships(result.data.query);
        return sendSuccess(res, memberships, 'Club memberships retrieved');
    }),

    getClubMembershipById: asyncHandler(async (req: Request, res: Response) => {
        const result = idSchema.safeParse({ params: req.params });
        if (!result.success) {
            throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid ID');
        }
        const membership = await HelpDeskService.findClubMembershipById(result.data.params.id);
        if (!membership) {
            throw new AppError(404, 'Club membership not found');
        }
        return sendSuccess(res, membership, 'Club membership retrieved');
    }),

    createClubMembership: asyncHandler(async (req: Request, res: Response) => {
        const result = createClubMembershipSchema.safeParse({ body: req.body });
        if (!result.success) {
            throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid data');
        }
        const membership = await HelpDeskService.createClubMembership(result.data.body, req.user!.id);
        return sendSuccess(res, membership, 'Club membership created', 201);
    }),

    updateClubMembershipStatus: asyncHandler(async (req: Request, res: Response) => {
        const paramsResult = idSchema.safeParse({ params: req.params });
        if (!paramsResult.success) {
            throw new AppError(400, paramsResult.error.issues[0]?.message ?? 'Invalid ID');
        }
        const { status } = req.body;
        if (!status) {
            throw new AppError(400, 'Status is required');
        }
        const membership = await HelpDeskService.updateClubMembershipStatus(
            paramsResult.data.params.id,
            { status }
        );
        return sendSuccess(res, membership, 'Club membership status updated');
    }),

    deleteClubMembership: asyncHandler(async (req: Request, res: Response) => {
        const result = idSchema.safeParse({ params: req.params });
        if (!result.success) {
            throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid ID');
        }
        await HelpDeskService.deleteClubMembership(result.data.params.id);
        return sendSuccess(res, null, 'Club membership deleted');
    }),

    // ─── Circuits ────────────────────────────────────────────────────────────

    getAllCircuits: asyncHandler(async (req: Request, res: Response) => {
        const result = helpDeskFiltersSchema.safeParse({ query: req.query });
        if (!result.success) {
            throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid filters');
        }
        const circuits = await HelpDeskService.findAllCircuits(result.data.query);
        return sendSuccess(res, circuits, 'Circuits retrieved');
    }),

    getCircuitById: asyncHandler(async (req: Request, res: Response) => {
        const result = idSchema.safeParse({ params: req.params });
        if (!result.success) {
            throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid ID');
        }
        const circuit = await HelpDeskService.findCircuitById(result.data.params.id);
        if (!circuit) {
            throw new AppError(404, 'Circuit not found');
        }
        return sendSuccess(res, circuit, 'Circuit retrieved');
    }),

    createCircuit: asyncHandler(async (req: Request, res: Response) => {
        const result = createCircuitSchema.safeParse({ body: req.body });
        if (!result.success) {
            throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid data');
        }
        const circuit = await HelpDeskService.createCircuit(result.data.body, req.user!.id);
        return sendSuccess(res, circuit, 'Circuit created', 201);
    }),

    updateCircuitStatus: asyncHandler(async (req: Request, res: Response) => {
        const paramsResult = idSchema.safeParse({ params: req.params });
        if (!paramsResult.success) {
            throw new AppError(400, paramsResult.error.issues[0]?.message ?? 'Invalid ID');
        }
        const { status } = req.body;
        if (!status) {
            throw new AppError(400, 'Status is required');
        }
        const circuit = await HelpDeskService.updateCircuitStatus(
            paramsResult.data.params.id,
            { status }
        );
        return sendSuccess(res, circuit, 'Circuit status updated');
    }),

    updateCircuitDSADetails: asyncHandler(async (req: Request, res: Response) => {
        const paramsResult = idSchema.safeParse({ params: req.params });
        if (!paramsResult.success) {
            throw new AppError(400, paramsResult.error.issues[0]?.message ?? 'Invalid ID');
        }
        
        const result = updateCircuitDSASchema.safeParse({ body: req.body });
        if (!result.success) {
            throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid DSA details data');
        }
        
        const circuit = await HelpDeskService.updateCircuitDSADetails(
            paramsResult.data.params.id,
            result.data.body.dsa_details
        );
        return sendSuccess(res, circuit, 'Circuit DSA details updated');
    }),

    deleteCircuit: asyncHandler(async (req: Request, res: Response) => {
        const result = idSchema.safeParse({ params: req.params });
        if (!result.success) {
            throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid ID');
        }
        await HelpDeskService.deleteCircuit(result.data.params.id);
        return sendSuccess(res, null, 'Circuit deleted');
    }),

    // ─── Special Benches ─────────────────────────────────────────────────────

    getAllBenches: asyncHandler(async (req: Request, res: Response) => {
        const result = helpDeskFiltersSchema.safeParse({ query: req.query });
        if (!result.success) {
            throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid filters');
        }
        const benches = await HelpDeskService.findAllBenches(result.data.query);
        return sendSuccess(res, benches, 'Special benches retrieved');
    }),

    getBenchById: asyncHandler(async (req: Request, res: Response) => {
        const result = idSchema.safeParse({ params: req.params });
        if (!result.success) {
            throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid ID');
        }
        const bench = await HelpDeskService.findBenchById(result.data.params.id);
        if (!bench) {
            throw new AppError(404, 'Special bench not found');
        }
        return sendSuccess(res, bench, 'Special bench retrieved');
    }),

    createBench: asyncHandler(async (req: Request, res: Response) => {
        const result = createSpecialBenchSchema.safeParse({ body: req.body });
        if (!result.success) {
            throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid data');
        }
        const bench = await HelpDeskService.createSpecialBench(result.data.body, req.user!.id);
        return sendSuccess(res, bench, 'Special bench created', 201);
    }),

    updateBenchStatus: asyncHandler(async (req: Request, res: Response) => {
        const paramsResult = idSchema.safeParse({ params: req.params });
        if (!paramsResult.success) {
            throw new AppError(400, paramsResult.error.issues[0]?.message ?? 'Invalid ID');
        }
        const { status } = req.body;
        if (!status) {
            throw new AppError(400, 'Status is required');
        }
        const bench = await HelpDeskService.updateBenchStatus(
            paramsResult.data.params.id,
            { status }
        );
        return sendSuccess(res, bench, 'Bench status updated');
    }),

    deleteBench: asyncHandler(async (req: Request, res: Response) => {
        const result = idSchema.safeParse({ params: req.params });
        if (!result.success) {
            throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid ID');
        }
        await HelpDeskService.deleteBench(result.data.params.id);
        return sendSuccess(res, null, 'Special bench deleted');
    }),

    // ─── Part-Heards ─────────────────────────────────────────────────────────

    getAllPartHeards: asyncHandler(async (req: Request, res: Response) => {
        const result = helpDeskFiltersSchema.safeParse({ query: req.query });
        if (!result.success) {
            throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid filters');
        }
        const partHeards = await HelpDeskService.findAllPartHeards(result.data.query);
        return sendSuccess(res, partHeards, 'Part-heards retrieved');
    }),

    getPartHeardById: asyncHandler(async (req: Request, res: Response) => {
        const result = idSchema.safeParse({ params: req.params });
        if (!result.success) {
            throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid ID');
        }
        const partHeard = await HelpDeskService.findPartHeardById(result.data.params.id);
        if (!partHeard) {
            throw new AppError(404, 'Part-heard not found');
        }
        return sendSuccess(res, partHeard, 'Part-heard retrieved');
    }),

    createPartHeard: asyncHandler(async (req: Request, res: Response) => {
        const result = createPartHeardSchema.safeParse({ body: req.body });
        if (!result.success) {
            throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid data');
        }
        const partHeard = await HelpDeskService.createPartHeard(result.data.body, req.user!.id);
        return sendSuccess(res, partHeard, 'Part-heard created', 201);
    }),

    updatePartHeardStatus: asyncHandler(async (req: Request, res: Response) => {
        const paramsResult = idSchema.safeParse({ params: req.params });
        if (!paramsResult.success) {
            throw new AppError(400, paramsResult.error.issues[0]?.message ?? 'Invalid ID');
        }
        const { status } = req.body;
        if (!status) {
            throw new AppError(400, 'Status is required');
        }
        const partHeard = await HelpDeskService.updatePartHeardStatus(
            paramsResult.data.params.id,
            { status }
        );
        return sendSuccess(res, partHeard, 'Part-heard status updated');
    }),

    deletePartHeard: asyncHandler(async (req: Request, res: Response) => {
        const result = idSchema.safeParse({ params: req.params });
        if (!result.success) {
            throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid ID');
        }
        await HelpDeskService.deletePartHeard(result.data.params.id);
        return sendSuccess(res, null, 'Part-heard deleted');
    }),

    // ─── Service Weeks ──────────────────────────────────────────────────────

    getAllServiceWeeks: asyncHandler(async (req: Request, res: Response) => {
        const result = helpDeskFiltersSchema.safeParse({ query: req.query });
        if (!result.success) {
            throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid filters');
        }
        const weeks = await HelpDeskService.findAllServiceWeeks(result.data.query);
        return sendSuccess(res, weeks, 'Service weeks retrieved');
    }),

    getServiceWeekById: asyncHandler(async (req: Request, res: Response) => {
        const result = idSchema.safeParse({ params: req.params });
        if (!result.success) {
            throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid ID');
        }
        const week = await HelpDeskService.findServiceWeekById(result.data.params.id);
        if (!week) {
            throw new AppError(404, 'Service week not found');
        }
        return sendSuccess(res, week, 'Service week retrieved');
    }),

    createServiceWeek: asyncHandler(async (req: Request, res: Response) => {
        const result = createServiceWeekSchema.safeParse({ body: req.body });
        if (!result.success) {
            throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid data');
        }
        const week = await HelpDeskService.createServiceWeek(result.data.body, req.user!.id);
        return sendSuccess(res, week, 'Service week created', 201);
    }),

    updateServiceWeekStatus: asyncHandler(async (req: Request, res: Response) => {
        const paramsResult = idSchema.safeParse({ params: req.params });
        if (!paramsResult.success) {
            throw new AppError(400, paramsResult.error.issues[0]?.message ?? 'Invalid ID');
        }
        const { status } = req.body;
        if (!status) {
            throw new AppError(400, 'Status is required');
        }
        const week = await HelpDeskService.updateServiceWeekStatus(
            paramsResult.data.params.id,
            { status }
        );
        return sendSuccess(res, week, 'Service week status updated');
    }),

    deleteServiceWeek: asyncHandler(async (req: Request, res: Response) => {
        const result = idSchema.safeParse({ params: req.params });
        if (!result.success) {
            throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid ID');
        }
        await HelpDeskService.deleteServiceWeek(result.data.params.id);
        return sendSuccess(res, null, 'Service week deleted');
    }),

    // ─── Judges' Requests ────────────────────────────────────────────────────

    getAllRequests: asyncHandler(async (req: Request, res: Response) => {
        const result = helpDeskFiltersSchema.safeParse({ query: req.query });
        if (!result.success) {
            throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid filters');
        }
        const requests = await HelpDeskService.findAllRequests(result.data.query);
        return sendSuccess(res, requests, 'Requests retrieved');
    }),

    getRequestById: asyncHandler(async (req: Request, res: Response) => {
        const result = idSchema.safeParse({ params: req.params });
        if (!result.success) {
            throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid ID');
        }
        const request = await HelpDeskService.findRequestById(result.data.params.id);
        if (!request) {
            throw new AppError(404, 'Request not found');
        }
        return sendSuccess(res, request, 'Request retrieved');
    }),

    createRequest: asyncHandler(async (req: Request, res: Response) => {
        const result = createJudgeRequestSchema.safeParse({ body: req.body });
        if (!result.success) {
            throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid data');
        }
        const request = await HelpDeskService.createRequest(result.data.body, req.user!.id);
        return sendSuccess(res, request, 'Request created', 201);
    }),

    updateRequest: asyncHandler(async (req: Request, res: Response) => {
        const paramsResult = idSchema.safeParse({ params: req.params });
        if (!paramsResult.success) {
            throw new AppError(400, paramsResult.error.issues[0]?.message ?? 'Invalid ID');
        }
        const { status, resolution_notes } = req.body;
        if (!status) {
            throw new AppError(400, 'Status is required');
        }
        const request = await HelpDeskService.updateRequest(
            paramsResult.data.params.id,
            { status, resolution_notes }
        );
        return sendSuccess(res, request, 'Request updated');
    }),

    deleteRequest: asyncHandler(async (req: Request, res: Response) => {
        const result = idSchema.safeParse({ params: req.params });
        if (!result.success) {
            throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid ID');
        }
        await HelpDeskService.deleteRequest(result.data.params.id);
        return sendSuccess(res, null, 'Request deleted');
    }),

    // ─── Visa Support ────────────────────────────────────────────────────────

    getAllVisaRequests: asyncHandler(async (req: Request, res: Response) => {
        const result = helpDeskFiltersSchema.safeParse({ query: req.query });
        if (!result.success) {
            throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid filters');
        }
        const visas = await HelpDeskService.findAllVisaRequests(result.data.query);
        return sendSuccess(res, visas, 'Visa requests retrieved');
    }),

    getVisaRequestById: asyncHandler(async (req: Request, res: Response) => {
        const result = idSchema.safeParse({ params: req.params });
        if (!result.success) {
            throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid ID');
        }
        const visa = await HelpDeskService.findVisaRequestById(result.data.params.id);
        if (!visa) {
            throw new AppError(404, 'Visa request not found');
        }
        return sendSuccess(res, visa, 'Visa request retrieved');
    }),

    createVisaRequest: asyncHandler(async (req: Request, res: Response) => {
        const result = createVisaRequestSchema.safeParse({ body: req.body });
        if (!result.success) {
            throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid data');
        }
        const visa = await HelpDeskService.createVisaRequest(result.data.body, req.user!.id);
        return sendSuccess(res, visa, 'Visa request created', 201);
    }),

    updateVisaStatus: asyncHandler(async (req: Request, res: Response) => {
        const paramsResult = idSchema.safeParse({ params: req.params });
        if (!paramsResult.success) {
            throw new AppError(400, paramsResult.error.issues[0]?.message ?? 'Invalid ID');
        }
        const { status, notes } = req.body;
        if (!status) {
            throw new AppError(400, 'Status is required');
        }
        const visa = await HelpDeskService.updateVisaStatus(
            paramsResult.data.params.id,
            { status, notes }
        );
        return sendSuccess(res, visa, 'Visa status updated');
    }),

    deleteVisaRequest: asyncHandler(async (req: Request, res: Response) => {
        const result = idSchema.safeParse({ params: req.params });
        if (!result.success) {
            throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid ID');
        }
        await HelpDeskService.deleteVisaRequest(result.data.params.id);
        return sendSuccess(res, null, 'Visa request deleted');
    }),

    // ─── Protocol Support ────────────────────────────────────────────────────

    getAllProtocolEvents: asyncHandler(async (req: Request, res: Response) => {
        const result = helpDeskFiltersSchema.safeParse({ query: req.query });
        if (!result.success) {
            throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid filters');
        }
        const events = await HelpDeskService.findAllProtocolEvents(result.data.query);
        return sendSuccess(res, events, 'Protocol events retrieved');
    }),

    getProtocolEventById: asyncHandler(async (req: Request, res: Response) => {
        const result = idSchema.safeParse({ params: req.params });
        if (!result.success) {
            throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid ID');
        }
        const event = await HelpDeskService.findProtocolEventById(result.data.params.id);
        if (!event) {
            throw new AppError(404, 'Protocol event not found');
        }
        return sendSuccess(res, event, 'Protocol event retrieved');
    }),

    createProtocolEvent: asyncHandler(async (req: Request, res: Response) => {
        const result = createProtocolEventSchema.safeParse({ body: req.body });
        if (!result.success) {
            throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid data');
        }
        const event = await HelpDeskService.createProtocolEvent(result.data.body, req.user!.id);
        return sendSuccess(res, event, 'Protocol event created', 201);
    }),

    updateProtocolStatus: asyncHandler(async (req: Request, res: Response) => {
        const paramsResult = idSchema.safeParse({ params: req.params });
        if (!paramsResult.success) {
            throw new AppError(400, paramsResult.error.issues[0]?.message ?? 'Invalid ID');
        }
        const { status, notes } = req.body;
        if (!status) {
            throw new AppError(400, 'Status is required');
        }
        const event = await HelpDeskService.updateProtocolStatus(
            paramsResult.data.params.id,
            { status, notes }
        );
        return sendSuccess(res, event, 'Protocol status updated');
    }),

    deleteProtocolEvent: asyncHandler(async (req: Request, res: Response) => {
        const result = idSchema.safeParse({ params: req.params });
        if (!result.success) {
            throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid ID');
        }
        await HelpDeskService.deleteProtocolEvent(result.data.params.id);
        return sendSuccess(res, null, 'Protocol event deleted');
    }),
};