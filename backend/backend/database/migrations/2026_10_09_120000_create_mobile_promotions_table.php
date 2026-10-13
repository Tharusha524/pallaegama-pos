<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Display-only promotions for the customer mobile app. Separate from
        // the `offers` table on purpose: nothing here affects POS pricing.
        Schema::create('mobile_promotions', function (Blueprint $table) {
            $table->id();
            $table->string('title');
            $table->text('description')->nullable();
            $table->string('promo_type', 20)->default('promotion');
            $table->string('discount_type', 10)->nullable();
            $table->decimal('discount_value', 12, 2)->nullable();
            $table->date('valid_from');
            $table->date('valid_to');
            $table->string('image_path')->nullable();
            $table->boolean('is_active')->default(true);
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamp('sms_sent_at')->nullable();
            $table->unsignedInteger('sms_sent_count')->default(0);
            $table->timestamps();

            $table->index(['is_active', 'valid_from', 'valid_to']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('mobile_promotions');
    }
};
