$ErrorActionPreference='Stop';$base='http://localhost:3000/v1';$stamp=[DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
function J($v){$v|ConvertTo-Json -Depth 10 -Compress};function H($t){@{Authorization="Bearer $t";'Content-Type'='application/json'}}
Write-Host '1/10 owner + editable cargo'
$o=Invoke-RestMethod -Method Post -Uri "$base/auth/register" -ContentType 'application/json' -Body (J @{email="edit-owner+$stamp@cargogo.test";password='CargoGoTest123';displayName='Edit Owner'})
$c=Invoke-RestMethod -Method Post -Uri "$base/cargo" -Headers (H $o.session.accessToken) -Body (J @{title='Editable cargo';rewardMinor=50000;currency='UAH';pickup=@{countryCode='UA';cityId='dnipro';street='A'};delivery=@{countryCode='UA';cityId='kyiv';street='B'}})
Invoke-RestMethod -Method Post -Uri "$base/cargo/$($c.id)/publish" -Headers (H $o.session.accessToken)|Out-Null
Write-Host '2/10 edit published cargo'
$c2=Invoke-RestMethod -Method Patch -Uri "$base/cargo/$($c.id)" -Headers (H $o.session.accessToken) -Body (J @{rewardMinor=55000;pickup=@{countryCode='UA';cityId='pavlohrad';street='A2'}})
if($c2.rewardMinor-ne 55000 -or $c2.pickup.cityId-ne 'pavlohrad'){throw 'Cargo edit failed'}
Write-Host '3/10 delete unused cargo'
$tmp=Invoke-RestMethod -Method Post -Uri "$base/cargo" -Headers (H $o.session.accessToken) -Body (J @{title='Delete me';rewardMinor=10000;currency='UAH';pickup=@{countryCode='UA';cityId='dnipro'};delivery=@{countryCode='UA';cityId='kyiv'}})
Invoke-RestMethod -Method Delete -Uri "$base/cargo/$($tmp.id)" -Headers (H $o.session.accessToken)|Out-Null
Write-Host '4/10 driver + trip'
$d=Invoke-RestMethod -Method Post -Uri "$base/auth/register" -ContentType 'application/json' -Body (J @{email="edit-driver+$stamp@cargogo.test";password='CargoGoTest123';displayName='Edit Driver'})
Invoke-RestMethod -Method Post -Uri "$base/payout-accounts/me" -Headers (H $d.session.accessToken) -Body (J @{holderName='Smoke Driver';iban='UA123456789012345678901234567'}) | Out-Null
$v=Invoke-RestMethod -Method Post -Uri "$base/vehicles" -Headers (H $d.session.accessToken) -Body (J @{label='Edit Van';bodyType='van';maxPayloadKg=500;clientReference="edit-$stamp"})
$t=Invoke-RestMethod -Method Post -Uri "$base/trips" -Headers (H $d.session.accessToken) -Body (J @{vehicleId=$v.id;origin=@{countryCode='UA';cityId='pavlohrad'};destination=@{countryCode='UA';cityId='kyiv'};departureInMinutes=180;maxDetourKm=30;capacityKg=500})
Write-Host '5/10 edit published trip'
$t2=Invoke-RestMethod -Method Patch -Uri "$base/trips/$($t.id)" -Headers (H $d.session.accessToken) -Body (J @{maxDetourKm=35;departureInMinutes=240})
if([int]$t2.maxDetourKm-ne 35){throw 'Trip edit failed'}
Write-Host '6/10 delete unused trip'
$tmpT=Invoke-RestMethod -Method Post -Uri "$base/trips" -Headers (H $d.session.accessToken) -Body (J @{vehicleId=$v.id;origin=@{countryCode='UA';cityId='dnipro'};destination=@{countryCode='UA';cityId='kyiv'};departureInMinutes=300;maxDetourKm=20})
Invoke-RestMethod -Method Delete -Uri "$base/trips/$($tmpT.id)" -Headers (H $d.session.accessToken)|Out-Null
Write-Host '7/10 match + offer'
$m=@(Invoke-RestMethod -Method Get -Uri "$base/trips/$($t.id)/matches" -Headers (H $d.session.accessToken));if($m.Count-lt 1){throw 'Expected match'}
$of=Invoke-RestMethod -Method Post -Uri "$base/offers" -Headers (H $d.session.accessToken) -Body (J @{cargoId=$c.id;tripId=$t.id;amountMinor=55000;currency='UAH'})
Write-Host '8/10 accept deal'
$deal=Invoke-RestMethod -Method Post -Uri "$base/deals/accept-offer" -Headers (H $o.session.accessToken) -Body (J @{offerId=$of.id})
Write-Host '9/10 cargo mutation locked after acceptance'
$blocked=$false;try{Invoke-RestMethod -Method Patch -Uri "$base/cargo/$($c.id)" -Headers (H $o.session.accessToken) -Body (J @{rewardMinor=60000})|Out-Null}catch{if($_.Exception.Response.StatusCode.value__-eq 409){$blocked=$true}else{throw}};if(-not $blocked){throw 'Cargo edit was not locked'}
Write-Host '10/10 trip mutation locked after acceptance'
$blocked=$false;try{Invoke-RestMethod -Method Delete -Uri "$base/trips/$($t.id)" -Headers (H $d.session.accessToken)|Out-Null}catch{if($_.Exception.Response.StatusCode.value__-eq 409){$blocked=$true}else{throw}};if(-not $blocked){throw 'Trip delete was not locked'}
Write-Host "PASS EDITABILITY: cargo=$($c.id) trip=$($t.id) deal=$($deal.id)" -ForegroundColor Green
