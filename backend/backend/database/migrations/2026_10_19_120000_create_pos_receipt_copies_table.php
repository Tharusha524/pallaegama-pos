<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Exact copy of what each POS receipt showed when it was printed, so a
 * reprint is identical (cash received, change, cashier, MRP at the time...).
 * Display data only — separate from every accounting table.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('pos_receipt_copies')) {
            return;
        }
        Schema::create('pos_receipt_copies', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('trans_no')->unique();
            $table->longText('data');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('pos_receipt_copies');
    }
};
