<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('stock_master', function (Blueprint $table) {
            $table->dropForeign(['tax_type_id']);
        });

        Schema::table('stock_master', function (Blueprint $table) {
            $table->unsignedBigInteger('tax_type_id')->nullable()->change();
            $table->foreign('tax_type_id')->references('id')->on('item_tax_types')->nullOnDelete();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('stock_master', function (Blueprint $table) {
            $table->dropForeign(['tax_type_id']);
        });

        Schema::table('stock_master', function (Blueprint $table) {
            $table->unsignedBigInteger('tax_type_id')->nullable(false)->change();
            $table->foreign('tax_type_id')->references('id')->on('item_tax_types')->onDelete('cascade');
        });
    }
};
