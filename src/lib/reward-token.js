import { createHash } from 'node:crypto';

export function rewardToken(act, salt) {
  return salt ? createHash('sha256').update(salt + '|reward-v1|' + act).digest('hex').slice(0, 40) : '';
}
