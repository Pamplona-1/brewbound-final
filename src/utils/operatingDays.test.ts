import test from 'node:test';
import assert from 'node:assert/strict';

import { parseOperatingDays } from './operatingDays';

test('parseOperatingDays expands weekday ranges', () => {
  assert.deepEqual(parseOperatingDays('Tuesday to Sunday'), [1, 2, 3, 4, 5, 6]);
  assert.deepEqual(parseOperatingDays('Mon-Sun'), [0, 1, 2, 3, 4, 5, 6]);
  assert.deepEqual(parseOperatingDays('Fri-Mon'), [0, 4, 5, 6]);
});

test('parseOperatingDays preserves specific days alongside ranges', () => {
  assert.deepEqual(parseOperatingDays('Mon, Wed-Fri'), [0, 2, 3, 4]);
  assert.deepEqual(parseOperatingDays('Tuesday, Thursday'), [1, 3]);
});

test('parseOperatingDays recognizes daily schedules', () => {
  assert.deepEqual(parseOperatingDays('Daily'), [0, 1, 2, 3, 4, 5, 6]);
  assert.deepEqual(parseOperatingDays('Every day'), [0, 1, 2, 3, 4, 5, 6]);
});
