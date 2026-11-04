import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeSheetCoffeeShop } from './googleSheets';

test('normalizeSheetCoffeeShop converts sheet strings to the app types', () => {
    const normalized = normalizeSheetCoffeeShop({
        id: 'cafe-1',
        name: 'Sample Cafe',
        barangayId: '2',
        barangayName: 'Barangay 2',
        address: '123 Example St',
        landmark: 'Town Plaza',
        priceRange: '₱100-₱200',
        operatingHoursText: '8:00 AM - 10:00 PM',
        daysOpen: 'Mon-Sun',
        panorama360Url: 'https://example.com/panorama',
        navigationCount: '14',
        description: 'Cozy cafe',
    });

    assert.equal(normalized.barangayId, 2);
    assert.equal(normalized.navigationCount, 14);
    assert.equal(normalized.name, 'Sample Cafe');
    assert.equal(normalized.description, 'Cozy cafe');
});

test('normalizeSheetCoffeeShop restores nested records and uploaded gallery photos', () => {
    const normalized = normalizeSheetCoffeeShop({
        id: 'cafe-2',
        verified: 'true',
        amenities: JSON.stringify({ wifiAvailable: true, outletCount: 6 }),
        menu: JSON.stringify([{ name: 'Latte', price: 120 }]),
        reviews: JSON.stringify([]),
        socials: JSON.stringify({ facebook: 'https://example.com' }),
        galleryImage1: 'data:image/jpeg;base64,photo-one',
        galleryImage2: 'data:image/jpeg;base64,photo-two',
    });

    assert.equal(normalized.verified, true);
    assert.deepEqual(normalized.amenities, { wifiAvailable: true, outletCount: 6 });
    assert.deepEqual(normalized.menu, [{ name: 'Latte', price: 120 }]);
    assert.deepEqual(normalized.socials, { facebook: 'https://example.com' });
    assert.deepEqual(normalized.galleryImages, [
        'data:image/jpeg;base64,photo-one',
        'data:image/jpeg;base64,photo-two',
    ]);
});

test('normalizeSheetCoffeeShop preserves intentional photo clearing', () => {
    const normalized = normalizeSheetCoffeeShop({
        id: 'cafe-3',
        galleryImage1: '',
        galleryImage2: '',
        panorama360Url: '',
    });

    assert.deepEqual(normalized.galleryImages, []);
    assert.equal(normalized.panorama360Url, '');
});
