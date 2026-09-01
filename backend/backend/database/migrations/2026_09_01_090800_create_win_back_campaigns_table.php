<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('win_back_campaigns', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('debtor_no');
            $table->foreignId('offer_id')->nullable()->constrained('offers')->nullOnDelete();
            $table->enum('channel', ['sms', 'whatsapp'])->default('sms');
            $table->dateTime('sent_at');
            $table->boolean('redeemed')->default(false);
            $table->timestamps();

            $table->foreign('debtor_no')->references('debtor_no')->on('debtors_master')->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('win_back_campaigns');
    }
};
