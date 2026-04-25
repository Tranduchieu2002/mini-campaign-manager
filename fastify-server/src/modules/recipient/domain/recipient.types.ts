export interface CreateRecipientProps {
  email: string;
  name: string;
}

export interface RecipientEntity {
  id: string;
  email: string;
  name: string;
  metadata: Record<string, unknown> | null;
  unsubscribedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
