export type OwnerNotificationType =
  | "BI_CRITICAL_ALERT"
  | "BI_HIGH_ALERT"
  | "BI_CASH_CONFIRMATION_MISSING"
  | "BI_DELIVERY_EXCEPTION";

export type OwnerNotificationSeverity = "HIGH" | "CRITICAL";

export interface OwnerNotification {
  id: string;
  vendorId: string;
  branchId?: string;
  title: string;
  message: string;
  type: OwnerNotificationType;
  severity: OwnerNotificationSeverity;
  sourceAlertId: string;
  read: boolean;
  createdAt: string;
  readAt?: string;
  readBy?: string;
}

export interface WriteOwnerNotificationInput {
  vendorId: string;
  branchId?: string;
  title: string;
  message: string;
  type: OwnerNotificationType;
  severity: OwnerNotificationSeverity;
  sourceAlertId: string;
}

const getStorageKey = (vendorId: string): string =>
  `itredpos_owner_notifications_${vendorId}`;

const nowIso = (): string => new Date().toISOString();

const safeRandomId = (): string => {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }

  return `owner_notification_${Date.now()}_${Math.random()
    .toString(36)
    .slice(2, 10)}`;
};

const readLocalNotifications = (vendorId: string): OwnerNotification[] => {
  if (typeof localStorage === "undefined") return [];

  try {
    const raw = localStorage.getItem(getStorageKey(vendorId));
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as OwnerNotification[]) : [];
  } catch {
    return [];
  }
};

const writeLocalNotifications = (
  vendorId: string,
  notifications: OwnerNotification[],
): void => {
  if (typeof localStorage === "undefined") return;

  const cappedNotifications = notifications
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 300);

  localStorage.setItem(
    getStorageKey(vendorId),
    JSON.stringify(cappedNotifications),
  );
};

const createDuplicateKey = (
  notification: Pick<
    OwnerNotification,
    "vendorId" | "type" | "sourceAlertId" | "createdAt"
  >,
): string =>
  [
    notification.vendorId,
    notification.type,
    notification.sourceAlertId,
    notification.createdAt.slice(0, 10),
  ].join("__");

export const createOwnerNotification = (
  input: WriteOwnerNotificationInput,
): OwnerNotification => ({
  id: safeRandomId(),
  vendorId: input.vendorId,
  branchId: input.branchId,
  title: input.title,
  message: input.message,
  type: input.type,
  severity: input.severity,
  sourceAlertId: input.sourceAlertId,
  read: false,
  createdAt: nowIso(),
});

export const getOwnerNotifications = async (
  vendorId: string,
): Promise<OwnerNotification[]> => {
  return readLocalNotifications(vendorId).sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  );
};

export const getUnreadOwnerNotifications = async (
  vendorId: string,
): Promise<OwnerNotification[]> => {
  const notifications = await getOwnerNotifications(vendorId);
  return notifications.filter((notification) => !notification.read);
};

export const writeOwnerNotification = async (
  input: WriteOwnerNotificationInput,
): Promise<OwnerNotification> => {
  const existingNotifications = await getOwnerNotifications(input.vendorId);
  const notification = createOwnerNotification(input);
  const duplicateKey = createDuplicateKey(notification);

  const duplicate = existingNotifications.find(
    (item) => createDuplicateKey(item) === duplicateKey,
  );

  if (duplicate) return duplicate;

  writeLocalNotifications(input.vendorId, [
    notification,
    ...existingNotifications,
  ]);

  return notification;
};

export const updateOwnerNotificationStatus = async (
  vendorId: string,
  notificationId: string,
  read: boolean,
  actorId?: string,
): Promise<OwnerNotification | null> => {
  const notifications = await getOwnerNotifications(vendorId);
  const timestamp = nowIso();

  let updatedNotification: OwnerNotification | null = null;

  const nextNotifications = notifications.map((notification) => {
    if (notification.id !== notificationId) return notification;

    updatedNotification = {
      ...notification,
      read,
      readAt: read ? timestamp : undefined,
      readBy: read ? actorId : undefined,
    };

    return updatedNotification;
  });

  writeLocalNotifications(vendorId, nextNotifications);

  return updatedNotification;
};

export const markOwnerNotificationRead = async (
  vendorId: string,
  notificationId: string,
  actorId?: string,
): Promise<OwnerNotification | null> =>
  updateOwnerNotificationStatus(vendorId, notificationId, true, actorId);

export const markOwnerNotificationUnread = async (
  vendorId: string,
  notificationId: string,
): Promise<OwnerNotification | null> =>
  updateOwnerNotificationStatus(vendorId, notificationId, false);

export const createOwnerNotificationFromBIAlert = async (alert: {
  id: string;
  vendorId: string;
  branchId?: string;
  alertType: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  title: string;
  reason: string;
}): Promise<OwnerNotification | null> => {
  if (alert.severity !== "HIGH" && alert.severity !== "CRITICAL") {
    return null;
  }

  let type: OwnerNotificationType =
    alert.severity === "CRITICAL" ? "BI_CRITICAL_ALERT" : "BI_HIGH_ALERT";

  if (alert.alertType === "MISSING_CASH_CONFIRMATION") {
    type = "BI_CASH_CONFIRMATION_MISSING";
  }

  if (alert.alertType === "DELIVERY_FULFILMENT") {
    type = "BI_DELIVERY_EXCEPTION";
  }

  return writeOwnerNotification({
    vendorId: alert.vendorId,
    branchId: alert.branchId,
    title: alert.title,
    message: alert.reason,
    type,
    severity: alert.severity === "CRITICAL" ? "CRITICAL" : "HIGH",
    sourceAlertId: alert.id,
  });
};

export const clearLocalOwnerNotifications = async (
  vendorId: string,
): Promise<void> => {
  if (typeof localStorage === "undefined") return;
  localStorage.removeItem(getStorageKey(vendorId));
};
