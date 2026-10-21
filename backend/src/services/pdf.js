import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';
import { env } from '../config/env.js';

export async function generateHandoverPdf(letterData, res) {
  const doc = new PDFDocument({ size: 'A4', margin: 50 });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="Handover_Letter_${letterData.letterNo}.pdf"`
  );

  doc.pipe(res);

  // Header
  doc
    .fontSize(18)
    .font('Helvetica-Bold')
    .text('VIT Vellore — Lost and Found, SJT Block', { align: 'center' });
  doc.moveDown(0.3);
  doc
    .fontSize(10)
    .font('Helvetica')
    .fillColor('#555555')
    .text('Silver Jubilee Tower (SJT) Lost & Found Cell', { align: 'center' });
  doc.moveDown(1);

  // Line separator
  doc
    .strokeColor('#cccccc')
    .lineWidth(1)
    .moveTo(50, doc.y)
    .lineTo(545, doc.y)
    .stroke();
  doc.moveDown(1);

  // Letter metadata
  doc.fillColor('#000000').fontSize(11).font('Helvetica-Bold');
  doc.text(`Letter No: ${letterData.letterNo}`);
  doc.font('Helvetica').fontSize(10).fillColor('#444444');
  doc.text(`Generated Date: ${new Date(letterData.generatedAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`);
  doc.moveDown(1);

  // Title
  doc.fontSize(13).font('Helvetica-Bold').fillColor('#111827');
  doc.text('Undertaking for Receipt of Lost Item', { align: 'center', underline: true });
  doc.moveDown(1);

  // Student & Verification Information
  doc.fontSize(10).font('Helvetica');
  doc.fillColor('#000000');

  const leftX = 50;
  const colWidth = 240;

  // Table-style layout
  let currentY = doc.y;

  doc.font('Helvetica-Bold').text('Student Name:', leftX, currentY);
  doc.font('Helvetica').text(letterData.studentName || 'N/A', leftX + 110, currentY);

  doc.font('Helvetica-Bold').text('Reg. Number:', leftX + colWidth, currentY);
  doc.font('Helvetica').text(letterData.regNo || 'N/A', leftX + colWidth + 90, currentY);

  currentY += 20;
  doc.font('Helvetica-Bold').text('Item Category:', leftX, currentY);
  doc.font('Helvetica').text(letterData.categoryName || 'N/A', leftX + 110, currentY);

  doc.font('Helvetica-Bold').text('Shelf Code:', leftX + colWidth, currentY);
  doc.font('Helvetica').text(letterData.shelfCode || 'N/A', leftX + colWidth + 90, currentY);

  currentY += 20;
  doc.font('Helvetica-Bold').text('Item Description:', leftX, currentY);
  doc.font('Helvetica').text(letterData.description || 'N/A', leftX + 110, currentY, { width: 380 });

  currentY += 35;
  doc.font('Helvetica-Bold').text('Found Details:', leftX, currentY);
  doc.font('Helvetica').text(
    `${letterData.roomName || 'SJT'} on ${new Date(letterData.foundAt).toLocaleDateString('en-IN')}`,
    leftX + 110,
    currentY
  );

  currentY += 20;
  doc.font('Helvetica-Bold').text('Verified By:', leftX, currentY);
  doc.font('Helvetica').text(
    `${letterData.verifierName || 'Faculty'} (${letterData.verifierDesignation || 'Faculty'})`,
    leftX + 110,
    currentY
  );

  currentY += 30;
  doc.font('Helvetica-Bold').text('Marks Claimed by Student:', leftX, currentY);
  currentY += 15;
  doc.font('Helvetica').fillColor('#333333').text(letterData.marksClaimed || 'None stated', leftX + 10, currentY, { width: 480 });

  currentY += 35;
  doc.fillColor('#000000').font('Helvetica-Bold').text('Marks Observed by Verifier:', leftX, currentY);
  currentY += 15;
  doc.font('Helvetica').fillColor('#333333').text(letterData.marksObserved || 'Confirmed matching', leftX + 10, currentY, { width: 480 });

  currentY += 45;
  doc.y = currentY;

  // Declaration
  doc.fontSize(9).font('Helvetica-Oblique').fillColor('#374151');
  doc.text(
    'Declaration: I confirm that the item described above belongs to me and I have received it in good condition. All details verified as per SJT Lost and Found protocol.',
    leftX,
    doc.y,
    { width: 490, align: 'justify' }
  );
  doc.moveDown(2);

  // Signatures
  const sigY = doc.y + 20;
  doc.fontSize(10).font('Helvetica').fillColor('#000000');
  doc.text('_____________________________', leftX, sigY);
  doc.text('Signature of Student', leftX, sigY + 15);

  doc.text('_____________________________', 360, sigY);
  doc.text('Signature of Verifying Faculty', 360, sigY + 15);

  // QR Code
  const qrUrl = `${env.APP_BASE_URL}/verify/${letterData.verifyCode}`;
  try {
    const qrDataUrl = await QRCode.toDataURL(qrUrl, { margin: 1, width: 90 });
    const qrBuffer = Buffer.from(qrDataUrl.split(',')[1], 'base64');
    doc.image(qrBuffer, 245, sigY + 35, { width: 75, height: 75 });
    doc.fontSize(8).font('Helvetica-Bold').text(`VERIFY CODE: ${letterData.verifyCode}`, 50, sigY + 115, { align: 'center', width: 495 });
  } catch (qrErr) {
    console.error('[PDF] QR Generation failed:', qrErr);
    doc.fontSize(8).font('Helvetica-Bold').text(`Verification Code: ${letterData.verifyCode}`, 50, sigY + 50, { align: 'center' });
  }

  doc.end();
}
