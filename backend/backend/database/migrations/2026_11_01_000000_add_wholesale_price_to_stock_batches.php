<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/** Each batch's own wholesale price (null = this batch has none). No accounting impact. */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('stock_batches') && ! Schema::hasColumn('stock_batches', 'wholesale_price')) {
            Schema::table('stock_batches', function (Blueprint $table) {
                $table->decimal('wholesale_price', 15, 4)->nullable()->after('selling_price');
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('stock_batches', 'wholesale_price')) {
            Schema::table('stock_batches', function (Blueprint $table) {
                $table->dropColumn('wholesale_price');
            });
        }
    }
};
