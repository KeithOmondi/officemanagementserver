import { z } from 'zod';

// ─── Shared ──────────────────────────────────────────────────────────────────

const statusEnum = z.enum(['Pending', 'Signed', 'Rejected', 'In Progress', 'Completed', 'Active', 'Resolved']);
const utilityTypeEnum = z.enum(['Electricity', 'Water', 'Internet', 'Fuel', 'Other']);
const requestModeEnum = z.enum(['Letter', 'Email', 'Verbal', 'Other']);
const visaTypeEnum = z.enum(['Official', 'Conference', 'Personal', 'Other']);

const dsaDetailSchema = z.object({
    judge_name: z.string().min(1).max(100),
    pj_number: z.string().min(1).max(50),
    dsa_per_day: z.number().min(0),
    days: z.number().int().min(1),
});

// ─── Utilities ──────────────────────────────────────────────────────────────

export const createUtilitySchema = z.object({
    body: z.object({
        judge_name: z.string().min(1).max(100),
        utility_type: utilityTypeEnum,
        amount: z.number().min(0),
        period: z.string().min(1).max(50),
        description: z.string().optional(),
    }).strict(),
});

export const updateUtilityStatusSchema = z.object({
    body: z.object({
        status: statusEnum,
    }).strict(),
});

// ─── Club Membership ────────────────────────────────────────────────────────

export const createClubMembershipSchema = z.object({
    body: z.object({
        judge_name: z.string().min(1).max(100),
        club_name: z.string().min(1).max(100),
        annual_fee: z.number().min(0),
        period: z.string().min(1).max(50),
    }).strict(),
});

// ─── Circuits ──────────────────────────────────────────────────────────────

export const createCircuitSchema = z.object({
    body: z.object({
        name: z.string().min(1).max(100),
        location: z.string().optional(),
        start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        dsa_details: z.array(dsaDetailSchema).optional(),
    }).strict(),
});

// ─── Special Benches ────────────────────────────────────────────────────────

export const createSpecialBenchSchema = z.object({
    body: z.object({
        name: z.string().min(1).max(200),
        case_reference: z.string().optional(),
        start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        dsa_details: z.array(dsaDetailSchema).optional(),
    }).strict(),
});

// ─── Part-Heards ─────────────────────────────────────────────────────────────

export const createPartHeardSchema = z.object({
    body: z.object({
        case_reference: z.string().min(1).max(200),
        approved_by: z.string().optional(),
        start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        dsa_details: z.array(dsaDetailSchema).optional(),
    }).strict(),
});

// ─── Judges' Requests ──────────────────────────────────────────────────────

export const createJudgeRequestSchema = z.object({
    body: z.object({
        judge_name: z.string().min(1).max(100),
        nature: z.string().min(1),
        mode: requestModeEnum,
        received_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    }).strict(),
});

export const updateJudgeRequestSchema = z.object({
    body: z.object({
        status: statusEnum,
        resolution_notes: z.string().optional(),
    }).strict(),
});

// ─── Visa Support ───────────────────────────────────────────────────────────

export const createVisaRequestSchema = z.object({
    body: z.object({
        judge_name: z.string().min(1).max(100),
        request_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        destination_country: z.string().min(1).max(100),
        visa_type: visaTypeEnum,
        travel_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        notes: z.string().optional(),
    }).strict(),
});

// ─── Protocol Support ──────────────────────────────────────────────────────

export const createProtocolEventSchema = z.object({
    body: z.object({
        event_name: z.string().min(1).max(200),
        start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        dsa_required: z.boolean().default(false),
        dsa_details: z.array(dsaDetailSchema).optional(),
        notes: z.string().optional(),
    }).strict(),
});

// ─── Filters ─────────────────────────────────────────────────────────────────

export const helpDeskFiltersSchema = z.object({
    query: z.object({
        search: z.string().optional(),
        status: statusEnum.optional(),
        judge_name: z.string().optional(),
        start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        limit: z.string().regex(/^\d+$/).optional().transform(Number),
        offset: z.string().regex(/^\d+$/).optional().transform(Number),
    }).strict(),
});

// ─── ID Schemas ─────────────────────────────────────────────────────────────

export const idSchema = z.object({
    params: z.object({
        id: z.string().uuid('ID must be a valid UUID'),
    }),
});

// ─── Type Exports ──────────────────────────────────────────────────────────

export type CreateUtilityInput = z.infer<typeof createUtilitySchema>['body'];
export type CreateClubMembershipInput = z.infer<typeof createClubMembershipSchema>['body'];
export type CreateCircuitInput = z.infer<typeof createCircuitSchema>['body'];
export type CreateSpecialBenchInput = z.infer<typeof createSpecialBenchSchema>['body'];
export type CreatePartHeardInput = z.infer<typeof createPartHeardSchema>['body'];
export type CreateJudgeRequestInput = z.infer<typeof createJudgeRequestSchema>['body'];
export type CreateVisaRequestInput = z.infer<typeof createVisaRequestSchema>['body'];
export type CreateProtocolEventInput = z.infer<typeof createProtocolEventSchema>['body'];
export type HelpDeskFilters = z.infer<typeof helpDeskFiltersSchema>['query'];