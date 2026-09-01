<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('loyalty_cards', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('debtor_no');
            $table->string('card_no')->unique();
            $table->date('issue_date');
            $table->foreignId('loyalty_tier_id')->nullable()->constrained('loyalty_tiers')->nullOnDelete();
            $table->decimal('points_balance', 15, 2)->default(0);
            $table->enum('status', ['active', 'blocked'])->default('active');
            $table->timestamps();

            $table->foreign('debtor_no')->references('debtor_no')->on('debtors_master')->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('loyalty_cards');
    }
};
