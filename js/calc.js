// === Výpočty a formátovanie ===

const CURRENCY_SYMBOLS = { EUR: '\u20AC', CZK: 'K\u010D', USD: '$', GBP: '\u00A3' };

const PAYMENT_METHODS = {
    prevod: 'Bankový prevod',
    hotovost: 'Hotovosť',
    karta: 'Platobná karta',
    dobierka: 'Dobierka',
    paypal: 'PayPal',
    iny: 'Iný',
};

const UNITS = ['ks', 'hod', 'den', 'm', 'm\u00B2', 'm\u00B3', 'kg', 'l', 'km', 'bal', ''];

const VAT_RATES = [0, 5, 10, 19, 20, 23];

function currencySymbol(currency) {
    return CURRENCY_SYMBOLS[currency] || CURRENCY_SYMBOLS.EUR;
}

function round2(value) {
    return Math.round((value + Number.EPSILON) * 100) / 100;
}

function formatAmount(value) {
    const num = Number.isFinite(value) ? value : 0;
    return num.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, ' ').replace(' ,', ',');
}

function formatMoney(value, currency) {
    return `${formatAmount(value)} ${currencySymbol(currency)}`;
}

function formatQty(value) {
    const num = Number(value) || 0;
    return Number.isInteger(num) ? String(num) : String(num).replace('.', ',');
}

function formatDate(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    if (Number.isNaN(date.getTime())) return '';
    return `${String(date.getDate()).padStart(2, '0')}.${String(date.getMonth() + 1).padStart(2, '0')}.${date.getFullYear()}`;
}

function todayIso() {
    return new Date().toISOString().split('T')[0];
}

function isVatDocument(doc) {
    return !(doc.type === 'faktura' && doc.subtype === 'bez_dph');
}

// Vypočíta riadky, medzisúčty, rozpis DPH, zľavu a zaokrúhlenie dokladu.
function computeTotals(doc) {
    const withVatPricing = doc.pricingMode === 'withVat';
    const useVat = isVatDocument(doc);

    let subtotal = 0;
    let vatTotal = 0;
    const vatBreakdown = {};

    const lines = (doc.items || []).map(item => {
        const qty = Number(item.qty) || 0;
        const price = Number(item.price) || 0;
        const vatRate = useVat ? (Number(item.vatRate) || 0) : 0;

        let unitNet;
        if (useVat && withVatPricing && vatRate > 0) {
            unitNet = price / (1 + vatRate / 100);
        } else {
            unitNet = price;
        }

        const net = round2(qty * unitNet);
        const vat = round2(net * (vatRate / 100));
        const gross = round2(net + vat);

        subtotal += net;
        vatTotal += vat;
        vatBreakdown[vatRate] = vatBreakdown[vatRate] || { rate: vatRate, base: 0, vat: 0 };
        vatBreakdown[vatRate].base += net;
        vatBreakdown[vatRate].vat += vat;

        return {
            qty,
            unit: item.unit || '',
            desc: item.desc || '',
            vatRate,
            unitPriceNet: round2(unitNet),
            unitPriceGross: round2(unitNet * (1 + vatRate / 100)),
            net,
            vat,
            gross,
        };
    });

    subtotal = round2(subtotal);
    vatTotal = round2(vatTotal);
    let gross = round2(subtotal + vatTotal);

    let discount = 0;
    const discountValue = Number(doc.discountValue) || 0;
    if (discountValue > 0) {
        discount = doc.discountType === 'percent' ? round2(gross * (discountValue / 100)) : round2(Math.min(discountValue, gross));
        const ratio = gross > 0 ? (gross - discount) / gross : 0;
        subtotal = round2(subtotal * ratio);
        vatTotal = round2(vatTotal * ratio);
        gross = round2(subtotal + vatTotal);
        Object.keys(vatBreakdown).forEach(rate => {
            vatBreakdown[rate].base = round2(vatBreakdown[rate].base * ratio);
            vatBreakdown[rate].vat = round2(vatBreakdown[rate].vat * ratio);
        });
    }

    let total = gross;
    let roundingDiff = 0;
    const step = Number(doc.rounding);
    if (Number.isFinite(step) && step > 0) {
        total = round2(Math.round(gross / step) * step);
        roundingDiff = round2(total - gross);
    }

    return {
        lines,
        subtotal,
        vatTotal,
        discount,
        gross,
        roundingDiff,
        total,
        vatBreakdown: Object.values(vatBreakdown)
            .filter(entry => entry.base !== 0 || entry.vat !== 0)
            .sort((a, b) => a.rate - b.rate),
        useVat,
    };
}

function isOverdue(doc) {
    if (doc.type !== 'faktura') return false;
    if (doc.status === 'zaplatena' || doc.status === 'stornovana' || doc.status === 'koncept') return false;
    if (!doc.dueDate) return false;
    return doc.dueDate < todayIso();
}

function isExpired(doc) {
    if (doc.type !== 'ponuka') return false;
    if (doc.status === 'prijata' || doc.status === 'odmietnuta') return false;
    if (!doc.validUntil) return false;
    return doc.validUntil < todayIso();
}

function documentTitle(doc) {
    if (doc.type === 'faktura') {
        const titles = {
            dph: 'FAKTÚRA – daňový doklad',
            bez_dph: 'FAKTÚRA',
            zalohova: 'ZÁLOHOVÁ FAKTÚRA',
            proforma: 'PROFORMA FAKTÚRA',
        };
        return titles[doc.subtype] || 'FAKTÚRA';
    }
    if (doc.type === 'ponuka') return 'CENOVÁ PONUKA';
    return 'OBJEDNÁVKA';
}

function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex || '');
    return result
        ? { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16) }
        : { r: 33, g: 150, b: 243 };
}

function escapeHtml(value) {
    if (value === null || value === undefined) return '';
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

window.Calc = {
    CURRENCY_SYMBOLS,
    PAYMENT_METHODS,
    UNITS,
    VAT_RATES,
    currencySymbol,
    round2,
    formatAmount,
    formatMoney,
    formatQty,
    formatDate,
    todayIso,
    computeTotals,
    isVatDocument,
    isOverdue,
    isExpired,
    documentTitle,
    hexToRgb,
    escapeHtml,
};
