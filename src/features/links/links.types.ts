// src/features/external-links/external-links.types.ts

export interface ExternalLinkCategory {
    id: string;
    name: string;
    emoji: string | null;
    description: string | null;
    sort_order: number;
    is_active: boolean;
    created_at: string;
    updated_at: string;
    _count?: {
        links: number;
    };
}

export interface ExternalLink {
    id: string;
    category_id: string;
    name: string;
    description: string | null;
    url: string;
    icon_name: string | null;
    color: string;
    tags: string[];
    is_featured: boolean;
    sort_order: number;
    is_active: boolean;
    click_count: number;
    last_clicked_at: string | null;
    created_by: string | null;
    created_at: string;
    updated_at: string;
    category?: ExternalLinkCategory;
}

export interface ExternalLinkClick {
    id: string;
    link_id: string;
    user_id: string | null;
    ip_address: string | null;
    user_agent: string | null;
    referer: string | null;
    clicked_at: string;
}

export interface CreateLinkInput {
    category_id: string;
    name: string;
    description?: string;
    url: string;
    icon_name?: string;
    color?: string;
    tags?: string[];
    is_featured?: boolean;
    sort_order?: number;
    is_active?: boolean;
}

export interface UpdateLinkInput {
    category_id?: string;
    name?: string;
    description?: string;
    url?: string;
    icon_name?: string;
    color?: string;
    tags?: string[];
    is_featured?: boolean;
    sort_order?: number;
    is_active?: boolean;
}

export interface CreateCategoryInput {
    name: string;
    emoji?: string;
    description?: string;
    sort_order?: number;
    is_active?: boolean;
}

export interface UpdateCategoryInput {
    name?: string;
    emoji?: string;
    description?: string;
    sort_order?: number;
    is_active?: boolean;
}

export interface LinkFilters {
    category_id?: string;
    search?: string;
    is_active?: boolean;
    is_featured?: boolean;
    tags?: string[];
    limit?: number;
    offset?: number;
}

export interface LinksResponse {
    links: ExternalLink[];
    total: number;
    categories?: ExternalLinkCategory[];
}

export interface LinkStats {
    total_links: number;
    total_categories: number;
    total_clicks: number;
    featured_links: number;
    recent_clicks: {
        date: string;
        count: number;
    }[];
    top_links: {
        id: string;
        name: string;
        click_count: number;
    }[];
}