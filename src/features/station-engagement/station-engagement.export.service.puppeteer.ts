// ============================================================
// src/features/station-engagement/station-engagement.export.service.ts
// ============================================================

import { AppError } from '../../utils/response';
import { StationEngagementService } from './station-engagement.service';
import type { 
  StationEngagementReport, 
  Engagement, 
  UnengagedStation,
  EscalationItem
} from './station-engagement.types';
import { SuccessionCourtCategory } from '../successioncourts/succession-courts.types';
import * as ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';

// ─── Type Definitions ────────────────────────────────────────────────────

export interface ExportOptions {
  includeEngagements?: boolean;
  includeUnengagedStations?: boolean;
  includeEscalations?: boolean;
  includePatterns?: boolean;
}

export interface ReportExportData {
  report: StationEngagementReport;
  generatedAt: string;
  generatedBy: string;
  stationNames?: Map<string, string>;
}

// ─── Constants ──────────────────────────────────────────────────────────

const LOGO_PATH = path.join(__dirname, '../../../assets/logo.png');

// ─── Export Service ─────────────────────────────────────────────────────

export class StationEngagementExportService {
  
  // ─── PDF Generation ──────────────────────────────────────────────────

static async generatePDF(
  reportId: string,
  userId: string
): Promise<Buffer> {
  const report = await StationEngagementService.findById(reportId);
  if (!report) {
    throw new AppError(404, 'Engagement report not found');
  }

  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margin: 50,
    });

    const buffers: Buffer[] = [];
    doc.on('data', (chunk) => buffers.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);

    try {
      // ─── Header Section ──────────────────────────────────────────────

      // Logo - try to load, continue if not found
      try {
        if (fs.existsSync(LOGO_PATH)) {
          doc.image(LOGO_PATH, 50, 45, { width: 80 });
        }
      } catch (error) {
        // Continue without logo
      }

      // Office Header
      doc.fontSize(14)
         .font('Helvetica-Bold')
         .text('OFFICE OF THE REGISTRAR', { align: 'center' })
         .fontSize(12)
         .text('HIGH COURT OF KENYA', { align: 'center' });

      doc.moveDown(0.5);

      // Sub Header
      doc.fontSize(10)
         .font('Helvetica')
         .text('SUCCESSION COURT ENGAGEMENT REPORT', { align: 'center' })
         .text(
           `Reporting Period: ${new Date(report.week_start).toLocaleDateString('en-KE', { 
             day: '2-digit', month: 'long', year: 'numeric' 
           })} - ${new Date(report.week_end).toLocaleDateString('en-KE', { 
             day: '2-digit', month: 'long', year: 'numeric' 
           })}`,
           { align: 'center' }
         );

      doc.moveDown(0.5);

      // Category Badges
      let categoryText = 'Categories: ';
      report.categories.forEach((cat, index) => {
        categoryText += `${cat}${index < report.categories.length - 1 ? ', ' : ''}`;
      });
      doc.fontSize(9)
         .text(categoryText, { align: 'center' })
         .text(`Support Person ID: ${report.support_person_id}`, { align: 'center' })
         .text(`Total Stations Assigned: ${report.total_stations_assigned}`, { align: 'center' });

      // Status Badge
      doc.moveDown(0.5)
         .fontSize(10)
         .font('Helvetica-Bold')
         .text(`Status: ${report.status.toUpperCase()}`, { align: 'center' });

      doc.moveDown();

      // ─── Executive Summary ───────────────────────────────────────────

      doc.fontSize(12)
         .font('Helvetica-Bold')
         .text('EXECUTIVE SUMMARY', { underline: true });

      doc.moveDown(0.5);
      doc.fontSize(10)
         .font('Helvetica')
         .text(report.executive_summary || 'No executive summary provided.', {
           width: 490,
           align: 'justify',
         });

      doc.moveDown();

      // ─── Engagements Section ──────────────────────────────────────────

      if (report.engagements && report.engagements.length > 0) {
        doc.fontSize(12)
           .font('Helvetica-Bold')
           .text('ENGAGEMENTS', { underline: true });

        doc.moveDown(0.5);

        this.drawEngagementTable(doc, report.engagements);
      }

      // ─── Unengaged Stations ───────────────────────────────────────────

      if (report.unengaged_stations && report.unengaged_stations.length > 0) {
        doc.addPage();
        doc.fontSize(12)
           .font('Helvetica-Bold')
           .text('UNENGAGED STATIONS', { underline: true });

        doc.moveDown(0.5);

        this.drawUnengagedTable(doc, report.unengaged_stations);
      }

      // ─── Escalations ──────────────────────────────────────────────────

      if (report.escalations && report.escalations.length > 0) {
        doc.addPage();
        doc.fontSize(12)
           .font('Helvetica-Bold')
           .text('ESCALATIONS', { underline: true });

        doc.moveDown(0.5);

        this.drawEscalationTable(doc, report.escalations);
      }

      // ─── Additional Issues & Recurring Patterns ──────────────────────

      if (report.additional_issues || report.recurring_patterns || report.priorities) {
        doc.addPage();

        if (report.additional_issues) {
          doc.fontSize(12)
             .font('Helvetica-Bold')
             .text('ADDITIONAL ISSUES', { underline: true });
          doc.moveDown(0.5);
          doc.fontSize(10)
             .font('Helvetica')
             .text(report.additional_issues, { width: 490, align: 'justify' });
          doc.moveDown();
        }

        if (report.recurring_patterns) {
          doc.fontSize(12)
             .font('Helvetica-Bold')
             .text('RECURRING PATTERNS', { underline: true });
          doc.moveDown(0.5);
          doc.fontSize(10)
             .font('Helvetica')
             .text(report.recurring_patterns, { width: 490, align: 'justify' });
          doc.moveDown();
        }

        if (report.priorities) {
          doc.fontSize(12)
             .font('Helvetica-Bold')
             .text('PRIORITIES', { underline: true });
          doc.moveDown(0.5);
          doc.fontSize(10)
             .font('Helvetica')
             .text(report.priorities, { width: 490, align: 'justify' });
        }
      }

      // ─── Footer ────────────────────────────────────────────────────────

      doc.addPage();
      doc.fontSize(8)
         .font('Helvetica')
         .text(
           'This report is a confidential document of the Office of the Registrar, High Court of Kenya.',
           { align: 'center' }
         )
         .text(
           `Generated on: ${new Date().toLocaleString('en-KE', { 
             day: '2-digit', month: 'long', year: 'numeric', 
             hour: '2-digit', minute: '2-digit' 
           })}`,
           { align: 'center' }
         );

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

  // ─── PDF Table Drawing Helpers ──────────────────────────────────────

  private static drawEngagementTable(doc: PDFKit.PDFDocument, engagements: Engagement[]): void {
    const tableTop = doc.y;
    const columns = [
      { header: 'Station', width: 100 },
      { header: 'Date', width: 80 },
      { header: 'Contact', width: 80 },
      { header: 'Mode', width: 60 },
      { header: 'Status', width: 60 },
      { header: 'Issues', width: 70 },
      { header: 'Action', width: 40 },
    ];

    let y = tableTop;
    const rowHeight = 20;
    const colX = [50];

    // Calculate column positions
    let x = 50;
    columns.forEach((col, i) => {
      if (i > 0) colX.push(x);
      x += col.width;
    });

    // Table Header
    doc.fontSize(8).font('Helvetica-Bold');
    columns.forEach((col, i) => {
      doc.text(col.header, colX[i] + 2, y + 2, { width: col.width - 4, align: 'left' });
    });

    y += rowHeight;

    // Table Rows
    doc.fontSize(8).font('Helvetica');
    const maxRows = 20;
    const rows = engagements.slice(0, maxRows);

    rows.forEach((engagement) => {
      if (y > 700) {
        doc.addPage();
        y = 50;
      }

      const rowData = [
        engagement.station_name?.substring(0, 20) || 'N/A',
        engagement.date ? new Date(engagement.date).toLocaleDateString('en-KE') : 'N/A',
        engagement.contact_person?.substring(0, 15) || 'N/A',
        engagement.mode ? engagement.mode.replace('_', ' ').toUpperCase() : 'N/A',
        engagement.status ? engagement.status.toUpperCase() : 'N/A',
        engagement.issues_raised?.slice(0, 2).join(', ').substring(0, 20) || 'None',
        engagement.action_taken?.substring(0, 20) || 'N/A',
      ];

      columns.forEach((col, i) => {
        const text = rowData[i] || '';
        doc.text(text, colX[i] + 2, y + 2, { width: col.width - 4, height: rowHeight - 4 });
      });

      y += rowHeight;
    });

    if (engagements.length > maxRows) {
      doc.text(`... and ${engagements.length - maxRows} more engagements`, 50, y + 5);
    }

    doc.y = y + 20;
  }

  private static drawUnengagedTable(doc: PDFKit.PDFDocument, stations: UnengagedStation[]): void {
    const tableTop = doc.y;
    const columns = [
      { header: 'Station', width: 120 },
      { header: 'Reason', width: 120 },
      { header: 'Details', width: 150 },
      { header: 'Planned Date', width: 100 },
    ];

    let y = tableTop;
    const rowHeight = 20;
    const colX = [50];

    let x = 50;
    columns.forEach((col, i) => {
      if (i > 0) colX.push(x);
      x += col.width;
    });

    doc.fontSize(8).font('Helvetica-Bold');
    columns.forEach((col, i) => {
      doc.text(col.header, colX[i] + 2, y + 2, { width: col.width - 4, align: 'left' });
    });

    y += rowHeight;

    doc.fontSize(8).font('Helvetica');
    stations.forEach((station) => {
      if (y > 700) {
        doc.addPage();
        y = 50;
      }

      const rowData = [
        station.station_name || station.station_id || 'N/A',
        station.reason_not_reached ? station.reason_not_reached.replace('_', ' ').toUpperCase() : 'N/A',
        station.reason_not_reached_detail || '',
        station.planned_engagement_date 
          ? new Date(station.planned_engagement_date).toLocaleDateString('en-KE')
          : 'N/A',
      ];

      columns.forEach((col, i) => {
        const text = (rowData[i] || '').substring(0, 20);
        doc.text(text, colX[i] + 2, y + 2, { width: col.width - 4, height: rowHeight - 4 });
      });

      y += rowHeight;
    });

    doc.y = y + 20;
  }

  private static drawEscalationTable(doc: PDFKit.PDFDocument, escalations: EscalationItem[]): void {
    const tableTop = doc.y;
    const columns = [
      { header: 'Station', width: 80 },
      { header: 'Issue', width: 100 },
      { header: 'Urgency', width: 60 },
      { header: 'Action', width: 100 },
      { header: 'Status', width: 60 },
    ];

    let y = tableTop;
    const rowHeight = 25;
    const colX = [50];

    let x = 50;
    columns.forEach((col, i) => {
      if (i > 0) colX.push(x);
      x += col.width;
    });

    doc.fontSize(8).font('Helvetica-Bold');
    columns.forEach((col, i) => {
      doc.text(col.header, colX[i] + 2, y + 2, { width: col.width - 4, align: 'left' });
    });

    y += rowHeight;

    doc.fontSize(8).font('Helvetica');
    escalations.forEach((escalation) => {
      if (y > 700) {
        doc.addPage();
        y = 50;
      }

      // Safely get values with fallbacks for undefined/null
      const stationName = escalation.station_name || escalation.station_id || 'N/A';
      const issue = (escalation.issue || 'No issue described').substring(0, 25);
      const urgency = escalation.urgency ? escalation.urgency.toUpperCase() : 'N/A';
      const recommendedAction = (escalation.recommended_action || 'No action specified').substring(0, 25);
      const status = escalation.status ? escalation.status.toUpperCase() : 'N/A';

      const rowData = [
        stationName,
        issue,
        urgency,
        recommendedAction,
        status,
      ];

      columns.forEach((col, i) => {
        const text = (rowData[i] || '').substring(0, 20);
        doc.text(text, colX[i] + 2, y + 2, { width: col.width - 4, height: rowHeight - 4 });
      });

      y += rowHeight;
    });

    doc.y = y + 20;
  }

  // ─── Excel Generation ──────────────────────────────────────────────────

  static async generateExcel(
    reportId: string,
    userId: string
  ): Promise<Buffer> {
    const report = await StationEngagementService.findById(reportId);
    if (!report) {
      throw new AppError(404, 'Engagement report not found');
    }

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Office of the Registrar';
    workbook.created = new Date();

    // ─── Cover Sheet ──────────────────────────────────────────────────

    const coverSheet = workbook.addWorksheet('Cover Sheet', {
      properties: { tabColor: { argb: 'FF2E7D32' } },
    });

    // Cover Sheet Content
    coverSheet.mergeCells('A1:F1');
    const titleCell = coverSheet.getCell('A1');
    titleCell.value = 'OFFICE OF THE REGISTRAR';
    titleCell.font = { name: 'Arial', size: 18, bold: true };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };

    coverSheet.mergeCells('A2:F2');
    const subtitleCell = coverSheet.getCell('A2');
    subtitleCell.value = 'HIGH COURT OF KENYA';
    subtitleCell.font = { name: 'Arial', size: 14, bold: true };
    subtitleCell.alignment = { horizontal: 'center', vertical: 'middle' };

    coverSheet.mergeCells('A3:F3');
    const reportTitleCell = coverSheet.getCell('A3');
    reportTitleCell.value = 'SUCCESSION COURT ENGAGEMENT REPORT';
    reportTitleCell.font = { name: 'Arial', size: 12, bold: true };
    reportTitleCell.alignment = { horizontal: 'center', vertical: 'middle' };

    coverSheet.mergeCells('A4:F4');
    const periodCell = coverSheet.getCell('A4');
    periodCell.value = `Reporting Period: ${new Date(report.week_start).toLocaleDateString('en-KE')} - ${new Date(report.week_end).toLocaleDateString('en-KE')}`;
    periodCell.font = { name: 'Arial', size: 10 };
    periodCell.alignment = { horizontal: 'center', vertical: 'middle' };

    // Metadata Table
    const metadataStartRow = 7;
    const metadata = [
      ['Report ID', report.id || 'N/A'],
      ['Status', report.status ? report.status.toUpperCase() : 'N/A'],
      ['Categories', report.categories?.join(', ') || 'N/A'],
      ['Support Person ID', report.support_person_id || 'N/A'],
      ['Total Stations Assigned', report.total_stations_assigned ?? 0],
      ['Created At', report.created_at ? new Date(report.created_at).toLocaleString('en-KE') : 'N/A'],
      ['Last Updated', report.updated_at ? new Date(report.updated_at).toLocaleString('en-KE') : 'N/A'],
    ];

    metadata.forEach(([key, value], index) => {
      const row = metadataStartRow + index;
      coverSheet.getCell(`A${row}`).value = key + ':';
      coverSheet.getCell(`A${row}`).font = { bold: true };
      coverSheet.getCell(`B${row}`).value = value;
    });

    // Executive Summary
    const summaryStartRow = metadataStartRow + metadata.length + 2;
    coverSheet.getCell(`A${summaryStartRow}`).value = 'EXECUTIVE SUMMARY';
    coverSheet.getCell(`A${summaryStartRow}`).font = { name: 'Arial', size: 12, bold: true };
    coverSheet.mergeCells(`A${summaryStartRow}:F${summaryStartRow}`);

    coverSheet.getCell(`A${summaryStartRow + 1}`).value = report.executive_summary || 'No executive summary provided.';
    coverSheet.mergeCells(`A${summaryStartRow + 1}:F${summaryStartRow + 4}`);

    // Column widths
    coverSheet.getColumn('A').width = 25;
    coverSheet.getColumn('B').width = 50;
    coverSheet.getColumn('C').width = 20;
    coverSheet.getColumn('D').width = 20;
    coverSheet.getColumn('E').width = 20;
    coverSheet.getColumn('F').width = 20;

    // ─── Engagements Sheet ────────────────────────────────────────────

    if (report.engagements && report.engagements.length > 0) {
      const engagementSheet = workbook.addWorksheet('Engagements', {
        properties: { tabColor: { argb: 'FF1565C0' } },
      });

      // Headers
      const engagementHeaders = [
        'Station ID', 'Station Name', 'Date', 'Contact Person', 'Contact Role',
        'Mode', 'Status', 'Follow-up Date', 'Issues Raised', 'Action Taken',
        'Resolution', 'Urgency', 'Escalation Reason'
      ];

      engagementHeaders.forEach((header, index) => {
        const cell = engagementSheet.getCell(1, index + 1);
        cell.value = header;
        cell.font = { name: 'Arial', size: 10, bold: true };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE3F2FD' } };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.border = {
          top: { style: 'thin' },
          bottom: { style: 'thin' },
          left: { style: 'thin' },
          right: { style: 'thin' },
        };
      });

      // Data
      report.engagements.forEach((engagement, index) => {
        const row = index + 2;
        const data = [
          engagement.station_id || 'N/A',
          engagement.station_name || 'N/A',
          engagement.date ? new Date(engagement.date).toLocaleDateString('en-KE') : 'N/A',
          engagement.contact_person || 'N/A',
          engagement.contact_role || '',
          engagement.mode || 'N/A',
          engagement.status || 'N/A',
          engagement.follow_up_date ? new Date(engagement.follow_up_date).toLocaleDateString('en-KE') : '',
          engagement.issues_raised?.join(', ') || '',
          engagement.action_taken || 'N/A',
          engagement.resolution || '',
          engagement.urgency || '',
          engagement.why_needs_escalation || '',
        ];

        data.forEach((value, colIndex) => {
          const cell = engagementSheet.getCell(row, colIndex + 1);
          cell.value = value;
          cell.alignment = { wrapText: true, vertical: 'top' };
          cell.border = {
            top: { style: 'thin' },
            bottom: { style: 'thin' },
            left: { style: 'thin' },
            right: { style: 'thin' },
          };
        });
      });

      // Auto-fit columns
      engagementSheet.columns.forEach((column) => {
        column.width = 18;
        column.alignment = { wrapText: true };
      });
    }

    // ─── Unengaged Stations Sheet ─────────────────────────────────────

    if (report.unengaged_stations && report.unengaged_stations.length > 0) {
      const unengagedSheet = workbook.addWorksheet('Unengaged Stations', {
        properties: { tabColor: { argb: 'FFE65100' } },
      });

      const headers = ['Station ID', 'Station Name', 'Reason Not Reached', 'Reason Details', 'Planned Engagement Date', 'Active'];
      headers.forEach((header, index) => {
        const cell = unengagedSheet.getCell(1, index + 1);
        cell.value = header;
        cell.font = { name: 'Arial', size: 10, bold: true };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF3E0' } };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.border = {
          top: { style: 'thin' },
          bottom: { style: 'thin' },
          left: { style: 'thin' },
          right: { style: 'thin' },
        };
      });

      report.unengaged_stations.forEach((station, index) => {
        const row = index + 2;
        const data = [
          station.station_id || 'N/A',
          station.station_name || '',
          station.reason_not_reached || '',
          station.reason_not_reached_detail || '',
          station.planned_engagement_date ? new Date(station.planned_engagement_date).toLocaleDateString('en-KE') : '',
          station.is_active ? 'Yes' : 'No',
        ];

        data.forEach((value, colIndex) => {
          const cell = unengagedSheet.getCell(row, colIndex + 1);
          cell.value = value;
          cell.alignment = { wrapText: true, vertical: 'top' };
          cell.border = {
            top: { style: 'thin' },
            bottom: { style: 'thin' },
            left: { style: 'thin' },
            right: { style: 'thin' },
          };
        });
      });

      unengagedSheet.columns.forEach((column) => {
        column.width = 20;
      });
    }

    // ─── Escalations Sheet ────────────────────────────────────────────

    if (report.escalations && report.escalations.length > 0) {
      const escalationSheet = workbook.addWorksheet('Escalations', {
        properties: { tabColor: { argb: 'FFC62828' } },
      });

      const headers = ['Station ID', 'Station Name', 'Issue', 'Urgency', 'Why Needs Escalation', 'Recommended Action', 'Status'];
      headers.forEach((header, index) => {
        const cell = escalationSheet.getCell(1, index + 1);
        cell.value = header;
        cell.font = { name: 'Arial', size: 10, bold: true };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFEBEE' } };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.border = {
          top: { style: 'thin' },
          bottom: { style: 'thin' },
          left: { style: 'thin' },
          right: { style: 'thin' },
        };
      });

      report.escalations.forEach((escalation, index) => {
        const row = index + 2;
        const data = [
          escalation.station_id || 'N/A',
          escalation.station_name || '',
          escalation.issue || '',
          escalation.urgency ? escalation.urgency.toUpperCase() : 'N/A',
          escalation.why_needs_escalation || '',
          escalation.recommended_action || '',
          escalation.status ? escalation.status.toUpperCase() : 'N/A',
        ];

        data.forEach((value, colIndex) => {
          const cell = escalationSheet.getCell(row, colIndex + 1);
          cell.value = value;
          cell.alignment = { wrapText: true, vertical: 'top' };
          cell.border = {
            top: { style: 'thin' },
            bottom: { style: 'thin' },
            left: { style: 'thin' },
            right: { style: 'thin' },
          };
        });
      });

      escalationSheet.columns.forEach((column) => {
        column.width = 20;
      });
    }

    // ─── Summary Sheet ─────────────────────────────────────────────────

    const summarySheet = workbook.addWorksheet('Summary', {
      properties: { tabColor: { argb: 'FF2E7D32' } },
    });

    const summaryData = [
      ['Metric', 'Value'],
      ['Total Engagements', report.engagements?.length || 0],
      ['Total Unengaged Stations', report.unengaged_stations?.length || 0],
      ['Total Escalations', report.escalations?.length || 0],
      ['High Urgency Escalations', report.escalations?.filter(e => e.urgency === 'high').length || 0],
      ['Medium Urgency Escalations', report.escalations?.filter(e => e.urgency === 'medium').length || 0],
      ['Low Urgency Escalations', report.escalations?.filter(e => e.urgency === 'low').length || 0],
      ['Resolved Engagements', report.engagements?.filter(e => e.status === 'resolved').length || 0],
      ['Ongoing Engagements', report.engagements?.filter(e => e.status === 'ongoing').length || 0],
      ['Escalated Engagements', report.engagements?.filter(e => e.status === 'escalated').length || 0],
    ];

    summaryData.forEach((row, index) => {
      const rowNum = index + 1;
      summarySheet.getCell(`A${rowNum}`).value = row[0];
      summarySheet.getCell(`A${rowNum}`).font = index === 0 ? { bold: true } : {};
      summarySheet.getCell(`B${rowNum}`).value = row[1];
      summarySheet.getCell(`B${rowNum}`).font = index === 0 ? { bold: true } : {};
      summarySheet.getCell(`B${rowNum}`).alignment = { horizontal: 'right' };
    });

    summarySheet.getColumn('A').width = 30;
    summarySheet.getColumn('B').width = 20;

    // ─── Export ────────────────────────────────────────────────────────

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  // ─── Combined Export (Both PDF and Excel) ────────────────────────────

  static async generateBoth(
    reportId: string,
    userId: string
  ): Promise<{ pdf: Buffer; excel: Buffer }> {
    const [pdf, excel] = await Promise.all([
      this.generatePDF(reportId, userId),
      this.generateExcel(reportId, userId),
    ]);

    return { pdf, excel };
  }   

}