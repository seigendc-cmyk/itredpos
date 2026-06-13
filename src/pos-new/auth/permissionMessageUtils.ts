export function formatPermissionKey(permissionKey: string): string {
  return permissionKey.replace(/[._-]/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function getPermissionDeniedMessage(permissionKey: string): string {
  return `You do not have permission to perform this action. Required permission: ${formatPermissionKey(permissionKey)}.`;
}

export function getMenuRestrictedMessage(menuKey: string): string {
  return `This menu is restricted for the selected role in production mode. Menu: ${formatPermissionKey(menuKey)}. Build-development Owner bypass is currently active.`;
}

export function getBuildDevelopmentBypassMessage(): string {
  return 'Build-development Owner bypass is currently active. Production Staff PIN gate enforcement is not enabled yet.';
}
