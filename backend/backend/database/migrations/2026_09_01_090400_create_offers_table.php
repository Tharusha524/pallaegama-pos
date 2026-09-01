<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('offers', function (Blueprint $table) {
            $table->id();
            $table->string('offer_name');
            $table->enum('offer_type', ['product', 'category', 'tier', 'customer'])->default('product');
            $table->string('target_id')->nullable(); // stock_id / category_id / loyalty_tier_id / debtor_no depending on offer_type
            $table->enum('discount_type', ['percent', 'fixed'])->default('percent');
            $table->decimal('discount_value', 15, 2)->default(0);
            $table->date('valid_from');
            $table->date('valid_to');
            $table->decimal('min_purchase_amount', 15, 2)->default(0);
            $table->enum('status', ['active', 'inactive'])->default('active');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('offers');
    }
};
