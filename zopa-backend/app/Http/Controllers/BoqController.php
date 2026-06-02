<?php

namespace App\Http\Controllers;

use App\Exports\BoqTemplateExport;
use App\Imports\BoqImport;
use App\Traits\AuthorizesRoles;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Maatwebsite\Excel\Facades\Excel;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

/**
 * Bill-of-Quantities (line item) bulk upload for PO and PR creation.
 * template() downloads the Excel template; parse() returns normalized line
 * items (NOT persisted) for the creation form to populate.
 */
class BoqController extends Controller
{
    use AuthorizesRoles;

    public function template(Request $request): BinaryFileResponse
    {
        $type = $request->query('type') === 'pr' ? 'pr' : 'po';
        $name = $type === 'pr' ? 'pr-boq-template.xlsx' : 'po-boq-template.xlsx';

        return Excel::download(new BoqTemplateExport($type), $name);
    }

    public function parse(Request $request): JsonResponse
    {
        $this->requireTransactRole();
        $request->validate([
            'file' => 'required|file|mimes:xlsx,xls,csv|max:5120',
            'type' => 'nullable|in:po,pr',
        ]);

        $type   = $request->input('type') === 'pr' ? 'pr' : 'po';
        $import = new BoqImport($type);
        Excel::import($import, $request->file('file'));

        return response()->json([
            'items'  => $import->items,
            'errors' => $import->errors,
        ]);
    }
}
