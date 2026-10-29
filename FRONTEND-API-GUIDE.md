# מדריך API לצד ה־React

המסמך הזה מכיל את כל מה שצריך כדי לבנות את צד הלקוח; בלי לקרוא את קוד השרת.
התיעוד האינטראקטיבי המלא נמצא ב־Swagger (`/api-docs`); והקובץ `docs/openapi.json` מתאר את אותו חוזה.

---

## 1. כתובת הבסיס (Base URL)

| סביבה | כתובת |
|---|---|
| פיתוח מקומי | `http://localhost:4000` |
| ענן (Render) | `https://<שם-השירות>.onrender.com` |

כל הנתיבים מתחילים ב־`/api`. ב־React מומלץ לשמור את הכתובת במשתנה סביבה. למשל ב־Vite; בקובץ `.env` של הלקוח:

```
VITE_API_URL=http://localhost:4000
```

> כתובת ה־React (למשל `http://localhost:5173`) חייבת להופיע ב־`CORS_ORIGINS` של השרת.

## 2. כללים קבועים בכל ה־API

- **JSON בלבד**: כל בקשה עם גוף נשלחת עם `Content-Type: application/json`.
- **שמות שדות** ב־camelCase. **מזהים** הם UUID (מחרוזת).
- **תאריך ושעה** בפורמט ISO 8601 עם אזור זמן. השרת מחזיר תמיד UTC; למשל `"2026-11-02T09:00:00.000Z"`.
  - בשליחה אפשר גם עם היסט; למשל `"2026-11-02T11:00:00+02:00"`; אבל **חייב** אזור זמן.
  - ב־JS הכי פשוט: `new Date(localValue).toISOString()`.
- **תאריך בלבד** (משימה לכל היום): `"YYYY-MM-DD"`; למשל `"2026-11-02"`.
- **תשובת הצלחה**: `{ "success": true; "data": ... }`
- **תשובת שגיאה**: `{ "success": false; "error": { "code": "..."; "message": "..."; "details"?: ... } }`
- **רשימות** מוחזרות עם עימוד: `data = { items: [...]; pagination: { page; pageSize; total; totalPages } }`.
  הפרמטרים הם `page` (מתחיל ב־1) ו־`pageSize` (ברירת מחדל 20; מקסימום 100).
- **מחיקה** מחזירה `204 No Content`; בלי גוף.

## 3. אימות משתמשים (Authentication)

השרת משתמש ב־**JWT Bearer Token**; לא ב־Cookies.

1. `POST /api/auth/login` (או `register`) מחזיר `accessToken`.
2. שומרים אותו; למשל ב־`localStorage`.
3. בכל בקשה מוגנת שולחים את הכותרת `Authorization: Bearer <accessToken>`.
4. `POST /api/auth/logout` מבטל את ה־Session בשרת. אחרי זה ה־Token כבר לא עובד; ומוחקים אותו גם בלקוח.
5. ה־Token תקף 24 שעות (`expiresAt`). אחרי זה השרת יחזיר `401`; והלקוח צריך לשלוח למסך ההתחברות.

> **למה לא Cookies?** מפני שהשרת והאתר יושבים בכתובות שונות בענן; ודפדפנים חוסמים יותר ויותר Cookies "חוצי אתרים".
> Bearer Token עובד תמיד; ולא דורש הגנת CSRF. לכן **אין צורך** ב־`credentials: "include"`.

### פונקציית עזר מוכנה ל־fetch

```ts
// src/api/client.ts
const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:4000';
const TOKEN_KEY = 'accessToken';

export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY);
  set: (t: string) => localStorage.setItem(TOKEN_KEY; t);
  clear: () => localStorage.removeItem(TOKEN_KEY);
};

export class ApiError extends Error {
  constructor(public status: number; public code: string; message: string; public details?: unknown) {
    super(message);
  }
}

export async function api<T>(path: string; options: { method?: string; body?: unknown; query?: Record<string; string | number | boolean | undefined> } = {}): Promise<T> {
  const url = new URL(`/api${path}`; API_URL);
  for (const [k; v] of Object.entries(options.query ?? {})) if (v !== undefined && v !== '') url.searchParams.set(k; String(v));

  const headers: Record<string; string> = {};
  const token = tokenStore.get();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';

  const res = await fetch(url; {
    method: options.method ?? 'GET';
    headers;
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined;
  });

  if (res.status === 204) return undefined as T;
  const json = await res.json();
  if (!json.success) {
    if (res.status === 401) tokenStore.clear(); // לשלוח את המשתמשת למסך התחברות
    throw new ApiError(res.status; json.error.code; json.error.message; json.error.details);
  }
  return json.data as T;
}
```

דוגמאות שימוש:

```ts
const { accessToken; user } = await api<AuthResult>('/auth/login'; { method: 'POST'; body: { email; password } });
tokenStore.set(accessToken);

const boards = await api<Paginated<Board>>('/boards'; { query: { search: 'project'; page: 1 } });
```

## 4. טיפוסי TypeScript לצד הלקוח

```ts
export type UUID = string;
export type ISODateTime = string; // "2026-11-02T09:00:00.000Z"
export type ISODate = string;     // "2026-11-02"

export type BoardVisibility = 'PRIVATE' | 'SHARED';
export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'DONE';
export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH';
export type Audience = 'BOARD' | 'SELECTED';
export type ScheduleType = 'NONE' | 'DATE' | 'TIMED';
export type EventType = 'TASK' | 'REMINDER';

export interface Pagination { page: number; pageSize: number; total: number; totalPages: number }
export interface Paginated<T> { items: T[]; pagination: Pagination }

export interface User { id: UUID; email: string; name: string; createdAt: ISODateTime }
export interface UserSummary { id: UUID; name: string; email: string }

export interface AuthResult { user: User; accessToken: string; tokenType: 'Bearer'; expiresAt: ISODateTime }

export interface BoardAccess {
  isOwner: boolean;   // אני הבעלים
  isMember: boolean;  // אני חברה בלוח משותף
  canView: boolean;
  canEdit: boolean;   // מותר להוסיף/לערוך/למחוק משימות ותזכורות
  canManage: boolean; // מותר לשנות הגדרות; קישור וחברים (בעלים בלבד)
}

export interface Board {
  id: UUID;
  name: string;
  description: string | null;
  visibility: BoardVisibility;
  isOpen: boolean;            // לוח משותף: true = החברים עורכים; false = רק צופים
  owner: UserSummary;
  memberCount: number;        // לא כולל הבעלים
  shareToken: string | null;  // מוחזר רק לבעלים של לוח משותף
  myAccess: BoardAccess;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface Member { user: UserSummary; isOwner: boolean; joinedAt: ISODateTime }

export interface Task {
  id: UUID;
  boardId: UUID;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  audience: Audience;
  scheduleType: ScheduleType;
  dueDate: ISODate | null;        // משימה לכל היום
  startAt: ISODateTime | null;    // משימה עם שעות
  endAt: ISODateTime | null;
  createdBy: UserSummary | null;
  assignees: UserSummary[];
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface Reminder {
  id: UUID;
  boardId: UUID;
  title: string;
  description: string | null;
  remindAt: ISODateTime;
  audience: Audience;
  createdBy: UserSummary | null;
  recipients: UserSummary[];
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface CalendarEvent {
  type: EventType;
  id: UUID;
  boardId: UUID;
  title: string;
  description: string | null;
  allDay: boolean;               // משימה עם תאריך בלבד
  date: ISODate | null;          // היום של אירוע allDay
  startAt: ISODateTime | null;   // התחלת משימה / מועד תזכורת
  endAt: ISODateTime | null;     // סוף משימה (null לתזכורת)
  blocksTime: boolean;           // רק משימה עם שעות שאינה DONE
  status: TaskStatus | null;     // null לתזכורת
  priority: TaskPriority | null; // null לתזכורת
  audience: Audience;
}

export interface CalendarResponse { from: ISODateTime; to: ISODateTime; events: CalendarEvent[] }
export interface TimeSlot { startAt: ISODateTime; endAt: ISODateTime }

// ---- גופי בקשות ----
export interface RegisterInput { email: string; password: string; name: string }
export interface LoginInput { email: string; password: string }
export interface CreateBoardInput { name: string; description?: string | null; visibility?: BoardVisibility; isOpen?: boolean }
export type UpdateBoardInput = Partial<CreateBoardInput>;
export interface CreateTaskInput {
  title: string;
  description?: string | null;
  status?: TaskStatus;
  priority?: TaskPriority;
  audience?: Audience;
  assigneeIds?: UUID[];
  dueDate?: ISODate | null;
  startAt?: ISODateTime | null;
  endAt?: ISODateTime | null;
}
export type UpdateTaskInput = Partial<CreateTaskInput>;
export interface CreateReminderInput { title: string; description?: string | null; remindAt: ISODateTime; audience?: Audience; recipientIds?: UUID[] }
export type UpdateReminderInput = Partial<CreateReminderInput>;
export interface SchedulingInput { durationMinutes: number; from: ISODateTime; to: ISODateTime; maxSuggestions?: number; assignedUserId?: UUID }

export interface ApiErrorBody { success: false; error: { code: ErrorCode; message: string; details?: unknown } }
export type ErrorCode =
  | 'VALIDATION_ERROR' | 'INVALID_JSON' | 'UNAUTHORIZED' | 'INVALID_TOKEN' | 'INVALID_CREDENTIALS'
  | 'FORBIDDEN' | 'NOT_FOUND' | 'BOARD_NOT_FOUND' | 'TASK_NOT_FOUND' | 'REMINDER_NOT_FOUND'
  | 'USER_NOT_FOUND' | 'MEMBER_NOT_FOUND' | 'EMAIL_TAKEN' | 'ALREADY_MEMBER' | 'BOARD_IS_PRIVATE'
  | 'BOARD_HAS_MEMBERS' | 'CANNOT_ADD_OWNER' | 'CANNOT_REMOVE_OWNER' | 'NOT_A_BOARD_MEMBER'
  | 'TIME_CONFLICT' | 'RATE_LIMITED' | 'DATABASE_UNAVAILABLE' | 'INTERNAL_ERROR';
```

## 5. הרשאות — איך יודעים מה להציג

לכל לוח מוחזר אובייקט `myAccess`. **השתמשי בו כדי להציג או להסתיר כפתורים.** השרת בודק את ההרשאות שוב בכל מקרה.

| מצב | `canView` | `canEdit` | `canManage` |
|---|---|---|---|
| בעלת הלוח (פרטי או משותף) | ✅ | ✅ | ✅ |
| חברה בלוח משותף **פתוח** (`isOpen: true`) | ✅ | ✅ | ❌ |
| חברה בלוח משותף **סגור** (`isOpen: false`) | ✅ | ❌ | ❌ |
| כל אחד אחר | (הלוח לא מופיע — השרת מחזיר 404) | | |

- `canEdit` → להציג "משימה חדשה"; "תזכורת חדשה"; "עריכה" ו"מחיקה".
- `canManage` → להציג "הגדרות לוח"; "חברים"; "קישור שיתוף" ו"מחיקת לוח".
- **משימה או תזכורת פרטית** (`audience: 'SELECTED'`) גלויה רק למי שיצר אותה ולמשתמשים שנבחרו (`assignees` / `recipients`). גם בעלת הלוח לא רואה אותה; והשרת פשוט לא מחזיר אותה.

## 6. אפיון מסכים ← אילו קריאות צריך

| מסך | מה מוצג | קריאות API |
|---|---|---|
| **הרשמה** | שם; אימייל; סיסמה | `POST /auth/register` ← לשמור Token ← מעבר ללוחות |
| **התחברות** | אימייל; סיסמה | `POST /auth/login` |
| **טעינת האפליקציה** | בדיקה אם המשתמשת מחוברת | `GET /auth/me` (אם יש Token). 401 ← מסך התחברות |
| **הלוחות שלי** | רשימת לוחות; חיפוש; סינון (פרטי/משותף; שלי/שותפו איתי); עימוד | `GET /boards?search=&visibility=&role=&page=` |
| **לוח חדש / עריכת לוח** | שם; תיאור; פרטי/משותף; פתוח/סגור | `POST /boards`; `PATCH /boards/{id}`; `DELETE /boards/{id}` |
| **תצוגת לוח — רשימה** | משימות (כולל משימות בלי תאריך); סינון לפי סטטוס/עדיפות/סוג תזמון/טווח תאריכים; חיפוש; "משויך אליי" | `GET /boards/{id}`; `GET /boards/{id}/tasks?...` |
| **טופס משימה** | כותרת; תיאור; סטטוס; עדיפות; סוג תזמון (בלי / תאריך / שעות); כללית/פרטית; בחירת משויכים | `GET /boards/{id}/members` (לרשימת המשתמשים); `POST /boards/{id}/tasks`; `PATCH /tasks/{id}`; `DELETE /tasks/{id}` |
| **תצוגת לוח שנה** | חודש/שבוע: משימות עם שעות; משימות לכל היום ותזכורות (בצבעים שונים) | `GET /boards/{id}/calendar?from=&to=` |
| **הצעות שיבוץ** | משך; טווח חיפוש; עבור מי ← רשימת זמנים פנויים ← בחירה ← שמירה | `POST /boards/{id}/scheduling/suggestions` ← `POST /boards/{id}/tasks` |
| **תזכורות** | רשימה לפי תאריך; טופס (כותרת; תיאור; מועד; כללית/פרטית) | `GET/POST /boards/{id}/reminders`; `PATCH/DELETE /reminders/{id}` |
| **חברי לוח** (בעלים) | רשימה; הוספה לפי אימייל; הסרה; העתקת קישור; יצירת קישור חדש | `GET/POST /boards/{id}/members`; `DELETE /boards/{id}/members/{userId}`; `POST /boards/{id}/share-link` |
| **הצטרפות בקישור** | נתיב React כמו `/join/:shareToken` | (אחרי התחברות) `POST /boards/join/{shareToken}` ← מעבר ללוח |
| **התנתקות** | כפתור | `POST /auth/logout` ← מחיקת ה־Token |

**קישור שיתוף:** הבעלים מקבלת `shareToken` בתוך `Board`. ב־React בונים ממנו קישור; למשל
`${window.location.origin}/join/${board.shareToken}`. מי שפותחת את הקישור מתחברת (אם צריך); ואז React קורא ל־`POST /api/boards/join/{shareToken}`.

## 7. רשימת כל ה־Endpoints

🔒 = דורש `Authorization: Bearer`. כל הנתיבים מתחילים ב־`/api`.

### מערכת ואימות

| Method | נתיב | 🔒 | גוף / פרמטרים | הצלחה |
|---|---|---|---|---|
| GET | `/health` | | — | `200 { status; database; uptimeSeconds; timestamp }` |
| POST | `/auth/register` | | `{ email; password; name }` (סיסמה: 8+ תווים; אות וספרה) | `201 AuthResult` |
| POST | `/auth/login` | | `{ email; password }` | `200 AuthResult` |
| POST | `/auth/logout` | 🔒 | — | `200 { loggedOut: true }` |
| GET | `/auth/me` | 🔒 | — | `200 { user: User }` |

### לוחות וחברים

| Method | נתיב | 🔒 | מי רשאי | גוף / פרמטרים | הצלחה |
|---|---|---|---|---|---|
| GET | `/boards` | 🔒 | כל משתמש (הלוחות שלו) | query: `search`; `visibility` (PRIVATE/SHARED); `role` (owner/member); `page`; `pageSize` | `200 Paginated<Board>` |
| POST | `/boards` | 🔒 | כל משתמש | `CreateBoardInput` (חובה: `name`) | `201 Board` |
| GET | `/boards/{boardId}` | 🔒 | בעלים/חבר | — | `200 Board` |
| PATCH | `/boards/{boardId}` | 🔒 | בעלים | `UpdateBoardInput` (לפחות שדה אחד) | `200 Board` |
| DELETE | `/boards/{boardId}` | 🔒 | בעלים | — | `204` |
| POST | `/boards/{boardId}/share-link` | 🔒 | בעלים; לוח משותף | — | `200 Board` (עם `shareToken` חדש) |
| POST | `/boards/join/{shareToken}` | 🔒 | כל משתמש עם הקישור | — | `200 Board` |
| GET | `/boards/{boardId}/members` | 🔒 | בעלים/חבר | — | `200 Member[]` (הבעלים ראשון) |
| POST | `/boards/{boardId}/members` | 🔒 | בעלים; לוח משותף | `{ email }` | `201 Member` |
| DELETE | `/boards/{boardId}/members/{userId}` | 🔒 | בעלים | — | `204` |

### משימות

| Method | נתיב | 🔒 | מי רשאי | גוף / פרמטרים | הצלחה |
|---|---|---|---|---|---|
| GET | `/boards/{boardId}/tasks` | 🔒 | בעלים/חבר | query: `status` (אפשר כמה; מופרדים בפסיק: `TODO;IN_PROGRESS`); `priority` (גם כמה); `schedule` (NONE/DATE/TIMED); `from`; `to`; `search`; `assignedToMe=true`; `sort` (createdAt/updatedAt/title/startAt/dueDate); `order` (asc/desc); `page`; `pageSize` | `200 Paginated<Task>` |
| POST | `/boards/{boardId}/tasks` | 🔒 | `canEdit` | `CreateTaskInput` (חובה: `title`) | `201 Task` |
| GET | `/tasks/{taskId}` | 🔒 | מי שרואה את המשימה | — | `200 Task` |
| PATCH | `/tasks/{taskId}` | 🔒 | `canEdit` | `UpdateTaskInput` (לפחות שדה אחד) | `200 Task` |
| DELETE | `/tasks/{taskId}` | 🔒 | `canEdit` | — | `204` |

**כללי תזמון של משימה** (שולחים רק אחד מהשלושה):

| סוג | מה שולחים | `scheduleType` | חוסמת זמן? |
|---|---|---|---|
| בלי תאריך | לא שולחים שדות תאריך | `NONE` | לא |
| תאריך בלבד (כל היום) | `dueDate: "2026-11-02"` | `DATE` | לא |
| עם שעות | `startAt` + `endAt` (שניהם; סוף אחרי התחלה) | `TIMED` | כן; אם הסטטוס אינו `DONE` |

- אפשר כמה משימות באותו יום; בלי הגבלה.
- **חפיפת שעות:** משימה עם שעות חוסמת את הזמן של המשויכים אליה (`assigneeIds`). אם אין משויכים — את הזמן של היוצרת. הבדיקה נעשית **רק באותו לוח** — כל לוח הוא יומן נפרד. חפיפה מחזירה `409 TIME_CONFLICT`.
- **ב־PATCH:**
  - שליחת `startAt` ו־`endAt` מוחקת את `dueDate`; ולהפך.
  - שליחת `null` מנקה שדה.
  - `assigneeIds` מחליף את כל רשימת המשויכים.
- **משימה פרטית:** `audience: "SELECTED"` מחייב `assigneeIds` שאינו ריק.
- **סינון לפי טווח** (`from`/`to`): מחזיר משימות עם תאריך בלבד שהיום שלהן בטווח; ומשימות עם שעות שחופפות לטווח.

### תזכורות

| Method | נתיב | 🔒 | מי רשאי | גוף / פרמטרים | הצלחה |
|---|---|---|---|---|---|
| GET | `/boards/{boardId}/reminders` | 🔒 | בעלים/חבר | query: `from`; `to` (`remindAt` בטווח); `search`; `page`; `pageSize` — ממוין לפי `remindAt` | `200 Paginated<Reminder>` |
| POST | `/boards/{boardId}/reminders` | 🔒 | `canEdit` | `CreateReminderInput` (חובה: `title`; `remindAt`) | `201 Reminder` |
| GET | `/reminders/{reminderId}` | 🔒 | מי שרואה אותה | — | `200 Reminder` |
| PATCH | `/reminders/{reminderId}` | 🔒 | `canEdit` | `UpdateReminderInput` | `200 Reminder` |
| DELETE | `/reminders/{reminderId}` | 🔒 | `canEdit` | — | `204` |

תזכורות **לא** חוסמות זמן ולא משפיעות על הצעות השיבוץ.

### לוח שנה ושיבוץ

| Method | נתיב | 🔒 | מי רשאי | גוף / פרמטרים | הצלחה |
|---|---|---|---|---|---|
| GET | `/boards/{boardId}/calendar` | 🔒 | בעלים/חבר | query חובה: `from`; `to` (עד 366 יום) | `200 CalendarResponse` |
| POST | `/boards/{boardId}/scheduling/suggestions` | 🔒 | בעלים/חבר | `SchedulingInput` | `200 { suggestions: TimeSlot[] }` |

## 8. דוגמאות JSON

### התחברות

```http
POST /api/auth/login
Content-Type: application/json

{ "email": "dana@example.com"; "password": "Demo1234!" }
```

```json
{
  "success": true;
  "data": {
    "user": { "id": "36cb15ba-7e1f-424b-8c8e-f108f2932b59"; "email": "dana@example.com"; "name": "Dana Levi"; "createdAt": "2026-10-17T23:39:19.235Z" };
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...";
    "tokenType": "Bearer";
    "expiresAt": "2026-10-19T08:00:00.000Z"
  }
}
```

### יצירת לוח

```json
// POST /api/boards
{ "name": "Final project"; "description": "Team board"; "visibility": "SHARED"; "isOpen": true }
```

```json
{
  "success": true;
  "data": {
    "id": "7f3e2d1c-0b9a-4876-a5b4-333333333333";
    "name": "Final project";
    "description": "Team board";
    "visibility": "SHARED";
    "isOpen": true;
    "owner": { "id": "36cb15ba-7e1f-424b-8c8e-f108f2932b59"; "name": "Dana Levi"; "email": "dana@example.com" };
    "memberCount": 0;
    "shareToken": "k3J9xQm2Lp8vT1sR4wY7zA0bC5dE6fG";
    "myAccess": { "isOwner": true; "isMember": false; "canView": true; "canEdit": true; "canManage": true };
    "createdAt": "2026-10-18T08:00:00.000Z";
    "updatedAt": "2026-10-18T08:00:00.000Z"
  }
}
```

### יצירת משימה (שלושת הסוגים)

```json
// POST /api/boards/{boardId}/tasks — בלי תאריך
{ "title": "Buy markers"; "priority": "LOW" }

// תאריך בלבד
{ "title": "Submit form"; "dueDate": "2026-11-05" }

// עם שעות; משויכת לנועה; פרטית (רק היוצרת ונועה רואות)
{
  "title": "Prepare presentation";
  "description": "Slides for the final review";
  "priority": "HIGH";
  "startAt": "2026-11-02T09:00:00Z";
  "endAt": "2026-11-02T10:30:00Z";
  "audience": "SELECTED";
  "assigneeIds": ["0b5c6f8e-1d2a-4c3b-9e8f-222222222222"]
}
```

תשובה (`201`):

```json
{
  "success": true;
  "data": {
    "id": "c1d2e3f4-a5b6-4c7d-8e9f-444444444444";
    "boardId": "7f3e2d1c-0b9a-4876-a5b4-333333333333";
    "title": "Prepare presentation";
    "description": "Slides for the final review";
    "status": "TODO";
    "priority": "HIGH";
    "audience": "SELECTED";
    "scheduleType": "TIMED";
    "dueDate": null;
    "startAt": "2026-11-02T09:00:00.000Z";
    "endAt": "2026-11-02T10:30:00.000Z";
    "createdBy": { "id": "36cb15ba-..."; "name": "Dana Levi"; "email": "dana@example.com" };
    "assignees": [{ "id": "0b5c6f8e-1d2a-4c3b-9e8f-222222222222"; "name": "Noa Cohen"; "email": "noa@example.com" }];
    "createdAt": "2026-10-18T08:00:00.000Z";
    "updatedAt": "2026-10-18T08:00:00.000Z"
  }
}
```

### התנגשות זמנים (`409`)

```json
{
  "success": false;
  "error": {
    "code": "TIME_CONFLICT";
    "message": "The selected time overlaps another scheduled task";
    "details": { "conflicts": [{ "startAt": "2026-11-02T09:30:00.000Z"; "endAt": "2026-11-02T11:00:00.000Z" }] }
  }
}
```

### שגיאת ולידציה (`400`)

```json
{
  "success": false;
  "error": {
    "code": "VALIDATION_ERROR";
    "message": "Request validation failed";
    "details": [
      { "path": "title"; "message": "Title is required" };
      { "path": "endAt"; "message": "endAt must be after startAt" }
    ]
  }
}
```

`details[].path` הוא שם השדה בטופס. אפשר להציג את ההודעה ליד השדה המתאים.

### רשימת משימות עם סינון

```
GET /api/boards/{boardId}/tasks?status=TODO;IN_PROGRESS&priority=HIGH&from=2026-11-01T00:00:00Z&to=2026-12-01T00:00:00Z&page=1&pageSize=20
```

```json
{
  "success": true;
  "data": {
    "items": [ { "id": "..."; "title": "Prepare presentation"; "...": "..." } ];
    "pagination": { "page": 1; "pageSize": 20; "total": 1; "totalPages": 1 }
  }
}
```

## 9. תצוגת לוח שנה

```
GET /api/boards/{boardId}/calendar?from=2026-11-01T00:00:00Z&to=2026-12-01T00:00:00Z
```

```json
{
  "success": true;
  "data": {
    "from": "2026-11-01T00:00:00.000Z";
    "to": "2026-12-01T00:00:00.000Z";
    "events": [
      { "type": "TASK"; "id": "..."; "boardId": "..."; "title": "Submit form"; "description": null;
        "allDay": true; "date": "2026-11-02"; "startAt": null; "endAt": null;
        "blocksTime": false; "status": "TODO"; "priority": "MEDIUM"; "audience": "BOARD" };
      { "type": "TASK"; "id": "..."; "boardId": "..."; "title": "Prepare presentation"; "description": null;
        "allDay": false; "date": null; "startAt": "2026-11-02T09:00:00.000Z"; "endAt": "2026-11-02T10:30:00.000Z";
        "blocksTime": true; "status": "TODO"; "priority": "HIGH"; "audience": "BOARD" };
      { "type": "REMINDER"; "id": "..."; "boardId": "..."; "title": "Call the teacher"; "description": null;
        "allDay": false; "date": null; "startAt": "2026-11-02T12:00:00.000Z"; "endAt": null;
        "blocksTime": false; "status": null; "priority": null; "audience": "BOARD" }
    ]
  }
}
```

**איך להציג:**
- `type === 'TASK' && allDay` ← אירוע לכל היום ב־`date`; כסימון של תאריך יעד.
- `type === 'TASK' && !allDay` ← בלוק מ־`startAt` עד `endAt`. אפשר להציג אחרת משימות `DONE` (`blocksTime: false`).
- `type === 'REMINDER'` ← נקודה או אייקון 🔔 בשעה `startAt`; בלי משך.
- משימות **בלי תאריך** לא מופיעות בלוח השנה. מציגים אותן ברשימה: `GET /tasks?schedule=NONE`.
- האירועים ממוינים: קודם אירועים לכל היום; ואחריהם לפי שעה.

**שעון מקומי:** השרת מחזיר UTC. בתצוגה משתמשים ב־`new Date(event.startAt).toLocaleString('he-IL')`.
לחודש מקומי שולחים `from` ו־`to` כ־`new Date(year; month; 1).toISOString()` ו־`new Date(year; month + 1; 1).toISOString()`.

## 10. הצעות שיבוץ ושמירת משימה

**שלב 1 — בקשת הצעות:**

```json
// POST /api/boards/{boardId}/scheduling/suggestions
{
  "durationMinutes": 90;
  "from": "2026-11-02T08:00:00Z";
  "to": "2026-11-02T16:00:00Z";
  "maxSuggestions": 3;
  "assignedUserId": "0b5c6f8e-1d2a-4c3b-9e8f-222222222222"
}
```

| שדה | חובה | הסבר |
|---|---|---|
| `durationMinutes` | ✅ | מספר שלם; 1 עד 10080 |
| `from`; `to` | ✅ | טווח החיפוש. השרת מחפש **רק** בתוך הטווח הזה; ועד 92 יום. אם רוצים לחפש רק בשעות עבודה; שולחים טווח של יום אחד בכל פעם |
| `maxSuggestions` | | ברירת מחדל 3; מקסימום 20 |
| `assignedUserId` | | עבור מי מחפשים. צריך להיות הבעלים או חבר בלוח. ברירת המחדל היא המשתמשת המחוברת |

```json
{
  "success": true;
  "data": {
    "suggestions": [
      { "startAt": "2026-11-02T08:00:00.000Z"; "endAt": "2026-11-02T09:30:00.000Z" };
      { "startAt": "2026-11-02T11:00:00.000Z"; "endAt": "2026-11-02T12:30:00.000Z" };
      { "startAt": "2026-11-02T12:30:00.000Z"; "endAt": "2026-11-02T14:00:00.000Z" }
    ]
  }
}
```

- **מה נחשב תפוס:** משימות עם שעות שאינן `DONE`; של המשתמש הזה; **באותו לוח בלבד**.
- **מה לא נחשב תפוס:** תזכורות; משימות עם תאריך בלבד ומשימות בלי תאריך.
- **אם אין זמן פנוי:** חוזר `"suggestions": []`. מציגים "לא נמצא זמן פנוי — נסי טווח אחר".
- **שום דבר לא נשמר** בשלב הזה.

**שלב 2 — שמירה אחרי בחירה:** שולחים יצירת משימה רגילה; עם ה־`startAt` וה־`endAt` שנבחרו:

```json
// POST /api/boards/{boardId}/tasks
{ "title": "Prepare presentation"; "startAt": "2026-11-02T11:00:00.000Z"; "endAt": "2026-11-02T12:30:00.000Z"; "assigneeIds": ["0b5c6f8e-1d2a-4c3b-9e8f-222222222222"] }
```

השרת בודק שוב; באופן אטומי; שהזמן עדיין פנוי. אם מישהו תפס אותו בינתיים; מתקבל `409 TIME_CONFLICT`.
במקרה כזה מציגים הודעה ומבקשים הצעות מחדש:

```ts
try {
  await api<Task>(`/boards/${boardId}/tasks`; { method: 'POST'; body: { title; ...chosenSlot; assigneeIds } });
} catch (e) {
  if (e instanceof ApiError && e.code === 'TIME_CONFLICT') {
    alert('הזמן הזה נתפס בינתיים — מבקשת הצעות חדשות');
    // לקרוא שוב ל-scheduling/suggestions
  } else throw e;
}
```

## 11. קודי שגיאה

| HTTP | `code` | מתי | מה לעשות בלקוח |
|---|---|---|---|
| 400 | `VALIDATION_ERROR` | שדה חסר או לא תקין (`details` מפרט את השדות) | להציג שגיאה ליד השדות |
| 400 | `INVALID_JSON` | גוף הבקשה אינו JSON תקין | באג בלקוח |
| 400 | `NOT_A_BOARD_MEMBER` | משויך או נמען שאינו בלוח (`details.userIds`) | לבחור רק מתוך רשימת החברים |
| 400 | `BOARD_IS_PRIVATE` | הוספת חבר או קישור שיתוף ללוח פרטי | לשנות קודם ל־SHARED |
| 400 | `CANNOT_REMOVE_OWNER` | ניסיון להסיר את הבעלים | להסתיר את הכפתור לבעלים |
| 401 | `UNAUTHORIZED` | לא נשלח Token | למסך התחברות |
| 401 | `INVALID_TOKEN` | Token לא תקין; פג תוקף או בוצע Logout | למחוק Token ← למסך התחברות |
| 401 | `INVALID_CREDENTIALS` | אימייל או סיסמה שגויים בהתחברות | "אימייל או סיסמה שגויים" |
| 403 | `FORBIDDEN` | יש צפייה; אבל אין הרשאה לפעולה | להודיע; ולהסתיר את הכפתור לפי `myAccess` |
| 404 | `BOARD_NOT_FOUND` / `TASK_NOT_FOUND` / `REMINDER_NOT_FOUND` | לא קיים; או שאין לך גישה | "לא נמצא" |
| 404 | `USER_NOT_FOUND` | אין משתמש רשום עם האימייל (הוספת חבר) | "המשתמשת צריכה להירשם קודם" |
| 404 | `MEMBER_NOT_FOUND` | המשתמש אינו חבר בלוח | לרענן את הרשימה |
| 404 | `NOT_FOUND` | נתיב לא קיים | באג בלקוח |
| 409 | `EMAIL_TAKEN` | הרשמה עם אימייל קיים | "האימייל כבר רשום" |
| 409 | `ALREADY_MEMBER` / `CANNOT_ADD_OWNER` | המשתמש כבר חבר בלוח; או שהוא הבעלים | להודיע |
| 409 | `BOARD_HAS_MEMBERS` | שינוי ל־PRIVATE כשיש חברים | להסיר קודם את החברים |
| 409 | `TIME_CONFLICT` | הזמן כבר תפוס | לבחור זמן אחר או לבקש הצעות |
| 429 | `RATE_LIMITED` | יותר מדי ניסיונות התחברות או הרשמה | "נסי שוב בעוד כמה דקות" |
| 500 | `INTERNAL_ERROR` | תקלה בשרת | "משהו השתבש" |
| 503 | `DATABASE_UNAVAILABLE` | (רק ב־`/health`) אין חיבור למסד הנתונים | — |

## 12. שדות חובה בטפסים (סיכום)

| טופס | חובה | אופציונלי |
|---|---|---|
| הרשמה | `email`; `password` (8+ תווים; אות וספרה); `name` (עד 100 תווים) | — |
| התחברות | `email`; `password` | — |
| לוח | `name` (1–100 תווים) | `description`; `visibility` (ברירת מחדל `PRIVATE`); `isOpen` (ברירת מחדל `false`) |
| הוספת חבר | `email` | — |
| משימה | `title` (1–200 תווים) | `description`; `status` (`TODO`); `priority` (`MEDIUM`); `audience` (`BOARD`); `assigneeIds` (חובה אם `SELECTED`); `dueDate` **או** `startAt`+`endAt` |
| תזכורת | `title`; `remindAt` | `description`; `audience` (`BOARD`); `recipientIds` (חובה אם `SELECTED`) |
| הצעות שיבוץ | `durationMinutes`; `from`; `to` | `maxSuggestions` (3); `assignedUserId` |

## 13. חיבור ראשון של React — צ'קליסט

1. השרת רץ (`npm run dev`); והכתובת `http://localhost:4000/api/health` מחזירה `ok`.
2. ב־React: `VITE_API_URL=http://localhost:4000`; והעתקת `client.ts` והטיפוסים מסעיפים 3–4.
3. כתובת ה־React (`http://localhost:5173`) נמצאת ב־`CORS_ORIGINS` בקובץ `.env` של השרת.
4. מסך התחברות ← `api('/auth/login')` ← `tokenStore.set(accessToken)`.
5. מסך לוחות ← `api('/boards')`.
6. משתמשי דוגמה (אחרי `npm run db:seed`): `dana@example.com` / `noa@example.com` / `yael@example.com`; סיסמה `Demo1234!`.
