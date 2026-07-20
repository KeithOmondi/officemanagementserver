// ─── Category Interface ──────────────────────────────────────────────────────

export interface Category {
    id: string;
    name: string;
    parent_id: string | null;
    case_code: string | null;
    colour: string | null;
    description: string | null;
    created_at: string;
    updated_at: string;
}

// ─── Statuses ────────────────────────────────────────────────────────────────

export type StockStatus = 'in_stock' | 'low_stock' | 'out_of_stock';

// Store request lifecycle
export type StoreRequestStatus = 'Pending' | 'Approved' | 'Issued' | 'Received' | 'Rejected';

// Procurement request status – now includes 'Submitted' for memo workflow
export type ProcurementRequestStatus = 'Pending' | 'Submitted' | 'Approved' | 'Rejected';

export type Urgency = 'Normal' | 'Urgent' | 'Critical';

// ─── Inventory Item ──────────────────────────────────────────────────────────

export interface InventoryItem {
    id: string;
    name: string;
    subtitle: string | null;
    category_id: string;                // references categories table
    category?: Category;               // optional populated relation
    qty_available: number;
    unit: string;
    location: string | null;
    status: StockStatus;               // computed, not stored
    min_stock_threshold: number;
    created_by: string | null;
    is_active: boolean;
    created_at: string;
    updated_at: string;
}

// ─── Store Request ──────────────────────────────────────────────────────────

export interface StoreRequest {
    id: string;
    item_name: string;
    item_id: string | null;
    quantity: number;
    unit: string;
    reason: string;
    requested_by: string;
    requested_by_name?: string;
    status: StoreRequestStatus;
    approved_by: string | null;
    approved_by_name?: string;
    approved_at: string | null;
    rejection_reason: string | null;
    issued_by: string | null;
    issued_by_name?: string;
    issued_at: string | null;
    received_by: string | null;
    received_by_name?: string;
    received_at: string | null;
    created_at: string;
    updated_at: string;
}

// ─── Procurement Request ────────────────────────────────────────────────────

export interface ProcurementRequest {
    id: string;
    item_name: string;
    category_id: string;               // UUID
    category?: Category;
    quantity: number;
    unit: string;
    estimated_unit_cost: number | null;
    justification: string;
    urgency: Urgency;
    requested_by: string;
    requested_by_name?: string;
    status: ProcurementRequestStatus;  // now includes 'Submitted'
    approved_by: string | null;
    approved_by_name?: string;
    approved_at: string | null;
    rejection_reason: string | null;
    is_restock: boolean;
    inventory_item_id: string | null;
    // Memo fields
    memo_url: string | null;           // Cloudinary URL of the memo PDF
    memo_uploaded_at: string | null;   // Timestamp when memo was uploaded
    created_at: string;
    updated_at: string;
}

// ─── Approved Procurement Item ──────────────────────────────────────────────

export interface ApprovedProcurementItem {
    id: string;
    procurement_request_id: string;
    item_name: string;
    category_id: string;
    category?: Category;
    quantity: number;
    unit: string;
    unit_cost_kes: number;
    total_cost_kes: number;
    requested_by: string;
    requested_by_name?: string;
    approved_by: string;
    approved_by_name?: string;
    approved_at: string;
    is_purchased: boolean;
    purchase_date: string | null;
    purchase_reference: string | null;
    created_at: string;
    updated_at: string;
}

// ─── Activity Log ────────────────────────────────────────────────────────────

export interface ActivityLogEntry {
    id: string;
    icon: string | null;
    title: string;
    description: string | null;
    user_id: string | null;
    user_name?: string;
    entity_type: string | null;
    entity_id: string | null;
    metadata: Record<string, unknown> | null;
    created_at: string;
}

// ─── Statistics ──────────────────────────────────────────────────────────────

export interface InventoryStats {
    total_items: number;
    in_stock: number;
    low_stock: number;
    out_of_stock: number;
    pending_store_requests: number;
    pending_procurement_requests: number;
}

// ─── Input Types (updated to match validator) ──────────────────────────────

export interface CreateInventoryItemInput {
    name: string;
    subtitle?: string;
    category_id: string;
    qty_available?: number;
    unit: string;
    location?: string;
    min_stock_threshold?: number;
}

export interface UpdateInventoryItemInput {
    name?: string;
    subtitle?: string | null;
    category_id?: string;
    qty_available?: number;
    unit?: string;
    location?: string | null;
    min_stock_threshold?: number;
    is_active?: boolean;
}

export interface CreateStoreRequestInput {
    item_name: string;
    quantity: number;
    unit?: string;
    reason: string;
}

export interface UpdateStoreRequestInput {
    status?: 'Approved' | 'Rejected';
    rejection_reason?: string;
}

export interface IssueStoreRequestInput {
    // no additional fields
}

export interface ReceiveStoreRequestInput {
    // no additional fields
}

export interface CreateProcurementRequestInput {
    item_name: string;
    category_id: string;
    quantity: number;
    unit: string;
    estimated_unit_cost?: number;
    justification: string;
    urgency?: Urgency;
    is_restock?: boolean;
    inventory_item_id?: string;
}

export interface UpdateProcurementRequestInput {
    status?: ProcurementRequestStatus;   // now includes 'Submitted'
    rejection_reason?: string;
    estimated_unit_cost?: number;
}

export interface CreateApprovedProcurementInput {
    procurement_request_id: string;
    unit_cost_kes: number;
    purchase_reference?: string;
}

// ─── Memo Generation Input ──────────────────────────────────────────────────

export interface GenerateProcurementMemoInput {
    to: string;                        // recipient (e.g., "REGISTRAR, HIGH COURT")
    from: string;                      // sender department
    ref: string;                       // reference number
    date: string;                      // formatted date
    subject: string;                   // memo subject
    body: string;                      // main content
    signatory_name: string;            // name of the signing officer
    // signature image is usually taken from the current user's signature_url
}