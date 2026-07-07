const CHARSET = '23456789ABCDEFGHJKMNPQRSTVWXYZ';

export function generateLicenseCode(prefix = 'POS'): string {
  const part1 = Array.from({ length: 4 }, () => CHARSET[Math.floor(Math.random() * CHARSET.length)]).join('');
  const part2 = Array.from({ length: 4 }, () => CHARSET[Math.floor(Math.random() * CHARSET.length)]).join('');
  return `${prefix}-${part1}-${part2}`;
}
