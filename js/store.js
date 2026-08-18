// === Data layer (localStorage) ===
// Ukladanie dokladov (faktúry, cenové ponuky, objednávky), kontaktov,
// cenníka položiek a nastavení firmy.

const STORAGE_PREFIX = 'envinova.v1.';
const KEYS = {
    documents: STORAGE_PREFIX + 'documents',
    contacts: STORAGE_PREFIX + 'contacts',
    catalog: STORAGE_PREFIX + 'catalog',
    settings: STORAGE_PREFIX + 'settings',
};

const DOC_TYPES = {
    faktura: {
        label: 'Faktúra',
        plural: 'Faktúry',
        icon: '\u{1F4C4}',
        statuses: {
            koncept: 'Koncept',
            odoslana: 'Odoslaná',
            zaplatena: 'Zaplatená',
            stornovana: 'Stornovaná',
        },
        defaultStatus: 'koncept',
    },
    ponuka: {
        label: 'Cenová ponuka',
        plural: 'Cenové ponuky',
        icon: '\u{1F4CB}',
        statuses: {
            koncept: 'Koncept',
            odoslana: 'Odoslaná',
            prijata: 'Prijatá',
            odmietnuta: 'Odmietnutá',
        },
        defaultStatus: 'koncept',
    },
    objednavka: {
        label: 'Objednávka',
        plural: 'Objednávky',
        icon: '\u{1F4E6}',
        statuses: {
            koncept: 'Koncept',
            potvrdena: 'Potvrdená',
            vybavena: 'Vybavená',
            zrusena: 'Zrušená',
        },
        defaultStatus: 'koncept',
    },
};

const INVOICE_SUBTYPES = {
    dph: 'Faktúra s DPH (daňový doklad)',
    bez_dph: 'Faktúra bez DPH (neplatiteľ DPH)',
    zalohova: 'Zálohová faktúra',
    proforma: 'Proforma faktúra',
};

const DEFAULT_SETTINGS = {
    supplier: {
        name: '',
        ico: '',
        dic: '',
        icdph: '',
        street: '',
        city: '',
        zip: '',
        country: 'Slovensko',
        email: '',
        phone: '',
        web: '',
    },
    bankAccount: '',
    bankName: '',
    swift: '',
    issuedBy: '',
    registryInfo: '',
    color: '#2196F3',
    currency: 'EUR',
    defaultVatRate: 20,
    defaultDueDays: 14,
    defaultValidityDays: 30,
    pricingMode: 'withoutVat',
    rounding: 'none',
    logo: '',
    series: {
        faktura: { pattern: '{YYYY}{NNNN}', next: 1 },
        ponuka: { pattern: 'CP{YYYY}{NNNN}', next: 1 },
        objednavka: { pattern: 'OBJ{YYYY}{NNNN}', next: 1 },
    },
};

function readJson(key, fallback) {
    try {
        const raw = localStorage.getItem(key);
        if (!raw) return fallback;
        const parsed = JSON.parse(raw);
        return parsed === null || parsed === undefined ? fallback : parsed;
    } catch (err) {
        console.error('Nepodarilo sa načítať údaje z localStorage:', key, err);
        return fallback;
    }
}

function writeJson(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
        return true;
    } catch (err) {
        console.error('Nepodarilo sa uložiť údaje do localStorage:', key, err);
        return false;
    }
}

function newId() {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') {
        return window.crypto.randomUUID();
    }
    return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
}

function nowIso() {
    return new Date().toISOString();
}

function deepMerge(base, override) {
    const out = Array.isArray(base) ? base.slice() : Object.assign({}, base);
    if (!override || typeof override !== 'object') return out;
    Object.keys(override).forEach(key => {
        const value = override[key];
        if (value && typeof value === 'object' && !Array.isArray(value) && base && typeof base[key] === 'object' && !Array.isArray(base[key])) {
            out[key] = deepMerge(base[key], value);
        } else if (value !== undefined) {
            out[key] = value;
        }
    });
    return out;
}

// === Settings ===

function getSettings() {
    return deepMerge(DEFAULT_SETTINGS, readJson(KEYS.settings, {}));
}

function saveSettings(settings) {
    return writeJson(KEYS.settings, deepMerge(getSettings(), settings));
}

// === Numbering ===

function formatNumberPattern(pattern, counter) {
    const now = new Date();
    return String(pattern || '{YYYY}{NNNN}')
        .replace(/\{YYYY\}/g, String(now.getFullYear()))
        .replace(/\{YY\}/g, String(now.getFullYear()).slice(-2))
        .replace(/\{MM\}/g, String(now.getMonth() + 1).padStart(2, '0'))
        .replace(/\{N+\}/g, match => String(counter).padStart(match.length - 2, '0'));
}

function peekNextNumber(type) {
    const series = getSettings().series[type] || DEFAULT_SETTINGS.series[type];
    return formatNumberPattern(series.pattern, series.next);
}

function consumeNumber(type, usedNumber) {
    const settings = getSettings();
    const series = settings.series[type] || Object.assign({}, DEFAULT_SETTINGS.series[type]);
    if (usedNumber === formatNumberPattern(series.pattern, series.next)) {
        series.next = series.next + 1;
        settings.series[type] = series;
        saveSettings(settings);
    }
}

// === Documents ===

// Doplní chýbajúce polia, aby staršie alebo importované záznamy nerozbili UI.
function normalizeDocument(doc) {
    const emptyParty = { name: '', ico: '', dic: '', icdph: '', street: '', city: '', zip: '', country: 'Slovensko', email: '', phone: '', web: '' };
    return Object.assign({}, doc, {
        supplier: Object.assign({}, emptyParty, doc.supplier),
        customer: Object.assign({}, emptyParty, doc.customer),
        items: Array.isArray(doc.items) ? doc.items : [],
        status: doc.status || (DOC_TYPES[doc.type] ? DOC_TYPES[doc.type].defaultStatus : 'koncept'),
        currency: doc.currency || DEFAULT_SETTINGS.currency,
    });
}

function getDocuments(type) {
    const all = readJson(KEYS.documents, []);
    const list = (Array.isArray(all) ? all : [])
        .filter(doc => doc && DOC_TYPES[doc.type])
        .map(normalizeDocument);
    return type ? list.filter(doc => doc.type === type) : list;
}

function getDocument(id) {
    return getDocuments().find(doc => doc.id === id) || null;
}

function saveDocument(doc) {
    const all = getDocuments();
    const index = all.findIndex(item => item.id === doc.id);
    const record = Object.assign({}, doc, { updatedAt: nowIso() });

    if (index >= 0) {
        record.createdAt = all[index].createdAt || nowIso();
        all[index] = record;
    } else {
        record.id = record.id || newId();
        record.createdAt = nowIso();
        all.push(record);
        consumeNumber(record.type, record.number);
    }

    writeJson(KEYS.documents, all);
    return record;
}

function deleteDocument(id) {
    writeJson(KEYS.documents, getDocuments().filter(doc => doc.id !== id));
}

function setDocumentStatus(id, status) {
    const doc = getDocument(id);
    if (!doc) return null;
    doc.status = status;
    doc.paidAt = status === 'zaplatena' ? (doc.paidAt || nowIso()) : '';
    return saveDocument(doc);
}

function createDocument(type, overrides) {
    const settings = getSettings();
    const today = new Date();
    const iso = date => date.toISOString().split('T')[0];

    const dueDate = new Date(today);
    dueDate.setDate(dueDate.getDate() + Number(settings.defaultDueDays || 14));

    const validUntil = new Date(today);
    validUntil.setDate(validUntil.getDate() + Number(settings.defaultValidityDays || 30));

    const number = peekNextNumber(type);

    return Object.assign({
        id: newId(),
        type: type,
        subtype: type === 'faktura' ? 'dph' : '',
        number: number,
        status: DOC_TYPES[type].defaultStatus,
        issueDate: iso(today),
        deliveryDate: iso(today),
        dueDate: iso(dueDate),
        validUntil: iso(validUntil),
        variableSymbol: number.replace(/\D/g, ''),
        constantSymbol: '',
        specificSymbol: '',
        issuedBy: settings.issuedBy,
        paymentMethod: 'prevod',
        bankAccount: settings.bankAccount,
        bankName: settings.bankName,
        swift: settings.swift,
        currency: settings.currency,
        color: settings.color,
        registryInfo: settings.registryInfo,
        note: '',
        pricingMode: settings.pricingMode,
        discountType: 'percent',
        discountValue: 0,
        rounding: settings.rounding,
        supplier: Object.assign({}, settings.supplier),
        customer: { name: '', ico: '', dic: '', icdph: '', street: '', city: '', zip: '', country: 'Slovensko', email: '', phone: '', web: '' },
        contactId: '',
        items: [{ qty: 1, unit: 'ks', desc: '', vatRate: Number(settings.defaultVatRate || 20), price: 0 }],
        relatedFrom: null,
        paidAt: '',
    }, overrides || {});
}

// Prevod dokladu na iný typ (ponuka -> objednávka -> faktúra)
function convertDocument(sourceId, targetType) {
    const source = getDocument(sourceId);
    if (!source) return null;

    const target = createDocument(targetType, {
        subtype: targetType === 'faktura' ? (source.subtype || 'dph') : '',
        customer: Object.assign({}, source.customer),
        contactId: source.contactId,
        items: source.items.map(item => Object.assign({}, item)),
        currency: source.currency,
        pricingMode: source.pricingMode,
        discountType: source.discountType,
        discountValue: source.discountValue,
        rounding: source.rounding,
        note: source.note,
        color: source.color,
        relatedFrom: { id: source.id, type: source.type, number: source.number },
    });

    return saveDocument(target);
}

function duplicateDocument(sourceId) {
    const source = getDocument(sourceId);
    if (!source) return null;

    const copy = createDocument(source.type, {
        subtype: source.subtype,
        customer: Object.assign({}, source.customer),
        contactId: source.contactId,
        items: source.items.map(item => Object.assign({}, item)),
        currency: source.currency,
        pricingMode: source.pricingMode,
        discountType: source.discountType,
        discountValue: source.discountValue,
        rounding: source.rounding,
        note: source.note,
        color: source.color,
    });

    return saveDocument(copy);
}

// === Contacts ===

function getContacts() {
    const list = readJson(KEYS.contacts, []);
    return Array.isArray(list) ? list.slice().sort((a, b) => (a.name || '').localeCompare(b.name || '', 'sk')) : [];
}

function getContact(id) {
    return getContacts().find(contact => contact.id === id) || null;
}

function saveContact(contact) {
    const all = readJson(KEYS.contacts, []);
    const list = Array.isArray(all) ? all : [];
    const record = Object.assign({}, contact, { updatedAt: nowIso() });
    const index = list.findIndex(item => item.id === record.id);

    if (index >= 0) {
        list[index] = record;
    } else {
        record.id = record.id || newId();
        record.createdAt = nowIso();
        list.push(record);
    }

    writeJson(KEYS.contacts, list);
    return record;
}

function deleteContact(id) {
    writeJson(KEYS.contacts, getContacts().filter(contact => contact.id !== id));
}

// === Catalog (cenník položiek) ===

function getCatalog() {
    const list = readJson(KEYS.catalog, []);
    return Array.isArray(list) ? list.slice().sort((a, b) => (a.desc || '').localeCompare(b.desc || '', 'sk')) : [];
}

function saveCatalogItem(item) {
    const all = readJson(KEYS.catalog, []);
    const list = Array.isArray(all) ? all : [];
    const record = Object.assign({}, item, { updatedAt: nowIso() });
    const index = list.findIndex(existing => existing.id === record.id);

    if (index >= 0) {
        list[index] = record;
    } else {
        record.id = record.id || newId();
        record.createdAt = nowIso();
        list.push(record);
    }

    writeJson(KEYS.catalog, list);
    return record;
}

function deleteCatalogItem(id) {
    writeJson(KEYS.catalog, getCatalog().filter(item => item.id !== id));
}

// === Export / import ===

function exportAll() {
    return {
        app: 'envinova-doklady',
        version: 1,
        exportedAt: nowIso(),
        settings: getSettings(),
        documents: getDocuments(),
        contacts: getContacts(),
        catalog: getCatalog(),
    };
}

function importAll(payload, mode) {
    if (!payload || typeof payload !== 'object') {
        throw new Error('Neplatný súbor so záložnou kópiou.');
    }

    const documents = Array.isArray(payload.documents) ? payload.documents : [];
    const contacts = Array.isArray(payload.contacts) ? payload.contacts : [];
    const catalog = Array.isArray(payload.catalog) ? payload.catalog : [];

    if (mode === 'merge') {
        const mergeById = (existing, incoming) => {
            const map = new Map(existing.map(item => [item.id, item]));
            incoming.forEach(item => {
                if (!item || !item.id) return;
                map.set(item.id, item);
            });
            return Array.from(map.values());
        };
        writeJson(KEYS.documents, mergeById(getDocuments(), documents));
        writeJson(KEYS.contacts, mergeById(getContacts(), contacts));
        writeJson(KEYS.catalog, mergeById(getCatalog(), catalog));
    } else {
        writeJson(KEYS.documents, documents);
        writeJson(KEYS.contacts, contacts);
        writeJson(KEYS.catalog, catalog);
    }

    if (payload.settings) saveSettings(payload.settings);

    return {
        documents: documents.length,
        contacts: contacts.length,
        catalog: catalog.length,
    };
}

window.Store = {
    KEYS,
    DOC_TYPES,
    INVOICE_SUBTYPES,
    DEFAULT_SETTINGS,
    newId,
    getSettings,
    saveSettings,
    peekNextNumber,
    formatNumberPattern,
    getDocuments,
    getDocument,
    saveDocument,
    deleteDocument,
    setDocumentStatus,
    createDocument,
    convertDocument,
    duplicateDocument,
    getContacts,
    getContact,
    saveContact,
    deleteContact,
    getCatalog,
    saveCatalogItem,
    deleteCatalogItem,
    exportAll,
    importAll,
};
