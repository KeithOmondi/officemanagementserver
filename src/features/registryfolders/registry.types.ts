// src/features/registry/registry.types.ts

export type RegistryFolderStatus = 'active' | 'archived' | 'closed';

export interface RegistryFolder {
    id: string;
    ref_no: string;
    name: string;
    category: string;
    description?: string;
    parent_folder_id?: string | null;
    status: RegistryFolderStatus;
    created_by: string;
    created_by_name?: string;
    created_at: string;
    updated_at: string;
    updated_by?: string;
    updated_by_name?: string;
    is_active: boolean;
    department_id?: string;
    document_count?: number;
    sub_folder_count?: number;
}

export interface CreateRegistryFolderInput {
    ref_no: string;
    name: string;
    category: string;
    description?: string;
    parent_folder_id?: string;
    status?: RegistryFolderStatus;
    department_id?: string;
}

export interface UpdateRegistryFolderInput {
    name?: string;
    description?: string;
    status?: RegistryFolderStatus;
    department_id?: string;
}

export interface RegistryFolderFilters {
    search?: string;
    category?: string;
    status?: RegistryFolderStatus;
    parent_folder_id?: string;
    department_id?: string;
    limit?: number;
    offset?: number;
    include_sub_folders?: boolean;
}

export interface RegistryFolderWithStats extends RegistryFolder {
    document_count: number;
    sub_folder_count: number;
}

// Categories based on the referencing system
export const REGISTRY_CATEGORIES = {
    COURT: 'court',
    DIRECTORATE: 'directorate',
    GENERAL: 'general',
    JUDGES: 'judges',
    COMMITTEE: 'committee',
    TRAINING: 'training',
    HR: 'hr',
    FINANCE: 'finance',
    PROCUREMENT: 'procurement',
    ICT: 'ict',
    LEGAL: 'legal',
    PROJECTS: 'projects',
    OTHER: 'other',
} as const;

export type RegistryCategory = typeof REGISTRY_CATEGORIES[keyof typeof REGISTRY_CATEGORIES];

export const CATEGORY_LABELS: Record<RegistryCategory, string> = {
    court: 'Courts',
    directorate: 'Directorates',
    general: 'General',
    judges: 'Judges & Registrars',
    committee: 'Committees',
    training: 'Training & Workshops',
    hr: 'Human Resources',
    finance: 'Finance & Budget',
    procurement: 'Procurement & Supply Chain',
    ict: 'ICT & Information',
    legal: 'Legal & Judicial',
    projects: 'Projects & Programs',
    other: 'Other',
};

export const CATEGORY_COLORS: Record<RegistryCategory, string> = {
    court: 'bg-blue-50 text-blue-700 border-blue-200',
    directorate: 'bg-purple-50 text-purple-700 border-purple-200',
    general: 'bg-stone-50 text-stone-700 border-stone-200',
    judges: 'bg-amber-50 text-amber-700 border-amber-200',
    committee: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    training: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    hr: 'bg-pink-50 text-pink-700 border-pink-200',
    finance: 'bg-green-50 text-green-700 border-green-200',
    procurement: 'bg-orange-50 text-orange-700 border-orange-200',
    ict: 'bg-cyan-50 text-cyan-700 border-cyan-200',
    legal: 'bg-red-50 text-red-700 border-red-200',
    projects: 'bg-teal-50 text-teal-700 border-teal-200',
    other: 'bg-stone-50 text-stone-700 border-stone-200',
};