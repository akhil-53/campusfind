import nodemailer from 'nodemailer';
import { env } from '../config/env.js';
import prisma from '../config/prisma.js';

let transporter = null;
if (env.EMAIL_ENABLED && env.SMTP_USER && env.SMTP_PASS) {
  transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: env.SMTP_USER,
      pass: env.SMTP_PASS
    }
  });
}

export async function createInAppNotification(userId, title, message, link = null) {
  try {
    return await prisma.notification.create({
      data: {
        userId,
        title,
        message,
        link
      }
    });
  } catch (err) {
    console.error('[Notify] Failed to insert notification:', err.message);
    return null;
  }
}

export async function processPendingEmails() {
  if (!transporter) return;

  try {
    const pending = await prisma.notification.findMany({
      where: {
        emailedAt: null,
        createdAt: {
          gte: new Date(Date.now() - 60 * 60 * 1000)
        }
      },
      include: {
        user: true
      },
      take: 20
    });

    for (const item of pending) {
      if (!item.user?.email) continue;

      try {
        await transporter.sendMail({
          from: `"CampusFind SJT" <${env.SMTP_USER}>`,
          to: item.user.email,
          subject: item.title,
          text: `${item.message}\n\nView details: ${env.APP_BASE_URL}${item.link || ''}`
        });

        await prisma.notification.update({
          where: { notificationId: item.notificationId },
          data: { emailedAt: new Date() }
        });
      } catch (sendErr) {
        console.error(`[Notify] Failed to send email to ${item.user.email}:`, sendErr.message);
      }
    }
  } catch (err) {
    console.error('[Notify] Error processing pending emails:', err.message);
  }
}

// Background email processor
if (env.EMAIL_ENABLED) {
  setInterval(processPendingEmails, 60 * 1000);
}
