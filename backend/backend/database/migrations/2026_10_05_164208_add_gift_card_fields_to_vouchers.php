<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('vouchers', function (Blueprint $table) {
            $table->unsignedBigInteger('batch_id')->nullable()->after('id');
            $table->string('activated_by')->nullable()->after('status');
            $table->date('activated_at')->nullable()->after('activated_by');
            $table->string('created_by')->nullable()->after('activated_at');
        });

        // Update existing 'redeemed' status to 'fully_used'
        DB::table('vouchers')->where('status', 'redeemed')->update(['status' => 'fully_used']);
        // Existing active vouchers with partial use → partially_used
        DB::table('vouchers')
            ->where('status', 'active')
            ->whereColumn('balance', '<', 'face_value')
            ->where('balance', '>', 0)
            ->update(['status' => 'partially_used']);

        // Add cashier to redemptions
        Schema::table('voucher_redemptions', function (Blueprint $table) {
            $table->string('cashier')->nullable()->after('redeemed_at');
            $table->string('note')->nullable()->after('cashier');
        });
    }

    public function down(): void
    {
        Schema::table('vouchers', function (Blueprint $table) {
            $table->dropColumn(['batch_id', 'activated_by', 'activated_at', 'created_by']);
        });
        Schema::table('voucher_redemptions', function (Blueprint $table) {
            $table->dropColumn(['cashier', 'note']);
        });
    }
};
