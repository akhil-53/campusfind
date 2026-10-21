import prisma from '../src/config/prisma.js';

const email = process.argv[2]?.trim().toLowerCase();
const roleName = (process.argv[3] || 'FACULTY').trim().toUpperCase();
const designationTitle = process.argv[4] || (roleName === 'FACULTY' ? 'Faculty' : null);

if (!email) {
  console.log('Usage: node scripts/assign-role.js <email> [ROLE] [DESIGNATION]');
  console.log('Roles: FACULTY, STAFF, ADMIN, STUDENT');
  console.log('Example: node scripts/assign-role.js student.email@vitstudent.ac.in FACULTY Faculty');
  process.exit(1);
}

async function main() {
  const role = await prisma.role.findUnique({ where: { roleName } });
  if (!role) {
    console.error(`Role "${roleName}" not found. Valid roles: STUDENT, STAFF, FACULTY, ADMIN`);
    process.exit(1);
  }

  let designation = null;
  if (designationTitle) {
    designation = await prisma.designation.findUnique({ where: { title: designationTitle } });
    if (!designation && roleName === 'FACULTY') {
      console.warn(`Designation "${designationTitle}" not found. Using default Faculty designation.`);
      designation = await prisma.designation.findFirst({ where: { levelRank: 1 } });
    }
  }

  let reportsToId = null;
  if (roleName === 'FACULTY' && designation && designation.levelRank === 1) {
    // Default Faculty reports to HOD
    const hod = await prisma.user.findFirst({
      where: { designation: { title: 'HOD' }, isActive: true }
    });
    reportsToId = hod?.userId || null;
  }

  const existing = await prisma.user.findUnique({
    where: { email },
    include: { role: true, designation: true }
  });

  if (existing) {
    const updated = await prisma.user.update({
      where: { userId: existing.userId },
      data: {
        roleId: role.roleId,
        designationId: designation ? designation.designationId : null,
        reportsToId: reportsToId || existing.reportsToId,
        isActive: true,
        isAvailable: true
      },
      include: { role: true, designation: true }
    });

    console.log(`\nSuccessfully updated user "${updated.email}":`);
    console.log(`- Full Name: ${updated.fullName}`);
    console.log(`- Role: ${updated.role.roleName}`);
    console.log(`- Designation: ${updated.designation?.title || 'None'}`);
    console.log(`- Reports To (ID): ${updated.reportsToId || 'None'}`);
  } else {
    const fullName = email.split('@')[0].replace(/\./g, ' ');
    const created = await prisma.user.create({
      data: {
        email,
        fullName: fullName.charAt(0).toUpperCase() + fullName.slice(1),
        roleId: role.roleId,
        designationId: designation ? designation.designationId : null,
        reportsToId: reportsToId,
        isActive: true,
        isAvailable: true
      },
      include: { role: true, designation: true }
    });

    console.log(`\nSuccessfully pre-provisioned user "${created.email}":`);
    console.log(`- Full Name: ${created.fullName}`);
    console.log(`- Role: ${created.role.roleName}`);
    console.log(`- Designation: ${created.designation?.title || 'None'}`);
    console.log(`- Reports To (ID): ${created.reportsToId || 'None'}`);
  }

  console.log('\nThis user can now sign in with Google OAuth and will be granted full ' + roleName + ' access.\n');
}

main()
  .catch((err) => {
    console.error('Error assigning role:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
