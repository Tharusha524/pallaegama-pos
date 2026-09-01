<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('offers', function (Blueprint $table) {
            $table->string('coupon_code')->nullable()->unique()->after('offer_name');
            $table->unsignedInteger('max_total_uses')->nullable()->after('min_purchase_amount');
            $table->unsignedInteger('max_uses_per_customer')->nullable()->after('max_total_uses');
            $table->unsignedInteger('times_used')->default(0)->after('max_uses_per_customer');
        });
    }

    public function down(): void
    {
        Schema::table('offers', function (Blueprint $table) {
            $table->dropColumn(['coupon_code', 'max_total_uses', 'max_uses_per_customer', 'times_used']);
        });
    }
};
