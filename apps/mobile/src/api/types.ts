export type User = {
  id: string;
  email: string | null;
  phone: string | null;
  displayName: string;
  status: string;
  verificationStatus: 'unverified' | 'pending' | 'verified' | 'rejected';
  staffRole?: 'reviewer' | 'verification_reviewer' | 'dispute_reviewer' | 'admin' | null;
};

export type Session = { accessToken: string; refreshToken: string; sessionId: string; expiresIn: number };
export type AuthResponse = { user: User; session: Session };

export type Cargo = {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  weightKg: number | null;
  dimensions: { lengthCm: number | null; widthCm: number | null; heightCm: number | null };
  rewardMinor: number;
  declaredValueMinor: number | null;
  declaredValueCurrency: 'UAH' | null;
  currency: 'UAH';
  fragile: boolean;
  status: 'draft' | 'published' | 'matched' | 'in_transit' | 'delivered' | 'cancelled';
  pickup: { countryCode:string; countryName:string; cityId:string; cityName:string; street:string; publicLabel:string };
  delivery: { countryCode:string; countryName:string; cityId:string; cityName:string; street:string; publicLabel:string };
  pickupFrom: string | null;
  pickupUntil: string | null;
  deliveryUntil: string | null;
  photoCount: number;
  createdAt: string;
  updatedAt: string;
};

export type Vehicle = {
  id: string;
  label: string;
  bodyType: 'sedan' | 'hatchback' | 'wagon' | 'suv' | 'van' | 'pickup' | 'other';
  maxPayloadKg: number | null;
  cargoSpace: { lengthCm: number | null; widthCm: number | null; heightCm: number | null };
  verificationStatus: 'unverified' | 'pending' | 'verified' | 'rejected';
  createdAt: string;
  updatedAt: string;
  lastUsedAt?: string | null;
};

export type Trip = {
  id: string;
  status: 'draft' | 'published' | 'active' | 'completed' | 'cancelled';
  vehicle: { id: string | null; label: string | null; bodyType: string | null };
  origin: { countryCode:string; countryName:string; cityId:string; cityName:string; street:string; publicLabel:string };
  destination: { countryCode:string; countryName:string; cityId:string; cityName:string; street:string; publicLabel:string };
  departureFrom: string;
  departureUntil: string | null;
  maxDetourKm: number;
  capacity: { kg: number | null; lengthCm: number | null; widthCm: number | null; heightCm: number | null };
  route: { distanceM: number | null; durationS: number | null; source: string; quality: 'rough' | 'routed'; coordinates: Array<{latitude:number;longitude:number}> };
  createdAt: string;
  updatedAt: string;
  lastUsedAt?: string | null;
};

export type TripMatch = {
  score: number;
  matchKind:'exact_city_pair'|'nearby_city_pair'|'corridor';
  scoreBreakdown:{city:number;proximity:number;direction:number;capacity:number;time:number;reward:number};
  pickupDistanceM: number;
  deliveryDistanceM: number;
  estimatedExtraM: number;
  computedAt: string;
  pickupEta: string | null;
  deliveryEta: string | null;
  myOfferStatus: string | null;
  myOfferAmountMinor: number | null;
  cargo: {
    id: string;
    title: string;
    description: string | null;
    category: string | null;
    weightKg: number | null;
    dimensions: { lengthCm: number | null; widthCm: number | null; heightCm: number | null };
    rewardMinor: number;
    declaredValueMinor: number | null;
    declaredValueCurrency: 'UAH' | null;
    currency: 'UAH';
    fragile: boolean;
    pickupLabel: string;
    deliveryLabel: string;
    pickupFrom: string | null;
    pickupUntil: string | null;
    deliveryUntil: string | null;
    photoCount: number;
    owner: { displayName: string; verificationStatus: string };
  };
};

export type CargoOffer = {
  id: string;
  cargoId: string;
  tripId: string;
  amountMinor: number;
  currency: 'UAH';
  message: string | null;
  status: 'pending' | 'accepted' | 'rejected' | 'withdrawn' | 'expired' | 'superseded';
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
  cargo: { title: string; pickupLabel: string; deliveryLabel: string };
  driver: { displayName: string; verificationStatus: string };
};

export type DealReview = {
  dealId: string;
  rating: number;
  comment: string | null;
  isMine: boolean;
  createdAt: string;
};

export type Deal = {
  id: string;
  cargoId: string;
  tripId: string;
  offerId: string;
  role: 'sender' | 'driver';
  status: 'awaiting_payment' | 'payment_secured' | 'awaiting_pickup' | 'picked_up' | 'in_transit' | 'arrived' | 'delivered' | 'completed' | 'cancelled' | 'disputed' | 'refunded';
  paymentStatus: 'not_started' | 'pending' | 'secured' | 'captured' | 'failed' | 'refunded' | 'released';
  paymentMode: 'mock' | 'liqpay_sandbox' | 'liqpay_production' | 'disabled';
  agreedAmountMinor: number;
  declaredValueMinor: number | null;
  declaredValueCurrency: 'UAH' | null;
  platformFeeMinor: number;
  carrierAmountMinor: number;
  targetNetMarginMinor: number;
  estimatedAcquiringFeeMinor: number;
  estimatedPayoutFeeMinor: number;
  actualAcquiringFeeMinor: number | null;
  actualPayoutFeeMinor: number | null;
  platformNetRevenueMinor: number | null;
  actualNetMarginBps: number | null;
  feePolicy: { version:number; targetNetMarginBps?:number; acquiringFeeEstimateBps?:number; payoutFeeEstimateBps?:number; minMarketplaceFeeMinor?:number; rounding?:string; source?:string } | null;
  settlementStatus: string;
  payoutStatus: string | null;
  payoutProvider: string | null;
  payoutPaidAt: string | null;
  currency: 'UAH';
  cargo: {
    title: string;
    pickupLabel: string;
    deliveryLabel: string;
    privatePickupAddress: string | null;
    privateDeliveryAddress: string | null;
  };
  sender: { displayName: string; verificationStatus: string };
  driver: { displayName: string; verificationStatus: string };
  trip: { originLabel: string; destinationLabel: string };
  privateLocationsAvailable: boolean;
  codes: { pickup: string | null; delivery: string | null };
  evidenceSummary: { pickupCount:number; deliveryCount:number; pickupReady:boolean; deliveryReady:boolean; driverDeliveryCount:number; senderDeliveryCount:number };
  handoverSession: {driverPresent:boolean;recipientPresent:boolean;startedAt:string|null;strongWindowSeconds:number};
  handoverEvidence?: Array<{id:string;stage:'pickup'|'delivery';mimeType:'image/jpeg'|'image/png';sizeBytes:number;sha256:string;note:string|null;capturedAt:string;participantRole:'driver'|'sender'|null;synchronizationGrade:'strong'|'acceptable'|'late'|null;locationStatus:'captured'|'permission_denied'|'unavailable';location:{latitude:number;longitude:number;accuracyMeters:number|null;clientCapturedAt:string|null}|null}>;
  actions: {
    canDevSecurePayment: boolean;
    canStartHostedPayment: boolean;
    canSyncHostedPayment: boolean;
    canCancel: boolean;
    canUploadPickupEvidence: boolean;
    canConfirmPickup: boolean;
    canStartTransit: boolean;
    canMarkArrived: boolean;
    canConfirmRecipientPresent:boolean;
    canStartHandover:boolean;
    canUploadDeliveryEvidence: boolean;
    canConfirmDelivery: boolean;
    canReportDeliveryProblem: boolean;
    canReview: boolean;
    canOpenDispute: boolean;
  };
  timestamps: {
    paymentSecuredAt: string | null;
    pickupVerifiedAt: string | null;
    transitStartedAt: string | null;
    arrivedAt: string | null;
    deliveryVerifiedAt: string | null;
    completedAt: string | null;
  };
  createdAt: string;
  updatedAt: string;
  cancellationReason: string | null;
  events?: Array<{ type:string; fromStatus:string|null; toStatus:string|null; metadata:Record<string,unknown>; createdAt:string }>;
  reviews?: DealReview[];
};

export type ChatSummary = {
  dealId: string;
  dealStatus: Deal['status'];
  cargoTitle: string;
  otherParty: { displayName: string };
  lastMessage: { id:number; body:string; createdAt:string } | null;
  readOnly:boolean; closesAt:string|null; archived:boolean;
};

export type ChatMessage = {
  id: number;
  senderId: string;
  senderName: string;
  isMine: boolean;
  body: string;
  createdAt: string;
};

export type NotificationItem={id:number;type:string;title:string;body:string;entityType:string|null;entityId:string|null;metadata:Record<string,unknown>;readAt:string|null;archivedAt?:string|null;createdAt:string};
export type VerificationDetailedStatus='not_started'|'draft'|'submitted'|'under_review'|'verified'|'rejected'|'needs_resubmission'|'expired'|'suspended';
export type VerificationState={
  accountStatus:'unverified'|'pending'|'verified'|'rejected';
  mode:'mock'|'manual'|'disabled';
  enforcement:boolean;
  providerConfigured:boolean;
  identity:{status:VerificationDetailedStatus;documentKind:'passport'|'id_card'|null;documentCountry:string|null;documentLast4:string|null;provider:string;rejectionReason:string|null;submittedAt:string|null;verifiedAt:string|null;expiresAt:string|null};
  driverLicense:{status:VerificationDetailedStatus;countryCode:string|null;licenseLast4:string|null;categories:string[];provider:string;rejectionReason:string|null;submittedAt:string|null;verifiedAt:string|null;expiresAt:string|null};
  vehicles:Array<{vehicleId:string;label:string;bodyType:string;status:VerificationDetailedStatus;legacyStatus:string;registrationCountry:string|null;registrationNumberMasked:string|null;vinLast6:string|null;make:string|null;model:string|null;year:number|null;color:string|null;registrationDocumentStatus:string;insuranceStatus:string;provider:string;rejectionReason:string|null;submittedAt:string|null;verifiedAt:string|null;expiresAt:string|null}>;
  readiness:{senderReady:boolean;driverReady:boolean};
  capabilities:{canPublishCargo:boolean;canDrive:boolean};
};
export type Dispute={id:string;dealId:string;reasonCode:string;description:string;status:'open'|'under_review'|'resolved_sender'|'resolved_driver'|'closed';resolutionNote:string|null;openedByMe:boolean;createdAt:string;resolvedAt:string|null;evidence:Array<{id:number;kind:string;text:string|null;objectKey:string|null;isMine:boolean;createdAt:string}>;handoverEvidence?:Array<{id:string;stage:'pickup'|'delivery';mimeType:string;sizeBytes:number;sha256:string;note:string|null;capturedAt:string}>};

export type PayoutAccount={id:string;provider:string;methodType:'iban';maskedIban:string;countryCode:string;currency:'UAH';status:'active'|'disabled';createdAt:string;updatedAt:string};

export type VerificationDocument={id:string;subjectType:'identity'|'driver_license'|'vehicle';subjectId:string|null;documentKind:string;mimeType:string;sizeBytes:number|null;uploadStatus:string;validationStatus:string;rejectionReason:string|null;confirmedAt:string|null;createdAt:string|null};
export type VerificationReviewCase={id:string;subjectType:'identity'|'driver_license'|'vehicle';subjectId:string|null;status:'queued'|'in_review'|'resolved';priority:number;submittedAt:string;reviewStartedAt:string|null;assignedTo:string|null;user:{displayName:string;email:string|null;phone:string|null}};
