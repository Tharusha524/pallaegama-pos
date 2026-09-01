<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('warranty_policies', function (Blueprint $table) {
            $table->id();
            $table->string('policy_name');
            $table->integer('period_value')->default(12);
            $table->enum('period_unit', ['days', 'months', 'years'])->default('months');
            $table->text('terms')->nullable();
            $table->timestamps();
        });

        Schema::create('warranties', function (Blueprint $table) {
            $table->id();
            $table->string('stock_id');
            $table->unsignedBigInteger('debtor_trans_no')->nullable();
            $table->integer('debtor_trans_type')->nullable();
            $table->foreignId('warranty_policy_id')->nullable()->constrained('warranty_policies')->nullOnDelete();
            $table->string('serial_no')->nullable();
            $table->date('warranty_start');
            $table->date('warranty_end');
            $table->enum('status', ['active', 'expired', 'voided'])->default('active');
            $table->timestamps();

            $table->foreign('stock_id')->references('stock_id')->on('stock_master')->cascadeOnDelete();
        });

        Schema::create('warranty_claims', function (Blueprint $table) {
            $table->id();
            $table->foreignId('warranty_id')->constrained('warranties')->cascadeOnDelete();
            $table->text('issue_description');
            $table->enum('status', ['open', 'in_progress', 'resolved', 'rejected'])->default('open');
            $table->text('resolution_notes')->nullable();
            $table->date('claim_date');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('warranty_claims');
        Schema::dropIfExists('warranties');
        Schema::dropIfExists('warranty_policies');
    }
};
