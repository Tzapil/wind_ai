import i18next from 'i18next';
import ICU from 'i18next-icu';
import ui from '../../locales/ru/ui.json';
import goods from '../../locales/ru/goods.json';
import ports from '../../locales/ru/ports.json';
import events from '../../locales/ru/events.json';
import tutorial from '../../locales/ru/tutorial.json';

export type TranslationKey =
  | keyof typeof ui
  | keyof typeof goods
  | keyof typeof ports
  | keyof typeof events
  | keyof typeof tutorial;
export type UnitKey = Extract<keyof typeof goods, `goods.${string}.unit`>;

const i18n = i18next.createInstance();

void i18n.use(ICU).init({
  lng: 'ru',
  fallbackLng: 'ru',
  initAsync: false,
  keySeparator: false,
  resources: {
    ru: {
      translation: { ...ui, ...goods, ...ports, ...events, ...tutorial },
    },
  },
});

export function t(
  key: TranslationKey,
  options?: Record<string, string | number>,
): string {
  return options ? i18n.t(key, options) : i18n.t(key);
}
