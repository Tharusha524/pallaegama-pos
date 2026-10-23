<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Link each damage record to the inventory adjustment (type 17) it posted,
 * so the damage reduces stock + records the loss in the accounts, and
 * deleting the record can post the matching reversal.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('stock_damages') && ! Schema::hasColumn('stock_damages', 'adjustment_trans_no')) {
            Schema::table('stock_damages', function (Blueprint $table) {
                $table->unsignedBigInteger('adjustment_trans_no')->nullable()->after('recorded_by');
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('stock_damages') && Schema::hasColumn('stock_damages', 'adjustment_trans_no')) {
            Schema::table('stock_damages', function (Blueprint $table) {
                $table->dropColumn('adjustment_trans_no');
            });
        }
    }
};
