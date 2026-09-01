<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('vouchers', function (Blueprint $table) {
            $table->id();
            $table->string('voucher_code')->unique();
            $table->unsignedBigInteger('debtor_no')->nullable();
            $table->decimal('face_value', 15, 2);
            $table->decimal('balance', 15, 2);
            $table->date('issue_date');
            $table->date('expiry_date')->nullable();
            $table->text('note')->nullable();
            $table->enum('status', ['active', 'redeemed', 'expired', 'cancelled'])->default('active');
            $table->timestamps();

            $table->foreign('debtor_no')->references('debtor_no')->on('debtors_master')->nullOnDelete();
        });

        Schema::create('voucher_redemptions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('voucher_id')->constrained('vouchers')->cascadeOnDelete();
            $table->unsignedBigInteger('debtor_trans_no')->nullable();
            $table->integer('debtor_trans_type')->nullable();
            $table->decimal('amount_used', 15, 2);
            $table->date('redeemed_at');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('voucher_redemptions');
        Schema::dropIfExists('vouchers');
    }
};
