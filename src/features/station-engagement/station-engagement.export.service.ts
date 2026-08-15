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
import * as ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import https from 'https';
import fs from 'fs';
import path from 'path';
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

// ─── PDF Generation ──────────────────────────────────────────────────

  static async generatePDF(
    reportId: string,
    userId: string
  ): Promise<Buffer> {
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

    return new Promise<Buffer>((resolve, reject) => {
      const doc = new PDFDocument({
        size: 'A4',
        margin: 50,
        font: 'Times-Roman',
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
            doc.moveDown(1);
          }
        } else {
          doc.moveDown(1);
        }

        // Office Header - Times-Roman
        doc.fillColor('#1a237e')
           .fontSize(18)
           .font('Times-Bold')
           .text('OFFICE OF THE REGISTRAR', { align: 'center' })
           .fontSize(15)
           .fillColor('#283593')
           .text('HIGH COURT OF KENYA', { align: 'center' });

        doc.moveDown(0.4);

        // Sub Header
        doc.fillColor('#4a4a4a')
           .fontSize(12)
           .font('Times-Bold')
           .text('SUCCESSION COURT ENGAGEMENT REPORT', { align: 'center' });

        doc.moveDown(0.3);

        // Categories and stations
        doc.fillColor('#6b7280')
           .fontSize(10)
           .font('Times-Roman')
           .text(
             `Categories: ${report.categories.join(', ')}  ·  ${report.total_stations_assigned} stations assigned`,
             { align: 'center' }
           );

        doc.moveDown(0.6);
        doc.strokeColor('#1a237e').lineWidth(1.5).moveTo(50, doc.y).lineTo(550, doc.y).stroke();
        doc.moveDown(0.8);

        // Status field box row - Now showing: Support Person Name, Status, Last Updated/Submission Date
        const topFieldY = doc.y;
        const fieldGap = 10;
        const fieldWidth = (500 - fieldGap * 2) / 3;
        
        // Field 1: Support Person (with actual name)
        this.drawFieldBox(doc, 50, topFieldY, fieldWidth, 34, 'Submitted By:', supportPersonName);
        
        // Field 2: Status
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
          report.engagements.forEach((engagement) => {
            this.ensureSpace(doc, 190);
            this.drawEngagementCard(doc, engagement);
          });
          doc.moveDown(0.5);
        }

        // ─── C. Stations Not Yet Engaged ─────────────────────────────

        if (report.unengaged_stations && report.unengaged_stations.length > 0) {
          doc.addPage();
          this.drawSectionHeader(doc, 'C', `STATIONS NOT YET ENGAGED (${report.unengaged_stations.length})`);
          report.unengaged_stations.forEach((station) => {
            this.ensureSpace(doc, 70);
            this.drawUnengagedCard(doc, station);
          });
          doc.moveDown(0.5);
        }

        // ─── D. Escalations ───────────────────────────────────────────

        if (report.escalations && report.escalations.length > 0) {
          doc.addPage();
          this.drawSectionHeader(doc, 'D', `ESCALATIONS FOR THE REGISTRAR'S ATTENTION (${report.escalations.length})`);
          report.escalations.forEach((escalation) => {
            this.ensureSpace(doc, 150);
            this.drawEscalationCard(doc, escalation);
          });
          doc.moveDown(0.5);
        }

        // ─── E / F. Patterns & Priorities ────────────────────────────

        if (report.recurring_patterns || report.priorities) {
          doc.addPage();

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

        doc.addPage();
        doc.moveDown(3);

        // Footer divider line
        doc.strokeColor('#1a237e').lineWidth(1.5).moveTo(50, doc.y).lineTo(550, doc.y).stroke();
        doc.moveDown(0.5);

        // Footer text - centered
        doc.fontSize(8)
           .font('Times-Roman')
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
       .font('Times-Bold')
       .text(`${letter}. ${title}`, 50, doc.y, { width: 500 });
    doc.moveDown(0.5);
  }

  private static drawFieldBox(
    doc: PDFKit.PDFDocument,
    x: number, y: number, width: number, height: number,
    label: string, value: string
  ): void {
    doc.font('Times-Bold').fontSize(7).fillColor(this.LABEL_GRAY)
       .text(label.toUpperCase(), x, y, { width });

    const boxY = y + 11;
    const boxHeight = height - 11;
    doc.roundedRect(x, boxY, width, boxHeight, 3)
       .strokeColor(this.BORDER_GRAY)
       .lineWidth(0.75)
       .stroke();

    doc.font('Times-Roman').fontSize(8.5).fillColor(this.TEXT_DARK)
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
    doc.font('Times-Roman').fontSize(9).fillColor(this.TEXT_DARK)
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

    this.drawFieldBox(doc, x + pad, cursorY, col3, rowH, 'Station', engagement.station_name || 'N/A');
    this.drawFieldBox(doc, x + pad + col3 + colGap, cursorY, col3, rowH, 'Date',
      engagement.date ? new Date(engagement.date).toLocaleDateString('en-KE') : 'N/A');
    this.drawFieldBox(doc, x + pad + (col3 + colGap) * 2, cursorY, col3, rowH, 'Contact Person & Role',
      `${engagement.contact_person || 'N/A'}${engagement.contact_role ? ', ' + engagement.contact_role : ''}`);

    cursorY += rowH + 8;

    this.drawFieldBox(doc, x + pad, cursorY, col3, rowH, 'Mode of Engagement',
      engagement.mode ? engagement.mode.replace('_', ' ').toUpperCase() : 'N/A');
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

  // ─── Styled PDF Table Drawing Helpers ────────────────────────────────

  private static drawStyledEngagementTable(doc: PDFKit.PDFDocument, engagements: Engagement[]): void {
    const pageWidth = 550;
    const margin = 50;
    const tableWidth = pageWidth - margin;
    const columns = [
      { header: 'Station', width: 90, align: 'left' },
      { header: 'Date', width: 70, align: 'left' },
      { header: 'Contact', width: 80, align: 'left' },
      { header: 'Mode', width: 60, align: 'left' },
      { header: 'Status', width: 60, align: 'center' },
      { header: 'Issues', width: 90, align: 'left' },
      { header: 'Action', width: 100, align: 'left' },
    ];

    let startY = doc.y;
    const rowHeight = 22;
    const headerHeight = 28;
    const colX: number[] = [];
    let x = margin;
    columns.forEach((col) => {
      colX.push(x);
      x += col.width;
    });

    // Table Header with gradient-like background
    const headerY = startY;
    doc.rect(margin, headerY, tableWidth, headerHeight)
       .fillColor('#1a237e')
       .fill()
       .strokeColor('#1a237e')
       .lineWidth(1)
       .stroke();

    doc.fillColor('#ffffff')
       .fontSize(8)
       .font('Times-Bold');
    columns.forEach((col, i) => {
      const textX = colX[i] + (col.align === 'center' ? col.width / 2 : 5);
      const textOptions: PDFKit.Mixins.TextOptions = {
        width: col.width - 10,
        align: col.align as 'left' | 'center' | 'right',
        ellipsis: true,
      };
      if (col.align === 'center') {
        doc.text(col.header, textX, headerY + 8, textOptions);
      } else {
        doc.text(col.header, textX, headerY + 8, textOptions);
      }
    });

    startY = headerY + headerHeight;

    // Table Rows
    const maxRows = 18;
    const rows = engagements.slice(0, maxRows);

    rows.forEach((engagement, rowIndex) => {
      if (startY > 720) {
        doc.addPage();
        startY = 50;
        // Redraw header on new page
        const newHeaderY = startY;
        doc.rect(margin, newHeaderY, tableWidth, headerHeight)
           .fillColor('#1a237e')
           .fill()
           .strokeColor('#1a237e')
           .lineWidth(1)
           .stroke();

        doc.fillColor('#ffffff')
           .fontSize(8)
           .font('Times-Bold');
        columns.forEach((col, i) => {
          const textX = colX[i] + (col.align === 'center' ? col.width / 2 : 5);
          const textOptions: PDFKit.Mixins.TextOptions = {
            width: col.width - 10,
            align: col.align as 'left' | 'center' | 'right',
            ellipsis: true,
          };
          if (col.align === 'center') {
            doc.text(col.header, textX, newHeaderY + 8, textOptions);
          } else {
            doc.text(col.header, textX, newHeaderY + 8, textOptions);
          }
        });
        startY = newHeaderY + headerHeight;
      }

      // Alternating row colors
      const rowColor = rowIndex % 2 === 0 ? '#fafafa' : '#ffffff';
      doc.rect(margin, startY, tableWidth, rowHeight)
         .fillColor(rowColor)
         .fill()
         .strokeColor('#e0e0e0')
         .lineWidth(0.5)
         .stroke();

      const rowData = [
        (engagement.station_name || 'N/A').substring(0, 20),
        engagement.date ? new Date(engagement.date).toLocaleDateString('en-KE') : 'N/A',
        (engagement.contact_person || 'N/A').substring(0, 15),
        engagement.mode ? engagement.mode.replace('_', ' ').toUpperCase() : 'N/A',
        engagement.status ? engagement.status.toUpperCase() : 'N/A',
        (engagement.issues_raised?.slice(0, 2).join(', ') || 'None').substring(0, 25),
        (engagement.action_taken || 'N/A').substring(0, 25),
      ];

      doc.fontSize(7).font('Times-Roman').fillColor('#333333');
      columns.forEach((col, i) => {
        const textX = colX[i] + (col.align === 'center' ? col.width / 2 : 5);
        const text = rowData[i] || '';
        const textOptions: PDFKit.Mixins.TextOptions = {
          width: col.width - 10,
          align: col.align as 'left' | 'center' | 'right',
          ellipsis: true,
        };
        
        // Color status badges
        if (i === 4 && engagement.status) {
          const statusColors: Record<string, string> = {
            resolved: '#2e7d32',
            ongoing: '#e65100',
            escalated: '#c62828',
          };
          doc.fillColor(statusColors[engagement.status] || '#333333');
        } else {
          doc.fillColor('#333333');
        }
        
        if (col.align === 'center') {
          doc.text(text, textX, startY + 5, textOptions);
        } else {
          doc.text(text, textX, startY + 5, textOptions);
        }
        doc.fillColor('#333333');
      });

      startY += rowHeight;
    });

    if (engagements.length > maxRows) {
      doc.fontSize(8)
         .font('Times-Roman')
         .fillColor('#666666')
         .text(`... and ${engagements.length - maxRows} more engagements`, margin, startY + 5);
      startY += 20;
    }

    doc.y = startY + 10;
  }

  private static drawStyledUnengagedTable(doc: PDFKit.PDFDocument, stations: UnengagedStation[]): void {
    const pageWidth = 550;
    const margin = 50;
    const tableWidth = pageWidth - margin;
    const columns = [
      { header: 'Station', width: 130, align: 'left' },
      { header: 'Reason', width: 130, align: 'left' },
      { header: 'Details', width: 160, align: 'left' },
      { header: 'Planned Date', width: 130, align: 'left' },
    ];

    let startY = doc.y;
    const rowHeight = 22;
    const headerHeight = 28;
    const colX: number[] = [];
    let x = margin;
    columns.forEach((col) => {
      colX.push(x);
      x += col.width;
    });

    // Table Header
    const headerY = startY;
    doc.rect(margin, headerY, tableWidth, headerHeight)
       .fillColor('#1a237e')
       .fill()
       .strokeColor('#1a237e')
       .lineWidth(1)
       .stroke();

    doc.fillColor('#ffffff')
       .fontSize(8)
       .font('Times-Bold');
    columns.forEach((col, i) => {
      const textX = colX[i] + 5;
      doc.text(col.header, textX, headerY + 8, { width: col.width - 10, align: 'left' });
    });

    startY = headerY + headerHeight;

    stations.forEach((station, rowIndex) => {
      if (startY > 720) {
        doc.addPage();
        startY = 50;
        const newHeaderY = startY;
        doc.rect(margin, newHeaderY, tableWidth, headerHeight)
           .fillColor('#1a237e')
           .fill()
           .strokeColor('#1a237e')
           .lineWidth(1)
           .stroke();

        doc.fillColor('#ffffff')
           .fontSize(8)
           .font('Times-Bold');
        columns.forEach((col, i) => {
          const textX = colX[i] + 5;
          doc.text(col.header, textX, newHeaderY + 8, { width: col.width - 10, align: 'left' });
        });
        startY = newHeaderY + headerHeight;
      }

      const rowColor = rowIndex % 2 === 0 ? '#fafafa' : '#ffffff';
      doc.rect(margin, startY, tableWidth, rowHeight)
         .fillColor(rowColor)
         .fill()
         .strokeColor('#e0e0e0')
         .lineWidth(0.5)
         .stroke();

      const rowData = [
        (station.station_name || station.station_id || 'N/A').substring(0, 25),
        station.reason_not_reached ? station.reason_not_reached.replace('_', ' ').toUpperCase() : 'N/A',
        (station.reason_not_reached_detail || '').substring(0, 30),
        station.planned_engagement_date
          ? new Date(station.planned_engagement_date).toLocaleDateString('en-KE')
          : 'N/A',
      ];

      doc.fontSize(7).font('Times-Roman').fillColor('#333333');
      columns.forEach((col, i) => {
        const textX = colX[i] + 5;
        doc.text(rowData[i] || '', textX, startY + 5, { width: col.width - 10, align: 'left' });
      });

      startY += rowHeight;
    });

    doc.y = startY + 10;
  }

  private static drawStyledEscalationTable(doc: PDFKit.PDFDocument, escalations: EscalationItem[]): void {
    const pageWidth = 550;
    const margin = 50;
    const tableWidth = pageWidth - margin;
    const columns = [
      { header: 'Station', width: 90, align: 'left' },
      { header: 'Issue', width: 120, align: 'left' },
      { header: 'Urgency', width: 70, align: 'center' },
      { header: 'Recommended Action', width: 150, align: 'left' },
      { header: 'Status', width: 70, align: 'center' },
    ];

    let startY = doc.y;
    const rowHeight = 25;
    const headerHeight = 28;
    const colX: number[] = [];
    let x = margin;
    columns.forEach((col) => {
      colX.push(x);
      x += col.width;
    });

    // Table Header
    const headerY = startY;
    doc.rect(margin, headerY, tableWidth, headerHeight)
       .fillColor('#1a237e')
       .fill()
       .strokeColor('#1a237e')
       .lineWidth(1)
       .stroke();

    doc.fillColor('#ffffff')
       .fontSize(8)
       .font('Times-Bold');
    columns.forEach((col, i) => {
      const textX = colX[i] + (col.align === 'center' ? col.width / 2 : 5);
      const textOptions: PDFKit.Mixins.TextOptions = {
        width: col.width - 10,
        align: col.align as 'left' | 'center' | 'right',
        ellipsis: true,
      };
      if (col.align === 'center') {
        doc.text(col.header, textX, headerY + 8, textOptions);
      } else {
        doc.text(col.header, textX, headerY + 8, textOptions);
      }
    });

    startY = headerY + headerHeight;

    escalations.forEach((escalation, rowIndex) => {
      if (startY > 720) {
        doc.addPage();
        startY = 50;
        const newHeaderY = startY;
        doc.rect(margin, newHeaderY, tableWidth, headerHeight)
           .fillColor('#1a237e')
           .fill()
           .strokeColor('#1a237e')
           .lineWidth(1)
           .stroke();

        doc.fillColor('#ffffff')
           .fontSize(8)
           .font('Times-Bold');
        columns.forEach((col, i) => {
          const textX = colX[i] + (col.align === 'center' ? col.width / 2 : 5);
          const textOptions: PDFKit.Mixins.TextOptions = {
            width: col.width - 10,
            align: col.align as 'left' | 'center' | 'right',
            ellipsis: true,
          };
          if (col.align === 'center') {
            doc.text(col.header, textX, newHeaderY + 8, textOptions);
          } else {
            doc.text(col.header, textX, newHeaderY + 8, textOptions);
          }
        });
        startY = newHeaderY + headerHeight;
      }

      const rowColor = rowIndex % 2 === 0 ? '#fafafa' : '#ffffff';
      doc.rect(margin, startY, tableWidth, rowHeight)
         .fillColor(rowColor)
         .fill()
         .strokeColor('#e0e0e0')
         .lineWidth(0.5)
         .stroke();

      const stationName = (escalation.station_name || escalation.station_id || 'N/A').substring(0, 18);
      const issue = (escalation.issue || 'No issue described').substring(0, 30);
      const urgency = escalation.urgency ? escalation.urgency.toUpperCase() : 'N/A';
      const recommendedAction = (escalation.recommended_action || 'No action specified').substring(0, 30);
      const status = escalation.status ? escalation.status.toUpperCase() : 'N/A';

      const rowData = [stationName, issue, urgency, recommendedAction, status];

      doc.fontSize(7).font('Times-Roman');
      columns.forEach((col, i) => {
        const textX = colX[i] + (col.align === 'center' ? col.width / 2 : 5);
        const text = rowData[i] || '';
        const textOptions: PDFKit.Mixins.TextOptions = {
          width: col.width - 10,
          align: col.align as 'left' | 'center' | 'right',
          ellipsis: true,
        };

        // Color urgency badges
        if (i === 2 && escalation.urgency) {
          const urgencyColors: Record<string, string> = {
            high: '#c62828',
            medium: '#e65100',
            low: '#2e7d32',
          };
          doc.fillColor(urgencyColors[escalation.urgency] || '#333333');
        } else if (i === 4 && escalation.status) {
          const statusColors: Record<string, string> = {
            pending: '#e65100',
            resolved: '#2e7d32',
          };
          doc.fillColor(statusColors[escalation.status] || '#333333');
        } else {
          doc.fillColor('#333333');
        }

        if (col.align === 'center') {
          doc.text(text, textX, startY + 6, textOptions);
        } else {
          doc.text(text, textX, startY + 6, textOptions);
        }
        doc.fillColor('#333333');
      });

      startY += rowHeight;
    });

    doc.y = startY + 10;
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

    // Cover Sheet Content
    coverSheet.mergeCells('A1:F1');
    const titleCell = coverSheet.getCell('A1');
    titleCell.value = 'OFFICE OF THE REGISTRAR';
    titleCell.font = { name: 'Times New Roman', size: 18, bold: true, color: { argb: 'FF1a237e' } };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };

    coverSheet.mergeCells('A2:F2');
    const subtitleCell = coverSheet.getCell('A2');
    subtitleCell.value = 'HIGH COURT OF KENYA';
    subtitleCell.font = { name: 'Times New Roman', size: 14, bold: true, color: { argb: 'FF283593' } };
    subtitleCell.alignment = { horizontal: 'center', vertical: 'middle' };

    coverSheet.mergeCells('A3:F3');
    const reportTitleCell = coverSheet.getCell('A3');
    reportTitleCell.value = 'SUCCESSION COURT ENGAGEMENT REPORT';
    reportTitleCell.font = { name: 'Times New Roman', size: 12, bold: true };
    reportTitleCell.alignment = { horizontal: 'center', vertical: 'middle' };

    coverSheet.mergeCells('A4:F4');
    const periodCell = coverSheet.getCell('A4');
    periodCell.value = `Reporting Period: ${new Date(report.week_start).toLocaleDateString('en-KE')} - ${new Date(report.week_end).toLocaleDateString('en-KE')}`;
    periodCell.font = { name: 'Times New Roman', size: 10 };
    periodCell.alignment = { horizontal: 'center', vertical: 'middle' };

    // Metadata Table with styled background
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
      const labelCell = coverSheet.getCell(`A${row}`);
      labelCell.value = key + ':';
      labelCell.font = { bold: true, size: 10, name: 'Times New Roman' };
      labelCell.alignment = { horizontal: 'right', vertical: 'middle' };
      
      const valueCell = coverSheet.getCell(`B${row}`);
      valueCell.value = value;
      valueCell.font = { size: 10, name: 'Times New Roman' };
      valueCell.alignment = { horizontal: 'left', vertical: 'middle' };
    });

    // Executive Summary
    const summaryStartRow = metadataStartRow + metadata.length + 2;
    coverSheet.getCell(`A${summaryStartRow}`).value = 'EXECUTIVE SUMMARY';
    coverSheet.getCell(`A${summaryStartRow}`).font = { name: 'Times New Roman', size: 12, bold: true, color: { argb: 'FF1a237e' } };
    coverSheet.mergeCells(`A${summaryStartRow}:F${summaryStartRow}`);

    coverSheet.getCell(`A${summaryStartRow + 1}`).value = report.executive_summary || 'No executive summary provided.';
    coverSheet.mergeCells(`A${summaryStartRow + 1}:F${summaryStartRow + 4}`);
    coverSheet.getCell(`A${summaryStartRow + 1}`).alignment = { wrapText: true, vertical: 'top' };

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

      const engagementHeaders = [
        'Station ID', 'Station Name', 'Date', 'Contact Person', 'Contact Role',
        'Mode', 'Status', 'Follow-up Date', 'Issues Raised', 'Action Taken',
        'Resolution', 'Urgency', 'Escalation Reason'
      ];

      // Header with styling
      engagementHeaders.forEach((header, index) => {
        const cell = engagementSheet.getCell(1, index + 1);
        cell.value = header;
        cell.font = { name: 'Times New Roman', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1a237e' } };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.border = {
          top: { style: 'thin' },
          bottom: { style: 'thin' },
          left: { style: 'thin' },
          right: { style: 'thin' },
        };
      });

      // Data rows with alternating colors
      report.engagements.forEach((engagement, index) => {
        const row = index + 2;
        const rowColor = index % 2 === 0 ? 'FFFFFFFF' : 'FFF5F5F5';
        
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
          cell.font = { name: 'Times New Roman', size: 9 };
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
        cell.font = { name: 'Times New Roman', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
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
          cell.font = { name: 'Times New Roman', size: 9 };
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
        cell.font = { name: 'Times New Roman', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
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
          cell.font = { name: 'Times New Roman', size: 9 };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowColor } };
          cell.alignment = { wrapText: true, vertical: 'top' };
          cell.border = {
            top: { style: 'thin' },
            bottom: { style: 'thin' },
            left: { style: 'thin' },
            right: { style: 'thin' },
          };
          
          // Color urgency cells
          if (colIndex === 3 && escalation.urgency) {
            const urgencyColors: Record<string, string> = {
              high: 'FFC62828',
              medium: 'FFE65100',
              low: 'FF2E7D32',
            };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: urgencyColors[escalation.urgency] || rowColor } };
            cell.font = { color: { argb: 'FFFFFFFF' }, bold: true, name: 'Times New Roman' };
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

    // Summary header
    summarySheet.mergeCells('A1:B1');
    const summaryHeader = summarySheet.getCell('A1');
    summaryHeader.value = 'REPORT SUMMARY';
    summaryHeader.font = { name: 'Times New Roman', size: 14, bold: true, color: { argb: 'FF1a237e' } };
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
    ];

    summaryData.forEach((row, index) => {
      const rowNum = index + 3;
      const isHeader = index === 0;
      const cellA = summarySheet.getCell(`A${rowNum}`);
      const cellB = summarySheet.getCell(`B${rowNum}`);
      
      cellA.value = row[0];
      cellA.font = { bold: isHeader, size: isHeader ? 11 : 10, name: 'Times New Roman' };
      cellA.alignment = { horizontal: 'left', vertical: 'middle' };
      if (isHeader) {
        cellA.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1a237e' } };
        cellA.font = { color: { argb: 'FFFFFFFF' }, bold: true, name: 'Times New Roman' };
      }
      
      cellB.value = row[1];
      cellB.font = { bold: isHeader, size: isHeader ? 11 : 10, name: 'Times New Roman' };
      cellB.alignment = { horizontal: 'right', vertical: 'middle' };
      if (isHeader) {
        cellB.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1a237e' } };
        cellB.font = { color: { argb: 'FFFFFFFF' }, bold: true, name: 'Times New Roman' };
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
    footerTitle.font = { name: 'Times New Roman', size: 12, bold: true, color: { argb: 'FF1a237e' } };
    footerTitle.alignment = { horizontal: 'center', vertical: 'middle' };

    footerSheet.mergeCells('A2:C2');
    const footerMotto = footerSheet.getCell('A2');
    footerMotto.value = 'Social Transformation through Access to Justice';
    footerMotto.font = { name: 'Times New Roman', size: 10, italic: true };
    footerMotto.alignment = { horizontal: 'center', vertical: 'middle' };

    footerSheet.mergeCells('A3:C3');
    const footerContact = footerSheet.getCell('A3');
    footerContact.value = 'Milimani Law Courts | 3rd Floor, Chamber 337 | P.O. Box 30041-00100 | Nairobi';
    footerContact.font = { name: 'Times New Roman', size: 9 };
    footerContact.alignment = { horizontal: 'center', vertical: 'middle' };

    footerSheet.mergeCells('A4:C4');
    const footerEmail = footerSheet.getCell('A4');
    footerEmail.value = 'Tel. +254 0730 181478 | registrarhighcourt@court.go.ke | www.judiciary.go.ke';
    footerEmail.font = { name: 'Times New Roman', size: 9 };
    footerEmail.alignment = { horizontal: 'center', vertical: 'middle' };

    

    footerSheet.mergeCells('A5:C5');
    const footerDate = footerSheet.getCell('A5');
    footerDate.value = `Generated on: ${new Date().toLocaleString('en-KE', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`;
    footerDate.font = { name: 'Times New Roman', size: 8, color: { argb: 'FF666666' } };
    footerDate.alignment = { horizontal: 'center', vertical: 'middle' };

    footerSheet.getColumn('A').width = 25;
    footerSheet.getColumn('B').width = 25;
    footerSheet.getColumn('C').width = 25;

    

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