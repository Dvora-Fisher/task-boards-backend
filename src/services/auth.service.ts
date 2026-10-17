import { prisma } from '../db/prisma.js';
import { Prisma } from '../generated/prisma/client.js';
import { hashPassword, verifyPassword } from '../auth/password.js';
import { signAccessToken } from '../auth/jwt.js';
import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';
import { toUserDto, type UserDto } from '../utils/serializers.js';
import type { LoginInput, RegisterInput } from '../validation/auth.schemas.js';

export interface AuthResult {
  user: UserDto;
  accessToken: string;
  tokenType: 'Bearer';
  expiresAt: string;
}

// Used when the email does not exist, so a failed login takes about as long either way.
let dummyHash: Promise<string> | undefined;

async function startSession(user: { id: string; email: string; name: string; createdAt: Date }): Promise<AuthResult> {
  const expiresAt = new Date(Date.now() + env.JWT_EXPIRES_IN_MINUTES * 60_000);
  const session = await prisma.session.create({ data: { userId: user.id, expiresAt } });
  return {
    user: toUserDto(user),
    accessToken: signAccessToken({ sub: user.id, sid: session.id }),
    tokenType: 'Bearer',
    expiresAt: expiresAt.toISOString(),
  };
}

export async function register(input: RegisterInput): Promise<AuthResult> {
  const passwordHash = await hashPassword(input.password);
  try {
    const user = await prisma.user.create({ data: { email: input.email, name: input.name, passwordHash } });
    return await startSession(user);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new AppError(409, 'EMAIL_TAKEN', 'An account with this email already exists');
    }
    throw err;
  }
}

export async function login(input: LoginInput): Promise<AuthResult> {
  const user = await prisma.user.findUnique({ where: { email: input.email } });
  if (!user) {
    dummyHash ??= hashPassword('dummy-password-for-timing');
    await verifyPassword(await dummyHash, input.password);
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect');
  }
  const ok = await verifyPassword(user.passwordHash, input.password);
  if (!ok) throw new AppError(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect');
  return startSession(user);
}

export async function logout(sessionId: string): Promise<void> {
  await prisma.session.updateMany({ where: { id: sessionId, revokedAt: null }, data: { revokedAt: new Date() } });
}

export async function getMe(userId: string): Promise<UserDto> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new AppError(401, 'INVALID_TOKEN', 'User no longer exists');
  return toUserDto(user);
}
