
import VendorLandingPage from "./VendorLandingPage";

type VendorAuthGateProps = {
  children: React.ReactNode;
};

const SESSION_KEY = "sci_vendor_owner_session";

export default function VendorAuthGate({ children }: VendorAuthGateProps) {
  const hasSession = Boolean(localStorage.getItem(SESSION_KEY));

  if (!hasSession) {
    return <VendorLandingPage />;
  }

  return <>{children}</>;
}
