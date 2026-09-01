<!DOCTYPE html>
<html>
<head>
    <title>{{ $title }}</title>
    @include('reports.partials.pdf_common_styles')
    <style>
        /* Custom stacked header for this report (Print Out Date / Fiscal Year / Period) */
        table.erp-pl-header { width: 100%; border-collapse: collapse; margin-bottom: 6px; }
        table.erp-pl-header td { border: none; padding: 0; vertical-align: top; }
        .erp-pl-title { font-size: 16px; font-weight: bold; color: #0b1f44; margin: 0 0 4px 0; }
        .erp-pl-logo { width: 46px; }
        .erp-pl-logo img { width: 40px; height: 40px; }
        .erp-pl-company-name { font-size: 12px; font-weight: bold; color: #0f172a; margin: 0 0 2px 0; }
        .erp-pl-meta { font-size: 8px; color: #475569; margin: 0; }
        .erp-pl-params { font-size: 8px; color: #1e293b; text-align: left; }
        .erp-pl-params .label { display: inline-block; width: 85px; font-weight: bold; }
        .erp-pl-page { font-size: 8px; color: #475569; text-align: right; }
        hr.erp-pl-rule { border: none; border-top: 1px solid #0b1f44; margin: 4px 0 6px 0; }

        /* Plain, minimalist row styling (overrides the boxed/colored bar style used elsewhere) */
        table.erp-data-table tr.erp-section-row td {
            background-color: #ffffff;
            color: #0b1f44;
            border: none;
            border-bottom: 1px solid #0b1f44;
            font-size: 9px;
            padding: 5px 2px 2px 2px;
        }
        table.erp-data-table tr.erp-group-row td {
            background-color: #ffffff;
            color: #1e293b;
            border: none;
            font-size: 8px;
            padding: 4px 2px 2px 2px;
        }
        table.erp-data-table tr.erp-subtotal-row td {
            background-color: #ffffff;
            border: none;
            border-top: 1px solid #cbd5e1;
            font-size: 8px;
        }
        table.erp-data-table tr.erp-grand-row td {
            background-color: #ffffff;
            border: none;
            border-top: 1px solid #0f172a;
            border-bottom: 1px solid #0f172a;
            font-size: 8.5px;
        }
        table.erp-data-table tr.erp-calculated-return-row td {
            background-color: #ffffff;
            font-weight: bold;
            border-top: 2px solid #0b1f44;
            border-bottom: 2px solid #0b1f44;
        }
        table.erp-data-table th {
            background-color: #ffffff;
            color: #0b1f44;
            border: none;
            border-bottom: 1px solid #0b1f44;
        }
        table.erp-data-table td {
            border: none;
        }
    </style>
</head>
<body>
    @php
        $company = $companyHeader ?? [];
        $fy = $fiscalYear ?? [];
        $printOutDate = $company['report_generated_at'] ?? date('d/m/Y H:i');
    @endphp

    <table class="erp-pl-header">
        <tr>
            @if(!empty($company['show_logo']) && !empty($company['logo_path']))
                <td class="erp-pl-logo"><img src="{{ $company['logo_path'] }}" alt="" /></td>
            @endif
            <td>
                <div class="erp-pl-company-name">{{ $company['name'] ?? '' }}</div>
                @if(!empty($company['address']))
                    <div class="erp-pl-meta">{!! nl2br(e($company['address'])) !!}</div>
                @endif
                @if(!empty($company['phone_number']) || !empty($company['email_address']))
                    <div class="erp-pl-meta">
                        @if(!empty($company['phone_number']))Tel: {{ $company['phone_number'] }}@endif
                        @if(!empty($company['email_address'])) | {{ $company['email_address'] }}@endif
                    </div>
                @endif
            </td>
            <td width="42%" style="text-align:right;">
                <div class="erp-pl-title">{{ $title }}</div>
            </td>
        </tr>
    </table>
    <hr class="erp-pl-rule" />

    <table class="erp-pl-header">
        <tr>
            <td class="erp-pl-params">
                <div><span class="label">Print Out Date:</span> {{ $printOutDate }}</div>
                @if(!empty($fy['from_display']) && !empty($fy['to_display']))
                    <div><span class="label">Fiscal Year:</span> {{ $fy['from_display'] }} - {{ $fy['to_display'] }} @if(!empty($fy['active'])) (Active) @endif</div>
                @endif
                @if(!empty($periodDisplay))
                    <div><span class="label">Period:</span> {{ $periodDisplay }}</div>
                @endif
            </td>
            <td width="20%" class="erp-pl-page">Page @{{:pnp:}}</td>
        </tr>
    </table>

    @php
        $fmt = fn ($n) => number_format((float) $n, 2, '.', ',');
        $achieve = function (float $period, float $compare) {
            if (abs($compare) < 0.001) return '999.0';
            return number_format(($period / $compare) * 100, 1, '.', ',');
        };
        $compareLabel = $compareLabel ?? 'Accumulated';
        $statement = $statement ?? [];
        $sections = $statement['detailedSections'] ?? [];
        $detailedSummary = $statement['detailedSummary'] ?? [];
        $calculatedReturn = $detailedSummary['calculatedReturn'] ?? ['period' => 0, 'compare' => 0, 'achievePercent' => '999.0'];
    @endphp

    @if(empty($sections))
        <div class="erp-empty">No profit and loss activity for the selected period.</div>
    @else
        <table class="erp-data-table" cellpadding="0" cellspacing="0" width="100%">
            <thead>
                <tr>
                    <th class="account-code" width="12%">Account</th>
                    <th class="account-name" width="34%">Account Name</th>
                    <th class="text-right" width="16%">Period</th>
                    <th class="text-right" width="16%">{{ $compareLabel }}</th>
                    <th class="text-right" width="12%">Achieved %</th>
                </tr>
            </thead>
            <tbody>
                @foreach($sections as $section)
                    <tr class="erp-section-row">
                        <td colspan="5">{{ strtoupper($section['title'] ?? '') }}</td>
                    </tr>

                    @foreach($section['lines'] ?? [] as $line)
                        @php $kind = $line['kind'] ?? 'account'; @endphp
                        @if($kind === 'group')
                            <tr class="erp-group-row"><td colspan="5">{{ $line['label'] ?? '' }}</td></tr>
                        @elseif($kind === 'account')
                            <tr>
                                <td class="account-code">{{ $line['account_code'] ?? '' }}</td>
                                <td class="account-name">{{ $line['label'] ?? '' }}</td>
                                <td class="text-right">{{ $fmt($line['period'] ?? 0) }}</td>
                                <td class="text-right">{{ $fmt($line['compareValue'] ?? 0) }}</td>
                                <td class="text-right">{{ $line['achievePercent'] ?? $achieve((float) ($line['period'] ?? 0), (float) ($line['compareValue'] ?? 0)) }}</td>
                            </tr>
                        @elseif($kind === 'subtotal')
                            <tr class="erp-subtotal-row">
                                <td colspan="2">{{ $line['label'] ?? '' }}</td>
                                <td class="text-right">{{ $fmt($line['period'] ?? 0) }}</td>
                                <td class="text-right">{{ $fmt($line['compareValue'] ?? 0) }}</td>
                                <td class="text-right">{{ $line['achievePercent'] ?? $achieve((float) ($line['period'] ?? 0), (float) ($line['compareValue'] ?? 0)) }}</td>
                            </tr>
                        @endif
                    @endforeach

                    @foreach($section['subtotals'] ?? [] as $subtotal)
                        <tr class="erp-grand-row">
                            <td colspan="2">Total {{ strtoupper($section['title'] ?? '') }}</td>
                            <td class="text-right">{{ $fmt($subtotal['period'] ?? 0) }}</td>
                            <td class="text-right">{{ $fmt($subtotal['compareValue'] ?? 0) }}</td>
                            <td class="text-right">{{ $subtotal['achievePercent'] ?? $achieve((float) ($subtotal['period'] ?? 0), (float) ($subtotal['compareValue'] ?? 0)) }}</td>
                        </tr>
                    @endforeach
                @endforeach

                <tr class="erp-calculated-return-row">
                    <td colspan="2">Calculated Return</td>
                    <td class="text-right">{{ $fmt($calculatedReturn['period'] ?? 0) }}</td>
                    <td class="text-right">{{ $fmt($calculatedReturn['compare'] ?? 0) }}</td>
                    <td class="text-right">{{ $calculatedReturn['achievePercent'] ?? '999.0' }}</td>
                </tr>
            </tbody>
        </table>
    @endif
</body>
</html>
