// src/utils/uploadHelpdeskDocument.ts

import { DocumentEntityType, DocumentFormat, HelpdeskDocument } from "../features/helpdeskdocs/helpdesk.documents.types";

// Export the interface so it can be used elsewhere
export interface UploadHelpdeskDocumentParams {
    blob:        Blob;
    filename:    string;          // e.g. "RHC-CIRCUIT-068.pdf"
    ref:         string;          // e.g. "RHC/CIRCUIT/068"
    subject:     string;          // e.g. "MOMBASA CIRCUIT"
    entity_type: DocumentEntityType;
    entity_id?:  string;
    format:      DocumentFormat;
}

// Define response types
interface HelpdeskApiResponse {
    success: boolean;
    data: HelpdeskDocument;
    message?: string;
}

interface HelpdeskApiError {
    message: string;
    errors?: Record<string, string[]>;
}

// Helper to validate response shape
function isHelpdeskResponse(obj: unknown): obj is HelpdeskApiResponse {
    return (
        typeof obj === 'object' &&
        obj !== null &&
        'success' in obj &&
        'data' in obj
    );
}

export async function uploadHelpdeskDocument(
    params: UploadHelpdeskDocumentParams
): Promise<HelpdeskDocument> {
    const form = new FormData();
    
    form.append('file', params.blob, params.filename);
    form.append('ref', params.ref);
    form.append('subject', params.subject);
    form.append('entity_type', params.entity_type);
    form.append('format', params.format);
    if (params.entity_id) {
        form.append('entity_id', params.entity_id);
    }

    const res = await fetch('/api/v1/helpdesk/documents/upload', {
        method: 'POST',
        body: form,
    });

    if (!res.ok) {
        let errorMessage = 'Failed to save document';
        try {
            const errorData = await res.json() as HelpdeskApiError;
            errorMessage = errorData.message || errorMessage;
        } catch {
            // Fallback to default message
        }
        throw new Error(errorMessage);
    }

    const json = await res.json();
    
    if (!isHelpdeskResponse(json)) {
        throw new Error('Invalid response format from server');
    }
    
    return json.data;
}