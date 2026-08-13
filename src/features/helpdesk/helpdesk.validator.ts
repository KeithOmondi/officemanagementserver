// src/features/helpdesk/helpdesk.schema.ts

import { z } from 'zod';

// ============================================================
// Core Enums & Shared Schemas
// ============================================================

const statusEnum = z.enum(['Pending', 'Signed', 'Rejected', 'In Progress', 'Completed', 'Active', 'Resolved', 'Cancelled']);
const utilityTypeEnum = z.enum(['Electricity', 'Water', 'Internet', 'Fuel', 'Other']);
const visaTypeEnum = z.enum(['Official', 'Conference', 'Personal', 'Other']);
const paymentStatusEnum = z.enum(['Pending', 'In Process', 'Paid', 'Payment NA']);

// Enums for general requests - request_type is now free text, but we keep enum for other uses
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
// Document Entity Types (for helpdesk documents)
// ============================================================

/**
 * Zod enum for all possible document entity types.
 * Used for validating entity_type in document uploads, linking, etc.
 */
export const documentEntityEnum = z.enum([
  'circuit',
  'bench',
  'partHeard',
  'serviceWeek',
  'otherPayment',
  'ticket',
  'medicalClaim',
  'generalRequest',
  'securityRequest',      // Deprecated, kept for backward compatibility
  'visa',
  'protocol',
  'club',
  'utility_memo',         // Single judge utility memo
  'consolidated_utility_memo',   // Consolidated memo covering all utilities
  'consolidated_fuel_memo',      // Consolidated memo covering fuel only
  'aide',
  'sentry',
]);

/**
 * Consolidated memo type enum
 */
export const consolidatedMemoTypeEnum = z.enum(['all', 'fuel']);

// ─── Helper Functions for Consolidated Memos ──────────────────────────────

/**
 * Generates a stable, human-readable entity ID for a consolidated memo.
 * Format: "cons-{type}-{YYYY-MM}" e.g., "cons-all-2026-07"
 *
 * @param type - 'all' for all utilities, 'fuel' for fuel-only
 * @param date - optional Date object (defaults to now)
 * @returns entity ID string
 */
export function getConsolidatedMemoEntityId(
  type: 'all' | 'fuel',
  date: Date = new Date()
): string {
  const month = date.toISOString().slice(0, 7); // YYYY-MM
  return `cons-${type}-${month}`;
}

/**
 * Returns the appropriate DocumentEntityType for a consolidated memo.
 *
 * @param type - 'all' or 'fuel'
 * @returns the entity type string
 */
export function getConsolidatedMemoEntityType(
  type: 'all' | 'fuel'
): z.infer<typeof documentEntityEnum> {
  return type === 'fuel' ? 'consolidated_fuel_memo' : 'consolidated_utility_memo';
}

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
// Simplified to only: Requester name, status, type (free text), remarks, details, request date
// ============================================================

/**
 * Schema for creating a general request
 * Supports: Driver, Bodyguard, Firearm, Current Station, Force Number, 
 * Residence Security, Sentry, and other general requests
 * 
 * Only fields: judge_name (requester), request (details), request_type (free text), 
 * status, remarks, request_date, officer_assigned
 * 
 * email is required whenever send_email is true
 */
export const createGeneralRequestSchema = z.object({
    body: z.object({
        judge_name: z.string().min(1).max(100),        // Requester name
        request: z.string().min(1, 'Request details are required'), // Details of request
        request_type: z.string().min(1, 'Request type is required'), // Type of request - FREE TEXT
        category: generalRequestCategoryEnum.optional(),
        status: statusEnum.optional(),
        remarks: z.string().optional(),                // Marks/remarks
        request_date: dateStringSchema.optional(),     // Request date
        date_received: dateStringSchema.optional(),
        officer_assigned: z.string().optional(),
        remark_type: remarkTypeEnum.optional(),

        email: z.string().email('Valid email is required for notifications').optional(),
        send_email: z.boolean().default(false),
    }).strict()
    .superRefine((data, ctx) => {
        // send_email implies email must be present
        if (data.send_email && (!data.email || data.email.trim() === '')) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['email'],
                message: 'email is required when send_email is true',
            });
        }
    }),
});

export const updateGeneralRequestSchema = z.object({
    body: z.object({
        judge_name: z.string().min(1).max(100).optional(),  // Requester name
        request: z.string().min(1).optional(),              // Details of request
        request_type: z.string().min(1).optional(),         // Type of request - FREE TEXT
        category: generalRequestCategoryEnum.optional(),
        status: statusEnum.optional(),
        remarks: z.string().optional(),                     // Marks/remarks
        request_date: dateStringSchema.optional(),          // Request date
        date_received: dateStringSchema.optional(),
        officer_assigned: z.string().optional(),
        remark_type: remarkTypeEnum.optional(),

        email: z.string().email('Valid email is required for notifications').optional(),
        send_email: z.boolean().optional(),
    }).strict()
    .superRefine((data, ctx) => {
        // send_email implies email must be present
        if (data.send_email && (!data.email || data.email.trim() === '')) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['email'],
                message: 'email is required when send_email is true',
            });
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
// Judge Utilities - UPDATED with REQUIRED pj_number
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

/**
 * Schema for creating a new utility record - PJ number is REQUIRED
 * Used when adding a new judge's utility record to the system
 */
export const createUtilitySchema = z.object({
    body: z.object({
        pj_number: z.string().min(1, 'PJ number is required to create a utility record'), // ← REQUIRED
        judge_name: z.string().min(1).max(100),
        items: z.array(utilityItemSchema).min(1, 'At least one utility item is required'),
    }).strict(),
});

/**
 * Schema for adding a utility item to an existing utility record - PJ number is REQUIRED
 * Used when adding a new utility item (Electricity, Water, etc.) for an existing judge
 */
export const addUtilityItemSchema = z.object({
    body: z.object({
        pj_number: z.string().min(1, 'PJ number is required to add a utility item'), // ← REQUIRED
        utility_type: utilityTypeEnum,
        requisition_number: z.string().optional(),
        amount: z.number().min(0),
        period: z.string().min(1).max(50),
        description: z.string().optional(),
        date_received: dateStringSchema.optional(),
        date_forwarded_dass: dateStringSchema.optional(),
        date_paid: dateStringSchema.optional(),
        status: utilityStatusEnum.optional(),
    }).strict(),
});

/**
 * Schema for updating an existing utility item - uses item ID to identify the specific item
 * PJ number is NOT required here as we use the item ID directly
 */
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

/**
 * Schema for updating the main utility record (judge name or PJ number)
 * Both fields are optional since you might only update one
 */
export const updateUtilitySchema = z.object({
    body: z.object({
        pj_number: z.string().optional(), // Optional - only provide if changing PJ number
        judge_name: z.string().min(1).max(100).optional(), // Optional - only provide if changing judge name
    }).strict()
    .refine(
        (data) => data.pj_number !== undefined || data.judge_name !== undefined,
        {
            message: 'At least one field (pj_number or judge_name) must be provided for update',
            path: ['body'],
        }
    ),
});

/**
 * Schema for deleting a utility item - uses item ID directly
 * No PJ number needed as we use the item ID
 */
export const deleteUtilityItemSchema = z.object({
    params: z.object({
        itemId: z.string().uuid('Item ID must be a valid UUID'),
    }),
});

/**
 * Schema for deleting an entire utility record - uses the utility record ID
 * No PJ number needed as we use the record ID
 */
export const deleteUtilitySchema = z.object({
    params: z.object({
        id: z.string().uuid('Utility ID must be a valid UUID'),
    }),
});

export const utilityFiltersSchema = z.object({
    query: z.object({
        search: z.string().optional(),
        pj_number: z.string().optional(),
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
// Circuits - UPDATED with email support
// ============================================================

export const createCircuitSchema = z.object({
    body: z.object({
        name: z.string().min(1).max(100),
        location: z.string().optional(),
        start_date: dateStringSchema,
        end_date: dateStringSchema,
        dsa_details: z.array(dsaDetailSchema).optional(),
        email: z.string().email('Valid email is required for notifications').optional(),
        send_email: z.boolean().default(false),
    }).strict(),
});

export const updateCircuitDSASchema = z.object({
    body: z.object({
        dsa_details: z.array(dsaDetailSchema).min(1, 'At least one DSA detail is required'),
    }).strict(),
});

// ─── Full update for circuits ──────────────────────────────────────────────
export const updateCircuitSchema = z.object({
    body: z.object({
        name: z.string().min(1).max(100).optional(),
        location: z.string().optional(),
        start_date: dateStringSchema.optional(),
        end_date: dateStringSchema.optional(),
        status: statusEnum.optional(),
        dsa_details: z.array(dsaDetailSchema).optional(),
        email: z.string().email('Valid email is required for notifications').optional(),
        send_email: z.boolean().default(false),
    }).strict(),
});

// ============================================================
// Other Payments - UPDATED with email support
// ============================================================

export const createOtherPaymentSchema = z.object({
    body: z.object({
        name: z.string().min(1).max(100),
        description: z.string().optional(),
        start_date: dateStringSchema,
        end_date: dateStringSchema,
        dsa_details: z.array(dsaDetailSchema).optional(),
        email: z.string().email('Valid email is required for notifications').optional(),
        send_email: z.boolean().default(false),
    }).strict(),
});

export const updateOtherPaymentDSASchema = z.object({
    body: z.object({
        dsa_details: z.array(dsaDetailSchema).min(1, 'At least one DSA detail is required'),
    }).strict(),
});

// ─── Full update for other payments ────────────────────────────────────────
export const updateOtherPaymentSchema = z.object({
    body: z.object({
        name: z.string().min(1).max(100).optional(),
        description: z.string().optional(),
        start_date: dateStringSchema.optional(),
        end_date: dateStringSchema.optional(),
        status: statusEnum.optional(),
        dsa_details: z.array(dsaDetailSchema).optional(),
        email: z.string().email('Valid email is required for notifications').optional(),
        send_email: z.boolean().default(false),
    }).strict(),
});

// ============================================================
// Special Benches - UPDATED with email support
// ============================================================

export const createSpecialBenchSchema = z.object({
    body: z.object({
        name: z.string().min(1).max(200),
        case_reference: z.string().optional(),
        start_date: dateStringSchema,
        end_date: dateStringSchema,
        dsa_details: z.array(dsaDetailSchema).optional(),
        email: z.string().email('Valid email is required for notifications').optional(),
        send_email: z.boolean().default(false),
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
        email: z.string().email('Valid email is required for notifications').optional(),
        send_email: z.boolean().default(false),
    }).strict(),
});

// ============================================================
// Part-Heards - UPDATED with email support
// ============================================================

export const createPartHeardSchema = z.object({
    body: z.object({
        case_reference: z.string().min(1).max(200),
        approved_by: z.string().optional(),
        start_date: dateStringSchema,
        end_date: dateStringSchema,
        dsa_details: z.array(dsaDetailSchema).optional(),
        email: z.string().email('Valid email is required for notifications').optional(),
        send_email: z.boolean().default(false),
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
        email: z.string().email('Valid email is required for notifications').optional(),
        send_email: z.boolean().default(false),
    }).strict(),
});

// ============================================================
// Service Weeks - UPDATED with email support
// ============================================================

export const createServiceWeekSchema = z.object({
    body: z.object({
        name: z.string().min(1).max(200),
        week_number: z.string().min(1).max(20),
        year: z.string().min(4).max(4),
        start_date: dateStringSchema,
        end_date: dateStringSchema,
        dsa_details: z.array(dsaDetailSchema).optional(),
        email: z.string().email('Valid email is required for notifications').optional(),
        send_email: z.boolean().default(false),
    }).strict(),
});

// ─── Full update for service weeks ─────────────────────────────────────────
export const updateServiceWeekSchema = z.object({
    body: z.object({
        name: z.string().min(1).max(200).optional(),
        week_number: z.string().min(1).max(20).optional(),
        year: z.string().min(4).max(4).optional(),
        start_date: dateStringSchema.optional(),
        end_date: dateStringSchema.optional(),
        status: statusEnum.optional(),
        dsa_details: z.array(dsaDetailSchema).optional(),
        email: z.string().email('Valid email is required for notifications').optional(),
        send_email: z.boolean().default(false),
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
// Protocol Support - UPDATED with venue/location
// ============================================================

export const createProtocolEventSchema = z.object({
    body: z.object({
        activity: z.string().min(1).max(200),
        venue: z.string().max(255).optional(),     // NEW: Venue/Location of the protocol event
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
        request_type: z.string().optional(), // Free text filter
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
// Email Notification Schemas
// ============================================================

/**
 * Schema for General Request email options
 */
export const generalRequestEmailSchema = z.object({
    to: z.string().email('Valid recipient email is required'),
    ticketNumber: z.string().min(1),
    judgeName: z.string().min(1),
    request: z.string().min(1),
    requestType: z.string().optional(),
    status: z.string().min(1),
    remarks: z.string().optional(),
    requestDate: z.string().optional(),
});

/**
 * Schema for Helpdesk Document Approved email
 */
export const helpdeskDocumentEmailSchema = z.object({
    to: z.string().email('Valid recipient email is required'),
    requesterName: z.string().min(1),
    ref: z.string().min(1),
    subject: z.string().min(1),
    entityType: z.string().min(1),
    approvedBy: z.string().min(1),
    approvedAt: z.date(),
    comments: z.string().optional(),
    documentUrl: z.string().url().optional(),
});

/**
 * Schema for Utility Memo email
 */
export const utilityMemoEmailSchema = z.object({
    to: z.string().email('Valid recipient email is required'),
    judgeName: z.string().min(1),
    ref: z.string().min(1),
    utilityType: z.string().min(1),
    amount: z.number().min(0),
    period: z.string().min(1),
    status: z.string().min(1),
    submittedBy: z.string().min(1),
    submittedAt: z.date(),
});

/**
 * Schema for DSA Memo email
 */
export const dsaMemoEmailSchema = z.object({
    to: z.string().email('Valid recipient email is required'),
    judgeName: z.string().min(1),
    ref: z.string().min(1),
    moduleType: z.enum(['Circuit', 'Bench', 'Part-Heard', 'Service Week', 'Other Payment']),
    activityName: z.string().min(1),
    startDate: z.string().min(1),
    endDate: z.string().min(1),
    totalDSA: z.number().min(0),
    memberCount: z.number().int().min(1),
    status: z.string().min(1),
    submittedBy: z.string().min(1),
    submittedAt: z.date(),
    memoUrl: z.string().url().optional(),
});

/**
 * Schema for Medical Claim email
 */
export const medicalClaimEmailSchema = z.object({
    to: z.string().email('Valid recipient email is required'),
    officerName: z.string().min(1),
    ref: z.string().min(1),
    claimAmount: z.number().min(0),
    dateForwarded: z.string().min(1),
    status: z.string().min(1),
    remarks: z.string().optional(),
    submittedBy: z.string().min(1),
    submittedAt: z.date(),
});

/**
 * Schema for Visa Request email
 */
export const visaRequestEmailSchema = z.object({
    to: z.string().email('Valid recipient email is required'),
    judgeName: z.string().min(1),
    ref: z.string().min(1),
    destinationCountry: z.string().min(1),
    dateOfTravel: z.string().min(1),
    dateOfReturn: z.string().min(1),
    visaType: z.string().min(1),
    purposeOfTravel: z.string().optional(),
    status: z.string().min(1),
    remarks: z.string().optional(),
    submittedBy: z.string().min(1),
    submittedAt: z.date(),
});

/**
 * Schema for Protocol Event email
 */
export const protocolEventEmailSchema = z.object({
    to: z.string().email('Valid recipient email is required'),
    activity: z.string().min(1),
    ref: z.string().min(1),
    venue: z.string().optional(),
    periodFrom: z.string().min(1),
    periodTo: z.string().min(1),
    officersAssigned: z.string().optional(),
    dsaRequired: z.boolean(),
    totalDSA: z.number().min(0),
    memberCount: z.number().int().min(0),
    status: z.string().min(1),
    remarks: z.string().optional(),
    submittedBy: z.string().min(1),
    submittedAt: z.date(),
});

/**
 * Schema for Club Membership email
 */
export const clubMembershipEmailSchema = z.object({
    to: z.string().email('Valid recipient email is required'),
    judgeName: z.string().min(1),
    ref: z.string().min(1),
    clubName: z.string().min(1),
    entryFee: z.number().min(0),
    annualFee: z.number().min(0),
    court: z.string().optional(),
    status: z.string().min(1),
    remarks: z.string().optional(),
    submittedBy: z.string().min(1),
    submittedAt: z.date(),
});

/**
 * Schema for Document Notification Data (for emailTemplates)
 */
export const documentNotificationDataSchema = z.object({
    documentTitle: z.string().min(1),
    documentId: z.string().min(1),
    referenceNo: z.string().nullable().optional(),
    markedBy: z.string().min(1),
    markedByDepartment: z.string().min(1),
    assignedTo: z.string().min(1),
    instructions: z.string().nullable().optional(),
    priority: z.enum(['low', 'normal', 'urgent']).optional(),
    actionType: z.enum(['marked_to_department', 'assigned_to_user', 'sent_to_super_admin']),
    createdAt: z.date(),
    documentType: z.string().min(1),
    departmentName: z.string().min(1),
    superAdminName: z.string().optional(),
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
export type UpdateUtilityInput = z.infer<typeof updateUtilitySchema>['body'];
export type DeleteUtilityItemInput = z.infer<typeof deleteUtilityItemSchema>['params'];
export type DeleteUtilityInput = z.infer<typeof deleteUtilitySchema>['params'];
export type UtilityFilters = z.infer<typeof utilityFiltersSchema>['query'];

// Club Membership Types
export type CreateClubMembershipInput = z.infer<typeof createClubMembershipSchema>['body'];

// Circuit Types
export type CreateCircuitInput = z.infer<typeof createCircuitSchema>['body'];
export type UpdateCircuitDSADetailsInput = z.infer<typeof updateCircuitDSASchema>['body'];
export type UpdateCircuitInput = z.infer<typeof updateCircuitSchema>['body'];

// Other Payment Types
export type CreateOtherPaymentInput = z.infer<typeof createOtherPaymentSchema>['body'];
export type UpdateOtherPaymentDSADetailsInput = z.infer<typeof updateOtherPaymentDSASchema>['body'];
export type UpdateOtherPaymentInput = z.infer<typeof updateOtherPaymentSchema>['body'];

// Special Bench Types
export type CreateSpecialBenchInput = z.infer<typeof createSpecialBenchSchema>['body'];
export type UpdateBenchInput = z.infer<typeof updateBenchSchema>['body'];

// Part-Heard Types
export type CreatePartHeardInput = z.infer<typeof createPartHeardSchema>['body'];
export type UpdatePartHeardInput = z.infer<typeof updatePartHeardSchema>['body'];

// Service Week Types
export type CreateServiceWeekInput = z.infer<typeof createServiceWeekSchema>['body'];
export type UpdateServiceWeekInput = z.infer<typeof updateServiceWeekSchema>['body'];

// Medical Claim Types
export type CreateMedicalClaimInput = z.infer<typeof createMedicalClaimSchema>['body'];

// Visa Request Types
export type CreateVisaRequestInput = z.infer<typeof createVisaRequestSchema>['body'];
export type MarkDocumentViewedInput = z.infer<typeof markDocumentViewedSchema>['params'];
export type DocumentViewStatusInput = z.infer<typeof documentViewStatusSchema>['params'];

// Protocol Event Types - UPDATED
export type CreateProtocolEventInput = z.infer<typeof createProtocolEventSchema>['body'];

// Filter Types
export type HelpDeskFilters = z.infer<typeof helpDeskFiltersSchema>['query'];
export type DSAReportFilters = z.infer<typeof dsaReportFiltersSchema>['query'];

// Document Entity Types
export type DocumentEntityType = z.infer<typeof documentEntityEnum>;
export type ConsolidatedMemoType = z.infer<typeof consolidatedMemoTypeEnum>;

// Email Notification Types
export type GeneralRequestEmailOptions = z.infer<typeof generalRequestEmailSchema>;
export type HelpdeskDocumentEmailOptions = z.infer<typeof helpdeskDocumentEmailSchema>;
export type UtilityMemoEmailOptions = z.infer<typeof utilityMemoEmailSchema>;
export type DSAMemoEmailOptions = z.infer<typeof dsaMemoEmailSchema>;
export type MedicalClaimEmailOptions = z.infer<typeof medicalClaimEmailSchema>;
export type VisaRequestEmailOptions = z.infer<typeof visaRequestEmailSchema>;
export type ProtocolEventEmailOptions = z.infer<typeof protocolEventEmailSchema>;
export type ClubMembershipEmailOptions = z.infer<typeof clubMembershipEmailSchema>;
export type DocumentNotificationData = z.infer<typeof documentNotificationDataSchema>;

// Export enums for use in routes
// Note: documentEntityEnum and consolidatedMemoTypeEnum are NOT re-listed here —
// they're already `export const` at their declaration site above, and naming
// them again here is a duplicate export ("Cannot redeclare exported variable").
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