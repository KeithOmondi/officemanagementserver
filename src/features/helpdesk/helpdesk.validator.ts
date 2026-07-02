import { z } from 'zod';

// ─── Shared ──────────────────────────────────────────────────────────────────

const statusEnum = z.enum(['Pending', 'Signed', 'Rejected', 'In Progress', 'Completed', 'Active', 'Resolved']);
const utilityTypeEnum = z.enum(['Electricity', 'Water', 'Internet', 'Fuel', 'Other']);
const requestModeEnum = z.enum(['Letter', 'Email', 'Verbal', 'Other']);
const visaTypeEnum = z.enum(['Official', 'Conference', 'Personal', 'Other']);

const dateStringSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

// DSA Detail schema - notes is optional string only (not null)
const dsaDetailSchema = z.object({
    judge_name: z.string().min(1).max(100),
    pj_number: z.string().min(1).max(50),
    dsa_per_day: z.number().min(0),
    days: z.number().int().min(1),
    notes: z.string().optional(),
    designation: z.string().optional(),
});

// ─── Judge Utilities (restructured) ──────────────────────────────────────────

const utilityStatusEnum = z.enum([
    'Awaiting',
    'Awaiting Documentation',
    'Awaiting Funding',
    'In Process',
    'Approved',
    'Paid',
    'Payment NA',
]);

const utilityItemSchema = z.object({
    utility_type: utilityTypeEnum,
    amount: z.number().min(0),
    period: z.string().min(1).max(50),
    description: z.string().optional(),
    date_received: dateStringSchema.optional(),
    date_forwarded_dass: dateStringSchema.optional(),
    date_paid: dateStringSchema.optional(),
    status: utilityStatusEnum.optional(),
});

// Create a judge utility request with one or more utility items at once
export const createUtilitySchema = z.object({
    body: z.object({
        judge_name: z.string().min(1).max(100),
        items: z.array(utilityItemSchema).min(1, 'At least one utility item is required'),
    }).strict(),
});

// Add a single utility item to an existing judge
export const addUtilityItemSchema = z.object({
    body: utilityItemSchema.strict(),
});

// Update a single utility item's status/dates/amount/type/etc.
export const updateUtilityItemSchema = z.object({
    body: z.object({
        status: utilityStatusEnum.optional(),
        date_received: dateStringSchema.optional(),
        date_forwarded_dass: dateStringSchema.optional(),
        date_paid: dateStringSchema.optional(),
        amount: z.number().min(0).optional(),
        period: z.string().min(1).max(50).optional(),
        description: z.string().optional(),
        utility_type: utilityTypeEnum.optional(), // ADDED — allows switching Electricity/Water/etc. on edit
    }).strict(),
});

export const utilityFiltersSchema = z.object({
    query: z.object({
        search: z.string().optional(),
        judge_name: z.string().optional(),
        status: utilityStatusEnum.optional(),
        limit: z.string().regex(/^\d+$/).optional().transform(Number),
        offset: z.string().regex(/^\d+$/).optional().transform(Number),
    }).strict(),
});

// ID pair for nested item routes: /utilities/:id/items/:itemId
export const utilityItemIdSchema = z.object({
    params: z.object({
        id: z.string().uuid('Request ID must be a valid UUID'),
        itemId: z.string().uuid('Item ID must be a valid UUID'),
    }),
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
        start_date: dateStringSchema,
        end_date: dateStringSchema,
        dsa_details: z.array(dsaDetailSchema).optional(),
    }).strict(),
});

// ─── Update Circuit DSA Details ──────────────────────────────────────────

export const updateCircuitDSASchema = z.object({
    body: z.object({
        dsa_details: z.array(dsaDetailSchema).min(1, 'At least one DSA detail is required'),
    }).strict(),
});

// ─── Special Benches ────────────────────────────────────────────────────────

export const createSpecialBenchSchema = z.object({
    body: z.object({
        name: z.string().min(1).max(200),
        case_reference: z.string().optional(),
        start_date: dateStringSchema,
        end_date: dateStringSchema,
        dsa_details: z.array(dsaDetailSchema).optional(),
    }).strict(),
});

// ─── Part-Heards ─────────────────────────────────────────────────────────────

export const createPartHeardSchema = z.object({
    body: z.object({
        case_reference: z.string().min(1).max(200),
        approved_by: z.string().optional(),
        start_date: dateStringSchema,
        end_date: dateStringSchema,
        dsa_details: z.array(dsaDetailSchema).optional(),
    }).strict(),
});

// ─── Judges' Requests ──────────────────────────────────────────────────────

export const createJudgeRequestSchema = z.object({
    body: z.object({
        judge_name: z.string().min(1).max(100),
        nature: z.string().min(1),
        mode: requestModeEnum,
        received_date: dateStringSchema,
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
        request_date: dateStringSchema,
        destination_country: z.string().min(1).max(100),
        visa_type: visaTypeEnum,
        travel_date: dateStringSchema.optional(),
        notes: z.string().optional(),
    }).strict(),
});

// ─── Protocol Support ──────────────────────────────────────────────────────

export const createProtocolEventSchema = z.object({
    body: z.object({
        event_name: z.string().min(1).max(200),
        start_date: dateStringSchema,
        end_date: dateStringSchema,
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
        start_date: dateStringSchema.optional(),
        end_date: dateStringSchema.optional(),
        limit: z.string().regex(/^\d+$/).optional().transform(Number),
        offset: z.string().regex(/^\d+$/).optional().transform(Number),
    }).strict(),
});

// Add to validators
export const createServiceWeekSchema = z.object({
    body: z.object({
        name: z.string().min(1).max(200),
        week_number: z.string().min(1).max(20),
        year: z.string().min(4).max(4),
        start_date: dateStringSchema,
        end_date: dateStringSchema,
        dsa_details: z.array(dsaDetailSchema).optional(),
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
export type AddUtilityItemInput = z.infer<typeof addUtilityItemSchema>['body'];
export type UpdateUtilityItemInput = z.infer<typeof updateUtilityItemSchema>['body'];
export type UtilityFilters = z.infer<typeof utilityFiltersSchema>['query'];
export type CreateClubMembershipInput = z.infer<typeof createClubMembershipSchema>['body'];
export type CreateCircuitInput = z.infer<typeof createCircuitSchema>['body'];
export type CreateSpecialBenchInput = z.infer<typeof createSpecialBenchSchema>['body'];
export type CreatePartHeardInput = z.infer<typeof createPartHeardSchema>['body'];
export type CreateJudgeRequestInput = z.infer<typeof createJudgeRequestSchema>['body'];
export type CreateVisaRequestInput = z.infer<typeof createVisaRequestSchema>['body'];
export type CreateProtocolEventInput = z.infer<typeof createProtocolEventSchema>['body'];
export type HelpDeskFilters = z.infer<typeof helpDeskFiltersSchema>['query'];
export type UpdateCircuitDSADetailsInput = z.infer<typeof updateCircuitDSASchema>['body'];