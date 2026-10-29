import { CoffeeShop } from '../types';

type SheetCoffeeShop = Pick<CoffeeShop, 'id'> & Partial<CoffeeShop>;
type SheetRow = Record<string, unknown> & Pick<CoffeeShop, 'id'>;

const SERIALIZED_FIELDS = ['socials', 'amenities', 'menu', 'reviews'] as const;

const NUMERIC_SHEET_FIELDS = [
    'barangayId',
    'minPrice',
    'maxPrice',
    'lat',
    'lng',
    'rating',
    'reviewCount',
    'navigationCount',
] as const;

export const normalizeSheetCoffeeShop = (
    shop: Record<string, unknown> & Pick<CoffeeShop, 'id'>,
): SheetCoffeeShop => {
    const normalized = { ...shop } as Record<string, unknown>;

    for (const field of SERIALIZED_FIELDS) {
        const value = normalized[field];
        if (typeof value === 'string' && value.trim() !== '') {
            try {
                normalized[field] = JSON.parse(value);
            } catch (error) {
                console.warn(`Could not parse ${field} from the Google Sheet:`, error);
            }
        }
    }

    const firstGalleryImage = normalized.galleryImage1;
    const secondGalleryImage = normalized.galleryImage2;
    if (typeof firstGalleryImage === 'string' || typeof secondGalleryImage === 'string') {
        normalized.galleryImages = [firstGalleryImage, secondGalleryImage]
            .filter((image): image is string => typeof image === 'string' && image !== '');
    }
    delete normalized.galleryImage1;
    delete normalized.galleryImage2;

    for (const field of NUMERIC_SHEET_FIELDS) {
        const value = normalized[field];
        if (typeof value === 'string' && value.trim() !== '') {
            const asNumber = Number(value);
            if (Number.isFinite(asNumber)) {
                normalized[field] = asNumber;
            }
        }
    }

    if (typeof normalized.verified === 'string') {
        normalized.verified = ['true', '1', 'yes'].includes(normalized.verified.toLowerCase());
    }
    delete normalized.recordVersion;

    return normalized as SheetCoffeeShop;
};

// Paste the deployed Apps Script web app URL here (the URL ending in /exec).
export const GOOGLE_SHEETS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbz0x2c8YGXx_P7rB9oMVivg6EjlW7P0V2LS9UMakl5HKNbVjYuAjhue9J8YJ0d7nljaKg/exec';

interface CoffeeShopResponse {
    success: boolean;
    initialized: boolean;
    shops: SheetCoffeeShop[];
}

const toSheetCoffeeShop = (shop: CoffeeShop): SheetRow => {
    return {
        id: shop.id,
        name: shop.name,
        barangayId: shop.barangayId,
        barangayName: shop.barangayName,
        address: shop.address,
        landmark: shop.landmark,
        priceRange: shop.priceRange,
        operatingHoursText: shop.operatingHoursText,
        daysOpen: shop.daysOpen,
        navigationCount: shop.navigationCount,
        description: shop.description,
        minPrice: shop.minPrice,
        maxPrice: shop.maxPrice,
        openingTime: shop.openingTime,
        closingTime: shop.closingTime,
        lat: shop.lat,
        lng: shop.lng,
        rating: shop.rating,
        reviewCount: shop.reviewCount,
        verified: shop.verified,
        bannerImage: shop.bannerImage,
        galleryImage1: shop.galleryImages?.[0] ?? '',
        galleryImage2: shop.galleryImages?.[1] ?? '',
        panorama360Url: shop.panorama360Url ?? '',
        phone: shop.phone ?? '',
        socials: JSON.stringify(shop.socials ?? {}),
        amenities: JSON.stringify(shop.amenities),
        menu: JSON.stringify(shop.menu),
        reviews: JSON.stringify(shop.reviews),
        recordVersion: 2,
    };
};

const toSheetPayload = (payload: Record<string, unknown>): Record<string, unknown> => {
    if (payload.action === 'upsert' && payload.shop) {
        return { ...payload, shop: toSheetCoffeeShop(payload.shop as CoffeeShop) };
    }

    if (payload.action === 'replaceAll' && Array.isArray(payload.shops)) {
        return { ...payload, shops: payload.shops.map((shop) => toSheetCoffeeShop(shop as CoffeeShop)) };
    }

    return payload;
};

const matchesSavedShop = (requested: SheetRow, saved: SheetCoffeeShop): boolean => {
    const normalizedRequested = normalizeSheetCoffeeShop(requested);
    return Object.entries(normalizedRequested).every(([key, value]) =>
        JSON.stringify(saved[key as keyof CoffeeShop]) === JSON.stringify(value),
    );
};

export const loadCoffeeShopsFromSheet = (): Promise<CoffeeShopResponse | null> => {
    if (!GOOGLE_SHEETS_SCRIPT_URL || typeof window === 'undefined') {
        return Promise.resolve(null);
    }

    return new Promise((resolve) => {
        const callbackName = `brewboundSheetCallback${Date.now()}${Math.floor(Math.random() * 100000)}`;
        const callbackHost = window as unknown as Record<string, (response: CoffeeShopResponse) => void>;
        const script = document.createElement('script');
        const timeout = window.setTimeout(finish, 15000);

        function finish(response: CoffeeShopResponse | null = null) {
            window.clearTimeout(timeout);
            delete callbackHost[callbackName];
            script.remove();
            resolve(response);
        }

        callbackHost[callbackName] = (response) => finish({
            ...response,
            shops: Array.isArray(response?.shops)
                ? response.shops.map((shop) => normalizeSheetCoffeeShop(shop as Record<string, unknown> & Pick<CoffeeShop, 'id'>))
                : [],
        });
        script.onerror = () => finish();
        script.src = `${GOOGLE_SHEETS_SCRIPT_URL}?action=list&callback=${callbackName}&_=${Date.now()}`;
        document.head.appendChild(script);
    });
};

export const sendCoffeeShopMutation = async (payload: Record<string, unknown>): Promise<boolean> => {
    if (!GOOGLE_SHEETS_SCRIPT_URL) return false;

    try {
        const sheetPayload = toSheetPayload(payload);
        await fetch(GOOGLE_SHEETS_SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify(sheetPayload),
        });

        const response = await loadCoffeeShopsFromSheet();
        if (!response?.success) return false;

        if (sheetPayload.action === 'upsert') {
            const requestedShop = sheetPayload.shop as SheetCoffeeShop | undefined;
            if (!requestedShop) return false;
            const savedShop = response.shops.find((shop) => shop.id === requestedShop.id);
            if (!savedShop) return false;

            return matchesSavedShop(requestedShop as SheetRow, savedShop);
        }

        if (sheetPayload.action === 'delete') {
            return !response.shops.some((shop) => shop.id === sheetPayload.id);
        }

        if (sheetPayload.action === 'replaceAll') {
            const requestedShops = sheetPayload.shops as SheetRow[] | undefined;
            if (!requestedShops || requestedShops.length !== response.shops.length) return false;
            return requestedShops.every((requestedShop) => {
                const savedShop = response.shops.find((shop) => shop.id === requestedShop.id);
                return Boolean(savedShop && matchesSavedShop(requestedShop, savedShop));
            });
        }

        return false;
    } catch (error) {
        console.error('Could not sync coffee shop changes to Google Sheets:', error);
        return false;
    }
};