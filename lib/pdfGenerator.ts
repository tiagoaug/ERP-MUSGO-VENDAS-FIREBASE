import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { Capacitor } from '@capacitor/core';
import { Sale, Customer, Product, Variation, CartItem, Purchase, Supplier, Receipt } from '../types';
import { formatMoney, formatDate } from './utils';

// @ts-ignore
const { jsPDF } = window.jspdf;

// --- HELPER PARA SALVAR PDF ROBUSTO ---
const saveAsPDF = async (doc: any, title: string, format: string) => {
    const safeTitle = title
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // Remove acentos
        .replace(/[^a-z0-9]/gi, '_') // Remove caracteres especiais
        .toLowerCase();

    const fileName = `${safeTitle}_${format}.pdf`;

    // Detectar ambiente nativo (Capacitor)
    const isNative = Capacitor.isNativePlatform();

    try {
        if (isNative) {
            // No mobile nativo, o sistema de download padrão do navegador falha.
            // A solução robusta é salvar o arquivo no cache e usar o Share plugin.
            const pdfBase64 = doc.output('datauristring').split(',')[1];

            const savedFile = await Filesystem.writeFile({
                path: fileName,
                data: pdfBase64,
                directory: Directory.Cache,
            });

            await Share.share({
                title: `Relatório: ${title}`,
                text: `Relatório gerado pelo sistema Gestão Pro`,
                url: savedFile.uri,
                dialogTitle: 'Abrir/Compartilhar Relatório',
            });

            console.log(`Relatório nativo "${title}" enviado para compartilhamento.`);
        } else {
            // Comportamento padrão para PC
            doc.save(fileName);
        }
    } catch (e) {
        console.error("Erro ao salvar PDF:", e);
        // Fallback desesperado
        try {
            doc.save(fileName);
        } catch (err) {
            console.error("Falha no fallback de salvamento:", err);
        }
    }
};

// --- GERADOR GENÉRICO DE RELATÓRIOS (A4 e MOBILE) ---
export const generateReportPDF = async (
    reportTitle: string,
    columns: string[],
    data: any[][],
    summary: { label: string, value: string }[],
    format: 'a4' | 'mobile',
    dateRangeStr: string
) => {
    const isMobile = format === 'mobile';
    const doc = new jsPDF({
        unit: 'mm',
        format: isMobile ? [80, 1000] : 'a4', // Altura inicial p/ mobile
        orientation: 'portrait'
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = isMobile ? 5 : 15;

    // Cores do Sistema (Modern Slate/Indigo)
    const primaryColor = [15, 23, 42]; // Slate 900
    const accentColor = [79, 70, 229]; // Indigo 600
    const mutedColor = [100, 116, 139]; // Slate 500
    const lightBg = [248, 250, 252]; // Slate 50

    // --- CABEÇALHO ---
    if (!isMobile) {
        // Faixa de fundo decorativa no topo
        doc.setFillColor(accentColor[0], accentColor[1], accentColor[2]);
        doc.rect(0, 0, pageWidth, 2, 'F');

        // Título Principal
        doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
        doc.setFontSize(22);
        doc.setFont('helvetica', 'bold');
        doc.text(reportTitle.toUpperCase(), margin, 25);

        // Metadata Subheader
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(accentColor[0], accentColor[1], accentColor[2]);
        doc.text("GESTAO PRO ERP", margin, 32);

        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(mutedColor[0], mutedColor[1], mutedColor[2]);
        doc.text(`Período de Análise: ${dateRangeStr}`, margin, 36);

        doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}`, pageWidth - margin, 36, { align: 'right' });
    } else {
        // Mobile Header (Compact)
        doc.setTextColor(accentColor[0], accentColor[1], accentColor[2]);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text(reportTitle.toUpperCase(), margin, 10);

        doc.setFontSize(7);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(mutedColor[0], mutedColor[1], mutedColor[2]);
        doc.text(dateRangeStr, margin, 14);

        doc.setDrawColor(230);
        doc.line(margin, 16, pageWidth - margin, 16);
    }

    // --- TABELA ---
    // @ts-ignore
    doc.autoTable({
        head: [columns],
        body: data,
        startY: isMobile ? 18 : 45,
        theme: 'grid',
        styles: {
            fontSize: isMobile ? 7 : 9,
            cellPadding: isMobile ? 1.5 : 3,
            textColor: [50, 50, 50],
            lineColor: [240, 240, 240],
            lineWidth: 0.1,
            valign: 'middle',
            font: 'helvetica'
        },
        headStyles: {
            fillColor: lightBg,
            textColor: primaryColor,
            fontStyle: 'bold',
            lineWidth: 0,
            fontSize: isMobile ? 7 : 8
        },
        alternateRowStyles: {
            fillColor: [252, 253, 255]
        },
        margin: { left: margin, right: margin }
    });

    // --- SUMÁRIO / TOTAIS ---
    let finalY = doc.lastAutoTable.finalY + 10;

    // Box de Sumário
    if (summary.length > 0) {
        const summaryWidth = isMobile ? (pageWidth - (margin * 2)) : 80;
        const summaryX = isMobile ? margin : (pageWidth - margin - summaryWidth);
        const padding = 5;

        // Background do summary
        doc.setFillColor(lightBg[0], lightBg[1], lightBg[2]);
        const summaryHeight = (summary.length * (isMobile ? 5 : 7)) + (padding * 2);

        // Ajuste de página automática se necessário (A4)
        if (!isMobile && finalY + summaryHeight > 280) {
            doc.addPage();
            finalY = 20;
        }

        doc.roundedRect(summaryX, finalY, summaryWidth, summaryHeight, 3, 3, 'F');

        let itemY = finalY + padding + (isMobile ? 2 : 3);
        summary.forEach((item) => {
            doc.setFontSize(isMobile ? 7 : 9);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(mutedColor[0], mutedColor[1], mutedColor[2]);
            doc.text(item.label.toUpperCase(), summaryX + padding, itemY);

            doc.setFontSize(isMobile ? 8 : 10);
            doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
            doc.text(item.value, summaryX + summaryWidth - padding, itemY, { align: 'right' });

            itemY += isMobile ? 5 : 7;
        });

        finalY += summaryHeight + 10;
    }

    // Rodapé
    doc.setFontSize(isMobile ? 6 : 8);
    doc.setTextColor(mutedColor[0], mutedColor[1], mutedColor[2]);
    const footerText = "DOCUMENTO GERADO PELO SISTEMA GESTÃO PRO v3.0";
    doc.text(footerText, pageWidth / 2, finalY, { align: 'center' });

    await saveAsPDF(doc, reportTitle, format);
};

// --- FUNÇÕES LEGADO MANTIDAS (ORÇAMENTO E RECIBO) ---

export const exportBudgetPDF = async ({ customer, items, totalValue, date }: { customer?: Customer, items: CartItem[], totalValue: number, date: string }) => {
    const doc = new jsPDF({ unit: 'mm', format: [105, 200] });
    const pageWidth = 105;

    const accentColor = [79, 70, 229]; // Indigo 600
    const primaryColor = [15, 23, 42]; // Slate 900
    const mutedColor = [100, 116, 139]; // Slate 500

    // Header Hero
    doc.setFillColor(accentColor[0], accentColor[1], accentColor[2]);
    doc.rect(0, 0, pageWidth, 25, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text("ORÇAMENTO DIGITAL", 8, 12);

    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    const dateStr = formatDate(date);
    doc.text(`EMISSÃO: ${dateStr}`, 8, 18);
    doc.text(`VALIDADE: 07 DIAS`, pageWidth - 8, 18, { align: 'right' });

    // Cliente
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text("DESTINATÁRIO", 8, 35);

    doc.setFontSize(10);
    doc.text(customer?.name || 'CONSUMIDOR FINAL', 8, 40);

    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(mutedColor[0], mutedColor[1], mutedColor[2]);
    doc.text(`CONTATO: ${customer?.phone || '--'}`, 8, 44);

    // Tabela Itens
    // @ts-ignore
    doc.autoTable({
        head: [['DESCRIÇÃO', 'QTD', 'VAL. UN', 'TOTAL']],
        body: items.map(item => [
            `${item.name}\n${item.variationName}`,
            item.quantity,
            formatMoney(item.price),
            formatMoney(item.quantity * item.price)
        ]),
        startY: 52,
        theme: 'striped',
        headStyles: { fillColor: [248, 250, 252], textColor: primaryColor, fontSize: 7, fontStyle: 'bold' },
        bodyStyles: { fontSize: 7, cellPadding: 2, textColor: [50, 50, 50] },
        columnStyles: { 3: { halign: 'right', fontStyle: 'bold' } },
        margin: { left: 8, right: 8 }
    });

    const finalY = (doc as any).lastAutoTable.finalY + 10;

    // Resumo
    doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.roundedRect(8, finalY, pageWidth - 16, 15, 2, 2, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(8);
    doc.text("TOTAL ESTIMADO", 13, finalY + 9);

    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(`R$ ${formatMoney(totalValue)}`, pageWidth - 13, finalY + 10, { align: 'right' });

    doc.setTextColor(mutedColor[0], mutedColor[1], mutedColor[2]); doc.setFontSize(6);
    doc.text("ESTE DOCUMENTO NÃO POSSUI VALOR FISCAL", pageWidth / 2, finalY + 25, { align: 'center' });
    doc.text("GERADO POR GESTÃO PRO ERP", pageWidth / 2, finalY + 28, { align: 'center' });

    await saveAsPDF(doc, "Orcamento", "digital");
};

export const exportSaleByNumberPDF = async (sale: Sale, customer: Customer | undefined, products: Product[], colors: any[], observation: string = '') => {
    const doc = new jsPDF({ unit: 'mm', format: [105, 220] });
    const pageWidth = 105;

    const primaryColor = [15, 23, 42]; // Slate 900
    const accentColor = [37, 99, 235]; // Blue 600
    const successColor = [16, 185, 129]; // Emerald 500
    const dangerColor = [225, 29, 72]; // Rose 600

    // Header decorativa (Estilo Ticket)
    doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.rect(0, 0, pageWidth, 22, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text("COMPROVANTE DE VENDA", 8, 10);

    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.text(`PEDIDO: #${sale.saleNumber}`, 8, 16);
    doc.text(formatDate(sale.date), pageWidth - 8, 16, { align: 'right' });

    // Status Badge
    const isPaid = sale.isPaid;
    const statusLabel = sale.status === 'Cancelada' ? 'CANCELADO' : (isPaid ? 'PAGAMENTO TOTAL' : 'PAGAMENTO PENDENTE');
    const badgeColor = sale.status === 'Cancelada' ? [150, 150, 150] : (isPaid ? successColor : dangerColor);

    doc.setFillColor(badgeColor[0], badgeColor[1], badgeColor[2]);
    doc.roundedRect(8, 28, 40, 6, 1, 1, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(6);
    doc.setFont('helvetica', 'bold');
    doc.text(statusLabel, 28, 32, { align: 'center' });

    // Dados Cliente
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text("CLIENTE", 8, 45);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    // Removemos os dados de entrega como solicitado
    doc.text(customer?.name || 'CONSUMIDOR GERAL', 8, 50);

    // Itens
    // @ts-ignore
    doc.autoTable({
        head: [['REF / COR', 'QTD', 'UN', 'TOTAL']],
        body: sale.items.map(item => {
            const product = products.find(p => p.id === item.productId);
            const colorName = colors.find(c => c.id === item.colorId)?.name || item.colorId || '';
            return [
                `${product?.reference || 'ITEM'}\n${colorName}`,
                item.quantity,
                formatMoney(item.priceAtSale),
                formatMoney(item.quantity * item.priceAtSale)
            ];
        }),
        startY: 62,
        theme: 'plain',
        headStyles: { textColor: primaryColor, fontSize: 7, fontStyle: 'bold' },
        bodyStyles: { fontSize: 7, cellPadding: 2 },
        columnStyles: { 3: { halign: 'right', fontStyle: 'bold' } },
        margin: { left: 8, right: 8 }
    });

    let finalY = (doc as any).lastAutoTable.finalY + 8;

    // Fechamento Financeiro
    doc.setDrawColor(230);
    doc.line(8, finalY, pageWidth - 8, finalY);
    finalY += 6;

    if (sale.discount && sale.discount > 0) {
        doc.setFontSize(8);
        doc.setTextColor(50);
        doc.text("SUBTOTAL DO PEDIDO:", 8, finalY);
        doc.setFont('helvetica', 'normal');
        // Cálculo do subtotal original usando o total e o desconto
        const subtotalValor = sale.totalValue + sale.discount;
        doc.text(`R$ ${formatMoney(subtotalValor)}`, pageWidth - 8, finalY, { align: 'right' });

        finalY += 5;
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(50);
        doc.text("DESCONTO APLICADO:", 8, finalY);
        doc.setTextColor(successColor[0], successColor[1], successColor[2]);
        doc.text(`- R$ ${formatMoney(sale.discount)}`, pageWidth - 8, finalY, { align: 'right' });

        finalY += 5;
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
        doc.text("TOTAL DO PEDIDO:", 8, finalY);
        if (sale.amountPaid >= sale.totalValue) {
            doc.text(`R$ ${formatMoney(sale.totalValue)}`, pageWidth - 8, finalY, { align: 'right' });
        } else {
            doc.setTextColor(dangerColor[0], dangerColor[1], dangerColor[2]);
            doc.text(`R$ ${formatMoney(sale.totalValue)}`, pageWidth - 8, finalY, { align: 'right' });
        }
    } else {
        doc.setFontSize(8);
        doc.setTextColor(50);
        doc.text("TOTAL DO PEDIDO:", 8, finalY);
        doc.setFont('helvetica', 'bold');
        if (sale.amountPaid >= sale.totalValue) {
            doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
            doc.text(`R$ ${formatMoney(sale.totalValue)}`, pageWidth - 8, finalY, { align: 'right' });
        } else {
            doc.setTextColor(dangerColor[0], dangerColor[1], dangerColor[2]);
            doc.text(`R$ ${formatMoney(sale.totalValue)}`, pageWidth - 8, finalY, { align: 'right' });
        }
    }

    if (sale.amountPaid && sale.amountPaid > 0) {
        finalY += 5;
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(50);
        doc.text("VALOR ABATIDO:", 8, finalY);
        doc.setTextColor(successColor[0], successColor[1], successColor[2]);
        doc.text(`R$ ${formatMoney(sale.amountPaid)}`, pageWidth - 8, finalY, { align: 'right' });
    }

    // Observações
    if (observation && observation.trim() !== '') {
        finalY += 8;
        doc.setDrawColor(230);
        doc.line(8, finalY - 4, pageWidth - 8, finalY - 4);

        doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
        doc.setFontSize(7);
        doc.setFont('helvetica', 'bold');
        doc.text("OBSERVAÇÕES:", 8, finalY);

        doc.setFont('helvetica', 'normal');
        doc.setTextColor(100);

        // Wrap text to fit width
        // @ts-ignore
        const splitObs = doc.splitTextToSize(observation.toUpperCase(), pageWidth - 16);
        doc.text(splitObs, 8, finalY + 4);

        finalY += 4 + (splitObs.length * 3);
    }

    // Footer
    doc.setTextColor(180); doc.setFontSize(6);
    doc.text("ESTE DOCUMENTO NÃO POSSUI VALOR FISCAL", pageWidth / 2, finalY + 12, { align: 'center' });
    doc.text("OBRIGADO PELA PREFERÊNCIA!", pageWidth / 2, finalY + 15, { align: 'center' });
    doc.text("GESTÃO PRO v3.0 - COMPROVANTE DIGITAL", pageWidth / 2, finalY + 18, { align: 'center' });

    await saveAsPDF(doc, "Recibo", sale.saleNumber);
};

export const exportSeparationListPDF = async ({ customer, items, date }: { customer?: Customer, items: CartItem[], date: string }) => {
    const doc = new jsPDF({ unit: 'mm', format: [105, 200] });
    const pageWidth = 105;

    const accentColor = [15, 23, 42]; // Slate 900
    const primaryColor = [15, 23, 42]; // Slate 900
    const mutedColor = [100, 116, 139]; // Slate 500

    // Header
    doc.setFillColor(accentColor[0], accentColor[1], accentColor[2]);
    doc.rect(0, 0, pageWidth, 20, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text("LISTA DE SEPARAÇÃO", 8, 12);

    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.text(`EMISSÃO: ${formatDate(date)}`, 8, 16);

    // Cliente
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text("CLIENTE:", 8, 30);
    doc.text(customer?.name || 'CONSUMIDOR FINAL', 22, 30);

    // Tabela Itens (Sem preço)
    // @ts-ignore
    doc.autoTable({
        head: [['REF / VARIAÇÃO', 'QTD']],
        body: items.map(item => [
            `${item.name}\n${item.variationName}`,
            `${item.quantity} ${item.isWholesale ? 'CX' : 'UN'}`
        ]),
        startY: 35,
        theme: 'grid',
        headStyles: { fillColor: [241, 245, 249], textColor: primaryColor, fontSize: 8, fontStyle: 'bold' },
        bodyStyles: { fontSize: 8, cellPadding: 3, textColor: [50, 50, 50] },
        columnStyles: { 1: { halign: 'center', fontStyle: 'bold', cellWidth: 25 } },
        margin: { left: 8, right: 8 }
    });

    const finalY = (doc as any).lastAutoTable.finalY + 10;
    doc.setTextColor(mutedColor[0], mutedColor[1], mutedColor[2]); doc.setFontSize(6);
    doc.text("CONFERIDO POR: ___________________________", 8, finalY + 5);
    doc.text("GERADO POR GESTÃO PRO ERP", pageWidth / 2, finalY + 15, { align: 'center' });

    await saveAsPDF(doc, "Lista_Separacao", "doc");
};

// --- MANTENDO AS EXPORTAÇÕES LEGADO COMO ALIAS PARA O NOVO GERADOR ---
export const exportSalesGeneralPDF = async (sales: Sale[], customers: Customer[]) => {
    const data = sales.map(s => [
        s.saleNumber,
        formatDate(s.date),
        customers.find(c => c.id === s.customerId)?.name || 'N/A',
        formatMoney(s.totalValue),
        s.status
    ]);
    const total = sales.reduce((acc, s) => acc + s.totalValue, 0);

    await generateReportPDF(
        "Relação Geral de Vendas",
        ['PEDIDO', 'DATA', 'CLIENTE', 'VALOR', 'STATUS'],
        data,
        [{ label: 'TOTAL GERAL', value: `R$ ${formatMoney(total)}` }],
        'a4',
        'Histórico Completo'
    );
};

export const exportCustomerHistoryPDF = async (customer: Customer, sales: Sale[]) => {
    const data = [...sales].reverse().map(s => [
        s.saleNumber,
        formatDate(s.date),
        formatMoney(s.totalValue),
        s.status
    ]);
    const total = sales.reduce((acc, s) => acc + s.totalValue, 0);

    await generateReportPDF(
        `Histórico: ${customer.name}`,
        ['PEDIDO', 'DATA', 'VALOR', 'SITUAÇÃO'],
        data,
        [{ label: 'TOTAL COMPRADO', value: `R$ ${formatMoney(total)}` }],
        'mobile',
        'Histórico Completo'
    );
};

export const exportTopProductsPDF = (sales: Sale[], products: Product[], period: 'week' | 'month' | 'year') => {
    // Este seria substituído pela nova lógica na View, mantendo aqui apenas para compatibilidade se necessário
    // A implementação real está na View agora usando generateReportPDF diretamente
};

export const exportTopCustomersPDF = (sales: Sale[], customers: Customer[], period: 'week' | 'month' | 'year') => {
    // A implementação real está na View agora usando generateReportPDF diretamente
};
export const exportReceiptPDF = async (receipt: any, customer: Customer | undefined) => {
    const doc = new jsPDF({ unit: 'mm', format: [105, 230] });
    const pageWidth = 105;

    const primaryColor = [15, 23, 42]; // Slate 900
    const accentColor = [124, 58, 237]; // Violet 600 (Cor dos recibos)
    const successColor = [16, 185, 129]; // Emerald 500

    // Header Hero (Violet style)
    doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.rect(0, 0, pageWidth, 22, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text("COMPROVANTE DE RECEBIMENTO", 8, 10);

    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.text(`RECIBO: #${receipt.receiptNumber}`, 8, 16);
    doc.text(formatDate(receipt.date), pageWidth - 8, 16, { align: 'right' });

    // Cliente
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text("FAVORECIDO", 8, 30);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(customer?.name || 'CONSUMIDOR GERAL', 8, 35);

    // Detalhes do Recibo (Itens originais)
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text("DETALHAMENTO DO TÍTULO", 8, 45);

    // @ts-ignore
    doc.autoTable({
        head: [['DESCRIÇÃO', 'VALOR']],
        body: (receipt.expenseItems || []).map((item: any) => [
            item.description,
            `R$ ${formatMoney(item.value)}`
        ]),
        startY: 50,
        theme: 'striped',
        headStyles: { fillColor: [248, 250, 252], textColor: primaryColor, fontSize: 7, fontStyle: 'bold' },
        bodyStyles: { fontSize: 7, cellPadding: 2 },
        columnStyles: { 1: { halign: 'right', fontStyle: 'bold' } },
        margin: { left: 8, right: 8 }
    });

    let finalY = (doc as any).lastAutoTable.finalY + 10;

    // Histórico de Amortizações
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text("EXTRATO DE PAGAMENTOS / AMORTIZAÇÕES", 8, finalY);

    // @ts-ignore
    doc.autoTable({
        head: [['DATA', 'DESCRIÇÃO', 'AMORTIZADO']],
        body: (receipt.paymentHistory || []).sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime()).map((p: any) => [
            formatDate(p.date),
            p.note || 'Amortização',
            `R$ ${formatMoney(p.amount)}`
        ]),
        startY: finalY + 4,
        theme: 'plain',
        headStyles: { textColor: accentColor, fontSize: 7, fontStyle: 'bold' },
        bodyStyles: { fontSize: 7, cellPadding: 2 },
        columnStyles: { 2: { halign: 'right', fontStyle: 'bold', textColor: successColor } },
        margin: { left: 8, right: 8 }
    });

    finalY = (doc as any).lastAutoTable.finalY + 8;

    // Fechamento Financeiro
    doc.setDrawColor(230);
    doc.line(8, finalY, pageWidth - 8, finalY);
    finalY += 6;

    doc.setFontSize(8);
    doc.setTextColor(50);
    doc.text("VALOR TOTAL DO TÍTULO:", 8, finalY);
    doc.setFont('helvetica', 'bold');
    doc.text(`R$ ${formatMoney(receipt.totalValue)}`, pageWidth - 8, finalY, { align: 'right' });

    finalY += 5;
    doc.setFont('helvetica', 'normal');
    doc.text("TOTAL JÁ AMORTIZADO:", 8, finalY);
    doc.setTextColor(successColor[0], successColor[1], successColor[2]);
    doc.text(`R$ ${formatMoney(receipt.amountPaid)}`, pageWidth - 8, finalY, { align: 'right' });

    const remaining = receipt.totalValue - receipt.amountPaid;
    if (remaining > 0) {
        finalY += 5;
        doc.setTextColor(225, 29, 72); // Rose 600
        doc.setFont('helvetica', 'bold');
        doc.text("SALDO DEVEDOR:", 8, finalY);
        doc.text(`R$ ${formatMoney(remaining)}`, pageWidth - 8, finalY, { align: 'right' });
    } else {
        finalY += 5;
        doc.setTextColor(successColor[0], successColor[1], successColor[2]);
        doc.setFont('helvetica', 'bold');
        doc.text("SITUAÇÃO:", 8, finalY);
        doc.text("TOTALMENTE QUITADO", pageWidth - 8, finalY, { align: 'right' });
    }

    // Footer
    doc.setTextColor(180); doc.setFontSize(6);
    doc.text("ESTE DOCUMENTO NÃO POSSUI VALOR FISCAL", pageWidth / 2, finalY + 15, { align: 'center' });
    doc.text("GERADO POR GESTÃO PRO v3.0", pageWidth / 2, finalY + 18, { align: 'center' });

    await saveAsPDF(doc, "Recibo", receipt.receiptNumber);
};

export const exportSupplierPurchaseHistoryPDF = async (supplier: Supplier, purchases: Purchase[], products: Product[]) => {
    const data = [...purchases].reverse().map(p => [
        p.purchaseNumber || 'COMPRA',
        formatDate(p.date),
        formatMoney(p.totalValue),
        p.isPaid ? 'QUITADO' : 'PENDENTE'
    ]);
    const total = purchases.reduce((acc, p) => acc + p.totalValue, 0);

    await generateReportPDF(
        `Histórico: ${supplier.name}`,
        ['COMPRA', 'DATA', 'VALOR', 'SITUAÇÃO'],
        data,
        [{ label: 'TOTAL COMPRADO', value: `R$ ${formatMoney(total)}` }],
        'mobile',
        'Histórico Completo'
    );
};

export const exportPurchaseDetailPDF = async (purchase: Purchase, supplier: Supplier, products: Product[]) => {
    const isGeneral = purchase.type === 'general';

    let columns: string[];
    let data: any[][];

    if (isGeneral) {
        columns = ['DESCRIÇÃO', 'VALOR TOTAL'];

        // Se houver itens de despesa específicos, usamos eles
        if (purchase.expenseItems && purchase.expenseItems.length > 0) {
            data = purchase.expenseItems.map(item => [
                item.description.toUpperCase(),
                `R$ ${formatMoney(item.value)}`
            ]);
        } else {
            // Caso contrário, usamos a descrição geral da compra
            data = [[
                (purchase.itemDescription || purchase.notes || 'DESPESA GERAL').toUpperCase(),
                `R$ ${formatMoney(purchase.totalValue)}`
            ]];
        }
    } else {
        columns = ['REF', 'COR', 'TAM', 'QTD', 'UNID', 'TOTAL'];
        data = (purchase.items || []).map(item => {
            const product = products.find(p => p.id === item.productId);
            return [
                product?.reference || 'Ref.?',
                item.colorId || '',
                item.size || '',
                item.quantity.toString(),
                formatMoney(item.costPrice),
                formatMoney(item.quantity * item.costPrice)
            ];
        });
    }

    const footer = [
        { label: 'VALOR TOTAL', value: `R$ ${formatMoney(purchase.totalValue)}` },
        { label: 'VALOR PAGO', value: `R$ ${formatMoney(purchase.amountPaid || 0)}` },
        { label: 'PENDENTE', value: `R$ ${formatMoney(purchase.totalValue - (purchase.amountPaid || 0))}` }
    ];

    await generateReportPDF(
        `Detalhamento de Compra - ${purchase.purchaseNumber}`,
        columns,
        data,
        footer,
        'mobile',
        `Fornecedor: ${supplier.name} | Data: ${formatDate(purchase.date)}`
    );
};

export const exportSelectedPurchasesPDF = async (supplier: Supplier, purchases: Purchase[]) => {
    const data = purchases.map(p => [
        p.purchaseNumber || 'COMPRA',
        formatDate(p.date),
        formatMoney(p.totalValue),
        p.isPaid ? 'QUITADO' : 'PENDENTE'
    ]);

    const total = purchases.reduce((acc, p) => acc + p.totalValue, 0);

    await generateReportPDF(
        `Compras Selecionadas - ${supplier.name}`,
        ['NÚMERO', 'DATA', 'VALOR', 'STATUS'],
        data,
        [{ label: 'TOTAL SELECIONADO', value: `R$ ${formatMoney(total)}` }],
        'a4',
        `Relatório Gerado em ${formatDate(new Date().toISOString())}`
    );
};

export const exportSelectedSalesPDF = async (customer: Customer, items: (Sale | Receipt)[]) => {
    const data = items.map(item => {
        const isReceipt = 'receiptNumber' in item;
        const number = isReceipt ? item.receiptNumber : (item as Sale).saleNumber || 'VENDA';
        const typeLabel = isReceipt ? 'RECIBO' : 'VENDA';
        const totalValue = item.totalValue;
        const amountPaid = item.amountPaid || 0;
        const remaining = totalValue - amountPaid;
        const status = isReceipt
            ? (remaining <= 0 ? 'QUITADO' : 'PENDENTE')
            : (item as Sale).status;

        return [
            `${typeLabel}: ${number}`,
            formatDate(item.date),
            formatMoney(totalValue),
            formatMoney(amountPaid),
            formatMoney(remaining),
            status
        ];
    });

    const totalSelected = items.reduce((acc, item) => acc + item.totalValue, 0);
    const totalPaid = items.reduce((acc, item) => acc + (item.amountPaid || 0), 0);
    const totalRemaining = totalSelected - totalPaid;

    await generateReportPDF(
        `Relatório Unificado - ${customer.name}`,
        ['DOCUMENTO', 'DATA', 'VALOR', 'V. PAGO', 'EM ABERTO', 'STATUS'],
        data,
        [
            { label: 'TOTAL SELECIONADO', value: `R$ ${formatMoney(totalSelected)}` },
            { label: 'TOTAL PAGO', value: `R$ ${formatMoney(totalPaid)}` },
            { label: 'SALDO EM ABERTO', value: `R$ ${formatMoney(totalRemaining)}` }
        ],
        'a4',
        `Relatório Gerado em ${formatDate(new Date().toISOString())}`
    );
};
