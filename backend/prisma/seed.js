import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding CampusFind database...');

  // 1. Roles
  const roles = ['STUDENT', 'STAFF', 'FACULTY', 'ADMIN'];
  for (const roleName of roles) {
    await prisma.role.upsert({
      where: { roleName },
      update: {},
      create: { roleName }
    });
  }

  // 2. Designations
  const designations = [
    { title: 'Faculty', levelRank: 1 },
    { title: 'HOD', levelRank: 2 },
    { title: 'Dean', levelRank: 3 }
  ];
  for (const des of designations) {
    await prisma.designation.upsert({
      where: { title: des.title },
      update: { levelRank: des.levelRank },
      create: des
    });
  }

  // 3. Categories
  const categories = [
    'Water Bottle', 'Electronics', 'ID Card', 'Wallet', 'Bag', 'Keys', 'Calculator',
    'Stationery', 'Clothing', 'Spectacles', 'Jewellery', 'Books & Notes', 'Umbrella', 'Other'
  ];
  for (const categoryName of categories) {
    await prisma.category.upsert({
      where: { categoryName },
      update: {},
      create: { categoryName }
    });
  }

  // 4. Locations
  const locations = [
    { block: 'SJT', roomName: 'SJT G03', floorNo: 0, locationType: 'COMMON_AREA' },
    { block: 'SJT', roomName: 'SJT 101', floorNo: 1, locationType: 'CLASSROOM' },
    { block: 'SJT', roomName: 'SJT 102', floorNo: 1, locationType: 'CLASSROOM' },
    { block: 'SJT', roomName: 'SJT 201', floorNo: 2, locationType: 'CLASSROOM' },
    { block: 'SJT', roomName: 'SJT 301', floorNo: 3, locationType: 'EXAM_HALL' },
    { block: 'SJT', roomName: 'SJT 302', floorNo: 3, locationType: 'EXAM_HALL' },
    { block: 'SJT', roomName: 'SJT 418', floorNo: 4, locationType: 'LAB' },
    { block: 'SJT', roomName: 'SJT Ground Floor Lobby', floorNo: 0, locationType: 'COMMON_AREA' }
  ];
  for (const loc of locations) {
    await prisma.location.upsert({
      where: { block_roomName: { block: loc.block, roomName: loc.roomName } },
      update: {},
      create: loc
    });
  }

  // 5. System Settings
  const settings = [
    { settingKey: 'review_deadline_minutes', settingValue: '2880', description: 'Minutes each assignment level gets before escalation' },
    { settingKey: 'visit_window_days', settingValue: '7', description: 'Days after NOT_FOUND for the student room visit' },
    { settingKey: 'unclaimed_after_days', settingValue: '30', description: 'Days before an available item is flagged' },
    { settingKey: 'min_match_score', settingValue: '30', description: 'Matches below this score are not stored' },
    { settingKey: 'room_visit_hours', settingValue: '9:00 AM - 5:00 PM', description: 'Shown in the not-found notice' },
    { settingKey: 'lost_found_room', settingValue: 'SJT G03', description: 'Lost and found room name' },
    { settingKey: 'default_verification_venue', settingValue: 'SJT G03', description: 'Default venue for verification visits' },
    { settingKey: 'theft_handler_user_id', settingValue: '', description: 'Faculty user id who receives theft cases' }
  ];
  for (const s of settings) {
    await prisma.systemSetting.upsert({
      where: { settingKey: s.settingKey },
      update: {},
      create: s
    });
  }

  // Query records for foreign keys
  const roleStudent = await prisma.role.findUnique({ where: { roleName: 'STUDENT' } });
  const roleStaff = await prisma.role.findUnique({ where: { roleName: 'STAFF' } });
  const roleFaculty = await prisma.role.findUnique({ where: { roleName: 'FACULTY' } });
  const roleAdmin = await prisma.role.findUnique({ where: { roleName: 'ADMIN' } });

  const desDean = await prisma.designation.findUnique({ where: { title: 'Dean' } });
  const desHod = await prisma.designation.findUnique({ where: { title: 'HOD' } });
  const desFaculty = await prisma.designation.findUnique({ where: { title: 'Faculty' } });

  // 6. Users
  // Dean
  const dean = await prisma.user.upsert({
    where: { email: 'dean@vit.ac.in' },
    update: {},
    create: {
      fullName: 'Dr. K. Dean',
      email: 'dean@vit.ac.in',
      roleId: roleFaculty.roleId,
      designationId: desDean.designationId,
      isActive: true,
      isAvailable: true
    }
  });

  // HOD (reports to Dean)
  const hod = await prisma.user.upsert({
    where: { email: 'hod@vit.ac.in' },
    update: { reportsToId: dean.userId },
    create: {
      fullName: 'Dr. S. HOD',
      email: 'hod@vit.ac.in',
      roleId: roleFaculty.roleId,
      designationId: desHod.designationId,
      reportsToId: dean.userId,
      isActive: true,
      isAvailable: true
    }
  });

  // Faculty 1
  const faculty1 = await prisma.user.upsert({
    where: { email: 'rajesh.faculty@vit.ac.in' },
    update: { reportsToId: hod.userId },
    create: {
      fullName: 'Prof. Rajesh Kumar',
      email: 'rajesh.faculty@vit.ac.in',
      roleId: roleFaculty.roleId,
      designationId: desFaculty.designationId,
      reportsToId: hod.userId,
      isActive: true,
      isAvailable: true
    }
  });

  // Faculty 2
  await prisma.user.upsert({
    where: { email: 'ananya.faculty@vit.ac.in' },
    update: { reportsToId: hod.userId },
    create: {
      fullName: 'Prof. Ananya Sharma',
      email: 'ananya.faculty@vit.ac.in',
      roleId: roleFaculty.roleId,
      designationId: desFaculty.designationId,
      reportsToId: hod.userId,
      isActive: true,
      isAvailable: true
    }
  });

  // Staff
  await prisma.user.upsert({
    where: { email: 'staff@vit.ac.in' },
    update: {},
    create: {
      fullName: 'SJT LF Desk Staff',
      email: 'staff@vit.ac.in',
      roleId: roleStaff.roleId,
      isActive: true
    }
  });

  // Admin (break-glass: admin@vit.ac.in / admin123)
  const adminPasswordHash = await bcrypt.hash('admin123', 10);
  await prisma.user.upsert({
    where: { email: 'admin@vit.ac.in' },
    update: { passwordHash: adminPasswordHash, roleId: roleAdmin.roleId },
    create: {
      fullName: 'CampusFind Admin',
      email: 'admin@vit.ac.in',
      roleId: roleAdmin.roleId,
      passwordHash: adminPasswordHash,
      isActive: true
    }
  });

  // Students
  await prisma.user.upsert({
    where: { email: 'aarav.patel2023@vitstudent.ac.in' },
    update: {},
    create: {
      fullName: 'Aarav Patel',
      email: 'aarav.patel2023@vitstudent.ac.in',
      regNo: '23BCE1042',
      roleId: roleStudent.roleId,
      isActive: true
    }
  });

  await prisma.user.upsert({
    where: { email: 'pooja.verma2024@vitstudent.ac.in' },
    update: {},
    create: {
      fullName: 'Pooja Verma',
      email: 'pooja.verma2024@vitstudent.ac.in',
      regNo: '24BCT0089',
      roleId: roleStudent.roleId,
      isActive: true
    }
  });

  // Update theft handler setting to Faculty 1
  await prisma.systemSetting.updateMany({
    where: { settingKey: 'theft_handler_user_id' },
    data: { settingValue: String(faculty1.userId) }
  });

  console.log('Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
