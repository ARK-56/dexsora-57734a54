export type LeadStatus = 
  | "New Lead"
  | "Pending"
  | "Eligible"
  | "Not Eligible"
  | "Need Additional Documents"
  | "Shipped"
  | "Delivered"
  | "Auth Applied"
  | "Auth Approved"
  | "Pre Payment Request"
  | "Post Payment Request"
  | "Billed"
  | "Paid"
  | "Denied"
  | "Completed"
  | "Need To Bill"
  | "PrePay Audit"
  | "Appeal"
  | "PostPay Audit";

export type UserRole = "doctor" | "admin" | "eligibility" | "shipment" | "billing";

export interface Note {
  id: string;
  text: string;
  author: string;
  date: string;
  isInternal: boolean;
}

export interface Document {
  id: string;
  name: string;
  type: string;
  uploadedBy: string;
  uploadedAt: string;
  url?: string;
}

export interface Lead {
  id: string;
  patientName: string;
  dob: string;
  phone: string;
  email: string;
  address: string;
  medicareId: string;
  ppoId: string;
  item?: string;
  diagnosis?: string;
  dmeItems?: string;
  status: LeadStatus;
  denialReason?: string;
  notes: Note[];
  documents: Document[];
  createdAt: string;
  updatedAt: string;
  trackingNumber?: string;
  doctorName?: string;
  doctorNpi?: string;
}
