export interface ProductNumberValidation {
  valid: boolean;
  normalized: string;
  message?: string;
}

export function normalizeProductNumericNumber(value: string | number): string {
  const digits = String(value).replace(/\D/g, '').slice(0, 9);
  return digits.padStart(9, '0');
}

export function validateProductNumericNumber(value: string): ProductNumberValidation {
  if (!/^\d*$/.test(value)) {
    return {
      valid: false,
      normalized: normalizeProductNumericNumber(value),
      message: 'Product numeric number must contain numbers only.'
    };
  }

  if (value.length > 9) {
    return {
      valid: false,
      normalized: normalizeProductNumericNumber(value),
      message: 'Product numeric number cannot exceed 9 digits.'
    };
  }

  return {
    valid: true,
    normalized: normalizeProductNumericNumber(value)
  };
}

export function generateProductNumericNumber(existingNumbers: string[]): string {
  const used = new Set(existingNumbers.map((value) => normalizeProductNumericNumber(value)));
  for (let next = 1; next <= 999999999; next += 1) {
    const candidate = normalizeProductNumericNumber(next);
    if (!used.has(candidate)) {
      return candidate;
    }
  }
  return '999999999';
}
