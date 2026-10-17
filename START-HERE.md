# 🚀 START HERE — איך מעלים את השרת לאינטרנט

המדריך הזה מיועד למי שמעולם לא העלתה שרת לאינטרנט. עוברים שלב אחרי שלב:

1. **GitHub** — שם שומרים את הקוד.
2. **Neon** — שם נמצא מסד הנתונים (PostgreSQL) בחינם.
3. **Render** — שם השרת רץ בחינם ומחובר ל־GitHub.
4. **בדיקה** — מוודאים שהכול עובד דרך Swagger.

> ⚠️ **הערה כנה:** האתרים GitHub, Neon ו־Render משנים מדי פעם את העיצוב ואת שמות הכפתורים.
> שמות הכפתורים כאן נכונים לפי התיעוד שלהם בזמן הכתיבה (אוקטובר 2026), אבל לא יכולתי לראות את המסכים עצמם.
> אם כפתור נקרא קצת אחרת — חפשי את המשמעות הכי דומה. הערכים שצריך להקליד (פקודות, שמות משתנים) הם מדויקים.

> 💸 **על "חינם":** המסלולים החינמיים מוגבלים:
> - **Render Free**: השרת "נרדם" אחרי 15 דקות בלי בקשות, והבקשה הראשונה אחרי זה לוקחת כדקה. יש 750 שעות שרת בחודש. אין גישת Shell.
> - **Neon Free**: מסד נתונים קטן (מספיק בהרבה לפרויקט גמר). הוא "נרדם" כשאין שימוש ומתעורר תוך שנייה בערך.
> - **לא** משתמשים ב־PostgreSQL של Render — הגרסה החינמית שלו **נמחקת אחרי 30 יום**.
> - המגבלות יכולות להשתנות — כדאי להציץ בדף התמחור של כל שירות.

---

## חלק א — GitHub

### 1. פתיחת חשבון
1. היכנסי ל־<https://github.com> ולחצי **Sign up**.
2. הזיני אימייל, סיסמה ושם משתמש, ואשרי את האימייל.

### 2. יצירת Repository (מאגר קוד)
1. למעלה מימין לחצי על **+** ← **New repository**.
2. **Repository name**: `task-boards-backend`
3. בחרי **Private** (מומלץ) או Public.
4. **אל** תסמני "Add a README file" (כבר יש לנו README).
5. לחצי **Create repository**.

### 3. העלאת הקוד — בחרי דרך אחת

#### דרך א (מומלצת): Git מהמחשב
בתיקיית הפרויקט כבר יש Git עם Commit ראשון מוכן. פתחי PowerShell **בתוך תיקיית `backend-project`** והריצי
(החליפי את `YOUR-USERNAME` בשם המשתמש שלך ב־GitHub):

```powershell
git remote add origin https://github.com/YOUR-USERNAME/task-boards-backend.git
git branch -M main
git push -u origin main
```

בפעם הראשונה ייפתח חלון התחברות ל־GitHub — אשרי אותו.

#### דרך ב: העלאה דרך הדפדפן
1. בדף ה־Repository החדש לחצי על הקישור **uploading an existing file**.
2. פתחי את תיקיית `backend-project` בסייר הקבצים, וגררי לדפדפן **את כל התוכן שלה** — **חוץ מ**:
   - ❌ `node_modules` (ענקית ולא צריך אותה — Render מתקין לבד)
   - ❌ `dist` (נבנית אוטומטית)
   - ❌ `src/generated` (נוצרת אוטומטית)
   - ❌ `.env` (**סודות! אסור להעלות**)
   - ❌ `.git` (אם מופיעה)
3. ודאי שהקבצים שמתחילים בנקודה עלו: `.gitignore`, `.env.example`, `.node-version`.
4. למטה לחצי **Commit changes**.

> 📝 בהעלאה דרך הדפדפן יש מגבלה של 100 קבצים בפעם. הפרויקט קטן מזה (בלי `node_modules`), אבל אם תקבלי שגיאה — העלי בשתי פעמים.

### 4. בדיקה שהקבצים ב־GitHub
רענני את דף ה־Repository. את אמורה לראות: `src`, `prisma`, `tests`, `docs`, `package.json`, `package-lock.json`, `render.yaml`, `README.md`, `START-HERE.md`.
✅ ודאי ש**אין** שם קובץ `.env` ואין תיקיית `node_modules`.

---

## חלק ב — מסד נתונים חינמי ב־Neon

### 1. פתיחת חשבון
היכנסי ל־<https://neon.com> ← **Sign up**. הכי פשוט: **Continue with GitHub**.

### 2. יצירת Database
1. ביצירת הפרויקט הראשון:
   - **Project name**: `task-boards`
   - **Postgres version**: הגרסה המוצעת (17 ומעלה מתאים)
   - **Region**: בחרי אזור קרוב לאזור שתבחרי ב־Render. למשל, אם ב־Render תבחרי **Frankfurt (EU Central)**, בחרי ב־Neon **AWS Europe Central 1 (Frankfurt)**.
2. לחצי **Create project**. Neon יוצר מסד נתונים בשם `neondb`.

### 3. קבלת ה־Connection String
1. בדף הפרויקט לחצי **Connect**.
2. בחלון שנפתח בחרי את ה־branch הראשי, את המסד `neondb` ואת ה־role הקיים.
3. **חשוב:** השתמשי בכתובת **ישירה** (Direct). אם מופיעה אפשרות **Connection pooling** — כבי אותה.
   בכתובת ישירה **אין** את המילה `-pooler` בשם השרת. Prisma צריכה חיבור ישיר כדי להריץ Migrations.
4. העתיקי את הכתובת. היא נראית בערך כך:

```
postgresql://neondb_owner:XXXXXXXX@ep-something-123456.eu-central-1.aws.neon.tech/neondb?sslmode=require
```

### 4. שמירה בטוחה
- הכתובת הזאת כוללת **סיסמה**. אל תשימי אותה בקוד, אל תעלי אותה ל־GitHub ואל תשלחי אותה בצ'אט.
- שמרי אותה זמנית בפנקס רשימות או במנהל סיסמאות. נדביק אותה ב־Render בשלב הבא.

### 5. קישור השרת למסד
השרת קורא את הכתובת ממשתנה הסביבה `DATABASE_URL`. נגדיר אותו ב־Render בחלק ג.
הטבלאות נוצרות **אוטומטית** בכל הפעלה של השרת (`prisma migrate deploy` רץ לפני ההפעלה).

---

## חלק ג — Render

### 1. פתיחת חשבון
היכנסי ל־<https://render.com> ← **Get Started** ← **GitHub**. כך החשבון כבר מחובר ל־GitHub.

### 2. חיבור GitHub
אם Render מבקש הרשאה ל־Repositories, בחרי **Only select repositories** ← `task-boards-backend` ← **Install**.

### 3–5. יצירת השירות — בחרי דרך אחת

#### דרך א (מומלצת): Blueprint — הכול מוגדר אוטומטית מתוך `render.yaml`
1. ב־Dashboard לחצי **New +** ← **Blueprint**.
2. בחרי את `task-boards-backend` ← **Connect**.
3. Render קורא את `render.yaml` ומבקש ערכים לשני משתנים:
   - **DATABASE_URL** ← הדביקי את הכתובת מ־Neon.
   - **CORS_ORIGINS** ← `http://localhost:5173` (כתובת ה־React בפיתוח). כשתעלי את ה־React לאינטרנט, תוסיפי גם את הכתובת שלו, מופרדת בפסיק.
4. לחצי **Apply** (או **Deploy Blueprint**).

`JWT_SECRET` נוצר אוטומטית כסוד אקראי. `NODE_ENV`, `NODE_VERSION` ו־`JWT_EXPIRES_IN_MINUTES` מוגדרים מראש.

#### דרך ב: Web Service ידני
1. **New +** ← **Web Service** ← בחרי את `task-boards-backend`.
2. מלאי:

| שדה | ערך |
|---|---|
| Name | `task-boards-api` |
| Language / Runtime | `Node` |
| Branch | `main` |
| Root Directory | השאירי ריק |
| Build Command | `npm ci --include=dev && npm run build` |
| Start Command | `npm run start:prod` |
| Instance Type | **Free** |

3. ב־**Advanced** ← **Health Check Path**: `/api/health`

### 6. משתני סביבה (Environment Variables)
בדרך ב (ידני) — לחצי **Add Environment Variable** והוסיפי:

| Key | Value |
|---|---|
| `NODE_ENV` | `production` |
| `NODE_VERSION` | `22` |
| `DATABASE_URL` | הכתובת מ־Neon |
| `JWT_SECRET` | מחרוזת אקראית ארוכה (לפחות 32 תווים). ב־Render יש כפתור **Generate** |
| `JWT_EXPIRES_IN_MINUTES` | `1440` |
| `CORS_ORIGINS` | `http://localhost:5173` (ובהמשך גם כתובת ה־React בענן, מופרדת בפסיק) |

לא מגדירים `PORT` — Render מגדיר אותו לבד, והשרת משתמש בו.

### 7. Prisma Migrations
לא צריך לעשות כלום! פקודת ההפעלה `npm run start:prod` מריצה `prisma migrate deploy` לפני שהשרת עולה.
כך הטבלאות נוצרות בפעם הראשונה ומתעדכנות בכל פריסה. (במסלול החינמי של Render אין "Pre-Deploy Command" ואין Shell, ולכן זה בנוי כך.)

### 8. Deploy
- **Create Web Service** / **Apply** מתחיל פריסה ראשונה. אפשר לעקוב בלשונית **Logs**. זה לוקח כמה דקות.
- כל `git push` (או העלאה חדשה ל־GitHub) יפרוס אוטומטית מחדש.
- פריסה ידנית: **Manual Deploy** ← **Deploy latest commit**.

### 9. בדיקה שהשרת פעיל
כשמופיע **Live** ובלוגים מופיעה השורה `Server listening on port ...`, הכתובת של השרת מופיעה למעלה, למשל:
`https://task-boards-api.onrender.com` (אצלך השם יכול להיות קצת שונה).

### (רשות) נתוני דוגמה בענן
במסלול החינמי אין Shell, אז מריצים את ה־Seed **מהמחשב שלך** מול Neon:

```powershell
$env:DATABASE_URL="<כתובת Neon>"
$env:NODE_ENV="production"
$env:SEED_PASSWORD="<סיסמה חזקה שרק את יודעת>"
npm run db:seed
```

בסביבת Production ה־Seed מסרב לרוץ בלי `SEED_PASSWORD`, כדי שלא ייווצרו משתמשים עם סיסמה שכולם מכירים.
אפשר גם פשוט להירשם דרך Swagger (`POST /api/auth/register`).

---

## חלק ד — בדיקה (במחשב: `http://localhost:4000`, בענן: הכתובת מ־Render)

1. **Health** — פתחי את `<כתובת>/api/health`. אמור להופיע `"status": "ok"` ו־`"database": "up"`.
   (אם השרת נרדם — חכי כדקה ורענני.)
2. **Swagger** — פתחי את `<כתובת>/api-docs`.
3. **התחברות מתוך Swagger** — פתחי את `POST /api/auth/login` ← **Try it out**. בגוף הבקשה כתבי אימייל וסיסמה
   (של משתמש דוגמה, או של משתמש שנרשם דרך `POST /api/auth/register`) ← **Execute**.
4. **קבלת JWT** — בתשובה (קוד 200) העתיקי את הערך של `accessToken`, בלי המירכאות.
5. **Authorize** — לחצי על הכפתור **Authorize** 🔓 למעלה ← הדביקי את ה־Token בשדה **Value** ← **Authorize** ← **Close**. המנעולים ייסגרו 🔒.
6. **קריאה מוגנת** — `GET /api/boards` ← **Try it out** ← **Execute**. אמורה להתקבל רשימת לוחות (200).
   כדי לראות 401: לחצי שוב **Authorize** ← **Logout** ← הריצי שוב. התשובה תהיה `401 UNAUTHORIZED`.
7. **הוספת רשומה** — `POST /api/boards` עם `{"name": "My first board"}` ← העתיקי את ה־`id` מהתשובה.
   אחר כך `POST /api/boards/{boardId}/tasks` עם `{"title": "My first task", "dueDate": "2026-11-02"}`.
8. **שליפה ממסד הנתונים** — `GET /api/boards/{boardId}/tasks` עם אותו `boardId`. המשימה שיצרת מופיעה — היא נשמרה ב־PostgreSQL.
   (אפשר לראות אותה גם ב־Neon ← **Tables** ← `tasks`.)

**בדיקת 403:** התחברי כ־`noa@example.com` (אחרי Seed) ונסי ליצור משימה בלוח "Art class" — זה לוח סגור, והתשובה תהיה `403 FORBIDDEN`.

---

## חלק ה — פתרון תקלות

| תקלה | מה רואים | פתרון |
|---|---|---|
| **Build Failed** | בלוגים: `npm ERR!` או `tsc` error | בדקי שה־Build Command הוא בדיוק `npm ci --include=dev && npm run build`, ושהעלית את `package-lock.json`. בלי `--include=dev` חסרים TypeScript ו־tsx |
| **DATABASE_URL שגוי** | `P1001: Can't reach database server` או `P1000: Authentication failed` | העתיקי שוב את הכתובת מ־Neon (**Connect**). ודאי שיש `?sslmode=require` בסוף ושאין רווחים |
| **בעיית Prisma / Migrations** | `P3005` / `migrate deploy` נכשל, או `prepared statement` errors | ודאי שהכתובת **ישירה** (בלי `-pooler`). אם המסד מכיל טבלאות מפרויקט קודם — צרי Database חדש ב־Neon |
| **JWT_SECRET חסר** | בלוגים: `Invalid environment variables: JWT_SECRET` | הוסיפי `JWT_SECRET` (לפחות 32 תווים) ב־**Environment** ← **Save Changes** |
| **שגיאת CORS** | בדפדפן של React: `blocked by CORS policy` | הוסיפי את כתובת ה־React **בדיוק** (כולל `http`/`https` ופורט, בלי `/` בסוף) ל־`CORS_ORIGINS`. כמה כתובות — מפרידים בפסיק. אחרי שינוי, Render מפעיל מחדש |
| **401 Unauthorized** | `UNAUTHORIZED` / `INVALID_TOKEN` | לא נשלח Token, ה־Token פג תוקף (24 שעות) או שבוצע Logout. התחברי מחדש. ב־Swagger: **Authorize** עם Token חדש, **בלי** המילה Bearer ובלי מירכאות |
| **403 Forbidden** | `FORBIDDEN` | את מחוברת אבל אין לך הרשאה (למשל עריכה בלוח סגור, או ניהול לוח שאינו שלך). זו התנהגות נכונה |
| **404 על לוח קיים** | `BOARD_NOT_FOUND` | אין לך גישה ללוח (פרטי של מישהו אחר, או שלא הצטרפת) — השרת מסתיר אותו בכוונה |
| **Swagger לא נפתח** | דף ריק / 404 | הכתובת היא `/api-docs` (לא `/swagger`). אם השרת ישן — חכי כדקה. בדקי קודם ש־`/api/health` עובד |
| **השרת לא עולה** | Deploy נתקע / `Exited with status 1` | קראי את הלוגים. בדרך כלל זה משתנה סביבה חסר או `DATABASE_URL` שגוי (ראי למעלה). ודאי שה־Start Command הוא `npm run start:prod` |
| **הבקשה הראשונה איטית מאוד** | ~דקה | נורמלי במסלול החינמי: השרת "התעורר" |
| **Health מחזיר 503** | `DATABASE_UNAVAILABLE` | השרת עלה אבל לא מצליח להתחבר ל־Neon. בדקי את `DATABASE_URL` ושהפרויקט ב־Neon פעיל |
