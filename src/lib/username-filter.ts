import { RegExpMatcher, englishDataset, englishRecommendedTransformers } from 'obscenity';

const matcher = new RegExpMatcher({
  ...englishDataset.build(),
  ...englishRecommendedTransformers,
});

/** Reserved handles people shouldn't be able to impersonate. Matched as the whole
 *  normalized username (optionally followed by digits) to avoid false positives like
 *  "modern" (contains "mod") or "badminton" (contains "admin"). */
const RESERVED = [
  'admin', 'administrator', 'official', 'moderator', 'mod',
  'staff', 'support', 'owner', 'root', 'system',
];
const RESERVED_RE = new RegExp(`^(${RESERVED.join('|')})\\d*$`);

/** Reject reserved handles and profanity/slurs (obfuscation-aware). Runs AFTER the
 *  format check in `validateUsername`, at every username entry point. */
export function checkUsernameAllowed(value: string): { ok: true } | { ok: false; error: string } {
  const normalized = value.toLowerCase().replace(/_/g, '');
  if (RESERVED_RE.test(normalized)) {
    return { ok: false, error: 'That username is reserved — please choose another.' };
  }
  if (matcher.hasMatch(value)) {
    return { ok: false, error: 'That username contains language that isn’t allowed.' };
  }
  return { ok: true };
}
