<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Held/parked POS carts — informational only, never touches accounting
        // until the cashier recalls and completes the sale via the normal
        // directInvoice flow. No GL/stock impact while parked.
        Schema::create('held_sales', function (Blueprint $table) {
            $table->id();
            $table->string('hold_reference')->unique();
            $table->unsignedBigInteger('user_id');
            $table->unsignedBigInteger('debtor_no')->nullable();
            $table->json('cart_snapshot'); // lines, customer, branch, loc, tender state
            $table->timestamps();

            $table->foreign('debtor_no')->references('debtor_no')->on('debtors_master')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('held_sales');
    }
};
