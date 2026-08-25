$ErrorActionPreference = 'Stop'
$base = 'http://localhost:3000/v1'
$stamp = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()

function Json($value) { return ($value | ConvertTo-Json -Depth 10 -Compress) }
function AuthHeader($token) { return @{ Authorization = "Bearer $token"; 'Content-Type' = 'application/json' } }

Write-Host '1/19 Register sender'
$sender = Invoke-RestMethod -Method Post -Uri "$base/auth/register" -ContentType 'application/json' -Body (Json @{
  email = "sender+$stamp@cargogo.test"; password = 'CargoGoTest123'; displayName = 'Smoke Sender'
})

Write-Host '2/19 Create and publish cargo'
$cargo = Invoke-RestMethod -Method Post -Uri "$base/cargo" -Headers (AuthHeader $sender.session.accessToken) -Body (Json @{
  title='Smoke monitor'; weightKg=8; rewardMinor=65000; currency='UAH'; fragile=$true;
  pickup=@{countryCode='UA';cityId='dnipro';street='Smoke pickup private'};
  delivery=@{countryCode='UA';cityId='kyiv';street='Smoke delivery private'}
})
Invoke-RestMethod -Method Post -Uri "$base/cargo/$($cargo.id)/publish" -Headers (AuthHeader $sender.session.accessToken) | Out-Null

Write-Host '3/19 Register driver'
$driver = Invoke-RestMethod -Method Post -Uri "$base/auth/register" -ContentType 'application/json' -Body (Json @{
  email = "driver+$stamp@cargogo.test"; password = 'CargoGoTest123'; displayName = 'Smoke Driver'
})

Write-Host '3b/19 Configure driver payout IBAN'
Invoke-RestMethod -Method Post -Uri "$base/payout-accounts/me" -Headers (AuthHeader $driver.session.accessToken) -Body (Json @{holderName='Smoke Driver';iban='UA123456789012345678901234567'}) | Out-Null

Write-Host '4/19 Verify private cargo access is blocked'
$blocked = $false
try { Invoke-RestMethod -Method Get -Uri "$base/cargo/$($cargo.id)" -Headers (AuthHeader $driver.session.accessToken) | Out-Null }
catch { if ($_.Exception.Response.StatusCode.value__ -eq 403) { $blocked = $true } else { throw } }
if (-not $blocked) { throw 'Authorization invariant failed: driver could read sender private cargo DTO' }

Write-Host '5/19 Create idempotent vehicle'
$vehicleRef = "smoke-vehicle-$stamp"
$vehicle = Invoke-RestMethod -Method Post -Uri "$base/vehicles" -Headers (AuthHeader $driver.session.accessToken) -Body (Json @{
  label='Smoke Octavia'; bodyType='wagon'; maxPayloadKg=80; clientReference=$vehicleRef
})
$vehicleAgain = Invoke-RestMethod -Method Post -Uri "$base/vehicles" -Headers (AuthHeader $driver.session.accessToken) -Body (Json @{
  label='Smoke Octavia'; bodyType='wagon'; maxPayloadKg=80; clientReference=$vehicleRef
})
if ($vehicle.id -ne $vehicleAgain.id) { throw 'Vehicle idempotency failed' }

Write-Host '6/19 Create trip using server-relative departure'
$trip = Invoke-RestMethod -Method Post -Uri "$base/trips" -Headers (AuthHeader $driver.session.accessToken) -Body (Json @{
  vehicleId=$vehicle.id;
  origin=@{countryCode='UA';cityId='dnipro';street='Driver origin private'};
  destination=@{countryCode='UA';cityId='kyiv';street='Driver destination private'};
  departureInMinutes=180; maxDetourKm=15; capacityKg=80
})

Write-Host '7/19 Fetch privacy-safe match'
$matches = @(Invoke-RestMethod -Method Get -Uri "$base/trips/$($trip.id)/matches" -Headers (AuthHeader $driver.session.accessToken))
if ($matches.Count -lt 1) { throw 'Expected at least one cargo match' }
if ($matches[0].cargo.PSObject.Properties.Name -contains 'street') { throw 'Privacy invariant failed: match exposed private address' }

if ($matches[0].score -lt 70) { throw "Expected strong city-pair match, got $($matches[0].score)" }
if (-not $matches[0].scoreBreakdown) { throw 'Expected match score breakdown' }

Write-Host '8/19 Driver accepts listed price by creating offer'
$offer = Invoke-RestMethod -Method Post -Uri "$base/offers" -Headers (AuthHeader $driver.session.accessToken) -Body (Json @{
  cargoId=$cargo.id; tripId=$trip.id; amountMinor=65000; currency='UAH'; message='Smoke listed-price offer'
})
if ($offer.status -ne 'pending') { throw 'Expected pending offer' }

Write-Host '9/19 Sender accepts offer atomically'
$deal = Invoke-RestMethod -Method Post -Uri "$base/deals/accept-offer" -Headers (AuthHeader $sender.session.accessToken) -Body (Json @{offerId=$offer.id})
if ($deal.status -ne 'awaiting_payment') { throw 'Expected awaiting_payment deal' }
if ($deal.platformFeeMinor -ne 5200 -or $deal.carrierAmountMinor -ne 59800) { throw "Fee snapshot failed: fee=$($deal.platformFeeMinor) carrier=$($deal.carrierAmountMinor)" }
if ($deal.privateLocationsAvailable) { throw 'Private locations unlocked before payment' }

Write-Host '10/19 Development payment is secured server-side'
$deal = Invoke-RestMethod -Method Post -Uri "$base/deals/$($deal.id)/dev/secure-payment" -Headers (AuthHeader $sender.session.accessToken)
if ($deal.status -ne 'awaiting_pickup' -or $deal.paymentStatus -ne 'secured') { throw 'Mock payment did not secure deal' }
if (-not $deal.privateLocationsAvailable) { throw 'Private locations should unlock after secured payment' }
if (-not $deal.codes.pickup) { throw 'Sender did not receive pickup code' }
$pickupCode = [string]$deal.codes.pickup

Write-Host '11/19 Wrong pickup code does not advance state'
$wrongPickupRejected = $false
try { Invoke-RestMethod -Method Post -Uri "$base/deals/$($deal.id)/pickup/confirm" -Headers (AuthHeader $driver.session.accessToken) -Body (Json @{code='000000'}) | Out-Null }
catch { if ($_.Exception.Response.StatusCode.value__ -eq 409) { $wrongPickupRejected = $true } else { throw } }
if (-not $wrongPickupRejected) { throw 'Wrong pickup code was accepted' }

Write-Host '12/19 Driver confirms pickup with sender code'
$dealDriver = Invoke-RestMethod -Method Post -Uri "$base/deals/$($deal.id)/pickup/confirm" -Headers (AuthHeader $driver.session.accessToken) -Body (Json @{code=$pickupCode})
if ($dealDriver.status -ne 'picked_up') { throw 'Expected picked_up' }

Write-Host '13/19 Driver starts transit'
$dealDriver = Invoke-RestMethod -Method Post -Uri "$base/deals/$($deal.id)/transit/start" -Headers (AuthHeader $driver.session.accessToken)
if ($dealDriver.status -ne 'in_transit') { throw 'Expected in_transit' }

Write-Host '14/19 Driver marks arrival'
$dealDriver = Invoke-RestMethod -Method Post -Uri "$base/deals/$($deal.id)/arrive" -Headers (AuthHeader $driver.session.accessToken)
if ($dealDriver.status -ne 'arrived') { throw 'Expected arrived' }
$senderDeal = Invoke-RestMethod -Method Get -Uri "$base/deals/$($deal.id)" -Headers (AuthHeader $sender.session.accessToken)
if (-not $senderDeal.codes.delivery) { throw 'Sender did not receive delivery code' }
$deliveryCode = [string]$senderDeal.codes.delivery

Write-Host '15/19 Driver confirms delivery; mock payment releases'
$completed = Invoke-RestMethod -Method Post -Uri "$base/deals/$($deal.id)/delivery/confirm" -Headers (AuthHeader $driver.session.accessToken) -Body (Json @{code=$deliveryCode})
if ($completed.status -ne 'completed') { throw "Expected completed, got $($completed.status)" }
if ($completed.paymentStatus -ne 'released') { throw 'Expected released mock payment' }
if ($completed.payoutStatus -ne 'paid' -or $completed.settlementStatus -ne 'settled') { throw "Expected paid payout/settled deal, got $($completed.payoutStatus)/$($completed.settlementStatus)" }

Write-Host '16/19 Both participants can review exactly once'
$senderReview = Invoke-RestMethod -Method Post -Uri "$base/deals/$($deal.id)/reviews" -Headers (AuthHeader $sender.session.accessToken) -Body (Json @{rating=5;comment='Smoke driver review'})
$driverReview = Invoke-RestMethod -Method Post -Uri "$base/deals/$($deal.id)/reviews" -Headers (AuthHeader $driver.session.accessToken) -Body (Json @{rating=5;comment='Smoke sender review'})
if ($senderReview.rating -ne 5 -or $driverReview.rating -ne 5) { throw 'Review creation failed' }

Write-Host '17/19 Deal chat remains participant-only'
$message = Invoke-RestMethod -Method Post -Uri "$base/chats/$($deal.id)/messages" -Headers (AuthHeader $driver.session.accessToken) -Body (Json @{body='Delivered successfully'})
if ($message.body -ne 'Delivered successfully') { throw 'Expected chat message' }
$outsider = Invoke-RestMethod -Method Post -Uri "$base/auth/register" -ContentType 'application/json' -Body (Json @{
  email = "outsider+$stamp@cargogo.test"; password = 'CargoGoTest123'; displayName = 'Smoke Outsider'
})
$chatBlocked = $false
try { Invoke-RestMethod -Method Get -Uri "$base/chats/$($deal.id)/messages" -Headers (AuthHeader $outsider.session.accessToken) | Out-Null }
catch { if ($_.Exception.Response.StatusCode.value__ -eq 403) { $chatBlocked = $true } else { throw } }
if (-not $chatBlocked) { throw 'Outsider could read deal chat' }

Write-Host '18/19 Verify immutable lifecycle events exist'
$finalDeal = Invoke-RestMethod -Method Get -Uri "$base/deals/$($deal.id)" -Headers (AuthHeader $sender.session.accessToken)
$eventTypes = @($finalDeal.events | ForEach-Object { $_.type })
foreach ($required in @('deal.created','payment.mock_secured','pickup.verified','transit.started','delivery.arrived','delivery.verified','payment.captured','payout.paid')) {
  if ($eventTypes -notcontains $required) { throw "Missing lifecycle event: $required" }
}

Write-Host '19/19 Verify in-app notifications were emitted'
$senderNotifications = @(Invoke-RestMethod -Method Get -Uri "$base/notifications" -Headers (AuthHeader $sender.session.accessToken))
$driverNotifications = @(Invoke-RestMethod -Method Get -Uri "$base/notifications" -Headers (AuthHeader $driver.session.accessToken))
if ($senderNotifications.Count -lt 1 -or $driverNotifications.Count -lt 1) { throw 'Expected marketplace notifications for both participants' }

Write-Host "PASS FULL FLOW: cargo=$($cargo.id) trip=$($trip.id) offer=$($offer.id) deal=$($deal.id)" -ForegroundColor Green
