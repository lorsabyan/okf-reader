import { describe, expect, test } from 'bun:test';
import { isSafeResourceUrl } from './resource-url';

describe('isSafeResourceUrl', () => {
  test('accepts absolute http(s) URLs', () => {
    expect(isSafeResourceUrl('https://example.com/spec.pdf')).toBe(true);
    expect(isSafeResourceUrl('http://example.com')).toBe(true);
  });

  test('accepts a mixed-case scheme on an otherwise safe URL', () => {
    expect(isSafeResourceUrl('HTTPS://example.com')).toBe(true);
    expect(isSafeResourceUrl('HttP://example.com')).toBe(true);
  });

  test('rejects javascript: URLs', () => {
    expect(isSafeResourceUrl('javascript:alert(1)')).toBe(false);
  });

  test('rejects data: URLs', () => {
    expect(isSafeResourceUrl('data:text/html,<script>alert(1)</script>')).toBe(false);
  });

  test('rejects vbscript: URLs', () => {
    expect(isSafeResourceUrl('vbscript:msgbox(1)')).toBe(false);
  });

  test('rejects protocol-relative URLs', () => {
    expect(isSafeResourceUrl('//evil.example.com/payload.js')).toBe(false);
  });

  test('rejects mixed-case dangerous schemes', () => {
    expect(isSafeResourceUrl('JaVaScRiPt:alert(1)')).toBe(false);
  });

  test('rejects whitespace-prefixed URLs', () => {
    expect(isSafeResourceUrl(' javascript:alert(1)')).toBe(false);
    expect(isSafeResourceUrl('\thttps://example.com')).toBe(false);
  });

  test('rejects a bare path or relative reference', () => {
    expect(isSafeResourceUrl('example.com')).toBe(false);
    expect(isSafeResourceUrl('/local/path')).toBe(false);
  });
});
