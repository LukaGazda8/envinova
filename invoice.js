// === Invoice Generator Tool ===
// Inspired by fakturaonline.sk

document.addEventListener('DOMContentLoaded', function() {
    // Set default dates
    const today = new Date();
    document.getElementById('issueDate').value = formatDateForInput(today);
    document.getElementById('deliveryDate').value = formatDateForInput(today);
    
    const dueDate = new Date(today);
    dueDate.setDate(dueDate.getDate() + 14);
    document.getElementById('dueDate').value = formatDateForInput(dueDate);

    // Generate default invoice number
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    document.getElementById('invoiceNumber').value = `${year}${month}0001`;

    // Try to load saved supplier data
    loadSupplierData();
    
    calculateTotals();
});

function formatDateForInput(date) {
    return date.toISOString().split('T')[0];
}

function formatDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
}

function getCurrencySymbol() {
    const currency = document.getElementById('currency').value;
    const symbols = { 'EUR': '\u20AC', 'CZK': 'K\u010D', 'USD': '$', 'GBP': '\u00A3' };
    return symbols[currency] || '\u20AC';
}

function formatNumber(num) {
    return num.toFixed(2).replace('.', ',');
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// === ITEMS MANAGEMENT ===

function addItem() {
    const tbody = document.getElementById('itemsBody');
    const row = document.createElement('tr');
    row.className = 'item-row';
    row.innerHTML = `
        <td><input type="number" class="item-qty" value="1" min="0" step="0.01" onchange="calculateTotals()"></td>
        <td>
            <select class="item-unit">
                <option value="ks">ks</option>
                <option value="hod">hod</option>
                <option value="m">m</option>
                <option value="m2">m\u00B2</option>
                <option value="m3">m\u00B3</option>
                <option value="kg">kg</option>
                <option value="l">l</option>
                <option value="km">km</option>
                <option value="bal">bal</option>
                <option value="">-</option>
            </select>
        </td>
        <td><input type="text" class="item-desc" placeholder="Popis polo\u017Eky"></td>
        <td>
            <select class="item-vat" onchange="calculateTotals()">
                <option value="0">0 %</option>
                <option value="10">10 %</option>
                <option value="20" selected>20 %</option>
                <option value="23">23 %</option>
            </select>
        </td>
        <td><input type="number" class="item-price" value="0.00" min="0" step="0.01" onchange="calculateTotals()"></td>
        <td><span class="item-total">0,00</span></td>
        <td><button type="button" class="btn-remove" onclick="removeItem(this)" title="Odstr\u00E1ni\u0165">\u2715</button></td>
    `;
    tbody.appendChild(row);
    calculateTotals();
}

function removeItem(btn) {
    const row = btn.closest('tr');
    const tbody = document.getElementById('itemsBody');
    if (tbody.children.length > 1) {
        row.remove();
        calculateTotals();
    }
}

function toggleDiscount() {
    const section = document.getElementById('discountSection');
    const discountRow = document.getElementById('discountRow');
    section.classList.toggle('hidden');
    discountRow.classList.toggle('hidden');
    calculateTotals();
}

function toggleSection(header) {
    const section = header.closest('.collapsible');
    section.classList.toggle('collapsed');
}

// === CALCULATIONS ===

function calculateTotals() {
    const rows = document.querySelectorAll('.item-row');
    const pricingMode = document.querySelector('input[name="pricingMode"]:checked').value;
    const invoiceType = document.getElementById('invoiceType').value;
    const symbol = getCurrencySymbol();
    
    let totalWithoutVat = 0;
    let totalVat = 0;
    let totalWithVat = 0;

    rows.forEach(row => {
        const qty = parseFloat(row.querySelector('.item-qty').value) || 0;
        const price = parseFloat(row.querySelector('.item-price').value) || 0;
        const vatRate = parseFloat(row.querySelector('.item-vat').value) || 0;
        
        let itemWithoutVat, itemVat, itemTotal;
        
        if (pricingMode === 'withVat') {
            itemTotal = qty * price;
            itemWithoutVat = itemTotal / (1 + vatRate / 100);
            itemVat = itemTotal - itemWithoutVat;
        } else {
            itemWithoutVat = qty * price;
            itemVat = itemWithoutVat * (vatRate / 100);
            itemTotal = itemWithoutVat + itemVat;
        }

        // For non-VAT invoices, no VAT calculation
        if (invoiceType === 'bez_dph') {
            itemVat = 0;
            itemTotal = itemWithoutVat = qty * price;
        }

        row.querySelector('.item-total').textContent = formatNumber(itemTotal);
        
        totalWithoutVat += itemWithoutVat;
        totalVat += itemVat;
        totalWithVat += itemTotal;
    });

    // Apply discount
    const discountSection = document.getElementById('discountSection');
    let discountAmount = 0;
    if (!discountSection.classList.contains('hidden')) {
        const discountType = document.getElementById('discountType').value;
        const discountValue = parseFloat(document.getElementById('discountValue').value) || 0;
        
        if (discountType === 'percent') {
            discountAmount = totalWithVat * (discountValue / 100);
        } else {
            discountAmount = discountValue;
        }
        
        totalWithVat -= discountAmount;
        totalWithoutVat -= discountAmount / (1 + (totalVat / (totalWithVat + discountAmount - totalVat)) || 0);
        totalVat = totalWithVat - totalWithoutVat;
    }

    // Apply rounding
    const rounding = parseFloat(document.getElementById('rounding').value) || 0;
    if (rounding > 0) {
        totalWithVat = Math.round(totalWithVat / rounding) * rounding;
    }

    // Update display
    document.getElementById('totalWithoutVat').textContent = `${formatNumber(totalWithoutVat)} ${symbol}`;
    document.getElementById('totalVat').textContent = `${formatNumber(totalVat)} ${symbol}`;
    document.getElementById('totalDiscount').textContent = `-${formatNumber(discountAmount)} ${symbol}`;
    document.getElementById('totalWithVat').innerHTML = `<strong>${formatNumber(totalWithVat)} ${symbol}</strong>`;

    // Hide/show VAT row based on invoice type
    const vatRow = document.getElementById('vatRow');
    if (invoiceType === 'bez_dph') {
        vatRow.classList.add('hidden');
    } else {
        vatRow.classList.remove('hidden');
    }
}

// === PDF GENERATION ===

function getFormData() {
    return {
        invoiceType: document.getElementById('invoiceType').value,
        invoiceTypeLabel: document.getElementById('invoiceType').options[document.getElementById('invoiceType').selectedIndex].text,
        invoiceNumber: document.getElementById('invoiceNumber').value,
        variableSymbol: document.getElementById('variableSymbol').value || document.getElementById('invoiceNumber').value,
        constantSymbol: document.getElementById('constantSymbol').value,
        specificSymbol: document.getElementById('specificSymbol').value,
        issuedBy: document.getElementById('issuedBy').value,
        issueDate: document.getElementById('issueDate').value,
        deliveryDate: document.getElementById('deliveryDate').value,
        dueDate: document.getElementById('dueDate').value,
        paymentMethod: document.getElementById('paymentMethod').options[document.getElementById('paymentMethod').selectedIndex].text,
        bankAccount: document.getElementById('bankAccount').value,
        bankName: document.getElementById('bankName').value,
        swift: document.getElementById('swift').value,
        currency: document.getElementById('currency').value,
        currencySymbol: getCurrencySymbol(),
        invoiceColor: document.getElementById('invoiceColor').value,
        registryInfo: document.getElementById('registryInfo').value,
        invoiceNote: document.getElementById('invoiceNote').value,
        seller: {
            name: document.getElementById('sellerName').value,
            ico: document.getElementById('sellerICO').value,
            dic: document.getElementById('sellerDIC').value,
            icdph: document.getElementById('sellerICDPH').value,
            street: document.getElementById('sellerStreet').value,
            city: document.getElementById('sellerCity').value,
            zip: document.getElementById('sellerZip').value,
            country: document.getElementById('sellerCountry').value,
            email: document.getElementById('sellerEmail').value,
            phone: document.getElementById('sellerPhone').value,
            web: document.getElementById('sellerWeb').value,
        },
        buyer: {
            name: document.getElementById('buyerName').value,
            ico: document.getElementById('buyerICO').value,
            dic: document.getElementById('buyerDIC').value,
            icdph: document.getElementById('buyerICDPH').value,
            street: document.getElementById('buyerStreet').value,
            city: document.getElementById('buyerCity').value,
            zip: document.getElementById('buyerZip').value,
            country: document.getElementById('buyerCountry').value,
            email: document.getElementById('buyerEmail').value,
            phone: document.getElementById('buyerPhone').value,
            web: document.getElementById('buyerWeb').value,
        },
        items: getItems(),
    };
}

function getItems() {
    const rows = document.querySelectorAll('.item-row');
    const pricingMode = document.querySelector('input[name="pricingMode"]:checked').value;
    const invoiceType = document.getElementById('invoiceType').value;
    const items = [];

    rows.forEach(row => {
        const qty = parseFloat(row.querySelector('.item-qty').value) || 0;
        const unit = row.querySelector('.item-unit').value;
        const desc = row.querySelector('.item-desc').value;
        const vatRate = parseFloat(row.querySelector('.item-vat').value) || 0;
        const price = parseFloat(row.querySelector('.item-price').value) || 0;

        let priceWithoutVat, vatAmount, total;

        if (invoiceType === 'bez_dph') {
            priceWithoutVat = price;
            vatAmount = 0;
            total = qty * price;
        } else if (pricingMode === 'withVat') {
            total = qty * price;
            priceWithoutVat = price / (1 + vatRate / 100);
            vatAmount = total - (qty * priceWithoutVat);
        } else {
            priceWithoutVat = price;
            vatAmount = qty * price * (vatRate / 100);
            total = qty * price + vatAmount;
        }

        items.push({
            qty, unit, desc, vatRate, price, priceWithoutVat, vatAmount, total
        });
    });

    return items;
}

function generatePDF() {
    const data = getFormData();
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('p', 'mm', 'a4');
    
    const pageWidth = 210;
    const margin = 15;
    const contentWidth = pageWidth - 2 * margin;
    const color = hexToRgb(data.invoiceColor);
    
    let y = margin;

    // === HEADER ===
    doc.setFillColor(color.r, color.g, color.b);
    doc.rect(0, 0, pageWidth, 35, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text(getInvoiceTitle(data.invoiceType), margin, 18);
    
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.text(`\u010C\u00EDslo: ${data.invoiceNumber}`, margin, 28);
    
    y = 45;

    // === PARTIES: Supplier & Buyer side by side ===
    doc.setTextColor(0, 0, 0);
    const leftCol = margin;
    const rightCol = pageWidth / 2 + 5;
    const colWidth = contentWidth / 2 - 5;

    // Supplier
    doc.setFillColor(color.r, color.g, color.b);
    doc.rect(leftCol, y, colWidth, 7, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('DOD\u00C1VATE\u013D', leftCol + 3, y + 5);
    
    doc.setTextColor(0, 0, 0);
    y += 10;
    let sellerY = y;
    
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(data.seller.name || '', leftCol + 3, sellerY);
    sellerY += 5;
    
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    if (data.seller.street) { doc.text(data.seller.street, leftCol + 3, sellerY); sellerY += 4; }
    if (data.seller.city || data.seller.zip) { 
        doc.text(`${data.seller.zip} ${data.seller.city}`.trim(), leftCol + 3, sellerY); 
        sellerY += 4; 
    }
    if (data.seller.country && data.seller.country !== 'Slovensko') { 
        doc.text(data.seller.country, leftCol + 3, sellerY); sellerY += 4; 
    }
    sellerY += 2;
    if (data.seller.ico) { doc.text(`I\u010CO: ${data.seller.ico}`, leftCol + 3, sellerY); sellerY += 4; }
    if (data.seller.dic) { doc.text(`DI\u010C: ${data.seller.dic}`, leftCol + 3, sellerY); sellerY += 4; }
    if (data.seller.icdph) { doc.text(`I\u010C DPH: ${data.seller.icdph}`, leftCol + 3, sellerY); sellerY += 4; }
    if (data.seller.email) { doc.text(`E-mail: ${data.seller.email}`, leftCol + 3, sellerY); sellerY += 4; }
    if (data.seller.phone) { doc.text(`Tel: ${data.seller.phone}`, leftCol + 3, sellerY); sellerY += 4; }
    if (data.seller.web) { doc.text(`Web: ${data.seller.web}`, leftCol + 3, sellerY); sellerY += 4; }

    // Buyer
    let buyerHeaderY = y - 10;
    doc.setFillColor(color.r, color.g, color.b);
    doc.rect(rightCol, buyerHeaderY, colWidth, 7, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('ODBERATE\u013D', rightCol + 3, buyerHeaderY + 5);
    
    doc.setTextColor(0, 0, 0);
    let buyerY = y;
    
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(data.buyer.name || '', rightCol + 3, buyerY);
    buyerY += 5;
    
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    if (data.buyer.street) { doc.text(data.buyer.street, rightCol + 3, buyerY); buyerY += 4; }
    if (data.buyer.city || data.buyer.zip) { 
        doc.text(`${data.buyer.zip} ${data.buyer.city}`.trim(), rightCol + 3, buyerY); 
        buyerY += 4; 
    }
    if (data.buyer.country && data.buyer.country !== 'Slovensko') { 
        doc.text(data.buyer.country, rightCol + 3, buyerY); buyerY += 4; 
    }
    buyerY += 2;
    if (data.buyer.ico) { doc.text(`I\u010CO: ${data.buyer.ico}`, rightCol + 3, buyerY); buyerY += 4; }
    if (data.buyer.dic) { doc.text(`DI\u010C: ${data.buyer.dic}`, rightCol + 3, buyerY); buyerY += 4; }
    if (data.buyer.icdph) { doc.text(`I\u010C DPH: ${data.buyer.icdph}`, rightCol + 3, buyerY); buyerY += 4; }
    if (data.buyer.email) { doc.text(`E-mail: ${data.buyer.email}`, rightCol + 3, buyerY); buyerY += 4; }
    if (data.buyer.phone) { doc.text(`Tel: ${data.buyer.phone}`, rightCol + 3, buyerY); buyerY += 4; }

    y = Math.max(sellerY, buyerY) + 8;

    // === PAYMENT DETAILS ===
    doc.setFillColor(245, 247, 250);
    doc.rect(margin, y, contentWidth, 28, 'F');
    doc.setDrawColor(200, 200, 200);
    doc.rect(margin, y, contentWidth, 28, 'S');
    
    y += 5;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    
    const detailsCol1 = margin + 5;
    const detailsCol2 = margin + contentWidth / 3;
    const detailsCol3 = margin + (contentWidth / 3) * 2;
    
    doc.setTextColor(100, 100, 100);
    doc.text('D\u00E1tum vystavenia:', detailsCol1, y);
    doc.text('D\u00E1tum dodania:', detailsCol2, y);
    doc.text('D\u00E1tum splatnosti:', detailsCol3, y);
    y += 4;
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'bold');
    doc.text(formatDate(data.issueDate), detailsCol1, y);
    doc.text(formatDate(data.deliveryDate), detailsCol2, y);
    doc.text(formatDate(data.dueDate), detailsCol3, y);
    
    y += 7;
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 100);
    doc.text('Forma \u00FAhrady:', detailsCol1, y);
    doc.text('\u00DA\u010Det / IBAN:', detailsCol2, y);
    if (data.swift) doc.text('SWIFT:', detailsCol3, y);
    y += 4;
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'bold');
    doc.text(data.paymentMethod, detailsCol1, y);
    doc.text(data.bankAccount || '', detailsCol2, y);
    if (data.swift) doc.text(data.swift, detailsCol3, y);
    
    y += 4;
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 100);
    doc.text('Variabiln\u00FD symbol:', detailsCol1, y);
    if (data.constantSymbol) doc.text('Kon\u0161tantn\u00FD symbol:', detailsCol2, y);
    if (data.specificSymbol) doc.text('\u0160pecifick\u00FD symbol:', detailsCol3, y);
    y += 4;
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'bold');
    doc.text(data.variableSymbol, detailsCol1, y);
    if (data.constantSymbol) doc.text(data.constantSymbol, detailsCol2, y);
    if (data.specificSymbol) doc.text(data.specificSymbol, detailsCol3, y);

    y += 10;

    // === ITEMS TABLE ===
    const tableHeaders = data.invoiceType === 'bez_dph' 
        ? [['#', 'Popis', 'Po\u010Det', 'M.J.', 'Cena', 'Celkom']]
        : [['#', 'Popis', 'Po\u010Det', 'M.J.', 'Cena', 'DPH %', 'DPH', 'Celkom']];

    const tableBody = data.items.map((item, idx) => {
        if (data.invoiceType === 'bez_dph') {
            return [
                String(idx + 1),
                item.desc || '',
                formatNumber(item.qty),
                item.unit,
                `${formatNumber(item.price)} ${data.currencySymbol}`,
                `${formatNumber(item.total)} ${data.currencySymbol}`,
            ];
        }
        return [
            String(idx + 1),
            item.desc || '',
            formatNumber(item.qty),
            item.unit,
            `${formatNumber(item.priceWithoutVat)} ${data.currencySymbol}`,
            `${item.vatRate} %`,
            `${formatNumber(item.vatAmount)} ${data.currencySymbol}`,
            `${formatNumber(item.total)} ${data.currencySymbol}`,
        ];
    });

    doc.autoTable({
        startY: y,
        head: tableHeaders,
        body: tableBody,
        margin: { left: margin, right: margin },
        headStyles: {
            fillColor: [color.r, color.g, color.b],
            textColor: 255,
            fontStyle: 'bold',
            fontSize: 9,
        },
        bodyStyles: {
            fontSize: 9,
        },
        alternateRowStyles: {
            fillColor: [248, 250, 254],
        },
        columnStyles: data.invoiceType === 'bez_dph' 
            ? { 0: { cellWidth: 10 }, 2: { halign: 'right' }, 4: { halign: 'right' }, 5: { halign: 'right' } }
            : { 0: { cellWidth: 10 }, 2: { halign: 'right' }, 4: { halign: 'right' }, 5: { halign: 'center' }, 6: { halign: 'right' }, 7: { halign: 'right' } },
    });

    y = doc.lastAutoTable.finalY + 10;

    // === TOTALS ===
    const totalsX = pageWidth - margin - 70;
    let totalWithoutVat = 0;
    let totalVat = 0;
    let totalWithVat = 0;

    data.items.forEach(item => {
        totalWithoutVat += item.qty * item.priceWithoutVat;
        totalVat += item.vatAmount;
        totalWithVat += item.total;
    });

    // Apply discount
    const discountSection = document.getElementById('discountSection');
    let discountAmount = 0;
    if (!discountSection.classList.contains('hidden')) {
        const discountType = document.getElementById('discountType').value;
        const discountValue = parseFloat(document.getElementById('discountValue').value) || 0;
        if (discountType === 'percent') {
            discountAmount = totalWithVat * (discountValue / 100);
        } else {
            discountAmount = discountValue;
        }
        totalWithVat -= discountAmount;
        totalWithoutVat -= discountAmount * (totalWithoutVat / (totalWithoutVat + totalVat));
        totalVat = totalWithVat - totalWithoutVat;
    }

    // Rounding
    const rounding = parseFloat(document.getElementById('rounding').value) || 0;
    if (rounding > 0) {
        totalWithVat = Math.round(totalWithVat / rounding) * rounding;
    }

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    
    if (data.invoiceType !== 'bez_dph') {
        doc.text(`Celkom bez DPH:`, totalsX, y);
        doc.text(`${formatNumber(totalWithoutVat)} ${data.currencySymbol}`, totalsX + 70, y, { align: 'right' });
        y += 5;
        doc.text(`DPH:`, totalsX, y);
        doc.text(`${formatNumber(totalVat)} ${data.currencySymbol}`, totalsX + 70, y, { align: 'right' });
        y += 5;
    }

    if (discountAmount > 0) {
        doc.text(`Z\u013Eava:`, totalsX, y);
        doc.text(`-${formatNumber(discountAmount)} ${data.currencySymbol}`, totalsX + 70, y, { align: 'right' });
        y += 5;
    }

    // Final total
    doc.setDrawColor(color.r, color.g, color.b);
    doc.setLineWidth(0.5);
    doc.line(totalsX, y, totalsX + 70, y);
    y += 5;
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(color.r, color.g, color.b);
    doc.text(`CELKOM:`, totalsX, y);
    doc.text(`${formatNumber(totalWithVat)} ${data.currencySymbol}`, totalsX + 70, y, { align: 'right' });

    y += 12;

    // === NOTE ===
    if (data.invoiceNote) {
        doc.setTextColor(0, 0, 0);
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.text('Pozn\u00E1mka:', margin, y);
        y += 4;
        doc.setFont('helvetica', 'normal');
        const noteLines = doc.splitTextToSize(data.invoiceNote, contentWidth);
        doc.text(noteLines, margin, y);
        y += noteLines.length * 4 + 5;
    }

    // === FOOTER ===
    const footerY = 280;
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.3);
    doc.line(margin, footerY - 5, pageWidth - margin, footerY - 5);
    
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.setFont('helvetica', 'normal');
    
    if (data.issuedBy) {
        doc.text(`Vystavil: ${data.issuedBy}`, margin, footerY);
    }
    if (data.registryInfo) {
        const regLines = doc.splitTextToSize(data.registryInfo, contentWidth);
        doc.text(regLines, margin, footerY + 4);
    }

    // Save
    const filename = `faktura_${data.invoiceNumber || 'nova'}.pdf`;
    doc.save(filename);
}

// === PREVIEW ===

function previewInvoice() {
    const data = getFormData();
    let totalWithoutVat = 0;
    let totalVat = 0;
    let totalWithVat = 0;

    data.items.forEach(item => {
        totalWithoutVat += item.qty * item.priceWithoutVat;
        totalVat += item.vatAmount;
        totalWithVat += item.total;
    });

    const discountSection = document.getElementById('discountSection');
    let discountAmount = 0;
    if (!discountSection.classList.contains('hidden')) {
        const discountType = document.getElementById('discountType').value;
        const discountValue = parseFloat(document.getElementById('discountValue').value) || 0;
        if (discountType === 'percent') {
            discountAmount = totalWithVat * (discountValue / 100);
        } else {
            discountAmount = discountValue;
        }
        totalWithVat -= discountAmount;
    }

    const html = `
        <div class="invoice-preview">
            <div class="inv-header">
                <div>
                    <div class="inv-title">${getInvoiceTitle(data.invoiceType)}</div>
                    <div class="inv-number">\u010C\u00EDslo: ${escapeHtml(data.invoiceNumber)}</div>
                </div>
            </div>
            <div class="inv-parties">
                <div class="inv-party">
                    <h4>Dod\u00E1vate\u013E</h4>
                    <p><strong>${escapeHtml(data.seller.name)}</strong></p>
                    ${data.seller.street ? `<p>${escapeHtml(data.seller.street)}</p>` : ''}
                    <p>${escapeHtml(data.seller.zip)} ${escapeHtml(data.seller.city)}</p>
                    ${data.seller.ico ? `<p>I\u010CO: ${escapeHtml(data.seller.ico)}</p>` : ''}
                    ${data.seller.dic ? `<p>DI\u010C: ${escapeHtml(data.seller.dic)}</p>` : ''}
                    ${data.seller.icdph ? `<p>I\u010C DPH: ${escapeHtml(data.seller.icdph)}</p>` : ''}
                </div>
                <div class="inv-party">
                    <h4>Odberate\u013E</h4>
                    <p><strong>${escapeHtml(data.buyer.name)}</strong></p>
                    ${data.buyer.street ? `<p>${escapeHtml(data.buyer.street)}</p>` : ''}
                    <p>${escapeHtml(data.buyer.zip)} ${escapeHtml(data.buyer.city)}</p>
                    ${data.buyer.ico ? `<p>I\u010CO: ${escapeHtml(data.buyer.ico)}</p>` : ''}
                    ${data.buyer.dic ? `<p>DI\u010C: ${escapeHtml(data.buyer.dic)}</p>` : ''}
                    ${data.buyer.icdph ? `<p>I\u010C DPH: ${escapeHtml(data.buyer.icdph)}</p>` : ''}
                </div>
            </div>
            <div class="inv-details">
                <div class="inv-detail-item"><span class="label">D\u00E1tum vystavenia</span><span class="value">${escapeHtml(formatDate(data.issueDate))}</span></div>
                <div class="inv-detail-item"><span class="label">D\u00E1tum dodania</span><span class="value">${escapeHtml(formatDate(data.deliveryDate))}</span></div>
                <div class="inv-detail-item"><span class="label">Splatnos\u0165</span><span class="value">${escapeHtml(formatDate(data.dueDate))}</span></div>
                <div class="inv-detail-item"><span class="label">Forma \u00FAhrady</span><span class="value">${escapeHtml(data.paymentMethod)}</span></div>
                <div class="inv-detail-item"><span class="label">\u00DA\u010Det / IBAN</span><span class="value">${escapeHtml(data.bankAccount)}</span></div>
                <div class="inv-detail-item"><span class="label">Variabiln\u00FD symbol</span><span class="value">${escapeHtml(data.variableSymbol)}</span></div>
            </div>
            <table>
                <thead>
                    <tr>
                        <th>#</th><th>Popis</th><th>Po\u010Det</th><th>M.J.</th><th>Cena</th>
                        ${data.invoiceType !== 'bez_dph' ? '<th>DPH</th>' : ''}
                        <th>Celkom</th>
                    </tr>
                </thead>
                <tbody>
                    ${data.items.map((item, i) => `
                        <tr>
                            <td>${i + 1}</td>
                            <td>${escapeHtml(item.desc)}</td>
                            <td>${formatNumber(item.qty)}</td>
                            <td>${escapeHtml(item.unit)}</td>
                            <td>${formatNumber(item.priceWithoutVat)} ${data.currencySymbol}</td>
                            ${data.invoiceType !== 'bez_dph' ? `<td>${item.vatRate}%</td>` : ''}
                            <td>${formatNumber(item.total)} ${data.currencySymbol}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
            <div class="inv-totals">
                ${data.invoiceType !== 'bez_dph' ? `
                    <p>Celkom bez DPH: ${formatNumber(totalWithoutVat)} ${data.currencySymbol}</p>
                    <p>DPH: ${formatNumber(totalVat)} ${data.currencySymbol}</p>
                ` : ''}
                ${discountAmount > 0 ? `<p>Z\u013Eava: -${formatNumber(discountAmount)} ${data.currencySymbol}</p>` : ''}
                <p class="final">Celkom: ${formatNumber(totalWithVat)} ${data.currencySymbol}</p>
            </div>
            ${data.invoiceNote ? `<p><strong>Pozn\u00E1mka:</strong> ${escapeHtml(data.invoiceNote)}</p>` : ''}
        </div>
    `;

    document.getElementById('previewBody').innerHTML = html;
    document.getElementById('previewModal').classList.remove('hidden');
}

function closePreview() {
    document.getElementById('previewModal').classList.add('hidden');
}

// === DATA PERSISTENCE ===

function saveData() {
    const data = {
        seller: {
            name: document.getElementById('sellerName').value,
            ico: document.getElementById('sellerICO').value,
            dic: document.getElementById('sellerDIC').value,
            icdph: document.getElementById('sellerICDPH').value,
            street: document.getElementById('sellerStreet').value,
            city: document.getElementById('sellerCity').value,
            zip: document.getElementById('sellerZip').value,
            country: document.getElementById('sellerCountry').value,
            email: document.getElementById('sellerEmail').value,
            phone: document.getElementById('sellerPhone').value,
            web: document.getElementById('sellerWeb').value,
        },
        bankAccount: document.getElementById('bankAccount').value,
        bankName: document.getElementById('bankName').value,
        swift: document.getElementById('swift').value,
        issuedBy: document.getElementById('issuedBy').value,
        registryInfo: document.getElementById('registryInfo').value,
        invoiceColor: document.getElementById('invoiceColor').value,
    };
    
    localStorage.setItem('fakturaData', JSON.stringify(data));
    alert('\u00DAdaje boli ulo\u017Een\u00E9! Pri \u010Fal\u0161om pou\u017Eit\u00ED sa automaticky na\u010D\u00EDtaj\u00FA.');
}

function loadData() {
    const saved = localStorage.getItem('fakturaData');
    if (!saved) {
        alert('\u017Diadne ulo\u017Een\u00E9 \u00FAdaje neboli n\u00E1jden\u00E9.');
        return;
    }
    
    const data = JSON.parse(saved);
    applySupplierData(data);
    alert('\u00DAdaje boli na\u010D\u00EDtan\u00E9!');
}

function loadSupplierData() {
    const saved = localStorage.getItem('fakturaData');
    if (!saved) return;
    
    const data = JSON.parse(saved);
    applySupplierData(data);
}

function applySupplierData(data) {
    if (data.seller) {
        document.getElementById('sellerName').value = data.seller.name || '';
        document.getElementById('sellerICO').value = data.seller.ico || '';
        document.getElementById('sellerDIC').value = data.seller.dic || '';
        document.getElementById('sellerICDPH').value = data.seller.icdph || '';
        document.getElementById('sellerStreet').value = data.seller.street || '';
        document.getElementById('sellerCity').value = data.seller.city || '';
        document.getElementById('sellerZip').value = data.seller.zip || '';
        document.getElementById('sellerCountry').value = data.seller.country || 'Slovensko';
        document.getElementById('sellerEmail').value = data.seller.email || '';
        document.getElementById('sellerPhone').value = data.seller.phone || '';
        document.getElementById('sellerWeb').value = data.seller.web || '';
    }
    if (data.bankAccount) document.getElementById('bankAccount').value = data.bankAccount;
    if (data.bankName) document.getElementById('bankName').value = data.bankName;
    if (data.swift) document.getElementById('swift').value = data.swift;
    if (data.issuedBy) document.getElementById('issuedBy').value = data.issuedBy;
    if (data.registryInfo) document.getElementById('registryInfo').value = data.registryInfo;
    if (data.invoiceColor) document.getElementById('invoiceColor').value = data.invoiceColor;
}

// === HELPERS ===

function getInvoiceTitle(type) {
    const titles = {
        'dph': 'FAKT\u00DARA - Da\u0148ov\u00FD doklad',
        'bez_dph': 'FAKT\u00DARA',
        'zalohova': 'Z\u00C1LOHOV\u00C1 FAKT\u00DARA',
        'proforma': 'PROFORMA FAKT\u00DARA',
    };
    return titles[type] || 'FAKT\u00DARA';
}

function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : { r: 33, g: 150, b: 243 };
}

// Listen for changes on pricing mode and invoice type
document.querySelectorAll('input[name="pricingMode"]').forEach(radio => {
    radio.addEventListener('change', calculateTotals);
});
document.getElementById('invoiceType').addEventListener('change', calculateTotals);
document.getElementById('currency').addEventListener('change', calculateTotals);
