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
  const expectedPhotos = new Map([
    ['koffi-king', ['/images/koffi-king.jpg']],
    ['kutcherita-cafe', ['/images/kutcherita-cafe.jpg']],
    ['the-sifted-cafe', ['/images/sifted-cafe-front.jpg', '/images/sifted-cafe-interior.jpg']],
    ['drip-and-grind-coffee', ['/images/drip-and-grind.jpg']],
    ['moonbucks-bayan', ['/images/moonbucks-front.jpg', '/images/moonbucks-interior.jpg']],
    ['cafetribu-calamba', ['/images/cafe-tribu.jpg']],
    ['250-cafe', ['/images/250-cafe-exterior.jpg', '/images/250-cafe-interior.jpg']],
    ['dose-dos-cafe', ['/images/dose-dos-cafe.jpg']],
  ]);

  for (const [shopId, photos] of expectedPhotos) {
    const shop = INITIAL_COFFEE_SHOPS.find((entry) => entry.id === shopId);
    assert.deepEqual(shop?.galleryImages, photos, `photo mapping for ${shopId}`);
    for (const photo of photos) {
      const asset = readFileSync(new URL(`../../public${photo}`, import.meta.url));
      assert.ok(asset.byteLength > 10_000, `photo asset exists: ${photo}`);
    }
  }
});
