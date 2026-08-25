$ErrorActionPreference='Stop'
$base='http://localhost:3000/v1';$stamp=[DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
function Json($v){$v|ConvertTo-Json -Depth 10 -Compress};function H($t){@{Authorization="Bearer $t";'Content-Type'='application/json'}}
Write-Host '1/11 Register sender and start verification'
$s=Invoke-RestMethod -Method Post -Uri "$base/auth/register" -ContentType 'application/json' -Body (Json @{email="trust-s+$stamp@cargogo.test";password='CargoGoTest123';displayName='Trust Sender'})
Invoke-RestMethod -Method Post -Uri "$base/verification/start" -Headers (H $s.session.accessToken) -Body (Json @{documentKind='id_card'})|Out-Null
$v=Invoke-RestMethod -Method Post -Uri "$base/verification/dev/resolve" -Headers (H $s.session.accessToken) -Body (Json @{status='verified'})
if($v.status -ne 'verified'){throw 'Verification dev resolve failed'}
Write-Host '2/11 Create cargo'
$c=Invoke-RestMethod -Method Post -Uri "$base/cargo" -Headers (H $s.session.accessToken) -Body (Json @{title='Trust cargo';weightKg=5;rewardMinor=50000;currency='UAH';fragile=$true;pickup=@{countryCode='UA';cityId='dnipro';street='Private A'};delivery=@{countryCode='UA';cityId='kyiv';street='Private B'}})
Invoke-RestMethod -Method Post -Uri "$base/cargo/$($c.id)/publish" -Headers (H $s.session.accessToken)|Out-Null
Write-Host '3/11 Register driver and trip'
$d=Invoke-RestMethod -Method Post -Uri "$base/auth/register" -ContentType 'application/json' -Body (Json @{email="trust-d+$stamp@cargogo.test";password='CargoGoTest123';displayName='Trust Driver'})
Invoke-RestMethod -Method Post -Uri "$base/payout-accounts/me" -Headers (H $d.session.accessToken) -Body (Json @{holderName='Smoke Driver';iban='UA123456789012345678901234567'}) | Out-Null
$veh=Invoke-RestMethod -Method Post -Uri "$base/vehicles" -Headers (H $d.session.accessToken) -Body (Json @{label='Trust Van';bodyType='van';maxPayloadKg=100;clientReference="trust-$stamp"})
$t=Invoke-RestMethod -Method Post -Uri "$base/trips" -Headers (H $d.session.accessToken) -Body (Json @{vehicleId=$veh.id;origin=@{countryCode='UA';cityId='dnipro';street='O'};destination=@{countryCode='UA';cityId='kyiv';street='D'};departureInMinutes=180;maxDetourKm=20;capacityKg=100})
Write-Host '4/11 Offer and deal'
$o=Invoke-RestMethod -Method Post -Uri "$base/offers" -Headers (H $d.session.accessToken) -Body (Json @{cargoId=$c.id;tripId=$t.id;amountMinor=50000;currency='UAH'})
$deal=Invoke-RestMethod -Method Post -Uri "$base/deals/accept-offer" -Headers (H $s.session.accessToken) -Body (Json @{offerId=$o.id})
$deal=Invoke-RestMethod -Method Post -Uri "$base/deals/$($deal.id)/dev/secure-payment" -Headers (H $s.session.accessToken)
Write-Host '5/11 Open dispute after secured payment'
$x=Invoke-RestMethod -Method Post -Uri "$base/disputes/deal/$($deal.id)" -Headers (H $s.session.accessToken) -Body (Json @{reasonCode='other';description='Smoke trust safety dispute description'})
if($x.status -ne 'open'){throw 'Dispute was not opened'}
Write-Host '6/11 Other participant can read dispute'
$x2=Invoke-RestMethod -Method Get -Uri "$base/disputes/deal/$($deal.id)" -Headers (H $d.session.accessToken)
if($x2.id -ne $x.id){throw 'Driver cannot read deal dispute'}
Write-Host '7/11 Evidence can be appended'
$ev=Invoke-RestMethod -Method Post -Uri "$base/disputes/$($x.id)/evidence" -Headers (H $d.session.accessToken) -Body (Json @{text='Driver explanation for smoke evidence'})
if(-not $ev.id){throw 'Evidence not created'}
Write-Host '8/11 Outsider cannot read dispute'
$z=Invoke-RestMethod -Method Post -Uri "$base/auth/register" -ContentType 'application/json' -Body (Json @{email="trust-o+$stamp@cargogo.test";password='CargoGoTest123';displayName='Outsider'})
$blocked=$false;try{Invoke-RestMethod -Method Get -Uri "$base/disputes/$($x.id)" -Headers (H $z.session.accessToken)|Out-Null}catch{if($_.Exception.Response.StatusCode.value__ -eq 404){$blocked=$true}else{throw}}
if(-not $blocked){throw 'Outsider dispute access was not blocked'}
Write-Host '9/11 Development resolution freezes money outcome'
$x=Invoke-RestMethod -Method Post -Uri "$base/disputes/$($x.id)/dev/resolve" -Headers (H $s.session.accessToken) -Body (Json @{winner='sender';note='Alpha resolution'})
if($x.status -ne 'resolved_sender'){throw 'Dispute resolution failed'}
Write-Host '10/11 Deal is refunded after sender win'
$fd=Invoke-RestMethod -Method Get -Uri "$base/deals/$($deal.id)" -Headers (H $s.session.accessToken)
if($fd.status -ne 'refunded' -or $fd.paymentStatus -ne 'refunded'){throw 'Expected refunded deal'}
Write-Host '11/11 Notifications exist'
$n=@(Invoke-RestMethod -Method Get -Uri "$base/notifications" -Headers (H $d.session.accessToken))
if($n.Count -lt 1){throw 'Expected trust/safety notification'}
Write-Host "PASS TRUST & SAFETY: deal=$($deal.id) dispute=$($x.id)" -ForegroundColor Green
