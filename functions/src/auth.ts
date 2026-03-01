import { HttpRequest } from '@azure/functions';
import { votekeepersTable } from './storage.js';
import { AuthUser, VotekeeperEntity } from './types.js';

export type { AuthUser };

/**
 * Parse the SWA auth header to get user info.
 * In production, SWA forwards x-ms-client-principal automatically.
 * In local dev, the frontend sends it as a header from mock auth.
 */
export function getAuthUser(request: HttpRequest): AuthUser | null {
  const clientPrincipal = request.headers.get('x-ms-client-principal');

  if (!clientPrincipal) {
    return null;
  }

  try {
    const decoded = Buffer.from(clientPrincipal, 'base64').toString('utf8');
    const principal = JSON.parse(decoded);

    return {
      userId: principal.userId,
      userDetails: principal.userDetails,
      identityProvider: principal.identityProvider,
      userRoles: principal.userRoles || [],
    };
  } catch (error) {
    console.error('Failed to parse client principal:', error);
    return null;
  }
}

export async function isVotekeeper(email: string): Promise<boolean> {
  if (!email) return false;
  try {
    const entity = await votekeepersTable.getEntity<VotekeeperEntity>('votekeeper', email.toLowerCase());
    return !!entity;
  } catch (error: any) {
    if (error.statusCode === 404) return false;
    throw error;
  }
}

export function requireAuth(request: HttpRequest): AuthUser {
  const user = getAuthUser(request);
  if (!user) {
    throw new AuthError('Authentication required', 401);
  }
  return user;
}

export async function requireVotekeeper(request: HttpRequest): Promise<AuthUser> {
  const user = requireAuth(request);
  const isKeeper = await isVotekeeper(user.userDetails);
  if (!isKeeper) {
    throw new AuthError('Votekeeper access required', 403);
  }
  return user;
}

export class AuthError extends Error {
  constructor(message: string, public statusCode: number) {
    super(message);
    this.name = 'AuthError';
  }
}
