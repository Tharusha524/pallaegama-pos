<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('debtors_master', function (Blueprint $table) {
            $table->string('mobile')->nullable()->after('address');
            $table->string('email')->nullable()->after('mobile');
            $table->date('date_of_birth')->nullable()->after('email');
            $table->date('last_purchase_date')->nullable()->after('date_of_birth');
        });
    }

    public function down(): void
    {
        Schema::table('debtors_master', function (Blueprint $table) {
            $table->dropColumn(['mobile', 'email', 'date_of_birth', 'last_purchase_date']);
        });
    }
};
