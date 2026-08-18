// === Obrazovky aplikácie: prehľad, zoznamy dokladov, kontakty, cenník, nastavenia ===

const listFilters = {
    faktura: { search: '', status: '', from: '', to: '', sort: 'issueDate-desc' },
    ponuka: { search: '', status: '', from: '', to: '', sort: 'issueDate-desc' },
    objednavka: { search: '', status: '', from: '', to: '', sort: 'issueDate-desc' },
};

function docTotal(doc) {
    return Calc.computeTotals(doc).total;
}

function sumTotals(docs) {
    return docs.reduce((sum, doc) => sum + docTotal(doc), 0);
}

// Slovenské skloňovanie: 1 doklad, 2-4 doklady, 0/5+ dokladov
function plural(count, one, few, many) {
    if (count === 1) return one;
    if (count >= 2 && count <= 4) return few;
    return many;
}

function pluralInvoices(count) {
    return plural(count, 'faktúra', 'faktúry', 'faktúr');
}

function docCurrency(docs) {
    return docs.length ? docs[0].currency : Store.getSettings().currency;
}

// Súčet má zmysel len ak majú všetky doklady rovnakú menu.
function singleCurrency(docs) {
    const currencies = new Set(docs.map(doc => doc.currency));
    return currencies.size > 1 ? null : docCurrency(docs);
}

function emptyState(message, actionHtml) {
    return `<div class="empty-state"><span class="empty-icon">&#128188;</span>${Calc.escapeHtml(message)}${actionHtml ? `<div class="inline-actions" style="justify-content:center;margin-top:1rem">${actionHtml}</div>` : ''}</div>`;
}

// === Prehľad ===

function renderDashboard(container) {
    const documents = Store.getDocuments();
    const invoices = documents.filter(doc => doc.type === 'faktura' && doc.status !== 'stornovana');
    const issued = invoices.filter(doc => doc.status !== 'koncept');
    const drafts = invoices.filter(doc => doc.status === 'koncept');
    const paid = issued.filter(doc => doc.status === 'zaplatena');
    const unpaid = issued.filter(doc => doc.status !== 'zaplatena');
    const overdue = issued.filter(Calc.isOverdue);
    const quotes = Store.getDocuments('ponuka');
    const openQuotes = quotes.filter(doc => doc.status === 'koncept' || doc.status === 'odoslana');
    const orders = Store.getDocuments('objednavka');
    const openOrders = orders.filter(doc => doc.status !== 'vybavena' && doc.status !== 'zrusena');
    const currency = Store.getSettings().currency;

    const year = new Date().getFullYear();
    const paidThisYear = paid.filter(doc => (doc.issueDate || '').startsWith(String(year)));

    const months = [];
    for (let offset = 5; offset >= 0; offset -= 1) {
        const date = new Date();
        date.setDate(1);
        date.setMonth(date.getMonth() - offset);
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        const monthInvoices = issued.filter(doc => (doc.issueDate || '').startsWith(key));
        months.push({
            key,
            label: `${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getFullYear()).slice(-2)}`,
            total: sumTotals(monthInvoices),
            count: monthInvoices.length,
        });
    }
    const maxMonth = Math.max(1, ...months.map(month => month.total));

    const recent = documents
        .slice()
        .sort((a, b) => String(b.updatedAt || b.createdAt || '').localeCompare(String(a.updatedAt || a.createdAt || '')))
        .slice(0, 8);

    container.innerHTML = `
        <div class="stat-grid">
            <div class="stat accent">
                <div class="stat-label">Fakturované ${year}</div>
                <div class="stat-value">${Calc.formatMoney(sumTotals(issued.filter(doc => (doc.issueDate || '').startsWith(String(year)))), currency)}</div>
                <div class="stat-sub">Zaplatené: ${Calc.formatMoney(sumTotals(paidThisYear), currency)}${drafts.length ? ` · konceptov: ${drafts.length}` : ''}</div>
            </div>
            <div class="stat danger">
                <div class="stat-label">Neuhradené faktúry</div>
                <div class="stat-value">${Calc.formatMoney(sumTotals(unpaid), currency)}</div>
                <div class="stat-sub">${unpaid.length} ${pluralInvoices(unpaid.length)}, po splatnosti ${overdue.length}</div>
            </div>
            <div class="stat">
                <div class="stat-label">Otvorené cenové ponuky</div>
                <div class="stat-value">${openQuotes.length}</div>
                <div class="stat-sub">Hodnota ${Calc.formatMoney(sumTotals(openQuotes), currency)}</div>
            </div>
            <div class="stat success">
                <div class="stat-label">Nevybavené objednávky</div>
                <div class="stat-value">${openOrders.length}</div>
                <div class="stat-sub">Hodnota ${Calc.formatMoney(sumTotals(openOrders), currency)}</div>
            </div>
        </div>

        <div class="card">
            <div class="card-title">Fakturácia za posledných 6 mesiacov</div>
            <div class="bar-chart">
                ${months.map(month => `
                    <div class="bar-col" title="${month.count} dokladov">
                        <span class="bar-value">${month.total ? Calc.formatAmount(month.total) : ''}</span>
                        <div class="bar" style="height:${Math.round((month.total / maxMonth) * 100)}%"></div>
                        <span class="bar-label">${month.label}</span>
                    </div>`).join('')}
            </div>
        </div>

        <div class="card">
            <div class="card-title">
                Po splatnosti
                <span class="badge overdue">${overdue.length}</span>
            </div>
            ${overdue.length ? `
                <div class="table-wrap">
                    <table class="data-table">
                        <thead><tr><th>Číslo</th><th>Odberateľ</th><th>Splatnosť</th><th class="num">Suma</th><th></th></tr></thead>
                        <tbody>
                            ${overdue.map(doc => `
                                <tr>
                                    <td><span class="doc-number" data-action="preview" data-id="${doc.id}">${Calc.escapeHtml(doc.number)}</span></td>
                                    <td>${Calc.escapeHtml(doc.customer.name)}</td>
                                    <td>${Calc.formatDate(doc.dueDate)}</td>
                                    <td class="num">${Calc.formatMoney(docTotal(doc), doc.currency)}</td>
                                    <td class="row-actions"><button type="button" data-action="mark-paid" data-id="${doc.id}" title="Označiť ako zaplatenú">&#10003; Zaplatená</button></td>
                                </tr>`).join('')}
                        </tbody>
                    </table>
                </div>` : '<p class="stat-sub">Žiadne faktúry po splatnosti.</p>'}
        </div>

        <div class="card">
            <div class="card-title">Naposledy upravené doklady</div>
            ${recent.length ? `
                <div class="table-wrap">
                    <table class="data-table">
                        <thead><tr><th>Typ</th><th>Číslo</th><th>Odberateľ</th><th>Dátum</th><th>Stav</th><th class="num">Suma</th><th></th></tr></thead>
                        <tbody>
                            ${recent.map(doc => `
                                <tr>
                                    <td>${Store.DOC_TYPES[doc.type].icon} ${Calc.escapeHtml(Store.DOC_TYPES[doc.type].label)}</td>
                                    <td><span class="doc-number" data-action="preview" data-id="${doc.id}">${Calc.escapeHtml(doc.number)}</span></td>
                                    <td>${Calc.escapeHtml(doc.customer.name)}</td>
                                    <td>${Calc.formatDate(doc.issueDate)}</td>
                                    <td>${UI.statusBadge(doc)}</td>
                                    <td class="num">${Calc.formatMoney(docTotal(doc), doc.currency)}</td>
                                    <td class="row-actions">
                                        <button type="button" data-action="edit" data-id="${doc.id}" title="Upraviť">&#9998;</button>
                                        <button type="button" data-action="pdf" data-id="${doc.id}" title="PDF">&#128229;</button>
                                    </td>
                                </tr>`).join('')}
                        </tbody>
                    </table>
                </div>` : emptyState('Zatiaľ nemáte žiadne doklady.', '<button type="button" class="btn-primary" data-action="new" data-type="faktura">+ Vytvoriť faktúru</button>')}
        </div>`;
}

// === Zoznam dokladov ===

function filterDocuments(type) {
    const filters = listFilters[type];
    const term = filters.search.trim().toLowerCase();

    let docs = Store.getDocuments(type).filter(doc => {
        if (term) {
            const haystack = [doc.number, doc.customer.name, doc.customer.ico, doc.note].join(' ').toLowerCase();
            if (!haystack.includes(term)) return false;
        }
        if (filters.status === '__overdue') {
            if (!Calc.isOverdue(doc)) return false;
        } else if (filters.status && doc.status !== filters.status) {
            return false;
        }
        if (filters.from && (doc.issueDate || '') < filters.from) return false;
        if (filters.to && (doc.issueDate || '') > filters.to) return false;
        return true;
    });

    const [field, direction] = filters.sort.split('-');
    docs = docs.sort((a, b) => {
        let compare;
        if (field === 'total') {
            compare = docTotal(a) - docTotal(b);
        } else if (field === 'customer') {
            compare = (a.customer.name || '').localeCompare(b.customer.name || '', 'sk');
        } else if (field === 'number') {
            compare = String(a.number).localeCompare(String(b.number), 'sk', { numeric: true });
        } else {
            compare = String(a[field] || '').localeCompare(String(b[field] || ''));
        }
        return direction === 'asc' ? compare : -compare;
    });

    return docs;
}

function convertButtons(doc) {
    if (doc.type === 'ponuka') {
        return `<button type="button" data-action="convert" data-id="${doc.id}" data-target="objednavka" title="Vytvoriť objednávku">&#8594; OBJ</button>
                <button type="button" data-action="convert" data-id="${doc.id}" data-target="faktura" title="Vytvoriť faktúru">&#8594; FA</button>`;
    }
    if (doc.type === 'objednavka') {
        return `<button type="button" data-action="convert" data-id="${doc.id}" data-target="faktura" title="Vytvoriť faktúru">&#8594; FA</button>`;
    }
    return '';
}

function renderDocumentList(container, type) {
    const config = Store.DOC_TYPES[type];
    const filters = listFilters[type];
    const docs = filterDocuments(type);
    const statusOptions = Object.keys(config.statuses)
        .map(key => `<option value="${key}"${filters.status === key ? ' selected' : ''}>${Calc.escapeHtml(config.statuses[key])}</option>`)
        .join('');

    container.innerHTML = `
        <div class="card">
            <div class="filters">
                <div class="filter grow">
                    <label for="filterSearch">Hľadať</label>
                    <input type="search" id="filterSearch" value="${Calc.escapeHtml(filters.search)}" placeholder="číslo dokladu, odberateľ, IČO...">
                </div>
                <div class="filter">
                    <label for="filterStatus">Stav</label>
                    <select id="filterStatus">
                        <option value="">Všetky</option>
                        ${statusOptions}
                        ${type === 'faktura' ? `<option value="__overdue"${filters.status === '__overdue' ? ' selected' : ''}>Po splatnosti</option>` : ''}
                    </select>
                </div>
                <div class="filter">
                    <label for="filterFrom">Od</label>
                    <input type="date" id="filterFrom" value="${Calc.escapeHtml(filters.from)}">
                </div>
                <div class="filter">
                    <label for="filterTo">Do</label>
                    <input type="date" id="filterTo" value="${Calc.escapeHtml(filters.to)}">
                </div>
                <div class="filter">
                    <label for="filterSort">Zoradiť</label>
                    <select id="filterSort">
                        <option value="issueDate-desc"${filters.sort === 'issueDate-desc' ? ' selected' : ''}>Dátum (najnovšie)</option>
                        <option value="issueDate-asc"${filters.sort === 'issueDate-asc' ? ' selected' : ''}>Dátum (najstaršie)</option>
                        <option value="number-desc"${filters.sort === 'number-desc' ? ' selected' : ''}>Číslo (zostupne)</option>
                        <option value="number-asc"${filters.sort === 'number-asc' ? ' selected' : ''}>Číslo (vzostupne)</option>
                        <option value="total-desc"${filters.sort === 'total-desc' ? ' selected' : ''}>Suma (najvyššia)</option>
                        <option value="customer-asc"${filters.sort === 'customer-asc' ? ' selected' : ''}>Odberateľ (A–Z)</option>
                    </select>
                </div>
                <div class="filter">
                    <label>&nbsp;</label>
                    <button type="button" class="btn-secondary" data-action="export-csv" data-type="${type}">&#128202; CSV</button>
                </div>
            </div>

            <div class="stat-sub" style="margin-bottom:0.8rem">
                Zobrazené: ${docs.length} ${plural(docs.length, 'doklad', 'doklady', 'dokladov')}${singleCurrency(docs) ? ` · celkom ${Calc.formatMoney(sumTotals(docs), singleCurrency(docs))}` : ''}
            </div>

            ${docs.length ? `
                <div class="table-wrap">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>Číslo</th>
                                <th>Odberateľ</th>
                                <th>Vystavené</th>
                                <th>${type === 'faktura' ? 'Splatnosť' : type === 'ponuka' ? 'Platnosť do' : 'Dodanie'}</th>
                                <th>Stav</th>
                                <th class="num">Suma</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody>
                            ${docs.map(doc => `
                                <tr>
                                    <td><span class="doc-number" data-action="preview" data-id="${doc.id}">${Calc.escapeHtml(doc.number)}</span>
                                        ${doc.relatedFrom && doc.relatedFrom.number ? `<div class="stat-sub">z ${Calc.escapeHtml(doc.relatedFrom.number)}</div>` : ''}</td>
                                    <td>${Calc.escapeHtml(doc.customer.name)}${doc.customer.ico ? `<div class="stat-sub">IČO ${Calc.escapeHtml(doc.customer.ico)}</div>` : ''}</td>
                                    <td>${Calc.formatDate(doc.issueDate)}</td>
                                    <td>${Calc.formatDate(type === 'faktura' ? doc.dueDate : type === 'ponuka' ? doc.validUntil : doc.deliveryDate)}</td>
                                    <td>${UI.statusBadge(doc)}</td>
                                    <td class="num">${Calc.formatMoney(docTotal(doc), doc.currency)}</td>
                                    <td>
                                        <div class="row-actions">
                                            <button type="button" data-action="edit" data-id="${doc.id}" title="Upraviť">&#9998;</button>
                                            <button type="button" data-action="preview" data-id="${doc.id}" title="Náhľad">&#128065;</button>
                                            <button type="button" data-action="pdf" data-id="${doc.id}" title="Stiahnuť PDF">&#128229;</button>
                                            <button type="button" data-action="duplicate" data-id="${doc.id}" title="Duplikovať">&#128203;</button>
                                            ${type === 'faktura' && doc.status !== 'zaplatena' ? `<button type="button" data-action="mark-paid" data-id="${doc.id}" title="Označiť ako zaplatenú">&#10003;</button>` : ''}
                                            ${convertButtons(doc)}
                                            <button type="button" class="danger" data-action="delete" data-id="${doc.id}" title="Zmazať">&#128465;</button>
                                        </div>
                                    </td>
                                </tr>`).join('')}
                        </tbody>
                    </table>
                </div>` : emptyState(`Žiadne doklady typu „${config.plural.toLowerCase()}“ nezodpovedajú filtru.`,
                `<button type="button" class="btn-primary" data-action="new" data-type="${type}">+ Nový doklad</button>`)}
        </div>`;

    const bind = (id, key, event) => {
        const element = document.getElementById(id);
        if (!element) return;
        element.addEventListener(event || 'change', () => {
            filters[key] = element.value;
            const wasFocused = document.activeElement === element;
            renderDocumentList(container, type);
            if (wasFocused) {
                const fresh = document.getElementById(id);
                if (fresh) {
                    fresh.focus();
                    if (typeof fresh.setSelectionRange === 'function' && fresh.type !== 'date') {
                        const end = fresh.value.length;
                        fresh.setSelectionRange(end, end);
                    }
                }
            }
        });
    };
    bind('filterSearch', 'search', 'input');
    bind('filterStatus', 'status');
    bind('filterFrom', 'from');
    bind('filterTo', 'to');
    bind('filterSort', 'sort');
}

function exportDocumentsCsv(type) {
    const docs = filterDocuments(type);
    if (!docs.length) {
        UI.toast('Nie je čo exportovať.', 'error');
        return;
    }
    const header = ['Typ', 'Číslo', 'Stav', 'Vystavené', 'Splatnosť', 'Odberateľ', 'IČO', 'Bez DPH', 'DPH', 'Celkom', 'Mena'];
    const rows = docs.map(doc => {
        const totals = Calc.computeTotals(doc);
        return [
            Store.DOC_TYPES[doc.type].label,
            doc.number,
            Store.DOC_TYPES[doc.type].statuses[doc.status] || doc.status,
            doc.issueDate,
            (doc.type === 'faktura' ? doc.dueDate : doc.type === 'ponuka' ? doc.validUntil : doc.deliveryDate) || '',
            doc.customer.name,
            doc.customer.ico,
            totals.subtotal.toFixed(2),
            totals.vatTotal.toFixed(2),
            totals.total.toFixed(2),
            doc.currency,
        ];
    });
    const csv = [header, ...rows]
        .map(row => row.map(cell => `"${String(cell === undefined || cell === null ? '' : cell).replace(/"/g, '""')}"`).join(';'))
        .join('\r\n');
    UI.downloadFile(`${type}_export_${Calc.todayIso()}.csv`, '\uFEFF' + csv, 'text/csv;charset=utf-8');
}

// === Kontakty ===

function renderContacts(container) {
    const contacts = Store.getContacts();
    const documents = Store.getDocuments();

    container.innerHTML = `
        <div class="card">
            <div class="card-title">
                Kontakty (${contacts.length})
                <button type="button" class="btn-primary" data-action="contact-new">+ Nový kontakt</button>
            </div>
            ${contacts.length ? `
                <div class="table-wrap">
                    <table class="data-table">
                        <thead><tr><th>Názov</th><th>IČO / DIČ</th><th>Adresa</th><th>Kontakt</th><th class="num">Doklady</th><th class="num">Obrat</th><th></th></tr></thead>
                        <tbody>
                            ${contacts.map(contact => {
                                const related = documents.filter(doc => doc.contactId === contact.id || (contact.ico && doc.customer.ico === contact.ico) || doc.customer.name === contact.name);
                                return `
                                <tr>
                                    <td><strong>${Calc.escapeHtml(contact.name)}</strong></td>
                                    <td>${Calc.escapeHtml(contact.ico || '')}${contact.dic ? ` / ${Calc.escapeHtml(contact.dic)}` : ''}</td>
                                    <td>${Calc.escapeHtml([contact.street, `${contact.zip || ''} ${contact.city || ''}`.trim()].filter(Boolean).join(', '))}</td>
                                    <td>${Calc.escapeHtml(contact.email || '')}${contact.phone ? `<div class="stat-sub">${Calc.escapeHtml(contact.phone)}</div>` : ''}</td>
                                    <td class="num">${related.length}</td>
                                    <td class="num">${Calc.formatMoney(sumTotals(related.filter(doc => doc.type === 'faktura')), Store.getSettings().currency)}</td>
                                    <td>
                                        <div class="row-actions">
                                            <button type="button" data-action="contact-edit" data-id="${contact.id}" title="Upraviť">&#9998;</button>
                                            <button type="button" data-action="contact-invoice" data-id="${contact.id}" title="Nová faktúra">&#128196;</button>
                                            <button type="button" class="danger" data-action="contact-delete" data-id="${contact.id}" title="Zmazať">&#128465;</button>
                                        </div>
                                    </td>
                                </tr>`;
                            }).join('')}
                        </tbody>
                    </table>
                </div>` : emptyState('Zatiaľ nemáte uložené žiadne kontakty.', '<button type="button" class="btn-primary" data-action="contact-new">+ Nový kontakt</button>')}
        </div>`;
}

function contactFormHtml(contact) {
    const esc = Calc.escapeHtml;
    return `
        <form id="contactForm" class="form-grid">
            <input type="hidden" id="contactId" value="${esc(contact.id || '')}">
            <div class="form-group full-width">
                <label for="contactName">Názov / meno *</label>
                <input type="text" id="contactName" value="${esc(contact.name || '')}" required>
            </div>
            <div class="form-group"><label for="contactIco">IČO</label><input type="text" id="contactIco" value="${esc(contact.ico || '')}"></div>
            <div class="form-group"><label for="contactDic">DIČ</label><input type="text" id="contactDic" value="${esc(contact.dic || '')}"></div>
            <div class="form-group"><label for="contactIcdph">IČ DPH</label><input type="text" id="contactIcdph" value="${esc(contact.icdph || '')}"></div>
            <div class="form-group"><label for="contactStreet">Ulica</label><input type="text" id="contactStreet" value="${esc(contact.street || '')}"></div>
            <div class="form-group"><label for="contactCity">Mesto</label><input type="text" id="contactCity" value="${esc(contact.city || '')}"></div>
            <div class="form-group"><label for="contactZip">PSČ</label><input type="text" id="contactZip" value="${esc(contact.zip || '')}"></div>
            <div class="form-group"><label for="contactCountry">Krajina</label><input type="text" id="contactCountry" value="${esc(contact.country || 'Slovensko')}"></div>
            <div class="form-group"><label for="contactEmail">E-mail</label><input type="email" id="contactEmail" value="${esc(contact.email || '')}"></div>
            <div class="form-group"><label for="contactPhone">Telefón</label><input type="tel" id="contactPhone" value="${esc(contact.phone || '')}"></div>
            <div class="form-group"><label for="contactWeb">Web</label><input type="url" id="contactWeb" value="${esc(contact.web || '')}"></div>
            <div class="form-group full-width"><label for="contactNote">Poznámka</label><textarea id="contactNote" rows="2">${esc(contact.note || '')}</textarea></div>
        </form>`;
}

function readContactForm() {
    const value = id => {
        const element = document.getElementById(id);
        return element ? element.value.trim() : '';
    };
    return {
        id: value('contactId') || undefined,
        name: value('contactName'),
        ico: value('contactIco'),
        dic: value('contactDic'),
        icdph: value('contactIcdph'),
        street: value('contactStreet'),
        city: value('contactCity'),
        zip: value('contactZip'),
        country: value('contactCountry'),
        email: value('contactEmail'),
        phone: value('contactPhone'),
        web: value('contactWeb'),
        note: value('contactNote'),
    };
}

// === Cenník položiek ===

function renderCatalog(container) {
    const items = Store.getCatalog();
    container.innerHTML = `
        <div class="card">
            <div class="card-title">
                Cenník položiek (${items.length})
                <button type="button" class="btn-primary" data-action="catalog-new">+ Nová položka</button>
            </div>
            ${items.length ? `
                <div class="table-wrap">
                    <table class="data-table">
                        <thead><tr><th>Popis</th><th>M.J.</th><th class="num">Cena</th><th class="num">DPH</th><th></th></tr></thead>
                        <tbody>
                            ${items.map(item => `
                                <tr>
                                    <td>${Calc.escapeHtml(item.desc)}</td>
                                    <td>${Calc.escapeHtml(item.unit || '')}</td>
                                    <td class="num">${Calc.formatMoney(Number(item.price) || 0, Store.getSettings().currency)}</td>
                                    <td class="num">${Number(item.vatRate) || 0} %</td>
                                    <td>
                                        <div class="row-actions">
                                            <button type="button" data-action="catalog-edit" data-id="${item.id}" title="Upraviť">&#9998;</button>
                                            <button type="button" class="danger" data-action="catalog-delete" data-id="${item.id}" title="Zmazať">&#128465;</button>
                                        </div>
                                    </td>
                                </tr>`).join('')}
                        </tbody>
                    </table>
                </div>` : emptyState('Cenník je prázdny. Uložte si opakujúce sa produkty a služby.', '<button type="button" class="btn-primary" data-action="catalog-new">+ Nová položka</button>')}
        </div>`;
}

function catalogFormHtml(item) {
    const esc = Calc.escapeHtml;
    const vatOptions = Calc.VAT_RATES.map(rate => `<option value="${rate}"${Number(item.vatRate) === rate ? ' selected' : ''}>${rate} %</option>`).join('');
    const unitOptions = Calc.UNITS.map(unit => `<option value="${esc(unit)}"${unit === item.unit ? ' selected' : ''}>${esc(unit || '-')}</option>`).join('');
    return `
        <form id="catalogForm" class="form-grid">
            <input type="hidden" id="catalogId" value="${esc(item.id || '')}">
            <div class="form-group full-width"><label for="catalogDesc">Popis *</label><input type="text" id="catalogDesc" value="${esc(item.desc || '')}" required></div>
            <div class="form-group"><label for="catalogUnit">Merná jednotka</label><select id="catalogUnit">${unitOptions}</select></div>
            <div class="form-group"><label for="catalogPrice">Cena</label><input type="number" id="catalogPrice" value="${esc(Number(item.price || 0).toFixed(2))}" min="0" step="0.01"></div>
            <div class="form-group"><label for="catalogVat">DPH</label><select id="catalogVat">${vatOptions}</select></div>
        </form>`;
}

function readCatalogForm() {
    const value = id => {
        const element = document.getElementById(id);
        return element ? element.value.trim() : '';
    };
    return {
        id: value('catalogId') || undefined,
        desc: value('catalogDesc'),
        unit: value('catalogUnit'),
        price: Number(value('catalogPrice')) || 0,
        vatRate: Number(value('catalogVat')) || 0,
    };
}

// === Nastavenia ===

function renderSettings(container) {
    const settings = Store.getSettings();
    const esc = Calc.escapeHtml;
    const supplier = settings.supplier;

    container.innerHTML = `
        <div class="card">
            <div class="card-title">Údaje dodávateľa</div>
            <div class="form-grid">
                <div class="form-group"><label for="setName">Názov firmy / meno *</label><input type="text" id="setName" value="${esc(supplier.name)}"></div>
                <div class="form-group"><label for="setIco">IČO</label><input type="text" id="setIco" value="${esc(supplier.ico)}"></div>
                <div class="form-group"><label for="setDic">DIČ</label><input type="text" id="setDic" value="${esc(supplier.dic)}"></div>
                <div class="form-group"><label for="setIcdph">IČ DPH</label><input type="text" id="setIcdph" value="${esc(supplier.icdph)}"></div>
                <div class="form-group"><label for="setStreet">Ulica</label><input type="text" id="setStreet" value="${esc(supplier.street)}"></div>
                <div class="form-group"><label for="setCity">Mesto</label><input type="text" id="setCity" value="${esc(supplier.city)}"></div>
                <div class="form-group"><label for="setZip">PSČ</label><input type="text" id="setZip" value="${esc(supplier.zip)}"></div>
                <div class="form-group"><label for="setCountry">Krajina</label><input type="text" id="setCountry" value="${esc(supplier.country)}"></div>
                <div class="form-group"><label for="setEmail">E-mail</label><input type="email" id="setEmail" value="${esc(supplier.email)}"></div>
                <div class="form-group"><label for="setPhone">Telefón</label><input type="tel" id="setPhone" value="${esc(supplier.phone)}"></div>
                <div class="form-group"><label for="setWeb">Web</label><input type="url" id="setWeb" value="${esc(supplier.web)}"></div>
                <div class="form-group"><label for="setIssuedBy">Vystavuje (meno)</label><input type="text" id="setIssuedBy" value="${esc(settings.issuedBy)}"></div>
            </div>
            <div class="form-grid">
                <div class="form-group"><label for="setBankAccount">Číslo účtu / IBAN</label><input type="text" id="setBankAccount" value="${esc(settings.bankAccount)}"></div>
                <div class="form-group"><label for="setBankName">Názov banky</label><input type="text" id="setBankName" value="${esc(settings.bankName)}"></div>
                <div class="form-group"><label for="setSwift">SWIFT / BIC</label><input type="text" id="setSwift" value="${esc(settings.swift)}"></div>
            </div>
            <div class="form-grid">
                <div class="form-group full-width"><label for="setRegistryInfo">Informácia o zapísaní do registra</label><textarea id="setRegistryInfo" rows="2">${esc(settings.registryInfo)}</textarea></div>
            </div>
        </div>

        <div class="card">
            <div class="card-title">Predvolené hodnoty dokladov</div>
            <div class="form-grid">
                <div class="form-group">
                    <label for="setCurrency">Mena</label>
                    <select id="setCurrency">
                        ${['EUR', 'CZK', 'USD', 'GBP'].map(code => `<option value="${code}"${settings.currency === code ? ' selected' : ''}>${code}</option>`).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label for="setVat">Predvolená DPH</label>
                    <select id="setVat">${Calc.VAT_RATES.map(rate => `<option value="${rate}"${Number(settings.defaultVatRate) === rate ? ' selected' : ''}>${rate} %</option>`).join('')}</select>
                </div>
                <div class="form-group"><label for="setDueDays">Splatnosť (dní)</label><input type="number" id="setDueDays" min="0" value="${esc(settings.defaultDueDays)}"></div>
                <div class="form-group"><label for="setValidityDays">Platnosť ponuky (dní)</label><input type="number" id="setValidityDays" min="0" value="${esc(settings.defaultValidityDays)}"></div>
                <div class="form-group">
                    <label for="setPricingMode">Zadávanie cien</label>
                    <select id="setPricingMode">
                        <option value="withoutVat"${settings.pricingMode !== 'withVat' ? ' selected' : ''}>Bez DPH</option>
                        <option value="withVat"${settings.pricingMode === 'withVat' ? ' selected' : ''}>S DPH</option>
                    </select>
                </div>
                <div class="form-group">
                    <label for="setRounding">Zaokrúhľovanie</label>
                    <select id="setRounding">
                        ${[['none', 'Žiadne'], ['0.01', 'Na centy'], ['0.05', 'Na 5 centov'], ['0.10', 'Na 10 centov'], ['1', 'Na celé']]
                            .map(([value, label]) => `<option value="${value}"${String(settings.rounding) === value ? ' selected' : ''}>${label}</option>`).join('')}
                    </select>
                </div>
                <div class="form-group"><label for="setColor">Farba dokladov</label><input type="color" id="setColor" value="${esc(settings.color)}"></div>
                <div class="form-group"><label for="setLogo">Logo (PNG/JPG)</label><input type="file" id="setLogo" accept="image/png,image/jpeg"></div>
            </div>
            ${settings.logo ? `<div class="inline-actions"><img src="${esc(settings.logo)}" alt="Logo" style="max-height:60px;border:1px solid #e4e9f0;border-radius:8px;padding:4px;background:#fff">
                <button type="button" class="btn-secondary" data-action="remove-logo">Odstrániť logo</button></div>` : ''}
        </div>

        <div class="card">
            <div class="card-title">Číselné rady</div>
            <div class="table-wrap">
                <table class="data-table">
                    <thead><tr><th>Typ dokladu</th><th>Vzor</th><th class="num">Ďalšie číslo</th><th>Náhľad</th></tr></thead>
                    <tbody>
                        ${Object.keys(Store.DOC_TYPES).map(type => {
                            const series = settings.series[type];
                            return `
                            <tr>
                                <td>${Calc.escapeHtml(Store.DOC_TYPES[type].label)}</td>
                                <td><input type="text" id="setPattern_${type}" value="${esc(series.pattern)}" style="width:180px"></td>
                                <td class="num"><input type="number" id="setNext_${type}" min="1" value="${esc(series.next)}" style="width:100px"></td>
                                <td>${esc(Store.peekNextNumber(type))}</td>
                            </tr>`;
                        }).join('')}
                    </tbody>
                </table>
            </div>
            <p class="stat-sub" style="margin-top:0.6rem">Vo vzore môžete použiť {YYYY}, {YY}, {MM} a {NNNN} (počet N určuje počet číslic).</p>
        </div>

        <div class="card">
            <div class="card-title">Údaje a záloha</div>
            <div class="inline-actions">
                <button type="button" class="btn-primary" data-action="settings-save">&#128190; Uložiť nastavenia</button>
                <button type="button" class="btn-secondary" data-action="export-data">&#11015; Exportovať všetky údaje (JSON)</button>
                <button type="button" class="btn-secondary" data-action="import-data">&#11014; Importovať údaje</button>
                <button type="button" class="btn-secondary" data-action="wipe-data">&#128465; Vymazať všetky údaje</button>
            </div>
            <p class="stat-sub" style="margin-top:0.6rem">
                Uložené: ${Store.getDocuments().length} dokladov, ${Store.getContacts().length} kontaktov, ${Store.getCatalog().length} položiek cenníka.
            </p>
        </div>`;

    const logoInput = document.getElementById('setLogo');
    if (logoInput) {
        logoInput.addEventListener('change', event => {
            const file = event.target.files[0];
            if (!file) return;
            if (file.size > 1024 * 1024) {
                UI.toast('Logo je príliš veľké (max. 1 MB).', 'error');
                event.target.value = '';
                return;
            }
            const reader = new FileReader();
            reader.onload = () => {
                if (!Store.saveSettings({ logo: reader.result })) {
                    UI.toast('Logo sa nepodarilo uložiť – úložisko prehliadača je plné.', 'error');
                    return;
                }
                UI.toast('Logo bolo uložené.', 'success');
                renderSettings(container);
            };
            reader.readAsDataURL(file);
        });
    }
}

function readSettingsForm() {
    const value = id => {
        const element = document.getElementById(id);
        return element ? element.value.trim() : '';
    };
    const series = {};
    Object.keys(Store.DOC_TYPES).forEach(type => {
        series[type] = {
            pattern: value(`setPattern_${type}`) || Store.DEFAULT_SETTINGS.series[type].pattern,
            next: Math.max(1, Number(value(`setNext_${type}`)) || 1),
        };
    });

    return {
        supplier: {
            name: value('setName'),
            ico: value('setIco'),
            dic: value('setDic'),
            icdph: value('setIcdph'),
            street: value('setStreet'),
            city: value('setCity'),
            zip: value('setZip'),
            country: value('setCountry'),
            email: value('setEmail'),
            phone: value('setPhone'),
            web: value('setWeb'),
        },
        issuedBy: value('setIssuedBy'),
        bankAccount: value('setBankAccount'),
        bankName: value('setBankName'),
        swift: value('setSwift'),
        registryInfo: value('setRegistryInfo'),
        currency: value('setCurrency'),
        defaultVatRate: Number(value('setVat')) || 0,
        defaultDueDays: Number(value('setDueDays')) || 0,
        defaultValidityDays: Number(value('setValidityDays')) || 0,
        pricingMode: value('setPricingMode'),
        rounding: value('setRounding'),
        color: value('setColor'),
        series,
    };
}

window.Views = {
    renderDashboard,
    renderDocumentList,
    renderContacts,
    renderCatalog,
    renderSettings,
    exportDocumentsCsv,
    contactFormHtml,
    readContactForm,
    catalogFormHtml,
    readCatalogForm,
    readSettingsForm,
};
