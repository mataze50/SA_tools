import { prisma } from '../lib/prisma.js';

export type NotificationType =
  | 'VALIDATION_REQUESTED'
  | 'VALIDATION_APPROVED'
  | 'VALIDATION_REJECTED'
  | 'VALIDATION_NEEDS_CHANGES'
  | 'SHEET_REMIXED'
  | 'COMMENT_ADDED';

interface CreateNotificationParams {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  data?: Record<string, any>;
}

export async function createNotification(params: CreateNotificationParams) {
  return prisma.notification.create({
    data: {
      userId: params.userId,
      type: params.type,
      title: params.title,
      message: params.message,
      data: params.data
    }
  });
}

export async function notifyValidationRequested(
  sheetId: string,
  sheetTitle: string,
  authorName: string
) {
  // Notify all managers about new validation request
  const managers = await prisma.user.findMany({
    where: {
      role: { in: ['MANAGER', 'ADMIN'] }
    },
    select: { id: true }
  });

  const notifications = managers.map((manager) =>
    createNotification({
      userId: manager.id,
      type: 'VALIDATION_REQUESTED',
      title: 'Nouvelle fiche à valider',
      message: `${authorName} a soumis "${sheetTitle}" pour validation`,
      data: { sheetId }
    })
  );

  return Promise.all(notifications);
}

export async function notifyValidationResult(
  userId: string,
  sheetId: string,
  sheetTitle: string,
  validatorName: string,
  status: 'APPROVED' | 'REJECTED' | 'NEEDS_CHANGES',
  comments?: string
) {
  const statusMessages = {
    APPROVED: {
      type: 'VALIDATION_APPROVED' as NotificationType,
      title: 'Fiche validée !',
      message: `${validatorName} a validé votre fiche "${sheetTitle}"`
    },
    REJECTED: {
      type: 'VALIDATION_REJECTED' as NotificationType,
      title: 'Fiche rejetée',
      message: `${validatorName} a rejeté votre fiche "${sheetTitle}"`
    },
    NEEDS_CHANGES: {
      type: 'VALIDATION_NEEDS_CHANGES' as NotificationType,
      title: 'Modifications demandées',
      message: `${validatorName} demande des modifications sur "${sheetTitle}"`
    }
  };

  const config = statusMessages[status];

  return createNotification({
    userId,
    type: config.type,
    title: config.title,
    message: config.message,
    data: { sheetId, validatorName, comments }
  });
}

export async function notifySheetRemixed(
  originalAuthorId: string,
  sheetId: string,
  sheetTitle: string,
  remixerName: string,
  newSheetId: string
) {
  return createNotification({
    userId: originalAuthorId,
    type: 'SHEET_REMIXED',
    title: 'Votre fiche a été remixée',
    message: `${remixerName} a créé un remix de "${sheetTitle}"`,
    data: { originalSheetId: sheetId, newSheetId }
  });
}

export async function getUserNotifications(
  userId: string,
  options?: { unreadOnly?: boolean; limit?: number }
) {
  return prisma.notification.findMany({
    where: {
      userId,
      ...(options?.unreadOnly && { isRead: false })
    },
    orderBy: { createdAt: 'desc' },
    take: options?.limit || 50
  });
}

export async function markNotificationAsRead(notificationId: string, userId: string) {
  return prisma.notification.updateMany({
    where: {
      id: notificationId,
      userId
    },
    data: { isRead: true }
  });
}

export async function markAllNotificationsAsRead(userId: string) {
  return prisma.notification.updateMany({
    where: {
      userId,
      isRead: false
    },
    data: { isRead: true }
  });
}

export async function getUnreadCount(userId: string) {
  return prisma.notification.count({
    where: {
      userId,
      isRead: false
    }
  });
}
