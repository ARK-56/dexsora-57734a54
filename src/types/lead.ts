export type LeadStatus = 
  | "Pending"
  | "Open"
  | "Auth"
  | "Approved"
  | "Delivered"
  | "Closed"
  | "Denied (SNS)"
  | "Denied (Auth)";

export type UserRole = "doctor" | "admin" | "eligibility" | "auth" | "logistics";

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
  dmeItems?: string;
  status: LeadStatus;
  denialReason?: string;
  notes: Note[];
  documents: Document[];
  createdAt: string;
  updatedAt: string;
  trackingNumber?: string;
}
