<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * The already-built Sales Quotation feature (QuotationController /
 * SalesQuotationBridgeService, trans_type 32) was completely unusable —
 * every request failed validation because `trans_types` had no row for
 * type 32, even though FrontAccounting's own standard reserves 32 for
 * ST_SALESQUOTE. Pure reference/master data, no accounting logic changed.
 */
return new class extends Migration
{
    public function up(): void
    {
        DB::table('trans_types')->updateOrInsert(
            ['trans_type' => 32],
            ['description' => 'Sales Quotation', 'created_at' => now(), 'updated_at' => now()]
        );
    }

    public function down(): void
    {
        DB::table('trans_types')->where('trans_type', 32)->delete();
    }
};
