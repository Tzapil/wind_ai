import ui from '../../locales/ru/ui.json';

export function t(key: keyof typeof ui): string {
  return ui[key];
}
