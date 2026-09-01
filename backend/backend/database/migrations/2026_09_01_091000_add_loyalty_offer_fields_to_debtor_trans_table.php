<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('debtor_trans', function (Blueprint $table) {
            $table->decimal('loyalty_points_earned', 15, 2)->nullable()->after('ov_discount');
            $table->decimal('loyalty_points_redeemed', 15, 2)->nullable()->after('loyalty_points_earned');
            $table->unsignedBigInteger('applied_offer_id')->nullable()->after('loyalty_points_redeemed');
        });
    }

    public function down(): void
    {
        Schema::table('debtor_trans', function (Blueprint $table) {
            $table->dropColumn(['loyalty_points_earned', 'loyalty_points_redeemed', 'applied_offer_id']);
        });
    }
};
