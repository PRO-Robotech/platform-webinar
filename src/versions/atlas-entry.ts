import { chapters } from '../flow.ts';
import { mountAtlas } from './atlas-app.ts';

// The atlas is the default view, so it carries no view switcher of its own;
// the other variants still list it in theirs.
mountAtlas(chapters);
