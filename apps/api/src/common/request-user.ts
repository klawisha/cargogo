export type RequestUser = {
  id: string;
  sessionId: string;
  email: string | null;
  phone: string | null;
  displayName: string;
  status: 'active' | 'suspended' | 'deleted';
  verificationStatus: 'unverified' | 'pending' | 'verified' | 'rejected';
  staffRole: 'reviewer' | 'verification_reviewer' | 'dispute_reviewer' | 'admin' | null;
};
