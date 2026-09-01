<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('pos_shifts', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('user_id');
            $table->unsignedInteger('sales_pos_id')->nullable();
            $table->decimal('opening_float', 15, 2)->default(0);
            $table->decimal('closing_expected', 15, 2)->nullable();
            $table->decimal('closing_counted', 15, 2)->nullable();
            $table->decimal('variance', 15, 2)->nullable();
            $table->dateTime('shift_start');
            $table->dateTime('shift_end')->nullable();
            $table->enum('status', ['open', 'closed'])->default('open');
            $table->text('notes')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('pos_shifts');
    }
};
