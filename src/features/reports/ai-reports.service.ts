// ai-reports.service.ts
import Anthropic from '@anthropic-ai/sdk';
import { pool } from '../../config/db'; // adjust path
import { HelpDeskService } from '../helpdesk/helpdesk.service'; // adjust path
import type { MonthlySummary, ModuleBreakdown } from './ai-reports.types';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ─── Build the summary from real data ────────────────────────────────────────

export async function buildMonthlySummary(month: number, year: number): Promise<MonthlySummary> {
    const periodStart = `${year}-${String(month).padStart(2, '0')}-01`;
    const periodEnd = new Date(year, month, 0).toISOString().slice(0, 10); // last day of month

    const stats = await HelpDeskService.getStats();

    const dsaReport = await HelpDeskService.getDSAReport({
        travel_start: periodStart,
        travel_end: periodEnd,
    });

    const moduleBreakdown: ModuleBreakdown[] = (['circuit', 'special_bench', 'part_heard', 'service_week', 'other_payment'] as const).map((module) => {
        const rows = dsaReport.filter((r) => r.module === module);
        return {
            module,
            count: rows.length,
            totalDsaPaid: rows.filter((r) => r.payment_status === 'Paid').reduce((sum, r) => sum + r.total, 0),
            pendingPayments: rows.filter((r) => r.payment_status !== 'Paid').length,
        };
    });

    const dsaTotals = {
        totalDisbursed: dsaReport.filter((r) => r.payment_status === 'Paid').reduce((sum, r) => sum + r.total, 0),
        totalPending: dsaReport.filter((r) => r.payment_status === 'Pending').reduce((sum, r) => sum + r.total, 0),
        totalInProcess: dsaReport.filter((r) => r.payment_status === 'In Process').reduce((sum, r) => sum + r.total, 0),
    };

    const byJudge = new Map<string, number>();
    for (const row of dsaReport) {
        byJudge.set(row.judge_name, (byJudge.get(row.judge_name) || 0) + row.total);
    }
    const topJudgesByDsa = [...byJudge.entries()]
        .map(([judgeName, total]) => ({ judgeName, total }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 10);

    return {
        month,
        year,
        periodStart,
        periodEnd,
        totalRecords: stats.total_records,
        inProgress: stats.in_progress,
        visaActive: stats.visa_active,
        protocolPending: stats.protocol_pending,
        moduleBreakdown,
        dsaTotals,
        topJudgesByDsa,
    };
}

// ─── Generate the narrative via Claude ───────────────────────────────────────

export async function generateMonthlyReport(summaryData: MonthlySummary) {
    const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 4096,
        messages: [{
            role: 'user',
            content: `You are writing a monthly operations report for a Kenyan court's helpdesk system.

Data for ${summaryData.month}/${summaryData.year} (${summaryData.periodStart} to ${summaryData.periodEnd}):
${JSON.stringify(summaryData, null, 2)}

Write a narrative report with: executive summary, key trends, notable issues (SLA breaches, backlogs, high pending DSA totals), and recommendations. Return ONLY valid JSON, no markdown fences, with fields: executiveSummary, trends, issues, recommendations.`
        }],
    });

    const textBlock = response.content.find((b) => b.type === 'text');
    const text = textBlock && 'text' in textBlock ? textBlock.text : '';
    return JSON.parse(text.replace(/```json|```/g, '').trim());
}

// ─── Persistence ──────────────────────────────────────────────────────────────

export async function saveReport(
    reportType: 'monthly' | 'quarterly',
    periodStart: string,
    periodEnd: string,
    summary: MonthlySummary,
    narrative: Record<string, unknown>,
    generatedBy?: string
) {
    const { rows } = await pool.query(
        `INSERT INTO ai_reports (report_type, period_start, period_end, summary_json, narrative_json, generated_by)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, report_type, period_start, period_end, status, created_at`,
        [reportType, periodStart, periodEnd, JSON.stringify(summary), JSON.stringify(narrative), generatedBy || null]
    );
    return rows[0];
}

export async function findAllReports(filters: { report_type?: string; limit?: number; offset?: number } = {}) {
    let query = `SELECT id, report_type, period_start, period_end, status, created_at, approved_by
                 FROM ai_reports WHERE is_active = true`;
    const params: unknown[] = [];
    let paramCount = 1;

    if (filters.report_type) {
        query += ` AND report_type = $${paramCount}`;
        params.push(filters.report_type);
        paramCount++;
    }

    query += ` ORDER BY period_start DESC`;
    if (filters.limit) {
        query += ` LIMIT $${paramCount}`;
        params.push(filters.limit);
        paramCount++;
    }
    if (filters.offset) {
        query += ` OFFSET $${paramCount}`;
        params.push(filters.offset);
    }

    const { rows } = await pool.query(query, params);
    return rows;
}

export async function findReportById(id: string) {
    const { rows } = await pool.query(
        `SELECT * FROM ai_reports WHERE id = $1 AND is_active = true`,
        [id]
    );
    return rows[0] || null;
}

export async function approveReport(id: string, approvedBy: string) {
    const { rows } = await pool.query(
        `UPDATE ai_reports SET status = 'approved', approved_by = $1 WHERE id = $2 RETURNING *`,
        [approvedBy, id]
    );
    if (rows.length === 0) {
        throw new Error('Report not found');
    }
    return rows[0];
}

// ─── Orchestration: build + generate + save in one call ──────────────────────

export async function generateAndSaveMonthlyReport(month: number, year: number, generatedBy?: string) {
    const summary = await buildMonthlySummary(month, year);
    const narrative = await generateMonthlyReport(summary);
    return saveReport('monthly', summary.periodStart, summary.periodEnd, summary, narrative, generatedBy);
}