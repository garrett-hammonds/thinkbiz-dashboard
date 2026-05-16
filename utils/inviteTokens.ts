import { SignJWT, jwtVerify } from 'jose';

const ISSUER = 'thinkbiz-director-invite';
const AUDIENCE = 'thinkbiz-director-invite';
const TOKEN_TTL = '7d';

function getSecret(): Uint8Array {
  const secret = process.env.DIRECTOR_INVITE_SECRET;
  if (!secret) {
    throw new Error(
      'DIRECTOR_INVITE_SECRET is not set. Director invite links cannot be signed or verified.',
    );
  }
  return new TextEncoder().encode(secret);
}

export interface DirectorInviteClaims {
  email: string;
  clubId: string;
}

export async function createDirectorInviteToken(claims: DirectorInviteClaims): Promise<string> {
  return await new SignJWT({ email: claims.email.toLowerCase(), clubId: claims.clubId })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(TOKEN_TTL)
    .sign(getSecret());
}

export async function verifyDirectorInviteToken(token: string): Promise<DirectorInviteClaims> {
  const { payload } = await jwtVerify(token, getSecret(), {
    issuer: ISSUER,
    audience: AUDIENCE,
  });

  const email = typeof payload.email === 'string' ? payload.email : null;
  const clubId = typeof payload.clubId === 'string' ? payload.clubId : null;

  if (!email || !clubId) {
    throw new Error('Invite token payload missing email or clubId.');
  }

  return { email, clubId };
}
