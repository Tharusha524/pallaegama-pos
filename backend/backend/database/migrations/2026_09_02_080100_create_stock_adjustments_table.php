<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('stock_adjustments', function (Blueprint $table) {
            $table->id();
            $table->string('stock_id');
            $table->string('loc_code');
            $table->enum('movement_type', ['add', 'reduce', 'override'])->default('add');
            $table->decimal('quantity_before', 15, 2);
            $table->decimal('quantity_moved', 15, 2);
            $table->decimal('quantity_after', 15, 2);
            $table->string('reason')->nullable(); // waste/damage/general/count-correction/etc
            $table->text('notes')->nullable();
            $table->unsignedBigInteger('recorded_by')->nullable();
            $table->timestamps();

            $table->foreign('stock_id')->references('stock_id')->on('stock_master')->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('stock_adjustments');
    }
};
