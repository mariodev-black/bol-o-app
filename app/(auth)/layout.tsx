export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="flex flex-col w-full lg:items-center lg:justify-start"
      style={{ minHeight: "100dvh", background: "linear-gradient(160deg, #0A1628 0%, #060B18 60%)" }}
    >
      <div className="flex-1 w-full lg:max-w-[440px]">{children}</div>
    </div>
  );
}
