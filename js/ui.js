// === Pomocné UI funkcie: toasty, modálne okná, náhľad dokladu, súbory ===

function toast(message, kind) {
    const container = document.getElementById('toasts');
    const element = document.createElement('div');
    element.className = `toast ${kind || ''}`.trim();
    element.textContent = message;
    container.appendChild(element);
    setTimeout(() => element.remove(), 4000);
}

function openModal(title, bodyHtml, footerHtml) {
    document.getElementById('modalTitle').textContent = title;
    document.getElementById('modalBody').innerHTML = bodyHtml;
    document.getElementById('modalFooter').innerHTML = footerHtml || '<button type="button" class="btn-secondary" data-action="modal-close">Zavrieť</button>';
    document.getElementById('modal').classList.remove('hidden');
}

function closeModal() {
    document.getElementById('modal').classList.add('hidden');
    document.getElementById('modalBody').innerHTML = '';
    document.getElementById('modalFooter').innerHTML = '';
}

function downloadFile(filename, content, mime) {
    const blob = new Blob([content], { type: mime || 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function statusBadge(doc) {
    const type = Store.DOC_TYPES[doc.type];
    const label = (type && type.statuses[doc.status]) || doc.status || '';
    if (Calc.isOverdue(doc)) return `<span class="badge overdue">Po splatnosti</span>`;
    if (Calc.isExpired(doc)) return `<span class="badge expired">Expirovaná</span>`;
    return `<span class="badge ${doc.status}">${Calc.escapeHtml(label)}</span>`;
}

// HTML náhľad dokladu (rovnaké údaje ako v PDF)
function documentPreviewHtml(doc) {
    const totals = Calc.computeTotals(doc);
    const currency = Calc.currencySymbol(doc.currency);
    const esc = Calc.escapeHtml;

    const party = (title, data) => `
        <div class="inv-party">
            <h4>${title}</h4>
            <p><strong>${esc(data.name)}</strong></p>
            ${data.street ? `<p>${esc(data.street)}</p>` : ''}
            ${(data.zip || data.city) ? `<p>${esc(`${data.zip || ''} ${data.city || ''}`.trim())}</p>` : ''}
            ${data.ico ? `<p>IČO: ${esc(data.ico)}</p>` : ''}
            ${data.dic ? `<p>DIČ: ${esc(data.dic)}</p>` : ''}
            ${data.icdph ? `<p>IČ DPH: ${esc(data.icdph)}</p>` : ''}
            ${data.email ? `<p>${esc(data.email)}</p>` : ''}
            ${data.phone ? `<p>${esc(data.phone)}</p>` : ''}
        </div>`;

    const detail = (label, value) => (value
        ? `<div class="inv-detail-item"><span class="label">${label}</span><span class="value">${esc(value)}</span></div>`
        : '');

    const details = [
        detail('Dátum vystavenia', Calc.formatDate(doc.issueDate)),
        doc.type === 'ponuka'
            ? detail('Platnosť do', Calc.formatDate(doc.validUntil))
            : detail('Dátum dodania', Calc.formatDate(doc.deliveryDate)),
        doc.type === 'faktura' ? detail('Splatnosť', Calc.formatDate(doc.dueDate)) : '',
        doc.type !== 'ponuka' ? detail('Forma úhrady', Calc.PAYMENT_METHODS[doc.paymentMethod]) : '',
        doc.type === 'faktura' ? detail('Účet / IBAN', doc.bankAccount) : '',
        doc.type === 'faktura' ? detail('Variabilný symbol', doc.variableSymbol) : '',
    ].join('');

    return `
        <div class="invoice-preview">
            <div class="inv-header">
                <div>
                    <div class="inv-title">${esc(Calc.documentTitle(doc))}</div>
                    <div class="inv-number">Číslo: ${esc(doc.number)}</div>
                </div>
                <div>${statusBadge(doc)}</div>
            </div>
            ${doc.relatedFrom && doc.relatedFrom.number ? `<p class="related-note">Vytvorené z dokladu ${esc(doc.relatedFrom.number)}</p>` : ''}
            <div class="inv-parties">
                ${party('Dodávateľ', doc.supplier || {})}
                ${party('Odberateľ', doc.customer || {})}
            </div>
            <div class="inv-details">${details}</div>
            <table>
                <thead>
                    <tr>
                        <th>#</th><th>Popis</th><th>Počet</th><th>M.J.</th><th>Cena</th>
                        ${totals.useVat ? '<th>DPH</th>' : ''}
                        <th>Celkom</th>
                    </tr>
                </thead>
                <tbody>
                    ${totals.lines.map((line, index) => `
                        <tr>
                            <td>${index + 1}</td>
                            <td>${esc(line.desc)}</td>
                            <td>${Calc.formatQty(line.qty)}</td>
                            <td>${esc(line.unit)}</td>
                            <td>${Calc.formatAmount(line.unitPriceNet)} ${currency}</td>
                            ${totals.useVat ? `<td>${line.vatRate} %</td>` : ''}
                            <td>${Calc.formatAmount(totals.useVat ? line.gross : line.net)} ${currency}</td>
                        </tr>`).join('')}
                </tbody>
            </table>
            <div class="inv-totals">
                ${totals.discount > 0 ? `
                    <p>Medzisúčet: ${Calc.formatAmount(totals.useVat ? totals.grossBeforeDiscount : totals.subtotalBeforeDiscount)} ${currency}</p>
                    <p>Zľava: -${Calc.formatAmount(totals.discount)} ${currency}</p>` : ''}
                ${totals.useVat ? `
                    <p>Celkom bez DPH: ${Calc.formatAmount(totals.subtotal)} ${currency}</p>
                    <p>DPH: ${Calc.formatAmount(totals.vatTotal)} ${currency}</p>` : ''}
                ${totals.roundingDiff !== 0 ? `<p>Zaokrúhlenie: ${Calc.formatAmount(totals.roundingDiff)} ${currency}</p>` : ''}
                <p class="final">Na úhradu: ${Calc.formatAmount(totals.total)} ${currency}</p>
            </div>
            ${doc.note ? `<p><strong>Poznámka:</strong> ${esc(doc.note)}</p>` : ''}
        </div>`;
}

function showDocumentPreview(doc) {
    // Nečíslovaný náhľad z editora nemá ešte uložený doklad – PDF sa generuje z formulára.
    const stored = Boolean(Store.getDocument(doc.id));
    openModal(
        `${Store.DOC_TYPES[doc.type].label} ${doc.number || ''}`.trim(),
        documentPreviewHtml(doc),
        `<button type="button" class="btn-primary" data-action="${stored ? 'pdf' : 'editor-pdf'}" data-id="${doc.id}">&#128229; Stiahnuť PDF</button>
         <button type="button" class="btn-secondary" data-action="modal-close">Zavrieť</button>`
    );
}

window.UI = {
    toast,
    openModal,
    closeModal,
    downloadFile,
    statusBadge,
    documentPreviewHtml,
    showDocumentPreview,
};
