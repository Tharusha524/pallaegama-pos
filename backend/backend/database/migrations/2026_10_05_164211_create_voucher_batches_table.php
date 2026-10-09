<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('voucher_batches', function (Blueprint $table) {
            $table->id();
            $table->string('batch_code')->unique(); // e.g. GC-2026-001
            $table->integer('card_count');
            $table->decimal('face_value_each', 12, 2);
            $table->decimal('total_face_value', 12, 2);
            $table->date('expiry_date')->nullable();
            $table->string('note')->nullable();
            $table->string('created_by')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('voucher_batches');
    }
};
