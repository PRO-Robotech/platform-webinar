import { chapters } from '../flow.ts';
import { mountAtlas } from './atlas-app.ts';
import { mountViewSwitcher } from './view-switcher.ts';

mountAtlas(chapters);
mountViewSwitcher(chapters.map(chapter => chapter.beats.length));
