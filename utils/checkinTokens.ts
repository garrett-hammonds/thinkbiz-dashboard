import { SignJWT, jwtVerify } from 'jose';

// A member's personal check-in QR encodes one of these tokens. The token is
// deliberately permanent (no expiry): it only identifies the member, it does
// not grant anything by itself. Every scan re-checks, at scan time, that the
// member is active and belongs to the scanning director's club — so removing
// a member instantly invalidates their code without any revocation list.
const ISSUER = 'thinkbiz-checkin';
const AUDIENCE = 'thinkbiz-checkin';

function getSecret(): Uint8Array {
  // Prefer a dedicated secret; fall back to the director-invite secret so
  // existing deployments work with zero new configuration. The issuer and
  // audience claims keep the two token families from being interchangeable
  // even when they share a key.
  const secret =
    process.env.CHECKIN_QR_SECRET || process.env.DIRECTOR_INVITE_SECRET;
  if (!secret) {
    throw new Error(
      'Neither CHECKIN_QR_SECRET nor DIRECTOR_INVITE_SECRET is set. Check-in QR codes cannot be signed or verified.',
    );
  }
  return new TextEncoder().encode(secret);
}

export async function createCheckinToken(memberId: string): Promise<string> {
  return await new SignJWT({ memberId })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .sign(getSecret());
}

// Returns the member id, or throws when the token is missing, forged, or
// from a different token family.
export async function verifyCheckinToken(token: string): Promise<string> {
  const { payload } = await jwtVerify(token, getSecret(), {
    issuer: ISSUER,
    audience: AUDIENCE,
    // Pin the accepted algorithm as defense-in-depth against alg
    // substitution, mirroring utils/inviteTokens.ts.
    algorithms: ['HS256'],
  });

  const memberId = typeof payload.memberId === 'string' ? payload.memberId : null;
  if (!memberId) {
    throw new Error('Check-in token payload missing memberId.');
  }
  return memberId;
}
