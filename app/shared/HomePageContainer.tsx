"use client";

export function HomePageContainer({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col overflow-hidden bg-[#000000] pt-[var(--app-header-height,55px)] text-white lg:pt-[var(--app-header-height,64px)]">
      {children}
    </div>
  );
}
