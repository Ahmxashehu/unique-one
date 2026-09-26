import type { MessageStatus } from './types';

/**
 * Communication Core data-model foundation.
 *
 * These contracts are intentionally separate from UniquePay and other financial
 * records. They are Firestore-ready shapes only; this module does not perform
 * reads, writes, real-time subscriptions, or provider integrations.
 */

export type ConversationType = 'direct' | 'group' | 'business';
export type ConversationStatus = 'active' | 'archived' | 'closed';
export type ConversationMemberRole = 'member' | 'admin' | 'owner';
export type CommunicationMessageType = 'text' | 'image' | 'file' | 'voice' | 'system';
export type MessageDeliveryStatus = 'sent' | 'delivered' | 'read';
export type MessageRequestStatus = 'pending' | 'accepted' | 'declined' | 'blocked';
export type PresenceStatus = 'online' | 'offline';

export interface MessageAttachmentMetadata {
  id: string;
  name: string;
  contentType: string;
  sizeBytes: number;
  url: string;
}

/**
 * Conversation metadata. Membership is stored independently in
 * ConversationMember records so authorization and per-member state can be
 * modeled without coupling communication documents to financial data.
 */
export interface Conversation {
  id: string;
  type: ConversationType;
  createdBy: string;
  title?: string;
  avatarUrl?: string;
  createdAt: string;
  updatedAt: string;
  lastMessageAt?: string;
  lastMessageId?: string;
  status: ConversationStatus;
}

/** Per-user membership and read/mute state for a conversation. */
export interface ConversationMember {
  conversationId: string;
  uid: string;
  role: ConversationMemberRole;
  joinedAt: string;
  lastReadAt?: string;
  muted?: boolean;
}

/**
 * A message belongs to one conversation. MessageStatus is reused from the
 * existing OS domain to preserve its queued/sending/sent/delivered/read/failed
 * lifecycle for future persistence and delivery processing.
 */
export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  type: CommunicationMessageType;
  text?: string;
  attachments?: MessageAttachmentMetadata[];
  replyToMessageId?: string;
  createdAt: string;
  updatedAt?: string;
  deleted?: boolean;
  deletedAt?: string;
  status: MessageStatus;
  reactions?: Record<string, number>;
  myReaction?: string;
}

/** Per-recipient delivery/read state for one message. */
export interface MessageDelivery {
  messageId: string;
  uid: string;
  status: MessageDeliveryStatus;
  deliveredAt?: string;
  readAt?: string;
}

/** A direct-message permission request between two authenticated users. */
export interface MessageRequest {
  id: string;
  fromUid: string;
  toUid: string;
  conversationId?: string;
  status: MessageRequestStatus;
  createdAt: string;
  updatedAt: string;
}

/** Presence is communication-only and does not contain device, payment, or wallet data. */
export interface UserPresence {
  uid: string;
  status: PresenceStatus;
  lastSeenAt: string;
}

/** Generic in-app notification metadata for a user. */
export interface Notification {
  id: string;
  uid: string;
  type: string;
  title: string;
  body: string;
  relatedEntityId?: string;
  relatedEntityType?: string;
  read: boolean;
  createdAt: string;
}
