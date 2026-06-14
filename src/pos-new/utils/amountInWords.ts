const belowTwenty = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const tens = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

function chunkToWords(value: number): string {
  const words: string[] = [];
  const hundreds = Math.floor(value / 100);
  const rest = value % 100;
  if (hundreds) words.push(`${belowTwenty[hundreds]} hundred`);
  if (rest < 20) {
    if (rest) words.push(belowTwenty[rest]);
  } else {
    const ten = Math.floor(rest / 10);
    const unit = rest % 10;
    words.push(unit ? `${tens[ten]}-${belowTwenty[unit]}` : tens[ten]);
  }
  return words.join(' ');
}

function integerToWords(value: number): string {
  if (value === 0) return 'zero';
  const scales = ['', 'thousand', 'million', 'billion'];
  const parts: string[] = [];
  let remaining = Math.floor(Math.abs(value));
  let scale = 0;
  while (remaining > 0) {
    const chunk = remaining % 1000;
    if (chunk) parts.unshift(`${chunkToWords(chunk)} ${scales[scale]}`.trim());
    remaining = Math.floor(remaining / 1000);
    scale += 1;
  }
  return parts.join(' ');
}

export function amountInWords(amount: number, currency = 'dollars'): string {
  const safe = Number.isFinite(amount) ? Math.max(0, amount) : 0;
  const dollars = Math.floor(safe);
  const cents = Math.round((safe - dollars) * 100);
  const dollarWords = `${integerToWords(dollars)} ${currency}`;
  const centWords = cents > 0 ? ` and ${integerToWords(cents)} cents` : ' only';
  return `${dollarWords}${centWords}`.replace(/^\w/, (letter) => letter.toUpperCase());
}
