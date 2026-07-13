// helpdesk-report.excel.ts
import ExcelJS from 'exceljs';
import { DSAReportRow } from './helpdesk.types';

const MODULE_LABELS: Record<string, string> = {
    circuit: 'Circuit',
    special_bench: 'Special Bench',
    part_heard: 'Part-Heard',
    service_week: 'Service Week',
    other_payment: 'Other Payment',
};

export async function generateDSAReportExcel(rows: DSAReportRow[]): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('DSA Report');

    sheet.columns = [
        { header: 'Module', key: 'module', width: 14 },
        { header: 'Activity', key: 'activity', width: 22 },
        { header: 'Name', key: 'judge_name', width: 30 },
        { header: 'PJ No.', key: 'pj_number', width: 12 },
        { header: 'Desig/Grade', key: 'designation', width: 14 },
        { header: 'Date of Request', key: 'date_of_request', width: 16 },
        { header: 'Date of Ticket Facilitation', key: 'date_of_ticket_facilitation', width: 20 },
        { header: 'Date of Conference Facilitation', key: 'date_of_conference_facilitation', width: 22 },
        { header: 'Travel Date', key: 'travel_date', width: 14 },
        { header: 'Travel Back', key: 'travel_back', width: 14 },
        { header: 'Days', key: 'days', width: 8 },
        { header: 'Rate', key: 'dsa_per_day', width: 12 },
        { header: 'Total', key: 'total', width: 14 },
        { header: 'Requisition Number', key: 'requisition_number', width: 18 },
        { header: 'Requisition Initiation Date', key: 'requisition_initiation_date', width: 20 },
        { header: 'Status', key: 'payment_status', width: 14 },
    ];

    // Header styling — judiciary dark green + gold text
    sheet.getRow(1).eachCell((cell) => {
        cell.font = { bold: true, color: { argb: 'FFC29B38' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E4620' } };
        cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    });
    sheet.getRow(1).height = 32;

    for (const row of rows) {
        const added = sheet.addRow({
            module: MODULE_LABELS[row.module] ?? row.module,
            activity: row.activity,
            judge_name: row.judge_name,
            pj_number: row.pj_number,
            designation: row.designation ?? '',
            date_of_request: row.date_of_request ?? '',
            date_of_ticket_facilitation: row.date_of_ticket_facilitation ?? '',
            date_of_conference_facilitation: row.date_of_conference_facilitation ?? '',
            travel_date: row.travel_date ?? '',
            travel_back: row.travel_back ?? '',
            days: row.days,
            dsa_per_day: row.dsa_per_day,
            total: row.total,
            requisition_number: row.requisition_number ?? '',
            requisition_initiation_date: row.requisition_initiation_date ?? '',
            payment_status: row.payment_status,
        });

        const statusCell = added.getCell('payment_status');
        if (row.payment_status === 'Paid') {
            statusCell.font = { color: { argb: 'FF1E4620' }, bold: true };
        } else if (row.payment_status === 'In Process') {
            statusCell.font = { color: { argb: 'FFB8860B' }, bold: true };
        }
    }

    sheet.getColumn('dsa_per_day').numFmt = '#,##0.00';
    sheet.getColumn('total').numFmt = '#,##0.00';

   const arrayBuffer = await workbook.xlsx.writeBuffer();
return Buffer.from(arrayBuffer);
}