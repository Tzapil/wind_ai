import { describe, expect, it } from 'vitest';

describe('core scaffold', () => {
  it('runs in Node', () => {
    expect(typeof window).toBe('undefined');
  });
});
