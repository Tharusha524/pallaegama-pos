<!DOCTYPE html>
<html>
<head>
    <title>{{ $title }}</title>
    @include('reports.partials.pdf_common_styles')
    <style>
        .cb-customer-row td { font-weight: bold; background-color: #eef2f7; }
        .cb-total-row td { font-weight: bold; border-top: 1px solid #333; }
    </style>
</head>
<body>
    @include('reports.partials.report_header', [
        'companyHeader' => $companyHeader ?? [],
        'title' => $title ?? 'Customer Balances Report',
        'subtitle' => ($startDate ?? '') . ' to ' . ($endDate ?? date('Y-m-d')),
    ])

    <table class="erp-data-table" border="1" cellpadding="0" cellspacing="0" width="100%">
        <thead>
            <tr>
                <th>Trans Type</th>
                <th>#</th>
                <th>Date</th>
                <th>Due Date</th>
                <th class="text-right">Debits</th>
                <th class="text-right">Credits</th>
                <th class="text-right">Allocated</th>
                <th class="text-right">Outstanding</th>
            </tr>
        </thead>
        <tbody>
            @foreach($data as $item)
                @if(($item->row_type ?? '') === 'customer_header')
                    <tr class="cb-customer-row">
                        <td colspan="8">{{ $item->trans_type }} ({{ $item->curr_code ?: '-' }})</td>
                    </tr>
                @elseif(($item->row_type ?? '') === 'total')
                    <tr class="cb-total-row">
                        <td></td>
                        <td>{{ $item->number }}</td>
                        <td></td>
                        <td></td>
                        <td class="text-right">{{ number_format($item->debits, 2) }}</td>
                        <td class="text-right">{{ number_format($item->credits, 2) }}</td>
                        <td class="text-right">{{ number_format($item->allocated, 2) }}</td>
                        <td class="text-right">{{ number_format($item->outstanding_balance, 2) }}</td>
                    </tr>
                @else
                    <tr>
                        <td>{{ $item->trans_type }}</td>
                        <td>{{ $item->number }}</td>
                        <td>{{ $item->date }}</td>
                        <td>{{ $item->due_date }}</td>
                        <td class="text-right">{{ number_format($item->debits, 2) }}</td>
                        <td class="text-right">{{ number_format($item->credits, 2) }}</td>
                        <td class="text-right">{{ number_format($item->allocated, 2) }}</td>
                        <td class="text-right">{{ number_format($item->outstanding_balance, 2) }}</td>
                    </tr>
                @endif
            @endforeach
        </tbody>
    </table>

    <div class="erp-footer">Generated on {{ date('Y-m-d H:i:s') }}</div>
</body>
</html>
