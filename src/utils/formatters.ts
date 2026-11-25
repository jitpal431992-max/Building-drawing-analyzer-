/**
 * Format number or string as Indian Currency (INR)
 * e.g. 1417 -> "1,417" or "₹ 1,417"
 */
export function formatRateINR(r: string | number | null | undefined, includeSymbol = true): string {
  if (r === null || r === undefined || r === '') return '–';
  const num = typeof r === 'string' ? parseFloat(r) : r;
  if (isNaN(num)) return '–';
  const formatted = num.toLocaleString('en-IN', {
    maximumFractionDigits: 2,
    minimumFractionDigits: num % 1 !== 0 ? 2 : 0,
  });
  return includeSymbol ? `₹ ${formatted}` : formatted;
}

export function formatINR(amount: number, includeSymbol = true): string {
  if (isNaN(amount)) return includeSymbol ? '₹ 0.00' : '0.00';
  const formatted = new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);

  return includeSymbol ? `₹ ${formatted}` : formatted;
}

/**
 * Convert number to Indian currency words
 */
export function numberToIndianWords(num: number): string {
  if (isNaN(num) || num === 0) return 'Zero Rupees Only';

  const a = [
    '', 'One ', 'Two ', 'Three ', 'Four ', 'Five ', 'Six ', 'Seven ', 'Eight ', 'Nine ', 'Ten ',
    'Eleven ', 'Twelve ', 'Thirteen ', 'Fourteen ', 'Fifteen ', 'Sixteen ', 'Seventeen ', 'Eighteen ', 'Nineteen '
  ];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  function inWords(n: number): string {
    let str = '';
    if (n > 19) {
      str += b[Math.floor(n / 10)] + ' ' + a[n % 10];
    } else {
      str += a[n];
    }
    return str;
  }

  const crore = Math.floor(num / 10000000);
  num %= 10000000;
  const lakh = Math.floor(num / 100000);
  num %= 100000;
  const thousand = Math.floor(num / 1000);
  num %= 1000;
  const hundred = Math.floor(num / 100);
  const remaining = Math.floor(num % 100);

  let out = '';
  if (crore > 0) out += inWords(crore) + 'Crore ';
  if (lakh > 0) out += inWords(lakh) + 'Lakh ';
  if (thousand > 0) out += inWords(thousand) + 'Thousand ';
  if (hundred > 0) out += inWords(hundred) + 'Hundred ';
  if (remaining > 0) out += inWords(remaining);

  return (out.trim() + ' Rupees Only');
}
