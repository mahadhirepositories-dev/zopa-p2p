<?php
header('Content-Type: text/plain');

require __DIR__ . '/../vendor/autoload.php';
$app = require_once __DIR__ . '/../bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use Illuminate\Support\Facades\Validator;

$rules = [
    'name'           => 'required|string|max:255',
    'unit'           => 'required|string|max:30',
    'net_rate'       => 'required|numeric|min:0',
    'gst_rate'       => 'required|numeric|min:0|max:100',
    'description'    => 'nullable|string',
    'category_id'    => 'nullable|integer|exists:categories,id',
    'subcategory_id' => 'nullable|integer|exists:categories,id',
    'mrp'            => 'nullable|numeric|min:0',
    'sale_price'     => 'nullable|numeric|min:0',
];

$data = [
    'name' => 'Bed Side Unit - Wired/6M Germ-inhibiting membrane keypad with Nurse',
    'description' => 'Bed Side Unit - Wired/6M Germ-inhibiting membrane keypad with Nurse Call, Code Blue, Housekeeping, and Extra Support',
    'category_id' => 85,
    'subcategory_id' => 86,
    'unit' => 'Nos',
    'warranty_months' => 3,
    'net_rate' => 0,
    'gst_rate' => 18,
    'hsn_code' => '9018',
    'code' => 'ZOPA003',
];

$validator = Validator::make($data, $rules);
if ($validator->fails()) {
    echo "VALIDATION FAILED:\n";
    print_r($validator->errors()->toArray());
} else {
    echo "VALIDATION PASSED!\n";
}
