import { Router } from 'express';
import * as auth from '../controllers/auth.controller.js';
import * as boards from '../controllers/board.controller.js';
import * as tasks from '../controllers/task.controller.js';
import * as reminders from '../controllers/reminder.controller.js';
import * as calendar from '../controllers/calendar.controller.js';
import { health } from '../controllers/health.controller.js';
import { authenticate } from '../middleware/authenticate.js';
import { authRateLimiter } from '../middleware/rateLimit.js';

/** All routes are mounted under /api (see app.ts). */
export const apiRouter = Router();

// ---- public ----
apiRouter.get('/health', health);
apiRouter.post('/auth/register', authRateLimiter, auth.register);
apiRouter.post('/auth/login', authRateLimiter, auth.login);

// ---- everything below requires a Bearer token ----
apiRouter.use(authenticate);

apiRouter.post('/auth/logout', auth.logout);
apiRouter.get('/auth/me', auth.me);

apiRouter.get('/boards', boards.list);
apiRouter.post('/boards', boards.create);
apiRouter.post('/boards/join/:shareToken', boards.join);
apiRouter.get('/boards/:boardId', boards.get);
apiRouter.patch('/boards/:boardId', boards.update);
apiRouter.delete('/boards/:boardId', boards.remove);
apiRouter.post('/boards/:boardId/share-link', boards.regenerateShareLink);

apiRouter.get('/boards/:boardId/members', boards.listMembers);
apiRouter.post('/boards/:boardId/members', boards.addMember);
apiRouter.delete('/boards/:boardId/members/:userId', boards.removeMember);

apiRouter.get('/boards/:boardId/tasks', tasks.list);
apiRouter.post('/boards/:boardId/tasks', tasks.create);
apiRouter.get('/tasks/:taskId', tasks.get);
apiRouter.patch('/tasks/:taskId', tasks.update);
apiRouter.delete('/tasks/:taskId', tasks.remove);

apiRouter.get('/boards/:boardId/reminders', reminders.list);
apiRouter.post('/boards/:boardId/reminders', reminders.create);
apiRouter.get('/reminders/:reminderId', reminders.get);
apiRouter.patch('/reminders/:reminderId', reminders.update);
apiRouter.delete('/reminders/:reminderId', reminders.remove);

apiRouter.get('/boards/:boardId/calendar', calendar.calendar);
apiRouter.post('/boards/:boardId/scheduling/suggestions', calendar.suggestions);
