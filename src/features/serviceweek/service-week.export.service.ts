// src/features/service-week/service-week.export.service.ts

import { AppError } from '../../utils/response';
import { ServiceWeekService } from './service-week.service';
import type { ServiceWeekReport, CaseReturn } from './service-week.types';
import PDFDocument from 'pdfkit';
import https from 'https';

// ─── Constants ──────────────────────────────────────────────────────────

const LOGO_URL = "https://res.cloudinary.com/do0yflasl/image/upload/v1784363826/ORHC_L_crclut.jpg";

// Brand palette — judiciary green + gold, matching the Urithi Portal.
const COLOR_PRIMARY = '#1E4620';   // dark green — headers, table headers
const COLOR_ACCENT = '#9C7A1E';    // gold — section labels
const COLOR_TEXT = '#111827';
const COLOR_MUTED = '#6b7280';
const COLOR_ROW_ALT = '#f4f6f2';   // faint green-tinted alt row
const COLOR_BORDER = '#d6d3c4';    // warm gray-green border

const MIN_ROW_HEIGHT = 25;
const CELL_PADDING = 10;

// ─── Export Service ─────────────────────────────────────────────────────

export class ServiceWeekExportService {
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

  // ─── Helper: compute a row's height from its tallest wrapped cell ────

  private static calcRowHeight(
    doc: PDFKit.PDFDocument,
    rowData: string[],
    colWidths: number[],
    fontSize: number,
    minHeight: number = MIN_ROW_HEIGHT
  ): number {
    doc.fontSize(fontSize);
    const heights = rowData.map((text, i) =>
      doc.heightOfString(text || '', { width: colWidths[i] - CELL_PADDING })
    );
    return Math.max(minHeight, Math.max(...heights) + 14);
  }

  // ─── Generate PDF (single report) ───────────────────────────────────
  // Shared by both public users (own report) and admins (any report).

  static async generatePDF(reportId: string): Promise<Buffer> {
    const report = await ServiceWeekService.findById(reportId);
    if (!report) {
      throw new AppError(404, 'Service week report not found');
    }

    const logoBuffer = await this.fetchImage(LOGO_URL);

    return new Promise<Buffer>((resolve, reject) => {
      const doc = new PDFDocument({
        size: 'A4',
        margin: 50,
        font: 'Helvetica',
      });

      const buffers: Buffer[] = [];
      doc.on('data', (chunk) => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', reject);

      try {
        // ─── Header ───────────────────────────────────────────────────

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

        doc.fillColor(COLOR_PRIMARY)
           .fontSize(16)
           .font('Helvetica-Bold')
           .text('THE JUDICIARY', { align: 'center' })
           .fontSize(14)
           .text('HIGH COURT OF KENYA', { align: 'center' });

        doc.moveDown(0.5);

        doc.fillColor(COLOR_ACCENT)
           .fontSize(12)
           .font('Helvetica-Bold')
           .text('SERVICE WEEK/RRI JUDGES\' DAILY CASE RETURNS TEMPLATE', { align: 'center' });

        doc.moveDown(1);

        doc.fillColor(COLOR_TEXT)
           .fontSize(10)
           .font('Helvetica')
           .text(`STATION/DIVISION: ${report.station}${report.division ? ' - ' + report.division : ''}`, { align: 'left' });

        const weekStart = new Date(report.week_start).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
        const weekEnd = new Date(report.week_end).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
        doc.text(`SERVICE WEEK/ RRI WEEK HELD FROM: ${weekStart} TO ${weekEnd}`, { align: 'left' });

        const reportDate = new Date(report.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
        doc.text(`DATE: ${reportDate}`, { align: 'left' });

        doc.text(`NAME OF JUDGE: ${report.judge_name}`, { align: 'left' });

        doc.moveDown(1);

        // ─── Table ───────────────────────────────────────────────────

        const tableTop = doc.y;
        const tableLeft = 50;
        const colWidths = [40, 120, 100, 100, 130];
        const headerHeight = 30;

        const headers = ['SERIAL NO.', 'CASE NUMBER', 'CAUSE - LISTED ACTIVITY', 'OUTCOME', 'REMARKS'];

        doc.rect(tableLeft, tableTop, colWidths.reduce((a, b) => a + b, 0), headerHeight)
           .fillColor(COLOR_PRIMARY)
           .fill();

        doc.fillColor('#ffffff')
           .fontSize(8)
           .font('Helvetica-Bold');

        let xPos = tableLeft;
        headers.forEach((header, i) => {
          doc.text(header, xPos + 5, tableTop + 8, {
            width: colWidths[i] - 10,
            align: 'left',
          });
          xPos += colWidths[i];
        });

        doc.rect(tableLeft, tableTop, colWidths.reduce((a, b) => a + b, 0), headerHeight)
           .strokeColor(COLOR_PRIMARY)
           .lineWidth(1)
           .stroke();

        let currentY = tableTop + headerHeight;
        const cases = report.cases || [];

        if (cases.length === 0) {
          doc.rect(tableLeft, currentY, colWidths.reduce((a, b) => a + b, 0), MIN_ROW_HEIGHT)
             .strokeColor(COLOR_BORDER)
             .lineWidth(1)
             .stroke();

          doc.fillColor(COLOR_MUTED)
             .fontSize(8)
             .font('Helvetica')
             .text('No cases recorded', tableLeft + 5, currentY + 8, {
               width: colWidths.reduce((a, b) => a + b, 0) - 10,
               align: 'center',
             });

          currentY += MIN_ROW_HEIGHT;
        } else {
          cases.forEach((caseItem: CaseReturn, index: number) => {
            const rowData = [
              String(caseItem.serial_number),
              caseItem.case_number,
              caseItem.cause_listed_activity || '',
              caseItem.outcome || '',
              caseItem.remarks || '',
            ];

            const rowHeight = this.calcRowHeight(doc, rowData, colWidths, 8);

            if (currentY + rowHeight > 720) {
              doc.addPage();
              currentY = 50;
            }

            const rowColor = index % 2 === 0 ? COLOR_ROW_ALT : '#ffffff';

            doc.rect(tableLeft, currentY, colWidths.reduce((a, b) => a + b, 0), rowHeight)
               .fillColor(rowColor)
               .fill();

            doc.fillColor(COLOR_TEXT)
               .fontSize(8)
               .font('Helvetica');

            xPos = tableLeft;
            rowData.forEach((data, i) => {
              doc.text(data, xPos + 5, currentY + 7, {
                width: colWidths[i] - 10,
                align: 'left',
              });
              xPos += colWidths[i];
            });

            doc.rect(tableLeft, currentY, colWidths.reduce((a, b) => a + b, 0), rowHeight)
               .strokeColor(COLOR_BORDER)
               .lineWidth(1)
               .stroke();

            currentY += rowHeight;
          });
        }

        // ─── Footer — Submitted by only ─────────────────────────────────

        if (currentY > 630) {
          doc.addPage();
          currentY = 50;
        } else {
          currentY += 30;
        }

        doc.fillColor(COLOR_TEXT)
           .fontSize(9)
           .font('Helvetica-Bold')
           .text('Submitted by:', 50, currentY);

        const nameY = currentY + 15;

        doc.fillColor(COLOR_TEXT)
           .fontSize(9)
           .font('Helvetica')
           .text(report.prepared_by || '.................................', 50, nameY, { width: 130 });

        doc.fillColor(COLOR_MUTED)
           .fontSize(8)
           .font('Helvetica')
           .text(`Designation: ${report.prepared_designation || '..............................'}`, 200, nameY, { width: 190 });

        doc.text(
          `Date: ${report.prepared_date ? new Date(report.prepared_date).toLocaleDateString('en-GB') : '..........'}`,
          420,
          nameY
        );

        doc.end();
      } catch (err) {
        reject(err);
      }
    });
  }

  // ─── Generate Summary PDF (aggregate, admin only) ────────────────────

  static async generateSummaryPDF(reports: ServiceWeekReport[]): Promise<Buffer> {
    if (reports.length === 0) {
      throw new AppError(400, 'No reports provided for summary generation');
    }

    const logoBuffer = await this.fetchImage(LOGO_URL);

    return new Promise<Buffer>((resolve, reject) => {
      const doc = new PDFDocument({
        size: 'A4',
        margin: 50,
        font: 'Helvetica',
      });

      const buffers: Buffer[] = [];
      doc.on('data', (chunk) => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', reject);

      try {
        // ─── Overview Page ───────────────────────────────────────────

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

        doc.fillColor(COLOR_PRIMARY)
           .fontSize(16)
           .font('Helvetica-Bold')
           .text('THE JUDICIARY', { align: 'center' })
           .fontSize(14)
           .text('HIGH COURT OF KENYA', { align: 'center' });

        doc.moveDown(0.5);

        doc.fillColor(COLOR_ACCENT)
           .fontSize(12)
           .font('Helvetica-Bold')
           .text('SERVICE WEEK / RRI — SUMMARY REPORT', { align: 'center' });

        doc.moveDown(0.5);

        doc.fontSize(9)
           .font('Helvetica')
           .fillColor(COLOR_MUTED)
           .text(`Generated: ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}`, { align: 'center' });

        doc.moveDown(1.5);

        const totalCases = reports.reduce((sum, r) => sum + (r.cases?.length || 0), 0);
        const stationSet = new Set(reports.map((r) => r.station));
        const judgeSet = new Set(reports.map((r) => r.judge_name));

        doc.fillColor(COLOR_TEXT)
           .fontSize(10)
           .font('Helvetica-Bold')
           .text('Overview', 50, doc.y);

        doc.fontSize(9)
           .font('Helvetica')
           .moveDown(0.3)
           .text(`Total reports: ${reports.length}`)
           .text(`Total cases returned: ${totalCases}`)
           .text(`Stations covered: ${Array.from(stationSet).join(', ')}`)
           .text(`Judges covered: ${Array.from(judgeSet).join(', ')}`);

        doc.moveDown(1.5);

        // ─── Per-Report Sections ───────────────────────────────────────

        reports.forEach((report, reportIndex) => {
          if (reportIndex > 0 || doc.y > 650) {
            doc.addPage();
          }

          let currentY = doc.y;

          doc.fillColor(COLOR_PRIMARY)
             .fontSize(11)
             .font('Helvetica-Bold')
             .text(
               `${report.station}${report.division ? ' - ' + report.division : ''}  |  ${report.judge_name}`,
               50,
               currentY
             );

          currentY = doc.y + 3;

          const weekStart = new Date(report.week_start).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
          const weekEnd = new Date(report.week_end).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

          doc.fillColor(COLOR_MUTED)
             .fontSize(8)
             .font('Helvetica')
             .text(
               `Week: ${weekStart} – ${weekEnd}   |   Status: ${report.status.toUpperCase()}   |   Submitted by: ${report.prepared_by || '—'}`,
               50,
               currentY
             );

          currentY = doc.y + 8;

          // Compact cases table
          const tableLeft = 50;
          const colWidths = [35, 110, 100, 90, 155];
          const headerHeight = 22;

          const headers = ['#', 'CASE NUMBER', 'ACTIVITY', 'OUTCOME', 'REMARKS'];

          doc.rect(tableLeft, currentY, colWidths.reduce((a, b) => a + b, 0), headerHeight)
             .fillColor(COLOR_ACCENT)
             .fill();

          doc.fillColor('#ffffff')
             .fontSize(7)
             .font('Helvetica-Bold');

          let xPos = tableLeft;
          headers.forEach((header, i) => {
            doc.text(header, xPos + 4, currentY + 7, {
              width: colWidths[i] - 8,
              align: 'left',
            });
            xPos += colWidths[i];
          });

          currentY += headerHeight;

          const cases = report.cases || [];
          if (cases.length === 0) {
            doc.rect(tableLeft, currentY, colWidths.reduce((a, b) => a + b, 0), MIN_ROW_HEIGHT - 5)
               .strokeColor(COLOR_BORDER)
               .lineWidth(0.5)
               .stroke();

            doc.fillColor('#9ca3af')
               .fontSize(7)
               .font('Helvetica')
               .text('No cases recorded', tableLeft + 4, currentY + 6, {
                 width: colWidths.reduce((a, b) => a + b, 0) - 8,
                 align: 'center',
               });

            currentY += MIN_ROW_HEIGHT - 5;
          } else {
            cases.forEach((caseItem: CaseReturn, index: number) => {
              const rowData = [
                String(caseItem.serial_number),
                caseItem.case_number,
                caseItem.cause_listed_activity || '',
                caseItem.outcome || '',
                caseItem.remarks || '',
              ];

              const rowHeight = this.calcRowHeight(doc, rowData, colWidths, 7, 20);

              if (currentY + rowHeight > 730) {
                doc.addPage();
                currentY = 50;
              }

              const rowColor = index % 2 === 0 ? COLOR_ROW_ALT : '#ffffff';

              doc.rect(tableLeft, currentY, colWidths.reduce((a, b) => a + b, 0), rowHeight)
                 .fillColor(rowColor)
                 .fill();

              doc.fillColor(COLOR_TEXT)
                 .fontSize(7)
                 .font('Helvetica');

              xPos = tableLeft;
              rowData.forEach((data, i) => {
                doc.text(data, xPos + 4, currentY + 5, {
                  width: colWidths[i] - 8,
                  align: 'left',
                });
                xPos += colWidths[i];
              });

              doc.rect(tableLeft, currentY, colWidths.reduce((a, b) => a + b, 0), rowHeight)
                 .strokeColor(COLOR_BORDER)
                 .lineWidth(0.5)
                 .stroke();

              currentY += rowHeight;
            });
          }

          doc.y = currentY + 15;
        });

        doc.end();
      } catch (err) {
        reject(err);
      }
    });
  }
}