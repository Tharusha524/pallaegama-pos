<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('stock_damages', function (Blueprint $table) {
            $table->id();
            $table->string('stock_id');
            $table->string('loc_code')->nullable();
            $table->decimal('quantity', 15, 2);
            $table->string('reason')->nullable();
            $table->date('damage_date');
            $table->unsignedBigInteger('recorded_by')->nullable();
            $table->timestamps();

            $table->foreign('stock_id')->references('stock_id')->on('stock_master')->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('stock_damages');
    }
};
