import { chapters } from '../flow.ts';
import { createFlightContent } from './flight.ts';
import { mountFlight } from './flight-app.ts';
import { mountViewSwitcher } from './view-switcher.ts';

mountFlight(createFlightContent(chapters));
mountViewSwitcher(chapters.map(chapter => chapter.beats.length));
