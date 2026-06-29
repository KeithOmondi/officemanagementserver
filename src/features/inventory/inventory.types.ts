export type InventoryCategory = 
    | 'Furniture'
    | 'Catering Items'
    | 'Branded Materials'
    | 'Stationery'
    | 'Computer Accessories'
    | 'ICT Equipment';

export type StockStatus = 'in_stock' | 'low_stock' | 'out_of_stock';
export type RequestStatus = 'Pending' | 'Approved' | 'Rejected';
export type Urgency = 'Normal' | 'Urgent' | 'Critical';

export interface InventoryItem {
    id: string;
    name: string;
    subtitle: string | null;
    category: InventoryCategory;
    qty_available: number;
    unit: string;
    location: string | null;
    status: StockStatus;
    min_stock_threshold: number;
    created_by: string | null;
    is_active: boolean;
    created_at: string;
    updated_at: string;
}

export interface StoreRequest {
    id: string;
    item_name: string;
    item_id: string | null;
    quantity: number;
    unit: string;
    reason: string;
    requested_by: string;
    requested_by_name?: string;
    status: RequestStatus;
    approved_by: string | null;
    approved_by_name?: string;
    approved_at: string | null;
    rejection_reason: string | null;
    created_at: string;
    updated_at: string;
}

export interface ProcurementRequest {
    id: string;
    item_name: string;
    category: InventoryCategory;
    quantity: number;
    unit: string;
    estimated_unit_cost: number | null;
    justification: string;
    urgency: Urgency;
    requested_by: string;
    requested_by_name?: string;
    status: RequestStatus;
    approved_by: string | null;
    approved_by_name?: string;
    approved_at: string | null;
    rejection_reason: string | null;
    created_at: string;
    updated_at: string;
}

export interface ApprovedProcurementItem {
    id: string;
    procurement_request_id: string;
    item_name: string;
    category: InventoryCategory;
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

export interface InventoryStats {
    total_items: number;
    in_stock: number;
    low_stock: number;
    out_of_stock: number;
    pending_store_requests: number;
    pending_procurement_requests: number;
}

export interface CreateInventoryItemInput {
    name: string;
    subtitle?: string;
    category: InventoryCategory;
    qty_available?: number;
    unit: string;
    location?: string;
    min_stock_threshold?: number;
}

export interface UpdateInventoryItemInput {
    name?: string;
    subtitle?: string | null;
    category?: InventoryCategory;
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
    status?: RequestStatus;
    rejection_reason?: string;
}

export interface CreateProcurementRequestInput {
    item_name: string;
    category: InventoryCategory;
    quantity: number;
    unit: string;
    estimated_unit_cost?: number;
    justification: string;
    urgency?: Urgency;
}

export interface UpdateProcurementRequestInput {
    status?: RequestStatus;
    rejection_reason?: string;
    estimated_unit_cost?: number;
}

export interface CreateApprovedProcurementInput {
    procurement_request_id: string;
    unit_cost_kes: number;
    purchase_reference?: string;
}