// src/features/helpdesk/helpdesk.documents.types.ts

export type DocumentFormat = 'pdf' | 'docx' | 'xlsx';

export type DocumentEntityType =
    | 'circuit'
    | 'bench'
    | 'partHeard'
    | 'serviceWeek'
    | 'otherPayment';

export interface HelpdeskDocument {
    id: string;
    ref: string;
    subject: string;
    entity_type: DocumentEntityType;
    entity_id: string | null;
    format: DocumentFormat;
    file_url: string;
    public_id: string;
    file_size: number | null;
    uploaded_by: string | null;
    is_active: boolean;
    created_at: string;
    updated_at: string;
}

export interface CreateHelpdeskDocumentInput {
    ref: string;
    subject: string;
    entity_type: DocumentEntityType;
    entity_id?: string;
    format: DocumentFormat;
}

export interface HelpdeskDocumentFilters {
    entity_type?: DocumentEntityType;
    entity_id?: string;
    format?: DocumentFormat;
    search?: string;
    limit?: number;
    offset?: number;
}