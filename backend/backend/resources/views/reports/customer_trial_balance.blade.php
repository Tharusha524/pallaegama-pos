<!DOCTYPE html>
<html>
<head>
    <title>{{ $title }}</title>
    @include('reports.partials.pdf_common_styles')
    <style>
        .total-row { font-weight: bold; background-color: #eee; }
    </style>
</head>
<body>
    @include('reports.partials.report_header', [
        'companyHeader' => $companyHeader ?? [],
        'title' => $title,
        'subtitle' => 'From: ' . ($startDate ?? '') . ' To: ' . ($endDate ?? '') . ' | Currency: ' . ($currency ?? 'All'),
    ])

    <table class="erp-data-table" border="1" cellpadding="0" cellspacing="0" width="100%">
        <thead>
            <tr>
                <th>Name</th>
                <th class="text-right">Open Balance</th>
                <th class="text-right">Debit</th>
                <th class="text-right">Credit</th>
                <th class="text-right">Balance</th>
            </tr>
        </thead>
        <tbody>
            @php
                $total_open = 0; $total_debits = 0; $total_credits = 0; $total_closing = 0;
            @endphp
            @foreach($data as $index => $item)
                <tr @if($index % 2 === 1) class="erp-row-alt" @endif>
                    <td>{{ $item->name }}</td>
                    <td class="text-right">{{ number_format($item->opening_balance, 2) }}</td>
                    <td class="text-right">{{ number_format($item->debits, 2) }}</td>
                    <td class="text-right">{{ number_format($item->credits, 2) }}</td>
                    <td class="text-right">{{ number_format($item->closing_balance, 2) }}</td>
                </tr>
                @php
                    $total_open += $item->opening_balance;
                    $total_debits += $item->debits;
                    $total_credits += $item->credits;
                    $total_closing += $item->closing_balance;
                @endphp
            @endforeach
        </tbody>
        <tfoot>
            <tr class="total-row">
                <td>Grand Total</td>
                <td class="text-right">{{ number_format($total_open, 2) }}</td>
                <td class="text-right">{{ number_format($total_debits, 2) }}</td>
                <td class="text-right">{{ number_format($total_credits, 2) }}</td>
                <td class="text-right">{{ number_format($total_closing, 2) }}</td>
            </tr>
        </tfoot>
    </table>

    <div class="erp-footer">
        Generated on {{ date('Y-m-d H:i:s') }}
    </div>
</body>
</html>
