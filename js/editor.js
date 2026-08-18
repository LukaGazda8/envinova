// === Editor dokladu (faktúra / cenová ponuka / objednávka) ===

let editorDoc = null;

function editorOptions(map, selected) {
    return Object.keys(map)
        .map(key => `<option value="${Calc.escapeHtml(key)}"${key === String(selected) ? ' selected' : ''}>${Calc.escapeHtml(map[key])}</option>`)
        .join('');
}

function editorListOptions(values, selected) {
    return values
        .map(value => `<option value="${Calc.escapeHtml(value)}"${String(value) === String(selected) ? ' selected' : ''}>${Calc.escapeHtml(value === '' ? '-' : value)}</option>`)
        .join('');
}

function partyFields(prefix, party) {
    const esc = Calc.escapeHtml;
    const countries = ['Slovensko', 'Česko', 'Rakúsko', 'Nemecko', 'Poľsko', 'Maďarsko', 'Iné'];
    return `
        <div class="form-grid">
            <div class="form-group">
                <label for="${prefix}Name">Meno / Názov firmy *</label>
                <input type="text" id="${prefix}Name" value="${esc(party.name)}" placeholder="Názov firmy alebo meno">
            </div>
            <div class="form-group">
                <label for="${prefix}Ico">IČO</label>
                <input type="text" id="${prefix}Ico" value="${esc(party.ico)}" placeholder="12345678">
            </div>
            <div class="form-group">
                <label for="${prefix}Dic">DIČ</label>
                <input type="text" id="${prefix}Dic" value="${esc(party.dic)}" placeholder="1234567890">
            </div>
            <div class="form-group">
                <label for="${prefix}Icdph">IČ DPH</label>
                <input type="text" id="${prefix}Icdph" value="${esc(party.icdph)}" placeholder="SK1234567890">
            </div>
        </div>
        <div class="form-grid">
            <div class="form-group">
                <label for="${prefix}Street">Ulica</label>
                <input type="text" id="${prefix}Street" value="${esc(party.street)}" placeholder="Ulica a číslo">
            </div>
            <div class="form-group">
                <label for="${prefix}City">Mesto</label>
                <input type="text" id="${prefix}City" value="${esc(party.city)}" placeholder="Mesto">
            </div>
            <div class="form-group">
                <label for="${prefix}Zip">PSČ</label>
                <input type="text" id="${prefix}Zip" value="${esc(party.zip)}" placeholder="010 01">
            </div>
            <div class="form-group">
                <label for="${prefix}Country">Krajina</label>
                <select id="${prefix}Country">${editorListOptions(countries, party.country || 'Slovensko')}</select>
            </div>
        </div>
        <div class="form-grid">
            <div class="form-group">
                <label for="${prefix}Email">E-mail</label>
                <input type="email" id="${prefix}Email" value="${esc(party.email)}" placeholder="email@firma.sk">
            </div>
            <div class="form-group">
                <label for="${prefix}Phone">Telefón</label>
                <input type="tel" id="${prefix}Phone" value="${esc(party.phone)}" placeholder="+421 900 123 456">
            </div>
            <div class="form-group">
                <label for="${prefix}Web">Web</label>
                <input type="url" id="${prefix}Web" value="${esc(party.web)}" placeholder="https://www.firma.sk">
            </div>
        </div>`;
}

function itemRowHtml(item) {
    const esc = Calc.escapeHtml;
    const vatOptions = Calc.VAT_RATES
        .map(rate => `<option value="${rate}"${Number(item.vatRate) === rate ? ' selected' : ''}>${rate} %</option>`)
        .join('');
    return `
        <tr class="item-row">
            <td><input type="number" class="item-qty" value="${esc(item.qty)}" min="0" step="0.01"></td>
            <td><select class="item-unit">${editorListOptions(Calc.UNITS, item.unit)}</select></td>
            <td><input type="text" class="item-desc" value="${esc(item.desc)}" placeholder="Popis položky"></td>
            <td><select class="item-vat">${vatOptions}</select></td>
            <td><input type="number" class="item-price" value="${esc(Number(item.price).toFixed(2))}" min="0" step="0.01"></td>
            <td><span class="item-total">0,00</span></td>
            <td><button type="button" class="btn-remove" data-action="editor-remove-item" title="Odstrániť">&#10005;</button></td>
        </tr>`;
}

function documentFieldsHtml(doc) {
    const esc = Calc.escapeHtml;
    const isInvoice = doc.type === 'faktura';
    const isQuote = doc.type === 'ponuka';
    const statuses = Store.DOC_TYPES[doc.type].statuses;

    return `
        <div class="form-grid">
            ${isInvoice ? `
                <div class="form-group">
                    <label for="docSubtype">Druh faktúry</label>
                    <select id="docSubtype">${editorOptions(Store.INVOICE_SUBTYPES, doc.subtype)}</select>
                </div>` : ''}
            <div class="form-group">
                <label for="docNumber">Číslo dokladu</label>
                <input type="text" id="docNumber" value="${esc(doc.number)}">
            </div>
            <div class="form-group">
                <label for="docStatus">Stav</label>
                <select id="docStatus">${editorOptions(statuses, doc.status)}</select>
            </div>
            <div class="form-group">
                <label for="docIssuedBy">Vystavil</label>
                <input type="text" id="docIssuedBy" value="${esc(doc.issuedBy)}" placeholder="Meno osoby">
            </div>
        </div>
        <div class="form-grid">
            <div class="form-group">
                <label for="docIssueDate">Dátum vystavenia</label>
                <input type="date" id="docIssueDate" value="${esc(doc.issueDate)}">
            </div>
            ${isQuote ? `
                <div class="form-group">
                    <label for="docValidUntil">Platnosť ponuky do</label>
                    <input type="date" id="docValidUntil" value="${esc(doc.validUntil)}">
                </div>` : `
                <div class="form-group">
                    <label for="docDeliveryDate">Dátum dodania</label>
                    <input type="date" id="docDeliveryDate" value="${esc(doc.deliveryDate)}">
                </div>`}
            ${isInvoice ? `
                <div class="form-group">
                    <label for="docDueDate">Dátum splatnosti</label>
                    <input type="date" id="docDueDate" value="${esc(doc.dueDate)}">
                </div>` : ''}
            ${!isQuote ? `
                <div class="form-group">
                    <label for="docPaymentMethod">Forma úhrady</label>
                    <select id="docPaymentMethod">${editorOptions(Calc.PAYMENT_METHODS, doc.paymentMethod)}</select>
                </div>` : ''}
        </div>
        ${isInvoice ? `
            <div class="form-grid">
                <div class="form-group">
                    <label for="docVariableSymbol">Variabilný symbol</label>
                    <input type="text" id="docVariableSymbol" value="${esc(doc.variableSymbol)}">
                </div>
                <div class="form-group">
                    <label for="docConstantSymbol">Konštantný symbol</label>
                    <input type="text" id="docConstantSymbol" value="${esc(doc.constantSymbol)}">
                </div>
                <div class="form-group">
                    <label for="docSpecificSymbol">Špecifický symbol</label>
                    <input type="text" id="docSpecificSymbol" value="${esc(doc.specificSymbol)}">
                </div>
            </div>
            <div class="form-grid">
                <div class="form-group">
                    <label for="docBankAccount">Číslo účtu / IBAN</label>
                    <input type="text" id="docBankAccount" value="${esc(doc.bankAccount)}" placeholder="SK89 0200 0000 0000 1234 5678">
                </div>
                <div class="form-group">
                    <label for="docBankName">Názov banky</label>
                    <input type="text" id="docBankName" value="${esc(doc.bankName)}">
                </div>
                <div class="form-group">
                    <label for="docSwift">SWIFT / BIC</label>
                    <input type="text" id="docSwift" value="${esc(doc.swift)}">
                </div>
            </div>` : ''}
        <div class="form-grid">
            <div class="form-group">
                <label for="docCurrency">Mena</label>
                <select id="docCurrency">${editorOptions({ EUR: 'EUR – Euro', CZK: 'CZK – Česká koruna', USD: 'USD – US Dollar', GBP: 'GBP – British Pound' }, doc.currency)}</select>
            </div>
            <div class="form-group">
                <label for="docRounding">Zaokrúhľovanie</label>
                <select id="docRounding">${editorOptions({ none: 'Žiadne', '0.01': 'Na centy (0,01)', '0.05': 'Na 5 centov (0,05)', '0.10': 'Na 10 centov (0,10)', '1': 'Na celé (1,00)' }, doc.rounding)}</select>
            </div>
            <div class="form-group">
                <label for="docColor">Farba dokladu</label>
                <input type="color" id="docColor" value="${esc(doc.color || '#2196F3')}">
            </div>
        </div>`;
}

function editorHtml(doc) {
    const esc = Calc.escapeHtml;
    const contacts = Store.getContacts();
    const catalog = Store.getCatalog();
    const typeLabel = Store.DOC_TYPES[doc.type].label;

    return `
        ${doc.relatedFrom && doc.relatedFrom.number
            ? `<div class="related-note">Doklad bol vytvorený z ${esc(Store.DOC_TYPES[doc.relatedFrom.type].label.toLowerCase())} <strong>${esc(doc.relatedFrom.number)}</strong>.</div>`
            : ''}

        <section class="form-section">
            <h2><span class="section-icon">${Store.DOC_TYPES[doc.type].icon}</span> ${esc(typeLabel)}</h2>
            ${documentFieldsHtml(doc)}
        </section>

        <section class="form-section collapsible collapsed">
            <h2 class="collapsible-header" data-action="editor-toggle-section">
                <span class="section-icon">&#128100;</span> Dodávateľ
                <span class="toggle-icon">&#9660;</span>
            </h2>
            <div class="collapsible-content">
                ${partyFields('supplier', doc.supplier || {})}
                <div class="inline-actions">
                    <button type="button" class="btn-secondary" data-action="editor-save-supplier">Uložiť ako predvoleného dodávateľa</button>
                </div>
            </div>
        </section>

        <section class="form-section">
            <h2><span class="section-icon">&#128101;</span> Odberateľ</h2>
            <div class="form-grid">
                <div class="form-group full-width">
                    <label for="contactPicker">Vybrať z kontaktov</label>
                    <select id="contactPicker" data-action="editor-pick-contact">
                        <option value="">– vybrať kontakt –</option>
                        ${contacts.map(contact => `<option value="${esc(contact.id)}"${contact.id === doc.contactId ? ' selected' : ''}>${esc(contact.name)}${contact.ico ? ` (IČO ${esc(contact.ico)})` : ''}</option>`).join('')}
                    </select>
                </div>
            </div>
            ${partyFields('customer', doc.customer || {})}
            <div class="inline-actions">
                <button type="button" class="btn-secondary" data-action="editor-save-contact">Uložiť odberateľa do kontaktov</button>
            </div>
        </section>

        <section class="form-section">
            <h2><span class="section-icon">&#128176;</span> Položky</h2>
            <div class="pricing-toggle">
                <label>Zadávanie cien:</label>
                <label class="radio-label"><input type="radio" name="pricingMode" value="withoutVat"${doc.pricingMode !== 'withVat' ? ' checked' : ''}> Bez DPH</label>
                <label class="radio-label"><input type="radio" name="pricingMode" value="withVat"${doc.pricingMode === 'withVat' ? ' checked' : ''}> S DPH</label>
            </div>
            <div class="items-table-wrapper">
                <table class="items-table">
                    <thead>
                        <tr>
                            <th class="col-qty">Počet</th>
                            <th class="col-unit">M.J.</th>
                            <th class="col-desc">Popis</th>
                            <th class="col-vat">DPH %</th>
                            <th class="col-price">Cena</th>
                            <th class="col-total">Celkom</th>
                            <th class="col-actions"></th>
                        </tr>
                    </thead>
                    <tbody id="itemsBody">
                        ${(doc.items && doc.items.length ? doc.items : [{ qty: 1, unit: 'ks', desc: '', vatRate: 20, price: 0 }]).map(itemRowHtml).join('')}
                    </tbody>
                </table>
            </div>
            <div class="items-actions">
                <button type="button" class="btn-add" data-action="editor-add-item">+ Pridať položku</button>
                ${catalog.length ? `
                    <select id="catalogPicker" data-action="editor-add-from-catalog">
                        <option value="">+ Pridať z cenníka</option>
                        ${catalog.map(item => `<option value="${esc(item.id)}">${esc(item.desc)} – ${Calc.formatAmount(Number(item.price) || 0)}</option>`).join('')}
                    </select>` : ''}
            </div>

            <div class="form-grid">
                <div class="form-group">
                    <label for="docDiscountType">Typ zľavy</label>
                    <select id="docDiscountType">${editorOptions({ percent: 'Percentuálna (%)', fixed: 'Pevná suma' }, doc.discountType)}</select>
                </div>
                <div class="form-group">
                    <label for="docDiscountValue">Hodnota zľavy</label>
                    <input type="number" id="docDiscountValue" value="${esc(doc.discountValue || 0)}" min="0" step="0.01">
                </div>
            </div>

            <div class="form-group full-width">
                <label for="docNote">Poznámka na doklade</label>
                <textarea id="docNote" rows="3" placeholder="Voliteľná poznámka zobrazená na doklade...">${esc(doc.note)}</textarea>
            </div>
            <div class="form-group full-width">
                <label for="docRegistryInfo">Informácia o zapísaní do registra</label>
                <textarea id="docRegistryInfo" rows="2">${esc(doc.registryInfo)}</textarea>
            </div>
        </section>

        <div class="editor-summary" id="editorSummary"></div>`;
}

function readParty(prefix) {
    const value = id => {
        const element = document.getElementById(prefix + id);
        return element ? element.value.trim() : '';
    };
    return {
        name: value('Name'),
        ico: value('Ico'),
        dic: value('Dic'),
        icdph: value('Icdph'),
        street: value('Street'),
        city: value('City'),
        zip: value('Zip'),
        country: value('Country'),
        email: value('Email'),
        phone: value('Phone'),
        web: value('Web'),
    };
}

function readItems() {
    return Array.from(document.querySelectorAll('#itemsBody .item-row')).map(row => ({
        qty: Number(row.querySelector('.item-qty').value) || 0,
        unit: row.querySelector('.item-unit').value,
        desc: row.querySelector('.item-desc').value.trim(),
        vatRate: Number(row.querySelector('.item-vat').value) || 0,
        price: Number(row.querySelector('.item-price').value) || 0,
    }));
}

function readEditor() {
    const value = (id, fallback) => {
        const element = document.getElementById(id);
        return element ? element.value : (fallback !== undefined ? fallback : '');
    };
    const pricingMode = document.querySelector('input[name="pricingMode"]:checked');

    return Object.assign({}, editorDoc, {
        subtype: editorDoc.type === 'faktura' ? value('docSubtype', editorDoc.subtype) : '',
        number: value('docNumber', editorDoc.number).trim(),
        status: value('docStatus', editorDoc.status),
        issuedBy: value('docIssuedBy'),
        issueDate: value('docIssueDate'),
        deliveryDate: value('docDeliveryDate', editorDoc.deliveryDate),
        dueDate: value('docDueDate', editorDoc.dueDate),
        validUntil: value('docValidUntil', editorDoc.validUntil),
        paymentMethod: value('docPaymentMethod', editorDoc.paymentMethod),
        variableSymbol: value('docVariableSymbol', editorDoc.variableSymbol),
        constantSymbol: value('docConstantSymbol', editorDoc.constantSymbol),
        specificSymbol: value('docSpecificSymbol', editorDoc.specificSymbol),
        bankAccount: value('docBankAccount', editorDoc.bankAccount),
        bankName: value('docBankName', editorDoc.bankName),
        swift: value('docSwift', editorDoc.swift),
        currency: value('docCurrency', editorDoc.currency),
        rounding: value('docRounding', editorDoc.rounding),
        color: value('docColor', editorDoc.color),
        pricingMode: pricingMode ? pricingMode.value : editorDoc.pricingMode,
        discountType: value('docDiscountType', editorDoc.discountType),
        discountValue: Number(value('docDiscountValue', 0)) || 0,
        note: value('docNote'),
        registryInfo: value('docRegistryInfo'),
        contactId: value('contactPicker', editorDoc.contactId),
        supplier: readParty('supplier'),
        customer: readParty('customer'),
        items: readItems(),
    });
}

function refreshEditorTotals() {
    if (!editorDoc) return;
    const doc = readEditor();
    const totals = Calc.computeTotals(doc);
    const currency = Calc.currencySymbol(doc.currency);

    document.querySelectorAll('#itemsBody .item-row').forEach((row, index) => {
        const line = totals.lines[index];
        if (!line) return;
        row.querySelector('.item-total').textContent = Calc.formatAmount(totals.useVat ? line.gross : line.net);
    });

    const summary = document.getElementById('editorSummary');
    if (!summary) return;
    summary.innerHTML = `
        ${totals.useVat ? `
            <div class="sum"><span>Celkom bez DPH</span><strong>${Calc.formatAmount(totals.subtotal)} ${currency}</strong></div>
            <div class="sum"><span>DPH</span><strong>${Calc.formatAmount(totals.vatTotal)} ${currency}</strong></div>` : `
            <div class="sum"><span>Celkom</span><strong>${Calc.formatAmount(totals.subtotal)} ${currency}</strong></div>`}
        ${totals.discount > 0 ? `<div class="sum"><span>Zľava</span><strong>-${Calc.formatAmount(totals.discount)} ${currency}</strong></div>` : ''}
        ${totals.roundingDiff !== 0 ? `<div class="sum"><span>Zaokrúhlenie</span><strong>${Calc.formatAmount(totals.roundingDiff)} ${currency}</strong></div>` : ''}
        <div class="sum final"><span>Na úhradu</span><strong>${Calc.formatAmount(totals.total)} ${currency}</strong></div>`;
}

function openEditor(doc) {
    editorDoc = doc;
    const existing = Boolean(Store.getDocument(doc.id));
    document.getElementById('editorTitle').textContent = existing
        ? `${Store.DOC_TYPES[doc.type].label} ${doc.number}`
        : `Nový doklad – ${Store.DOC_TYPES[doc.type].label.toLowerCase()}`;
    document.getElementById('editorBody').innerHTML = editorHtml(doc);
    document.getElementById('editorOverlay').classList.remove('hidden');
    document.getElementById('editorBody').scrollTop = 0;
    refreshEditorTotals();
}

function closeEditor() {
    editorDoc = null;
    document.getElementById('editorOverlay').classList.add('hidden');
    document.getElementById('editorBody').innerHTML = '';
}

function editorAddItem(item) {
    const tbody = document.getElementById('itemsBody');
    const defaults = { qty: 1, unit: 'ks', desc: '', vatRate: Store.getSettings().defaultVatRate, price: 0 };
    tbody.insertAdjacentHTML('beforeend', itemRowHtml(Object.assign(defaults, item || {})));
    refreshEditorTotals();
}

function editorRemoveItem(button) {
    const tbody = document.getElementById('itemsBody');
    if (tbody.children.length <= 1) {
        UI.toast('Doklad musí obsahovať aspoň jednu položku.', 'error');
        return;
    }
    button.closest('tr').remove();
    refreshEditorTotals();
}

function applyContactToEditor(contactId) {
    if (!contactId) return;
    const contact = Store.getContact(contactId);
    if (!contact) return;
    const fields = { Name: 'name', Ico: 'ico', Dic: 'dic', Icdph: 'icdph', Street: 'street', City: 'city', Zip: 'zip', Country: 'country', Email: 'email', Phone: 'phone', Web: 'web' };
    Object.keys(fields).forEach(suffix => {
        const element = document.getElementById('customer' + suffix);
        if (element) element.value = contact[fields[suffix]] || (suffix === 'Country' ? 'Slovensko' : '');
    });
    refreshEditorTotals();
}

function saveEditorDocument() {
    const doc = readEditor();
    if (!doc.customer.name) {
        UI.toast('Zadajte názov odberateľa.', 'error');
        return null;
    }
    if (!doc.number) {
        UI.toast('Zadajte číslo dokladu.', 'error');
        return null;
    }
    if (doc.items.every(item => !item.desc && !item.price)) {
        UI.toast('Doklad neobsahuje žiadnu vyplnenú položku.', 'error');
        return null;
    }

    const saved = Store.saveDocument(doc);
    editorDoc = saved;
    UI.toast(`${Store.DOC_TYPES[saved.type].label} ${saved.number} bola uložená.`, 'success');
    return saved;
}

window.Editor = {
    openEditor,
    closeEditor,
    readEditor,
    refreshEditorTotals,
    editorAddItem,
    editorRemoveItem,
    applyContactToEditor,
    saveEditorDocument,
    isOpen: () => Boolean(editorDoc),
};
