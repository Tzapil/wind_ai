import { describe, expect, it } from 'vitest';
import { t } from '../src/i18n/t';

describe('client scaffold', () => {
  it('reads the placeholder translation', () => {
    expect(document).toBeDefined();
    expect(t('ui.placeholder')).toBe('Попутного ветра');
  });
});
