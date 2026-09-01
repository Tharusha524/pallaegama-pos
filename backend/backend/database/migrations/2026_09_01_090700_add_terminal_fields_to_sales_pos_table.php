<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('sales_pos', function (Blueprint $table) {
            $table->string('printer_name')->nullable()->after('pos_account');
            $table->boolean('cash_drawer_trigger')->default(false)->after('printer_name');
            $table->decimal('default_float_amount', 15, 2)->default(0)->after('cash_drawer_trigger');
        });
    }

    public function down(): void
    {
        Schema::table('sales_pos', function (Blueprint $table) {
            $table->dropColumn(['printer_name', 'cash_drawer_trigger', 'default_float_amount']);
        });
    }
};
