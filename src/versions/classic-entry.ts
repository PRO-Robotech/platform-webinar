import { chapters } from '../flow.ts';
import { render } from '../diagram.ts';
import { mountClassic } from './classic.ts';
import { mountViewSwitcher } from './view-switcher.ts';

mountClassic(chapters, render);
mountViewSwitcher(chapters.map(chapter => chapter.beats.length));
