import { ReactNode } from "react";

interface RemittanceLayoutProps {
  children: ReactNode;
}

export default function RemittanceLayout({ children }: RemittanceLayoutProps) {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-6">{children}</div>
    </div>
  );
}
