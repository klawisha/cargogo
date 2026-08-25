$ErrorActionPreference='Stop';$base='http://localhost:3000/v1';$stamp=[DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
function J($v){$v|ConvertTo-Json -Depth 10 -Compress}
function AuthHeaders($token){@{Authorization="Bearer $token";'Content-Type'='application/json'}}
Write-Host '1/8 Create verification test user'
$u=Invoke-RestMethod -Method Post -Uri "$base/auth/register" -ContentType 'application/json' -Body (J @{email="verify+$stamp@cargogo.test";password='CargoGoTest123';displayName='Verification Driver'})
$h=AuthHeaders $u.session.accessToken
Write-Host '2/8 Submit identity'
Invoke-RestMethod -Method Post -Uri "$base/verification/identity/submit" -Headers $h -Body (J @{documentKind='id_card';documentCountry='UA';documentLast4='A123'})|Out-Null
Write-Host '3/8 Mock-review identity'
Invoke-RestMethod -Method Post -Uri "$base/verification/dev/resolve" -Headers $h -Body (J @{subject='identity';status='verified'})|Out-Null
Write-Host '4/8 Submit driver license'
Invoke-RestMethod -Method Post -Uri "$base/verification/driver-license/submit" -Headers $h -Body (J @{countryCode='UA';licenseLast4='B456';categories=@('B')})|Out-Null
Invoke-RestMethod -Method Post -Uri "$base/verification/dev/resolve" -Headers $h -Body (J @{subject='driver_license';status='verified'})|Out-Null
Write-Host '5/8 Create vehicle'
$v=Invoke-RestMethod -Method Post -Uri "$base/vehicles" -Headers $h -Body (J @{label='Verified Test Car';bodyType='wagon';maxPayloadKg=500;clientReference="verify-$stamp"})
Write-Host '6/8 Submit vehicle verification'
Invoke-RestMethod -Method Post -Uri "$base/verification/vehicles/$($v.id)/submit" -Headers $h -Body (J @{registrationCountry='UA';registrationNumber='AE1234AA';vinLast6='ABC123';make='Dacia';model='Logan';year=2020;color='White';insuranceRequired=$true})|Out-Null
Write-Host '7/8 Mock-review vehicle'
Invoke-RestMethod -Method Post -Uri "$base/verification/dev/resolve" -Headers $h -Body (J @{subject='vehicle';subjectId=$v.id;status='verified'})|Out-Null
Write-Host '8/8 Assert capabilities'
$state=Invoke-RestMethod -Method Get -Uri "$base/verification/me" -Headers $h
if($state.identity.status-ne 'verified'){throw 'Identity not verified'}
if($state.driverLicense.status-ne 'verified'){throw 'Driver license not verified'}
$vv=$state.vehicles|Where-Object {$_.vehicleId-eq $v.id}
if($vv.status-ne 'verified'){throw 'Vehicle not verified'}
if(-not $state.capabilities.canPublishCargo -or -not $state.capabilities.canDrive){throw 'Verification capabilities not unlocked'}
Write-Host 'PASS VERIFICATION CORE' -ForegroundColor Green
