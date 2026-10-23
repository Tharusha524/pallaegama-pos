<?php

namespace App\Console\Commands;

use App\Services\Inventory\StockBatchService;
use Illuminate\Console\Command;

/** One-time (safe to re-run): give all existing stock an opening batch at today's price / MRP. */
class OpenStockBatchesCommand extends Command
{
    protected $signature = 'stock-batches:open';

    protected $description = 'Create opening stock batches for all existing stock that has none';

    public function handle(StockBatchService $batches): int
    {
        $created = $batches->openAllExistingStock();
        $this->info("Opening batches created: {$created}");

        return self::SUCCESS;
    }
}
