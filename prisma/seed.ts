/**
 * Demo data — run with: npm run db:seed
 *
 * Creates demo users, boards (private / shared-open / shared-closed), tasks
 * (timed / date-only / unscheduled / DONE / private) and reminders.
 * Week-based dates are relative to the coming week (Israel time), so the calendar always shows data.
 * Yahrzeit dates are fixed Gregorian dates (computed from the Hebrew calendar) for 5787–5788.
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

const DEMO_USERS = {
  dana: { email: 'dana@example.com', name: 'Dana Levi' },
  noa: { email: 'noa@example.com', name: 'Noa Cohen' },
  yael: { email: 'yael@example.com', name: 'Yael Mizrahi' },
  miriam: { email: 'miriam@example.com', name: 'מרים שטרן' }, // seminary secretary
  sara: { email: 'sara@example.com', name: 'שרה כהן' }, // seminary teacher
  esti: { email: 'esti@example.com', name: 'אסתי ברגר' }, // seminary student
  chana: { email: 'chana@example.com', name: 'חנה רוזנברג' },
  rivka: { email: 'rivka@example.com', name: 'רבקה פרידמן' }, // dev team lead
  leah: { email: 'leah@example.com', name: 'לאה שפירא' }, // developer
  tova: { email: 'tova@example.com', name: 'טובה וייס' }, // QA
} as const;
type DemoUserKey = keyof typeof DEMO_USERS;

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
/** Moment at hh:mm Israel winter time (UTC+2). Off by one hour in summer — fine for demo data. */
const il = (offset: number, hh: number, mm = 0) => at(offset, hh - 2, mm);
/** Day offset for week `w` (0 = the coming week) and weekday: -1 Sunday, 0 Monday ... 3 Thursday */
const wk = (w: number, weekday: number) => w * 7 + weekday;

// Yahrzeits (ימי פטירה) of Gedolei Yisrael — Hebrew date + the Gregorian dates in 5787 and 5788.
// 5787 is a leap year: Rav Moshe Feinstein passed away in Adar II, so it is 13 Adar II there.
const YAHRZEITS: { name: string; hebrewDate: string; dates: string[] }[] = [
  { name: 'רבי עקיבא איגר', hebrewDate: 'י״ג בתשרי', dates: ['2026-09-24', '2027-10-14'] },
  { name: 'הגאון מווילנא', hebrewDate: 'י״ט בתשרי', dates: ['2026-09-30', '2027-10-20'] },
  { name: 'החתם סופר', hebrewDate: 'כ״ה בתשרי', dates: ['2026-10-06', '2027-10-26'] },
  { name: 'הרב עובדיה יוסף', hebrewDate: 'ג׳ בחשוון', dates: ['2026-10-14', '2027-11-03'] },
  { name: 'החזון איש', hebrewDate: 'ט״ו בחשוון', dates: ['2026-10-26', '2027-11-15'] },
  { name: 'הרב שך', hebrewDate: 'ט״ז בחשוון', dates: ['2026-10-27', '2027-11-16'] },
  { name: 'רבי אהרן קוטלר', hebrewDate: 'ב׳ בכסלו', dates: ['2026-11-12', '2027-12-02'] },
  { name: 'הרמב״ם', hebrewDate: 'כ׳ בטבת', dates: ['2026-12-30', '2028-01-19'] },
  { name: 'רבי משה פיינשטיין', hebrewDate: 'י״ג באדר (בשנה מעוברת: אדר ב׳)', dates: ['2027-03-22', '2028-03-11'] },
  { name: 'הבית יוסף', hebrewDate: 'י״ג בניסן', dates: ['2027-04-20', '2028-04-09'] },
  { name: 'רבי מאיר בעל הנס', hebrewDate: 'י״ד באייר', dates: ['2027-05-21', '2028-05-10'] },
  { name: 'רבי שמעון בר יוחאי', hebrewDate: 'י״ח באייר (ל״ג בעומר)', dates: ['2027-05-25', '2028-05-14'] },
  { name: 'הרמ״א', hebrewDate: 'י״ח באייר (ל״ג בעומר)', dates: ['2027-05-25', '2028-05-14'] },
  { name: 'הרמח״ל', hebrewDate: 'כ״ו באייר', dates: ['2027-06-02', '2028-05-22'] },
  { name: 'האור החיים הקדוש', hebrewDate: 'ט״ו בתמוז', dates: ['2027-07-20', '2028-07-09'] },
  { name: 'הרב אלישיב', hebrewDate: 'כ״ח בתמוז', dates: ['2027-08-02', '2028-07-22'] },
  { name: 'רש״י', hebrewDate: 'כ״ט בתמוז', dates: ['2027-08-03', '2028-07-23'] },
  { name: 'האריז״ל', hebrewDate: 'ה׳ באב', dates: ['2027-08-08', '2028-07-28'] },
  { name: 'הסטייפלר', hebrewDate: 'כ״ג באב', dates: ['2027-08-26', '2028-08-15'] },
  { name: 'החפץ חיים', hebrewDate: 'כ״ד באלול', dates: ['2027-09-26', '2028-09-15'] },
];

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

type ReminderSeed = {
  boardId: string;
  title: string;
  description?: string;
  remindAt: Date;
  audience?: 'BOARD' | 'SELECTED';
  createdById: string;
  recipients?: string[];
};

async function main() {
  const emails = Object.values(DEMO_USERS).map((u) => u.email);
  await prisma.user.deleteMany({ where: { email: { in: emails } } });

  const passwordHash = await hashPassword(password!);
  const created = await Promise.all(
    (Object.keys(DEMO_USERS) as DemoUserKey[]).map(async (key) => {
      const user = await prisma.user.create({ data: { ...DEMO_USERS[key], passwordHash } });
      return [key, user] as const;
    }),
  );
  const u = Object.fromEntries(created) as Record<DemoUserKey, (typeof created)[number][1]>;
  const { dana, noa, yael, miriam, sara, esti, chana, rivka, leah, tova } = u;

  const shared = (ownerId: string, isOpen: boolean, memberIds: string[]) => ({
    visibility: 'SHARED' as const,
    isOpen,
    shareToken: newShareToken(),
    ownerId,
    members: { create: memberIds.map((userId) => ({ userId })) },
  });

  // ---------- Boards ----------
  // 1) PRIVATE board — only Dana sees it
  const privateBoard = await prisma.board.create({
    data: { name: 'My personal tasks', description: 'Private board of Dana', visibility: 'PRIVATE', shareToken: newShareToken(), ownerId: dana.id },
  });

  // 2) SHARED + OPEN — owner Dana, members Noa and Yael can edit
  const projectBoard = await prisma.board.create({
    data: { name: 'Final project', description: 'Team board for the React final project', ...shared(dana.id, true, [noa.id, yael.id]) },
  });

  // 3) SHARED + CLOSED — owner Yael; Dana and Noa can only view
  const artBoard = await prisma.board.create({
    data: { name: 'Art class', description: 'Closed board: members view only', ...shared(yael.id, false, [dana.id, noa.id]) },
  });

  // 4) SHARED + CLOSED — the seminary secretary manages the exam schedule; teachers and students view only
  const examsBoard = await prisma.board.create({
    data: {
      name: 'לוח מבחנים – סמינר וולף',
      description: 'מועדי המבחנים והגשות העבודות. מתעדכן על ידי המזכירות בלבד; המורות והתלמידות צופות.',
      ...shared(miriam.id, false, [sara.id, esti.id, noa.id]),
    },
  });

  // 5) SHARED + OPEN — yahrzeits of Gedolei Yisrael; every member may add and update
  const yahrzeitBoard = await prisma.board.create({
    data: {
      name: 'יארצייטים של גדולי ישראל',
      description: 'ימי הפטירה של גדולי ישראל לאורך השנה. כל החברות בלוח יכולות להוסיף ולעדכן.',
      ...shared(chana.id, true, [dana.id, yael.id, esti.id, miriam.id]),
    },
  });

  // 6) SHARED + OPEN — software company dev team
  const devBoard = await prisma.board.create({
    data: {
      name: 'צוות פיתוח – אפליקציית הזמנות',
      description: 'הספרינט הנוכחי של צוות הפיתוח: פגישות, פיתוח, בדיקות ושחרור גרסה.',
      ...shared(rivka.id, true, [leah.id, tova.id, dana.id]),
    },
  });

  // 7) SHARED + OPEN — building committee
  const buildingBoard = await prisma.board.create({
    data: {
      name: 'ועד הבית',
      description: 'משימות ועד הבית: גבייה, תחזוקה ואסיפות דיירים.',
      ...shared(yael.id, true, [chana.id, noa.id]),
    },
  });

  // 8) PRIVATE — Miriam's own tasks
  const miriamBoard = await prisma.board.create({
    data: { name: 'משימות אישיות', description: 'הלוח הפרטי של מרים', visibility: 'PRIVATE', shareToken: newShareToken(), ownerId: miriam.id },
  });

  // ---------- Tasks ----------
  // Note: no two NOT-DONE timed tasks of the same user overlap (the API would reject that) — across ALL boards.
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

    // exams board (closed, owner Miriam — the secretary)
    { boardId: examsBoard.id, title: 'בוחן בדקדוק', description: 'כיתות י״ב. הבוחן התקיים, הציונים הוזנו.', status: 'DONE', dueDate: day(wk(-1, 1)), createdById: miriam.id },
    { boardId: examsBoard.id, title: 'ישיבת מורות – תיאום מועדי המבחנים', startAt: il(wk(0, 1), 14), endAt: il(wk(0, 1), 15), createdById: miriam.id, assignees: [miriam.id, sara.id] },
    { boardId: examsBoard.id, title: 'מבחן בחומש', description: 'כיתות י״ב. החומר לפי הדף שחולק בכיתה.', priority: 'HIGH', dueDate: day(wk(1, -1)), createdById: miriam.id },
    { boardId: examsBoard.id, title: 'השגחה במבחן בחומש', description: 'אולם 3', startAt: il(wk(1, -1), 9), endAt: il(wk(1, -1), 11), createdById: miriam.id, assignees: [sara.id] },
    { boardId: examsBoard.id, title: 'מבחן בנביא', description: 'כיתות י״ב', priority: 'HIGH', dueDate: day(wk(1, 1)), createdById: miriam.id },
    { boardId: examsBoard.id, title: 'בוחן באנגלית', description: 'כל הכיתות. הבנת הנקרא.', dueDate: day(wk(1, 3)), createdById: miriam.id },
    { boardId: examsBoard.id, title: 'מבחן בדינים', description: 'כיתות י״ב', priority: 'HIGH', dueDate: day(wk(2, 0)), createdById: miriam.id },
    { boardId: examsBoard.id, title: 'מבחן בהיסטוריה', dueDate: day(wk(2, 2)), createdById: miriam.id },
    { boardId: examsBoard.id, title: 'מבחן במתמטיקה', description: 'מגמת הנדסת תוכנה', priority: 'HIGH', dueDate: day(wk(3, -1)), createdById: miriam.id },
    { boardId: examsBoard.id, title: 'מבחן מעשי במחשבים', description: 'כיתות י״ג, במעבדת המחשבים', priority: 'HIGH', dueDate: day(wk(3, 1)), createdById: miriam.id },
    { boardId: examsBoard.id, title: 'הגשת עבודה בדידקטיקה', description: 'מסלול הוראה. הגשה למזכירות עד השעה 14:00.', dueDate: day(wk(3, 3)), createdById: miriam.id },
    { boardId: examsBoard.id, title: 'מבחן בפסיכולוגיה התפתחותית', description: 'מסלול הוראה', dueDate: day(wk(4, 0)), createdById: miriam.id },
    { boardId: examsBoard.id, title: 'פרסום מועדי ב׳', priority: 'LOW', createdById: miriam.id },
    { boardId: examsBoard.id, title: 'עדכון מערכת המבחנים לסמסטר ב׳', status: 'IN_PROGRESS', createdById: miriam.id },
    { boardId: examsBoard.id, title: 'הכנת שאלון מועד ב׳ בנביא', description: 'משימה פרטית: רק המזכירה והמורה רואות אותה.', audience: 'SELECTED', priority: 'HIGH', dueDate: day(wk(2, 3)), createdById: miriam.id, assignees: [sara.id] },

    // dev team board (open, owner Rivka). Israeli work week: Sunday–Thursday.
    ...[-1, 0, 1, 2, 3].map((weekday): TaskSeed => ({
      boardId: devBoard.id, title: 'סטנדאפ יומי', priority: 'LOW', startAt: il(wk(0, weekday), 9), endAt: il(wk(0, weekday), 9, 15), createdById: rivka.id, assignees: [rivka.id, leah.id, tova.id],
    })),
    { boardId: devBoard.id, title: 'הקמת סביבת Staging', status: 'DONE', startAt: il(wk(-1, 1), 10), endAt: il(wk(-1, 1), 12), createdById: rivka.id, assignees: [rivka.id] },
    { boardId: devBoard.id, title: 'תיקון באג בטופס ההרשמה', status: 'DONE', priority: 'HIGH', createdById: tova.id, assignees: [leah.id] },
    { boardId: devBoard.id, title: 'תכנון ספרינט 14', priority: 'HIGH', startAt: il(wk(0, -1), 10), endAt: il(wk(0, -1), 12), createdById: rivka.id, assignees: [rivka.id, leah.id, tova.id] },
    { boardId: devBoard.id, title: 'Code review – מסך התשלום', startAt: il(0, 10), endAt: il(0, 11), createdById: leah.id, assignees: [rivka.id, leah.id] },
    { boardId: devBoard.id, title: 'פיתוח API להזמנות', description: 'נקודות קצה ליצירה, ביטול ושליפת הזמנות', status: 'IN_PROGRESS', priority: 'HIGH', startAt: il(0, 11, 30), endAt: il(0, 15), createdById: rivka.id, assignees: [leah.id] },
    { boardId: devBoard.id, title: 'שיחת משוב אישית', audience: 'SELECTED', startAt: il(1, 13), endAt: il(1, 13, 30), createdById: rivka.id, assignees: [leah.id] },
    { boardId: devBoard.id, title: 'הגשת אפיון למסך החיפוש', dueDate: day(1), createdById: rivka.id, assignees: [tova.id] },
    { boardId: devBoard.id, title: 'בדיקות רגרסיה לפני שחרור', priority: 'HIGH', startAt: il(2, 10), endAt: il(2, 13), createdById: rivka.id, assignees: [tova.id] },
    { boardId: devBoard.id, title: 'עדכון תיעוד ה-API', priority: 'LOW', dueDate: day(2), createdById: leah.id, assignees: [leah.id] },
    { boardId: devBoard.id, title: 'רטרוספקטיבה', startAt: il(3, 11), endAt: il(3, 12), createdById: rivka.id, assignees: [rivka.id, leah.id, tova.id] },
    { boardId: devBoard.id, title: 'שחרור גרסה 2.4 לפרודקשן', priority: 'HIGH', startAt: il(3, 14), endAt: il(3, 15), createdById: rivka.id, assignees: [rivka.id, leah.id] },
    { boardId: devBoard.id, title: 'באג: ההתחברות נכשלת בדפדפן Safari', priority: 'HIGH', createdById: tova.id, assignees: [leah.id] },
    { boardId: devBoard.id, title: 'כתיבת בדיקות יחידה למודול התשלומים', status: 'IN_PROGRESS', createdById: rivka.id, assignees: [tova.id] },
    { boardId: devBoard.id, title: 'שדרוג גרסת React', priority: 'LOW', createdById: leah.id },

    // building committee board (open, owner Yael)
    { boardId: buildingBoard.id, title: 'החלפת נורות בחניון', status: 'DONE', createdById: yael.id, assignees: [chana.id] },
    { boardId: buildingBoard.id, title: 'אסיפת דיירים', description: 'בלובי. על סדר היום: שיפוץ חדר המדרגות.', startAt: il(wk(0, 1), 20), endAt: il(wk(0, 1), 21), createdById: yael.id, assignees: [yael.id, chana.id] },
    { boardId: buildingBoard.id, title: 'ניקיון חדר המדרגות', priority: 'LOW', dueDate: day(wk(0, 2)), createdById: yael.id },
    { boardId: buildingBoard.id, title: 'גביית ועד בית לחודש הבא', dueDate: day(wk(0, 3)), createdById: yael.id, assignees: [chana.id] },
    { boardId: buildingBoard.id, title: 'הזמנת טכנאי למעלית', priority: 'HIGH', createdById: noa.id, assignees: [yael.id] },

    // Miriam's private board
    { boardId: miriamBoard.id, title: 'שיעור ערב', startAt: il(wk(0, 0), 19), endAt: il(wk(0, 0), 20), createdById: miriam.id },
    { boardId: miriamBoard.id, title: 'קניות לשבת', dueDate: day(wk(0, 3)), createdById: miriam.id },
    { boardId: miriamBoard.id, title: 'לחדש את המנוי בספרייה', priority: 'LOW', createdById: miriam.id },
  ];

  // yahrzeit board: the dates from about two months ago up to a year ahead; past ones are marked DONE
  const now = new Date();
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const DAY_MS = 24 * 60 * 60 * 1000;
  for (const y of YAHRZEITS) {
    for (const iso of y.dates) {
      const date = new Date(`${iso}T00:00:00Z`);
      if (date.getTime() < today - 60 * DAY_MS || date.getTime() > today + 365 * DAY_MS) continue;
      tasks.push({
        boardId: yahrzeitBoard.id,
        title: `יארצייט ${y.name}`,
        description: y.hebrewDate,
        status: date.getTime() < today ? 'DONE' : 'TODO',
        dueDate: date,
        createdById: chana.id,
      });
    }
  }
  tasks.push(
    { boardId: yahrzeitBoard.id, title: 'לחלק לימוד משניות לעילוי נשמת החפץ חיים', status: 'IN_PROGRESS', createdById: esti.id, assignees: [esti.id] },
    { boardId: yahrzeitBoard.id, title: 'להוסיף יארצייטים נוספים ללוח', priority: 'LOW', createdById: dana.id },
  );

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

  // ---------- Reminders ----------
  const reminders: ReminderSeed[] = [
    { boardId: projectBoard.id, title: 'Send the weekly update', remindAt: at(0, 9, 45), createdById: dana.id },
    { boardId: projectBoard.id, title: 'Remind Noa about the demo', remindAt: at(1, 8), audience: 'SELECTED', createdById: dana.id, recipients: [noa.id] },
    { boardId: privateBoard.id, title: 'Call grandma', remindAt: at(2, 17), createdById: dana.id },
    { boardId: artBoard.id, title: 'Exhibition registration closes', remindAt: at(4, 12), createdById: yael.id },

    { boardId: examsBoard.id, title: 'חלוקת טפסי המבחן למשגיחות', remindAt: il(wk(1, -1), 8, 30), createdById: miriam.id },
    { boardId: examsBoard.id, title: 'הגשת ציונים למזכירות', description: 'ציוני המבחנים בחומש ובנביא', remindAt: il(wk(2, 3), 12), createdById: miriam.id },
    { boardId: devBoard.id, title: 'מילוי דוח שעות חודשי', remindAt: il(3, 15, 30), createdById: rivka.id },
    { boardId: devBoard.id, title: 'להכין דמו ללקוח', remindAt: il(2, 9, 30), audience: 'SELECTED', createdById: rivka.id, recipients: [leah.id] },
    { boardId: buildingBoard.id, title: 'לתלות מודעה על אסיפת הדיירים', remindAt: il(wk(0, -1), 18), createdById: yael.id },
  ];
  for (const r of reminders) {
    await prisma.reminder.create({
      data: {
        boardId: r.boardId,
        title: r.title,
        description: r.description ?? null,
        remindAt: r.remindAt,
        audience: r.audience ?? 'BOARD',
        createdById: r.createdById,
        recipients: { create: (r.recipients ?? []).map((userId) => ({ userId })) },
      },
    });
  }

  console.log('Seed completed.');
  console.log(`Users (password: ${isProduction ? '<SEED_PASSWORD>' : password}):`);
  console.log('  dana@example.com    — owner of "My personal tasks" (PRIVATE) and "Final project" (SHARED, open)');
  console.log('  noa@example.com     — member (can edit) of "Final project", member (view only) of "Art class" and the exams board');
  console.log('  yael@example.com    — owner of "Art class" (SHARED, closed) and the building committee board');
  console.log('  miriam@example.com  — seminary secretary: owner of the exams board (SHARED, closed)');
  console.log('  sara@example.com    — teacher: member (view only) of the exams board');
  console.log('  esti@example.com    — student: member of the exams board (view) and the yahrzeits board (edit)');
  console.log('  chana@example.com   — owner of the yahrzeits board (SHARED, open)');
  console.log('  rivka@example.com   — dev team lead: owner of the dev team board (SHARED, open)');
  console.log('  leah@example.com    — developer, tova@example.com — QA: members of the dev team board');
  console.log(`Demo week starts on ${monday.toISOString().slice(0, 10)} (UTC). ${tasks.length} tasks, ${reminders.length} reminders.`);
  console.log(`Share link token of "Final project": ${projectBoard.shareToken}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
