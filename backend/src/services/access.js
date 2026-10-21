import prisma from '../config/prisma.js';
import { HttpError } from '../utils/httpError.js';

export async function assertOwnReport(user, reportId) {
  const report = await prisma.lostReport.findUnique({
    where: { reportId: parseInt(reportId, 10) }
  });

  // Return 404 rather than 403 to prevent ID probing
  if (!report || report.studentId !== user.id) {
    throw new HttpError(404, 'Lost report not found', 'REPORT_NOT_FOUND');
  }

  return report;
}

export async function assertFacultyOnCase(user, reportId, requireActive = false) {
  if (user.role === 'ADMIN') return true;

  const id = parseInt(reportId, 10);
  const where = {
    reportId: id,
    assignedTo: user.id
  };

  if (requireActive) {
    where.status = 'ACTIVE';
  }

  const assignment = await prisma.assignment.findFirst({
    where,
    orderBy: { assignedAt: 'desc' }
  });

  if (!assignment) {
    throw new HttpError(403, 'You are not assigned to this case', 'FORBIDDEN');
  }

  return assignment;
}

export async function assertTheftHandler(user) {
  if (user.role === 'ADMIN') return true;

  const setting = await prisma.systemSetting.findUnique({
    where: { settingKey: 'theft_handler_user_id' }
  });

  if (!setting || setting.settingValue !== String(user.id)) {
    throw new HttpError(403, 'You are not designated as the theft handler', 'FORBIDDEN');
  }

  return true;
}

// Field whitelists
export const reportForStudentSelect = {
  reportId: true,
  description: true,
  color: true,
  brand: true,
  identifyingMarks: true,
  lostFrom: true,
  lostTo: true,
  status: true,
  notFoundAt: true,
  closedReason: true,
  createdAt: true,
  updatedAt: true,
  category: {
    select: { categoryId: true, categoryName: true }
  },
  location: {
    select: { locationId: true, roomName: true, block: true }
  }
};

export const reportForStaffSelect = {
  reportId: true,
  description: true,
  color: true,
  brand: true,
  lostFrom: true,
  lostTo: true,
  status: true,
  notFoundAt: true,
  closedReason: true,
  createdAt: true,
  category: {
    select: { categoryId: true, categoryName: true }
  },
  location: {
    select: { locationId: true, roomName: true, block: true }
  },
  student: {
    select: { userId: true, fullName: true, regNo: true }
  }
};

export const reportForFacultySelect = {
  reportId: true,
  description: true,
  color: true,
  brand: true,
  identifyingMarks: true,
  lostFrom: true,
  lostTo: true,
  status: true,
  notFoundAt: true,
  closedReason: true,
  createdAt: true,
  updatedAt: true,
  category: {
    select: { categoryId: true, categoryName: true }
  },
  location: {
    select: { locationId: true, roomName: true, block: true, floorNo: true }
  },
  student: {
    select: { userId: true, fullName: true, regNo: true, email: true }
  }
};
