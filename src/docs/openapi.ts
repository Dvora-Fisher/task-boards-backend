/**
 * OpenAPI 3.1 document for the whole API.
 * Served at /api-docs (Swagger UI) and /api-docs/openapi.json, and written to docs/openapi.json
 * by `npm run docs:generate`.
 */

type Json = Record<string, unknown>;

const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });
const nullable = (type: string, extra: Json = {}) => ({ type: [type, 'null'], ...extra });

// ---------- example values ----------
const ID = {
  dana: '0b5c6f8e-1d2a-4c3b-9e8f-111111111111',
  noa: '0b5c6f8e-1d2a-4c3b-9e8f-222222222222',
  board: '7f3e2d1c-0b9a-4876-a5b4-333333333333',
  task: 'c1d2e3f4-a5b6-4c7d-8e9f-444444444444',
  reminder: 'd4c3b2a1-f6e5-4d7c-9b8a-555555555555',
};
const TS = '2026-10-18T08:00:00.000Z';
const dana = { id: ID.dana, name: 'Dana Levi', email: 'dana@example.com' };
const noa = { id: ID.noa, name: 'Noa Cohen', email: 'noa@example.com' };
const ownerAccess = { isOwner: true, isMember: false, canView: true, canEdit: true, canManage: true };

const exampleBoard = {
  id: ID.board,
  name: 'Final project',
  description: 'Shared board for the team',
  visibility: 'SHARED',
  isOpen: true,
  owner: dana,
  memberCount: 2,
  shareToken: 'k3J9xQm2Lp8vT1sR4wY7zA0bC5dE6fG',
  myAccess: ownerAccess,
  createdAt: TS,
  updatedAt: TS,
};
const exampleTask = {
  id: ID.task,
  boardId: ID.board,
  title: 'Prepare presentation',
  description: 'Slides for the final review',
  status: 'TODO',
  priority: 'HIGH',
  audience: 'BOARD',
  scheduleType: 'TIMED',
  dueDate: null,
  startAt: '2026-11-02T09:00:00.000Z',
  endAt: '2026-11-02T10:30:00.000Z',
  createdBy: dana,
  assignees: [noa],
  createdAt: TS,
  updatedAt: TS,
};
const exampleReminder = {
  id: ID.reminder,
  boardId: ID.board,
  title: 'Submit the project form',
  description: null,
  remindAt: '2026-11-05T07:00:00.000Z',
  audience: 'SELECTED',
  createdBy: dana,
  recipients: [noa],
  createdAt: TS,
  updatedAt: TS,
};
const pagination = (total: number) => ({ page: 1, pageSize: 20, total, totalPages: Math.ceil(total / 20) });

// ---------- response helpers ----------
const success = (description: string, dataSchema: Json, example: unknown) => ({
  description,
  content: {
    'application/json': {
      schema: {
        type: 'object',
        required: ['success', 'data'],
        properties: { success: { const: true }, data: dataSchema },
      },
      example: { success: true, data: example },
    },
  },
});

const ERROR_DESCRIPTIONS: Record<number, string> = {
  400: 'Validation error or invalid request',
  401: 'Missing, invalid or expired token (UNAUTHORIZED / INVALID_TOKEN)',
  403: 'Logged in, but not allowed to do this (FORBIDDEN)',
  404: 'Not found — or you are not allowed to see it',
  409: 'Conflict',
  429: 'Too many attempts (RATE_LIMITED)',
};

const ERROR_EXAMPLES: Record<number, { code: string; message: string; details?: unknown }> = {
  400: {
    code: 'VALIDATION_ERROR',
    message: 'Request validation failed',
    details: [{ path: 'title', message: 'Title is required' }],
  },
  401: { code: 'UNAUTHORIZED', message: 'Authentication required' },
  403: { code: 'FORBIDDEN', message: 'You do not have permission to perform this action' },
  404: { code: 'BOARD_NOT_FOUND', message: 'Board not found' },
  409: { code: 'CONFLICT', message: 'Conflict' },
  429: { code: 'RATE_LIMITED', message: 'Too many attempts. Please try again later' },
};

function errorResponse(status: number, description?: string, example?: { code: string; message: string; details?: unknown }) {
  return {
    description: description ?? ERROR_DESCRIPTIONS[status],
    content: {
      'application/json': {
        schema: ref('ErrorResponse'),
        example: { success: false, error: example ?? ERROR_EXAMPLES[status] },
      },
    },
  };
}

const errorsFor = (...statuses: number[]) => Object.fromEntries(statuses.map((s) => [String(s), errorResponse(s)]));

const noContent = { '204': { description: 'Deleted (no response body)' } };
const bearer = [{ bearerAuth: [] }];

const jsonBody = (schema: Json, example: unknown, required = true) => ({
  required,
  content: { 'application/json': { schema, example } },
});

// ---------- parameters ----------
const pathParam = (name: string, description: string) => ({
  name,
  in: 'path',
  required: true,
  description,
  schema: { type: 'string', format: 'uuid' },
});
const query = (name: string, schema: Json, description: string, required = false) => ({
  name,
  in: 'query',
  required,
  description,
  schema,
});
const boardIdParam = pathParam('boardId', 'Board id (UUID)');
const pageParams = [
  query('page', { type: 'integer', minimum: 1, default: 1 }, 'Page number (starts at 1)'),
  query('pageSize', { type: 'integer', minimum: 1, maximum: 100, default: 20 }, 'Items per page'),
];

const paginatedOf = (item: string) => ({
  type: 'object',
  required: ['items', 'pagination'],
  properties: { items: { type: 'array', items: ref(item) }, pagination: ref('Pagination') },
});

// ---------- the document ----------
export const openApiDocument = {
  openapi: '3.1.0',
  info: {
    title: 'Task Boards API',
    version: '1.0.0',
    description: [
      'REST API for personal and shared task & reminder boards.',
      '',
      '**How to try it here:**',
      '1. `POST /api/auth/login` → "Try it out" → Execute (demo user: `dana@example.com` / `Demo1234!` after running the seed).',
      '2. Copy `data.accessToken` from the response.',
      '3. Click **Authorize** (top right), paste the token, click Authorize.',
      '4. Call any protected endpoint.',
      '',
      'All responses use `{ "success": true, "data": ... }` or `{ "success": false, "error": { "code", "message" } }`.',
      'All ids are UUID strings. All date-times are ISO 8601 in UTC (e.g. `2026-11-02T09:00:00.000Z`). Date-only values use `YYYY-MM-DD`.',
      '',
      '**Board permissions:** PRIVATE board — only the owner. SHARED board — owner and members can view; members can edit tasks/reminders only when the board is open (`isOpen: true`); only the owner manages settings, share link and members.',
      'A board you are not allowed to view returns **404**. A board you can view but not edit returns **403** on writes.',
    ].join('\n'),
  },
  servers: [{ url: '/', description: 'This server' }],
  tags: [
    { name: 'System', description: 'Health check' },
    { name: 'Auth', description: 'Register, login, logout, current user' },
    { name: 'Boards', description: 'Boards, share links' },
    { name: 'Members', description: 'Members of SHARED boards' },
    { name: 'Tasks', description: 'Tasks (unscheduled, date-only or timed)' },
    { name: 'Reminders', description: 'Reminders (never block time)' },
    { name: 'Calendar', description: 'Calendar view and scheduling suggestions' },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Paste the accessToken returned by /api/auth/login or /api/auth/register',
      },
    },
    schemas: {
      ErrorResponse: {
        type: 'object',
        required: ['success', 'error'],
        properties: {
          success: { const: false },
          error: {
            type: 'object',
            required: ['code', 'message'],
            properties: {
              code: {
                type: 'string',
                enum: [
                  'VALIDATION_ERROR',
                  'INVALID_JSON',
                  'UNAUTHORIZED',
                  'INVALID_TOKEN',
                  'INVALID_CREDENTIALS',
                  'FORBIDDEN',
                  'NOT_FOUND',
                  'BOARD_NOT_FOUND',
                  'TASK_NOT_FOUND',
                  'REMINDER_NOT_FOUND',
                  'USER_NOT_FOUND',
                  'MEMBER_NOT_FOUND',
                  'EMAIL_TAKEN',
                  'ALREADY_MEMBER',
                  'BOARD_IS_PRIVATE',
                  'BOARD_HAS_MEMBERS',
                  'CANNOT_ADD_OWNER',
                  'CANNOT_REMOVE_OWNER',
                  'NOT_A_BOARD_MEMBER',
                  'TIME_CONFLICT',
                  'RATE_LIMITED',
                  'DATABASE_UNAVAILABLE',
                  'INTERNAL_ERROR',
                ],
              },
              message: { type: 'string' },
              details: { description: 'Optional extra information (validation issues, conflicting times, ...)' },
            },
          },
        },
      },
      Pagination: {
        type: 'object',
        required: ['page', 'pageSize', 'total', 'totalPages'],
        properties: {
          page: { type: 'integer' },
          pageSize: { type: 'integer' },
          total: { type: 'integer' },
          totalPages: { type: 'integer' },
        },
      },
      User: {
        type: 'object',
        required: ['id', 'email', 'name', 'createdAt'],
        properties: {
          id: { type: 'string', format: 'uuid' },
          email: { type: 'string', format: 'email' },
          name: { type: 'string' },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      UserSummary: {
        type: 'object',
        required: ['id', 'name', 'email'],
        properties: {
          id: { type: 'string', format: 'uuid' },
          name: { type: 'string' },
          email: { type: 'string', format: 'email' },
        },
      },
      AuthResult: {
        type: 'object',
        required: ['user', 'accessToken', 'tokenType', 'expiresAt'],
        properties: {
          user: ref('User'),
          accessToken: { type: 'string', description: 'JWT — send as "Authorization: Bearer <token>"' },
          tokenType: { const: 'Bearer' },
          expiresAt: { type: 'string', format: 'date-time' },
        },
      },
      BoardAccess: {
        type: 'object',
        description: "The current user's permissions on the board — use it to show/hide buttons in the UI",
        required: ['isOwner', 'isMember', 'canView', 'canEdit', 'canManage'],
        properties: {
          isOwner: { type: 'boolean' },
          isMember: { type: 'boolean' },
          canView: { type: 'boolean' },
          canEdit: { type: 'boolean', description: 'May create/edit/delete tasks and reminders' },
          canManage: { type: 'boolean', description: 'May change settings, share link and members (owner only)' },
        },
      },
      Board: {
        type: 'object',
        required: ['id', 'name', 'description', 'visibility', 'isOpen', 'owner', 'memberCount', 'shareToken', 'myAccess', 'createdAt', 'updatedAt'],
        properties: {
          id: { type: 'string', format: 'uuid' },
          name: { type: 'string' },
          description: nullable('string'),
          visibility: { type: 'string', enum: ['PRIVATE', 'SHARED'] },
          isOpen: { type: 'boolean', description: 'SHARED boards: members may edit. Always false for PRIVATE.' },
          owner: ref('UserSummary'),
          memberCount: { type: 'integer', description: 'Members not counting the owner' },
          shareToken: nullable('string', { description: 'Only returned to the owner of a SHARED board' }),
          myAccess: ref('BoardAccess'),
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
      Member: {
        type: 'object',
        required: ['user', 'isOwner', 'joinedAt'],
        properties: {
          user: ref('UserSummary'),
          isOwner: { type: 'boolean' },
          joinedAt: { type: 'string', format: 'date-time' },
        },
      },
      Task: {
        type: 'object',
        required: ['id', 'boardId', 'title', 'description', 'status', 'priority', 'audience', 'scheduleType', 'dueDate', 'startAt', 'endAt', 'createdBy', 'assignees', 'createdAt', 'updatedAt'],
        properties: {
          id: { type: 'string', format: 'uuid' },
          boardId: { type: 'string', format: 'uuid' },
          title: { type: 'string' },
          description: nullable('string'),
          status: { type: 'string', enum: ['TODO', 'IN_PROGRESS', 'DONE'] },
          priority: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH'] },
          audience: { type: 'string', enum: ['BOARD', 'SELECTED'], description: 'BOARD = everyone on the board, SELECTED = creator + assignees only' },
          scheduleType: { type: 'string', enum: ['NONE', 'DATE', 'TIMED'] },
          dueDate: nullable('string', { format: 'date', description: 'Date-only task (YYYY-MM-DD)' }),
          startAt: nullable('string', { format: 'date-time' }),
          endAt: nullable('string', { format: 'date-time' }),
          createdBy: { oneOf: [ref('UserSummary'), { type: 'null' }] },
          assignees: { type: 'array', items: ref('UserSummary') },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
      Reminder: {
        type: 'object',
        required: ['id', 'boardId', 'title', 'description', 'remindAt', 'audience', 'createdBy', 'recipients', 'createdAt', 'updatedAt'],
        properties: {
          id: { type: 'string', format: 'uuid' },
          boardId: { type: 'string', format: 'uuid' },
          title: { type: 'string' },
          description: nullable('string'),
          remindAt: { type: 'string', format: 'date-time' },
          audience: { type: 'string', enum: ['BOARD', 'SELECTED'] },
          createdBy: { oneOf: [ref('UserSummary'), { type: 'null' }] },
          recipients: { type: 'array', items: ref('UserSummary') },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
      CalendarEvent: {
        type: 'object',
        required: ['type', 'id', 'boardId', 'title', 'description', 'allDay', 'date', 'startAt', 'endAt', 'blocksTime', 'status', 'priority', 'audience'],
        properties: {
          type: { type: 'string', enum: ['TASK', 'REMINDER'] },
          id: { type: 'string', format: 'uuid', description: 'Task id or reminder id' },
          boardId: { type: 'string', format: 'uuid' },
          title: { type: 'string' },
          description: nullable('string'),
          allDay: { type: 'boolean', description: 'true for date-only tasks' },
          date: nullable('string', { format: 'date', description: 'Day of an all-day item' }),
          startAt: nullable('string', { format: 'date-time', description: 'Timed task start or reminder time' }),
          endAt: nullable('string', { format: 'date-time', description: 'Timed task end (null for reminders)' }),
          blocksTime: { type: 'boolean', description: 'true only for timed tasks that are not DONE' },
          status: nullable('string', { enum: ['TODO', 'IN_PROGRESS', 'DONE', null] }),
          priority: nullable('string', { enum: ['LOW', 'MEDIUM', 'HIGH', null] }),
          audience: { type: 'string', enum: ['BOARD', 'SELECTED'] },
        },
      },
      TimeSlot: {
        type: 'object',
        required: ['startAt', 'endAt'],
        properties: {
          startAt: { type: 'string', format: 'date-time' },
          endAt: { type: 'string', format: 'date-time' },
        },
      },
      RegisterInput: {
        type: 'object',
        required: ['email', 'password', 'name'],
        properties: {
          email: { type: 'string', format: 'email', maxLength: 254 },
          password: { type: 'string', minLength: 8, maxLength: 128, description: 'At least 8 characters, with a letter and a digit' },
          name: { type: 'string', minLength: 1, maxLength: 100 },
        },
      },
      LoginInput: {
        type: 'object',
        required: ['email', 'password'],
        properties: { email: { type: 'string', format: 'email' }, password: { type: 'string' } },
      },
      CreateBoardInput: {
        type: 'object',
        required: ['name'],
        properties: {
          name: { type: 'string', minLength: 1, maxLength: 100 },
          description: nullable('string', { maxLength: 5000 }),
          visibility: { type: 'string', enum: ['PRIVATE', 'SHARED'], default: 'PRIVATE' },
          isOpen: { type: 'boolean', default: false, description: 'Ignored (false) for PRIVATE boards' },
        },
      },
      UpdateBoardInput: {
        type: 'object',
        minProperties: 1,
        properties: {
          name: { type: 'string', minLength: 1, maxLength: 100 },
          description: nullable('string', { maxLength: 5000 }),
          visibility: { type: 'string', enum: ['PRIVATE', 'SHARED'] },
          isOpen: { type: 'boolean' },
        },
      },
      AddMemberInput: {
        type: 'object',
        required: ['email'],
        properties: { email: { type: 'string', format: 'email', description: 'Email of a registered user' } },
      },
      CreateTaskInput: {
        type: 'object',
        required: ['title'],
        description:
          'Schedule options: none (no date fields), date-only (`dueDate`), or timed (`startAt` + `endAt`). A timed, not-DONE task is checked for overlaps with the time of its assignees (or of the creator if nobody is assigned) → 409 TIME_CONFLICT.',
        properties: {
          title: { type: 'string', minLength: 1, maxLength: 200 },
          description: nullable('string', { maxLength: 5000 }),
          status: { type: 'string', enum: ['TODO', 'IN_PROGRESS', 'DONE'], default: 'TODO' },
          priority: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH'], default: 'MEDIUM' },
          audience: { type: 'string', enum: ['BOARD', 'SELECTED'], default: 'BOARD' },
          assigneeIds: { type: 'array', items: { type: 'string', format: 'uuid' }, default: [], description: 'Board owner/members. Required (non-empty) when audience is SELECTED' },
          dueDate: nullable('string', { format: 'date' }),
          startAt: nullable('string', { format: 'date-time' }),
          endAt: nullable('string', { format: 'date-time' }),
        },
      },
      UpdateTaskInput: {
        type: 'object',
        minProperties: 1,
        description:
          'Send only the fields to change. Send `null` to clear a field. Sending startAt/endAt clears dueDate and vice versa. `assigneeIds` replaces the whole list.',
        properties: {
          title: { type: 'string', minLength: 1, maxLength: 200 },
          description: nullable('string', { maxLength: 5000 }),
          status: { type: 'string', enum: ['TODO', 'IN_PROGRESS', 'DONE'] },
          priority: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH'] },
          audience: { type: 'string', enum: ['BOARD', 'SELECTED'] },
          assigneeIds: { type: 'array', items: { type: 'string', format: 'uuid' } },
          dueDate: nullable('string', { format: 'date' }),
          startAt: nullable('string', { format: 'date-time' }),
          endAt: nullable('string', { format: 'date-time' }),
        },
      },
      CreateReminderInput: {
        type: 'object',
        required: ['title', 'remindAt'],
        properties: {
          title: { type: 'string', minLength: 1, maxLength: 200 },
          description: nullable('string', { maxLength: 5000 }),
          remindAt: { type: 'string', format: 'date-time' },
          audience: { type: 'string', enum: ['BOARD', 'SELECTED'], default: 'BOARD' },
          recipientIds: { type: 'array', items: { type: 'string', format: 'uuid' }, default: [], description: 'Required (non-empty) when audience is SELECTED' },
        },
      },
      UpdateReminderInput: {
        type: 'object',
        minProperties: 1,
        properties: {
          title: { type: 'string', minLength: 1, maxLength: 200 },
          description: nullable('string', { maxLength: 5000 }),
          remindAt: { type: 'string', format: 'date-time' },
          audience: { type: 'string', enum: ['BOARD', 'SELECTED'] },
          recipientIds: { type: 'array', items: { type: 'string', format: 'uuid' } },
        },
      },
      SchedulingInput: {
        type: 'object',
        required: ['durationMinutes', 'from', 'to'],
        properties: {
          durationMinutes: { type: 'integer', minimum: 1, maximum: 10080 },
          from: { type: 'string', format: 'date-time', description: 'Start of the search range' },
          to: { type: 'string', format: 'date-time', description: 'End of the search range (max 92 days after from)' },
          maxSuggestions: { type: 'integer', minimum: 1, maximum: 20, default: 3 },
          assignedUserId: { type: 'string', format: 'uuid', description: 'Board owner/member to find time for. Defaults to the logged-in user' },
        },
      },
    },
  },
  paths: {
    '/api/health': {
      get: {
        tags: ['System'],
        summary: 'Health check',
        description: 'Public. Checks the server and the database connection.',
        responses: {
          '200': success(
            'Server and database are up',
            {
              type: 'object',
              properties: {
                status: { const: 'ok' },
                database: { const: 'up' },
                uptimeSeconds: { type: 'integer' },
                timestamp: { type: 'string', format: 'date-time' },
              },
            },
            { status: 'ok', database: 'up', uptimeSeconds: 42, timestamp: TS },
          ),
          '503': errorResponse(503, 'Database is not reachable', { code: 'DATABASE_UNAVAILABLE', message: 'Database connection failed' }),
        },
      },
    },

    // ---------------- Auth ----------------
    '/api/auth/register': {
      post: {
        tags: ['Auth'],
        summary: 'Register a new user',
        description: 'Public (rate limited). Creates the user and logs them in — returns a token.',
        requestBody: jsonBody(ref('RegisterInput'), { email: 'new.user@example.com', password: 'Secret123', name: 'New User' }),
        responses: {
          '201': success('Registered and logged in', ref('AuthResult'), {
            user: { id: ID.dana, email: 'new.user@example.com', name: 'New User', createdAt: TS },
            accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
            tokenType: 'Bearer',
            expiresAt: '2026-10-19T08:00:00.000Z',
          }),
          '400': errorResponse(400),
          '409': errorResponse(409, 'Email already registered', { code: 'EMAIL_TAKEN', message: 'An account with this email already exists' }),
          '429': errorResponse(429),
        },
      },
    },
    '/api/auth/login': {
      post: {
        tags: ['Auth'],
        summary: 'Log in',
        description: 'Public (rate limited). Returns a JWT access token. Each login creates a server-side session.',
        requestBody: jsonBody(ref('LoginInput'), { email: 'dana@example.com', password: 'Demo1234!' }),
        responses: {
          '200': success('Logged in', ref('AuthResult'), {
            user: { ...dana, createdAt: TS },
            accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
            tokenType: 'Bearer',
            expiresAt: '2026-10-19T08:00:00.000Z',
          }),
          '400': errorResponse(400),
          '401': errorResponse(401, 'Wrong email or password', { code: 'INVALID_CREDENTIALS', message: 'Email or password is incorrect' }),
          '429': errorResponse(429),
        },
      },
    },
    '/api/auth/logout': {
      post: {
        tags: ['Auth'],
        summary: 'Log out',
        description: 'Ends the current session on the server. The same token returns 401 afterwards.',
        security: bearer,
        responses: {
          '200': success('Logged out', { type: 'object', properties: { loggedOut: { const: true } } }, { loggedOut: true }),
          ...errorsFor(401),
        },
      },
    },
    '/api/auth/me': {
      get: {
        tags: ['Auth'],
        summary: 'Current user',
        security: bearer,
        responses: {
          '200': success('The logged-in user', { type: 'object', properties: { user: ref('User') } }, { user: { ...dana, createdAt: TS } }),
          ...errorsFor(401),
        },
      },
    },

    // ---------------- Boards ----------------
    '/api/boards': {
      get: {
        tags: ['Boards'],
        summary: 'List my boards',
        description: 'Boards I own plus SHARED boards I am a member of. Newest first.',
        security: bearer,
        parameters: [
          query('search', { type: 'string', maxLength: 100 }, 'Search in name and description (case-insensitive)'),
          query('visibility', { type: 'string', enum: ['PRIVATE', 'SHARED'] }, 'Filter by visibility'),
          query('role', { type: 'string', enum: ['owner', 'member'] }, 'owner = boards I created, member = boards shared with me'),
          ...pageParams,
        ],
        responses: {
          '200': success('Boards', paginatedOf('Board'), { items: [exampleBoard], pagination: pagination(1) }),
          ...errorsFor(400, 401),
        },
      },
      post: {
        tags: ['Boards'],
        summary: 'Create a board',
        description: 'Any logged-in user. The creator becomes the owner.',
        security: bearer,
        requestBody: jsonBody(ref('CreateBoardInput'), { name: 'Final project', description: 'Shared board for the team', visibility: 'SHARED', isOpen: true }),
        responses: { '201': success('Created', ref('Board'), { ...exampleBoard, memberCount: 0 }), ...errorsFor(400, 401) },
      },
    },
    '/api/boards/join/{shareToken}': {
      post: {
        tags: ['Boards'],
        summary: 'Join a SHARED board with its share link',
        description:
          'Any logged-in user who has the link becomes a member (can view; can edit when the board is open). Joining again is harmless. Private boards or old (regenerated) tokens return 404.',
        security: bearer,
        parameters: [{ name: 'shareToken', in: 'path', required: true, schema: { type: 'string' }, description: 'Token from the share link' }],
        responses: {
          '200': success('The joined board', ref('Board'), {
            ...exampleBoard,
            shareToken: null,
            memberCount: 3,
            myAccess: { isOwner: false, isMember: true, canView: true, canEdit: true, canManage: false },
          }),
          ...errorsFor(401, 404),
        },
      },
    },
    '/api/boards/{boardId}': {
      parameters: [boardIdParam],
      get: {
        tags: ['Boards'],
        summary: 'Get a board',
        description: 'Owner or member. Includes `myAccess` with the current user\'s permissions.',
        security: bearer,
        responses: { '200': success('Board', ref('Board'), exampleBoard), ...errorsFor(400, 401, 404) },
      },
      patch: {
        tags: ['Boards'],
        summary: 'Update board settings',
        description: 'Owner only. Changing SHARED → PRIVATE requires removing all members first (409 BOARD_HAS_MEMBERS).',
        security: bearer,
        requestBody: jsonBody(ref('UpdateBoardInput'), { name: 'Final project — team', isOpen: false }),
        responses: {
          '200': success('Updated board', ref('Board'), { ...exampleBoard, name: 'Final project — team', isOpen: false }),
          ...errorsFor(400, 401, 403, 404),
          '409': errorResponse(409, 'Board still has members', { code: 'BOARD_HAS_MEMBERS', message: 'Remove all members before making the board private' }),
        },
      },
      delete: {
        tags: ['Boards'],
        summary: 'Delete a board',
        description: 'Owner only. Deletes its tasks, reminders and memberships too.',
        security: bearer,
        responses: { ...noContent, ...errorsFor(400, 401, 403, 404) },
      },
    },
    '/api/boards/{boardId}/share-link': {
      parameters: [boardIdParam],
      post: {
        tags: ['Boards'],
        summary: 'Create a new share link',
        description: 'Owner only, SHARED boards only. The old link stops working (existing members stay). The new token is in `shareToken`.',
        security: bearer,
        responses: {
          '200': success('Board with the new shareToken', ref('Board'), { ...exampleBoard, shareToken: 'N3wT0k3nAbCdEfGhIjKlMnOpQrStUv' }),
          '400': errorResponse(400, 'Board is private', { code: 'BOARD_IS_PRIVATE', message: 'Only SHARED boards have a share link' }),
          ...errorsFor(401, 403, 404),
        },
      },
    },

    // ---------------- Members ----------------
    '/api/boards/{boardId}/members': {
      parameters: [boardIdParam],
      get: {
        tags: ['Members'],
        summary: 'List board members',
        description: 'Owner or member. The owner is first (`isOwner: true`).',
        security: bearer,
        responses: {
          '200': success('Members', { type: 'array', items: ref('Member') }, [
            { user: dana, isOwner: true, joinedAt: TS },
            { user: noa, isOwner: false, joinedAt: TS },
          ]),
          ...errorsFor(400, 401, 404),
        },
      },
      post: {
        tags: ['Members'],
        summary: 'Add a member by email',
        description: 'Owner only, SHARED boards only. The user must already be registered.',
        security: bearer,
        requestBody: jsonBody(ref('AddMemberInput'), { email: 'noa@example.com' }),
        responses: {
          '201': success('Added', ref('Member'), { user: noa, isOwner: false, joinedAt: TS }),
          '400': errorResponse(400, 'Validation error, or board is PRIVATE (BOARD_IS_PRIVATE)'),
          ...errorsFor(401, 403),
          '404': errorResponse(404, 'Board not found, or no user with this email (USER_NOT_FOUND)', { code: 'USER_NOT_FOUND', message: 'No user is registered with this email' }),
          '409': errorResponse(409, 'Already a member (ALREADY_MEMBER) or is the owner (CANNOT_ADD_OWNER)', { code: 'ALREADY_MEMBER', message: 'This user is already a member of the board' }),
        },
      },
    },
    '/api/boards/{boardId}/members/{userId}': {
      parameters: [boardIdParam, pathParam('userId', 'User id of the member to remove')],
      delete: {
        tags: ['Members'],
        summary: 'Remove a member',
        description:
          'Owner only. The owner cannot be removed. Tasks/reminders created by the member stay on the board; the member is removed from task assignees and reminder recipients on this board.',
        security: bearer,
        responses: {
          ...noContent,
          '400': errorResponse(400, 'Validation error, or trying to remove the owner (CANNOT_REMOVE_OWNER)', { code: 'CANNOT_REMOVE_OWNER', message: 'The board owner cannot be removed' }),
          ...errorsFor(401, 403),
          '404': errorResponse(404, 'Board not found or user is not a member (MEMBER_NOT_FOUND)'),
        },
      },
    },

    // ---------------- Tasks ----------------
    '/api/boards/{boardId}/tasks': {
      parameters: [boardIdParam],
      get: {
        tags: ['Tasks'],
        summary: 'List tasks on a board (search & filters)',
        description:
          'Owner or member. Only tasks you may see are returned (BOARD tasks + SELECTED tasks you created or are assigned to). `from`/`to` keep date-only tasks whose day is in the range and timed tasks that overlap it.',
        security: bearer,
        parameters: [
          query('status', { type: 'string', example: 'TODO,IN_PROGRESS' }, 'One or more of TODO, IN_PROGRESS, DONE (comma-separated)'),
          query('priority', { type: 'string', example: 'HIGH' }, 'One or more of LOW, MEDIUM, HIGH (comma-separated)'),
          query('schedule', { type: 'string', enum: ['NONE', 'DATE', 'TIMED'] }, 'NONE = no date, DATE = date-only, TIMED = has start and end'),
          query('from', { type: 'string', format: 'date-time' }, 'Range start (ISO 8601 with timezone)'),
          query('to', { type: 'string', format: 'date-time' }, 'Range end (ISO 8601 with timezone)'),
          query('search', { type: 'string', maxLength: 100 }, 'Search in title and description'),
          query('assignedToMe', { type: 'boolean' }, 'Only tasks assigned to me'),
          query('sort', { type: 'string', enum: ['createdAt', 'updatedAt', 'title', 'startAt', 'dueDate'], default: 'createdAt' }, 'Sort field'),
          query('order', { type: 'string', enum: ['asc', 'desc'], default: 'desc' }, 'Sort direction'),
          ...pageParams,
        ],
        responses: {
          '200': success('Tasks', paginatedOf('Task'), { items: [exampleTask], pagination: pagination(1) }),
          ...errorsFor(400, 401, 404),
        },
      },
      post: {
        tags: ['Tasks'],
        summary: 'Create a task',
        description:
          'Requires edit permission (owner; or member of an open SHARED board). For a timed task the server re-checks — atomically — that the time is still free for the assignees (or the creator when nobody is assigned), across all their boards.',
        security: bearer,
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: ref('CreateTaskInput'),
              examples: {
                timed: {
                  summary: 'Timed task (e.g. after choosing a scheduling suggestion)',
                  value: { title: 'Prepare presentation', priority: 'HIGH', startAt: '2026-11-02T09:00:00Z', endAt: '2026-11-02T10:30:00Z', assigneeIds: [ID.noa] },
                },
                dateOnly: { summary: 'Date-only task', value: { title: 'Submit form', dueDate: '2026-11-05' } },
                unscheduled: { summary: 'No date', value: { title: 'Buy markers', priority: 'LOW' } },
                private: { summary: 'Private (SELECTED) task', value: { title: 'Personal note', audience: 'SELECTED', assigneeIds: [ID.dana] } },
              },
            },
          },
        },
        responses: {
          '201': success('Created', ref('Task'), exampleTask),
          '400': errorResponse(400, 'Validation error, or an assignee is not on the board (NOT_A_BOARD_MEMBER)'),
          ...errorsFor(401, 403, 404),
          '409': errorResponse(409, 'Time is already taken', {
            code: 'TIME_CONFLICT',
            message: 'The selected time overlaps another scheduled task',
            details: { conflicts: [{ startAt: '2026-11-02T09:30:00.000Z', endAt: '2026-11-02T11:00:00.000Z' }] },
          }),
        },
      },
    },
    '/api/tasks/{taskId}': {
      parameters: [pathParam('taskId', 'Task id')],
      get: {
        tags: ['Tasks'],
        summary: 'Get a task',
        security: bearer,
        responses: { '200': success('Task', ref('Task'), exampleTask), ...errorsFor(400, 401), '404': errorResponse(404, 'Task not found or not visible to you', { code: 'TASK_NOT_FOUND', message: 'Task not found' }) },
      },
      patch: {
        tags: ['Tasks'],
        summary: 'Update a task',
        description: 'Requires edit permission. Time changes are re-checked for conflicts (409 TIME_CONFLICT).',
        security: bearer,
        requestBody: jsonBody(ref('UpdateTaskInput'), { status: 'DONE' }),
        responses: {
          '200': success('Updated task', ref('Task'), { ...exampleTask, status: 'DONE' }),
          ...errorsFor(400, 401, 403),
          '404': errorResponse(404, 'Task not found', { code: 'TASK_NOT_FOUND', message: 'Task not found' }),
          '409': errorResponse(409, 'Time is already taken', { code: 'TIME_CONFLICT', message: 'The selected time overlaps another scheduled task' }),
        },
      },
      delete: {
        tags: ['Tasks'],
        summary: 'Delete a task',
        description: 'Requires edit permission.',
        security: bearer,
        responses: { ...noContent, ...errorsFor(400, 401, 403), '404': errorResponse(404, 'Task not found', { code: 'TASK_NOT_FOUND', message: 'Task not found' }) },
      },
    },

    // ---------------- Reminders ----------------
    '/api/boards/{boardId}/reminders': {
      parameters: [boardIdParam],
      get: {
        tags: ['Reminders'],
        summary: 'List reminders on a board',
        description: 'Owner or member. Sorted by remindAt (earliest first).',
        security: bearer,
        parameters: [
          query('from', { type: 'string', format: 'date-time' }, 'remindAt >= from'),
          query('to', { type: 'string', format: 'date-time' }, 'remindAt < to'),
          query('search', { type: 'string', maxLength: 100 }, 'Search in title and description'),
          ...pageParams,
        ],
        responses: {
          '200': success('Reminders', paginatedOf('Reminder'), { items: [exampleReminder], pagination: pagination(1) }),
          ...errorsFor(400, 401, 404),
        },
      },
      post: {
        tags: ['Reminders'],
        summary: 'Create a reminder',
        description: 'Requires edit permission. Reminders never block time.',
        security: bearer,
        requestBody: jsonBody(ref('CreateReminderInput'), { title: 'Submit the project form', remindAt: '2026-11-05T07:00:00Z', audience: 'SELECTED', recipientIds: [ID.noa] }),
        responses: {
          '201': success('Created', ref('Reminder'), exampleReminder),
          '400': errorResponse(400, 'Validation error, or a recipient is not on the board (NOT_A_BOARD_MEMBER)'),
          ...errorsFor(401, 403, 404),
        },
      },
    },
    '/api/reminders/{reminderId}': {
      parameters: [pathParam('reminderId', 'Reminder id')],
      get: {
        tags: ['Reminders'],
        summary: 'Get a reminder',
        security: bearer,
        responses: { '200': success('Reminder', ref('Reminder'), exampleReminder), ...errorsFor(400, 401), '404': errorResponse(404, 'Reminder not found', { code: 'REMINDER_NOT_FOUND', message: 'Reminder not found' }) },
      },
      patch: {
        tags: ['Reminders'],
        summary: 'Update a reminder',
        description: 'Requires edit permission. `recipientIds` replaces the whole list.',
        security: bearer,
        requestBody: jsonBody(ref('UpdateReminderInput'), { remindAt: '2026-11-05T08:00:00Z' }),
        responses: {
          '200': success('Updated reminder', ref('Reminder'), { ...exampleReminder, remindAt: '2026-11-05T08:00:00.000Z' }),
          ...errorsFor(400, 401, 403),
          '404': errorResponse(404, 'Reminder not found', { code: 'REMINDER_NOT_FOUND', message: 'Reminder not found' }),
        },
      },
      delete: {
        tags: ['Reminders'],
        summary: 'Delete a reminder',
        description: 'Requires edit permission.',
        security: bearer,
        responses: { ...noContent, ...errorsFor(400, 401, 403), '404': errorResponse(404, 'Reminder not found', { code: 'REMINDER_NOT_FOUND', message: 'Reminder not found' }) },
      },
    },

    // ---------------- Calendar ----------------
    '/api/boards/{boardId}/calendar': {
      parameters: [boardIdParam],
      get: {
        tags: ['Calendar'],
        summary: 'Calendar events (tasks + reminders) in a range',
        description:
          'Owner or member. Timed tasks overlapping the range, date-only tasks (as all-day events) whose day is in the range, and reminders in the range. Unscheduled tasks are not included (use the task list). Max range 366 days.',
        security: bearer,
        parameters: [
          query('from', { type: 'string', format: 'date-time' }, 'Range start, e.g. 2026-11-01T00:00:00Z', true),
          query('to', { type: 'string', format: 'date-time' }, 'Range end, e.g. 2026-12-01T00:00:00Z', true),
        ],
        responses: {
          '200': success(
            'Events sorted by time (all-day items first on their day)',
            {
              type: 'object',
              required: ['from', 'to', 'events'],
              properties: { from: { type: 'string', format: 'date-time' }, to: { type: 'string', format: 'date-time' }, events: { type: 'array', items: ref('CalendarEvent') } },
            },
            {
              from: '2026-11-01T00:00:00.000Z',
              to: '2026-12-01T00:00:00.000Z',
              events: [
                { type: 'TASK', id: ID.task, boardId: ID.board, title: 'Submit form', description: null, allDay: true, date: '2026-11-02', startAt: null, endAt: null, blocksTime: false, status: 'TODO', priority: 'MEDIUM', audience: 'BOARD' },
                { type: 'TASK', id: ID.task, boardId: ID.board, title: 'Prepare presentation', description: null, allDay: false, date: null, startAt: '2026-11-02T09:00:00.000Z', endAt: '2026-11-02T10:30:00.000Z', blocksTime: true, status: 'TODO', priority: 'HIGH', audience: 'BOARD' },
                { type: 'REMINDER', id: ID.reminder, boardId: ID.board, title: 'Call the teacher', description: null, allDay: false, date: null, startAt: '2026-11-02T12:00:00.000Z', endAt: null, blocksTime: false, status: null, priority: null, audience: 'BOARD' },
              ],
            },
          ),
          ...errorsFor(400, 401, 404),
        },
      },
    },
    '/api/boards/{boardId}/scheduling/suggestions': {
      parameters: [boardIdParam],
      post: {
        tags: ['Calendar'],
        summary: 'Suggest free time slots',
        description:
          'Owner or member. Finds free slots for `assignedUserId` (default: me), who must be the board owner or a member. Busy time = that user\'s timed, not-DONE tasks on ALL boards. Reminders, date-only tasks, unscheduled tasks and DONE tasks are ignored. Slots are cut back-to-back from each free gap inside [from, to), earliest first. Nothing is saved — create the task with POST /api/boards/{boardId}/tasks.',
        security: bearer,
        requestBody: jsonBody(ref('SchedulingInput'), { durationMinutes: 90, from: '2026-11-02T08:00:00Z', to: '2026-11-02T16:00:00Z', maxSuggestions: 3 }),
        responses: {
          '200': success(
            'Suggestions (empty array when nothing fits)',
            { type: 'object', required: ['suggestions'], properties: { suggestions: { type: 'array', items: ref('TimeSlot') } } },
            {
              suggestions: [
                { startAt: '2026-11-02T08:00:00.000Z', endAt: '2026-11-02T09:30:00.000Z' },
                { startAt: '2026-11-02T11:00:00.000Z', endAt: '2026-11-02T12:30:00.000Z' },
                { startAt: '2026-11-02T12:30:00.000Z', endAt: '2026-11-02T14:00:00.000Z' },
              ],
            },
          ),
          '400': errorResponse(400, 'Validation error, or the user is not on the board (NOT_A_BOARD_MEMBER)'),
          ...errorsFor(401, 404),
        },
      },
    },
  },
};
