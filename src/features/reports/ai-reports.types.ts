// ai-reports.types.ts

export interface ModuleBreakdown {
    module: 'circuit' | 'special_bench' | 'part_heard' | 'service_week' | 'other_payment';
    count: number;
    totalDsaPaid: number;
    pendingPayments: number;
}

export interface MonthlySummary {
    month: number;      // 1-12
    year: number;
    periodStart: string; // 'YYYY-MM-DD'
    periodEnd: string;

    totalRecords: number;
    inProgress: number;
    visaActive: number;
    protocolPending: number;

    moduleBreakdown: ModuleBreakdown[];

    dsaTotals: {
        totalDisbursed: number;
        totalPending: number;
        totalInProcess: number;
    };

    topJudgesByDsa: Array<{ judgeName: string; total: number }>;
}