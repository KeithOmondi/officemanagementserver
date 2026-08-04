import { PDFDocument, rgb, StandardFonts, type PDFPage } from 'pdf-lib';
import axios from 'axios';

export async function embedSignatureBlockIntoPDF(
    originalPdfUrl: string,
    signatureImageUrl: string,
    signatoryName: string,
    signatoryTitle: string,
    copyToRecipients: string[] = [] // 👈 Pass CC / Copy To list if applicable
): Promise<Buffer> {
    // 1. Fetch original PDF
    const pdfRes = await axios.get<ArrayBuffer>(originalPdfUrl, { responseType: 'arraybuffer' });
    const pdfDoc = await PDFDocument.load(pdfRes.data);
    const pages = pdfDoc.getPages();
    const lastPage = pages[pages.length - 1];
    const { width, height } = lastPage.getSize();

    // 2. Load Fonts
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const black = rgb(0, 0, 0);
    const marginX = 60;

    // --- 3. CALCULATE REQUIRED VERTICAL HEIGHT ---
    const SIG_HEIGHT = 120; // Height of image + name + title block
    const COPY_TO_HEADER_HEIGHT = copyToRecipients.length > 0 ? 25 : 0;
    const COPY_TO_LIST_HEIGHT = copyToRecipients.length * 16;

    const TOTAL_BLOCK_HEIGHT = SIG_HEIGHT + COPY_TO_HEADER_HEIGHT + COPY_TO_LIST_HEIGHT;
    const BOTTOM_MARGIN = 40;

    // 👇 NEW: extra lift so the block doesn't hug the footer when content is short.
    // Increase this to push everything further up the page.
    const BLOCK_LIFT = 140;

    let targetPage: PDFPage = lastPage;
    let currentY = 0;

    // Check if total block fits on last page
    const availableSpace = height - 250; // Distance from current content baseline

    if (availableSpace < (TOTAL_BLOCK_HEIGHT + BOTTOM_MARGIN + BLOCK_LIFT)) {
        // Force to new page if combined blocks don't fit
        targetPage = pdfDoc.addPage([width, height]);
        currentY = height - 80; // Start near top of new page
    } else {
        // Fits on existing last page — anchor higher up, above the bottom margin
        currentY = TOTAL_BLOCK_HEIGHT + BOTTOM_MARGIN + BLOCK_LIFT;
    }

    // --- 4. DRAW SIGNATURE BLOCK (TOP) ---
    const sigRes = await axios.get<ArrayBuffer>(signatureImageUrl, { responseType: 'arraybuffer' });
    const sigImage = await pdfDoc.embedPng(sigRes.data);

    const sigDims = sigImage.scaleToFit(200, 50);
    const sigImageY = currentY - sigDims.height;

    // Draw Signature Image
    targetPage.drawImage(sigImage, {
        x: marginX,
        y: sigImageY,
        width: sigDims.width,
        height: sigDims.height,
    });

    // Draw Signatory Name
    const nameY = sigImageY - 18;
    targetPage.drawText(signatoryName.toUpperCase(), {
        x: marginX,
        y: nameY,
        size: 13,
        font: boldFont,
        color: black,
    });

    // Draw Signatory Title (Underlined)
    const titleY = nameY - 18;
    const titleText = signatoryTitle.toUpperCase();
    targetPage.drawText(titleText, {
        x: marginX,
        y: titleY,
        size: 11,
        font: boldFont,
        color: black,
    });

    const titleWidth = boldFont.widthOfTextAtSize(titleText, 11);
    targetPage.drawLine({
        start: { x: marginX, y: titleY - 3 },
        end: { x: marginX + titleWidth, y: titleY - 3 },
        thickness: 1.2,
        color: black,
    });

    // --- 5. DRAW "COPY TO:" BLOCK (ALWAYS BELOW SIGNATURE) ---
    if (copyToRecipients.length > 0) {
        let copyToY = titleY - 30; // Position offset below signature title line

        // Draw "Copy to:" Header
        targetPage.drawText('Copy to:', {
            x: marginX,
            y: copyToY,
            size: 11,
            font: boldFont,
            color: black,
        });

        // Draw Each Recipient
        copyToY -= 16;
        for (const recipient of copyToRecipients) {
            targetPage.drawText(`•  ${recipient}`, {
                x: marginX,
                y: copyToY,
                size: 10,
                font: regularFont,
                color: black,
            });
            copyToY -= 16;
        }
    }

    return Buffer.from(await pdfDoc.save());
}