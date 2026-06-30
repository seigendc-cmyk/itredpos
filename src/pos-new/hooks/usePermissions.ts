export function usePermissions() {
  return {
    hasPermission: (_permission: string) => true,
    can: (_permission: string) => true
  };
}
