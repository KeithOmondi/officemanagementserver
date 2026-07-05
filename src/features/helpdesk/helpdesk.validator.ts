import { z } from 'zod';

// ─── Shared ──────────────────────────────────────────────────────────────────

const statusEnum = z.enum(['Pending', 'Signed', 'Rejected', 'In Progress', 'Completed', 'Active', 'Resolved']);
const utilityTypeEnum = z.enum(['Electricity', 'Water', 'Internet', 'Fuel', 'Other']);
const requestModeEnum = z.enum(['Letter', 'Email', 'Verbal', 'Other']);
const visaTypeEnum = z.enum(['Official', 'Conference', 'Personal', 'Other']);

const dateStringSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

// DSA Detail schema
const dsaDetailSchema = z.object({
    judge_name: z.string().min(1).max(100),
    pj_number: z.string().min(1).max(50),
    dsa_per_day: z.number().min(0),
    days: z.number().int().min(1),
    notes: z.string().optional(),
    designation: z.string().optional(),
});

// ─── Judge Utilities ──────────────────────────────────────────────────────────

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
    requisition_number: z.string().optional(),
    amount: z.number().min(0),
    period: z.string().min(1).max(50),
    description: z.string().optional(),
    date_received: dateStringSchema.optional(),
    date_forwarded_dass: dateStringSchema.optional(),
    date_paid: dateStringSchema.optional(),
    status: utilityStatusEnum.optional(),
});

export const createUtilitySchema = z.object({
    body: z.object({
        judge_name: z.string().min(1).max(100),
        items: z.array(utilityItemSchema).min(1, 'At least one utility item is required'),
    }).strict(),
});

export const addUtilityItemSchema = z.object({
    body: utilityItemSchema.strict(),
});

export const updateUtilityItemSchema = z.object({
    body: z.object({
        status: utilityStatusEnum.optional(),
        date_received: dateStringSchema.optional(),
        date_forwarded_dass: dateStringSchema.optional(),
        date_paid: dateStringSchema.optional(),
        amount: z.number().min(0).optional(),
        period: z.string().min(1).max(50).optional(),
        description: z.string().optional(),
        utility_type: utilityTypeEnum.optional(),
        requisition_number: z.string().optional(),
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

export const utilityItemIdSchema = z.object({
    params: z.object({
        id: z.string().uuid('Request ID must be a valid UUID'),
        itemId: z.string().uuid('Item ID must be a valid UUID'),
    }),
});

// ─── Club Membership ──────────────────────────────────────────────────────────

export const createClubMembershipSchema = z.object({
    body: z.object({
        pj_no: z.string().optional(),
        judge_name: z.string().min(1).max(100),
        club_name: z.string().min(1).max(100),
        entry_fee: z.number().min(0).optional(),
        annual_fee: z.number().min(0).optional(),
        date_submitted_dass: dateStringSchema.optional(),
        court: z.string().optional(),
        payment_date: dateStringSchema.optional(),
        remarks: z.string().optional(),
    }).strict(),
});

// ─── Circuits ─────────────────────────────────────────────────────────────────

export const createCircuitSchema = z.object({
    body: z.object({
        name: z.string().min(1).max(100),
        location: z.string().optional(),
        start_date: dateStringSchema,
        end_date: dateStringSchema,
        dsa_details: z.array(dsaDetailSchema).optional(),
    }).strict(),
});

export const updateCircuitDSASchema = z.object({
    body: z.object({
        dsa_details: z.array(dsaDetailSchema).min(1, 'At least one DSA detail is required'),
    }).strict(),
});

// ─── Other Payments ───────────────────────────────────────────────────────────

export const createOtherPaymentSchema = z.object({
    body: z.object({
        name: z.string().min(1).max(100),
        description: z.string().optional(),
        start_date: dateStringSchema,
        end_date: dateStringSchema,
        dsa_details: z.array(dsaDetailSchema).optional(),
    }).strict(),
});

export const updateOtherPaymentDSASchema = z.object({
    body: z.object({
        dsa_details: z.array(dsaDetailSchema).min(1, 'At least one DSA detail is required'),
    }).strict(),
});

// ─── Special Benches ─────────────────────────────────────────────────────────

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

// ─── Medical Expense Claims ──────────────────────────────────────────────────

export const createMedicalClaimSchema = z.object({
    body: z.object({
        s_no: z.number().int().min(1).optional(),
        officer_name: z.string().min(1).max(100),
        claim_amount: z.number().min(0),
        date_forwarded_dhr: dateStringSchema.optional(),
        status: statusEnum.optional(),
        remarks: z.string().optional(),
    }).strict(),
});

// ─── General Requests ────────────────────────────────────────────────────────

export const createGeneralRequestSchema = z.object({
    body: z.object({
        s_no: z.number().int().min(1).optional(),
        judge_name: z.string().min(1).max(100),
        request: z.string().min(1),
        date_received: dateStringSchema.optional(),
        officer_assigned: z.string().optional(),
        status: statusEnum.optional(),
        remarks: z.string().optional(),
    }).strict(),
});

// ─── Visa Support ────────────────────────────────────────────────────────────

export const createVisaRequestSchema = z.object({
    body: z.object({
        s_no: z.number().int().min(1).optional(),
        name: z.string().min(1).max(100),
        destination_country: z.string().min(1).max(100),
        date_of_travel: dateStringSchema.optional(),
        date_of_return: dateStringSchema.optional(),
        visa_type: visaTypeEnum,
        purpose_of_travel: z.string().optional(),
        remarks: z.string().optional(),
        notes: z.string().optional(),
    }).strict(),
});

// ─── Protocol Support ─────────────────────────────────────────────────────────

export const createProtocolEventSchema = z.object({
    body: z.object({
        s_no: z.number().int().min(1).optional(),
        activity: z.string().min(1).max(200),
        period_from: dateStringSchema.optional(),
        period_to: dateStringSchema.optional(),
        officers_assigned: z.string().optional(),
        remarks: z.string().optional(),
        notes: z.string().optional(),
        dsa_required: z.boolean().default(false),
        dsa_details: z.array(dsaDetailSchema).optional(),
    }).strict(),
});

// ─── Service Week ────────────────────────────────────────────────────────────

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
export type CreateOtherPaymentInput = z.infer<typeof createOtherPaymentSchema>['body'];
export type CreateSpecialBenchInput = z.infer<typeof createSpecialBenchSchema>['body'];
export type CreatePartHeardInput = z.infer<typeof createPartHeardSchema>['body'];
export type CreateMedicalClaimInput = z.infer<typeof createMedicalClaimSchema>['body'];
export type CreateGeneralRequestInput = z.infer<typeof createGeneralRequestSchema>['body'];
export type CreateVisaRequestInput = z.infer<typeof createVisaRequestSchema>['body'];
export type CreateProtocolEventInput = z.infer<typeof createProtocolEventSchema>['body'];
export type HelpDeskFilters = z.infer<typeof helpDeskFiltersSchema>['query'];
export type UpdateCircuitDSADetailsInput = z.infer<typeof updateCircuitDSASchema>['body'];
export type UpdateOtherPaymentDSADetailsInput = z.infer<typeof updateOtherPaymentDSASchema>['body'];