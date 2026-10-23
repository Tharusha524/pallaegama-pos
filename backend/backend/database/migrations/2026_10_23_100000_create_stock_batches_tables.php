<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Stock batches: each delivery of a product (same barcode) with its own
 * purchase cost, selling price and MRP, and how many units remain.
 *
 * Purely additive — no existing table is altered. loc_stock stays the
 * source of truth for total quantity (sum of a product/location's batches
 * always equals its loc_stock quantity), and accounting keeps using the
 * weighted average cost in stock_master.material_cost.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('stock_batches')) {
            Schema::create('stock_batches', function (Blueprint $table) {
                $table->id();
                $table->string('stock_id', 50);
                $table->string('loc_code', 20);
                // opening | grn | adjustment | transfer | return | audit
                $table->string('source_type', 20)->default('opening');
                $table->unsignedBigInteger('source_no')->nullable();
                $table->decimal('purchase_cost', 15, 4)->default(0);
                $table->decimal('selling_price', 15, 4)->default(0);
                $table->decimal('mrp', 15, 4)->nullable();
                $table->decimal('qty_received', 15, 4)->default(0);
                $table->decimal('qty_remaining', 15, 4)->default(0);
                // active | finished (sold out) | inactive (hidden by staff)
                $table->string('status', 20)->default('active');
                $table->date('received_date')->nullable();
                $table->timestamps();

                $table->index(['stock_id', 'loc_code', 'status']);
                $table->index(['source_type', 'source_no']);
            });
        }

        if (! Schema::hasTable('stock_batch_movements')) {
            Schema::create('stock_batch_movements', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('batch_id');
                $table->string('stock_id', 50);
                $table->string('loc_code', 20);
                $table->decimal('qty', 15, 4);
                // stock_moves-style transaction type/no that caused it (13 = delivery, 25 = GRN, ...)
                $table->integer('trans_type')->nullable();
                $table->unsignedBigInteger('trans_no')->nullable();
                $table->string('note', 100)->nullable();
                $table->timestamp('created_at')->nullable();

                $table->index('batch_id');
                $table->index(['trans_type', 'trans_no', 'stock_id']);
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('stock_batch_movements');
        Schema::dropIfExists('stock_batches');
    }
};
