export enum UserRole {
  USER = 'user',
  ATTENDANT = 'attendant',
  ADMIN = 'admin',
  OPERATOR = 'operator',
  FINANCE = 'finance',
  CUSTOMER_SERVICE = 'customer_service',
  MEDICAL_CONSULTANT = 'medical_consultant',
}

export enum OrderStatus {
  PENDING_DISPATCH = 'pending_dispatch',
  PENDING_ACCEPT = 'pending_accept',
  PENDING_GRAB = 'pending_grab',
  PENDING_SIGN = 'pending_sign',
  PENDING_SERVICE = 'pending_service',
  IN_PROGRESS = 'in_progress',
  PENDING_REVIEW = 'pending_review',
  COMPLETED = 'completed',
  CANCELED = 'canceled',
  EMERGENCY = 'emergency',
}

export enum TimelineType {
  TEXT = 'text',
  IMAGE = 'image',
  AUDIO_QUESTION = 'audio_question',
  AUDIO_ADVICE = 'audio_advice',
  FILE = 'file',
  NODE = 'node',
  SERVICE_START = 'service_start',
  SERVICE_END = 'service_end',
  EMERGENCY = 'emergency',
}

export enum DocumentType {
  HEALTH_PROFILE = 'health_profile',
  DISPATCH_CONFIRMATION = 'dispatch_confirmation',
  SERVICE_COMPLETION = 'service_completion',
  SERVICE_REPORT = 'service_report',
  EXPERT_MATCH = 'expert_match',
}

export enum FinanceRecordType {
  TRANSPORT = 'transport',
  ACCOMMODATION = 'accommodation',
  MEDICAL = 'medical',
  OTHER = 'other',
}

export enum FinanceRecordStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

export enum SettlementStatus {
  PENDING = 'pending',
  SETTLED = 'settled',
}

export enum PaymentStatus {
  UNPAID = 'unpaid',
  PAID = 'paid',
  REFUNDED = 'refunded',
}

export enum PaymentMethod {
  WECHAT = 'wechat',
  ALIPAY = 'alipay',
  QR_TRANSFER = 'qr_transfer',
  BANK_TRANSFER = 'bank_transfer',
  CASH = 'cash',
  OTHER = 'other',
}
