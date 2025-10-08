//  "use client";

// import React from "react";
// import { Header } from "./header";
// import { Sidebar } from "./sidebar";
// import { BreadcrumbNav } from "./breadcrumb-nav";
// import { cn } from "@/lib/utils";

// interface DashboardLayoutProps {
//   children: React.ReactNode;
//   className?: string;
//   showBreadcrumbs?: boolean;
//   customBreadcrumbs?: Array<{ title: string; href?: string }>;
// }

// export function DashboardLayout({
//   children,
//   className,
//   showBreadcrumbs = true,
//   customBreadcrumbs,
// }: DashboardLayoutProps) {
//   return (
//     <div className="min-h-screen bg-background">
//       {/* Header */}
//       <Header className="" />

//       <div className="flex">
//         {/* Sidebar - Hidden on mobile, shown on desktop */}
//         <aside className="hidden md:flex md:w-72 md:flex-col md:fixed md:inset-y-0 md:top-14 bg-background border-r z-30">
//           <Sidebar className="" />
//         </aside>

//         {/* Main Content */}
//         <main className={cn("flex-1 md:ml-72 relative z-10", className)}>
//           {/* Breadcrumbs */}
//           {showBreadcrumbs && (
//             <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
//               <div className="container py-3">
//                 <BreadcrumbNav customBreadcrumbs={customBreadcrumbs} />
//               </div>
//             </div>
//           )}

//           {/* Page Content */}
//           <div className="container py-6">{children}</div>
//         </main>
//       </div>
//     </div>
//   );
// }
