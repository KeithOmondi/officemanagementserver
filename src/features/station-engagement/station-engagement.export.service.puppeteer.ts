// src/features/station-engagement/station-engagement.export.service.puppeteer.ts

import { AppError } from '../../utils/response';
import { StationEngagementService } from './station-engagement.service';
import type { 
  StationEngagementReport, 
  Engagement, 
  UnengagedStation,
  EscalationItem,
  PDFGenerationOptions,
  PDFGenerationResult,
} from './station-engagement.types';
//import { SuccessionCourtCategory } from '../successioncourts/succession-courts.types';
import * as ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import https from 'https';
import { pool } from '../../config/db';

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

const LOGO_URL = "https://res.cloudinary.com/do0yflasl/image/upload/v1784363826/ORHC_L_crclut.jpg";

// Mode display mapping
const MODE_DISPLAY_MAP: Record<string, string> = {
  phone_call: 'Phone Call',
  whatsapp: 'WhatsApp',
  email: 'Email',
  physical_visit: 'Physical Visit',
  webinar_followup: 'Webinar Follow-up',
  video_call: 'Video Call',
  walk_in: 'Walk-in',
};

// Status color mapping for visual indicators
const STATUS_COLORS: Record<string, string> = {
  draft: '#9e9e9e',
  submitted: '#1a237e',
  reviewed: '#e65100',
  approved: '#2e7d32',
  rejected: '#c62828',
};

// ─── Export Service ─────────────────────────────────────────────────────

export class StationEngagementExportService {

  // ─── Helper to fetch image from URL ─────────────────────────────────

  private static async fetchImage(url: string): Promise<Buffer | null> {
    return new Promise((resolve) => {
      https.get(url, (response) => {
        const chunks: Buffer[] = [];
        response.on('data', (chunk) => chunks.push(chunk));
        response.on('end', () => {
          resolve(Buffer.concat(chunks));
        });
        response.on('error', () => resolve(null));
      }).on('error', () => resolve(null));
    });
  }

  // ─── PDF Generation ──────────────────────────────────────────────────

  static async generatePDF(
    reportId: string,
    userId: string,
    options?: PDFGenerationOptions & { previewOnly?: boolean }
  ): Promise<Buffer | PDFGenerationResult> {
    const report = await StationEngagementService.findById(reportId);
    if (!report) {
      throw new AppError(404, 'Engagement report not found');
    }

    // Get user display name for support person
    let supportPersonName = report.support_person_id || 'N/A';
    try {
      const { rows } = await pool.query(
        'SELECT full_name FROM users WHERE id = $1',
        [report.support_person_id]
      );
      if (rows[0]?.full_name) {
        supportPersonName = rows[0].full_name;
      }
    } catch (error) {
      // Fallback to ID if name lookup fails
    }

    // Fetch logo from URL
    const logoBuffer = await this.fetchImage(LOGO_URL);

    // Preview mode - return base64 for browser preview
    if (options?.previewOnly) {
      const previewBuffer = await this.generatePDFBuffer(
        report, 
        logoBuffer, 
        supportPersonName, 
        { ...options, previewMode: true }
      );
      
      return {
        success: true,
        previewData: previewBuffer.toString('base64'),
        previewUrl: `/api/station-engagement/reports/${reportId}/pdf/preview`,
        isPreview: true,
        fileName: `preview-engagement-report-${report.week_start}-${report.week_end}.pdf`,
        fileSize: previewBuffer.length,
      };
    }

    // Full PDF generation
    const pdfBuffer = await this.generatePDFBuffer(
      report, 
      logoBuffer, 
      supportPersonName, 
      options
    );

    return pdfBuffer;
  }

// ─── Core PDF Buffer Generation ──────────────────────────────────────

private static async generatePDFBuffer(
  report: StationEngagementReport,
  logoBuffer: Buffer | null,
  supportPersonName: string,
  options?: PDFGenerationOptions & { previewMode?: boolean }
): Promise<Buffer> {
  const isPreview = options?.previewMode || false;

  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({
      size: options?.pageSize || 'A4',
      margin: options?.margin?.top || 50,
      font: 'Helvetica',
    });

    const buffers: Buffer[] = [];
    doc.on('data', (chunk) => buffers.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);

    try {
      // ─── Header ───────────────────────────────────────────────────

      // Logo - Centered at top with proper spacing
      if (logoBuffer) {
        try {
          const logoWidth = 80;
          const logoX = (doc.page.width - logoWidth) / 2;
          doc.image(logoBuffer, logoX, 30, { width: logoWidth });
          doc.moveDown(2.5);
        } catch (error) {
          console.error('Failed to load logo:', error);
          doc.moveDown(1);
        }
      } else {
        doc.moveDown(1);
      }

      // Office Header
      doc.fillColor('#1a237e')
         .fontSize(18)
         .font('Helvetica-Bold')
         .text('OFFICE OF THE REGISTRAR', { align: 'center' })
         .fontSize(14)
         .fillColor('#283593')
         .font('Helvetica-Bold')
         .text('HIGH COURT OF KENYA', { align: 'center' });

      doc.moveDown(0.4);

      // Sub Header
      doc.fillColor('#4a4a4a')
         .fontSize(12)
         .font('Helvetica-Bold')
         .text('SUCCESSION COURT ENGAGEMENT REPORT', { align: 'center' });

      doc.moveDown(0.3);

      // Categories and stations
      doc.fillColor('#6b7280')
         .fontSize(10)
         .font('Helvetica')
         .text(
           `Categories: ${report.categories.join(', ')}  ·  ${report.total_stations_assigned} stations assigned`,
           { align: 'center' }
         );

      // Show status badge
      doc.moveDown(0.3);
      const statusColor = STATUS_COLORS[report.status] || '#6b7280';
      doc.fillColor(statusColor)
         .fontSize(10)
         .font('Helvetica-Bold')
         .text(`Status: ${report.status.toUpperCase()}`, { align: 'center' });

      doc.moveDown(0.6);
      doc.strokeColor('#1a237e').lineWidth(1.5).moveTo(50, doc.y).lineTo(550, doc.y).stroke();
      doc.moveDown(0.8);

      // Status field box row
      const topFieldY = doc.y;
      const fieldGap = 10;
      const fieldWidth = (500 - fieldGap * 2) / 3;
      
      // Get submitter name from report object with fallbacks
      const reportWithDisplay = report as StationEngagementReport & { submitted_by_display?: string };
      const submitterName = reportWithDisplay.submitted_by_display || report.submitted_by || supportPersonName || 'N/A';
      
      this.drawFieldBox(doc, 50, topFieldY, fieldWidth, 34, 'Submitted By', submitterName);
      
      // Field 2: Status with color
      this.drawFieldBox(doc, 50 + fieldWidth + fieldGap, topFieldY, fieldWidth, 34, 'Status', report.status.toUpperCase());
      
      // Field 3: Last Updated or Submission Date
      let dateDisplay = 'N/A';
      if (report.submitted_at) {
        dateDisplay = new Date(report.submitted_at).toLocaleDateString('en-KE', {
          day: '2-digit', month: 'short', year: 'numeric'
        });
      } else if (report.updated_at) {
        dateDisplay = new Date(report.updated_at).toLocaleDateString('en-KE', {
          day: '2-digit', month: 'short', year: 'numeric'
        });
      }
      this.drawFieldBox(doc, 50 + (fieldWidth + fieldGap) * 2, topFieldY, fieldWidth, 34, 'Last Updated', dateDisplay);

      doc.y = topFieldY + 34 + 20;

      // ─── A. Executive Summary ───────────────────────────────────

      this.drawSectionHeader(doc, 'A', 'EXECUTIVE SUMMARY');
      this.drawTextBox(doc, 50, doc.y, 500, report.executive_summary || 'No executive summary provided.');
      doc.moveDown(1.2);

      // ─── B. Station Engagement Log ───────────────────────────────

      if (report.engagements && report.engagements.length > 0) {
        this.drawSectionHeader(doc, 'B', `STATION ENGAGEMENT LOG (${report.engagements.length})`);
        report.engagements.forEach((engagement, index) => {
          if (doc.y > 650) {
            doc.addPage();
          }
          this.drawEngagementCard(doc, engagement);
          if (index < report.engagements.length - 1) {
            doc.moveDown(0.5);
          }
        });
        doc.moveDown(0.5);
      } else {
        doc.moveDown(0.5);
        doc.fontSize(10)
           .font('Helvetica')
           .fillColor('#6b7280')
           .text('No engagements logged for this week.', 50, doc.y);
        doc.moveDown(1);
      }

      // ─── C. Stations Not Yet Engaged ─────────────────────────────

      if (report.unengaged_stations && report.unengaged_stations.length > 0) {
        if (doc.y > 700) {
          doc.addPage();
        }
        this.drawSectionHeader(doc, 'C', `STATIONS NOT YET ENGAGED (${report.unengaged_stations.length})`);
        report.unengaged_stations.forEach((station, index) => {
          if (doc.y > 700) {
            doc.addPage();
          }
          this.drawUnengagedCard(doc, station);
        });
        doc.moveDown(0.5);
      } else {
        doc.moveDown(0.5);
        doc.fontSize(10)
           .font('Helvetica')
           .fillColor('#6b7280')
           .text('All assigned stations were engaged this week.', 50, doc.y);
        doc.moveDown(1);
      }

      // ─── D. Escalations ───────────────────────────────────────────

      if (report.escalations && report.escalations.length > 0) {
        if (doc.y > 700) {
          doc.addPage();
        }
        this.drawSectionHeader(doc, 'D', `ESCALATIONS FOR THE REGISTRAR'S ATTENTION (${report.escalations.length})`);
        report.escalations.forEach((escalation, index) => {
          if (doc.y > 700) {
            doc.addPage();
          }
          this.drawEscalationCard(doc, escalation);
        });
        doc.moveDown(0.5);
      } else {
        doc.moveDown(0.5);
        doc.fontSize(10)
           .font('Helvetica')
           .fillColor('#6b7280')
           .text('No additional escalation items.', 50, doc.y);
        doc.moveDown(1);
      }

      // ─── E / F. Patterns & Priorities ────────────────────────────

      if (report.recurring_patterns || report.priorities) {
        if (doc.y > 700) {
          doc.addPage();
        }

        if (report.recurring_patterns) {
          this.drawSectionHeader(doc, 'E', 'RECURRING OR CROSS-STATION PATTERNS');
          this.drawTextBox(doc, 50, doc.y, 500, report.recurring_patterns);
          doc.moveDown(1.2);
        }

        if (report.priorities) {
          this.drawSectionHeader(doc, 'F', 'PRIORITIES FOR NEXT WEEK');
          this.drawTextBox(doc, 50, doc.y, 500, report.priorities);
        }
      }

      // ─── Footer ───────────────────────────────────────────────────

      if (doc.y > 700) {
        doc.addPage();
      }
      doc.moveDown(2);

      // Footer divider line
      doc.strokeColor('#1a237e').lineWidth(1.5).moveTo(50, doc.y).lineTo(550, doc.y).stroke();
      doc.moveDown(0.5);

      // Footer text - centered
      doc.fontSize(8)
         .font('Helvetica')
         .fillColor('#333333')
         .text(
           'This report is a confidential document of the Office of the Registrar, High Court of Kenya.',
           { align: 'center' }
         )
         .moveDown(0.3)
         .text(
           'Social Transformation through Access to Justice',
           { align: 'center' }
         )
         .moveDown(0.3)
         .fontSize(7)
         .fillColor('#666666')
         .text(
           'Milimani Law Courts | 3rd Floor, Chamber 337 | P.O. Box 30041-00100 | Nairobi',
           { align: 'center' }
         )
         .text(
           'Tel. +254 0730 181478 | registrarhighcourt@court.go.ke | www.judiciary.go.ke',
           { align: 'center' }
         )
         .moveDown(0.3)
         .text(
           `Generated on: ${new Date().toLocaleString('en-KE', {
             day: '2-digit', month: 'long', year: 'numeric',
             hour: '2-digit', minute: '2-digit'
           })}`,
           { align: 'center' }
         );

      // ✅ Only show preview watermark on preview mode
      if (isPreview) {
        doc.fontSize(7)
           .fillColor('#c62828')
           .text('PREVIEW - Not for official use', { align: 'center' });
      }

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

  // ─── Layout Helpers ───────────────────────────────────────────────────

  private static readonly ACCENT = '#92722a';
  private static readonly LABEL_GRAY = '#6b7280';
  private static readonly TEXT_DARK = '#111827';
  private static readonly BORDER_GRAY = '#d1d5db';

  private static ensureSpace(doc: PDFKit.PDFDocument, needed: number): void {
    if (doc.y + needed > 760) {
      doc.addPage();
    }
  }

  private static drawSectionHeader(doc: PDFKit.PDFDocument, letter: string, title: string): void {
    doc.fillColor(this.ACCENT)
       .fontSize(10)
       .font('Helvetica-Bold')
       .text(`${letter}. ${title}`, 50, doc.y, { width: 500 });
    doc.moveDown(0.5);
  }

  private static drawFieldBox(
    doc: PDFKit.PDFDocument,
    x: number, y: number, width: number, height: number,
    label: string, value: string
  ): void {
    // Draw label
    doc.font('Helvetica-Bold').fontSize(7).fillColor(this.LABEL_GRAY)
       .text(label.toUpperCase(), x, y, { width });

    const boxY = y + 11;
    const boxHeight = height - 11;
    
    // Draw box with rounded corners
    doc.roundedRect(x, boxY, width, boxHeight, 3)
       .strokeColor(this.BORDER_GRAY)
       .lineWidth(0.75)
       .stroke();

    // Draw value inside box
    doc.font('Helvetica').fontSize(8.5).fillColor(this.TEXT_DARK)
       .text(value || '\u2014', x + 6, boxY + 6, {
         width: width - 12,
         height: boxHeight - 10,
         ellipsis: true,
       });
  }

  private static drawTextBox(doc: PDFKit.PDFDocument, x: number, y: number, width: number, text: string): void {
    const height = Math.max(45, doc.heightOfString(text, { width: width - 16 }) + 16);
    doc.roundedRect(x, y, width, height, 3)
       .strokeColor(this.BORDER_GRAY)
       .lineWidth(0.75)
       .stroke();
    doc.font('Helvetica').fontSize(9).fillColor(this.TEXT_DARK)
       .text(text, x + 8, y + 8, { width: width - 16, align: 'left' });
    doc.y = y + height;
  }

  private static drawEngagementCard(doc: PDFKit.PDFDocument, engagement: Engagement): void {
    const x = 50;
    const width = 500;
    const cardY = doc.y;
    const pad = 10;
    const colGap = 10;
    const col3 = (width - pad * 2 - colGap * 2) / 3;
    const rowH = 34;

    let cursorY = cardY + pad;

    const modeDisplay = engagement.mode ? MODE_DISPLAY_MAP[engagement.mode] || engagement.mode.replace('_', ' ').toUpperCase() : 'N/A';

    this.drawFieldBox(doc, x + pad, cursorY, col3, rowH, 'Station', engagement.station_name || 'N/A');
    this.drawFieldBox(doc, x + pad + col3 + colGap, cursorY, col3, rowH, 'Date',
      engagement.date ? new Date(engagement.date).toLocaleDateString('en-KE') : 'N/A');
    this.drawFieldBox(doc, x + pad + (col3 + colGap) * 2, cursorY, col3, rowH, 'Contact Person & Role',
      `${engagement.contact_person || 'N/A'}${engagement.contact_role ? ', ' + engagement.contact_role : ''}`);

    cursorY += rowH + 8;

    this.drawFieldBox(doc, x + pad, cursorY, col3, rowH, 'Mode of Engagement', modeDisplay);
    this.drawFieldBox(doc, x + pad + col3 + colGap, cursorY, col3, rowH, 'Status',
      engagement.status ? engagement.status.toUpperCase() : 'N/A');
    this.drawFieldBox(doc, x + pad + (col3 + colGap) * 2, cursorY, col3, rowH, 'Follow-up Date',
      engagement.follow_up_date ? new Date(engagement.follow_up_date).toLocaleDateString('en-KE') : '\u2014');

    cursorY += rowH + 8;

    const halfW = (width - pad * 2 - colGap) / 2;
    this.drawFieldBox(doc, x + pad, cursorY, halfW, 38, 'Issue(s) Raised',
      engagement.issues_raised?.join(', ') || 'None');
    this.drawFieldBox(doc, x + pad + halfW + colGap, cursorY, halfW, 38, 'Action Taken / Resolution',
      engagement.action_taken || engagement.resolution || 'N/A');

    cursorY += 38 + pad;

    doc.roundedRect(x, cardY, width, cursorY - cardY, 4)
       .strokeColor(this.BORDER_GRAY)
       .lineWidth(1)
       .stroke();

    doc.y = cursorY + 12;
  }

  private static drawUnengagedCard(doc: PDFKit.PDFDocument, station: UnengagedStation): void {
    const x = 50;
    const width = 500;
    const cardY = doc.y;
    const pad = 10;
    const colGap = 10;
    const col3 = (width - pad * 2 - colGap * 2) / 3;
    const rowH = 34;

    this.drawFieldBox(doc, x + pad, cardY + pad, col3, rowH, 'Station',
      station.station_name || station.station_id || 'N/A');
    this.drawFieldBox(doc, x + pad + col3 + colGap, cardY + pad, col3, rowH, 'Reason Not Reached',
      station.reason_not_reached ? station.reason_not_reached.replace('_', ' ').toUpperCase() : '\u2014');
    this.drawFieldBox(doc, x + pad + (col3 + colGap) * 2, cardY + pad, col3, rowH, 'Planned Engagement Date',
      station.planned_engagement_date
        ? new Date(station.planned_engagement_date).toLocaleDateString('en-KE')
        : '\u2014');

    const cardBottom = cardY + pad + rowH + pad;

    doc.roundedRect(x, cardY, width, cardBottom - cardY, 4)
       .strokeColor(this.BORDER_GRAY)
       .lineWidth(1)
       .stroke();

    doc.y = cardBottom + 10;
  }

  private static drawEscalationCard(doc: PDFKit.PDFDocument, escalation: EscalationItem): void {
    const x = 50;
    const width = 500;
    const cardY = doc.y;
    const pad = 10;
    const colGap = 10;
    const halfW = (width - pad * 2 - colGap) / 2;
    const rowH = 34;

    let cursorY = cardY + pad;

    this.drawFieldBox(doc, x + pad, cursorY, halfW, rowH, 'Station',
      escalation.station_name || escalation.station_id || 'N/A');
    this.drawFieldBox(doc, x + pad + halfW + colGap, cursorY, halfW / 2 - colGap / 2, rowH, 'Urgency',
      escalation.urgency ? escalation.urgency.toUpperCase() : 'N/A');
    this.drawFieldBox(doc, x + pad + halfW + colGap + halfW / 2 + colGap / 2, cursorY, halfW / 2 - colGap / 2, rowH, 'Status',
      escalation.status ? escalation.status.toUpperCase() : 'N/A');

    cursorY += rowH + 8;

    this.drawFieldBox(doc, x + pad, cursorY, width - pad * 2, 38, 'Issue',
      escalation.issue || 'No issue described');

    cursorY += 38 + 8;

    this.drawFieldBox(doc, x + pad, cursorY, halfW, 38, 'Why It Needs Escalation',
      escalation.why_needs_escalation || '\u2014');
    this.drawFieldBox(doc, x + pad + halfW + colGap, cursorY, halfW, 38, 'Recommended Action',
      escalation.recommended_action || 'No action specified');

    cursorY += 38 + pad;

    doc.roundedRect(x, cardY, width, cursorY - cardY, 4)
       .strokeColor(this.BORDER_GRAY)
       .lineWidth(1)
       .stroke();

    doc.y = cursorY + 12;
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
      properties: { tabColor: { argb: 'FF1a237e' } },
    });

    coverSheet.mergeCells('A1:F1');
    const titleCell = coverSheet.getCell('A1');
    titleCell.value = 'OFFICE OF THE REGISTRAR';
    titleCell.font = { name: 'Helvetica', size: 18, bold: true, color: { argb: 'FF1a237e' } };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };

    coverSheet.mergeCells('A2:F2');
    const subtitleCell = coverSheet.getCell('A2');
    subtitleCell.value = 'HIGH COURT OF KENYA';
    subtitleCell.font = { name: 'Helvetica', size: 14, bold: true, color: { argb: 'FF283593' } };
    subtitleCell.alignment = { horizontal: 'center', vertical: 'middle' };

    coverSheet.mergeCells('A3:F3');
    const reportTitleCell = coverSheet.getCell('A3');
    reportTitleCell.value = 'SUCCESSION COURT ENGAGEMENT REPORT';
    reportTitleCell.font = { name: 'Helvetica', size: 12, bold: true };
    reportTitleCell.alignment = { horizontal: 'center', vertical: 'middle' };

    coverSheet.mergeCells('A4:F4');
    const periodCell = coverSheet.getCell('A4');
    periodCell.value = `Reporting Period: ${new Date(report.week_start).toLocaleDateString('en-KE')} - ${new Date(report.week_end).toLocaleDateString('en-KE')}`;
    periodCell.font = { name: 'Helvetica', size: 10 };
    periodCell.alignment = { horizontal: 'center', vertical: 'middle' };

    // Status badge on cover sheet
    coverSheet.mergeCells('A5:F5');
    const statusCell = coverSheet.getCell('A5');
    statusCell.value = `Status: ${report.status.toUpperCase()}`;
    statusCell.font = { name: 'Helvetica', size: 10, bold: true, color: { argb: STATUS_COLORS[report.status] || 'FF1a237e' } };
    statusCell.alignment = { horizontal: 'center', vertical: 'middle' };

    // Metadata Table
    const metadataStartRow = 8;
    const metadata = [
      ['Report ID', report.id || 'N/A'],
      ['Status', report.status ? report.status.toUpperCase() : 'N/A'],
      ['Categories', report.categories?.join(', ') || 'N/A'],
      ['Support Person', report.support_person_id || 'N/A'],
      ['Total Stations Assigned', report.total_stations_assigned ?? 0],
      ['Created At', report.created_at ? new Date(report.created_at).toLocaleString('en-KE') : 'N/A'],
      ['Last Updated', report.updated_at ? new Date(report.updated_at).toLocaleString('en-KE') : 'N/A'],
      ['Is Draft', report.status === 'draft' ? 'Yes' : 'No'],
      ['Visible to Admin', report.status !== 'draft' ? 'Yes' : 'No'],
    ];

    metadata.forEach(([key, value], index) => {
      const row = metadataStartRow + index;
      const labelCell = coverSheet.getCell(`A${row}`);
      labelCell.value = key + ':';
      labelCell.font = { bold: true, size: 10, name: 'Helvetica' };
      labelCell.alignment = { horizontal: 'right', vertical: 'middle' };
      
      const valueCell = coverSheet.getCell(`B${row}`);
      valueCell.value = value;
      valueCell.font = { size: 10, name: 'Helvetica' };
      valueCell.alignment = { horizontal: 'left', vertical: 'middle' };
    });

    // Executive Summary
    const summaryStartRow = metadataStartRow + metadata.length + 2;
    coverSheet.getCell(`A${summaryStartRow}`).value = 'EXECUTIVE SUMMARY';
    coverSheet.getCell(`A${summaryStartRow}`).font = { name: 'Helvetica', size: 12, bold: true, color: { argb: 'FF1a237e' } };
    coverSheet.mergeCells(`A${summaryStartRow}:F${summaryStartRow}`);

    coverSheet.getCell(`A${summaryStartRow + 1}`).value = report.executive_summary || 'No executive summary provided.';
    coverSheet.mergeCells(`A${summaryStartRow + 1}:F${summaryStartRow + 4}`);
    coverSheet.getCell(`A${summaryStartRow + 1}`).alignment = { wrapText: true, vertical: 'top' };

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

      const engagementHeaders = [
        'Station ID', 'Station Name', 'Date', 'Contact Person', 'Contact Role',
        'Mode', 'Status', 'Follow-up Date', 'Issues Raised', 'Action Taken',
        'Resolution', 'Urgency', 'Escalation Reason'
      ];

      engagementHeaders.forEach((header, index) => {
        const cell = engagementSheet.getCell(1, index + 1);
        cell.value = header;
        cell.font = { name: 'Helvetica', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1a237e' } };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.border = {
          top: { style: 'thin' },
          bottom: { style: 'thin' },
          left: { style: 'thin' },
          right: { style: 'thin' },
        };
      });

      report.engagements.forEach((engagement, index) => {
        const row = index + 2;
        const rowColor = index % 2 === 0 ? 'FFFFFFFF' : 'FFF5F5F5';
        
        const data = [
          engagement.station_id || 'N/A',
          engagement.station_name || 'N/A',
          engagement.date ? new Date(engagement.date).toLocaleDateString('en-KE') : 'N/A',
          engagement.contact_person || 'N/A',
          engagement.contact_role || '',
          engagement.mode ? MODE_DISPLAY_MAP[engagement.mode] || engagement.mode : 'N/A',
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
          cell.font = { name: 'Helvetica', size: 9 };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowColor } };
          cell.alignment = { wrapText: true, vertical: 'top' };
          cell.border = {
            top: { style: 'thin' },
            bottom: { style: 'thin' },
            left: { style: 'thin' },
            right: { style: 'thin' },
          };
        });
      });

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
        cell.font = { name: 'Helvetica', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFBF360C' } };
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
        const rowColor = index % 2 === 0 ? 'FFFFFFFF' : 'FFFFF3E0';
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
          cell.font = { name: 'Helvetica', size: 9 };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowColor } };
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
        cell.font = { name: 'Helvetica', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFC62828' } };
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
        const rowColor = index % 2 === 0 ? 'FFFFFFFF' : 'FFFFEBEE';
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
          cell.font = { name: 'Helvetica', size: 9 };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowColor } };
          cell.alignment = { wrapText: true, vertical: 'top' };
          cell.border = {
            top: { style: 'thin' },
            bottom: { style: 'thin' },
            left: { style: 'thin' },
            right: { style: 'thin' },
          };
          
          if (colIndex === 3 && escalation.urgency) {
            const urgencyColors: Record<string, string> = {
              high: 'FFC62828',
              medium: 'FFE65100',
              low: 'FF2E7D32',
            };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: urgencyColors[escalation.urgency] || rowColor } };
            cell.font = { color: { argb: 'FFFFFFFF' }, bold: true, name: 'Helvetica' };
          }
        });
      });

      escalationSheet.columns.forEach((column) => {
        column.width = 20;
      });
    }

    // ─── Summary Sheet ─────────────────────────────────────────────────

    const summarySheet = workbook.addWorksheet('Summary', {
      properties: { tabColor: { argb: 'FF1a237e' } },
    });

    summarySheet.mergeCells('A1:B1');
    const summaryHeader = summarySheet.getCell('A1');
    summaryHeader.value = 'REPORT SUMMARY';
    summaryHeader.font = { name: 'Helvetica', size: 14, bold: true, color: { argb: 'FF1a237e' } };
    summaryHeader.alignment = { horizontal: 'center', vertical: 'middle' };

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
      ['Is Draft Report', report.status === 'draft' ? 'Yes' : 'No'],
      ['Status', report.status.toUpperCase()],
    ];

    summaryData.forEach((row, index) => {
      const rowNum = index + 3;
      const isHeader = index === 0;
      const cellA = summarySheet.getCell(`A${rowNum}`);
      const cellB = summarySheet.getCell(`B${rowNum}`);
      
      cellA.value = row[0];
      cellA.font = { bold: isHeader, size: isHeader ? 11 : 10, name: 'Helvetica' };
      cellA.alignment = { horizontal: 'left', vertical: 'middle' };
      if (isHeader) {
        cellA.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1a237e' } };
        cellA.font = { color: { argb: 'FFFFFFFF' }, bold: true, name: 'Helvetica' };
      }
      
      cellB.value = row[1];
      cellB.font = { bold: isHeader, size: isHeader ? 11 : 10, name: 'Helvetica' };
      cellB.alignment = { horizontal: 'right', vertical: 'middle' };
      if (isHeader) {
        cellB.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1a237e' } };
        cellB.font = { color: { argb: 'FFFFFFFF' }, bold: true, name: 'Helvetica' };
      }
      
      if (!isHeader && typeof row[1] === 'number') {
        cellB.numFmt = '#,##0';
      }
    });

    summarySheet.getColumn('A').width = 30;
    summarySheet.getColumn('B').width = 20;

    // ─── Footer Sheet ──────────────────────────────────────────────────

    const footerSheet = workbook.addWorksheet('Footer', {
      properties: { tabColor: { argb: 'FF1a237e' } },
    });

    footerSheet.mergeCells('A1:C1');
    const footerTitle = footerSheet.getCell('A1');
    footerTitle.value = 'Office of the Registrar, High Court of Kenya';
    footerTitle.font = { name: 'Helvetica', size: 12, bold: true, color: { argb: 'FF1a237e' } };
    footerTitle.alignment = { horizontal: 'center', vertical: 'middle' };

    footerSheet.mergeCells('A2:C2');
    const footerMotto = footerSheet.getCell('A2');
    footerMotto.value = 'Social Transformation through Access to Justice';
    footerMotto.font = { name: 'Helvetica', size: 10, italic: true };
    footerMotto.alignment = { horizontal: 'center', vertical: 'middle' };

    footerSheet.mergeCells('A3:C3');
    const footerContact = footerSheet.getCell('A3');
    footerContact.value = 'Milimani Law Courts | 3rd Floor, Chamber 337 | P.O. Box 30041-00100 | Nairobi';
    footerContact.font = { name: 'Helvetica', size: 9 };
    footerContact.alignment = { horizontal: 'center', vertical: 'middle' };

    footerSheet.mergeCells('A4:C4');
    const footerEmail = footerSheet.getCell('A4');
    footerEmail.value = 'Tel. +254 0730 181478 | registrarhighcourt@court.go.ke | www.judiciary.go.ke';
    footerEmail.font = { name: 'Helvetica', size: 9 };
    footerEmail.alignment = { horizontal: 'center', vertical: 'middle' };

    footerSheet.mergeCells('A5:C5');
    const footerDate = footerSheet.getCell('A5');
    footerDate.value = `Generated on: ${new Date().toLocaleString('en-KE', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`;
    footerDate.font = { name: 'Helvetica', size: 8, color: { argb: 'FF666666' } };
    footerDate.alignment = { horizontal: 'center', vertical: 'middle' };

    footerSheet.getColumn('A').width = 25;
    footerSheet.getColumn('B').width = 25;
    footerSheet.getColumn('C').width = 25;

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  // ─── Combined Export (Both PDF and Excel) ────────────────────────────

  static async generateBoth(
    reportId: string,
    userId: string,
    options?: PDFGenerationOptions
  ): Promise<{ pdf: Buffer; excel: Buffer }> {
    const [pdf, excel] = await Promise.all([
      this.generatePDF(reportId, userId, options),
      this.generateExcel(reportId, userId),
    ]);

    // Handle case where generatePDF returns PDFGenerationResult (preview)
    const pdfBuffer = Buffer.isBuffer(pdf) ? pdf : Buffer.from((pdf as PDFGenerationResult).previewData || '', 'base64');

    return { pdf: pdfBuffer, excel };
  }

  // ─── Generate PDF Preview ────────────────────────────────────────────

  /**
   * Generate a PDF preview (not downloaded, returns base64 for browser preview)
   */
  static async generatePreview(
    reportId: string,
    userId: string,
    options?: PDFGenerationOptions
  ): Promise<PDFGenerationResult> {
    const result = await this.generatePDF(reportId, userId, { 
      ...options, 
      previewOnly: true 
    });
    return result as PDFGenerationResult;
  }
}