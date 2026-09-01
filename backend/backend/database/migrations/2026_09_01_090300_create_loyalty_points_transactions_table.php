<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('loyalty_points_transactions', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('debtor_no');
            $table->unsignedBigInteger('debtor_trans_no')->nullable();
            $table->integer('debtor_trans_type')->nullable();
            $table->decimal('points_earned', 15, 2)->default(0);
            $table->decimal('points_redeemed', 15, 2)->default(0);
            $table->decimal('balance_after', 15, 2)->default(0);
            $table->date('transaction_date');
            $table->timestamps();

            $table->foreign('debtor_no')->references('debtor_no')->on('debtors_master')->cascadeOnDelete();
            $table->index(['debtor_trans_no', 'debtor_trans_type'], 'lpt_debtor_trans_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('loyalty_points_transactions');
    }
};
