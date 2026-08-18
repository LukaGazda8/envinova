// === Router a obsluha akcií ===

const ROUTES = {
    prehlad: { title: 'Prehľad', render: container => Views.renderDashboard(container) },
    faktura: { title: 'Faktúry', render: container => Views.renderDocumentList(container, 'faktura') },
    ponuka: { title: 'Cenové ponuky', render: container => Views.renderDocumentList(container, 'ponuka') },
    objednavka: { title: 'Objednávky', render: container => Views.renderDocumentList(container, 'objednavka') },
    kontakty: { title: 'Kontakty', render: container => Views.renderContacts(container) },
    cennik: { title: 'Cenník položiek', render: container => Views.renderCatalog(container) },
    nastavenia: { title: 'Nastavenia', render: container => Views.renderSettings(container) },
};

function currentRoute() {
    const hash = (window.location.hash || '').replace(/^#\/?/, '');
    return ROUTES[hash] ? hash : 'prehlad';
}

function renderRoute() {
    const route = currentRoute();
    const view = document.getElementById('view');
    document.getElementById('pageTitle').textContent = ROUTES[route].title;
    document.querySelectorAll('.side-nav a').forEach(link => {
        link.classList.toggle('active', link.dataset.route === route);
    });
    view.innerHTML = '';
    ROUTES[route].render(view);
    document.getElementById('sidebar').classList.remove('open');
}

function refresh() {
    renderRoute();
}

function goTo(route) {
    if (currentRoute() === route) {
        renderRoute();
    } else {
        window.location.hash = `#/${route}`;
    }
}

// === Akcie nad dokladmi ===

function actionNewDocument(type, overrides) {
    Editor.openEditor(Store.createDocument(type, overrides));
}

function actionEdit(id) {
    const doc = Store.getDocument(id);
    if (!doc) return;
    Editor.openEditor(doc);
}

async function actionPdf(id) {
    const doc = Store.getDocument(id);
    if (!doc) return;
    try {
        await Pdf.downloadPdf(doc);
    } catch (err) {
        console.error(err);
        UI.toast('PDF sa nepodarilo vygenerovať.', 'error');
    }
}

function actionDelete(id) {
    const doc = Store.getDocument(id);
    if (!doc) return;
    if (!window.confirm(`Naozaj chcete zmazať doklad ${doc.number}? Túto akciu nie je možné vrátiť.`)) return;
    Store.deleteDocument(id);
    UI.toast('Doklad bol zmazaný.', 'success');
    refresh();
}

function actionConvert(id, targetType) {
    let created;
    try {
        created = Store.convertDocument(id, targetType);
    } catch (err) {
        console.error(err);
        UI.toast(err.message || 'Doklad sa nepodarilo vytvoriť.', 'error');
        return;
    }
    if (!created) return;
    UI.toast(`Vytvorený nový doklad ${created.number}.`, 'success');
    Editor.openEditor(created);
}

function actionDuplicate(id) {
    let copy;
    try {
        copy = Store.duplicateDocument(id);
    } catch (err) {
        console.error(err);
        UI.toast(err.message || 'Doklad sa nepodarilo duplikovať.', 'error');
        return;
    }
    if (!copy) return;
    UI.toast(`Doklad bol duplikovaný ako ${copy.number}.`, 'success');
    Editor.openEditor(copy);
}

function actionMarkPaid(id) {
    Store.setDocumentStatus(id, 'zaplatena');
    UI.toast('Faktúra bola označená ako zaplatená.', 'success');
    refresh();
}

// === Kontakty a cenník ===

function openContactModal(contact) {
    UI.openModal(
        contact.id ? 'Upraviť kontakt' : 'Nový kontakt',
        Views.contactFormHtml(contact),
        `<button type="button" class="btn-primary" data-action="contact-save">Uložiť</button>
         <button type="button" class="btn-secondary" data-action="modal-close">Zrušiť</button>`
    );
}

function saveContactFromModal() {
    const contact = Views.readContactForm();
    if (!contact.name) {
        UI.toast('Zadajte názov kontaktu.', 'error');
        return;
    }
    Store.saveContact(contact);
    UI.closeModal();
    UI.toast('Kontakt bol uložený.', 'success');
    refresh();
}

function openCatalogModal(item) {
    UI.openModal(
        item.id ? 'Upraviť položku' : 'Nová položka cenníka',
        Views.catalogFormHtml(item),
        `<button type="button" class="btn-primary" data-action="catalog-save">Uložiť</button>
         <button type="button" class="btn-secondary" data-action="modal-close">Zrušiť</button>`
    );
}

function saveCatalogFromModal() {
    const item = Views.readCatalogForm();
    if (!item.desc) {
        UI.toast('Zadajte popis položky.', 'error');
        return;
    }
    Store.saveCatalogItem(item);
    UI.closeModal();
    UI.toast('Položka cenníka bola uložená.', 'success');
    refresh();
}

// === Záloha údajov ===

function exportData() {
    UI.downloadFile(`envinova_doklady_${Calc.todayIso()}.json`, JSON.stringify(Store.exportAll(), null, 2), 'application/json');
    UI.toast('Záloha bola stiahnutá.', 'success');
}

function importData(file) {
    const reader = new FileReader();
    reader.onload = () => {
        try {
            const payload = JSON.parse(reader.result);
            if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
                throw new Error('Neplatný formát zálohy.');
            }
            const merge = window.confirm('Zlúčiť s existujúcimi údajmi? OK = zlúčiť, Zrušiť = prepísať všetko.');
            const result = Store.importAll(payload, merge ? 'merge' : 'replace');
            UI.toast(`Import: ${result.documents} dokladov, ${result.contacts} kontaktov, ${result.catalog} položiek.`, 'success');
            refresh();
        } catch (err) {
            console.error(err);
            UI.toast('Súbor sa nepodarilo načítať.', 'error');
        }
    };
    reader.readAsText(file);
}

function wipeData() {
    if (!window.confirm('Vymazať všetky doklady, kontakty a cenník? Odporúčame najprv stiahnuť zálohu.')) return;
    Object.values(Store.KEYS).forEach(key => localStorage.removeItem(key));
    UI.toast('Všetky údaje boli vymazané.', 'success');
    refresh();
}

// === Editor ===

async function editorPdf() {
    const doc = Editor.readEditor();
    try {
        await Pdf.downloadPdf(doc);
    } catch (err) {
        console.error(err);
        UI.toast('PDF sa nepodarilo vygenerovať.', 'error');
    }
}

// Pri neuložených zmenách sa najprv spýta.
function closeEditorSafely() {
    if (Editor.isEditorDirty() && !window.confirm('Doklad má neuložené zmeny. Zavrieť bez uloženia?')) return;
    Editor.closeEditor();
}

function editorSave() {
    const saved = Editor.saveEditorDocument();
    if (!saved) return;
    Editor.closeEditor();
    goTo(saved.type);
    refresh();
}

function editorSaveSupplierAsDefault() {
    const doc = Editor.readEditor();
    Store.saveSettings({ supplier: doc.supplier });
    UI.toast('Dodávateľ bol uložený ako predvolený.', 'success');
}

function editorSaveCustomerAsContact() {
    const doc = Editor.readEditor();
    if (!doc.customer.name) {
        UI.toast('Zadajte názov odberateľa.', 'error');
        return;
    }
    const key = value => String(value || '').trim().toLowerCase();
    const existing = Store.getContacts().find(contact =>
        key(contact.name) === key(doc.customer.name) && key(contact.ico) === key(doc.customer.ico));
    const saved = Store.saveContact(Object.assign({}, doc.customer, existing ? { id: existing.id } : {}));
    const picker = document.getElementById('contactPicker');
    if (picker) {
        if (!Array.from(picker.options).some(option => option.value === saved.id)) {
            picker.insertAdjacentHTML('beforeend', `<option value="${saved.id}">${Calc.escapeHtml(saved.name)}</option>`);
        }
        picker.value = saved.id;
    }
    UI.toast(existing ? 'Kontakt bol aktualizovaný.' : 'Odberateľ bol uložený do kontaktov.', 'success');
}

// === Delegovanie akcií ===

const ACTIONS = {
    'toggle-sidebar': () => document.getElementById('sidebar').classList.toggle('open'),
    'new': (target) => actionNewDocument(target.dataset.type),
    'edit': target => actionEdit(target.dataset.id),
    'preview': target => {
        const doc = Store.getDocument(target.dataset.id);
        if (doc) UI.showDocumentPreview(doc);
    },
    'pdf': target => actionPdf(target.dataset.id),
    'duplicate': target => actionDuplicate(target.dataset.id),
    'delete': target => actionDelete(target.dataset.id),
    'convert': target => actionConvert(target.dataset.id, target.dataset.target),
    'mark-paid': target => actionMarkPaid(target.dataset.id),
    'export-csv': target => Views.exportDocumentsCsv(target.dataset.type),
    'export-data': () => exportData(),
    'import-data': () => document.getElementById('importFile').click(),
    'wipe-data': () => wipeData(),
    'remove-logo': () => {
        Store.saveSettings({ logo: '' });
        UI.toast('Logo bolo odstránené.', 'success');
        refresh();
    },
    'settings-save': () => {
        Store.saveSettings(Views.readSettingsForm());
        UI.toast('Nastavenia boli uložené.', 'success');
        refresh();
    },
    'contact-new': () => openContactModal({}),
    'contact-edit': target => openContactModal(Store.getContact(target.dataset.id) || {}),
    'contact-save': () => saveContactFromModal(),
    'contact-delete': target => {
        const contact = Store.getContact(target.dataset.id);
        if (!contact) return;
        if (!window.confirm(`Zmazať kontakt ${contact.name}?`)) return;
        Store.deleteContact(contact.id);
        UI.toast('Kontakt bol zmazaný.', 'success');
        refresh();
    },
    'contact-invoice': target => {
        const contact = Store.getContact(target.dataset.id);
        if (!contact) return;
        actionNewDocument('faktura', {
            contactId: contact.id,
            customer: {
                name: contact.name, ico: contact.ico, dic: contact.dic, icdph: contact.icdph,
                street: contact.street, city: contact.city, zip: contact.zip,
                country: contact.country || 'Slovensko', email: contact.email, phone: contact.phone, web: contact.web,
            },
        });
    },
    'catalog-new': () => openCatalogModal({ unit: 'ks', vatRate: Store.getSettings().defaultVatRate, price: 0 }),
    'catalog-edit': target => openCatalogModal(Store.getCatalog().find(item => item.id === target.dataset.id) || {}),
    'catalog-save': () => saveCatalogFromModal(),
    'catalog-delete': target => {
        const item = Store.getCatalog().find(entry => entry.id === target.dataset.id);
        if (!item) return;
        if (!window.confirm(`Zmazať položku ${item.desc}?`)) return;
        Store.deleteCatalogItem(item.id);
        UI.toast('Položka bola zmazaná.', 'success');
        refresh();
    },
    'modal-close': () => UI.closeModal(),
    'editor-close': () => closeEditorSafely(),
    'editor-save': () => editorSave(),
    'editor-pdf': () => editorPdf(),
    'editor-preview': () => UI.showDocumentPreview(Editor.readEditor()),
    'editor-add-item': () => Editor.editorAddItem(),
    'editor-remove-item': target => Editor.editorRemoveItem(target),
    'editor-save-supplier': () => editorSaveSupplierAsDefault(),
    'editor-save-contact': () => editorSaveCustomerAsContact(),
    'editor-toggle-section': target => target.closest('.collapsible').classList.toggle('collapsed'),
};

document.addEventListener('click', event => {
    const target = event.target.closest('[data-action]');
    if (!target || target.tagName === 'SELECT') return;
    const action = ACTIONS[target.dataset.action];
    if (!action) return;
    event.preventDefault();
    action(target);
});

document.addEventListener('change', event => {
    if (event.target.id === 'contactPicker') {
        Editor.applyContactToEditor(event.target.value);
        return;
    }
    if (event.target.id === 'catalogPicker') {
        const item = Store.getCatalog().find(entry => entry.id === event.target.value);
        if (item) {
            Editor.editorAddItem({ desc: item.desc, unit: item.unit, price: Number(item.price) || 0, vatRate: Number(item.vatRate) || 0 });
        }
        event.target.value = '';
        return;
    }
    if (event.target.id === 'importFile') {
        const file = event.target.files[0];
        if (file) importData(file);
        event.target.value = '';
        return;
    }
    if (Editor.isOpen() && event.target.closest('#editorBody')) {
        Editor.refreshEditorTotals();
    }
});

document.addEventListener('input', event => {
    if (Editor.isOpen() && event.target.closest('#editorBody')) {
        Editor.refreshEditorTotals();
    }
});

document.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    if (!document.getElementById('modal').classList.contains('hidden')) {
        UI.closeModal();
    } else if (Editor.isOpen()) {
        closeEditorSafely();
    }
});

window.addEventListener('beforeunload', event => {
    if (Editor.isOpen() && Editor.isEditorDirty()) {
        event.preventDefault();
        event.returnValue = '';
    }
});

document.getElementById('modal').addEventListener('click', event => {
    if (event.target.id === 'modal') UI.closeModal();
});

window.addEventListener('hashchange', renderRoute);

document.addEventListener('DOMContentLoaded', () => {
    if (!window.location.hash) window.location.hash = '#/prehlad';
    renderRoute();
});
