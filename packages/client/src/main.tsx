import Phaser from 'phaser';
import { render } from 'preact';
import { App } from './ui/App';
import { t } from './i18n/t';
import './style.css';

const gameRoot = document.querySelector<HTMLDivElement>('#game');
const uiRoot = document.querySelector<HTMLDivElement>('#ui');

if (!gameRoot || !uiRoot) {
  throw new Error('Missing application roots');
}

document.title = t('ui.title');

new Phaser.Game({
  type: Phaser.AUTO,
  parent: gameRoot,
  backgroundColor: '#163c57',
  scale: {
    mode: Phaser.Scale.RESIZE,
    width: window.innerWidth,
    height: window.innerHeight,
  },
  scene: {},
});

render(<App />, uiRoot);
