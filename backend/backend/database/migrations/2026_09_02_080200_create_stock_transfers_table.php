<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('stock_transfers', function (Blueprint $table) {
            $table->id();
            $table->string('transfer_ref')->unique();
            $table->string('from_loc_code');
            $table->string('to_loc_code');
            $table->enum('status', ['pending', 'dispatched', 'received', 'cancelled'])->default('pending');
            $table->unsignedBigInteger('created_by')->nullable();
            $table->timestamp('dispatched_at')->nullable();
            $table->timestamp('received_at')->nullable();
            $table->timestamps();
        });

        Schema::create('stock_transfer_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('stock_transfer_id')->constrained('stock_transfers')->cascadeOnDelete();
            $table->string('stock_id');
            $table->decimal('quantity', 15, 2);
            $table->timestamps();

            $table->foreign('stock_id')->references('stock_id')->on('stock_master')->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('stock_transfer_items');
        Schema::dropIfExists('stock_transfers');
    }
};
