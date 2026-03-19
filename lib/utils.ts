export const formatMoney = (val: any): string => {
    const num = typeof val === 'number' ? val : parseFloat(String(val).replace(',', '.')) || 0;
    if (!isFinite(num)) return '0,00';
    return num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

export const sanitizeNum = (val: any): number => {
    if (typeof val === 'number') return val;
    if (typeof val === 'string') {
        const n = parseFloat(val.replace(',', '.'));
        return isNaN(n) ? 0 : n;
    }
    return 0;
};

export const sanitizeBankAccountId = (id: any): string | null => {
    if (!id || id === 'cash' || id === 'null' || id === 'undefined') return null;
    return id;
};

export const generateId = (): string => {
    try {
        return crypto.randomUUID();
    } catch {
        // Fallback para ambientes que não suportam crypto.randomUUID()
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }
};

export const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    try {
        const date = new Date(dateString);
        // Adiciona o offset do fuso horário para evitar que a data mude
        const userTimezoneOffset = date.getTimezoneOffset() * 60000;
        return new Date(date.getTime() + userTimezoneOffset).toLocaleDateString('pt-BR');
    } catch {
        return dateString;
    }
};

export const formatSaleToText = (sale: any, customer: any, products: any[], colors: any[] = []) => {
    const lines = [];
    lines.push(`📌 *PEDIDO #${sale.saleNumber}*`);
    lines.push(`📅 Data: ${formatDate(sale.date)}`);
    lines.push(`👤 Cliente: ${customer?.name || 'Geral'}`);
    lines.push('');
    lines.push('📦 ITENS:');

    sale.items.forEach((item: any) => {
        const product = products.find((p: any) => p.id === item.productId);
        const ref = product?.reference || 'REF';

        // Resolve color name
        let colorName = item.colorId || '';
        if (item.colorId && colors.length > 0) {
            const colorObj = colors.find((c: any) => c.id === item.colorId);
            if (colorObj) colorName = colorObj.name;
        }

        // Resolve variation name if retail
        let variantName = item.isWholesale ? 'ATACADO' : (item.variationId || '');
        if (!item.isWholesale && product?.variations) {
            const v = product.variations.find((va: any) => va.id === item.variationId);
            if (v) variantName = 'VAREJO';
        }

        lines.push(`- ${item.quantity}x ${ref} (${colorName} ${variantName}): R$ ${formatMoney(item.priceAtSale * item.quantity)}`);
    });

    lines.push('');
    lines.push(`💰 TOTAL: R$ ${formatMoney(sale.totalValue)}`);
    lines.push(`✅ PAGO: R$ ${formatMoney(sale.amountPaid || 0)}`);
    if (sale.totalValue > (sale.amountPaid || 0)) {
        lines.push(`🔴 RESTANTE: R$ ${formatMoney(sale.totalValue - (sale.amountPaid || 0))}`);
    }
    lines.push('');
    lines.push('Gerado via Gestão Pro ERP');

    return lines.join('\n');
};

export const formatSaleToSeparationText = (sale: any, customer: any, products: any[], colors: any[] = []) => {
    const lines = [];
    lines.push(`📋 *LISTA DE SEPARAÇÃO #${sale.saleNumber}*`);
    lines.push(`📅 Data: ${formatDate(sale.date)}`);
    lines.push(`👤 Cliente: ${customer?.name || 'Geral'}`);
    lines.push('');
    lines.push('📦 ITENS A SEPARAR:');

    sale.items.forEach((item: any) => {
        const product = products.find((p: any) => p.id === item.productId);
        const ref = product?.reference || 'REF';

        let colorName = item.colorId || '';
        if (item.colorId && colors.length > 0) {
            const colorObj = colors.find((c: any) => c.id === item.colorId);
            if (colorObj) colorName = colorObj.name;
        }

        let variantName = item.isWholesale ? 'ATACADO' : (item.variationId || '');
        if (!item.isWholesale && product?.variations) {
            const v = product.variations.find((va: any) => va.id === item.variationId);
            if (v) variantName = 'VAREJO';
        }

        lines.push(`[ ] ${item.quantity}x ${ref} (${colorName} ${variantName})`);
    });

    lines.push('');
    lines.push('Gerado via Gestão Pro ERP');

    return lines.join('\n');
};

export const formatSaleToSimpleListText = (sale: any, customer: any, products: any[], colors: any[] = []) => {
    const lines = [];
    lines.push(`LISTA SIMPLES #${sale.saleNumber}`);
    lines.push(`Data: ${formatDate(sale.date)}`);
    lines.push(`Cliente: ${customer?.name || 'Geral'}`);
    lines.push('');
    lines.push('ITENS:');

    sale.items.forEach((item: any) => {
        const product = products.find((p: any) => p.id === item.productId);
        const ref = product?.reference || 'REF';

        let colorName = item.colorId || '';
        if (item.colorId && colors.length > 0) {
            const colorObj = colors.find((c: any) => c.id === item.colorId);
            if (colorObj) colorName = colorObj.name;
        }

        let variantName = item.isWholesale ? 'ATACADO' : (item.variationId || '');
        if (!item.isWholesale && product?.variations) {
            const v = product.variations.find((va: any) => va.id === item.variationId);
            if (v) variantName = 'VAREJO';
        }

        const unitPrice = item.priceAtSale;
        const totalPrice = item.priceAtSale * item.quantity;

        lines.push(`${item.quantity}x ${ref} (${colorName} ${variantName}): R$ ${formatMoney(unitPrice)} (Total: R$ ${formatMoney(totalPrice)})`);
    });

    lines.push('');
    lines.push(`VALOR TOTAL: R$ ${formatMoney(sale.totalValue)}`);
    lines.push('');
    lines.push('Gerado via Gestão Pro ERP');

    return lines.join('\n');
};

export const formatSaleToProductListText = (sale: any, customer: any, products: any[], colors: any[] = []) => {
    const lines = [];
    lines.push(`Cliente: ${customer?.name || 'Geral'}`);

    sale.items.forEach((item: any) => {
        const product = products.find((p: any) => p.id === item.productId);
        const refRaw = product?.reference || '';
        // Referência somente os números, sem letras
        const refDigits = refRaw.replace(/\D/g, '');

        let colorName = item.colorId || '';
        if (item.colorId && colors.length > 0) {
            const colorObj = colors.find((c: any) => c.id === item.colorId);
            if (colorObj) colorName = colorObj.name;
        }

        lines.push(`${refDigits} ${colorName} ${item.quantity}cx`);
    });

    return lines.join('\n');
};

export const formatReceiptToText = (receipt: any, customer: any) => {
    const lines = [];
    lines.push(`💜 *COMPROVANTE DE RECEBIMENTO #${receipt.receiptNumber}*`);
    lines.push(`📅 Data: ${formatDate(receipt.date)}`);
    lines.push(`👤 Favorecido: ${customer?.name || 'Geral'}`);
    if (receipt.dueDate) lines.push(`⏰ Vencimento: ${formatDate(receipt.dueDate)}`);
    lines.push('');

    lines.push('📝 *DETALHAMENTO DO TÍTULO:*');
    (receipt.expenseItems || []).forEach((item: any) => {
        lines.push(`- ${item.description}: R$ ${formatMoney(item.value)}`);
    });
    lines.push('');

    if ((receipt.paymentHistory || []).length > 0) {
        lines.push('✅ *HISTÓRICO DE AMORTIZAÇÕES:*');
        receipt.paymentHistory.sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime()).forEach((p: any) => {
            lines.push(`- ${formatDate(p.date)}: R$ ${formatMoney(p.amount)} (${p.note || 'Amortização'})`);
        });
        lines.push('');
    }

    lines.push(`💰 *VALOR TOTAL:* R$ ${formatMoney(receipt.totalValue)}`);
    lines.push(`💸 *TOTAL PAGO:* R$ ${formatMoney(receipt.amountPaid || 0)}`);

    const remaining = receipt.totalValue - (receipt.amountPaid || 0);
    if (remaining > 0) {
        lines.push(`🔴 *SALDO DEVEDOR:* R$ ${formatMoney(remaining)}`);
    } else {
        lines.push('🎉 *SITUAÇÃO:* TOTALMENTE QUITADO');
    }

    lines.push('');
    lines.push('Gerado via Gestão Pro ERP');

    return lines.join('\n');
};
