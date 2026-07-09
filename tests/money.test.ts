import { describe, expect, it } from 'vitest';
import { formatCOP, parseAmount } from '../lib/money';

describe('formatCOP', () => {
  it('separa miles con punto', () => {
    expect(formatCOP(1234567)).toBe('$1.234.567');
    expect(formatCOP(0)).toBe('$0');
    expect(formatCOP(-50000)).toBe('-$50.000');
  });
});

describe('parseAmount', () => {
  it('acepta dígitos planos', () => {
    expect(parseAmount('50000')).toBe(50000);
  });

  it('acepta formato colombiano con puntos de miles', () => {
    expect(parseAmount('50.000')).toBe(50000);
  });

  it('acepta varios grupos de miles', () => {
    expect(parseAmount('1.234.567')).toBe(1234567);
  });

  it('acepta cero', () => {
    expect(parseAmount('0')).toBe(0);
  });

  it('rechaza decimales', () => {
    expect(Number.isNaN(parseAmount('12.5'))).toBe(true);
  });

  it('rechaza texto vacío', () => {
    expect(Number.isNaN(parseAmount(''))).toBe(true);
  });

  it('rechaza texto no numérico', () => {
    expect(Number.isNaN(parseAmount('abc'))).toBe(true);
  });
});
