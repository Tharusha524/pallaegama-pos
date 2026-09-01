<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('item_variants', function (Blueprint $table) {
            $table->id();
            $table->string('stock_id');
            $table->string('variant_name'); // e.g. "Red / L"
            $table->string('sku')->nullable();
            $table->string('barcode')->nullable()->unique();
            $table->decimal('price_adjustment', 15, 2)->default(0); // added to base item price
            $table->boolean('inactive')->default(false);
            $table->timestamps();

            $table->foreign('stock_id')->references('stock_id')->on('stock_master')->cascadeOnDelete();
        });

        Schema::create('variant_stock', function (Blueprint $table) {
            $table->id();
            $table->foreignId('item_variant_id')->constrained('item_variants')->cascadeOnDelete();
            $table->string('loc_code');
            $table->decimal('quantity', 15, 2)->default(0);
            $table->timestamps();

            $table->unique(['item_variant_id', 'loc_code']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('variant_stock');
        Schema::dropIfExists('item_variants');
    }
};
