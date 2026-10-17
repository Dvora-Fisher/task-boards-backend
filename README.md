# Task Boards API — שרת לניהול לוחות משימות ותזכורות

שרת REST מלא עבור אפליקציית React לניהול לוחות משימות ותזכורות, אישיים ומשותפים.

| נושא | בחירה |
|---|---|
| שפה וסביבה | Node.js 22 LTS, TypeScript (strict), Express 5 |
| מסד נתונים | PostgreSQL + Prisma ORM 7 |
| אימות משתמשים | JWT (Bearer Token) + Session בשרת (אפשר "לבטל" Token ב־logout) |
| סיסמאות | argon2id |
| ולידציה | Zod 4 |
| תיעוד | Swagger UI ב־`/api-docs` (OpenAPI 3.1), וגם `docs/openapi.json` |
| בדיקות | Vitest + Supertest מול PostgreSQL אמיתי (78 בדיקות) |

📄 **קבצים חשובים נוספים**
- [START-HERE.md](START-HERE.md) — העלאה ל־GitHub, יצירת מסד נתונים ב־Neon ופריסה ב־Render, צעד אחר צעד.
- [FRONTEND-API-GUIDE.md](FRONTEND-API-GUIDE.md) — כל מה שצריך כדי לבנות את צד ה־React: מסכים, קריאות, JSON, טיפוסי TypeScript.

---

## 1. דרישות מוקדמות (Windows)

1. **Node.js 22 LTS** — מ־<https://nodejs.org> (בדיקה: `node -v` צריך להציג `v22.x`).
2. **PostgreSQL** — אחת משתי האפשרויות:
   - **Docker Desktop** (הכי פשוט): הפרויקט כולל `docker-compose.yml` שמרים PostgreSQL 17 עם שני מסדי נתונים (רגיל ובדיקות).
   - **התקנה רגילה** של PostgreSQL מ־<https://www.postgresql.org/download/windows/>.
3. **Git** (מומלץ) — <https://git-scm.com>.

## 2. התקנה והרצה מקומית (PowerShell)

```powershell
# בתוך תיקיית הפרויקט
npm install

# יצירת קובץ ההגדרות המקומי
Copy-Item .env.example .env
```

פתחי את `.env` ושני לפחות את `JWT_SECRET` למחרוזת אקראית ארוכה. אפשר ליצור כזאת כך:

```powershell
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

### הפעלת PostgreSQL

**אפשרות א — Docker (מומלץ):**

```powershell
docker compose up -d
```

זה מרים PostgreSQL על פורט **5433**, עם המסדים `task_boards` ו־`task_boards_test`.
הכתובות ב־`.env.example` כבר מתאימות לזה.

**אפשרות ב — PostgreSQL מותקן:** צרי שני מסדי נתונים (למשל ב־pgAdmin): `task_boards` ו־`task_boards_test`,
ועדכני ב־`.env` את `DATABASE_URL` ו־`TEST_DATABASE_URL`, למשל:
`postgresql://postgres:YOUR_PASSWORD@localhost:5432/task_boards`

### יצירת הטבלאות, נתוני דוגמה והרצה

```powershell
npx prisma migrate deploy   # יוצר את כל הטבלאות לפי prisma/migrations
npm run db:seed             # נתוני דוגמה (3 משתמשים, 3 לוחות, משימות ותזכורות)
npm run dev                 # מצב פיתוח עם רענון אוטומטי
```

פתחי בדפדפן:
- בדיקת בריאות: <http://localhost:4000/api/health>
- Swagger: <http://localhost:4000/api-docs>

**משתמשי הדוגמה** (סיסמה: `Demo1234!`, אפשר לשנות דרך `SEED_PASSWORD`):

| אימייל | תפקיד בנתוני הדוגמה |
|---|---|
| `dana@example.com` | בעלת "My personal tasks" (פרטי) ו־"Final project" (משותף, **פתוח**). חברה (צפייה בלבד) ב־"Art class" |
| `noa@example.com` | חברה ב־"Final project" (יכולה לערוך), חברה ב־"Art class" (צפייה בלבד) |
| `yael@example.com` | בעלת "Art class" (משותף, **סגור**), חברה ב־"Final project" |

הנתונים כוללים משימות עם שעות (כולל זמנים חופפים בין משתמשים שונים), משימות עם תאריך בלבד, משימות בלי תאריך, משימה שהושלמה, משימה פרטית ותזכורות — כולם בשבוע הקרוב, כדי שלוח השנה והצעות השיבוץ יראו נתונים.

## 3. כל הפקודות

| פקודה | מה היא עושה |
|---|---|
| `npm run dev` | הרצה במצב פיתוח (tsx watch) |
| `npm run build` | `prisma generate` + קומפילציה ל־`dist/` |
| `npm start` | הרצת הגרסה הבנויה |
| `npm run start:prod` | `prisma migrate deploy` ואז הפעלה (משמש את Render) |
| `npm run typecheck` | בדיקת TypeScript בלי לבנות |
| `npm test` | כל הבדיקות האוטומטיות (צריך `TEST_DATABASE_URL`) |
| `npm run db:migrate` | יצירת Migration חדשה אחרי שינוי ב־`schema.prisma` (פיתוח בלבד) |
| `npm run db:deploy` | החלת Migrations קיימות |
| `npm run db:seed` | נתוני דוגמה |
| `npm run db:reset` | ⚠️ מחיקת כל הנתונים ויצירה מחדש |
| `npm run docs:generate` | כתיבת `docs/openapi.json` מחדש מתוך הקוד |

## 4. בדיקות

```powershell
npm test
```

הבדיקות רצות מול מסד הנתונים שב־`TEST_DATABASE_URL` (**כל המידע בו נמחק בזמן הבדיקות!**). הן מכסות:
התחברות תקינה ושגויה, Token חסר / מזויף / שפג תוקפו, התנתקות וביטול Session, הרשאות בעלים / חבר בלוח פתוח / חבר בלוח סגור / זר,
CRUD ללוחות, משימות ותזכורות, ולידציה, חיפוש וסינון, עימוד, הסתרת לוחות ומשימות פרטיים, הסרת חבר מלוח,
התנגשויות זמנים (כולל שתי בקשות מקבילות), לוח שנה, הצעות שיבוץ (כולל טווח מלא ותזכורות/משימות עם תאריך בלבד שלא חוסמות),
תקינות Prisma (schema + migrations), תקינות OpenAPI 3.1, וכיסוי של כל נתיב בשרת ב־Swagger.

## 5. מבנה הפרויקט

```
backend-project/
├── prisma/
│   ├── schema.prisma          # מודל הנתונים
│   ├── migrations/            # Migrations (כולל CHECK constraints לזמנים)
│   └── seed.ts                # נתוני דוגמה
├── src/
│   ├── server.ts              # נקודת הכניסה — מאזין לפורט
│   ├── app.ts                 # הרכבת Express: CORS, Helmet, Swagger, Routes, שגיאות
│   ├── config/env.ts          # קריאה ובדיקה של משתני הסביבה (Zod)
│   ├── db/prisma.ts           # חיבור Prisma (adapter-pg)
│   ├── auth/                  # jwt.ts (חתימה/אימות), password.ts (argon2)
│   ├── authorization/         # boardAccess.ts — כל כללי ההרשאות במקום אחד
│   ├── middleware/            # authenticate, errorHandler, rateLimit
│   ├── validation/            # סכמות Zod לכל בקשה
│   ├── routes/index.ts        # כל הנתיבים
│   ├── controllers/           # קבלת הבקשה → ולידציה → service → תשובה
│   ├── services/              # הלוגיקה העסקית (+ availability.ts — אלגוריתם הזמנים)
│   ├── docs/openapi.ts        # מסמך OpenAPI 3.1 (מקור ל־Swagger)
│   ├── utils/                 # AppError, תשובות, עימוד, תאריכים, המרה ל־JSON
│   └── types/express.d.ts
├── tests/                     # בדיקות Vitest
├── docs/openapi.json          # קובץ OpenAPI שנוצר אוטומטית
├── scripts/                   # generate-openapi.ts, init-test-db.sql
├── docker-compose.yml         # PostgreSQL מקומי (לא חובה)
├── render.yaml                # הגדרות פריסה ל־Render
├── .env.example               # דוגמה למשתני סביבה (בלי סודות אמיתיים)
├── README.md / START-HERE.md / FRONTEND-API-GUIDE.md
└── package.json, tsconfig*.json, prisma.config.ts, vitest.config.ts
```

## 6. החלטות ארכיטקטורה (בקצרה)

- **JWT + Session בשרת**: ה־JWT מכיל מזהה Session. כל בקשה בודקת שה־Session עדיין פעיל — כך `logout` מבטל את ה־Token מיד, ולא רק אחרי שפג תוקפו.
  נבחר Bearer Token (ולא Cookie) כי הוא פשוט ב־React, עובד מצוין כשהשרת והאתר בכתובות שונות בענן, ולא דורש הגנת CSRF.
- **שני סוגי לוחות**: `PRIVATE` (רק הבעלים) ו־`SHARED` (בעלים + חברים). בלוח משותף `isOpen` קובע אם החברים יכולים לערוך או רק לצפות.
- **קישור שיתוף**: לכל לוח `shareToken` סודי. משתמש מחובר שפותח את הקישור הופך לחבר בלוח. יצירת קישור חדש מבטלת את הישן.
- **משימה/תזכורת פרטית** (`audience: SELECTED`): גלויה רק ליוצר ולמשתמשים שנבחרו — גם בעל הלוח לא רואה אותה.
- **תאריכים**: נשמרים ב־UTC (`timestamptz`). משימה "עם תאריך בלבד" נשמרת כעמודת `DATE` (`YYYY-MM-DD`) כדי שלא "תזוז" יום בגלל אזורי זמן.
- **התנגשויות זמנים**: משימה עם שעות שאינה DONE חוסמת את הזמן של המשויכים אליה (או של היוצר, אם אין משויכים) — בכל הלוחות.
  הבדיקה והשמירה מתבצעות בטרנזקציה אחת עם `pg_advisory_xact_lock` לכל משתמש, ולכן גם בקשות מקבילות לא יוצרות חפיפה.
  משימות עם תאריך בלבד, משימות בלי תאריך, משימות DONE ותזכורות — לא חוסמות אף פעם.
- **404 במקום 403** ללוח שאין לך גישה אליו — כדי לא לחשוף שהוא קיים. 403 מוחזר כשאת רואה את הלוח אבל אין לך הרשאה לפעולה.
- **ללא בינה מלאכותית**: אלגוריתם השיבוץ דטרמיניסטי (מיזוג זמנים תפוסים ומציאת חלונות פנויים).

## 7. פתרון תקלות נפוצות ב־Windows

| תקלה | פתרון |
|---|---|
| `npm` / `npx` חסום: "running scripts is disabled on this system" | ב־PowerShell: `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` ואז לפתוח חלון חדש |
| `unable to get local issuer certificate` בזמן `npm install` / `prisma generate` | אנטי־וירוס או רשת ארגונית מחליפים תעודות. הריצי לפני הפקודה: `$env:NODE_OPTIONS="--use-system-ca"` |
| `Invalid environment variables: JWT_SECRET ...` | חסר `.env` או ש־`JWT_SECRET` קצר מ־32 תווים |
| `Can't reach database server at localhost:5433` | Docker Desktop לא פועל — הפעילי אותו והריצי `docker compose up -d`. בהתקנה רגילה בדקי את הפורט (בד"כ 5432) ב־`DATABASE_URL` |
| `password authentication failed for user "postgres"` | הסיסמה ב־`DATABASE_URL` לא נכונה |
| `database "task_boards_test" does not exist` | צרי אותו (ב־Docker הוא נוצר רק ביצירה הראשונה של ה־volume: `docker compose down -v` ואז `up -d`) |
| `Cannot find module '../generated/prisma/client.js'` | הריצי `npx prisma generate` (או `npm run build`) |
| `EADDRINUSE: address already in use :::4000` | השרת כבר רץ בחלון אחר, או שני את `PORT` ב־`.env` |
| שגיאת `EPERM` / קובץ נעול בזמן `npm install` | סגרי את VS Code / השרת שרץ ונסי שוב |
| `TEST_DATABASE_URL must be different from DATABASE_URL` | הגנה מכוונת — הבדיקות מוחקות נתונים. השתמשי במסד נפרד לבדיקות |
