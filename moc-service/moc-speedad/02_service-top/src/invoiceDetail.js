document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const invoiceId = urlParams.get('invoiceId');

    // TODO: 本来はAPIや`data/invoices.json`からデータを取得する
    const sampleInvoiceData = {
        'inv-202507-001': {
            invoiceId: 'inv-202507-001',
            issueDate: '2025-07-31',
            dueDate: '2025-08-31',
            customerName: '株式会社サンプル商事',
            customerAddress: '〒101-0021 東京都千代田区外神田４丁目１４−１',
            subtotal: 50000,
            tax: 5000,
            totalAmount: 55000,
            items: [
                { name: '月額基本サービス料 (2025年7月分)', amount: 30000 },
                { name: 'A展示会来場者アンケート利用料', amount: 20000 },
            ]
        },
        'inv-202506-001': {
            invoiceId: 'inv-202506-001',
            issueDate: '2025-06-30',
            dueDate: '2025-07-31',
            customerName: '株式会社サンプル商事',
            customerAddress: '〒101-0021 東京都千代田区外神田４丁目１４−１',
            subtotal: 45000,
            tax: 4500,
            totalAmount: 50000,
            items: [
                { name: '月額基本サービス料 (2025年6月分)', amount: 30000 },
                { name: 'B展示会アンケート', amount: 15000 },
            ]
        }
    };

    const invoice = sampleInvoiceData[invoiceId];

    if (invoice) {
        document.getElementById('invoice-id').textContent = invoice.invoiceId;
        document.getElementById('issue-date').textContent = invoice.issueDate;
        document.getElementById('due-date').textContent = invoice.dueDate;
        document.getElementById('customer-name').textContent = invoice.customerName;
        document.getElementById('customer-address').textContent = invoice.customerAddress;

        const itemsBody = document.getElementById('invoice-items');
        itemsBody.innerHTML = ''; // Clear existing items
        invoice.items.forEach(item => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${item.name}</td>
                <td class="text-end">¥${item.amount.toLocaleString()}</td>
            `;
            itemsBody.appendChild(row);
        });

        document.getElementById('subtotal').textContent = `¥${invoice.subtotal.toLocaleString()}`;
        document.getElementById('tax').textContent = `¥${invoice.tax.toLocaleString()}`;
        document.getElementById('total-amount').textContent = `¥${invoice.totalAmount.toLocaleString()}`;
    }
});