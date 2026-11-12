import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { INITIAL_COFFEE_SHOPS } from './coffeeShops';

test('deployment snapshot contains the exported shops and panorama photo', () => {
  assert.equal(INITIAL_COFFEE_SHOPS.length, 10);
  assert.ok(INITIAL_COFFEE_SHOPS.some((shop) => shop.id === 'dose-dos-cafe'));

  const shopWithPanorama = INITIAL_COFFEE_SHOPS.find((shop) => shop.id === '250-cafe');
  assert.equal(shopWithPanorama?.panorama360Url, '/images/250-cafe-panorama.jpg');
  const panorama = readFileSync(new URL('../../public/images/250-cafe-panorama.jpg', import.meta.url));
  assert.ok(panorama.byteLength > 100_000);
});

test('deployment snapshot maps submitted cafe photos to the matching shops', () => {
  const expectedPhotoCounts = new Map([
    ['koffi-king', 1],
    ['kutcherita-cafe', 1],
    ['the-sifted-cafe', 1],
    ['drip-and-grind-coffee', 1],
    ['moonbucks-bayan', 2],
    ['cafetribu-calamba', 1],
    ['the-outdoor-cafe', 1],
    ['for-coffee', 1],
    ['250-cafe', 2],
    ['dose-dos-cafe', 1],
  ]);

  for (const [shopId, photoCount] of expectedPhotoCounts) {
    const shop = INITIAL_COFFEE_SHOPS.find((entry) => entry.id === shopId);
    assert.equal(shop?.galleryImages.length, photoCount, `photo mapping for ${shopId}`);
    for (const photo of shop?.galleryImages ?? []) {
      if (photo.startsWith('data:image/')) {
        assert.ok(photo.length <= 45_000, `inline photo is small enough for Sheets: ${shopId}`);
      } else {
        const asset = readFileSync(new URL(`../../public${photo}`, import.meta.url));
        assert.ok(asset.byteLength > 10_000, `photo asset exists: ${photo}`);
      }
    }
  }
});
