import { z } from 'zod';

// ============================================================
// Core Enums & Shared Schemas
// ============================================================

const statusEnum = z.enum(['Pending', 'Signed', 'Rejected', 'In Progress', 'Completed', 'Active', 'Resolved', 'Cancelled']);
const utilityTypeEnum = z.enum(['Electricity', 'Water', 'Internet', 'Fuel', 'Other']);
const visaTypeEnum = z.enum(['Official', 'Conference', 'Personal', 'Other']);
const paymentStatusEnum = z.enum(['Pending', 'In Process', 'Paid', 'Payment NA']);

// Enums for general requests
const requestTypeEnum = z.enum([
  'Driver',
  'Bodyguard',
  'Firearm',
  'Current Station',
  'Force Number',
  'Residence Security',
  'Sentry'
]);

const remarkTypeEnum = z.enum(['Onboarding', 'Release']);

const generalRequestCategoryEnum = z.enum(['Security', 'Personnel', 'Administrative']);

const dateStringSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format');

// ============================================================
// DSA Detail Schema
// ============================================================

const dsaDetailSchema = z.object({
    judge_name: z.string().min(1).max(100),
    pj_number: z.string().min(1).max(50),
    dsa_per_day: z.number().min(0),
    days: z.number().int().min(1),
    notes: z.string().optional(),
    designation: z.string().optional(),
    date_of_request: dateStringSchema.optional(),
    date_of_ticket_facilitation: dateStringSchema.optional(),
    date_of_conference_facilitation: dateStringSchema.optional(),
    travel_date: dateStringSchema.optional(),
    travel_back: dateStringSchema.optional(),
    requisition_number: z.string().max(50).optional(),
    requisition_initiation_date: dateStringSchema.optional(),
    payment_status: paymentStatusEnum.optional(),
});

// ============================================================
// General Requests (Unified - includes all security/personnel)
// ============================================================

/**
 * Schema for creating a general request
 * Supports: Driver, Bodyguard, Firearm, Current Station, Force Number, 
 * Residence Security, Sentry, and other general requests
 * 
 * Required fields are conditional on request_type:
 * - Driver / Bodyguard: officer_name, rank, reporting_date
 * - Force Number: force_number
 * - Current Station / Residence Security / Sentry: location
 * - Firearm: firearm_type is **optional** initially, but required when `officer_assigned` is provided.
 */
export const createGeneralRequestSchema = z.object({
    body: z.object({
        judge_name: z.string().min(1).max(100),
        request: z.string().min(1, 'Request description is required'),
        request_type: requestTypeEnum,
        category: generalRequestCategoryEnum.optional(),
        date_received: dateStringSchema.optional(),
        officer_assigned: z.string().optional(),
        status: statusEnum.optional(),
        remarks: z.string().optional(),
        remark_type: remarkTypeEnum.optional(), // Onboarding or Release

        // Security/Personnel specific fields — conditionally required, see superRefine below
        request_date: dateStringSchema,               // now required for all
        location: z.string().optional(),
        firearm_type: z.string().optional(),
        force_number: z.string().optional(),
        officer_name: z.string().optional(),
        assigned_to: z.string().optional(),
        priority: z.string().optional(),
        notes: z.string().optional(),

        rank: z.string().optional(),
        reporting_date: dateStringSchema.optional(),

        // Notification
        email: z.string().email('Valid email is required for notifications').optional(),
        send_email: z.boolean().default(false),
    }).strict()
    .superRefine((data, ctx) => {
        const requireField = (
            field: keyof typeof data,
            message: string
        ) => {
            const value = data[field];
            if (value === undefined || value === null || value === '') {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: [field],
                    message,
                });
            }
        };

        switch (data.request_type) {
            case 'Driver':
            case 'Bodyguard':
                requireField('officer_name', 'officer_name is required for Driver/Bodyguard requests');
                requireField('rank', 'rank is required for Driver/Bodyguard requests');
                requireField('reporting_date', 'reporting_date is required for Driver/Bodyguard requests');
                break;

            case 'Firearm':
                // firearm_type is optional initially; only required if officer_assigned is provided
                if (data.officer_assigned && data.officer_assigned.trim() !== '') {
                    requireField('firearm_type', 'firearm_type is required when an officer is assigned to a Firearm request');
                }
                break;

            case 'Force Number':
                requireField('force_number', 'force_number is required for Force Number requests');
                break;

            case 'Current Station':
            case 'Residence Security':
            case 'Sentry':
                requireField('location', 'location is required for this request type');
                break;
        }
    }),
});

export const updateGeneralRequestSchema = z.object({
    body: z.object({
        judge_name: z.string().min(1).max(100).optional(),
        request: z.string().min(1).optional(),
        request_type: requestTypeEnum.optional(),
        category: generalRequestCategoryEnum.optional(),
        date_received: dateStringSchema.optional(),
        officer_assigned: z.string().optional(),
        status: statusEnum.optional(),
        remarks: z.string().optional(),
        remark_type: remarkTypeEnum.optional(),

        request_date: dateStringSchema.optional(),
        location: z.string().optional(),
        firearm_type: z.string().optional(),
        force_number: z.string().optional(),
        officer_name: z.string().optional(),
        assigned_to: z.string().optional(),
        priority: z.string().optional(),
        notes: z.string().optional(),

        rank: z.string().optional(),
        reporting_date: dateStringSchema.optional(),

        email: z.string().email('Valid email is required for notifications').optional(),
        send_email: z.boolean().optional(),
    }).strict()
    .superRefine((data, ctx) => {
        // For update, we enforce the same rule if both request_type and officer_assigned are provided.
        // If request_type is 'Firearm' and officer_assigned is set, then firearm_type must be set.
        if (data.request_type === 'Firearm' && data.officer_assigned && data.officer_assigned.trim() !== '') {
            if (!data.firearm_type || data.firearm_type.trim() === '') {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: ['firearm_type'],
                    message: 'firearm_type is required when updating a Firearm request with an assigned officer',
                });
            }
        }
    }),
});

// ============================================================
// Legacy Security & Personnel Requests (Deprecated)
// ============================================================

/**
 * @deprecated Use createGeneralRequestSchema instead
 * Schema for creating a security/personnel request
 */
export const createSecurityRequestSchema = z.object({
    body: z.object({
        judge_name: z.string().min(1).max(100),
        request_type: requestTypeEnum,
        request_date: dateStringSchema.optional(),
        officer_assigned: z.string().optional(),
        status: statusEnum.optional(),
        remarks: z.string().optional(),
        remark_type: remarkTypeEnum.optional(),
        location: z.string().optional(),
        firearm_type: z.string().optional(),
        force_number: z.string().optional(),
        email: z.string().email('Valid email is required for notifications').optional(),
        send_email: z.boolean().default(false),
    }).strict(),
});

/**
 * @deprecated Use updateGeneralRequestSchema instead
 * Schema for updating a security/personnel request
 */
export const updateSecurityRequestSchema = z.object({
    body: z.object({
        request_type: requestTypeEnum.optional(),
        request_date: dateStringSchema.optional(),
        officer_assigned: z.string().optional(),
        status: statusEnum.optional(),
        remarks: z.string().optional(),
        remark_type: remarkTypeEnum.optional(),
        location: z.string().optional(),
        firearm_type: z.string().optional(),
        force_number: z.string().optional(),
    }).strict(),
});

// ============================================================
// Legacy General Request (Deprecated)
// ============================================================

/**
 * @deprecated Use createGeneralRequestSchema with request_type instead
 */
export const createLegacyGeneralRequestSchema = z.object({
    body: z.object({
        judge_name: z.string().min(1).max(100),
        request: z.string().min(1),
        date_received: dateStringSchema.optional(),
        officer_assigned: z.string().optional(),
        status: statusEnum.optional(),
        remarks: z.string().optional(),
        email: z.string().email('Valid email is required for notifications').optional(),
        send_email: z.boolean().default(false),
    }).strict(),
});

// ============================================================
// Judge Utilities
// ============================================================

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

// ============================================================
// Club Membership
// ============================================================

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

// ============================================================
// Circuits
// ============================================================

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

// ============================================================
// Other Payments
// ============================================================

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

// ============================================================
// Special Benches
// ============================================================

export const createSpecialBenchSchema = z.object({
    body: z.object({
        name: z.string().min(1).max(200),
        case_reference: z.string().optional(),
        start_date: dateStringSchema,
        end_date: dateStringSchema,
        dsa_details: z.array(dsaDetailSchema).optional(),
    }).strict(),
});

export const updateBenchSchema = z.object({
    body: z.object({
        name: z.string().min(1).max(200).optional(),
        case_reference: z.string().optional(),
        start_date: dateStringSchema.optional(),
        end_date: dateStringSchema.optional(),
        status: statusEnum.optional(),
        dsa_details: z.array(dsaDetailSchema).optional(),
    }).strict(),
});

// ============================================================
// Part-Heards
// ============================================================

export const createPartHeardSchema = z.object({
    body: z.object({
        case_reference: z.string().min(1).max(200),
        approved_by: z.string().optional(),
        start_date: dateStringSchema,
        end_date: dateStringSchema,
        dsa_details: z.array(dsaDetailSchema).optional(),
    }).strict(),
});

export const updatePartHeardSchema = z.object({
    body: z.object({
        case_reference: z.string().min(1).max(200).optional(),
        approved_by: z.string().optional(),
        start_date: dateStringSchema.optional(),
        end_date: dateStringSchema.optional(),
        status: statusEnum.optional(),
        dsa_details: z.array(dsaDetailSchema).optional(),
    }).strict(),
});

// ============================================================
// Service Weeks
// ============================================================

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

// ============================================================
// Medical Expense Claims
// ============================================================

export const createMedicalClaimSchema = z.object({
    body: z.object({
        officer_name: z.string().min(1).max(100),
        claim_amount: z.number().min(0),
        date_forwarded_dhr: dateStringSchema.optional(),
        status: statusEnum.optional(),
        remarks: z.string().optional(),
    }).strict(),
});

// ============================================================
// Visa Support
// ============================================================

export const createVisaRequestSchema = z.object({
    body: z.object({
        judge_name: z.string().min(1).max(100),
        request_date: dateStringSchema.optional(),
        destination_country: z.string().min(1).max(100),
        date_of_travel: dateStringSchema.optional(),
        date_of_return: dateStringSchema.optional(),
        visa_type: visaTypeEnum,
        purpose_of_travel: z.string().optional(),
        remarks: z.string().optional(),
        notes: z.string().optional(),
    }).strict(),
});

// ============================================================
// Visa Document Tracking
// ============================================================

export const markDocumentViewedSchema = z.object({
    params: z.object({
        id: z.string().uuid('Document ID must be a valid UUID'),
    }),
});

export const documentViewStatusSchema = z.object({
    params: z.object({
        id: z.string().uuid('Document ID must be a valid UUID'),
    }),
    query: z.object({
        include_viewers: z.string().optional().transform(val => val === 'true'),
    }).optional(),
});

// ============================================================
// Protocol Support
// ============================================================

export const createProtocolEventSchema = z.object({
    body: z.object({
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

// ============================================================
// Report Filters
// ============================================================

const reportModuleEnum = z.enum(['circuit', 'special_bench', 'part_heard', 'service_week', 'other_payment']);

export const dsaReportFiltersSchema = z.object({
    query: z.object({
        modules: z.string().optional(), // comma-separated, split in controller
        judge_name: z.string().optional(),
        payment_status: paymentStatusEnum.optional(),
        travel_start: dateStringSchema.optional(),
        travel_end: dateStringSchema.optional(),
        limit: z.string().regex(/^\d+$/).optional().transform(Number),
        offset: z.string().regex(/^\d+$/).optional().transform(Number),
    }).strict(),
});

// ============================================================
// Help Desk Filters
// ============================================================

export const helpDeskFiltersSchema = z.object({
    query: z.object({
        search: z.string().optional(),
        status: statusEnum.optional(),
        judge_name: z.string().optional(),
        request_type: requestTypeEnum.optional(),
        remark_type: remarkTypeEnum.optional(),
        category: generalRequestCategoryEnum.optional(),
        start_date: dateStringSchema.optional(),
        end_date: dateStringSchema.optional(),
        limit: z.string().regex(/^\d+$/).optional().transform(Number),
        offset: z.string().regex(/^\d+$/).optional().transform(Number),
    }).strict(),
});

// ============================================================
// ID Schemas
// ============================================================

export const idSchema = z.object({
    params: z.object({
        id: z.string().uuid('ID must be a valid UUID'),
    }),
});

// ============================================================
// Type Exports
// ============================================================

// General Request Types
export type CreateGeneralRequestInput = z.infer<typeof createGeneralRequestSchema>['body'];
export type UpdateGeneralRequestInput = z.infer<typeof updateGeneralRequestSchema>['body'];

// Legacy Security Request Types (Deprecated)
export type CreateSecurityRequestInput = z.infer<typeof createSecurityRequestSchema>['body'];
export type UpdateSecurityRequestInput = z.infer<typeof updateSecurityRequestSchema>['body'];

// Legacy General Request Type (Deprecated)
export type CreateLegacyGeneralRequestInput = z.infer<typeof createLegacyGeneralRequestSchema>['body'];

// Utility Types
export type CreateUtilityInput = z.infer<typeof createUtilitySchema>['body'];
export type AddUtilityItemInput = z.infer<typeof addUtilityItemSchema>['body'];
export type UpdateUtilityItemInput = z.infer<typeof updateUtilityItemSchema>['body'];
export type UtilityFilters = z.infer<typeof utilityFiltersSchema>['query'];

// Club Membership Types
export type CreateClubMembershipInput = z.infer<typeof createClubMembershipSchema>['body'];

// Circuit Types
export type CreateCircuitInput = z.infer<typeof createCircuitSchema>['body'];
export type UpdateCircuitDSADetailsInput = z.infer<typeof updateCircuitDSASchema>['body'];

// Other Payment Types
export type CreateOtherPaymentInput = z.infer<typeof createOtherPaymentSchema>['body'];
export type UpdateOtherPaymentDSADetailsInput = z.infer<typeof updateOtherPaymentDSASchema>['body'];

// Special Bench Types
export type CreateSpecialBenchInput = z.infer<typeof createSpecialBenchSchema>['body'];
export type UpdateBenchInput = z.infer<typeof updateBenchSchema>['body'];

// Part-Heard Types
export type CreatePartHeardInput = z.infer<typeof createPartHeardSchema>['body'];
export type UpdatePartHeardInput = z.infer<typeof updatePartHeardSchema>['body'];

// Service Week Types
export type CreateServiceWeekInput = z.infer<typeof createServiceWeekSchema>['body'];

// Medical Claim Types
export type CreateMedicalClaimInput = z.infer<typeof createMedicalClaimSchema>['body'];

// Visa Request Types
export type CreateVisaRequestInput = z.infer<typeof createVisaRequestSchema>['body'];
export type MarkDocumentViewedInput = z.infer<typeof markDocumentViewedSchema>['params'];
export type DocumentViewStatusInput = z.infer<typeof documentViewStatusSchema>['params'];

// Protocol Event Types
export type CreateProtocolEventInput = z.infer<typeof createProtocolEventSchema>['body'];

// Filter Types
export type HelpDeskFilters = z.infer<typeof helpDeskFiltersSchema>['query'];
export type DSAReportFilters = z.infer<typeof dsaReportFiltersSchema>['query'];

// Export enums for use in routes
export { 
  requestTypeEnum,
  remarkTypeEnum,
  generalRequestCategoryEnum,
  reportModuleEnum,
  statusEnum,
  utilityTypeEnum,
  visaTypeEnum,
  paymentStatusEnum,
  utilityStatusEnum,
  dateStringSchema,
  dsaDetailSchema,
};