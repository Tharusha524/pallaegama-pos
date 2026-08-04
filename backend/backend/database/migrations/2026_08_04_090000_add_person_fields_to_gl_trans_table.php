<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * Adds the counterparty (customer/supplier) reference to gl_trans so
     * individual journal lines posted to a control account (Trade Debtors /
     * Trade Creditors) can be tied to a specific debtor or creditor.
     * person_type_id follows the existing convention used elsewhere in the
     * app (2 = customer/debtor, 3 = supplier/creditor).
     */
    public function up(): void
    {
        if (! Schema::hasTable('gl_trans')) {
            return;
        }

        Schema::table('gl_trans', function (Blueprint $table) {
            if (! Schema::hasColumn('gl_trans', 'person_type_id')) {
                $table->unsignedInteger('person_type_id')->nullable();
            }
            if (! Schema::hasColumn('gl_trans', 'person_id')) {
                $table->unsignedBigInteger('person_id')->nullable();
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (! Schema::hasTable('gl_trans')) {
            return;
        }

        Schema::table('gl_trans', function (Blueprint $table) {
            foreach (['person_type_id', 'person_id'] as $col) {
                if (Schema::hasColumn('gl_trans', $col)) {
                    $table->dropColumn($col);
                }
            }
        });
    }
};
