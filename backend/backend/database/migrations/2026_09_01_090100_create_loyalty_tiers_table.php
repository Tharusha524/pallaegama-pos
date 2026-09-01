<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('loyalty_tiers', function (Blueprint $table) {
            $table->id();
            $table->string('tier_name');
            $table->decimal('min_spend_threshold', 15, 2)->default(0);
            $table->decimal('points_earn_rate', 10, 4)->default(0); // points earned per currency unit spent
            $table->decimal('redemption_rate', 10, 4)->default(0); // currency value per point
            $table->text('benefits_description')->nullable();
            $table->boolean('inactive')->default(false);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('loyalty_tiers');
    }
};
