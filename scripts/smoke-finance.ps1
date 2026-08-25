$ErrorActionPreference='Stop';$base='http://localhost:3000/v1';$stamp=[DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
function J($v) {
    $v | ConvertTo-Json -Depth 10 -Compress
}

function AuthHeaders($token) {
    @{
        Authorization = "Bearer $token"
        'Content-Type' = 'application/json'
    }
}
Write-Host '1/9 Create sender and driver'
$s=Invoke-RestMethod -Method Post -Uri "$base/auth/register" -ContentType 'application/json' -Body (J @{email="fin-s+$stamp@cargogo.test";password='CargoGoTest123';displayName='Finance Sender'})
$d=Invoke-RestMethod -Method Post -Uri "$base/auth/register" -ContentType 'application/json' -Body (J @{email="fin-d+$stamp@cargogo.test";password='CargoGoTest123';displayName='Finance Driver'})
Write-Host '2/9 Configure encrypted payout IBAN'
$pa=Invoke-RestMethod -Method Post -Uri "$base/payout-accounts/me" -Headers (AuthHeaders  $d.session.accessToken) -Body (J @{holderName='Finance Driver';iban='UA123456789012345678901234567'})
if($pa.maskedIban -notmatch '4567$'){throw 'Masked payout account not returned'}
Write-Host '3/9 Create cargo 1000 UAH and trip'
$c=Invoke-RestMethod -Method Post -Uri "$base/cargo" -Headers (AuthHeaders  $s.session.accessToken) -Body (J @{title='Finance cargo';rewardMinor=100000;currency='UAH';pickup=@{countryCode='UA';cityId='dnipro';street='Test Street 1'};delivery=@{countryCode='UA';cityId='kyiv';street='Test Street 2'}})
Invoke-RestMethod -Method Post -Uri "$base/cargo/$($c.id)/publish" -Headers (AuthHeaders  $s.session.accessToken)|Out-Null
$v=Invoke-RestMethod -Method Post -Uri "$base/vehicles" -Headers (AuthHeaders  $d.session.accessToken) -Body (J @{label='Finance Car';bodyType='wagon';maxPayloadKg=100;clientReference="finance-$stamp"})
$t=Invoke-RestMethod -Method Post -Uri "$base/trips" -Headers (AuthHeaders  $d.session.accessToken) -Body (J @{vehicleId=$v.id;origin=@{countryCode='UA';cityId='dnipro';street='Test Street 1'};destination=@{countryCode='UA';cityId='kyiv';street='Test Street 2'};departureInMinutes=180;maxDetourKm=20;capacityKg=100})
Write-Host '4/9 Offer and accept: economics snapshot'
$o=Invoke-RestMethod -Method Post -Uri "$base/offers" -Headers (AuthHeaders  $d.session.accessToken) -Body (J @{cargoId=$c.id;tripId=$t.id;amountMinor=100000;currency='UAH'})
$deal=Invoke-RestMethod -Method Post -Uri "$base/deals/accept-offer" -Headers (AuthHeaders  $s.session.accessToken) -Body (J @{offerId=$o.id})
if($deal.platformFeeMinor-ne 3100 -or $deal.carrierAmountMinor-ne 96900){throw "Expected 31/969 UAH split, got $($deal.platformFeeMinor)/$($deal.carrierAmountMinor)"}
if($deal.targetNetMarginMinor-ne 1500 -or $deal.estimatedAcquiringFeeMinor-ne 1300 -or $deal.estimatedPayoutFeeMinor-ne 300){throw 'Economics estimate snapshot is wrong'}
Write-Host '5/9 Secure mock hold'
$deal=Invoke-RestMethod -Method Post -Uri "$base/deals/$($deal.id)/dev/secure-payment" -Headers (AuthHeaders  $s.session.accessToken)
$pickup=[string]$deal.codes.pickup
Write-Host '6/9 Pickup/transit/arrival'
Invoke-RestMethod -Method Post -Uri "$base/deals/$($deal.id)/pickup/confirm" -Headers (AuthHeaders  $d.session.accessToken) -Body (J @{code=$pickup})|Out-Null
Invoke-RestMethod -Method Post -Uri "$base/deals/$($deal.id)/transit/start" -Headers (AuthHeaders  $d.session.accessToken)|Out-Null
Invoke-RestMethod -Method Post -Uri "$base/deals/$($deal.id)/arrive" -Headers (AuthHeaders  $d.session.accessToken)|Out-Null
$sd=Invoke-RestMethod -Method Get -Uri "$base/deals/$($deal.id)" -Headers (AuthHeaders  $s.session.accessToken);$delivery=[string]$sd.codes.delivery
Write-Host '7/9 Confirm delivery -> automatic capture -> payout'
$final=Invoke-RestMethod -Method Post -Uri "$base/deals/$($deal.id)/delivery/confirm" -Headers (AuthHeaders  $d.session.accessToken) -Body (J @{code=$delivery})
if($final.status-ne 'completed' -or $final.paymentStatus-ne 'released'){throw 'Settlement did not complete'}
if($final.payoutStatus-ne 'paid' -or $final.settlementStatus-ne 'settled'){throw 'Payout did not complete'}
Write-Host '8/9 Assert real net economics'
if($final.actualAcquiringFeeMinor-ne 1300){throw "Expected acquiring cost 13.00 UAH, got $($final.actualAcquiringFeeMinor)"}
if($final.actualPayoutFeeMinor-ne 291){throw "Expected payout cost 2.91 UAH, got $($final.actualPayoutFeeMinor)"}
if($final.platformNetRevenueMinor-ne 1509){throw "Expected CargoGo net 15.09 UAH, got $($final.platformNetRevenueMinor)"}
if($final.actualNetMarginBps-ne 150){throw "Expected actual net margin floor 150 bps, got $($final.actualNetMarginBps)"}
Write-Host '9/9 PASS: 1000 -> 969 carrier, 15.09 CargoGo net after simulated costs'
Write-Host "PASS FINANCE ECONOMICS: deal=$($deal.id) net=$($final.platformNetRevenueMinor) minor" -ForegroundColor Green

