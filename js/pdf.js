// === Generovanie PDF dokladov (faktúra / cenová ponuka / objednávka) ===

const FONT_SOURCES = [
    { name: 'DejaVuSans', style: 'normal', url: 'https://cdn.jsdelivr.net/npm/dejavu-fonts-ttf@2.37.3/ttf/DejaVuSans.ttf' },
    { name: 'DejaVuSans', style: 'bold', url: 'https://cdn.jsdelivr.net/npm/dejavu-fonts-ttf@2.37.3/ttf/DejaVuSans-Bold.ttf' },
];

// Náhrada diakritiky, ak sa nepodarí načítať Unicode font (základné fonty jsPDF
// podporujú len znakovú sadu WinAnsi).
const ASCII_MAP = {
    'á': 'a', 'ä': 'a', 'č': 'c', 'ď': 'd', 'é': 'e', 'ě': 'e', 'í': 'i', 'ľ': 'l', 'ĺ': 'l',
    'ň': 'n', 'ó': 'o', 'ô': 'o', 'ö': 'o', 'ŕ': 'r', 'ř': 'r', 'š': 's', 'ť': 't', 'ú': 'u',
    'ů': 'u', 'ü': 'u', 'ý': 'y', 'ž': 'z',
    'Á': 'A', 'Ä': 'A', 'Č': 'C', 'Ď': 'D', 'É': 'E', 'Ě': 'E', 'Í': 'I', 'Ľ': 'L', 'Ĺ': 'L',
    'Ň': 'N', 'Ó': 'O', 'Ô': 'O', 'Ö': 'O', 'Ŕ': 'R', 'Ř': 'R', 'Š': 'S', 'Ť': 'T', 'Ú': 'U',
    'Ů': 'U', 'Ü': 'U', 'Ý': 'Y', 'Ž': 'Z', '–': '-', '\u2019': "'",
};

const fontCache = {};
let unicodeFontAvailable = null;

function arrayBufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    const chunk = 8192;
    for (let i = 0; i < bytes.length; i += chunk) {
        binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
    }
    return btoa(binary);
}

async function loadUnicodeFont() {
    if (unicodeFontAvailable !== null) return unicodeFontAvailable;
    try {
        await Promise.all(FONT_SOURCES.map(async source => {
            if (fontCache[source.style]) return;
            const response = await fetch(source.url);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            fontCache[source.style] = arrayBufferToBase64(await response.arrayBuffer());
        }));
        unicodeFontAvailable = true;
    } catch (err) {
        console.warn('Unicode font sa nepodarilo načítať, použije sa náhrada diakritiky.', err);
        unicodeFontAvailable = false;
    }
    return unicodeFontAvailable;
}

function registerFont(doc) {
    if (!unicodeFontAvailable) return false;
    FONT_SOURCES.forEach(source => {
        const filename = `${source.name}-${source.style}.ttf`;
        doc.addFileToVFS(filename, fontCache[source.style]);
        doc.addFont(filename, source.name, source.style);
    });
    return true;
}

function makeTextTools(doc, useUnicodeFont) {
    const fontName = useUnicodeFont ? 'DejaVuSans' : 'helvetica';

    const sanitize = value => {
        const text = value === null || value === undefined ? '' : String(value);
        if (useUnicodeFont) return text;
        return text.replace(/[^\u0000-\u00FF]|–|\u2019/g, char => ASCII_MAP[char] || char);
    };

    return {
        fontName,
        sanitize,
        setFont: (style, size) => {
            doc.setFont(fontName, style);
            if (size) doc.setFontSize(size);
        },
        text: (value, x, y, options) => doc.text(sanitize(value), x, y, options),
        split: (value, width) => doc.splitTextToSize(sanitize(value), width),
    };
}

function partyLines(party) {
    const lines = [];
    if (party.street) lines.push(party.street);
    const cityLine = `${party.zip || ''} ${party.city || ''}`.trim();
    if (cityLine) lines.push(cityLine);
    if (party.country && party.country !== 'Slovensko') lines.push(party.country);
    if (party.ico) lines.push(`IČO: ${party.ico}`);
    if (party.dic) lines.push(`DIČ: ${party.dic}`);
    if (party.icdph) lines.push(`IČ DPH: ${party.icdph}`);
    if (party.email) lines.push(`E-mail: ${party.email}`);
    if (party.phone) lines.push(`Tel.: ${party.phone}`);
    if (party.web) lines.push(`Web: ${party.web}`);
    return lines;
}

function metaRows(doc, totals) {
    const rows = [
        ['Dátum vystavenia', Calc.formatDate(doc.issueDate)],
    ];

    if (doc.type === 'faktura') {
        rows.push(['Dátum dodania', Calc.formatDate(doc.deliveryDate)]);
        rows.push(['Dátum splatnosti', Calc.formatDate(doc.dueDate)]);
        rows.push(['Forma úhrady', Calc.PAYMENT_METHODS[doc.paymentMethod] || doc.paymentMethod || '']);
        rows.push(['Účet / IBAN', doc.bankAccount || '']);
        if (doc.swift) rows.push(['SWIFT / BIC', doc.swift]);
        rows.push(['Variabilný symbol', doc.variableSymbol || doc.number || '']);
        if (doc.constantSymbol) rows.push(['Konštantný symbol', doc.constantSymbol]);
        if (doc.specificSymbol) rows.push(['Špecifický symbol', doc.specificSymbol]);
    } else if (doc.type === 'ponuka') {
        rows.push(['Platnosť ponuky do', Calc.formatDate(doc.validUntil)]);
        rows.push(['Stav', Store.DOC_TYPES.ponuka.statuses[doc.status] || '']);
    } else {
        rows.push(['Dátum dodania', Calc.formatDate(doc.deliveryDate)]);
        rows.push(['Forma úhrady', Calc.PAYMENT_METHODS[doc.paymentMethod] || doc.paymentMethod || '']);
        rows.push(['Stav', Store.DOC_TYPES.objednavka.statuses[doc.status] || '']);
    }

    rows.push(['Celková suma', Calc.formatMoney(totals.total, doc.currency)]);
    return rows;
}

async function buildPdf(document_) {
    const settings = Store.getSettings();
    const totals = Calc.computeTotals(document_);
    const useUnicodeFont = await loadUnicodeFont();

    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF('p', 'mm', 'a4');
    if (useUnicodeFont) registerFont(pdf);
    const T = makeTextTools(pdf, useUnicodeFont);

    const pageWidth = 210;
    const pageHeight = 297;
    const margin = 15;
    const contentWidth = pageWidth - 2 * margin;
    const color = Calc.hexToRgb(document_.color || settings.color);

    // === Hlavička ===
    pdf.setFillColor(color.r, color.g, color.b);
    pdf.rect(0, 0, pageWidth, 32, 'F');
    pdf.setTextColor(255, 255, 255);
    T.setFont('bold', 19);
    T.text(Calc.documentTitle(document_), margin, 15);
    T.setFont('normal', 11);
    T.text(`Číslo: ${document_.number || ''}`, margin, 24);

    if (document_.relatedFrom && document_.relatedFrom.number) {
        T.setFont('normal', 9);
        const label = Store.DOC_TYPES[document_.relatedFrom.type] ? Store.DOC_TYPES[document_.relatedFrom.type].label : 'Doklad';
        T.text(`${label}: ${document_.relatedFrom.number}`, pageWidth - margin, 24, { align: 'right' });
    }

    if (settings.logo) {
        try {
            pdf.addImage(settings.logo, pageWidth - margin - 38, 5, 38, 20, undefined, 'FAST');
        } catch (err) {
            console.warn('Logo sa nepodarilo vložiť do PDF.', err);
        }
    }

    // === Dodávateľ / odberateľ ===
    pdf.setTextColor(0, 0, 0);
    let y = 42;
    const colWidth = contentWidth / 2 - 5;
    const leftX = margin;
    const rightX = margin + contentWidth / 2 + 5;

    const drawParty = (title, party, x) => {
        pdf.setFillColor(color.r, color.g, color.b);
        pdf.rect(x, y, colWidth, 7, 'F');
        pdf.setTextColor(255, 255, 255);
        T.setFont('bold', 10);
        T.text(title, x + 3, y + 5);

        pdf.setTextColor(0, 0, 0);
        let lineY = y + 13;
        T.setFont('bold', 11);
        T.text(party.name || '', x + 3, lineY);
        lineY += 5;
        T.setFont('normal', 9);
        partyLines(party).forEach(line => {
            T.text(line, x + 3, lineY);
            lineY += 4.2;
        });
        return lineY;
    };

    const supplierEnd = drawParty('DODÁVATEĽ', document_.supplier || {}, leftX);
    const customerEnd = drawParty('ODBERATEĽ', document_.customer || {}, rightX);
    y = Math.max(supplierEnd, customerEnd) + 6;

    // === Údaje dokladu ===
    const rows = metaRows(document_, totals);
    const boxHeight = Math.ceil(rows.length / 3) * 11 + 4;
    pdf.setFillColor(246, 248, 251);
    pdf.setDrawColor(215, 220, 228);
    pdf.rect(margin, y, contentWidth, boxHeight, 'FD');

    rows.forEach((row, index) => {
        const col = index % 3;
        const line = Math.floor(index / 3);
        const x = margin + 4 + col * (contentWidth / 3);
        const baseY = y + 6 + line * 11;
        T.setFont('normal', 8);
        pdf.setTextColor(110, 116, 128);
        T.text(row[0], x, baseY);
        T.setFont('bold', 9.5);
        pdf.setTextColor(20, 24, 32);
        T.text(row[1] || '-', x, baseY + 4.5);
    });

    y += boxHeight + 8;

    // === Tabuľka položiek ===
    const currency = Calc.currencySymbol(document_.currency);
    const head = totals.useVat
        ? [['#', 'Popis', 'Počet', 'M.J.', `Cena bez DPH`, 'DPH %', 'DPH', `Celkom s DPH`]]
        : [['#', 'Popis', 'Počet', 'M.J.', 'Cena', 'Celkom']];

    const body = totals.lines.map((line, index) => (totals.useVat
        ? [
            String(index + 1),
            T.sanitize(line.desc),
            Calc.formatQty(line.qty),
            T.sanitize(line.unit),
            `${Calc.formatAmount(line.unitPriceNet)} ${currency}`,
            `${line.vatRate} %`,
            `${Calc.formatAmount(line.vat)} ${currency}`,
            `${Calc.formatAmount(line.gross)} ${currency}`,
        ]
        : [
            String(index + 1),
            T.sanitize(line.desc),
            Calc.formatQty(line.qty),
            T.sanitize(line.unit),
            `${Calc.formatAmount(line.unitPriceNet)} ${currency}`,
            `${Calc.formatAmount(line.net)} ${currency}`,
        ]));

    pdf.autoTable({
        startY: y,
        head: head.map(row => row.map(cell => T.sanitize(cell))),
        body: body.map(row => row.map(cell => T.sanitize(cell))),
        margin: { left: margin, right: margin, bottom: 30 },
        styles: { font: T.fontName, fontSize: 9, cellPadding: 2 },
        headStyles: { font: T.fontName, fillColor: [color.r, color.g, color.b], textColor: 255, fontStyle: 'bold', fontSize: 9 },
        alternateRowStyles: { fillColor: [248, 250, 254] },
        columnStyles: totals.useVat
            ? { 0: { cellWidth: 8 }, 2: { halign: 'right', cellWidth: 15 }, 3: { cellWidth: 12 }, 4: { halign: 'right' }, 5: { halign: 'center', cellWidth: 14 }, 6: { halign: 'right' }, 7: { halign: 'right' } }
            : { 0: { cellWidth: 8 }, 2: { halign: 'right', cellWidth: 18 }, 3: { cellWidth: 14 }, 4: { halign: 'right' }, 5: { halign: 'right' } },
    });

    y = pdf.lastAutoTable.finalY + 8;

    if (y > pageHeight - 70) {
        pdf.addPage();
        y = margin;
    }

    // === Rozpis DPH ===
    if (totals.useVat && totals.vatBreakdown.length > 0) {
        T.setFont('bold', 9);
        pdf.setTextColor(20, 24, 32);
        T.text('Rozpis DPH', margin, y);
        let breakdownY = y + 5;
        T.setFont('normal', 8.5);
        pdf.setTextColor(80, 86, 96);
        totals.vatBreakdown.forEach(entry => {
            T.text(`Základ ${entry.rate} %: ${Calc.formatAmount(entry.base)} ${currency}`, margin, breakdownY);
            T.text(`DPH: ${Calc.formatAmount(entry.vat)} ${currency}`, margin + 45, breakdownY);
            breakdownY += 4.5;
        });
    }

    // === Súčty ===
    const totalsX = pageWidth - margin - 75;
    let totalsY = y;
    const printTotal = (label, value, bold) => {
        T.setFont(bold ? 'bold' : 'normal', bold ? 10 : 9.5);
        pdf.setTextColor(60, 66, 76);
        T.text(label, totalsX, totalsY);
        T.text(value, pageWidth - margin, totalsY, { align: 'right' });
        totalsY += 5;
    };

    if (totals.discount > 0) {
        printTotal('Medzisúčet:', `${Calc.formatAmount(totals.useVat ? totals.grossBeforeDiscount : totals.subtotalBeforeDiscount)} ${currency}`);
        printTotal('Zľava:', `-${Calc.formatAmount(totals.discount)} ${currency}`);
    }
    if (totals.useVat) {
        printTotal('Celkom bez DPH:', `${Calc.formatAmount(totals.subtotal)} ${currency}`);
        printTotal('DPH:', `${Calc.formatAmount(totals.vatTotal)} ${currency}`);
    } else {
        printTotal('Celkom:', `${Calc.formatAmount(totals.subtotal)} ${currency}`);
    }
    if (totals.roundingDiff !== 0) printTotal('Zaokrúhlenie:', `${Calc.formatAmount(totals.roundingDiff)} ${currency}`);

    pdf.setDrawColor(color.r, color.g, color.b);
    pdf.setLineWidth(0.5);
    pdf.line(totalsX, totalsY, pageWidth - margin, totalsY);
    totalsY += 6;
    T.setFont('bold', 13);
    pdf.setTextColor(color.r, color.g, color.b);
    T.text('NA ÚHRADU:', totalsX, totalsY);
    T.text(`${Calc.formatAmount(totals.total)} ${currency}`, pageWidth - margin, totalsY, { align: 'right' });

    y = Math.max(totalsY, y) + 12;

    // === Poznámka ===
    if (document_.note) {
        pdf.setTextColor(20, 24, 32);
        T.setFont('bold', 9);
        T.text('Poznámka:', margin, y);
        y += 4.5;
        T.setFont('normal', 9);
        const noteLines = T.split(document_.note, contentWidth);
        pdf.text(noteLines, margin, y);
        y += noteLines.length * 4.2;
    }

    // === Pätička ===
    const footerY = pageHeight - 16;
    pdf.setDrawColor(215, 220, 228);
    pdf.setLineWidth(0.3);
    pdf.line(margin, footerY - 6, pageWidth - margin, footerY - 6);
    T.setFont('normal', 8);
    pdf.setTextColor(120, 126, 136);
    if (document_.issuedBy) T.text(`Vystavil: ${document_.issuedBy}`, margin, footerY);
    if (document_.registryInfo) {
        const regLines = T.split(document_.registryInfo, contentWidth - 40);
        pdf.text(regLines, margin, footerY + 4);
    }
    T.text(`Strana ${pdf.internal.getNumberOfPages()}`, pageWidth - margin, footerY, { align: 'right' });

    return pdf;
}

function pdfFilename(doc) {
    const prefix = { faktura: 'faktura', ponuka: 'cenova_ponuka', objednavka: 'objednavka' }[doc.type] || 'doklad';
    const customer = (doc.customer && doc.customer.name ? doc.customer.name : '')
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_|_$/g, '').toLowerCase();
    return [prefix, doc.number || 'novy', customer].filter(Boolean).join('_') + '.pdf';
}

async function downloadPdf(doc) {
    const pdf = await buildPdf(doc);
    pdf.save(pdfFilename(doc));
}

async function openPdfInNewTab(doc) {
    const pdf = await buildPdf(doc);
    pdf.output('dataurlnewwindow', { filename: pdfFilename(doc) });
}

window.Pdf = { buildPdf, downloadPdf, openPdfInNewTab, pdfFilename };
