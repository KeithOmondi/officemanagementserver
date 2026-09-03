// src/features/prdocuments/pr.documents.types.ts

export type FinanceDocumentFormat = 'pdf' | 'docx' | 'xlsx';

export type FinanceEntityType = 
    | 'invoice'
    | 'purchase_order'
    | 'expense_report'
    | 'budget'
    | 'payment_request'
    | 'reimbursement';

export type FinanceDocumentStatus = 
    | 'draft'
    | 'pending_finance_review'
    | 'ready_to_approve'
    | 'approved'
    | 'rejected'
    | 'returned';

export interface FinanceDocument {
    id: string;
    ref: string;
    subject: string;
    entity_type: FinanceEntityType;
    entity_id: string | null;
    format: FinanceDocumentFormat;
    file_url: string;
    public_id: string;
    file_size: number | null;
    uploaded_by: string | null;
    uploaded_by_name?: string;
    status: FinanceDocumentStatus;
    // ... add other fields as needed
}