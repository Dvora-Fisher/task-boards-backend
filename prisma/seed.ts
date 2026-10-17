/**
 * Demo data — run with: npm run db:seed
 *
 * Creates 3 users, 3 boards, tasks (timed / date-only / unscheduled / DONE / private) and reminders.
 * All dates are placed in the coming week (relative to today, UTC) so the calendar always shows data.
 * Running it again deletes and re-creates the demo users and everything they own.
 *
 * Production safety: in NODE_ENV=production the seed only runs if SEED_PASSWORD is set explicitly,
 * so no account with a publicly known password is ever created there.
 */
import { prisma } from '../src/db/prisma.js';
import { hashPassword } from '../src/auth/password.js';
import { newShareToken } from '../src/services/board.service.js';

const isProduction = process.env.NODE_ENV === 'production';
const password = process.env.SEED_PASSWORD ?? (isProduction ? undefined : 'Demo1234!');

if (!password) {
  console.error('Refusing to seed production without SEED_PASSWORD. Set a strong SEED_PASSWORD and run again.');
  process.exit(1);
}

const DEMO_EMAILS = ['dana@example.com', 'noa@example.com', 'yael@example.com'];

/** Next Monday 00:00 UTC (or the Monday after, if today is Monday). */
function nextMonday(): Date {
  const now = new Date();
  const day = now.getUTCDay(); // 0 = Sunday
  const add = ((8 - day) % 7) || 7;
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + add));
}

const monday = nextMonday();
/** Moment on day `offset` after next Monday at hh:mm UTC */
const at = (offset: number, hh: number, mm = 0) =>
  new Date(Date.UTC(monday.getUTCFullYear(), monday.getUTCMonth(), monday.getUTCDate() + offset, hh, mm));
/** Date-only value (DATE column) on day `offset` after next Monday */
const day = (offset: number) => at(offset, 0);

async function main() {
  await prisma.user.deleteMany({ where: { email: { in: DEMO_EMAILS } } });

  const passwordHash = await hashPassword(password!);
  const [dana, noa, yael] = await Promise.all([
    prisma.user.create({ data: { email: 'dana@example.com', name: 'Dana Levi', passwordHash } }),
    prisma.user.create({ data: { email: 'noa@example.com', name: 'Noa Cohen', passwordHash } }),
    prisma.user.create({ data: { email: 'yael@example.com', name: 'Yael Mizrahi', passwordHash } }),
  ]);

  // 1) PRIVATE board — only Dana sees it
  const privateBoard = await prisma.board.create({
    data: { name: 'My personal tasks', description: 'Private board of Dana', visibility: 'PRIVATE', shareToken: newShareToken(), ownerId: dana.id },
  });

  // 2) SHARED + OPEN board — owner Dana, members Noa and Yael can edit
  const projectBoard = await prisma.board.create({
    data: {
      name: 'Final project',
      description: 'Team board for the React final project',
      visibility: 'SHARED',
      isOpen: true,
      shareToken: newShareToken(),
      ownerId: dana.id,
      members: { create: [{ userId: noa.id }, { userId: yael.id }] },
    },
  });

  // 3) SHARED + CLOSED board — owner Yael; Dana and Noa can only view
  const artBoard = await prisma.board.create({
    data: {
      name: 'Art class',
      description: 'Closed board: members view only',
      visibility: 'SHARED',
      isOpen: false,
      shareToken: newShareToken(),
      ownerId: yael.id,
      members: { create: [{ userId: dana.id }, { userId: noa.id }] },
    },
  });

  type TaskSeed = {
    boardId: string;
    title: string;
    description?: string;
    status?: 'TODO' | 'IN_PROGRESS' | 'DONE';
    priority?: 'LOW' | 'MEDIUM' | 'HIGH';
    audience?: 'BOARD' | 'SELECTED';
    dueDate?: Date;
    startAt?: Date;
    endAt?: Date;
    createdById: string;
    assignees?: string[];
  };

  // Note: no two NOT-DONE timed tasks of the same user overlap (the API would reject that).
  // Overlaps between DIFFERENT users are intentional, to test scheduling per user.
  const tasks: TaskSeed[] = [
    // private board (Dana)
    { boardId: privateBoard.id, title: 'Buy a new notebook', priority: 'LOW', createdById: dana.id },
    { boardId: privateBoard.id, title: 'Doctor appointment', priority: 'HIGH', startAt: at(0, 7), endAt: at(0, 8), createdById: dana.id },
    { boardId: privateBoard.id, title: 'Pay the phone bill', dueDate: day(2), createdById: dana.id },

    // final project board (open)
    { boardId: projectBoard.id, title: 'Design the database', description: 'ERD + Prisma schema', status: 'IN_PROGRESS', priority: 'HIGH', startAt: at(0, 9), endAt: at(0, 10, 30), createdById: dana.id, assignees: [noa.id] },
    { boardId: projectBoard.id, title: 'Team meeting', priority: 'MEDIUM', startAt: at(0, 13), endAt: at(0, 14), createdById: dana.id, assignees: [dana.id, noa.id] },
    { boardId: projectBoard.id, title: 'Write the login screen', priority: 'HIGH', startAt: at(0, 9, 30), endAt: at(0, 11), createdById: noa.id, assignees: [yael.id] },
    { boardId: projectBoard.id, title: 'Old sync (done)', status: 'DONE', startAt: at(0, 11), endAt: at(0, 12), createdById: dana.id, assignees: [noa.id] },
    { boardId: projectBoard.id, title: 'Submit project proposal', priority: 'HIGH', dueDate: day(0), createdById: dana.id },
    { boardId: projectBoard.id, title: 'Prepare presentation', description: 'Slides for the final review', dueDate: day(3), createdById: yael.id, assignees: [yael.id] },
    { boardId: projectBoard.id, title: 'Choose a color palette', priority: 'LOW', createdById: noa.id },
    { boardId: projectBoard.id, title: 'Code review', startAt: at(1, 10), endAt: at(1, 12), createdById: noa.id, assignees: [noa.id] },
    { boardId: projectBoard.id, title: 'Private: practice the demo', audience: 'SELECTED', startAt: at(1, 15), endAt: at(1, 16), createdById: noa.id, assignees: [noa.id] },

    // art class board (closed, owner Yael)
    { boardId: artBoard.id, title: 'Bring watercolors', dueDate: day(1), createdById: yael.id },
    { boardId: artBoard.id, title: 'Art lesson', startAt: at(0, 9, 30), endAt: at(0, 10, 30), createdById: yael.id, assignees: [dana.id] },
    { boardId: artBoard.id, title: 'Clean the studio', priority: 'LOW', createdById: yael.id },
  ];

  for (const t of tasks) {
    await prisma.task.create({
      data: {
        boardId: t.boardId,
        title: t.title,
        description: t.description ?? null,
        status: t.status ?? 'TODO',
        priority: t.priority ?? 'MEDIUM',
        audience: t.audience ?? 'BOARD',
        dueDate: t.dueDate ?? null,
        startAt: t.startAt ?? null,
        endAt: t.endAt ?? null,
        createdById: t.createdById,
        assignments: { create: (t.assignees ?? []).map((userId) => ({ userId })) },
      },
    });
  }

  const reminders = [
    { boardId: projectBoard.id, title: 'Send the weekly update', remindAt: at(0, 9, 45), createdById: dana.id },
    { boardId: projectBoard.id, title: 'Remind Noa about the demo', remindAt: at(1, 8), audience: 'SELECTED' as const, createdById: dana.id, recipients: [noa.id] },
    { boardId: privateBoard.id, title: 'Call grandma', remindAt: at(2, 17), createdById: dana.id },
    { boardId: artBoard.id, title: 'Exhibition registration closes', remindAt: at(4, 12), createdById: yael.id },
  ];
  for (const r of reminders) {
    await prisma.reminder.create({
      data: {
        boardId: r.boardId,
        title: r.title,
        remindAt: r.remindAt,
        audience: r.audience ?? 'BOARD',
        createdById: r.createdById,
        recipients: { create: (r.recipients ?? []).map((userId) => ({ userId })) },
      },
    });
  }

  console.log('Seed completed.');
  console.log(`Users (password: ${isProduction ? '<SEED_PASSWORD>' : password}):`);
  console.log('  dana@example.com  — owner of "My personal tasks" (PRIVATE) and "Final project" (SHARED, open)');
  console.log('  noa@example.com   — member (can edit) of "Final project", member (view only) of "Art class"');
  console.log('  yael@example.com  — owner of "Art class" (SHARED, closed), member of "Final project"');
  console.log(`Demo week starts on ${monday.toISOString().slice(0, 10)} (UTC).`);
  console.log(`Share link token of "Final project": ${projectBoard.shareToken}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
