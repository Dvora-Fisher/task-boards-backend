export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'INVALID_JSON'
  | 'UNAUTHORIZED'
  | 'INVALID_TOKEN'
  | 'INVALID_CREDENTIALS'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'BOARD_NOT_FOUND'
  | 'TASK_NOT_FOUND'
  | 'REMINDER_NOT_FOUND'
  | 'USER_NOT_FOUND'
  | 'MEMBER_NOT_FOUND'
  | 'EMAIL_TAKEN'
  | 'ALREADY_MEMBER'
  | 'BOARD_IS_PRIVATE'
  | 'BOARD_HAS_MEMBERS'
  | 'CANNOT_ADD_OWNER'
  | 'CANNOT_REMOVE_OWNER'
  | 'NOT_A_BOARD_MEMBER'
  | 'TIME_CONFLICT'
  | 'RATE_LIMITED'
  | 'INTERNAL_ERROR';

export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: ErrorCode,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const errors = {
  unauthorized: (message = 'Authentication required') => new AppError(401, 'UNAUTHORIZED', message),
  invalidToken: (message = 'Token is invalid or expired') => new AppError(401, 'INVALID_TOKEN', message),
  forbidden: (message = 'You do not have permission to perform this action') =>
    new AppError(403, 'FORBIDDEN', message),
  boardNotFound: () => new AppError(404, 'BOARD_NOT_FOUND', 'Board not found'),
  taskNotFound: () => new AppError(404, 'TASK_NOT_FOUND', 'Task not found'),
  reminderNotFound: () => new AppError(404, 'REMINDER_NOT_FOUND', 'Reminder not found'),
};
