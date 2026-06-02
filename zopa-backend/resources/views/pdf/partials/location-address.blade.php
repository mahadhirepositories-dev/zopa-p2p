{{-- Full location address block. Prints every Org-Master location field EXCEPT
     State Code. Expects $loc (a Location). The caller renders the name + styling. --}}
@php
    $cityState = collect([$loc->city ?? null, $loc->state ?? null])->filter()->implode(', ');
    $line2 = $cityState;
    if (!empty($loc->pincode)) {
        $line2 = $line2 !== '' ? $line2 . ' - ' . $loc->pincode : (string) $loc->pincode;
    }
@endphp
@if(!empty($loc->address))<div>{{ $loc->address }}</div>@endif
@if($line2 !== '')<div>{{ $line2 }}</div>@endif
@if(!empty($loc->country))<div>{{ $loc->country }}</div>@endif
@if(!empty($loc->gstin))<div>GSTIN: {{ $loc->gstin }}</div>@endif
