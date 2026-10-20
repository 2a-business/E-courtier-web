export type Role = "ADMIN" | "AGENT" | "OWNER" | "CUSTOMER";
export type TransactionType = "RENT" | "SALE";
export type PropertyType = "APARTMENT" | "HOUSE" | "VILLA" | "STUDIO" | "ROOM" | "LAND" | "OFFICE";
export type PublicationStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED" | "SUSPENDED";
export type VerificationStatus = "NOT_SUBMITTED" | "PENDING" | "APPROVED" | "REJECTED";

export interface User {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  full_name: string;
  phone: string;
  role: Role;
  date_joined: string;
  profile?: { agency_name: string; bio: string };
}

export interface Paginated<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface ListingCard {
  id: string;
  title: string;
  property_type: PropertyType;
  property_type_label: string;
  transaction_type: TransactionType;
  price: number;
  currency: "XOF";
  surface_m2: number | null;
  rooms: number;
  bedrooms: number;
  bathrooms: number;
  is_furnished: boolean;
  city: string;
  district: string;
  latitude: number | null;
  longitude: number | null;
  is_verified: boolean;
  is_featured: boolean;
  is_demo: boolean;
  cover: string | null;
  published_at: string | null;
}

export interface Photo {
  id: number;
  image: string;
  thumbnail: string;
  width: number;
  height: number;
  caption: string;
  position: number;
  is_primary: boolean;
}

export interface Amenity {
  slug: string;
  label: string;
}

export interface ListingDetail extends ListingCard {
  description: string;
  address_public: string;
  address_private: string | null;
  amenities: Amenity[];
  photos: Photo[];
  owner: { id: number; name: string; role: Role; date_joined: string; agency_name: string };
  publication_status: PublicationStatus;
  verification_status: VerificationStatus;
  verification: { label: string | null; disclaimer: string | null };
  rating: { average: number | null; count: number };
  can_manage: boolean;
  created_at: string;
  updated_at: string;
}

export interface OwnerListing extends ListingCard {
  publication_status: PublicationStatus;
  verification_status: VerificationStatus;
  visits_pending: number;
  reports_open: number;
  created_at: string;
}

export interface Slot {
  id: number;
  starts_at: string;
  ends_at: string;
}

export type VisitStatus = "PENDING" | "CONFIRMED" | "CANCELLED" | "COMPLETED";

export interface Visit {
  id: number;
  listing: ListingCard;
  slot: Slot;
  status: VisitStatus;
  status_label: string;
  message: string;
  customer_name: string;
  host_name: string;
  address: string | null;
  contact_phone: string | null;
  my_role: "host" | "customer";
  created_at: string;
  confirmed_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  cancel_reason: string;
}

export type TxStatus = "PENDING" | "PAID" | "FAILED" | "CANCELLED" | "REFUNDED";

export interface Transaction {
  id: string;
  reference: string;
  listing: ListingCard;
  amount: number;
  amount_kind: string;
  amount_kind_label: string;
  fee_amount: number;
  total_amount: number;
  currency: "XOF";
  status: TxStatus;
  status_label: string;
  provider: "WAVE_LINK" | "SIMULATION";
  provider_label: string;
  is_simulated: boolean;
  customer_name: string;
  paid_at: string | null;
  created_at: string;
  contract: { id: string; status: ContractStatus; status_label: string } | null;
  events?: { event: string; from_status: string; to_status: string; note: string; created_at: string }[];
  attempts?: {
    id: number;
    provider: string;
    status: string;
    status_label: string;
    provider_reference: string;
    is_simulated: boolean;
    created_at: string;
  }[];
}

export type ContractStatus = "DRAFT" | "PENDING_SIGNATURE" | "SIGNED" | "CANCELLED";

export interface Contract {
  id: string;
  reference: string;
  transaction_id: string;
  listing_title: string;
  status: ContractStatus;
  status_label: string;
  is_simulated: boolean;
  special_terms: string;
  current_version: { number: number; content: string; content_sha256: string; created_at: string };
  signatures: { role: string; signer_name: string; version_number: number; signed_sha256: string; signed_at: string }[];
  my_role: "CUSTOMER" | "OWNER" | "ADMIN";
  i_signed: boolean;
  legal_notice: string;
  created_at: string;
  sent_at: string | null;
  signed_at: string | null;
  cancel_reason: string;
}

export interface Review {
  id: number;
  rating: number;
  owner_rating: number;
  comment: string;
  author_name: string;
  created_at: string;
}

export interface ChatResponse {
  conversation_id: string;
  reply: string;
  criteria: Record<string, unknown>;
  results: ListingCard[];
  /** Nombre total d'annonces correspondant exactement (peut dépasser le nombre de cartes affichées). */
  total: number;
  alternatives: ListingCard[];
  /** Critères élargis pour obtenir les alternatives (vide s'il n'y en a pas). */
  relaxed: string[];
  mode: "llm" | "rules" | "fallback";
  remaining_today: number;
}

export interface Notification {
  id: number;
  kind: string;
  title: string;
  body: string;
  link: string;
  read_at: string | null;
  sms_status: string;
  created_at: string;
}

export interface VerificationDocument {
  id: number;
  doc_type: string;
  doc_type_label: string;
  original_name: string;
  content_type: string;
  size: number;
  uploaded_at: string;
  submitted: boolean;
}

export interface VerificationRequest {
  id: number;
  status: "PENDING" | "APPROVED" | "REJECTED" | "INVALIDATED";
  submitted_at: string;
  decided_at: string | null;
  decided_by_name: string | null;
  decision_reason: string;
  documents: VerificationDocument[];
  listing?: ListingCard;
  submitted_by?: { id: number; name: string; email: string; role: Role };
}

export type ApplicationStatus = "DRAFT" | "SUBMITTED" | "UNDER_REVIEW" | "INFO_REQUESTED" | "ACCEPTED" | "REJECTED";
/** État affiché : un brouillon est « INCOMPLETE » ou « READY » (complétude calculée par le serveur). */
export type ApplicationState = Exclude<ApplicationStatus, "DRAFT"> | "INCOMPLETE" | "READY";

export interface RentalApplicationSummary {
  id: string;
  listing: ListingCard;
  visit: number;
  status: ApplicationStatus;
  status_label: string;
  state: ApplicationState;
  customer_name: string;
  submitted_at: string | null;
  decided_at: string | null;
  updated_at: string;
}

export interface ApplicationDocument {
  id: number;
  doc_type: string;
  doc_type_label: string;
  original_name: string;
  content_type: string;
  size: number;
  uploaded_at: string;
  submitted: boolean;
}

export interface RentalApplication extends RentalApplicationSummary {
  profession: string;
  employer: string;
  monthly_income_xof: number | null;
  household_size: number | null;
  move_in_date: string | null;
  has_guarantor: boolean;
  guarantor_name: string;
  message: string;
  consent_accepted_at: string | null;
  first_submitted_at: string | null;
  info_request_message: string;
  decision_reason: string;
  documents: ApplicationDocument[];
  events: { event: string; from_status: string; to_status: string; note: string; actor_name: string | null; created_at: string }[];
  requirements: {
    required_documents: { types: string[]; label: string; satisfied: boolean }[];
    optional_documents: { type: string; label: string; provided: boolean }[];
    missing_documents: string[];
    missing_fields: string[];
    is_complete: boolean;
    accepted_formats: string[];
    max_document_size_mb: number;
  };
  payment: {
    fee_amount: number;
    currency: "XOF";
    wave_configured: boolean;
    /** Frais de dossier : état réel, uniquement confirmé par E-Courtier après rapprochement Wave. */
    fee: ApplicationFee;
    /** Paiement du premier loyer (dossier de paiement), indépendant du dossier locatif. */
    transaction: { id: string; reference: string; status: string; status_label: string; total_amount: number; fee_amount: number; is_simulated: boolean; paid_at: string | null } | null;
  };
  my_role: "customer" | "responsible" | "admin";
  internal_notes: { id: number; text: string; author_name: string; created_at: string }[] | null;
  can_edit: boolean;
  responsible: { name: string; role: string; role_label: string; agency_name: string };
  visit_starts_at: string;
}

export type FeeStatus = "NOT_REQUIRED" | "NOT_STARTED" | "PENDING" | "AWAITING_VERIFICATION" | "CONFIRMED" | "FAILED" | "CANCELLED";

export interface ApplicationFee {
  status: FeeStatus;
  status_label: string;
  amount: number;
  currency: "XOF";
  reference: string | null;
  provider_reference: string;
  declared_at: string | null;
  confirmed_at: string | null;
  failure_reason: string;
  started: boolean;
  can_pay: boolean;
  payment_problem: string | null;
}

export interface AdminFeePayment {
  id: number;
  amount: number;
  status: FeeStatus;
  status_label: string;
  reference: string;
  provider_reference: string;
  checkout_started_at: string | null;
  declared_at: string | null;
  confirmed_at: string | null;
  failure_reason: string;
  application_id: string;
  application_status: string;
  listing_title: string;
  customer_name: string;
  created_at: string;
}
