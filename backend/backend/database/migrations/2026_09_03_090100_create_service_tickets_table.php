<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('service_tickets', function (Blueprint $table) {
            $table->id();
            $table->string('ticket_no')->unique();
            $table->unsignedBigInteger('debtor_no')->nullable();
            $table->string('item_description');
            $table->string('serial_no')->nullable();
            $table->text('issue_notes')->nullable();
            $table->enum('status', ['received', 'in_progress', 'ready_for_pickup', 'delivered'])->default('received');
            $table->date('received_date');
            $table->date('due_date')->nullable();
            $table->unsignedBigInteger('created_by')->nullable();
            $table->timestamps();

            $table->foreign('debtor_no')->references('debtor_no')->on('debtors_master')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('service_tickets');
    }
};
