<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('offer_redemptions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('offer_id')->constrained('offers')->cascadeOnDelete();
            $table->unsignedBigInteger('debtor_no')->nullable();
            $table->unsignedBigInteger('debtor_trans_no')->nullable();
            $table->integer('debtor_trans_type')->nullable();
            $table->decimal('discount_amount', 15, 2)->default(0);
            $table->date('redeemed_at');
            $table->timestamps();

            $table->foreign('debtor_no')->references('debtor_no')->on('debtors_master')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('offer_redemptions');
    }
};
