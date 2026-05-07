export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="flex min-h-dvh w-full flex-col bg-black"
    >
      <div className="w-full flex-1">{children}</div>
    </div>
  );
}
